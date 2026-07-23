import re
import yaml


def extract_yaml_from_markdown(content: str):
    """Extrae la cabecera YAML entre '---' y devuelve (datos_dict, resto_markdown)"""
    pattern = r"^---\s*\n(.*?)\n---\s*\n?(.*)$"
    match = re.search(pattern, content, re.DOTALL | re.MULTILINE)

    if match:
        yaml_str = match.group(1)
        body_markdown = match.group(2)
        try:
            yaml_data = yaml.safe_load(yaml_str)
            if isinstance(yaml_data, dict):
                return yaml_data, body_markdown.strip()
        except yaml.YAMLError as e:
            print(f"⚠️ Error parsing YAML: {e}")

    return None, content.strip()