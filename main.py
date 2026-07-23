import discord
from discord.ext import commands
import config
from modules.exporter import save_to_json
from modules.scanner import scan_guild_forums

# Configuración de Intents de Discord
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True

bot = commands.Bot(command_prefix=config.PREFIX, intents=intents)


@bot.event
async def on_ready():
    print("--------------------------------------------------")
    print(f"🤖 Bot iniciado exitosamente como: {bot.user}")
    print(f"Escribe '{config.PREFIX}sync' para sincronizar la Wiki.")
    print("--------------------------------------------------")


@bot.command(name="sync")
async def sync_wiki(ctx):
    """Comando para ejecutar el escaneo y guardar la Wiki"""
    status_msg = await ctx.send("🔄 Escaneando foros de Discord...")

    # 1. Escanear
    database, errors = await scan_guild_forums(ctx.guild)

    # 2. Exportar
    success = save_to_json(database, config.JSON_FILE)

    # 3. Informar
    if success:
        response = f"✅ **¡Wiki sincronizada con éxito!**\nSe han procesado **{len(database)} elementos** en `{config.JSON_FILE}`."
    else:
        response = "❌ Hubo un error al guardar la base de datos local."

    if errors:
        response += f"\n\n⚠️ **Avisos ({len(errores)}):**\n" + "\n".join(
            [f"- {e}" for e in errors[:5]]
        )

    await status_msg.edit(content=response)


if __name__ == "__main__":
    if not config.TOKEN:
        print(
            "❌ ERROR: No se encontró el DISCORD_TOKEN en el archivo .env"
        )
    else:
        bot.run(config.TOKEN)