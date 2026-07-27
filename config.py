import os
from dotenv import load_dotenv

load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
PREFIX = os.getenv("COMMAND_PREFIX", "!")
JSON_FILE = os.getenv("OUTPUT_JSON_FILE", "web/wiki_database.json")
IMGBB_API_KEY = os.getenv("IMGBB_API_KEY")

# Datos para la API de GitHub
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv(
    "GITHUB_REPO"
)  # Ejemplo: "tu-usuario/nombre-de-tu-repo"

TARGET_FORUMS = [
    "foro-mundos",
    "foro-lugares",
    "foro-npcs",
    "foro-facciones",
    "foro-objetos",
    "foro-tramas",
]