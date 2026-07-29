import asyncio
import json
import os
import discord
from config import IMGBB_API_KEY, JSON_FILE, TARGET_FORUMS
from modules.image_uploader import upload_to_imgbb
from modules.parser import extract_yaml_from_markdown


def is_category_private(cat_name: str) -> bool:
    """Comprueba si una categoría es privada (borrador)"""
    if not cat_name:
        return False
    name_lower = cat_name.lower()
    return "(pri)" in name_lower or "(privado)" in name_lower


def is_category_frozen(cat_name: str) -> bool:
    """Comprueba si una categoría está terminada/congelada"""
    if not cat_name:
        return False
    name_lower = cat_name.lower()
    return any(
        tag in name_lower
        for tag in ["(terminado)", "(fin)", "(archivado)", "[terminado]"]
    )


def load_existing_db(filepath: str) -> list:
    """Carga la base de datos JSON previa si existe"""
    try:
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
    except Exception as e:
        print(f"  └─ ⚠️ No se pudo cargar el JSON previo: {e}", flush=True)
    return []


async def scan_guild_forums(guild: discord.Guild):
    """Escanea solo canales activos y conserva intactas las fichas de categorías congeladas"""

    # 1. Cargar la base de datos previa de la Wiki
    existing_db = load_existing_db(JSON_FILE)

    # 2. Identificar nombres de categorías que actualmente están congeladas en Discord
    frozen_category_names = set()
    for cat in guild.categories:
        if is_category_frozen(cat.name):
            frozen_category_names.add(cat.name.lower())

    # 3. Conservar únicamente las fichas que pertenecen a categorías congeladas
    preserved_items = []
    if existing_db:
        for item in existing_db:
            item_cat = (item.get("categoria_discord") or "").lower()
            # Si la ficha pertenece a una categoría que actualmente está congelada, se conserva
            if any(
                frozen_tag in item_cat for frozen_tag in frozen_category_names
            ):
                preserved_items.append(item)

        if preserved_items:
            print(
                f"❄️ Conservando {len(preserved_items)} fichas congeladas de historias terminadas.",
                flush=True,
            )

    # 4. Escanear categorías activas en Discord
    new_scanned_items = []
    errors = []

    print("\n🔍 Escaneando canales de foro activos...", flush=True)

    for channel in guild.forums:
        cat_name = channel.category.name if channel.category else ""

        # Filtro A: Ignorar categorías privadas (Pri)
        if is_category_private(cat_name):
            print(
                f"⏩ Ignorando foro #{channel.name} por estar en la categoría privada '{cat_name}'",
                flush=True,
            )
            continue

        # Filtro B: Saltar el escaneo de categorías terminadas/congeladas
        if is_category_frozen(cat_name):
            print(
                f"❄️ Saltando escaneo de foro #{channel.name} (Categoría congelada: '{cat_name}')",
                flush=True,
            )
            continue

        # Escanear solo si el foro pertenece a nuestra lista de foros objetivo
        if channel.name.lower() in TARGET_FORUMS:
            print(
                f"📂 Escaneando foro activo: #{channel.name} (Categoría: '{cat_name}')",
                flush=True,
            )

            threads = list(channel.threads)
            async for archived in channel.archived_threads(limit=None):
                threads.append(archived)

            for thread in threads:
                try:
                    messages = []
                    async for msg in thread.history(
                        limit=None, oldest_first=True
                    ):
                        messages.append(msg)

                    if not messages:
                        continue

                    starter_msg = messages[0]
                    if not starter_msg.content:
                        continue

                    yaml_data, starter_markdown = extract_yaml_from_markdown(
                        starter_msg.content
                    )

                    if yaml_data and "id" in yaml_data:
                        element_id = str(yaml_data.get("id")).strip()

                        lore_parts = []
                        if starter_markdown:
                            lore_parts.append(starter_markdown)

                        for follow_up_msg in messages[1:]:
                            if (
                                follow_up_msg.content
                                and follow_up_msg.content.strip()
                            ):
                                lore_parts.append(follow_up_msg.content.strip())

                        full_lore_body = "\n\n".join(lore_parts)

                        # Subir imágenes a ImgBB
                        permanent_image_urls = []
                        for msg in messages:
                            if msg.attachments:
                                for attachment in msg.attachments:
                                    if any(
                                        attachment.filename.lower().endswith(
                                            ext
                                        )
                                        for ext in [
                                            ".png",
                                            ".jpg",
                                            ".jpeg",
                                            ".gif",
                                            ".webp",
                                        ]
                                    ):
                                        print(
                                            f"  └─ ☁️ Subiendo imagen de [{element_id}]...",
                                            flush=True,
                                        )
                                        perm_url = await asyncio.to_thread(
                                            upload_to_imgbb,
                                            attachment.url,
                                            IMGBB_API_KEY,
                                        )
                                        permanent_image_urls.append(perm_url)

                        element = {
                            "id": element_id,
                            "tipo": str(
                                yaml_data.get("tipo", "desconocido")
                            ).strip(),
                            "nombre": yaml_data.get("nombre", thread.name),
                            "mundo_id": str(
                                yaml_data.get("mundo_id", "desconocido")
                            ).strip(),
                            "relaciones": yaml_data.get("relaciones", []),
                            "detalles": yaml_data.get("detalles", {}),
                            "categoria_discord": cat_name,  # <--- Guarda el nombre de la categoría
                            "etiquetas_discord": [
                                tag.name for tag in thread.applied_tags
                            ],
                            "contenido_lore": full_lore_body,
                            "imagenes": permanent_image_urls,
                            "url_discord": thread.jump_url,
                        }
                        new_scanned_items.append(element)
                        print(
                            f"  └─ ✅ Registrado [{element['id']}]", flush=True
                        )
                    else:
                        errors.append(
                            f"Hilo '{thread.name}' en #{channel.name} falta 'id' o YAML válido."
                        )

                except Exception as e:
                    print(
                        f"  └─ ⚠️ Error procesando el hilo '{thread.name}': {e}",
                        flush=True,
                    )

    # 5. Fusionar fichas congeladas conservadas + fichas activas recién escaneadas
    final_database = preserved_items + new_scanned_items
    print(
        f"\n✨ Sincronización completada: {len(preserved_items)} fichas congeladas + {len(new_scanned_items)} fichas activas = {len(final_database)} total en la Wiki.",
        flush=True,
    )

    return final_database, errors