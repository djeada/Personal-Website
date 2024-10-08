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
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

URLS = [
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

OUTPUT_DIR = Path("../src/tools/flash_cards")
CATEGORIES = Path("../src/tools/flash_cards/categories.json")
RETRY_LIMIT = 3
TIMEOUT = 10
FLASHCARD_PATTERN = re.compile(
    r"<details>\s*<summary>(.*?)</summary><br>\s*(.*?)\s*</details>", re.DOTALL
)
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


def markdown_to_html(text: str) -> str:
    # Bold **text**
    text = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", text)

    # Italics *text*
    text = re.sub(r"\*(.*?)\*", r"<i>\1</i>", text)

    # Code `code`
    text = re.sub(r"`(.*?)`", r"<code>\1</code>", text)

    # Headers # H1, ## H2, ### H3 (for simplicity, up to H3)
    text = re.sub(r"### (.*)", r"<h3>\1</h3>", text)
    text = re.sub(r"## (.*)", r"<h2>\1</h2>", text)
    text = re.sub(r"# (.*)", r"<h1>\1</h1>", text)

    # Links [text](url)
    text = re.sub(r"\[(.*?)\]\((.*?)\)", r'<a href="\2">\1</a>', text)

    # Lists - item or * item
    text = re.sub(r"\n\s*-\s*(.*)", r"<li>\1</li>", text)
    text = re.sub(r"\n\s*\*\s*(.*)", r"<li>\1</li>", text)
    text = re.sub(r"(<li>.*?</li>)", r"<ul>\1</ul>", text, flags=re.S)

    return text


def parse_flashcards(content: str) -> List[Dict[str, str]]:
    return [
        {
            "front": markdown_to_html(front.strip()),
            "back": markdown_to_html(re.sub(r"\s+", " ", back.strip())),
        }
        for front, back in FLASHCARD_PATTERN.findall(content)
    ]


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


def merge_flashcards(
    existing_data: Dict[str, List[Dict[str, str]]],
    new_data: Dict[str, List[Dict[str, str]]],
) -> Dict:
    # Merge new flashcards into existing subcategories
    for subcategory, new_cards in new_data.items():
        if subcategory in existing_data:
            existing_data[subcategory].extend(new_cards)
        else:
            existing_data[subcategory] = new_cards
    return existing_data


def save_to_json(
    cards_by_subcategory: Dict[str, List[Dict[str, str]]],
    category: str,
    output_path: Path,
) -> None:
    if output_path.exists():
        # Load existing data if the file already exists
        logging.info(f"Loading existing data from {output_path}")
        existing_data = json.loads(output_path.read_text(encoding="utf-8"))

        # Convert the subcategories list back into a dictionary for easier merging
        existing_subcategories = {
            subcategory["name"]: subcategory["cards"]
            for subcategory in existing_data.get("subcategories", [])
        }

        # Merge new cards with existing ones
        cards_by_subcategory = merge_flashcards(
            existing_subcategories, cards_by_subcategory
        )

    # Convert the dictionary back into the format for saving
    data = {
        "category": category,
        "subcategories": [
            {"name": subcategory, "cards": cards}
            for subcategory, cards in cards_by_subcategory.items()
        ],
    }

    logging.info(f"Saving flashcards to {output_path}")
    output_path.write_text(
        json.dumps(data, indent=4, ensure_ascii=False), encoding="utf-8"
    )


def group_cards_by_subcategory(
    content: str, fallback_subcategory: str
) -> Dict[str, List[Dict[str, str]]]:
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
    def to_snake_case(s: str) -> str:
        return re.sub(r"\W+", "_", s).strip("_").lower()

    # Convert categories to lowercase and snake case
    categories_list = [to_snake_case(category) for category in categories]

    logging.info(f"Updating categories in {CATEGORIES}")

    # Write the updated categories to the file
    with open(CATEGORIES, "w", encoding="utf-8") as f:
        json.dump(categories_list, f, indent=4, ensure_ascii=False)


def process_category(urls_info: List[Dict[str, str]]) -> None:
    """Process all URLs for a single category."""
    if not urls_info:
        return

    category = urls_info[0][
        "category"
    ]  # All URLs in this list belong to the same category
    logging.info(f"Processing category {category} with {len(urls_info)} URLs")

    output_filename = generate_filename_from_category(category)
    output_path = OUTPUT_DIR / output_filename

    # Download and process flashcards for all URLs in this category
    all_cards_by_subcategory = {}

    for url_info in urls_info:
        url = url_info["url"]
        content = download_flashcards(url)
        if content:
            fallback_subcategory = Path(unquote(urlparse(url).path)).stem.replace(
                "_", " "
            )
            cards_by_subcategory = group_cards_by_subcategory(
                content, fallback_subcategory
            )
            # Merge cards from different URLs under the same category
            all_cards_by_subcategory = merge_flashcards(
                all_cards_by_subcategory, cards_by_subcategory
            )

    # Save the accumulated flashcards to the JSON file
    save_to_json(all_cards_by_subcategory, category, output_path)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    categories = set()

    # Group URLs by category
    category_url_map = {}
    for url_info in URLS:
        category = url_info["category"]
        if category not in category_url_map:
            category_url_map[category] = []
        category_url_map[category].append(url_info)

    # Prepare category processing tasks for the pool
    with Pool() as pool:
        pool.map(process_category, category_url_map.values())

    # Update categories in categories.json
    update_categories(set(category_url_map.keys()))


if __name__ == "__main__":
    main()
