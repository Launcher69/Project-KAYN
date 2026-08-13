import re
import yaml


def extract_yaml_from_markdown(content: str):
    """Extrae la cabecera YAML respetando el YAML válido y reparando solo si hay fallos"""
    patron = r"^---\s*\n(.*?)\n---\s*\n?(.*)$"
    coincidencia = re.search(patron, content, re.DOTALL | re.MULTILINE)

    if coincidencia:
        yaml_str = coincidencia.group(1)
        resto_markdown = coincidencia.group(2)

        # 1. PRIMER INTENTO: Leer el YAML tal cual (para no tocar nada si ya es válido)
        try:
            datos_yaml = yaml.safe_load(yaml_str)
            if isinstance(datos_yaml, dict):
                return datos_yaml, resto_markdown.strip()
        except Exception:
            pass

        # 2. SEGUNDO INTENTO: Si falló, reparar únicamente los guiones '-' pegados al margen
        try:
            # Añade 2 espacios solo a las líneas que empiezan por '-' al inicio de línea
            yaml_reparado = re.sub(
                r"^-(\s*[a-zA-Z0-9_]+:)", r"  -\1", yaml_str, flags=re.M
            )
            datos_yaml = yaml.safe_load(yaml_reparado)
            if isinstance(datos_yaml, dict):
                return datos_yaml, resto_markdown.strip()
        except Exception:
            pass

    return None, content.strip()