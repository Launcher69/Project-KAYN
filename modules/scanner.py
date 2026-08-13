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
    clean_path = filepath.replace("\\", "/").strip("/")
    if clean_path.startswith("./"):
        clean_path = clean_path[2:]
    if clean_path.lower() in ["web/wiki_database.json", "wiki_database.json"]:
        clean_path = "Web/public/wiki_database.json"

    candidate_paths = [
        clean_path,
        "Web/public/wiki_database.json",
        "web/wiki_database.json",
        "Web/wiki_database.json",
        "wiki_database.json",
    ]

    if GITHUB_REPO:
        clean_repo = (
            GITHUB_REPO.replace("https://github.com/", "")
            .strip()
            .strip("/")
        )
        for gh_path in candidate_paths:
            try:
                raw_url = f"https://raw.githubusercontent.com/{clean_repo}/main/{gh_path}?v={int(time.time())}"
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
                            f"📥 Base de datos previa descargada de GitHub desde '{gh_path}' ({len(data)} fichas encontradas).",
                            flush=True,
                        )
                        return data
            except Exception:
                continue
        print("  └─ ⚠️ No se pudo descargar el JSON previo desde GitHub (probando fallback local).", flush=True)

    candidate_files = [
        clean_path,
        "Web/public/wiki_database.json",
        "Web/wiki_database.json",
        "public/wiki_database.json",
        "wiki_database.json",
    ]

    for candidate in candidate_files:
        try:
            if os.path.exists(candidate):
                with open(candidate, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        return data
        except Exception:
            pass

    return []


async def scan_guild_forums(guild: discord.Guild):
    """Escanea los foros activos y conserva las fichas congeladas y exclusivas de la web"""

    # 1. Cargar la base de datos previa de GitHub o local
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

    # 3. Preservar fichas congeladas y fichas exclusivas de la web (sin URL de Discord)
    preserved_items = []
    if existing_db:
        for item in existing_db:
            item_cat_base = clean_category_name(
                item.get("categoria_discord", "")
            )
            item_mundo_base = clean_category_name(item.get("mundo_id", ""))
            url_disc = str(item.get("url_discord", "")).strip()

            # Conservar si pertenece a categoría congelada O si es un elemento exclusivo de la Web
            if (
                item_cat_base in frozen_base_names
                or item_mundo_base in frozen_base_names
                or not url_disc
            ):
                preserved_items.append(item)

        if preserved_items:
            print(
                f"❄️ Conservando {len(preserved_items)} fichas (congeladas / creadas en Web).",
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


        # ANTES: if channel.name.lower() in TARGET_FORUMS:
        # AHORA (MODULAR): Acepta cualquier canal de foro cuyo nombre empiece por "foro-"
        if channel.name.lower().startswith("foro-"):
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
                    async for msg in thread.history(limit=None, oldest_first=True):
                        # BORRAR MENSAJES DE SISTEMA AUTOMÁTICAMENTE
                        if msg.is_system():
                            try:
                                await msg.delete()
                                await asyncio.sleep(0.2)
                            except Exception:
                                pass
                            continue

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

    # 5. Fusionar fichas conservadas + fichas activas escaneadas sin duplicados
    db_map = {item["id"]: item for item in preserved_items if "id" in item}
    for item in new_scanned_items:
        if "id" in item:
            db_map[item["id"]] = item

    final_database = list(db_map.values())
    print(
        f"\n✨ Sincronización completada: {len(preserved_items)} fichas conservadas + {len(new_scanned_items)} fichas escaneadas = {len(final_database)} total únicas en la Wiki.",
        flush=True,
    )

    return final_database, errors