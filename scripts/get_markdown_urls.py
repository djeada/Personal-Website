"""
Downloads markdown files.
"""
import json
from urllib.parse import urlparse, unquote
from concurrent.futures import ThreadPoolExecutor
import logging
import requests
from pathlib import Path

# Initialize logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

PL_INPUT_URLS = [
    "https://github.com/djeada/Kurs-Podstaw-Pythona/tree/master/notatki/01_podstawy",
    "https://github.com/djeada/Kurs-Podstaw-Pythona/tree/master/notatki/02_sredniozawansowane",
    "https://github.com/djeada/Kurs-Podstaw-Pythona/tree/master/notatki/03_inzynieria_oprogramowania",
    "https://github.com/djeada/Kurs-Podstaw-Pythona/tree/master/notatki/04_python_w_praktyce",
    "https://github.com/djeada/Kurs-Podstaw-Pythona/tree/master/notatki/05_prezentacje",
    "https://github.com/djeada/Od-C-do-Cpp/tree/master/notatki",
]
EN_INPUT_URLS = [
    "https://github.com/djeada/Linux-Notes/tree/main/notes",
    "https://github.com/djeada/Algorithms-And-Data-Structures/tree/master/notes",
    "https://github.com/djeada/Git-Notes/tree/main/notes",
    "https://github.com/djeada/Stanford-Machine-Learning/tree/main/slides",
    "https://github.com/djeada/Frontend-Notes/tree/main/notes",
    "https://github.com/djeada/Parallel-And-Concurrent-Programming/tree/master/notes",
    "https://github.com/djeada/Statistics-Notes/tree/main/notes/basic_concepts",
    "https://github.com/djeada/Statistics-Notes/tree/main/notes/correlation_and_regression",
    "https://github.com/djeada/Statistics-Notes/tree/main/notes/hypothesis_testing_and_confidence_intervals",
    "https://github.com/djeada/Statistics-Notes/tree/main/notes/probability_distributions/continuous_distributions",
    "https://github.com/djeada/Statistics-Notes/tree/main/notes/probability_distributions/discrete_distributions",
    "https://github.com/djeada/Statistics-Notes/tree/main/notes/probability_distributions/intro",
    "https://github.com/djeada/Statistics-Notes/tree/main/notes/time_series_analysis",
    "https://github.com/djeada/Numpy-Tutorials/tree/main/notes",
    "https://github.com/djeada/Vtk-Examples/tree/main/notes",
]

EN_LANG = "EN"
PL_LANG = "PL"
OUTPUT_FILE = "input.json"
FAILED_FILE = "failed.json"
GITHUB_API_BASE = "https://api.github.com/repos"


def get_github_api_url(web_url):
    """
    Converts a GitHub repository web URL to the GitHub API URL for the contents of the directory.
    """
    parts = web_url.split("/")
    user = parts[3]
    repo = parts[4]
    path = "/".join(parts[7:])
    api_url = f"{GITHUB_API_BASE}/{user}/{repo}/contents/{path}"
    logging.info(f"Converted {web_url} to API URL: {api_url}")
    return api_url


def fetch_github_contents_recursive(
    url, lang, repo_name, base_path="", failed_repos=None
):
    """
    Recursively fetches contents of a GitHub directory and its subdirectories.
    """
    markdown_files = []

    try:
        logging.info(f"Fetching URL: {url}")
        response = requests.get(url)
        response.raise_for_status()
        contents = response.json()

        for item in contents:
            if item["type"] == "file" and item["name"].endswith(".md"):
                raw_url = item["download_url"]
                title = Path(item["path"]).stem.replace("_", " ").title()
                category_parts = Path(base_path, item["path"]).parts[:-1]
                markdown_files.append(
                    {
                        "url": raw_url,
                        "title": title,
                        "category": [repo_name] + list(category_parts)[1:],
                        "language": lang,
                    }
                )
                logging.info(f"Added file: {title}")
            elif item["type"] == "dir":
                markdown_files.extend(
                    fetch_github_contents_recursive(
                        item["url"],
                        lang,
                        repo_name,
                        base_path=Path(base_path, item["name"]),
                        failed_repos=failed_repos,
                    )
                )
    except requests.HTTPError as e:
        logging.error(f"HTTPError for URL {url}: {e}")
        if failed_repos is not None:
            failed_repos.append(url)
    except Exception as e:
        logging.error(f"Error fetching contents from {url}: {e}")
        if failed_repos is not None:
            failed_repos.append(url)

    return markdown_files


def get_repository_name_from_url(url):
    """
    Extracts the repository name from the GitHub URL.
    """
    try:
        path = urlparse(unquote(url)).path
        parts = path.split("/")
        if len(parts) >= 3 and parts[1] != "repos":
            # Typically the pattern is /username/repository/
            repo_name = parts[2]
            logging.info(f"Extracted repository name: {repo_name} from URL: {url}")
            return repo_name
        return None
    except Exception as e:
        logging.error(f"Error extracting repository name: {e}")
        return None


def process_links_for_language(url_set, lang, failed_repos):
    output = []
    for web_url in url_set:
        api_url = get_github_api_url(web_url)
        repo_name = get_repository_name_from_url(web_url)
        if repo_name:
            output.extend(
                fetch_github_contents_recursive(
                    api_url, lang, repo_name, failed_repos=failed_repos
                )
            )
    return output


def main(run_failed=False):
    output_list = []
    failed_repos = []

    if run_failed and Path(FAILED_FILE).exists():
        logging.info("Running previously failed URLs.")
        with Path(FAILED_FILE).open() as file:
            failed_repos = json.load(file)
        urls_to_process = [
            (failed_repos, PL_LANG if "PL" in repo else EN_LANG)
            for repo in failed_repos
        ]
    else:
        logging.info("Running all URLs.")
        urls_to_process = zip([PL_INPUT_URLS, EN_INPUT_URLS], [PL_LANG, EN_LANG])

    # Using ThreadPoolExecutor for multithreading
    with ThreadPoolExecutor() as executor:
        # Map the function to the url-language pairs
        results = executor.map(
            lambda pair: process_links_for_language(*pair, failed_repos),
            urls_to_process,
        )

        # Extend output list with results
        for result in results:
            output_list.extend(result)

    # Write to the output file
    with Path(OUTPUT_FILE).open("w") as file:
        json.dump(output_list, file, indent=4)
    logging.info(f"Successfully wrote output to {OUTPUT_FILE}")

    if failed_repos:
        with Path(FAILED_FILE).open("w") as file:
            json.dump(failed_repos, file, indent=4)
        logging.info(f"Failed URLs written to {FAILED_FILE}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Download markdown files from GitHub repositories."
    )
    parser.add_argument(
        "--run-failed", action="store_true", help="Run only previously failed URLs."
    )
    args = parser.parse_args()

    main(run_failed=args.run_failed)
