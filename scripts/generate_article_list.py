import datetime
import logging
import multiprocessing
import random
import re
from pathlib import Path
from typing import List, Tuple, Optional

import requests
from bs4 import BeautifulSoup
import string
import math

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
START_DATE = None
# START_DATE = datetime.datetime(2018, 1, 1)
INPUT_DIR = "../src/articles"
INPUT_FILE = "../src/articles/blog_1.html"
ARTICLE_PER_PAGE = 35
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


def get_subdirs(dir_path: Path) -> list:
    return [d for d in dir_path.iterdir() if d.is_dir()]


def get_article_list(dir_path: Path) -> list:
    return [
        file
        for file in dir_path.rglob("*.html")
        if file.is_file()
        and not file.name.lower().startswith("blog_")
        and file.parent != dir_path
    ]


def get_article_title(file_path: Path) -> str:
    # Extract the title from the file name
    title = file_path.stem.replace("_", " ").title()
    title = re.sub(r"^\d+", "", title)  # Remove leading digits
    title = re.sub(r"[^a-zA-Z0-9./\s+]", "_", title.strip())

    # Function to make specific words lowercase
    def lowercase_match(match):
        word = match.group(0)
        return word.lower() if word.lower() in LOWERCASE_WORDS else word

    title = re.sub(r"\b[A-Za-z]+\b", lowercase_match, title)

    # Read and parse the file to extract the language
    try:
        with file_path.open() as file:
            soup = BeautifulSoup(file, "html.parser")
            paragraphs = soup.find_all("p")
            if len(paragraphs) > 1:
                try:
                    language = paragraphs[1].text.split(":")[1].strip()
                except (IndexError, AttributeError):
                    logging.exception("Error processing file: %s", file_path)
                    language = ""
            else:
                language = ""
    except Exception as e:
        logging.exception("Error opening or parsing file: %s", file_path)
        language = ""

    # Append the language to the title if it exists
    return f"{title} {language}" if language else title


def get_article_description(file_path: Path) -> str:
    with file_path.open() as file:
        soup = BeautifulSoup(file, "html.parser")
        paragraphs = soup.find_all("p")

        for paragraph in paragraphs:
            description = paragraph.text[:300]
            if (
                "This article is written in:" not in description
                and "Last modified:" not in description
            ):
                if description and description[-1] in string.punctuation:
                    description = description[:-1]
                return description

        return "Description not found..."


def get_article_category(file_path: Path) -> str:
    # Get the absolute path of the file
    absolute_path = file_path.absolute()

    # Get the absolute path of the input directory
    input_dir_absolute = Path(INPUT_DIR).absolute()

    # Get the relative path from the input directory to the file
    relative_path = absolute_path.relative_to(input_dir_absolute)

    while relative_path.parent.parent != Path():
        relative_path = relative_path.parent

    # Extract the parent directory's name
    category_name = relative_path.parent.stem

    # Convert to title case and replace underscores with spaces
    formatted_category_name = category_name.title().replace("_", " ")

    return formatted_category_name


def get_category_url(file_path: Path) -> str:
    # Get the absolute path of the file
    absolute_path = file_path.absolute()

    # Get the absolute path of the input directory
    input_dir_absolute = Path(INPUT_DIR).absolute()

    # Get the relative path from the input directory to the file
    relative_path = absolute_path.relative_to(input_dir_absolute)

    while relative_path.parent.parent != Path():
        relative_path = relative_path.parent

    return f"{relative_path.parent.stem}.html"


