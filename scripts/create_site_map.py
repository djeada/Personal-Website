import os
import re
from pathlib import Path
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional

INPUT_DIR = Path("../src/")
OUTPUT_FILE = Path("../src/sitemap.xml")
EXCLUDE_PATTERN = re.compile(r"building_blocks")

def get_last_modified_date(path: Path) -> Optional[str]:
    """Get the last modified date of a file."""
    try:
        with path.open("r", encoding="utf-8") as file:
            content = file.read()

        # Look for the line containing the last modified date
        match = re.search(
            r'<p style="text-align: right;"><i>Last modified: (.*?)</i></p>', content
        )
        if match:
            # Extract the date
            date_str = match.group(1)
            # Parse the date string and reformat it
            parsed_date = datetime.strptime(date_str, "%B %d, %Y")
            return parsed_date.strftime("%Y-%m-%d")
    except FileNotFoundError:
        print(f"File not found: {path}")
    except IOError as e:
        print(f"IO error reading file {path}: {e}")
    except re.error as e:
        print(f"Regex error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")

    # If no date found, return the current modification time of the file in "%Y-%m-%d" format
    timestamp = path.stat().st_mtime
    return datetime.utcfromtimestamp(timestamp).strftime("%Y-%m-%d")


def create_url_element(file_path: Path, domain: str) -> Optional[ET.Element]:
    """Create a URL element for the sitemap."""
    relative_path = (
        str(file_path.relative_to(INPUT_DIR))
        .replace(os.path.sep, "/")
        .replace(".html", "")
    )
    if EXCLUDE_PATTERN.search(relative_path):
        return None

    # Handle index.html specifically by removing "index" from the URL
    if relative_path.endswith("/index"):
        relative_path = relative_path[:-6]  # Remove the "/index" part

    url = ET.Element("url")
    loc = ET.SubElement(url, "loc")
    loc.text = f"{domain}{relative_path}"

    # Optional: Add lastmod, changefreq, priority
    lastmod = ET.SubElement(url, "lastmod")
    lastmod.text = get_last_modified_date(file_path)
    changefreq = ET.SubElement(url, "changefreq")
    changefreq.text = "monthly"  # Change as needed
    priority = ET.SubElement(url, "priority")
    priority.text = "0.5"  # Change as needed

    return url


def generate_sitemap(startpath: Path, domain: str) -> None:
    """Generate a sitemap from a directory of HTML files."""
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")

    for file_path in startpath.rglob("*.html"):
        url_element = create_url_element(file_path, domain)
        if url_element is not None:
            urlset.append(url_element)

    # Properly format the XML output with new lines and tabs
    tree = ET.ElementTree(urlset)
    ET.indent(tree, space="\t", level=0)
    try:
        tree.write(OUTPUT_FILE, xml_declaration=True, encoding="utf-8", method="xml")
        print(f"Sitemap generated successfully and saved to {OUTPUT_FILE}")
    except IOError as e:
        print(f"Error writing sitemap to file: {e}")


if __name__ == "__main__":
    generate_sitemap(startpath=INPUT_DIR, domain="https://adamdjellouli.com/")
