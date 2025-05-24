import json
import logging
import tempfile
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from time import sleep
from typing import Any, Dict, List, Optional, Tuple, Set
from urllib.parse import urlparse, unquote

import markdown
import requests

# Configuration
URLS_INFO: List[Dict[str, str]] = [
    {"url": "https://raw.githubusercontent.com/djeada/Frontend-Notes/main/notes/12_quizes.md", "category": "Web Development"},
    {"url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/probability.md", "category": "Statistics"},
    {"url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/correlation_and_regression.md", "category": "Statistics"},
    {"url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/descriptive_statistics.md", "category": "Statistics"},
    {"url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/statistical_inference.md", "category": "Statistics"},
    {"url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/time_series_analysis.md", "category": "Statistics"},
]
OUTPUT_DIR: Path = Path("../src/tools/flash_cards")
CATEGORIES_FILE: Path = OUTPUT_DIR / "categories.json"
RETRY_LIMIT: int = 3
TIMEOUT: int = 10
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger(__name__)

# Regex patterns
FLASHCARD_PATTERN = re.compile(r"<details>\s*<summary>(.*?)</summary><br>\s*(.*?)\s*</details>", re.DOTALL)
HEADER_PATTERN = re.compile(r"^(#{2,6})\s*(.+)$", re.MULTILINE)

# Utilities
def atomic_write_json(data: Any, path: Path) -> None:
    """Atomically write JSON to the given path with stable formatting."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile('w', delete=False, dir=path.parent, suffix='.tmp', encoding='utf-8') as tmp:
        json.dump(data, tmp, indent=4, sort_keys=True, ensure_ascii=False)
        temp_path = Path(tmp.name)
    temp_path.replace(path)
    logger.info(f"Wrote JSON to {path}")


def retry_get(url: str, retries: int = RETRY_LIMIT) -> Optional[str]:
    """Download content with exponential backoff up to retries."""
    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Fetching {url} (attempt {attempt})")
            resp = requests.get(url, timeout=TIMEOUT)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            logger.warning(f"Attempt {attempt} failed: {e}")
            sleep(2 ** (attempt - 1))
    logger.error(f"Failed to fetch {url} after {retries} attempts")
    return None


def markdown_to_html(md_text: str) -> str:
    """Convert markdown text to HTML."""
    return markdown.markdown(md_text, extensions=["extra", "codehilite"])


def extract_subcategories_and_sections(content: str) -> List[Tuple[str, str]]:
    """Split markdown into (header, content) sections; default if none."""
    headers = list(HEADER_PATTERN.finditer(content))
    if not headers:
        return [("Default", content)]
    sections: List[Tuple[str, str]] = []
    for i, m in enumerate(headers):
        name = m.group(2).strip()
        start = m.end()
        end = headers[i+1].start() if i+1 < len(headers) else len(content)
        sections.append((name, content[start:end]))
    return sections


def parse_flashcards(section: str) -> List[Dict[str, str]]:
    """Extract flashcards from a markdown section."""
    cards: List[Dict[str, str]] = []
    for front, back in FLASHCARD_PATTERN.findall(section):
        cards.append({"front": markdown_to_html(front.strip()), "back": markdown_to_html(back.strip())})
    return dedupe(cards)


def dedupe(cards: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """Remove duplicate flashcards by front+back."""
    seen = set()
    unique: List[Dict[str, str]] = []
    for c in cards:
        key = (c['front'], c['back'])
        if key not in seen:
            seen.add(key)
            unique.append(c)
    return unique


def group_cards_by_subcategory(content: str, fallback: str) -> Dict[str, List[Dict[str, str]]]:
    """Organize flashcards by subcategory; fallback if none."""
    sections = extract_subcategories_and_sections(content)
    by_sub: Dict[str, List[Dict[str, str]]] = {}
    for name, sec in sections:
        cards = parse_flashcards(sec)
        if cards:
            by_sub[name] = cards
    if not by_sub:
        by_sub[fallback] = []
    return by_sub


def merge_flashcards(existing: Dict[str, List[Dict[str, str]]], new: Dict[str, List[Dict[str, str]]]) -> Dict[str, List[Dict[str, str]]]:
    """Merge and dedupe flashcards into existing subcategories."""
    for sub, new_cards in new.items():
        combined = existing.get(sub, []) + new_cards
        existing[sub] = dedupe(combined)
    return existing


def save_to_json(
    cards_by_subcategory: Dict[str, List[Dict[str, str]]],
    category: str,
    output_path: Path,
) -> int:
    """Merge with existing file if present, write JSON, and return total cards."""
    if output_path.exists():
        logger.info(f"Loading existing data from {output_path}")
        existing = json.loads(output_path.read_text(encoding='utf-8'))
        existing_sub = {s['name']: s['cards'] for s in existing.get('subcategories', [])}
        cards_by_subcategory = merge_flashcards(existing_sub, cards_by_subcategory)
    data = {
        'category': category,
        'subcategories': [
            {'name': sub, 'cards': cards_by_subcategory[sub]}
            for sub in sorted(cards_by_subcategory)
        ],
    }
    atomic_write_json(data, output_path)
    return sum(len(cards_by_subcategory[sub]) for sub in cards_by_subcategory)


def process_category(category: str, urls: List[str]) -> int:
    """Process all URLs for one category; returns number of flashcards."""
    logger.info(f"Processing category '{category}' with {len(urls)} URLs")
    all_cards: Dict[str, List[Dict[str, str]]] = {}
    for url in urls:
        content = retry_get(url)
        if content:
            path = unquote(urlparse(url).path)
            fallback = Path(path).stem.replace('_', ' ')
            grouped = group_cards_by_subcategory(content, fallback)
            all_cards = merge_flashcards(all_cards, grouped)
    output_file = OUTPUT_DIR / (category.replace(' ', '_').lower() + '.json')
    return save_to_json(all_cards, category, output_file)


def update_categories(categories: Set[str]) -> None:
    """Write categories.json as snake_case list."""
    def to_snake(s: str) -> str:
        return re.sub(r"\W+", '_', s).strip('_').lower()
    cats = sorted(to_snake(c) for c in categories)
    atomic_write_json(cats, CATEGORIES_FILE)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    # Organize URLs by category
    cat_map: Dict[str, List[str]] = {}
    categories: Set[str] = set()
    for info in URLS_INFO:
        cat_map.setdefault(info['category'], []).append(info['url'])
        categories.add(info['category'])

    total = 0
    # Process categories concurrently, but collect in fixed order
    with ThreadPoolExecutor(max_workers=min(8, len(cat_map))) as executor:
        future_by_cat = {
            cat: executor.submit(process_category, cat, urls)
            for cat, urls in cat_map.items()
        }
        for cat in cat_map:
            try:
                count = future_by_cat[cat].result()
                total += count
            except Exception as e:
                logger.error(f"Error processing category '{cat}': {e}")

    logger.info(f"Total flashcards processed: {total}")

    update_categories(categories)
    logger.info("Flashcards generation complete.")

if __name__ == '__main__':
    main()
