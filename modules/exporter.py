import base64
import json
import urllib.request
from config import GITHUB_REPO, GITHUB_TOKEN


def save_to_json(data: list, filepath: str) -> bool:
    """Guarda localmente y actualiza el archivo en GitHub usando su API"""
    try:
        # Convertir datos a JSON formateado
        json_str = json.dumps(data, ensure_ascii=False, indent=4)

        # 1. Intentar guardar copia local si estamos en local
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(json_str)
            print(f"✅ Guardado archivo local en {filepath}")
        except Exception:
            pass

        # 2. Si hay token de GitHub, actualizar en la nube directamente por API
        if GITHUB_TOKEN and GITHUB_REPO:
            print("🚀 Enviando actualización a GitHub por API...")
            success = update_github_file(
                repo=GITHUB_REPO,
                path="web/wiki_database.json",
                content=json_str,
                token=GITHUB_TOKEN,
            )
            if success:
                print("✨ ¡Web en la nube actualizada con éxito!")

        return True
    except Exception as e:
        print(f"❌ Error al exportar: {e}")
        return False


def update_github_file(repo: str, path: str, content: str, token: str) -> bool:
    """Modifica o crea un archivo en GitHub mediante su API REST"""
    try:
        url = f"https://api.github.com/repos/{repo}/contents/{path}"
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "DiscordWikiBot",
        }

        # Obtener el SHA actual del archivo si existe (requerido por GitHub)
        sha = None
        try:
            req_get = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req_get) as resp:
                res_json = json.loads(resp.read().decode("utf-8"))
                sha = res_json.get("sha")
        except Exception:
            pass

        content_b64 = base64.b64encode(content.encode("utf-8")).decode("utf-8")

        payload = {
            "message": "Auto-sync Wiki desde Discord (Bot en la Nube)",
            "content": content_b64,
        }
        if sha:
            payload["sha"] = sha

        payload_bytes = json.dumps(payload).encode("utf-8")
        req_put = urllib.request.Request(
            url, data=payload_bytes, headers=headers, method="PUT"
        )

        with urllib.request.urlopen(req_put) as resp:
            return resp.status in [200, 201]

    except Exception as e:
        print(f"  └─ ⚠️ Error al conectar con la API de GitHub: {e}")
        return False