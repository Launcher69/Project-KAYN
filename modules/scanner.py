import asyncio
import json
import os
import re
import time
import urllib.request
import discord
from config import GITHUB_REPO, IMGBB_API_KEY, JSON_FILE, TARGET_FORUMS
from modules.image_uploader import upload_to_imgbb
from modules.parser import extract_yaml_from_markdown


def clean_category_name(cat_name: str) -> str:
    """Limpia el nombre de la categoría eliminando etiquetas como (Terminado), (Fin), (Pri)"""
    if not cat_name:
        return ""
    cleaned = re.sub(
        r"\s*[\(\[][^\)\]]*(terminado|fin|archivado|pri|privado)[^\)\]]*[\)\]]",
        "",
        cat_name,
        flags=re.IGNORECASE,
    )
    return cleaned.strip().lower()


def is_category_private(cat_name: str) -> bool:
    if not cat_name:
        return False
    return any(t in cat_name.lower() for t in ["(pri)", "(privado)", "[pri]"])


def is_category_frozen(cat_name: str) -> bool:
    if not cat_name:
        return False
    return any(
        t in cat_name.lower()
        for t in ["(terminado)", "(fin)", "(archivado)", "[terminado]"]
    )


def load_existing_db(filepath: str) -> list:
    """Carga la base de datos previa directamente desde GitHub Raw o archivo local"""
    if GITHUB_REPO:
        try:
            clean_repo = (
                GITHUB_REPO.replace("https://github.com/", "")
                .strip()
                .strip("/")
            )
            clean_path = filepath.replace("\\", "/").strip("/")
            if clean_path.startswith("./"):
                clean_path = clean_path[2:]

            raw_url = f"https://raw.githubusercontent.com/{clean_repo}/main/{clean_path}?v={int(time.time())}"
            req = urllib.request.Request(
                raw_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                },
            )

            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if isinstance(data, list) and len(data) > 0:
                    print(
                        f"📥 Base de datos previa descargada de GitHub ({len(data)} fichas encontradas).",
                        flush=True,
                    )
                    return data
        except Exception as e:
            print(
                f"  └─ ⚠️ No se pudo descargar el JSON previo desde GitHub: {e}",
                flush=True,
            )

    try:
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
    except Exception:
        pass

    return []


async def scan_guild_forums(guild: discord.Guild):
    """Escanea los foros activos y conserva las fichas congeladas comparando nombres base limpios"""

    # 1. Cargar la base de datos previa de GitHub
    existing_db = load_existing_db(JSON_FILE)

    # 2. Identificar nombres BASE limpios de las categorías congeladas en Discord
    frozen_base_names = set()
    for cat in guild.categories:
        if is_category_frozen(cat.name):
            base_name = clean_category_name(cat.name)
            frozen_base_names.add(base_name)
            print(
                f"❄️ Categoría congelada detectada: '{cat.name}' (Nombre Base: '{base_name}')",
                flush=True,
            )

    # 3. Preservar fichas cuya categoría limpia coincida con las categorías congeladas
    preserved_items = []
    if existing_db:
        for item in existing_db:
            item_cat_base = clean_category_name(
                item.get("categoria_discord", "")
            )
            item_mundo_base = clean_category_name(item.get("mundo_id", ""))

            # Si el nombre base coincide con una categoría congelada, SE CONSERVA
            if (
                item_cat_base in frozen_base_names
                or item_mundo_base in frozen_base_names
            ):
                preserved_items.append(item)

        if preserved_items:
            print(
                f"❄️ Conservando {len(preserved_items)} fichas congeladas de mundos terminados.",
                flush=True,
            )

    # 4. Escanear categorías activas en Discord
    new_scanned_items = []
    errors = []

    print("\n🔍 Escaneando canales de foro activos...", flush=True)

    for channel in guild.forums:
        cat_name = channel.category.name if channel.category else ""

        if is_category_private(cat_name):
            print(
                f"⏩ Ignorando foro #{channel.name} por estar en la categoría privada '{cat_name}'",
                flush=True,
            )
            continue

        if is_category_frozen(cat_name):
            print(
                f"❄️ Saltando escaneo de foro #{channel.name} por estar en la categoría terminada '{cat_name}'",
                flush=True,
            )
            continue

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
                                            ".avif",
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
                            "categoria_discord": cat_name,
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

    # 5. Fusionar fichas congeladas conservadas + fichas activas escaneadas
    final_database = preserved_items + new_scanned_items
    print(
        f"\n✨ Sincronización completada: {len(preserved_items)} fichas congeladas conservadas + {len(new_scanned_items)} fichas activas = {len(final_database)} total en la Wiki.",
        flush=True,
    )

    return final_database, errors