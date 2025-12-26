#!/usr/bin/env python3
"""
Quiz Generator Script

Fetches quiz questions from markdown files in various repositories and generates
JSON files for the quiz application.

Features:
- Concurrent downloads for faster processing
- Robust markdown parsing with validation
- Atomic file writes to prevent data corruption
- Comprehensive error handling and logging
- Support for multiple question formats
"""

import json
import logging
import re
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# =============================================================================
# Configuration
# =============================================================================

# Map each quiz URL to exactly one category
URL_TO_CATEGORY: Dict[str, str] = {
    # Parallel Programming
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

# Output configuration
OUTPUT_DIR: Path = Path(__file__).parent.parent / "src" / "tools" / "quiz_app"
CATEGORIES_FILE: Path = OUTPUT_DIR / "categories.json"

# HTTP configuration
MAX_WORKERS = 8
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3

# Logging configuration
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
LOG_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


# =============================================================================
# Data Classes
# =============================================================================


@dataclass
class Question:
    """Represents a single quiz question."""

    text: str
    options: List[str]
    correct_option_index: int

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "text": self.text,
            "options": self.options,
            "correctOptionIndex": self.correct_option_index,
        }


@dataclass
class ProcessingResult:
    """Result of processing a URL."""

    url: str
    category: str
    questions: List[Question] = field(default_factory=list)
    success: bool = True
    error_message: Optional[str] = None


# =============================================================================
# Logging Setup
# =============================================================================


def setup_logging(verbose: bool = False) -> logging.Logger:
    """Configure logging for the application."""
    level = logging.DEBUG if verbose else logging.INFO

    logging.basicConfig(level=level, format=LOG_FORMAT, datefmt=LOG_DATE_FORMAT)

    logger = logging.getLogger(__name__)
    return logger


logger = setup_logging()


# =============================================================================
# HTTP Client
# =============================================================================


def create_session() -> requests.Session:
    """Create a requests session with retry logic."""
    session = requests.Session()

    retry_strategy = Retry(
        total=MAX_RETRIES,
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
    )

    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    return session


