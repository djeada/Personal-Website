import tempfile
from pathlib import Path
import json
import re
from multiprocessing import Pool, cpu_count
import logging

import requests

# TODO:
# - many subcategories in one category

URLS = [
    "https://raw.githubusercontent.com/djeada/Parallel-And-Concurrent-Programming/master/quizzes/intro.md",
    "https://raw.githubusercontent.com/djeada/Frontend-Notes/main/quizzes/html.md",
]
URLS_TO_NAMES = {
    "https://raw.githubusercontent.com/djeada/Parallel-And-Concurrent-Programming/master/quizzes/intro.md": "parallel_programming",
    "https://raw.githubusercontent.com/djeada/Frontend-Notes/main/quizzes/html.md": "frontend",
}
OUTPUT_DIR = Path("../src/tools/quiz_app")

LOG_FORMAT = "%(asctime)s - %(levelname)s - %(message)s"
LOG_LEVEL = logging.INFO
logging.basicConfig(level=LOG_LEVEL, format=LOG_FORMAT)
logger = logging.getLogger(__name__)


def parse_markdown_question(md_content):
    question_pattern = r"Q\.\s*(.+?)(?:\n{2,}|\Z)"
    options_pattern = r"- \[( |x)\]\s*(.+)"
    question_match = re.search(question_pattern, md_content, re.DOTALL | re.IGNORECASE)
    if question_match:
        question_text = question_match.group(1).strip()
    else:
        logger.warning("No question found in block.")
        return None
    options = []
    correct_option_index = -1
    for index, match in enumerate(
        re.finditer(options_pattern, md_content, re.MULTILINE)
    ):
        correct_marker, option_text = match.groups()
        options.append(option_text.strip())
        if correct_marker.lower() == "x":
            if correct_option_index != -1:
                logger.warning(
                    "Multiple correct options found. Only the first will be considered."
                )
                continue
            correct_option_index = index
    if correct_option_index == -1:
        logger.warning(f"No correct option marked for question: {question_text}")
        return None
    return {
        "text": question_text,
        "options": options,
        "correctOptionIndex": correct_option_index,
    }


def download_content(url):
    try:
        response = requests.get(url)
        response.raise_for_status()
        logger.info(f"Successfully downloaded content from {url}")
        return response.text
    except requests.HTTPError as http_err:
        logger.error(f"HTTP error occurred while downloading {url}: {http_err}")
        raise
    except Exception as err:
        logger.error(f"Unexpected error occurred while downloading {url}: {err}")
        raise


def save_content_to_temp(url, content):
    try:
        with tempfile.NamedTemporaryFile(
            delete=False, mode="w", encoding="utf-8", suffix=".md"
        ) as tmp_file:
            tmp_file.write(content)
            temp_path = Path(tmp_file.name)
            logger.info(f"Content from {url} saved to temporary file {temp_path}")
            return temp_path
    except Exception as err:
        logger.error(f"Error saving content to temporary file for {url}: {err}")
        raise


def parse_questions_from_markdown(markdown_text):
    questions = []
    question_blocks = re.split(r"\n####\s*", markdown_text)
    for block in question_blocks:
        block = block.strip()
        if not block:
            continue
        question_data = parse_markdown_question(block)
        if question_data:
            questions.append(question_data)
    logger.info(f"Parsed {len(questions)} questions.")
    return questions


def save_questions_to_json(questions, output_path):
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as json_file:
            json.dump({"questions": questions}, json_file, indent=4)
        logger.info(f"Questions saved to {output_path}")
    except Exception as err:
        logger.error(f"Error saving questions to JSON file {output_path}: {err}")
        raise


def process_url(url):
    try:
        logger.info(f"Processing URL: {url}")
        content = download_content(url)
        temp_file_path = save_content_to_temp(url, content)
        with open(temp_file_path, "r", encoding="utf-8") as md_file:
            markdown_text = md_file.read()
        questions = parse_questions_from_markdown(markdown_text)
        input_path = Path(temp_file_path)
        output_filename = URLS_TO_NAMES.get(url, input_path.stem) + ".json"
        output_path = OUTPUT_DIR / output_filename
        save_questions_to_json(questions, output_path)
        temp_file_path.unlink(missing_ok=True)
        logger.info(f"Temporary file {temp_file_path} deleted.")
    except Exception as err:
        logger.error(f"Failed to process {url}: {err}")


def generate_categories():
    categories = []
    for name in URLS_TO_NAMES.values():
        category_name = " ".join(word.capitalize() for word in name.split("_"))
        categories.append({"name": category_name})
    categories_path = OUTPUT_DIR / "categories.json"
    try:
        with open(categories_path, "w", encoding="utf-8") as cat_file:
            json.dump(categories, cat_file, indent=4)
        logger.info(f"Categories saved to {categories_path}")
    except Exception as err:
        logger.error(f"Error saving categories to JSON file {categories_path}: {err}")
        raise


def convert_markdown_to_json():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    num_workers = min(cpu_count(), len(URLS))
    logger.info(f"Starting conversion with {num_workers} workers.")
    with Pool(processes=num_workers) as pool:
        pool.map(process_url, URLS)
    generate_categories()
    logger.info("Conversion process completed.")


if __name__ == "__main__":
    convert_markdown_to_json()
