"""
Strips comments from .py, .css, and .js files in the project.
"""

import re
import logging
from pathlib import Path
from typing import List

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

PROJECT_ROOT = Path(__file__).parent.parent
SRC_DIR = PROJECT_ROOT / "src"
SCRIPTS_DIR = PROJECT_ROOT / "scripts"


def strip_python_comments(content: str) -> str:
    """
    Strips comments from Python code while preserving strings and docstrings.
    """
    lines = content.split("\n")
    result = []
    in_multiline_string = None

    for line in lines:
        stripped_line = line.rstrip()

        if not stripped_line:
            result.append("")
            continue

        quote_count_single = 0
        quote_count_double = 0
        i = 0
        cleaned_line = ""
        in_string = False
        string_delimiter = None

        while i < len(stripped_line):
            char = stripped_line[i]

            if in_multiline_string:
                cleaned_line += char
                if i + 2 <= len(stripped_line) and stripped_line[i:i+3] == in_multiline_string:
                    cleaned_line += stripped_line[i+1:i+3]
                    in_multiline_string = None
                    i += 3
                    continue
                i += 1
                continue

            if i + 2 <= len(stripped_line) and stripped_line[i:i+3] in ('"""', "'''"):
                in_multiline_string = stripped_line[i:i+3]
                cleaned_line += in_multiline_string
                i += 3
                continue

            if not in_string:
                if char in ('"', "'"):
                    in_string = True
                    string_delimiter = char
                    cleaned_line += char
                    i += 1
                    continue
                elif char == "#":
                    break
            else:
                if char == string_delimiter and (i == 0 or stripped_line[i-1] != "\\"):
                    in_string = False
                    string_delimiter = None
                cleaned_line += char
                i += 1
                continue

            cleaned_line += char
            i += 1

        if in_multiline_string:
            result.append(cleaned_line)
        else:
            result.append(cleaned_line.rstrip())

    return "\n".join(result)


def strip_css_comments(content: str) -> str:
    """
    Strips comments from CSS code while preserving strings.
    """
    result = []
    i = 0
    length = len(content)
    
    while i < length:
        if i + 1 < length and content[i:i+2] == '/*':
            i += 2
            while i + 1 <= length and content[i:i+2] != '*/':
                i += 1
            if i + 1 <= length:
                i += 2
            continue
        
        if content[i] in ('"', "'"):
            delimiter = content[i]
            result.append(content[i])
            i += 1
            while i < length:
                if content[i] == '\\' and i + 1 < length:
                    result.append(content[i])
                    result.append(content[i + 1])
                    i += 2
                    continue
                result.append(content[i])
                if content[i] == delimiter:
                    i += 1
                    break
                i += 1
            continue
        
        result.append(content[i])
        i += 1
    
    return ''.join(result)


def strip_js_comments(content: str) -> str:
    """
    Strips comments from JavaScript code while preserving strings and regex.
    """
    result = []
    i = 0
    length = len(content)

    while i < length:
        if i + 1 < length and content[i:i+2] == '//':
            while i < length and content[i] != '\n':
                i += 1
            if i < length:
                result.append('\n')
                i += 1
            continue

        if i + 1 < length and content[i:i+2] == '/*':
            i += 2
            while i + 1 <= length and content[i:i+2] != '*/':
                i += 1
            if i + 1 <= length:
                i += 2
            continue

        if content[i] in ('"', "'"):
            delimiter = content[i]
            result.append(content[i])
            i += 1
            while i < length:
                if content[i] == '\\' and i + 1 < length:
                    result.append(content[i])
                    result.append(content[i + 1])
                    i += 2
                    continue
                result.append(content[i])
                if content[i] == delimiter:
                    i += 1
                    break
                i += 1
            continue

        if content[i] == '`':
            result.append(content[i])
            i += 1
            while i < length:
                if content[i] == '\\' and i + 1 < length:
                    result.append(content[i])
                    result.append(content[i + 1])
                    i += 2
                    continue
                result.append(content[i])
                if content[i] == '`':
                    i += 1
                    break
                i += 1
            continue

        result.append(content[i])
        i += 1

    return ''.join(result)


def find_files(directory: Path, extension: str) -> List[Path]:
    """
    Finds all files with the given extension in the directory recursively.
    """
    return list(directory.rglob(f"*{extension}"))


def process_file(file_path: Path) -> None:
    """
    Strips comments from a single file based on its extension.
    """
    try:
        content = file_path.read_text(encoding='utf-8')

        if file_path.suffix == '.py':
            processed_content = strip_python_comments(content)
        elif file_path.suffix == '.css':
            processed_content = strip_css_comments(content)
        elif file_path.suffix == '.js':
            processed_content = strip_js_comments(content)
        else:
            logging.warning(f"Unsupported file type: {file_path}")
            return

        file_path.write_text(processed_content, encoding='utf-8')
        logging.info(f"Processed: {file_path}")
    except Exception as e:
        logging.error(f"Error processing {file_path}: {e}")


def main():
    """
    Main function to strip comments from all .py, .css, and .js files.
    """
    logging.info("Starting comment stripping process...")

    extensions = ['.py', '.css', '.js']
    directories = [SRC_DIR, SCRIPTS_DIR]

    total_files = 0
    for directory in directories:
        if not directory.exists():
            logging.warning(f"Directory does not exist: {directory}")
            continue

        for extension in extensions:
            files = find_files(directory, extension)
            logging.info(f"Found {len(files)} {extension} files in {directory}")

            for file_path in files:
                process_file(file_path)
                total_files += 1

    logging.info(f"Comment stripping completed. Processed {total_files} files.")


if __name__ == "__main__":
    main()
