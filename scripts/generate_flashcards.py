"""
Flashcard Generator Script

This script fetches markdown files from remote URLs, extracts flashcard data
from <details>/<summary> HTML elements, and generates JSON files for the
flashcard web application.

Features:
- Concurrent URL fetching with retry logic
- Markdown to HTML conversion
- Duplicate detection and removal
- Atomic file writes for data integrity
- Structured logging

Author: Adam Djellouli
"""

import json
import logging
import re
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from time import sleep
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import unquote, urlparse

import markdown
import requests


URLS_INFO: List[Dict[str, str]] = [
    {
        "url": "https://raw.githubusercontent.com/djeada/Frontend-Notes/main/notes/12_quizes.md",
        "category": "Web Development",
    },
    {
        "url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/probability.md",
        "category": "Statistics",
    },
    {
        "url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/correlation_and_regression.md",
        "category": "Statistics",
    },
    {
        "url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/descriptive_statistics.md",
        "category": "Statistics",
    },
    {
        "url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/statistical_inference.md",
        "category": "Statistics",
    },
    {
        "url": "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/time_series_analysis.md",
        "category": "Statistics",
    },
]


OUTPUT_DIR: Path = Path("../src/tools/flash_cards")
CATEGORIES_FILE: Path = OUTPUT_DIR / "categories.json"


RETRY_LIMIT: int = 3
TIMEOUT: int = 15
MAX_WORKERS: int = 8


LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

logging.basicConfig(
    level=logging.INFO,
    format=LOG_FORMAT,
    datefmt=LOG_DATE_FORMAT,
)
logger = logging.getLogger(__name__)


FLASHCARD_PATTERN = re.compile(
    r"<details>\s*<summary>(.*?)</summary>\s*(?:<br\s*/?>)?\s*(.*?)\s*</details>",
    re.DOTALL | re.IGNORECASE,
)


HEADER_PATTERN = re.compile(r"^(#{2,6})\s*(.+)$", re.MULTILINE)


