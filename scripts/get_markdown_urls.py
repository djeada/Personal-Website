import requests
from bs4 import BeautifulSoup
from pathlib import Path

INPUT_URLS = ["https://github.com/djeada/Kurs-Podstaw-Pythona/tree/master/notatki/01_podstawy",
"https://github.com/djeada/Kurs-Podstaw-Pythona/tree/master/notatki/02_sredniozawansowane",
"https://github.com/djeada/Kurs-Podstaw-Pythona/tree/master/notatki/03_inzynieria_oprogramowania",
"https://github.com/djeada/Kurs-Podstaw-Pythona/tree/master/notatki/04_python_w_praktyce",
"https://github.com/djeada/Kurs-Podstaw-Pythona/tree/master/notatki/05_prezentacje",
]
OUTPUT_FILE = "input.txt"


def get_links(url):
    # Make a GET request to the website
    response = requests.get(url)

    # Parse the HTML content of the page
    soup = BeautifulSoup(response.content, "html.parser")

    # Find all the links in the page
    links = soup.find_all("a")

    # get only the relevant part
    links = [link.get("href") for link in links]

    # we care only about the links that have the .md extension
    links = [link for link in links if link.endswith(".md")]
    return links


def convert_link_to_raw(link):
    prefix = "https://raw.githubusercontent.com"
    link = prefix + link
    link = link.replace("/blob/", "/")
    return link


def get_title_from_link(link):
    return link.split("/")[-1].replace(".md", "").title()


def main():
    output = ""

    for INPUT_URL in INPUT_URLS:
        links = get_links(INPUT_URL)
        for link in links:
            link = convert_link_to_raw(link)
            title = get_title_from_link(link)
            print(f"Processing link: [{title}]({link})")
            output += f"{link} {title}\n"

    Path(OUTPUT_FILE).write_text(output)


if __name__ == "__main__":
    main()
