import asyncio
import discord
from config import IMGBB_API_KEY, TARGET_FORUMS
from modules.image_uploader import upload_to_imgbb
from modules.parser import extract_yaml_from_markdown


async def scan_guild_forums(guild: discord.Guild):
    """Escanea los foros procesando las imágenes en hilos secundarios para no congelar Discord"""
    database = []
    errors = []

    print("\n🔍 Escaneando canales de foro...", flush=True)

    for channel in guild.forums:
        if channel.name.lower() in TARGET_FORUMS:
            print(f"📂 Escaneando foro: #{channel.name}", flush=True)

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

                        # Unificar textos
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

                        # SUBIR IMÁGENES EN SEGUNDO PLANO (Sin congelar Discord)
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
                                            f"  └─ ☁️ Subiendo imagen de [{element_id}] en segundo plano...",
                                            flush=True,
                                        )

                                        # Ejecuta la subida en un hilo separado
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
                            "etiquetas_discord": [
                                tag.name for tag in thread.applied_tags
                            ],
                            "contenido_lore": full_lore_body,
                            "imagenes": permanent_image_urls,
                            "url_discord": thread.jump_url,
                        }
                        database.append(element)
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

    return database, errors