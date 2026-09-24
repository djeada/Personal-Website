import re
import subprocess
from pathlib import Path
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, Optional

INPUT_DIR = Path("../src/")
OUTPUT_FILE = Path("../src/sitemap.xml")
DOMAIN = "https://adamdjellouli.com/"
EXCLUDE_PATTERN = re.compile(r"building_blocks|(^|/)google[0-9a-f]+\.html$")
SKIP_CONTENT_PATTERN = re.compile(
    r'http-equiv="refresh"|<meta[^>]+name="robots"[^>]+noindex', re.IGNORECASE
)
CANONICAL_PATTERN = re.compile(
    r'<link[^>]*rel="canonical"[^>]*href="([^"]+)"|<link[^>]*href="([^"]+)"[^>]*rel="canonical"'
)
ARTICLE_DATE_PATTERN = re.compile(
    r'<p style="text-align: right;"><i>Last modified: (.*?)</i></p>'
)


def git_dates() -> Dict[str, str]:
    """Maps each file under src/ to the date of the last commit touching it."""
    try:
        log = subprocess.run(
            ["git", "log", "--format=@%cs", "--name-only", "--", "."],
            cwd=INPUT_DIR,
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        root = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=INPUT_DIR,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (subprocess.CalledProcessError, OSError):
        return {}

    dates: Dict[str, str] = {}
    current = None
    for line in log.splitlines():
        if line.startswith("@"):
            current = line[1:]
        elif line and current:
            dates.setdefault(str(Path(root, line).resolve()), current)
    return dates


def get_last_modified_date(path: Path, content: str, dates: Dict[str, str]) -> str:
    """Article date from the page, otherwise the last commit, otherwise today."""
    match = ARTICLE_DATE_PATTERN.search(content)
    if match:
        try:
            parsed_date = datetime.strptime(match.group(1), "%B %d, %Y")
            return parsed_date.strftime("%Y-%m-%d")
        except ValueError:
            pass
    return dates.get(str(path.resolve()), datetime.now().strftime("%Y-%m-%d"))


def page_url(file_path: Path, content: str) -> str:
    canonical = CANONICAL_PATTERN.search(content)
    if canonical:
        href = canonical.group(1) or canonical.group(2)
        if href.startswith(DOMAIN):
            return href

    relative_path = file_path.relative_to(INPUT_DIR).as_posix().removesuffix(".html")
    if relative_path == "index":
        relative_path = ""
    elif relative_path.endswith("/index"):
        relative_path = relative_path[:-5]
    return f"{DOMAIN}{relative_path}"


def create_url_element(file_path: Path, dates: Dict[str, str]) -> Optional[ET.Element]:
    """Create a URL element for the sitemap."""
    if EXCLUDE_PATTERN.search(file_path.relative_to(INPUT_DIR).as_posix()):
        return None
    content = file_path.read_text(encoding="utf-8")
    if not content.strip() or SKIP_CONTENT_PATTERN.search(content):
        return None

    url = ET.Element("url")
    loc = ET.SubElement(url, "loc")
    loc.text = page_url(file_path, content)

    lastmod = ET.SubElement(url, "lastmod")
    lastmod.text = get_last_modified_date(file_path, content, dates)
    changefreq = ET.SubElement(url, "changefreq")
    changefreq.text = "monthly"
    priority = ET.SubElement(url, "priority")
    priority.text = "0.5"

    return url


def generate_sitemap(startpath: Path) -> None:
    """Generate a sitemap from a directory of HTML files."""
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    dates = git_dates()

    elements = [create_url_element(path, dates) for path in startpath.rglob("*.html")]
    seen = set()
    for element in sorted(
        (e for e in elements if e is not None), key=lambda e: e.find("loc").text
    ):
        loc = element.find("loc").text
        if loc not in seen:
            seen.add(loc)
            urlset.append(element)

    tree = ET.ElementTree(urlset)
    ET.indent(tree, space="\t", level=0)
    tree.write(OUTPUT_FILE, xml_declaration=True, encoding="utf-8", method="xml")
    print(f"Sitemap with {len(seen)} URLs saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    generate_sitemap(startpath=INPUT_DIR)
