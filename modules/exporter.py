import base64
import json
import os
import time
import urllib.error
import urllib.request
from config import GITHUB_REPO, GITHUB_TOKEN


def purge_jsdelivr_cache(repo: str, path: str):
    """Avisa a jsDelivr para borrar la caché y refrescar los datos en 0,1s"""
    try:
        purge_url = f"https://purge.jsdelivr.net/gh/{repo}@main/{path}"
        req = urllib.request.Request(
            purge_url, headers={"User-Agent": "DiscordWikiBot"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                print("⚡ Caché de jsDelivr purgada en 0,1s.", flush=True)
    except Exception as e:
        print(f"⚠️ No se pudo purgar jsDelivr: {e}", flush=True)


def save_to_json(data: list, filepath: str) -> bool:
    """Guarda localmente, actualiza GitHub y borra la caché de jsDelivr"""
    try:
        json_str = json.dumps(data, ensure_ascii=False, indent=4)

        clean_path = filepath.replace("\\", "/").strip("/")
        if clean_path.startswith("./"):
            clean_path = clean_path[2:]

        # Normalizar minúsculas web/ a Web/public/
        if clean_path.lower() in ["web/wiki_database.json", "wiki_database.json"]:
            clean_path = "Web/public/wiki_database.json"

        # Guardar en Web/public/wiki_database.json
        try:
            os.makedirs(os.path.dirname(clean_path), exist_ok=True)
            with open(clean_path, "w", encoding="utf-8") as f:
                f.write(json_str)
        except Exception as file_err:
            print(f"⚠️ Error escribiendo localmente en {clean_path}: {file_err}", flush=True)

        # También guardar copia en Web/wiki_database.json para compatibilidad local
        try:
            secondary_path = "Web/wiki_database.json"
            if clean_path != secondary_path and os.path.exists("Web"):
                with open(secondary_path, "w", encoding="utf-8") as f:
                    f.write(json_str)
        except Exception:
            pass

        if GITHUB_TOKEN and GITHUB_REPO:
            print(
                f"🚀 Enviando actualización a GitHub API en: '{clean_path}'...",
                flush=True,
            )

            clean_repo = (
                GITHUB_REPO.replace("https://github.com/", "")
                .strip()
                .strip("/")
            )

            success = update_github_file(
                repo=clean_repo,
                path=clean_path,
                content=json_str,
                token=GITHUB_TOKEN.strip(),
            )
            if success:
                print("✨ ¡Guardado en GitHub!", flush=True)
                # Purga instantánea en jsDelivr
                purge_jsdelivr_cache(clean_repo, clean_path)
                return True

        return True
    except Exception as e:
        print(f"❌ Error al exportar: {e}", flush=True)
        return False


def update_github_file(repo: str, path: str, content: str, token: str, max_retries: int = 3) -> bool:
    """Modifica un archivo en GitHub enviando [skip ci] con sistema de reintentos automático"""
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "DiscordWikiBot",
    }

    for attempt in range(1, max_retries + 1):
        try:
            # 1. Obtener el SHA actual del archivo si existe
            sha = None
            try:
                req_get = urllib.request.Request(
                    f"{url}?ref=main", headers=headers
                )
                with urllib.request.urlopen(req_get, timeout=15) as resp:
                    res_json = json.loads(resp.read().decode("utf-8"))
                    sha = res_json.get("sha")
            except Exception:
                pass

            # 2. Convertir contenido a Base64
            content_b64 = base64.b64encode(content.encode("utf-8")).decode("utf-8")

            payload = {
                "message": f"Auto-sync Wiki desde Discord en {path} [skip ci]",
                "content": content_b64,
                "branch": "main",
            }
            if sha:
                payload["sha"] = sha

            payload_bytes = json.dumps(payload).encode("utf-8")
            req_put = urllib.request.Request(
                url, data=payload_bytes, headers=headers, method="PUT"
            )

            # 3. Petición PUT a GitHub con Timeout de 30s
            with urllib.request.urlopen(req_put, timeout=30) as resp:
                if resp.status in [200, 201]:
                    return True

        except urllib.error.HTTPError as http_err:
            print(f"  └─ ⚠️ Intento {attempt}/{max_retries} falló (HTTP {http_err.code}: {http_err.reason})", flush=True)
            # Reintentar si es error de servidor temporal (500, 502, 503, 504)
            if http_err.code in [500, 502, 503, 504] and attempt < max_retries:
                time.sleep(3 * attempt)  # Espera 3s, 6s... antes de reintentar
                continue
            break
        except Exception as e:
            print(f"  └─ ⚠️ Intento {attempt}/{max_retries} falló con error: {e}", flush=True)
            if attempt < max_retries:
                time.sleep(3 * attempt)
                continue
            break

    return False