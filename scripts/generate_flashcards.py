import json
import re
import requests
from pathlib import Path
from multiprocessing import Pool
from urllib.parse import urlparse

URLS = [
    "https://raw.githubusercontent.com/djeada/Frontend-Notes/main/notes/12_quizes.md"
]
OUTPUT_DIR = Path("../src/tools/flash_cards")


def download_flashcards(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        return url, response.text
    except requests.RequestException as e:
        print(f"Error downloading {url}: {e}")
        return url, None


def parse_flashcards(content):
    # Pattern to extract questions and answers
    flashcard_pattern = re.compile(
        r"<details>\s*<summary>(.*?)</summary><br>\s*(.*?)\s*</details>", re.DOTALL
    )
    matches = flashcard_pattern.findall(content)

    # Extracted cards
    cards = [{"front": front.strip(), "back": back.strip()} for front, back in matches]
    return cards


def process_url(url):
    _, content = download_flashcards(url)
    if not content:
        return

    cards = parse_flashcards(content)
    output_filename = f"{urlparse(url).netloc.replace('.', '_')}.json"
    output_path = OUTPUT_DIR / output_filename
    save_to_json(cards, "Web Development", "HTML Basics", output_path)
    print(f"Saved flashcards to {output_path}")


def save_to_json(cards, category, subcategory, output_path):
    # Structure data
    data = {
        "category": category,
        "subcategories": [{"name": subcategory, "cards": cards}],
    }
    # Save data to JSON file
    with open(output_path, "w", encoding="utf-8") as json_file:
        json.dump(data, json_file, indent=4)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with Pool() as pool:
        pool.map(process_url, URLS)


if __name__ == "__main__":
    main()
