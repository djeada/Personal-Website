import re

from bs4 import BeautifulSoup, Tag
from pathlib import Path

INPUT_ARTICLES_DIR = Path("../src/articles")


def create_article_links(soup: BeautifulSoup, articles_in_dir) -> Tag:
    """Generate ordered list of article links in the directory."""
    root_ol = soup.new_tag("ol")

    for article in articles_in_dir:
        li = soup.new_tag("li")
        a = soup.new_tag("a", href=f"./{article.name}")
        title = article.stem.replace("_", " ").title()
        title = re.sub(r"^\d+", "", title)  # remove leading digits
        title = re.sub(
            r"\b([A-Z])\b", lambda m: m.group(1).lower(), title
        )  # make single-letter words lowercase
        a.string = title
        li.append(a)
        root_ol.append(li)

    return root_ol


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
    """Wrap the article and related articles in a common wrapper."""
    article_wrapper = soup.new_tag("div", id="article-wrapper")

    article_body_copy = soup.new_tag("section", id="article-body")
    article_body_copy.extend(soup.find("section", {"id": "article-body"}).contents)

    article_wrapper.extend([article_body_copy, articles_wrapper])

    footer = soup.find("footer")
    if footer:
        footer.insert_before(article_wrapper)


def generate_related_articles(html: str, articles_in_dir) -> str:
    """Generate the list of related articles for a given HTML."""
    soup = BeautifulSoup(html, "html.parser")

    articles_wrapper = create_articles_wrapper(soup, articles_in_dir)

    wrap_article_and_related_articles(soup, articles_wrapper)

    return str(soup)


def main():
    """Main function to process all articles."""
    for file in INPUT_ARTICLES_DIR.rglob("*.html"):
        articles_in_dir = list(file.parent.glob("*.html"))
        html = file.read_text()
        html_with_related_articles = generate_related_articles(html, articles_in_dir)
        file.write_text(html_with_related_articles)


if __name__ == "__main__":
    main()
