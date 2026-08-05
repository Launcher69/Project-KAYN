import asyncio
import re
import discord
import yaml


def get_target_forum_name(tipo: str) -> str:
    """Calcula automáticamente el nombre del canal #foro-xxx de forma modular"""
    tipo_clean = (tipo or "entidad").lower().strip()

    special_mappings = {
        "npc": "foro-npcs",
        "pc": "foro-npcs",
        "personaje": "foro-npcs",
        "organizacion": "foro-facciones",
        "faccion": "foro-facciones",
        "artefacto": "foro-objetos",
        "objeto": "foro-objetos",
        "evento": "foro-tramas",
        "trama": "foro-tramas",
        "lugar": "foro-lugares",
        "mundo": "foro-mundos",
    }

    if tipo_clean in special_mappings:
        return special_mappings[tipo_clean]

    if tipo_clean[-1] in "aeiouáéíóú":
        plural = f"{tipo_clean}s"
    else:
        plural = f"{tipo_clean}es"

    return f"foro-{plural}"


def split_content_smart(content: str, max_length: int = 1850) -> list:
    """Divide el texto estrictamente por párrafos completos (\n\n / punto y aparte)"""
    chunks = []
    remaining = content.strip()

    while len(remaining) > max_length:
        # 1. PRIMERA PRIORIDAD: Buscar el último 'punto y aparte' (\n\n) dentro del límite
        split_pos = remaining.rfind("\n\n", 0, max_length)

        # 2. SEGUNDA PRIORIDAD: Si un solo párrafo fuera gigante, buscar un punto y seguido (.\n o . )
        if split_pos == -1 or split_pos < 400:
            dot_pos = remaining.rfind(".\n", 0, max_length)
            if dot_pos != -1 and dot_pos > 400:
                split_pos = dot_pos + 1
            else:
                dot_space_pos = remaining.rfind(". ", 0, max_length)
                if dot_space_pos != -1 and dot_space_pos > 400:
                    split_pos = dot_space_pos + 1

        # 3. TERCERA PRIORIDAD: Salto de línea simple
        if split_pos == -1 or split_pos < 200:
            split_pos = remaining.rfind("\n", 0, max_length)

        # 4. ÚLTIMO RECURSO: Espacio entre palabras
        if split_pos == -1:
            split_pos = remaining.rfind(" ", 0, max_length)

        if split_pos == -1:
            split_pos = max_length

        chunk = remaining[:split_pos].strip()
        if chunk:
            chunks.append(chunk)

        remaining = remaining[split_pos:].strip()

    if remaining:
        chunks.append(remaining)

    return chunks


def parse_master_text(full_text: str) -> list:
    """Extrae cada ficha eliminando guiones dobles --- y cabeceras de canal sobrantes"""
    entities = []

    pattern = r"---\s*\n(.*?)\n---\s*\n?(.*?)(?=(?:---\s*\n|\Z))"
    matches = re.findall(pattern, full_text, re.DOTALL | re.MULTILINE)

    for yaml_str, markdown_lore in matches:
        clean_yaml = re.sub(r"^---\s*", "", yaml_str.strip(), flags=re.M)
        clean_yaml = re.sub(r"---\s*$", "", clean_yaml.strip(), flags=re.M)

        if not clean_yaml.strip():
            continue

        try:
            yaml_data = yaml.safe_load(clean_yaml)
            if isinstance(yaml_data, dict) and "id" in yaml_data:

                clean_lore = re.sub(
                    r"(?i)\n*#*\s*(?:📌|📍|👤|🎒|🛡️|📜)?\s*(?:CANAL|Canal):\s*#?foro-[\w-]+\s*$",
                    "",
                    markdown_lore.strip(),
                ).strip()

                full_content = f"---\n{clean_yaml.strip()}\n---\n\n{clean_lore}"

                entities.append(
                    {
                        "id": str(yaml_data.get("id")).strip(),
                        "tipo": str(
                            yaml_data.get("tipo", "desconocido")
                        ).lower(),
                        "nombre": yaml_data.get("nombre", "Ficha Sin Nombre"),
                        "full_content": full_content.strip(),
                    }
                )
        except Exception as e:
            print(f"⚠️ Error al procesar bloque YAML: {e}", flush=True)

    return entities


async def process_world_generation(ctx):
    """Lee mensajes o .txt CREADOS ANTES del comando !generar_mundo"""
    category = ctx.channel.category
    if not category:
        await ctx.send(
            "❌ Este comando debe ejecutarse dentro de un canal perteneciente a una Categoría."
        )
        return

    status_msg = await ctx.send(
        "⏳ Leyendo datos y preparando la generación automática del mundo..."
    )

    full_text = ""

    async for msg in ctx.channel.history(
        limit=100, before=ctx.message, oldest_first=True
    ):
        if msg.author.bot:
            continue

        if msg.attachments:
            for att in msg.attachments:
                if att.filename.endswith(".txt"):
                    file_bytes = await att.read()
                    full_text += file_bytes.decode("utf-8") + "\n\n"

        if msg.content:
            full_text += msg.content + "\n\n"

    if not full_text.strip():
        await status_msg.edit(
            content="❌ No se encontró texto ni archivo `.txt` previo al comando en este canal."
        )
        return

    entities = parse_master_text(full_text)
    if not entities:
        await status_msg.edit(
            content="❌ No se encontraron fichas válidas. Asegúrate de incluir el bloque `---` al inicio y final de cada cabecera YAML."
        )
        return

    await status_msg.edit(
        content=f"🔍 Se detectaron **{len(entities)} fichas**. Comprobando foros modulares en '{category.name}'..."
    )

    existing_forums = {
        c.name.lower(): c
        for c in category.channels
        if isinstance(c, discord.ForumChannel)
    }

    created_threads_count = 0

    for entity in entities:
        tipo = entity["tipo"]
        target_forum_name = get_target_forum_name(tipo)

        if target_forum_name not in existing_forums:
            try:
                new_forum = await category.create_forum(name=target_forum_name)
                existing_forums[target_forum_name] = new_forum
                print(
                    f"✨ Foro Modular Creado: #{target_forum_name} en '{category.name}'",
                    flush=True,
                )
                await asyncio.sleep(1)
            except Exception as e:
                print(
                    f"❌ Error al crear el foro #{target_forum_name}: {e}",
                    flush=True,
                )
                continue

        forum = existing_forums[target_forum_name]
        content = entity["full_content"]
        title = entity["nombre"][:100]

        try:
            # 🛡️ DIVISIÓN INTELIGENTE DE TEXTO: Respeta párrafos y no corta palabras
            chunks = split_content_smart(content, max_length=1850)

            if len(chunks) == 1:
                await forum.create_thread(name=title, content=chunks[0])
            else:
                thread_with_msg = await forum.create_thread(
                    name=title, content=chunks[0]
                )
                thread = thread_with_msg.thread

                for chunk in chunks[1:]:
                    await thread.send(chunk)
                    await asyncio.sleep(0.5)

            created_threads_count += 1
            print(f"  └─ Hilo Creado: '{title}' en #{forum.name}", flush=True)
            await asyncio.sleep(1.5)

        except Exception as e:
            print(f"❌ Error creando hilo para '{title}': {e}", flush=True)

    await status_msg.edit(
        content=f"🎉 **¡Mundo Generado con Éxito!**\nSe han creado los foros e instalado **{created_threads_count} fichas** en la categoría **'{category.name}'**.\n\nSincronizando con la web..."
    )