def atomic_write_json(data: Any, path: Path) -> None:
    """
    Atomically write JSON data to a file.

    This function writes to a temporary file first, then atomically replaces
    the target file. This prevents data corruption if the write is interrupted.

    Args:
        data: The data to serialize to JSON
        path: The target file path
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            delete=False,
            dir=path.parent,
            suffix=".tmp",
            encoding="utf-8",
        ) as tmp:
            json.dump(data, tmp, indent=4, sort_keys=True, ensure_ascii=False)
            temp_path = Path(tmp.name)

        temp_path.replace(path)
        logger.info("Successfully wrote JSON to %s", path)

    except (OSError, IOError) as e:
        logger.error("Failed to write JSON to %s: %s", path, e)
        raise


def retry_get(url: str, retries: int = RETRY_LIMIT) -> Optional[str]:
    """
    Download content from a URL with exponential backoff retry logic.

    Args:
        url: The URL to fetch
        retries: Maximum number of retry attempts

    Returns:
        The response text content, or None if all retries failed
    """
    for attempt in range(1, retries + 1):
        try:
            logger.info("Fetching %s (attempt %d/%d)", url, attempt, retries)
            response = requests.get(url, timeout=TIMEOUT)
            response.raise_for_status()
            logger.debug("Successfully fetched %s (%d bytes)", url, len(response.text))
            return response.text

        except requests.Timeout:
            logger.warning("Timeout fetching %s (attempt %d)", url, attempt)
        except requests.HTTPError as e:
            logger.warning("HTTP error fetching %s: %s (attempt %d)", url, e, attempt)
        except requests.RequestException as e:
            logger.warning(
                "Request error fetching %s: %s (attempt %d)", url, e, attempt
            )

        if attempt < retries:
            wait_time = 2 ** (attempt - 1)
            logger.info("Retrying in %d seconds...", wait_time)
            sleep(wait_time)

    logger.error("Failed to fetch %s after %d attempts", url, retries)
    return None


def markdown_to_html(md_text: str) -> str:
    """
    Convert markdown text to HTML.

    Args:
        md_text: The markdown text to convert

    Returns:
        The HTML representation of the markdown
    """
    return markdown.markdown(
        md_text,
        extensions=["extra", "codehilite", "tables", "fenced_code"],
    )


def extract_subcategories_and_sections(content: str) -> List[Tuple[str, str]]:
    """
    Split markdown content into sections based on headers.

    Args:
        content: The markdown content to parse

    Returns:
        A list of (header_name, section_content) tuples
    """
    headers = list(HEADER_PATTERN.finditer(content))

    if not headers:
        return [("Default", content)]

    sections: List[Tuple[str, str]] = []
    for i, match in enumerate(headers):
        name = match.group(2).strip()
        start = match.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(content)
        section_content = content[start:end].strip()
        if section_content:
            sections.append((name, section_content))

    return sections if sections else [("Default", content)]


def parse_flashcards(section: str) -> List[Dict[str, str]]:
    """
    Extract flashcards from a markdown section.

    Flashcards are expected to be in the format:
    <details><summary>Question</summary>Answer</details>

    Args:
        section: The markdown section to parse

    Returns:
        A list of flashcard dictionaries with 'front' and 'back' keys
    """
    cards: List[Dict[str, str]] = []

    for match in FLASHCARD_PATTERN.finditer(section):
        front_raw = match.group(1).strip()
        back_raw = match.group(2).strip()

        front_html = markdown_to_html(front_raw)
        back_html = markdown_to_html(back_raw)

        if front_html and back_html:
            cards.append(
                {
                    "front": front_html,
                    "back": back_html,
                }
            )

    return dedupe_cards(cards)


def dedupe_cards(cards: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """
    Remove duplicate flashcards based on front and back content.

    Args:
        cards: List of flashcard dictionaries

    Returns:
        A deduplicated list of flashcards
    """
    seen: Set[Tuple[str, str]] = set()
    unique: List[Dict[str, str]] = []

    for card in cards:
        key = (card["front"], card["back"])
        if key not in seen:
            seen.add(key)
            unique.append(card)

    if len(cards) != len(unique):
        logger.debug("Removed %d duplicate cards", len(cards) - len(unique))

    return unique


def group_cards_by_subcategory(
    content: str, fallback_name: str
) -> Dict[str, List[Dict[str, str]]]:
    """
    Organize flashcards by subcategory based on markdown headers.

    Args:
        content: The markdown content to parse
        fallback_name: Name to use if no headers are found

    Returns:
        A dictionary mapping subcategory names to lists of flashcards
    """
    sections = extract_subcategories_and_sections(content)
    cards_by_subcategory: Dict[str, List[Dict[str, str]]] = {}

    for name, section_content in sections:
        cards = parse_flashcards(section_content)
        if cards:
            cards_by_subcategory[name] = cards
            logger.debug("Found %d cards in subcategory '%s'", len(cards), name)

    if not cards_by_subcategory:
        logger.debug("No cards found, using fallback subcategory '%s'", fallback_name)
        cards_by_subcategory[fallback_name] = []

    return cards_by_subcategory


def merge_flashcards(
    existing: Dict[str, List[Dict[str, str]]],
    new: Dict[str, List[Dict[str, str]]],
) -> Dict[str, List[Dict[str, str]]]:
    """
    Merge new flashcards into existing subcategories, removing duplicates.

    Args:
        existing: Existing flashcards by subcategory
        new: New flashcards to merge

    Returns:
        The merged flashcard dictionary
    """
    for subcategory, new_cards in new.items():
        combined = existing.get(subcategory, []) + new_cards
        existing[subcategory] = dedupe_cards(combined)

    return existing


def save_category_to_json(
    cards_by_subcategory: Dict[str, List[Dict[str, str]]],
    category: str,
    output_path: Path,
) -> int:
    """
    Save flashcards for a category to a JSON file.

    If the output file already exists, the new cards are merged with existing ones.

    Args:
        cards_by_subcategory: Flashcards organized by subcategory
        category: The category name
        output_path: The output file path

    Returns:
        The total number of flashcards saved
    """

    if output_path.exists():
        logger.info("Merging with existing data from %s", output_path)
        try:
            existing_data = json.loads(output_path.read_text(encoding="utf-8"))
            existing_subcategories = {
                s["name"]: s["cards"] for s in existing_data.get("subcategories", [])
            }
            cards_by_subcategory = merge_flashcards(
                existing_subcategories, cards_by_subcategory
            )
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning("Could not parse existing file, overwriting: %s", e)

    data = {
        "category": category,
        "subcategories": [
            {"name": name, "cards": cards}
            for name, cards in sorted(cards_by_subcategory.items())
        ],
    }

    atomic_write_json(data, output_path)

    total_cards = sum(len(cards) for cards in cards_by_subcategory.values())
    return total_cards


def process_category(category: str, urls: List[str]) -> int:
    """
    Process all URLs for a single category.

    Args:
        category: The category name
        urls: List of URLs to fetch flashcards from

    Returns:
        The total number of flashcards processed
    """
    logger.info("Processing category '%s' with %d URL(s)", category, len(urls))

    all_cards: Dict[str, List[Dict[str, str]]] = {}

    for url in urls:
        content = retry_get(url)
        if not content:
            continue

        path = unquote(urlparse(url).path)
        fallback_name = Path(path).stem.replace("_", " ").title()

        grouped = group_cards_by_subcategory(content, fallback_name)
        all_cards = merge_flashcards(all_cards, grouped)

    output_filename = category.replace(" ", "_").lower() + ".json"
    output_path = OUTPUT_DIR / output_filename

    total_cards = save_category_to_json(all_cards, category, output_path)
    logger.info("Category '%s': saved %d flashcards", category, total_cards)

    return total_cards


def update_categories_index(categories: Set[str]) -> None:
    """
    Update the categories.json index file.

    Args:
        categories: Set of category names
    """

    def to_snake_case(s: str) -> str:
        return re.sub(r"\W+", "_", s).strip("_").lower()

    category_list = sorted(to_snake_case(cat) for cat in categories)
    atomic_write_json(category_list, CATEGORIES_FILE)
    logger.info("Updated categories index with %d categories", len(category_list))


def main() -> None:
    """Main entry point for the flashcard generator."""
    logger.info("Starting flashcard generation...")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    category_urls: Dict[str, List[str]] = {}
    categories: Set[str] = set()

    for info in URLS_INFO:
        category = info["category"]
        url = info["url"]
        category_urls.setdefault(category, []).append(url)
        categories.add(category)

    logger.info("Found %d categories to process", len(categories))

    total_cards = 0
    num_workers = min(MAX_WORKERS, len(category_urls))

    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = {
            executor.submit(process_category, cat, urls): cat
            for cat, urls in category_urls.items()
        }

        for future in as_completed(futures):
            category = futures[future]
            try:
                count = future.result()
                total_cards += count
            except Exception as e:
                logger.error("Error processing category '%s': %s", category, e)

    update_categories_index(categories)

    logger.info(
        "Flashcard generation complete: %d total cards across %d categories",
        total_cards,
        len(categories),
    )


if __name__ == "__main__":
    main()
