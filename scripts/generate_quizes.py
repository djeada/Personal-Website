import os
import tempfile
from pathlib import Path
import json
import re
from multiprocessing import Pool
from urllib.parse import urlparse, unquote

import requests

# Global variables for input paths and output directory
URLS = [
    "https://raw.githubusercontent.com/djeada/Parallel-And-Concurrent-Programming/master/notes/quiz.md",
]
URLS_TO_NAMES = {
    "https://raw.githubusercontent.com/djeada/Parallel-And-Concurrent-Programming/master/notes/quiz.md": "parallel_programming"
}
OUTPUT_DIR = Path("../src/tools/quiz_app")  # Replace with actual output directory path


def parse_markdown_question(md_content):
    """Parse a single markdown question block and extract the question text, options, and correct option index."""
    # Define the pattern for question and options
    question_pattern = r"Q\. (.+?)\n\n"
    options_pattern = r"- \[( |x)\] (.+)"

    # Extract question text
    question_match = re.match(question_pattern, md_content, re.DOTALL)
    if question_match:
        question_text = question_match.group(1).strip()
    else:
        return None

    # Extract options and identify the correct one
    options = []
    correct_option_index = -1
    for index, match in enumerate(
        re.finditer(options_pattern, md_content, re.MULTILINE)
    ):
        correct_marker, option_text = match.groups()
        options.append(option_text.strip())
        if correct_marker == "x":
            correct_option_index = index

    # Ensure the correct option was found
    if correct_option_index == -1:
        return None

    return {
        "text": question_text,
        "options": options,
        "correctOptionIndex": correct_option_index,
    }


def process_file(url):
    """Process a single markdown file and convert it to JSON."""

    # Parse the URL to extract the last part of the path

    # Create a temporary directory
    with tempfile.TemporaryDirectory() as tmp_dir:
        # Define the path to save the HTML file
        html_file_path = os.path.join(tmp_dir, URLS_TO_NAMES[url])

        # Download the HTML content
        response = requests.get(url)
        response.raise_for_status()  # Raise an exception for HTTP errors

        # Save the HTML content to a file
        with open(html_file_path, "w", encoding="utf-8") as file:
            file.write(response.text)

        print(f"HTML page downloaded and saved to: {html_file_path}")

        input_path = Path(html_file_path)
        output_path = OUTPUT_DIR / (input_path.stem + ".json")

        with open(input_path, "r", encoding="utf-8") as md_file:
            content = md_file.read()

        questions = []
        question_blocks = content.split("####")
        for block in question_blocks:
            question_data = parse_markdown_question(block.lstrip())
            if question_data:
                questions.append(question_data)

    with open(output_path, "w", encoding="utf-8") as json_file:
        json.dump({"questions": questions}, json_file, indent=4)


def convert_markdown_to_json():
    """Convert multiple markdown files to JSON format using multiprocessing."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with Pool() as pool:
        pool.map(process_file, URLS)


if __name__ == "__main__":
    convert_markdown_to_json()