def get_current_date(
    file_path: Path, start_date: Optional[datetime.datetime] = None
) -> datetime.datetime:
    remote_date = None
    # ——— Random-date branch ———
    if start_date is not None:
        now = datetime.datetime.now()
        if start_date > now:
            raise ValueError("start_date cannot be in the future")
        # Compute a random offset in seconds
        delta_secs = (now - start_date).total_seconds()
        rand_offset = random.uniform(0, delta_secs)
        rand_date = start_date + datetime.timedelta(seconds=rand_offset)

        # Read local HTML and replace the Last modified date
        html = file_path.read_text(encoding="utf-8")
        new_html = re.sub(
            r"Last modified: \w+ \d+, \d+",
            f"Last modified: {rand_date.strftime('%B %d, %Y')}",
            html,
        )
        file_path.write_text(new_html, encoding="utf-8")
        logging.info(f"Set random date for {file_path}: {rand_date}")
        return rand_date

    # ——— Original fetch-and-compare logic ———
    try:
        # Build URL
        relative = file_path.relative_to("../src").with_suffix("")
        url = f"https://adamdjellouli.com/{relative}"

        resp = requests.get(url)
        resp.raise_for_status()
        remote_soup = BeautifulSoup(resp.text, "html.parser")
        remote_sec = remote_soup.find(id="article-body")
        if remote_sec is None:
            logging.error(f"{url}: 'article-body' not found.")
            return datetime.datetime.now()

        # Read local HTML
        html = file_path.read_text(encoding="utf-8")
        local_soup = BeautifulSoup(html, "html.parser")
        local_sec = local_soup.find(id="article-body")
        if local_sec is None:
            logging.error(f"{file_path}: 'article-body' not found locally.")
            return datetime.datetime.now()

        # Helper to extract the last-modified date
        def extract_date(soup_obj):
            p = soup_obj.find("p", style="text-align: right;")
            if not p:
                return None
            m = re.search(r"Last modified: (\w+ \d+, \d+)", p.get_text())
            return datetime.datetime.strptime(m.group(1), "%B %d, %Y") if m else None

        remote_date = extract_date(remote_soup)
        local_date = extract_date(local_soup)

        # Strip the date paragraph before comparing content
        def strip_date(html_str):
            # Parse the HTML fragment
            soup = BeautifulSoup(html_str, "html.parser")

            # Remove all <div class="article-action-buttons"> blocks
            for div in soup.select("div.article-action-buttons"):
                div.decompose()

            # Remove any <p> whose text starts with the unwanted metadata prefixes
            for p in soup.find_all("p"):
                text = p.get_text(strip=True)
                if re.match(r"^(Last modified:|This article is written in:)", text):
                    p.decompose()

            # Return the remaining HTML as a string (concatenate top-level nodes)
            return "".join(str(elem) for elem in soup.contents).strip()

        if strip_date(remote_sec.decode_contents()) == strip_date(
            local_sec.decode_contents()
        ):
            if remote_date:
                # Update the local file's date
                updated_html = re.sub(
                    r"Last modified: \w+ \d+, \d+",
                    f"Last modified: {remote_date.strftime('%B %d, %Y')}",
                    html,
                )
                file_path.write_text(updated_html, encoding="utf-8")
                logging.info(f"Updated date for {file_path}")
                return remote_date

        # Fallback to the local date if it exists
        if local_date:
            return local_date

        logging.error(f"{url}: date not found or content mismatch.")
        return datetime.datetime.now()

    except requests.RequestException as e:
        logging.error(f"Error fetching {url}: {e}")
        return datetime.datetime.now() if not remote_date else remote_date
    except Exception as e:
        logging.error(f"Error processing {file_path}: {e}")
        return datetime.datetime.now() if not remote_date else remote_date


def generate_pages_for_articles(
    articles: List[str], base_input_file: Path, link_name: str
) -> None:
    """
    Generates pages for the provided list of articles.
    """
    # Extract information (including date) for each article
    with multiprocessing.Pool() as pool:
        articles_info = pool.map(_extract_article_info, articles)

    # Sort articles by date
    sorted_articles_info = sorted(articles_info, key=lambda x: x[1], reverse=True)

    for i in range(math.ceil(len(sorted_articles_info) / ARTICLE_PER_PAGE)):
        page_articles_info = sorted_articles_info[
            i * ARTICLE_PER_PAGE : (i + 1) * ARTICLE_PER_PAGE
        ]
        html_content = convert_articles_to_html(page_articles_info)
        input_file = get_next_input_file(base_input_file, i)
        pagination_content = get_pagination_html(
            link_name, i, len(sorted_articles_info)
        )
        update_html_content(input_file, html_content, pagination_content)


def _extract_article_info(article: str) -> Tuple[str, str]:
    """
    Extracts the necessary information from an article, including the date.
    Returns a tuple containing the article path and its date.
    """
    current_date = get_current_date(article, START_DATE)
    return (article, current_date)


def _process_article(article_info: Tuple[str, str]) -> str:
    article, current_date = article_info
    formatted_date = current_date.strftime("%B %d, %Y")
    title = get_article_title(article)
    description = get_article_description(article)
    category = get_article_category(article)
    url = "../articles" + str(article).split("/articles")[-1]
    category_url = get_category_url(article)
    return f"""
        <div class="article-list-element">
            <h2><a href="{url}">{title}</a></h2>
            <div class="article-date">{formatted_date}</div>
            <div class="article-category">Category: <a href="{category_url}">{category}</a></div>
            <p><a href="{url}">{description}...</a></p>
        </div>
        """


def convert_articles_to_html(article_infos: List[Tuple[str, str]]) -> str:
    with multiprocessing.Pool() as pool:
        articles_html = pool.map(_process_article, article_infos)

    html = "".join(articles_html)
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


def generate_pages_for_subdir(subdir: Path, output_file: Path):
    articles = []
    date_pattern = re.compile(
        r'<p style="text-align: right;"><i>Last modified: (.*?)</i></p>'
    )

    for file in subdir.rglob("*.html"):
        if file.is_file():
            with file.open("r", encoding="utf-8") as f:
                content = f.read()
                match = date_pattern.search(content)
                if match:
                    last_modified_date = match.group(1)
                    articles.append(
                        (
                            file,
                            datetime.datetime.strptime(last_modified_date, "%B %d, %Y"),
                        )
                    )

    articles = sorted(articles, key=lambda x: x[1], reverse=True)

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
    # print('result',
    #   get_current_date(
    #       file_path=Path("../src/articles/git_notes/07_stashing_files.html")
    #   )
    # )
