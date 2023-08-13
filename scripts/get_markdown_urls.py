"""
Downloads markdown files.
"""
import json

import requests
from pathlib import Path

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
    "https://github.com/djeada/Statistics-Notes/tree/main/notes/time_series_analysis",
    "https://github.com/djeada/NumPy-Tutorials/tree/main/notes",
]

EN_LANG = "🇺🇸"
PL_LANG = "🇵🇱"
OUTPUT_FILE = "input.txt"
RAW_PREFIX = "https://raw.githubusercontent.com"
BLOB_STRING = "/blob/"


def fetch_website_content(url):
    response = requests.get(url)
    response.raise_for_status()
    return response.content


def extract_links_from_content(content):
    if isinstance(content, bytes):
        content = content.decode("utf-8")
    data = json.loads(content)
    items = data.get("payload", {}).get("tree", {}).get("items", [])

    links = [item["path"] for item in items if item.get("contentType") == "file"]
    return links


def convert_link_to_raw_github(base_url, link):
    # Replace the standard GitHub URL prefix with the raw content prefix
    raw_base_url = base_url.replace(
        "https://github.com/", "https://raw.githubusercontent.com/"
    )

    # Split on "/tree/"
    parts = raw_base_url.split("/tree/")

    # Extract the branch name by splitting on the first "/"
    branch_name = parts[1].split("/")[0]

    # Recombine to get the new raw base URL
    raw_base_url = f"{parts[0]}/{branch_name}"

    # Combine the modified base URL with the link
    raw_url = f"{raw_base_url}/{link}"

    return raw_url


def extract_title_from_link(link):
    title = (
        link.split("/")[-1]
        .replace(".md", "")
        .replace("_", " ")
        .title()
        .replace(" ", "")
    )
    return title


def extract_category_from_link(base_url, link):
    category = base_url.split("/tree")[0].split("/")[-1] + "::" + link.split("/")[-2]
    return category


def process_links_for_language(url_set, lang):
    output = []
    for url in url_set:
        content = fetch_website_content(url)
        links = extract_links_from_content(content)
        for link in links:
            raw_link = convert_link_to_raw_github(url, link)
            title = extract_title_from_link(link)
            category = extract_category_from_link(url, link)
            print(f"Processing link: [{title}]({raw_link})")
            output.append(f"{raw_link} {title} CATEGORY:{category} {lang}")
    return output


def main():

    output_list = []
    for url_set, lang in zip([PL_INPUT_URLS, EN_INPUT_URLS], [PL_LANG, EN_LANG]):
        output_list.extend(process_links_for_language(url_set, lang))

    with Path(OUTPUT_FILE).open("w") as file:
        file.write("\n".join(output_list))


if __name__ == "__main__":
    main()
