import discord
from config import TARGET_FORUMS
from modules.parser import extract_yaml_from_markdown


async def scan_guild_forums(guild: discord.Guild):
    """Escanea los foros objetivo del servidor y devuelve (elementos, errores)"""
    database = []
    errors = []

    print("\n🔍 Escaneando canales de foro...")

    for channel in guild.forums:
        if channel.name.lower() in TARGET_FORUMS:
            print(f"📂 Escaneando foro: #{channel.name}")

            # Obtener hilos activos y archivados
            threads = list(channel.threads)
            async for archived in channel.archived_threads(limit=None):
                threads.append(archived)

            for thread in threads:
                try:
                    starter_msg = thread.starter_message
                    if not starter_msg:
                        starter_msg = await thread.fetch_message(thread.id)

                    if not starter_msg or not starter_msg.content:
                        continue

                    yaml_data, markdown_body = extract_yaml_from_markdown(
                        starter_msg.content
                    )

                    if yaml_data and "id" in yaml_data:
                        element = {
                            "id": str(yaml_data.get("id")).strip(),
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
                            "contenido_lore": markdown_body,
                            "imagenes": [
                                att.url for att in starter_msg.attachments
                            ],
                            "url_discord": thread.jump_url,
                        }
                        database.append(element)
                        print(f"  └─ ✅ [{element['id']}]")
                    else:
                        errors.append(
                            f"Hilo '{thread.name}' en #{channel.name} falta 'id' o YAML válido."
                        )

                except Exception as e:
                    print(
                        f"  └─ ⚠️ Error procesando el hilo '{thread.name}': {e}"
                    )

    return database, errors