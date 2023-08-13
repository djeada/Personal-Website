import re
from pathlib import Path
from bs4 import BeautifulSoup
import string
import math

INPUT_DIR = "../src/articles"
INPUT_FILE = "../src/pages/blog_1.html"
ARTICLE_PER_PAGE = 35


def get_subdirs(dir_path: Path) -> list:
    return [d for d in dir_path.iterdir() if d.is_dir()]


def get_article_list(dir_path: Path) -> list:
    return [file for file in dir_path.rglob("*.html") if file.is_file()]


def get_article_title(file_path: Path) -> str:
    title = file_path.stem.replace("_", " ").title()
    title = re.sub(r"^\d+", "", title)  # remove leading digits
    title = re.sub(
        r"\b([A-Z])\b", lambda m: m.group(1).lower(), title
    )  # make single-letter words lowercase

    with file_path.open() as file:
        soup = BeautifulSoup(file, "html.parser")
        language = soup.find("p").text.split(":")[1].strip()
        return f"{title} {language}" if language else title


def get_article_description(file_path: Path) -> str:
    with file_path.open() as file:
        soup = BeautifulSoup(file, "html.parser")
        description = soup.find("p").text[:300]
        if "This article is written in:" in description:
            description = soup.find_all("p")[1].text[:300]
        if description and description[-1] in string.punctuation:
            description = description[:-1]
        return description or "Description not found..."


def get_article_category(file_path: Path) -> str:
    return file_path.parent.stem.title().replace("_", " ")


def get_category_url(file_path: Path) -> str:
    return f"{file_path.parent.stem}.html"


def convert_articles_to_html(article_paths: list) -> str:
    html = ""
    for article in article_paths:
        title = get_article_title(article)
        description = get_article_description(article)
        category = get_article_category(article)
        url = "../articles" + str(article).split("/articles")[-1]
        category_url = get_category_url(article)
        html += f"""
        <div class="article-list-element">
            <h2><a href="{url}">{title}</a></h2>
            <div class="article-category">Category: <a href="{category_url}">{category}</a></div>
            <p><a href="{url}">{description}...</a></p>
        </div>
        """
    return f'<div class="article-list"><h1>Articles</h1>{html}</div>'


def get_pagination_html(link_name: str, current: int, total: int) -> str:
    pages = math.ceil(total / ARTICLE_PER_PAGE)
    pagination = ['<div class="pagination">']
    for i in range(pages):
        if i == current:
            pagination.append(
                f'<a class="active" href="{link_name}_{i + 1}.html"><b>{i + 1}</b></a>'
            )
        else:
            pagination.append(f'<a href="{link_name}_{i + 1}.html">{i + 1}</a>')
    pagination.append("</div>")
    return "".join(pagination)


def replace_content_in_html(html: str, content: str, class_type: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    div = soup.find("div", {"class": class_type})

    if div:
        div.clear()
        new_content = BeautifulSoup(content, "html.parser")
        for tag in reversed(new_content.contents):
            div.insert(0, tag)

    return str(soup)


def get_next_input_file(base_input_file: Path, index: int) -> Path:
    if index == 0:
        return base_input_file

    base_name = base_input_file.stem

    # Check if the base name already ends with a number
    if base_name[-2:] in ["_0", "_1"]:
        base_name = base_name[:-2]

    input_file = (
        base_input_file.parent / f"{base_name}_{index + 1}{base_input_file.suffix}"
    )
    if not input_file.exists():
        input_file.write_text(base_input_file.read_text())
    return input_file


def update_html_content(
    file: Path, articles_content: str, pagination_content: str
) -> None:
    """
    Updates the given file with the provided articles and pagination contents.
    """
    html = file.read_text()
    html = replace_content_in_html(html, articles_content, "article-list")
    html = replace_content_in_html(html, pagination_content, "pagination")
    file.write_text(html)


def generate_pages_for_articles(
    articles: list, base_input_file: Path, link_name: str
) -> None:
    """
    Generates pages for the provided list of articles.
    """
    for i in range(math.ceil(len(articles) / ARTICLE_PER_PAGE)):
        html_content = convert_articles_to_html(
            articles[i * ARTICLE_PER_PAGE : (i + 1) * ARTICLE_PER_PAGE]
        )
        input_file = get_next_input_file(base_input_file, i)
        pagination_content = get_pagination_html(link_name, i, len(articles))
        update_html_content(input_file, html_content, pagination_content)


def generate_pages_for_subdir(subdir: Path, output_file: Path):
    articles = get_article_list(subdir)
    articles = sorted(articles, key=lambda x: x.name)

    # Just one page for each subdir, so no need for pagination
    html_content = convert_articles_to_html(articles)

    # If the output file doesn't exist, create it by copying the INPUT_FILE
    if not output_file.exists():
        output_file.write_text(Path(INPUT_FILE).read_text())

    html_content = str(
        (
            lambda s: (
                s.find("h1")
                and setattr(
                    s.find("h1"), "string", subdir.name.replace("_", " ").title()
                )
            )
            or s
        )(BeautifulSoup(html_content, "html.parser"))
    )

    update_html_content(output_file, html_content, "")


def main():
    base_input_file = Path(INPUT_FILE)

    # Generate pages for the root INPUT_DIR
    articles = get_article_list(Path(INPUT_DIR))
    generate_pages_for_articles(articles, base_input_file, "blog")

    # Generate pages for each subdirectory
    subdirs = get_subdirs(Path(INPUT_DIR))
    for subdir in subdirs:
        generate_pages_for_subdir(
            subdir, base_input_file.parent / f"{subdir.stem}.html"
        )


if __name__ == "__main__":
    main()
