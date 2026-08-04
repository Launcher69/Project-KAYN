import asyncio
import re
import discord
import yaml

# Mapeo automático de 'tipo:' a su canal de foro
TIPO_A_FORO = {
    "mundo": "foro-mundos",
    "lugar": "foro-lugares",
    "npc": "foro-npcs",
    "pc": "foro-npcs",
    "personaje": "foro-npcs",
    "faccion": "foro-facciones",
    "organizacion": "foro-facciones",
    "objeto": "foro-objetos",
    "artefacto": "foro-objetos",
    "trama": "foro-tramas",
    "evento": "foro-tramas",
}


def parse_master_text(full_text: str) -> list:
    """Extrae cada ficha eliminando guiones dobles --- y encabezados de canal sobrantes"""
    entities = []

    pattern = r"---\s*\n(.*?)\n---\s*\n?(.*?)(?=(?:---\s*\n|\Z))"
    matches = re.findall(pattern, full_text, re.DOTALL | re.MULTILINE)

    for yaml_str, markdown_lore in matches:
        # 1. Limpiar el YAML para evitar el '---' doble al principio
        clean_yaml = re.sub(r"^---\s*", "", yaml_str.strip(), flags=re.M)
        clean_yaml = re.sub(r"---\s*$", "", clean_yaml.strip(), flags=re.M)

        if not clean_yaml.strip():
            continue

        try:
            yaml_data = yaml.safe_load(clean_yaml)
            if isinstance(yaml_data, dict) and "id" in yaml_data:

                # 2. Limpiar la lore eliminando las líneas tipo "# Canal: #foro-..." o "📌 Canal: #foro-..." al final
                clean_lore = re.sub(
                    r"(?i)\n*#*\s*(?:📌|📍|👤|🎒|🛡️|📜)?\s*(?:CANAL|Canal):\s*#?foro-[\w-]+\s*$",
                    "",
                    markdown_lore.strip(),
                ).strip()

                # 3. Reconstruir el post limpio con UN SOLO '---' arriba y abajo
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
    """Lee mensajes o archivos .txt, crea foros faltantes y publica todos los hilos"""
    category = ctx.channel.category
    if not category:
        await ctx.send(
            "❌ Este comando debe ejecutarse dentro de un canal perteneciente a una Categoría."
        )
        return

    status_msg = await ctx.send(
        "⏳ Leyendo datos y preparando la generación automática del mundo..."
    )

    # 1. Recopilar texto
    full_text = ""

    async for msg in ctx.channel.history(limit=100, oldest_first=True):
        if msg.attachments:
            for att in msg.attachments:
                if att.filename.endswith(".txt"):
                    file_bytes = await att.read()
                    full_text += file_bytes.decode("utf-8") + "\n\n"

        if msg.content and not msg.content.startswith(ctx.prefix):
            full_text += msg.content + "\n\n"

    if not full_text.strip():
        await status_msg.edit(
            content="❌ No se encontró texto ni archivo `.txt` en este canal."
        )
        return

    # 2. Parsear entidades individuales
    entities = parse_master_text(full_text)
    if not entities:
        await status_msg.edit(
            content="❌ No se encontraron fichas válidas. Asegúrate de incluir el bloque `---` al inicio y final de cada cabecera YAML."
        )
        return

    await status_msg.edit(
        content=f"🔍 Se detectaron **{len(entities)} fichas**. Comprobando foros en '{category.name}'..."
    )

    # 3. Obtener o crear canales de foro necesarios
    existing_forums = {
        c.name.lower(): c
        for c in category.channels
        if isinstance(c, discord.ForumChannel)
    }

    created_threads_count = 0

    for entity in entities:
        tipo = entity["tipo"]
        target_forum_name = TIPO_A_FORO.get(tipo, "foro-tramas")

        if target_forum_name not in existing_forums:
            try:
                new_forum = await category.create_forum(name=target_forum_name)
                existing_forums[target_forum_name] = new_forum
                print(
                    f"✨ Foro Creado: #{target_forum_name} en '{category.name}'",
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
            # 4. Crear el hilo
            if len(content) <= 2000:
                await forum.create_thread(name=title, content=content)
            else:
                first_part = content[:1900]
                second_part = content[1900:]

                thread_with_msg = await forum.create_thread(
                    name=title, content=first_part
                )
                thread = thread_with_msg.thread

                while len(second_part) > 0:
                    chunk = second_part[:1900]
                    second_part = second_part[1900:]
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