import asyncio
import os
import discord
from discord.ext import commands
import config
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from modules.exporter import save_to_json
from modules.scanner import scan_guild_forums
from modules.web_api import start_api_server
from modules.world_generator import process_world_generation

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True



class WikiRequestHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        # Maneja la verificación preflight del navegador (CORS)
        self._set_headers(200)

    def do_POST(self):
        if self.path == "/api/edit-item":
            try:
                content_length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(content_length)
                data = json.loads(body.decode("utf-8"))

                print(f"📥 Petición de edición recibida para: {data.get('nombre')}", flush=True)

                # TODO: Aquí puedes llamar a tu función save_to_json o actualizar GitHub
                # Ejemplo: save_to_json(data, config.JSON_FILE)

                self._set_headers(200)
                res = {"success": True, "message": "Ficha actualizada con éxito"}
                self.wfile.write(json.dumps(res).encode("utf-8"))
            except Exception as e:
                print(f"❌ Error al procesar edit-item: {e}", flush=True)
                self._set_headers(500)
                res = {"success": False, "error": str(e)}
                self.wfile.write(json.dumps(res).encode("utf-8"))
        else:
            self._set_headers(404)
            res = {"success": False, "error": "Endpoint no encontrado"}
            self.wfile.write(json.dumps(res).encode("utf-8"))

def run_dummy_server():
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(("0.0.0.0", port), WikiRequestHandler)
    print(f"🌐 Servidor API de la Wiki escuchando en el puerto {port}", flush=True)
    server.serve_forever()


bot = commands.Bot(command_prefix=config.PREFIX, intents=intents)


@bot.event
async def on_ready():
    print("--------------------------------------------------", flush=True)
    print(f"🤖 Bot en la nube iniciado como: {bot.user}", flush=True)
    print("--------------------------------------------------", flush=True)
    # Iniciar la API Web en segundo plano
    await start_api_server(bot)


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


if __name__ == "__main__":
    bot.run(config.TOKEN)