import json
import re
import logging
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

# Configuration
# Map each quiz URL to exactly one category
URL_TO_CATEGORY: Dict[str, str] = {
    "https://raw.githubusercontent.com/djeada/Parallel-And-Concurrent-Programming/master/quizzes/intro.md": "parallel_programming",
    # Frontend
    "https://raw.githubusercontent.com/djeada/Frontend-Notes/main/quizzes/html.md": "frontend",
    "https://raw.githubusercontent.com/djeada/Frontend-Notes/main/quizzes/css.md": "frontend",
    "https://raw.githubusercontent.com/djeada/Frontend-Notes/main/quizzes/js.md": "frontend",
    # Linux quizzes
    "https://raw.githubusercontent.com/djeada/Linux-Notes/main/quizzes/partitions_and_logical_volumes.md": "linux",
    "https://raw.githubusercontent.com/djeada/Linux-Notes/main/quizzes/files.md": "linux",
    "https://raw.githubusercontent.com/djeada/Linux-Notes/main/quizzes/file_systems.md": "linux",
    "https://raw.githubusercontent.com/djeada/Linux-Notes/main/quizzes/networking.md": "linux",
    "https://raw.githubusercontent.com/djeada/Linux-Notes/main/quizzes/tools.md": "linux",
    "https://raw.githubusercontent.com/djeada/Linux-Notes/main/quizzes/users.md": "linux",
    # Statistics
    "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/quizzes/correlation_and_regression.md": "statistics",
    "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/quizzes/descriptive_statistics.md": "statistics",
    "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/quizzes/intro_probability.md": "statistics",
    "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/quizzes/probability_distributions.md": "statistics",
    "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/quizzes/statistical_inference.md": "statistics",
    "https://raw.githubusercontent.com/djeada/Statistics-Notes/main/quizzes/time_series.md": "statistics",
}

OUTPUT_DIR: Path = Path("../src/tools/quiz_app")
CATEGORIES_FILE: Path = OUTPUT_DIR / "categories.json"
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger(__name__)


def parse_markdown_question(md: str) -> Optional[Dict[str, Any]]:
    # 1) Extract the Q. line
    q_match = re.search(
        r"Q\.\s*(.+?)(?=\n[\*\-]\s*\[)",
        md,
        re.IGNORECASE | re.DOTALL,
    )
    if not q_match:
        logger.warning("Skipping block: no question found.")
        return None
    text = q_match.group(1).strip()

    # 2) Extract all [ ]/[x] options, allowing * or - bullets
    options: List[str] = []
    correct_idx: int = -1
    for idx, m in enumerate(
        re.finditer(
            r"^[\*\-]\s*\[([ x])\]\s*(.+)$",
            md,
            re.IGNORECASE | re.MULTILINE,
        )
    ):
        marker, opt_text = m.groups()
        options.append(opt_text.strip())
        if marker.lower() == "x" and correct_idx == -1:
            correct_idx = idx

    if correct_idx == -1:
        logger.warning(f"No correct option marked for question: '{text}'")
        return None

    return {
        "text": text,
        "options": options,
        "correctOptionIndex": correct_idx,
    }


def parse_questions_from_markdown(md: str) -> List[Dict[str, Any]]:
    """
    Splits markdown into question blocks and parses each one.
    """
    blocks = [b.strip() for b in md.split("\n#### ") if b.strip()]
    questions: List[Dict[str, Any]] = []
    for block in blocks:
        question = parse_markdown_question(block)
        if question:
            questions.append(question)
    logger.info(f"Parsed {len(questions)} questions.")
    return questions


def download_markdown(url: str, session: requests.Session) -> str:
    """
    Download raw markdown text from the given URL.
    Raises HTTPError on failure.
    """
    response = session.get(url)
    response.raise_for_status()
    logger.info(f"Downloaded content from {url}")
    return response.text


def write_json(data: Any, path: Path) -> None:
    """
    Atomically write JSON data to `path` with consistent formatting.
    Ensures parent directories exist.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    # Write to temp file and rename for atomicity
    with tempfile.NamedTemporaryFile(
        "w", delete=False, dir=path.parent, suffix=".tmp", encoding="utf-8"
    ) as tmp:
        json.dump(data, tmp, indent=4, sort_keys=True, ensure_ascii=False)
        temp_name = Path(tmp.name)
    temp_name.replace(path)
    logger.info(f"Wrote JSON to {path}")


def process_url(
    url: str, session: requests.Session
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Download and parse a single URL, returning its category and associated questions.
    """
    md_text = download_markdown(url, session)
    questions = parse_questions_from_markdown(md_text)
    category = URL_TO_CATEGORY[url]
    return category, questions


def main() -> None:
    """
    Main entry point: processes all URLs concurrently, aggregates by category,
    and writes per-category JSON and the categories file.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    aggregated: Dict[str, List[Dict[str, Any]]] = {}

    with requests.Session() as session:
        # submit all jobs in a fixed URL order
        future_by_url = {
            url: ThreadPoolExecutor(max_workers=1).submit(process_url, url, session)
            for url in URL_TO_CATEGORY
        }
        # collect results in the same URL order
        for url in URL_TO_CATEGORY:
            try:
                category, questions = future_by_url[url].result()
                aggregated.setdefault(category, []).extend(questions)
            except Exception as e:
                logger.error(f"Error processing {url}: {e}")

    # ensure each category’s questions are in a stable order
    for category, questions in aggregated.items():
        aggregated[category] = sorted(questions, key=lambda q: q["text"])

    # Write per-category files in sorted order
    for category in sorted(aggregated):
        write_json({"questions": aggregated[category]}, OUTPUT_DIR / f"{category}.json")

    # Generate categories file sorted by name
    categories_list = [
        {"name": cat.replace("_", " ").title()} for cat in sorted(aggregated)
    ]
    write_json(categories_list, CATEGORIES_FILE)

    logger.info("Conversion process completed.")


if __name__ == "__main__":
    main()
