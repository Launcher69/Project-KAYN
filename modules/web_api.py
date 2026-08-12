import asyncio
import re
import yaml
from aiohttp import web
from config import JSON_FILE
from modules.exporter import save_to_json
from modules.scanner import scan_guild_forums
from modules.world_generator import split_content_smart


def make_cors_response(data_dict, status=200):
    """Genera una respuesta JSON con cabeceras CORS para evitar bloqueos en el navegador"""
    return web.json_response(
        data_dict,
        status=status,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    )


async def handle_options(request):
    """Maneja las peticiones OPTIONS preflight de los navegadores"""
    return make_cors_response({}, status=200)


async def handle_edit_item(request, bot):
    """Procesa las solicitudes de edición enviadas desde la Web"""
    try:
        data = await request.json()

        url_discord = data.get("url_discord", "")
        if not url_discord:
            return make_cors_response(
                {"success": False, "error": "No se proporcionó url_discord"},
                status=400,
            )

        # Extraer el ID del Hilo de la URL de Discord
        parts = url_discord.strip("/").split("/")
        thread_id = int(parts[-1]) if parts and parts[-1].isdigit() else None

        if not thread_id:
            return make_cors_response(
                {"success": False, "error": "URL de Discord no válida"},
                status=400,
            )

        thread = await bot.fetch_channel(thread_id)
        if not thread:
            return make_cors_response(
                {"success": False, "error": "Hilo no encontrado en Discord"},
                status=404,
            )

        # 1. Cambiar el nombre del Hilo en el Foro si cambió
        nuevo_nombre = data.get("nombre", thread.name)[:100]
        if thread.name != nuevo_nombre:
            await thread.edit(name=nuevo_nombre)

        # 2. Construir el nuevo contenido YAML + Markdown
        yaml_payload = {
            "id": data.get("id"),
            "tipo": data.get("tipo"),
            "nombre": data.get("nombre"),
            "mundo_id": data.get("mundo_id"),
            "relaciones": data.get("relaciones", []),
            "detalles": data.get("detalles", {}),
        }
        yaml_str = yaml.dump(
            yaml_payload, allow_unicode=True, sort_keys=False
        ).strip()
        lore_text = data.get("contenido_lore", "").strip()

        full_new_content = f"---\n{yaml_str}\n---\n\n{lore_text}".strip()

        # 3. Dividir inteligentemente si supera los 2.000 caracteres
        chunks = split_content_smart(full_new_content, max_length=1850)

        # 4. Obtener mensajes existentes en el Hilo
        messages = []
        async for msg in thread.history(limit=100, oldest_first=True):
            messages.append(msg)

        if not messages:
            return make_cors_response(
                {"success": False, "error": "El hilo está vacío"}, status=400
            )

        first_msg = messages[0]

        # LÓGICA INTELIGENTE AUTOR: ¿Fue escrito por un humano o por el bot?
        if first_msg.author != bot.user:
            print(
                f"📝 Mensaje humano detectado en '{thread.name}'. Reemplazando con mensaje del bot...",
                flush=True,
            )
            # A) Si fue escrito por un humano: Borrar mensajes antiguos y publicar como el Bot
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
                f"📝 Editando mensajes creados por el Bot en '{thread.name}'...",
                flush=True,
            )
            # B) Si fue escrito por el Bot: Editar los mensajes existentes
            for i, chunk in enumerate(chunks):
                if i < len(messages):
                    await messages[i].edit(content=chunk)
                    await asyncio.sleep(0.5)
                else:
                    # Si el nuevo texto requiere un mensaje extra que no existía antes
                    await thread.send(chunk)
                    await asyncio.sleep(0.5)

            # Si el texto editado es más corto y sobraron mensajes viejos del bot, borrarlos
            if len(messages) > len(chunks):
                for old_msg in messages[len(chunks) :]:
                    try:
                        await old_msg.delete()
                        await asyncio.sleep(0.3)
                    except Exception:
                        pass

        # 5. Sincronizar automáticamente con GitHub / Web
        database, errors = await scan_guild_forums(thread.guild)
        await asyncio.to_thread(save_to_json, database, JSON_FILE)

        return make_cors_response(
            {
                "success": True,
                "message": "Ficha actualizada con éxito en Discord y GitHub",
            }
        )

    except Exception as e:
        print(f"❌ Error procesando edición desde la Web: {e}", flush=True)
        return make_cors_response(
            {"success": False, "error": str(e)}, status=500
        )


async def start_api_server(bot):
    """Inicia el servidor HTTP de la API para recibir órdenes de la Web"""
    app = web.Application()

    app.router.add_options("/api/edit-item", handle_options)
    app.router.add_post(
        "/api/edit-item", lambda req: handle_edit_item(req, bot)
    )

    port = int(os.environ.get("PORT", 10000))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    await site.start()
    print(
        f"🌐 Servidor API Web/Discord iniciado en puerto {port}", flush=True
    )