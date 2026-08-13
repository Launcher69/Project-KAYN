import re
import yaml


def repair_yaml_string(yaml_str: str) -> str:
    """Sana y arregla desajustes de sangría en listas de relaciones pegadas al borde"""
    lines = yaml_str.split("\n")
    repaired = []
    in_unindented_list = False

    for line in lines:
        # Detecta un guión '-' pegado al margen izquierdo (ej: "- id_destino:")
        if re.match(r"^-\s+[a-zA-Z0-9_]+:", line):
            repaired.append("  " + line)
            in_unindented_list = True
        # Si la línea siguiente tiene 2 espacios (ej: "  relacion:"), la alinea a 4 espacios
        elif in_unindented_list and re.match(r"^\s{2}[a-zA-Z0-9_]+:", line):
            repaired.append("  " + line)
        else:
            if (
                line.strip()
                and not line.startswith(" ")
                and not line.startswith("\t")
            ):
                in_unindented_list = False
            repaired.append(line)

    return "\n".join(repaired)


def extract_yaml_from_markdown(content: str):
    """Extrae la cabecera YAML respetando el YAML válido y reparando sangrías desalineadas"""
    patron = r"^---\s*\n(.*?)\n---\s*\n?(.*)$"
    coincidencia = re.search(patron, content, re.DOTALL | re.MULTILINE)

    if coincidencia:
        yaml_str = coincidencia.group(1)
        resto_markdown = coincidencia.group(2)

        # 1. INTENTO 1: Leer el YAML tal cual (si ya era válido)
        try:
            datos_yaml = yaml.safe_load(yaml_str)
            if isinstance(datos_yaml, dict):
                return datos_yaml, resto_markdown.strip()
        except Exception:
            pass

        # 2. INTENTO 2: Reparar desajustes de sangría en relaciones
        try:
            yaml_reparado = repair_yaml_string(yaml_str)
            datos_yaml = yaml.safe_load(yaml_reparado)
            if isinstance(datos_yaml, dict):
                return datos_yaml, resto_markdown.strip()
        except Exception:
            pass

    return None, content.strip()