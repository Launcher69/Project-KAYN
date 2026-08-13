import re
import yaml


def repair_yaml_string(yaml_str: str) -> str:
    """Sana y arregla desajustes de sangría en listas de relaciones pegadas al borde"""
    lines = yaml_str.split("\n")
    repaired = []
    in_unindented_list = False

    for line in lines:
        if re.match(r"^-\s+[a-zA-Z0-9_]+:", line):
            repaired.append("  " + line)
            in_unindented_list = True
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
    """Extrae la cabecera YAML de forma ultra-permisiva (soporta espacios previos, salto de línea Windows y ```yaml)"""
    if not content:
        return None, ""

    # Normalizar saltos de línea de Windows (\r\n -> \n)
    content_clean = content.replace("\r\n", "\n").replace("\r", "\n").strip()

    # 1. CASO A: Si el YAML está dentro de un bloque de código markdown ```yaml ... ```
    codeblock_match = re.search(
        r"```(?:yaml)?\s*\n(.*?)\n```", content_clean, re.DOTALL | re.IGNORECASE
    )
    if codeblock_match:
        yaml_candidate = codeblock_match.group(1).strip()
        yaml_candidate = re.sub(
            r"^---\s*", "", yaml_candidate, flags=re.M
        ).strip()
        yaml_candidate = re.sub(
            r"---\s*$", "", yaml_candidate, flags=re.M
        ).strip()
        try:
            data = yaml.safe_load(yaml_candidate)
            if isinstance(data, dict) and "id" in data:
                resto = re.sub(
                    r"```(?:yaml)?\s*\n.*?\n```",
                    "",
                    content_clean,
                    flags=re.DOTALL | re.IGNORECASE,
                ).strip()
                return data, resto
        except Exception:
            pass

    # 2. CASO B: Buscar bloque delimitado por --- y --- en CUALQUIER parte del mensaje
    pattern = r"---\s*\n(.*?)\n---\s*\n?(.*)$"
    match = re.search(pattern, content_clean, re.DOTALL)

    if match:
        yaml_str = match.group(1).strip()
        resto_markdown = match.group(2).strip()

        # Intento 1: Leer el YAML directamente
        try:
            data = yaml.safe_load(yaml_str)
            if isinstance(data, dict) and "id" in data:
                return data, resto_markdown
        except Exception:
            pass

        # Intento 2: Reparar sangrías
        try:
            repaired_yaml = repair_yaml_string(yaml_str)
            data = yaml.safe_load(repaired_yaml)
            if isinstance(data, dict) and "id" in data:
                return data, resto_markdown
        except Exception:
            pass

    return None, content_clean.strip()