import re
from concurrent.futures import ThreadPoolExecutor
from math import log2

from bs4 import BeautifulSoup, Tag
from pathlib import Path

INPUT_ARTICLES_DIR = Path("../src/articles")
LOWERCASE_WORDS = [
    "a",
    "vs",
    "of",
    "to",
    "an",
    "the",
    "and",
    "or",
    "in",
    "on",
    "at",
    "for",
    "with",
    "z",
    "i",
    "o",
    "do",
    "oraz",
    "wraz",
    "w",
]
from collections import defaultdict


def create_article_links(
    soup: BeautifulSoup, articles_in_dir, root=INPUT_ARTICLES_DIR
) -> Tag:
    """Generate ordered list of article links in the directory."""
    root_ol = soup.new_tag("ol")
    articles_tree = build_articles_tree(articles_in_dir, root)

    populate_ol_with_tree(soup, root_ol, articles_tree)

    return root_ol


def build_articles_tree(articles_in_dir, root):
    def recursive_defaultdict():
        return defaultdict(recursive_defaultdict, __files__=[])

    articles_tree = recursive_defaultdict()

    for article in articles_in_dir:
        relative_path = article.relative_to(root)
        current_node = articles_tree
        for part in relative_path.parts[1:-1]:
            current_node = current_node[part]
        current_node["__files__"].append(article)

    return articles_tree


def populate_ol_with_tree(soup, ol_tag, articles_tree, path_parts=[]):
    def beautify(string: str) -> str:
        string = string.replace("_", " ").title()
        string = re.sub(r"^\d+", "", string)
        string = re.sub(r"[^a-zA-Z0-9./\s+]", "_", string.strip())

        def lowercase_match(match):
            word = match.group(0)
            return word.lower() if word.lower() in LOWERCASE_WORDS else word

        string = re.sub(r"\b[A-Za-z]+\b", lowercase_match, string)
        return string

    for key, value in articles_tree.items():
        li = soup.new_tag("li")

        if key == "__files__":
            for file in value:
                file_li = soup.new_tag("li")
                relative_path_parts = path_parts + [file.name]
                relative_path = "/".join(relative_path_parts)
                href = f"https://adamdjellouli.com/articles/{value[0].parts[3]}/{relative_path}"
                a = soup.new_tag("a", href=href)
                a.string = beautify(file.stem)
                file_li.append(a)
                ol_tag.append(file_li)
        else:

            li.string = beautify(key)
            sub_ol = soup.new_tag("ol")
            new_path_parts = path_parts + [key]
            populate_ol_with_tree(soup, sub_ol, value, path_parts=new_path_parts)
            li.append(sub_ol)
            ol_tag.append(li)


def create_articles_wrapper(soup: BeautifulSoup, articles_in_dir) -> Tag:
    """Create a wrapper for the list of articles."""
    articles_title = "Related Articles"

    articles_header = soup.new_tag("h2")
    articles_header.string = articles_title

    articles_wrapper = soup.new_tag("div", id="related-articles")
    articles_wrapper.extend(
        [articles_header, create_article_links(soup, articles_in_dir)]
    )
    return articles_wrapper


def wrap_article_and_related_articles(
    soup: BeautifulSoup, articles_wrapper: Tag
) -> None:
    """Insert the related articles into the existing table-of-contents div."""
    table_of_contents = soup.find("div", {"id": "table-of-contents"})
    if table_of_contents:
        table_of_contents.append(articles_wrapper)
    else:
        print(
            "Warning: 'table-of-contents' div not found. No changes made to the HTML."
        )


def generate_related_articles(html: str, articles_in_dir) -> str:
    """Generate the list of related articles for a given HTML."""
    soup = BeautifulSoup(html, "html.parser")

    articles_wrapper = create_articles_wrapper(soup, articles_in_dir)

    wrap_article_and_related_articles(soup, articles_wrapper)

    return str(soup)


def process_file(file, articles_in_dir):
    html = file.read_text()
    html_with_related_articles = generate_related_articles(html, articles_in_dir)
    file.write_text(html_with_related_articles)


def main():
    for subdir in INPUT_ARTICLES_DIR.iterdir():
        if subdir.is_dir():
            articles_in_dir = sorted(
                list(subdir.rglob("*.html")), key=lambda x: x.parent.name + x.name
            )
            with ThreadPoolExecutor() as executor:

                executor.map(
                    process_file,
                    articles_in_dir,
                    [articles_in_dir] * len(articles_in_dir),
                )


if __name__ == "__main__":
    main()
