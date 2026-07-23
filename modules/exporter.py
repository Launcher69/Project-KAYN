import json


def save_to_json(data: list, filepath: str) -> bool:
    """Guarda la lista de elementos procesados en un archivo JSON local"""
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        print(f"❌ Error al guardar en {filepath}: {e}")
        return False