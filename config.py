import os
from dotenv import load_dotenv

# Cargar variables del .env
load_dotenv()

TOKEN = os.getenv("DISCORD_TOKEN")
PREFIX = os.getenv("COMMAND_PREFIX", "!")
JSON_FILE = os.getenv("OUTPUT_JSON_FILE", "wiki_database.json")

# Lista modular de canales de foro objetivo
TARGET_FORUMS = [
    "foro-mundos",
    "foro-lugares",
    "foro-npcs",
    "foro-facciones",
    "foro-objetos",
    "foro-tramas",
]