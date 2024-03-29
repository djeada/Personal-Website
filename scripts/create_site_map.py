import os
from pathlib import Path
import xml.etree.ElementTree as ET
from datetime import datetime

INPUT_DIR = Path("../src/")
OUTPUT_FILE = Path("../src/sitemap.xml")


def get_last_modified_date(path: Path) -> str:
    """Get the last modified date of a file."""
    timestamp = path.stat().st_mtime
    return datetime.utcfromtimestamp(timestamp).strftime("%Y-%m-%d")


def generate_sitemap(startpath: Path, domain: str) -> None:
    """Generate a sitemap from a directory of HTML files."""
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")

    for file_path in startpath.rglob("*.html"):
        url = ET.SubElement(urlset, "url")
        loc = ET.SubElement(url, "loc")
        loc.text = domain + str(file_path.relative_to(startpath)).replace(
            os.path.sep, "/"
        )

        # Optional: Add lastmod, changefreq, priority
        lastmod = ET.SubElement(url, "lastmod")
        lastmod.text = get_last_modified_date(file_path)
        changefreq = ET.SubElement(url, "changefreq")
        changefreq.text = "monthly"  # Change as needed
        priority = ET.SubElement(url, "priority")
        priority.text = "0.5"  # Change as needed

    tree = ET.ElementTree(urlset)
    tree.write(OUTPUT_FILE, xml_declaration=True, encoding="utf-8", method="xml")


if __name__ == "__main__":
    generate_sitemap(startpath=INPUT_DIR, domain="https://adamdjellouli.com/")
