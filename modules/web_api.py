import asyncio
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
import yaml
from config import JSON_FILE
from modules.exporter import save_to_json
from modules.scanner import scan_guild_forums
from modules.world_generator import split_content_smart

BOT_INSTANCE = None


def clean_yaml_payload(data: dict) -> dict:
    """Limpia y normaliza el payload para que el YAML resultante sea 100% nativo"""

    # 1. Normalizar relaciones a lista de dicts
    relaciones_raw = data.get("relaciones", [])
    if isinstance(relaciones_raw, dict):
        relaciones_cleaned = [relaciones_raw]
    elif isinstance(relaciones_raw, list):
        relaciones_cleaned = relaciones_raw
    else:
        relaciones_cleaned = []

    # 2. Normalizar detalles y descomprimir strings JSON (como ficha_atributos)
    detalles_raw = data.get("detalles", {})
    detalles_cleaned = {}

    if isinstance(detalles_raw, dict):
        for k, v in detalles_raw.items():
            if isinstance(v, str) and (
                v.strip().startswith("[") or v.strip().startswith("{")
            ):
                try:
                    detalles_cleaned[k] = json.loads(v)
                except Exception:
                    detalles_cleaned[k] = v
            else:
                detalles_cleaned[k] = v
    else:
        detalles_cleaned = detalles_raw

    return {
        "id": data.get("id"),
        "tipo": data.get("tipo"),
        "nombre": data.get("nombre"),
        "mundo_id": data.get("mundo_id"),
        "relaciones": relaciones_cleaned,
        "detalles": detalles_cleaned,
    }


async def process_web_edit(data: dict):
    """Edita los hilos/mensajes en Discord, limpia avisos de sistema y actualiza GitHub"""
    global BOT_INSTANCE
    if not BOT_INSTANCE:
        return False, "Bot no inicializado"

    try:
        url_discord = data.get("url_discord", "")
        if not url_discord:
            return False, "Falta url_discord"

        parts = url_discord.strip("/").split("/")
        thread_id = (
            int(parts[-1])
            if parts and parts[-1].isdigit()
            else (
                int(parts[-2])
                if len(parts) > 1 and parts[-2].isdigit()
                else None
            )
        )

        if not thread_id:
            return False, "URL de Discord no válida"

        thread = await BOT_INSTANCE.fetch_channel(thread_id)
        if not thread:
            return False, "Hilo no encontrado en Discord"

        # 1. Editar el título del hilo SOLO SI ha cambiado de verdad
        nuevo_nombre = data.get("nombre", thread.name)[:100].strip()
        if thread.name.strip() != nuevo_nombre:
            await thread.edit(name=nuevo_nombre)

        # 2. Construir el YAML limpio
        yaml_payload = clean_yaml_payload(data)
        yaml_str = yaml.dump(
            yaml_payload,
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
        ).strip()
        lore_text = data.get("contenido_lore", "").strip()

        full_new_content = f"---\n{yaml_str}\n---\n\n{lore_text}".strip()

        # 3. Dividir si supera los 2000 caracteres
        chunks = split_content_smart(full_new_content, max_length=1850)

        # 4. Obtener mensajes existentes en el Hilo
        messages = []
        async for msg in thread.history(limit=100, oldest_first=True):
            # BORRAR MENSAJES DEL SISTEMA (Ej: "WikiK ha cambiado el nombre...")
            if msg.is_system():
                try:
                    await msg.delete()
                    await asyncio.sleep(0.2)
                except Exception:
                    pass
            else:
                messages.append(msg)

        if not messages:
            return False, "El hilo está vacío"

        first_msg = messages[0]

        # Si el primer mensaje fue escrito por un humano: Borrar y publicar como Bot
        if first_msg.author != BOT_INSTANCE.user:
            print(
                f"📝 Mensaje humano en '{thread.name}'. Reemplazando por mensaje del Bot...",
                flush=True,
            )
            for msg in messages:
                try:
                    await msg.delete()
                    await asyncio.sleep(0.3)
                except Exception:
                    pass

            for chunk in chunks:
                await thread.send(chunk)
                await asyncio.sleep(0.5)

        else:
            print(
                f"📝 Editando mensajes del Bot en '{thread.name}'...",
                flush=True,
            )
            for i, chunk in enumerate(chunks):
                if i < len(messages):
                    await messages[i].edit(content=chunk)
                    await asyncio.sleep(0.5)
                else:
                    await thread.send(chunk)
                    await asyncio.sleep(0.5)

            if len(messages) > len(chunks):
                for old_msg in messages[len(chunks) :]:
                    try:
                        await old_msg.delete()
                        await asyncio.sleep(0.3)
                    except Exception:
                        pass

        # 5. Sincronizar automáticamente con GitHub
        database, errors = await scan_guild_forums(thread.guild)
        await asyncio.to_thread(save_to_json, database, JSON_FILE)

        return True, "Ficha actualizada con éxito en Discord y GitHub"
    except Exception as e:
        print(f"❌ Error en process_web_edit: {e}", flush=True)
        return False, str(e)


class WikiRequestHandler(BaseHTTPRequestHandler):

    def _send_cors_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header(
            "Access-Control-Allow-Methods", "POST, GET, OPTIONS"
        )
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self._send_cors_headers(200)
        self.end_headers()

    def do_GET(self):
        self._send_cors_headers(200)
        self.end_headers()
        res = json.dumps(
            {"status": "ok", "bot": "WikiBot Discord Online"}
        ).encode("utf-8")
        self.wfile.write(res)

    def do_POST(self):
        if self.path == "/api/edit-item":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length)
                item_data = json.loads(body.decode("utf-8"))

                print(
                    f"📝 [API Web] Recibida actualización para: '{item_data.get('nombre')}' (ID: {item_data.get('id')})",
                    flush=True,
                )

                global BOT_INSTANCE
                if BOT_INSTANCE and BOT_INSTANCE.loop:
                    future = asyncio.run_coroutine_threadsafe(
                        process_web_edit(item_data), BOT_INSTANCE.loop
                    )
                    success, msg_result = future.result(timeout=30)
                else:
                    success, msg_result = False, "Bot no inicializado"

                if success:
                    response_data = json.dumps(
                        {"success": True, "message": msg_result}
                    ).encode("utf-8")
                    self._send_cors_headers(200)
                else:
                    response_data = json.dumps(
                        {"success": False, "error": msg_result}
                    ).encode("utf-8")
                    self._send_cors_headers(400)

                self.send_header("Content-Length", str(len(response_data)))
                self.end_headers()
                self.wfile.write(response_data)

            except Exception as e:
                print(f"❌ Error al procesar /api/edit-item: {e}", flush=True)
                err_data = json.dumps(
                    {"success": False, "error": str(e)}
                ).encode("utf-8")
                self._send_cors_headers(500)
                self.send_header("Content-Length", str(len(err_data)))
                self.end_headers()
                self.wfile.write(err_data)
        else:
            self._send_cors_headers(404)
            self.end_headers()
            self.wfile.write(
                json.dumps(
                    {"success": False, "error": "Ruta no encontrada"}
                ).encode("utf-8")
            )


def start_api_server(bot_instance):
    """Inicia el servidor HTTP de la API en segundo plano"""
    global BOT_INSTANCE
    BOT_INSTANCE = bot_instance

    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(("0.0.0.0", port), WikiRequestHandler)
    print(f"🌐 Servidor API del Bot escuchando en el puerto {port}", flush=True)

    threading.Thread(target=server.serve_forever, daemon=True).start()