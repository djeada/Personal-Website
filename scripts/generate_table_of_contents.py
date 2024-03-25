"""
Generates a table of contents for each article post.
"""
import copy
import re
from concurrent.futures import ThreadPoolExecutor

from bs4 import BeautifulSoup, Tag
from pathlib import Path

INPUT_ARTICLES_DIR = Path("../src/articles")


def slugify(text: str) -> str:
    """Convert text into a URL-friendly slug."""
    return re.sub(r"\W+", "-", text.lower().strip())


def move_specific_section(soup: BeautifulSoup) -> None:
    """Move a specific section based on the given criteria."""
    language_section = soup.find("p", style="text-align: right;")
    toc_wrapper = soup.find("div", id="table-of-contents")

    if language_section and toc_wrapper:
        toc_wrapper.insert(0, language_section)


def create_toc_entries(soup: BeautifulSoup) -> Tag:
    """Generate ordered list of table of contents based on headers."""
    body = soup.find("section", {"id": "article-body"})
    headers = body.find_all(["h1", "h2", "h3", "h4"])

    # Initial root ordered list
    root_ol = soup.new_tag("ol")

    # A stack to manage the nested ordered lists based on the header levels
    ol_stack = [root_ol]
    level_mapping = {}

    for header in headers:
        current_level = int(header.name[1])

        if current_level not in level_mapping:
            level_mapping[current_level] = len(level_mapping) + 1

        mapped_level = level_mapping[current_level]

        header_id = slugify(header.text)
        header["id"] = header_id

        li = soup.new_tag("li")
        a = soup.new_tag("a", href=f"#{header_id}")
        a.string = header.text
        li.append(a)

        # If current level is deeper than the last, create and nest a new ordered list
        while mapped_level > len(ol_stack):
            new_ol = soup.new_tag("ol")
            if ol_stack[-1].contents:
                ol_stack[-1].contents[-1].append(new_ol)
            else:
                ol_stack[-1].append(new_ol)
            ol_stack.append(new_ol)

        # If current level is shallower or equal to the last, pop from the stack to ascend the hierarchy
        while mapped_level < len(ol_stack):
            ol_stack.pop()

        ol_stack[-1].append(li)

    return root_ol


def process_nested_list(tag):
    """
    Check a bs4 Tag (expected to be an ol or ul) for nested lists.
    If the outer list has only one item, the outer list tags are removed.
    """
    if tag.name in ["ol", "ul"] and len(tag.find_all("li", recursive=False)) == 1:
        tag.li.unwrap()  # Removes the surrounding <ol> or <ul> tags, leaving the <li> contents

    return tag


def create_toc_wrapper(soup: BeautifulSoup, html: str) -> Tag:
    """Create a wrapper for the table of contents."""
    toc_title = "Table of Contents" if "🇵🇱" not in html else "Spis Treści"

    toc_header = soup.new_tag("h2")
    toc_header.string = toc_title

    toc_wrapper = soup.new_tag("div", id="table-of-contents")
    try:
        toc_wrapper.extend([toc_header, process_nested_list(create_toc_entries(soup))])
    except Exception as e:
        pass
    return toc_wrapper


def wrap_article_and_toc(soup: BeautifulSoup, toc_wrapper: Tag) -> None:
    """Wrap the article and table of contents in a common wrapper."""
    article_wrapper = soup.new_tag("div", id="article-wrapper")

    article_body_copy = soup.new_tag("section", id="article-body")
    article_body_copy.extend(soup.find("section", {"id": "article-body"}).contents)

    article_wrapper.extend([article_body_copy, toc_wrapper])

    footer = soup.find("footer")
    if footer:
        footer.insert_before(article_wrapper)


def generate_table_of_contents(html: str) -> str:
    """Generate the table of contents for a given HTML."""
    soup = BeautifulSoup(html, "html.parser")

    # If no headers, return the original html
    if not soup.find("section", {"id": "article-body"}).find_all(["h1", "h2", "h3"]):
        return html

    toc_wrapper = create_toc_wrapper(soup, html)

    move_specific_section(soup)  # Reorder sections if needed

    wrap_article_and_toc(soup, toc_wrapper)

    return str(soup)


def process_html_file(file):
    html = file.read_text()
    html_with_toc = generate_table_of_contents(html)
    file.write_text(html_with_toc)


def main():
    with ThreadPoolExecutor() as executor:
        files = list(INPUT_ARTICLES_DIR.rglob("*.html"))
        executor.map(process_html_file, files)


if __name__ == "__main__":
    main()
