import json
import re
import requests
from pathlib import Path
from multiprocessing import Pool
from urllib.parse import urlparse, unquote
from time import sleep
import logging
from typing import List, Dict, Tuple, Optional

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


URLS = [
    {
        "url": "https://raw.githubusercontent.com/djeada/Frontend-Notes/main/notes/12_quizes.md",
        "category": "Web Development"
    },
    {
        "url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/probability.md",
        "category": "Statistics"
    }
]

OUTPUT_DIR = Path("../src/tools/flash_cards")
CATEGORIES = Path("../src/tools/flash_cards/categories.json")
RETRY_LIMIT = 3
TIMEOUT = 10
FLASHCARD_PATTERN = re.compile(r"<details>\s*<summary>(.*?)</summary><br>\s*(.*?)\s*</details>", re.DOTALL)
HEADER_PATTERN = re.compile(r"^(#{2,6})\s*(.+)$", re.MULTILINE)


def download_flashcards(url: str, retries: int = RETRY_LIMIT) -> Optional[str]:
    for attempt in range(retries):
        try:
            logging.info(f"Downloading flashcards from {url} (attempt {attempt + 1})")
            response = requests.get(url, timeout=TIMEOUT)
            response.raise_for_status()
            return response.text
        except requests.RequestException as e:
            logging.warning(f"Attempt {attempt + 1} failed: {e}")
            sleep(2 ** attempt)
    logging.error(f"Failed to download flashcards from {url} after {retries} attempts")
    return None


def parse_flashcards(content: str) -> List[Dict[str, str]]:
    return [{"front": front.strip(), "back": re.sub(r'\s+', ' ', back.strip())} for front, back in FLASHCARD_PATTERN.findall(content)]


def extract_subcategories_and_sections(content: str) -> List[Tuple[str, str]]:
    headers = list(HEADER_PATTERN.finditer(content))
    if not headers:
        return [("Default", content)]

    sections = []
    for i, match in enumerate(headers):
        _, subcategory_name = match.groups()
        start_pos = match.end()

        if i + 1 < len(headers):
            end_pos = headers[i + 1].start()
        else:
            end_pos = len(content)

        section_content = content[start_pos:end_pos]
        sections.append((subcategory_name.strip(), section_content))

    return sections


def generate_filename_from_category(category: str) -> str:
    return f"{category.replace(' ', '_').lower()}.json"


def save_to_json(cards_by_subcategory: Dict[str, List[Dict[str, str]]], category: str, output_path: Path) -> None:
    data = {
        "category": category,
        "subcategories": [
            {"name": subcategory, "cards": cards} for subcategory, cards in cards_by_subcategory.items()
        ],
    }
    logging.info(f"Saving flashcards to {output_path}")
    output_path.write_text(json.dumps(data, indent=4, ensure_ascii=False), encoding="utf-8")


def group_cards_by_subcategory(content: str, fallback_subcategory: str) -> Dict[str, List[Dict[str, str]]]:
    sections = extract_subcategories_and_sections(content)
    cards_by_subcategory = {}
    for subcategory, section_content in sections:
        subcategory_cards = parse_flashcards(section_content)
        if subcategory_cards:
            cards_by_subcategory[subcategory] = subcategory_cards
    return cards_by_subcategory if cards_by_subcategory else {fallback_subcategory: []}


def process_url(url_info: Dict[str, str]) -> None:
    url = url_info["url"]
    category = url_info["category"]
    content = download_flashcards(url)
    if content:
        fallback_subcategory = Path(unquote(urlparse(url).path)).stem.replace("_", " ")
        cards_by_subcategory = group_cards_by_subcategory(content, fallback_subcategory)
        output_filename = generate_filename_from_category(category)
        save_to_json(cards_by_subcategory, category, OUTPUT_DIR / output_filename)


def update_categories(categories: set) -> None:
    categories_list = list(categories)
    logging.info(f"Updating categories in {CATEGORIES}")
    with open(CATEGORIES, "w", encoding="utf-8") as f:
        json.dump(categories_list, f, indent=4, ensure_ascii=False)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    categories = set()
    with Pool() as pool:
        for url_info in URLS:
            categories.add(url_info["category"])
            pool.apply_async(process_url, (url_info,))
        pool.close()
        pool.join()
    update_categories(categories)


if __name__ == "__main__":
    main()
