import base64
import json
import urllib.error
import urllib.request
from config import GITHUB_REPO, GITHUB_TOKEN


def save_to_json(data: list, filepath: str) -> bool:
    """Guarda localmente y actualiza el archivo en GitHub usando la ruta configurada"""
    try:
        json_str = json.dumps(data, ensure_ascii=False, indent=4)

        clean_path = filepath.replace("\\", "/").strip("/")
        if clean_path.startswith("./"):
            clean_path = clean_path[2:]

        try:
            with open(clean_path, "w", encoding="utf-8") as f:
                f.write(json_str)
        except Exception:
            pass

        if GITHUB_TOKEN and GITHUB_REPO:
            print(
                f"🚀 Enviando actualización a GitHub por API en: '{clean_path}'...",
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
                print("✨ ¡Datos enviados a GitHub instantáneamente!", flush=True)
                return True
            else:
                print("⚠️ Falló la actualización en GitHub por API.", flush=True)

        return True
    except Exception as e:
        print(f"❌ Error al exportar: {e}", flush=True)
        return False


def update_github_file(repo: str, path: str, content: str, token: str) -> bool:
    """Modifica un archivo en GitHub enviando [skip ci] para evitar la recompilación de Cloudflare"""
    try:
        url = f"https://api.github.com/repos/{repo}/contents/{path}"
        headers = {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "DiscordWikiBot",
        }

        sha = None
        try:
            req_get = urllib.request.Request(
                f"{url}?ref=main", headers=headers
            )
            with urllib.request.urlopen(req_get) as resp:
                res_json = json.loads(resp.read().decode("utf-8"))
                sha = res_json.get("sha")
        except Exception:
            pass

        content_b64 = base64.b64encode(content.encode("utf-8")).decode("utf-8")

        # [skip ci] le dice a Cloudflare Pages que NO ejecute un nuevo Build
        payload = {
            "message": f"Auto-sync Wiki desde Discord en {path} [skip ci]",  # <--- ¡AQUÍ ESTÁ EL TRUCO!
            "content": content_b64,
            "branch": "main",
        }
        if sha:
            payload["sha"] = sha

        payload_bytes = json.dumps(payload).encode("utf-8")
        req_put = urllib.request.Request(
            url, data=payload_bytes, headers=headers, method="PUT"
        )

        with urllib.request.urlopen(req_put) as resp:
            return resp.status in [200, 201]

    except urllib.error.HTTPError as e:
        print(f"  └─ ⚠️ Error API GitHub ({e.code}) en '{path}'", flush=True)
        return False
    except Exception as e:
        print(f"  └─ ⚠️ Error inesperado: {e}", flush=True)
        return False