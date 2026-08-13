import re
import yaml


def fix_unindented_yaml_lists(yaml_str: str) -> str:
    """Añade automáticamente 2 espacios de sangría a las listas que estén pegadas al margen izquierdo"""
    lines = yaml_str.split("\n")
    fixed_lines = []
    inside_key_with_list = False

    for line in lines:
        # Detecta claves que esperan listas (ej: "relaciones:")
        if re.match(r"^[a-zA-Z0-9_]+:\s*$", line):
            inside_key_with_list = True
            fixed_lines.append(line)
            continue

        # Si estamos dentro de una lista y la línea empieza por "-" pegada al borde, le añade 2 espacios
        if inside_key_with_list and line.startswith("-"):
            fixed_lines.append(f"  {line}")
        else:
            if line.strip() and not line.startswith(" ") and not line.startswith("\t"):
                inside_key_with_list = False
            fixed_lines.append(line)

    return "\n".join(fixed_lines)


def extract_yaml_from_markdown(content: str):
    """Extrae la cabecera YAML reparando automáticamente fallos de sangría"""
    patron = r"^---\s*\n(.*?)\n---\s*\n?(.*)$"
    coincidencia = re.search(patron, content, re.DOTALL | re.MULTILINE)

    if coincidencia:
        yaml_str = coincidencia.group(1)
        resto_markdown = coincidencia.group(2)

        # Repara automáticamente si los guiones de relaciones: están pegados al margen
        yaml_str_reparado = fix_unindented_yaml_lists(yaml_str)

        try:
            datos_yaml = yaml.safe_load(yaml_str_reparado)
            if isinstance(datos_yaml, dict):
                return datos_yaml, resto_markdown.strip()
        except yaml.YAMLError as e:
            print(f"⚠️ Error al procesar YAML: {e}", flush=True)

    return None, content.strip()