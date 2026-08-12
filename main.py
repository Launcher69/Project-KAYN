import asyncio
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
import discord
from discord.ext import commands
import yaml

import config
from modules.exporter import save_to_json
from modules.scanner import scan_guild_forums
from modules.world_generator import process_world_generation, split_content_smart

# Configuración del Bot de Discord
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix=config.PREFIX, intents=intents)


# --- LÓGICA REAL DE EDICIÓN EN DISCORD Y GITHUB ---
async def process_web_edit(data, bot_instance):
    """Edita los hilos/mensajes en Discord y actualiza GitHub"""
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

        thread = await bot_instance.fetch_channel(thread_id)
        if not thread:
            return False, "Hilo no encontrado en Discord"

        # 1. Editar el título del hilo si cambió
        nuevo_nombre = data.get("nombre", thread.name)[:100]
        if thread.name != nuevo_nombre:
            await thread.edit(name=nuevo_nombre)

        # 2. Reconstruir el nuevo YAML + Lore
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

        # 3. Dividir si supera los 2000 caracteres
        chunks = split_content_smart(full_new_content, max_length=1850)

        # 4. Obtener mensajes del Hilo
        messages = []
        async for msg in thread.history(limit=100, oldest_first=True):
            messages.append(msg)

        if not messages:
            return False, "El hilo está vacío"

        first_msg = messages[0]

        # Si el primer mensaje fue escrito por un humano: Borrar y publicar como Bot
        if first_msg.author != bot_instance.user:
            print(
                f"📝 Mensaje humano detectado en '{thread.name}'. Reemplazando por mensaje del Bot...",
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
            # Si fue escrito por el Bot: Editar mensajes
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
        await asyncio.to_thread(save_to_json, database, config.JSON_FILE)

        return True, "Ficha actualizada con éxito en Discord y GitHub"
    except Exception as e:
        print(f"❌ Error en process_web_edit: {e}", flush=True)
        return False, str(e)


# --- SERVIDOR API HTTP ---
class WikiRequestHandler(BaseHTTPRequestHandler):

    def _send_cors_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        """Maneja las peticiones de verificación CORS preflight."""
        self._send_cors_headers(200)
        self.end_headers()

    def do_GET(self):
        """Endpoint de salud para Render."""
        self._send_cors_headers(200)
        self.end_headers()
        res = json.dumps(
            {"status": "ok", "bot": "WikiBot Discord Online"}
        ).encode("utf-8")
        self.wfile.write(res)

    def do_POST(self):
        """Procesa las peticiones POST enviadas desde la Web"""
        if self.path == "/api/edit-item":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length)
                item_data = json.loads(body.decode("utf-8"))

                print(
                    f"📝 [API Web] Recibida actualización para: '{item_data.get('nombre')}' (ID: {item_data.get('id')})",
                    flush=True,
                )

                # Ejecutar la edición asíncrona en el hilo del bot de forma segura
                future = asyncio.run_coroutine_threadsafe(
                    process_web_edit(item_data, bot), bot.loop
                )
                success, msg_result = future.result(
                    timeout=30
                )  # Espera la ejecución real

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
                err_data = json.dumps({"success": False, "error": str(e)}).encode(
                    "utf-8"
                )
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


def run_api_server():
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(("0.0.0.0", port), WikiRequestHandler)
    print(f"🌐 Servidor API del Bot escuchando en el puerto {port}", flush=True)
    server.serve_forever()


threading.Thread(target=run_api_server, daemon=True).start()


@bot.event
async def on_ready():
    print("--------------------------------------------------", flush=True)
    print(f"🤖 Bot en la nube iniciado como: {bot.user}", flush=True)
    print("--------------------------------------------------", flush=True)


@bot.command(name="generar_mundo", aliases=["crear_mundo", "auto_foro"])
async def generar_mundo_cmd(ctx):
    await process_world_generation(ctx)
    await sync_wiki(ctx)


@bot.command(
    name="borrar_categoria",
    aliases=["eliminar_categoria", "borrar_mundo", "eliminar_mundo"],
)
@commands.has_permissions(administrator=True)
async def borrar_categoria_cmd(ctx):
    category = ctx.channel.category
    if not category:
        await ctx.send(
            "❌ Este comando debe ejecutarse dentro de un canal perteneciente a una Categoría."
        )
        return

    canales_count = len(category.channels)
    cat_name = category.name

    await ctx.send(
        f"⚠️ **¡ATENCIÓN!** Vas a eliminar la categoría **'{cat_name}'** con todos sus **{canales_count} canales y publicaciones**.\n\n"
        f"⚠️ *Esta acción NO se puede deshacer.* Responde a este mensaje escribiendo **CONFIRMAR** en los próximos 30 segundos para proceder."
    )

    def check(m):
        return (
            m.author == ctx.author
            and m.channel == ctx.channel
            and m.content.strip().upper() == "CONFIRMAR"
        )

    try:
        await bot.wait_for("message", check=check, timeout=30.0)
    except asyncio.TimeoutError:
        await ctx.send(
            "❌ **Operación cancelada.** Tiempo de espera agotado sin confirmación."
        )
        return

    channels_to_delete = list(category.channels)
    for channel in channels_to_delete:
        if channel != ctx.channel:
            try:
                await channel.delete()
                await asyncio.sleep(0.5)
            except Exception:
                pass

    try:
        await ctx.channel.delete()
        await category.delete()
        print(f"🗑️ Categoría '{cat_name}' eliminada con éxito.", flush=True)
    except Exception:
        pass

    await sync_wiki(ctx)


@bot.command(name="sync")
async def sync_wiki(ctx):
    status_msg = None
    try:
        status_msg = await ctx.send(
            "🔄 Escaneando foros y procesando imágenes en la nube..."
        )
    except discord.NotFound:
        pass

    database, errors = await scan_guild_forums(ctx.guild)
    success = await asyncio.to_thread(save_to_json, database, config.JSON_FILE)

    if status_msg:
        try:
            if success:
                response = f"✅ **¡Wiki en la nube actualizada!**\nSe procesaron **{len(database)} elementos**."
            else:
                response = "❌ Hubo un error al actualizar GitHub."

            if errors:
                response += f"\n\n⚠️ **Avisos ({len(errors)}):**\n" + "\n".join(
                    [f"- {e}" for e in errors[:5]]
                )

            await status_msg.edit(content=response)
        except discord.NotFound:
            pass


if __name__ == "__main__":
    bot.run(config.TOKEN)