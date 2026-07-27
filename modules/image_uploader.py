import base64
import json
import urllib.parse
import urllib.request


def upload_to_imgbb(image_url: str, api_key: str) -> str:
    """Descarga la imagen de Discord a memoria y la sube en Base64 a ImgBB para evitar bloqueos"""
    if not api_key or "AQUI" in api_key:
        return upload_to_catbox(image_url)

    try:
        # 1. Python descarga los bytes de la imagen desde Discord directamente
        req_discord = urllib.request.Request(
            image_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
        )
        with urllib.request.urlopen(req_discord) as resp_discord:
            image_bytes = resp_discord.read()

        # 2. Convertir los bytes a texto Base64
        base64_image = base64.b64encode(image_bytes).decode("utf-8")

        # 3. Subir el paquete de datos directamente a ImgBB
        api_endpoint = f"https://api.imgbb.com/1/upload?key={api_key}"
        payload = urllib.parse.urlencode({"image": base64_image}).encode(
            "utf-8"
        )

        req_imgbb = urllib.request.Request(
            api_endpoint,
            data=payload,
            headers={"User-Agent": "Mozilla/5.0"},
        )

        with urllib.request.urlopen(req_imgbb) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if res_data.get("success"):
                # Devuelve la URL limpia y funcional
                return res_data["data"]["url"]

    except Exception as e:
        print(f"  └─ ⚠️ Error procesando la imagen con ImgBB: {e}")

    # Fallback a Catbox si falla
    return upload_to_catbox(image_url)


def upload_to_catbox(image_url: str) -> str:
    """Fallback a Catbox descargando los bytes previamente"""
    try:
        req_discord = urllib.request.Request(
            image_url, headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req_discord) as resp_discord:
            image_bytes = resp_discord.read()

        boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
        body = []
        body.append(f"--{boundary}".encode())
        body.append('Content-Disposition: form-data; name="reqtype"'.encode())
        body.append("".encode())
        body.append("fileupload".encode())

        body.append(f"--{boundary}".encode())
        body.append(
            'Content-Disposition: form-data; name="fileToUpload"; filename="image.png"'.encode()
        )
        body.append("Content-Type: image/png".encode())
        body.append("".encode())
        body.append(image_bytes)
        body.append(f"--{boundary}--".encode())

        payload = b"\r\n".join(body)

        req_catbox = urllib.request.Request(
            "https://catbox.moe/user/api.php",
            data=payload,
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "Mozilla/5.0",
            },
        )

        with urllib.request.urlopen(req_catbox) as response:
            res_url = response.read().decode("utf-8").strip()
            if res_url.startswith("http"):
                return res_url
    except Exception as e:
        print(f"  └─ ⚠️ Error al subir a Catbox: {e}")

    return image_url