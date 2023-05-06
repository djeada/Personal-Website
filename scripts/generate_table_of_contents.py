import re
from bs4 import BeautifulSoup
from pathlib import Path

INPUT_ARTICLES_DIR = "../src/articles"


def slugify(text: str) -> str:
    return re.sub(r"\W+", "-", text.lower().strip())


def move_specific_section(soup: BeautifulSoup) -> None:

    language_section = soup.find("p", style="text-align: right;")
    toc_wrapper = soup.find("div", id="table-of-contents")

    if language_section and toc_wrapper:
        toc_wrapper.insert(0, language_section)


def generate_table_of_contents(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    body = soup.find("section", {"id": "article-body"})
    headers = body.find_all(["h1", "h2", "h3"])

    if not headers:
        return html

    toc = soup.new_tag("h2")
    toc.string = "Table of Contents"

    ol = soup.new_tag("ol")

    for header in headers:
        header_id = slugify(header.text)
        header["id"] = header_id

        li = soup.new_tag("li")
        a = soup.new_tag("a", href=f"#{header_id}")
        a.string = header.text
        li.append(a)
        ol.append(li)

    toc_wrapper = soup.new_tag("div", id="table-of-contents")
    toc_wrapper.append(toc)
    toc_wrapper.append(ol)

    move_specific_section(
        soup
    )  # Move the language section before generating the article wrapper

    article_wrapper = soup.new_tag("div", id="article-wrapper")

    # Create a copy of the original article body
    article_body_copy = soup.new_tag("section", id="article-body")
    article_body_copy.extend(body.contents)

    # Add the copied article body and table of contents to the article wrapper
    article_wrapper.append(article_body_copy)
    article_wrapper.append(toc_wrapper)

    # Find the footer and insert the article wrapper above it
    footer = soup.find("footer")
    try:
        footer.insert_before(article_wrapper)
    except:
        pass

    return str(soup)


def main():
    for file in Path(INPUT_ARTICLES_DIR).glob("*.html"):
        html = Path(file).read_text()
        html_with_toc = generate_table_of_contents(html)
        Path(file).write_text(html_with_toc)


if __name__ == "__main__":
    main()
