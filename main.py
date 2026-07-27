import os
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
import discord
from discord.ext import commands
import config
from modules.exporter import save_to_json
from modules.scanner import scan_guild_forums


# Servidor web en segundo plano para activar el plan GRATIS ($0) de Render
def run_dummy_server():
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(("0.0.0.0", port), SimpleHTTPRequestHandler)
    server.serve_forever()


threading.Thread(target=run_dummy_server, daemon=True).start()

# Configuración del Bot
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix=config.PREFIX, intents=intents)


@bot.event
async def on_ready():
    print("--------------------------------------------------")
    print(f"🤖 Bot en la nube iniciado como: {bot.user}")
    print("--------------------------------------------------")


@bot.command(name="sync")
async def sync_wiki(ctx):
    status_msg = await ctx.send("🔄 Escaneando foros y subiendo a la nube...")

    database, errors = await scan_guild_forums(ctx.guild)
    success = save_to_json(database, config.JSON_FILE)

    if success:
        response = f"✅ **¡Wiki en la nube actualizada!**\nSe procesaron **{len(database)} elementos**."
    else:
        response = "❌ Hubo un error al actualizar GitHub."

    if errors:
        response += f"\n\n⚠️ **Avisos ({len(errors)}):**\n" + "\n".join(
            [f"- {e}" for e in errors[:5]]
        )

    await status_msg.edit(content=response)


if __name__ == "__main__":
    bot.run(config.TOKEN)