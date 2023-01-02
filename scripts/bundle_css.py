"""
Bundles many CSS files into one.
"""

from typing import List
from pathlib import Path

ASSETS_DIR = Path("../src/resources/assets")
OUTPUT_FILE = Path("../src/resources/style.css")


def gather_css(paths: List[Path]) -> str:
    """
    Gathers all CSS files from the given paths and returns them as a single string.
    """
    css = ""
    for path in paths:
        css += path.read_text() + "\n"
    return css


def find_css_files() -> List[Path]:
    """
    Finds all CSS files in the assets directory.
    """
    return sorted(list(ASSETS_DIR.glob("**/*.css")))


def bundle_css(css: str, output_file: Path) -> None:
    """
    Writes the given CSS to the given output file.
    """
    output_file.write_text(css)


def main():
    """
    Bundles all CSS files into one.
    """
    css_files = find_css_files()
    css = gather_css(css_files)
    bundle_css(css, OUTPUT_FILE)


if __name__ == "__main__":
    main()