def download_markdown(url: str, session: requests.Session) -> str:
    """
    Download raw markdown text from the given URL.

    Args:
        url: The URL to download from
        session: The requests session to use

    Returns:
        The downloaded markdown content

    Raises:
        requests.HTTPError: If the download fails
    """
    response = session.get(url, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    logger.debug(f"Downloaded {len(response.text)} bytes from {url}")
    return response.text


# =============================================================================
# Markdown Parsing
# =============================================================================


def parse_markdown_question(block: str) -> Optional[Question]:
    """
    Parse a single question block from markdown.

    Expected format:
    Q. Question text here?
    * [ ] Option A
    * [x] Option B (correct)
    * [ ] Option C

    Args:
        block: The markdown block containing the question

    Returns:
        A Question object if parsing succeeds, None otherwise
    """
    # Extract the question text
    question_match = re.search(
        r"Q\.\s*(.+?)(?=\n[\*\-]\s*\[)",
        block,
        re.IGNORECASE | re.DOTALL,
    )

    if not question_match:
        logger.debug("Skipping block: no question text found")
        return None

    question_text = question_match.group(1).strip()

    # Validate question text
    if len(question_text) < 5:
        logger.debug(f"Skipping block: question text too short: '{question_text}'")
        return None

    # Extract all options (supporting both * and - bullets)
    options: List[str] = []
    correct_index: int = -1

    option_pattern = re.compile(
        r"^[\*\-]\s*\[([ xX])\]\s*(.+)$",
        re.MULTILINE,
    )

    for idx, match in enumerate(option_pattern.finditer(block)):
        marker, option_text = match.groups()
        option_text = option_text.strip()

        if option_text:
            options.append(option_text)

            # Check if this is the correct option
            if marker.lower() == "x" and correct_index == -1:
                correct_index = idx

    # Validate parsed content
    if len(options) < 2:
        logger.debug(f"Skipping question: too few options ({len(options)})")
        return None

    if correct_index == -1:
        logger.warning(f"No correct option marked for: '{question_text[:50]}...'")
        return None

    return Question(
        text=question_text,
        options=options,
        correct_option_index=correct_index,
    )


def parse_questions_from_markdown(markdown_content: str) -> List[Question]:
    """
    Parse all questions from a markdown file.

    Args:
        markdown_content: The full markdown content

    Returns:
        A list of parsed Question objects
    """
    # Split by question headers (#### markers)
    blocks = [block.strip() for block in markdown_content.split("\n#### ") if block.strip()]

    questions: List[Question] = []
    for block in blocks:
        question = parse_markdown_question(block)
        if question:
            questions.append(question)

    logger.info(f"Parsed {len(questions)} questions from {len(blocks)} blocks")
    return questions


# =============================================================================
# File Operations
# =============================================================================


def write_json(data: Any, path: Path) -> None:
    """
    Atomically write JSON data to a file.

    Uses a temporary file and rename for atomicity to prevent
    data corruption if the write is interrupted.

    Args:
        data: The data to serialize to JSON
        path: The target file path
    """
    path.parent.mkdir(parents=True, exist_ok=True)

    # Write to a temporary file first
    with tempfile.NamedTemporaryFile(
        mode="w",
        delete=False,
        dir=path.parent,
        suffix=".tmp",
        encoding="utf-8",
    ) as tmp_file:
        json.dump(data, tmp_file, indent=4, sort_keys=True, ensure_ascii=False)
        temp_path = Path(tmp_file.name)

    # Atomically replace the target file
    temp_path.replace(path)
    logger.info(f"Wrote JSON to {path}")


# =============================================================================
# URL Processing
# =============================================================================


def process_url(url: str, session: requests.Session) -> ProcessingResult:
    """
    Download and parse a single URL.

    Args:
        url: The URL to process
        session: The requests session to use

    Returns:
        A ProcessingResult with the parsed questions or error info
    """
    category = URL_TO_CATEGORY.get(url, "unknown")

    try:
        markdown_content = download_markdown(url, session)
        questions = parse_questions_from_markdown(markdown_content)

        return ProcessingResult(
            url=url,
            category=category,
            questions=questions,
            success=True,
        )

    except requests.RequestException as e:
        error_msg = f"Network error: {e}"
        logger.error(f"Failed to process {url}: {error_msg}")
        return ProcessingResult(
            url=url,
            category=category,
            success=False,
            error_message=error_msg,
        )

    except Exception as e:
        error_msg = f"Unexpected error: {e}"
        logger.exception(f"Failed to process {url}")
        return ProcessingResult(
            url=url,
            category=category,
            success=False,
            error_message=error_msg,
        )


def process_all_urls(urls: List[str]) -> List[ProcessingResult]:
    """
    Process all URLs concurrently.

    Args:
        urls: List of URLs to process

    Returns:
        List of ProcessingResults in the same order as input URLs
    """
    results: Dict[str, ProcessingResult] = {}

    with create_session() as session:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            # Submit all tasks
            future_to_url = {
                executor.submit(process_url, url, session): url for url in urls
            }

            # Collect results as they complete
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    result = future.result()
                    results[url] = result
                except Exception as e:
                    logger.exception(f"Unexpected error processing {url}")
                    results[url] = ProcessingResult(
                        url=url,
                        category=URL_TO_CATEGORY.get(url, "unknown"),
                        success=False,
                        error_message=str(e),
                    )

    # Return results in original URL order
    return [results[url] for url in urls]


# =============================================================================
# Main Entry Point
# =============================================================================


def main() -> int:
    """
    Main entry point for the quiz generator.

    Returns:
        Exit code (0 for success, 1 for errors)
    """
    logger.info("Starting quiz generation...")
    logger.info(f"Output directory: {OUTPUT_DIR}")

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Get ordered list of URLs
    urls = list(URL_TO_CATEGORY.keys())
    logger.info(f"Processing {len(urls)} URLs across {len(set(URL_TO_CATEGORY.values()))} categories")

    # Process all URLs
    results = process_all_urls(urls)

    # Aggregate questions by category
    aggregated: Dict[str, List[Dict[str, Any]]] = {}
    errors: List[str] = []

    for result in results:
        if result.success:
            category = result.category
            questions_dicts = [q.to_dict() for q in result.questions]
            aggregated.setdefault(category, []).extend(questions_dicts)
        else:
            errors.append(f"{result.url}: {result.error_message}")

    # Sort questions within each category for consistent output
    for category in aggregated:
        aggregated[category] = sorted(
            aggregated[category],
            key=lambda q: q["text"],
        )

    # Write per-category JSON files
    for category in sorted(aggregated):
        questions = aggregated[category]
        output_path = OUTPUT_DIR / f"{category}.json"
        write_json({"questions": questions}, output_path)
        logger.info(f"Category '{category}': {len(questions)} questions")

    # Generate categories index file
    categories_list = [
        {"name": category.replace("_", " ").title()}
        for category in sorted(aggregated)
    ]
    write_json(categories_list, CATEGORIES_FILE)

    # Report summary
    total_questions = sum(len(q) for q in aggregated.values())
    logger.info(f"Generation complete: {total_questions} questions in {len(aggregated)} categories")

    if errors:
        logger.warning(f"{len(errors)} URLs failed to process:")
        for error in errors:
            logger.warning(f"  - {error}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
