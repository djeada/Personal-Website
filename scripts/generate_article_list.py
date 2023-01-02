from pathlib import Path
from bs4 import BeautifulSoup

INPUT_DIR = "../src/articles"
INPUT_FILE = "../src/core/blog.html"

LIST_STRUCTURE = """
<div class="article-list">
        <h1>Articles </h1>

        ...
    </div>
"""

ARTICLE_TITLE = "ARTICLE TITLE"
ARTICLE_DESCRIPTION = "ARTICLE DESCRIPTION"
ARTICLE_URL = "ARTICLE URL"

ARTICLE_LIST_ELEMENT = f"""
 <a href="{ARTICLE_URL}">
            <div class="article-list-element">

                <h2>{ARTICLE_TITLE}</h2>
                <p>{ARTICLE_DESCRIPTION}...</p>

            </div>
        </a>
"""


def get_article_list(dir_path):
    """Get the list of articles in the directory"""
    return [
        file
        for file in Path(dir_path).iterdir()
        if file.is_file() and file.suffix == ".html"
    ]


def get_article_title(file_path):
    """Get the title of the article"""
    return file_path.stem.replace("_", " ").title()


def get_article_description(article):
    """Get the description of the article"""
    soup = BeautifulSoup(article.read_text(), "html.parser")
    text = soup.find("p").text[:300]
    # check if ends in punctuation, if so remove the last character
    if text[-1] in [".", "!", "?"]:
        text = text[:-1]
    return text


def get_article_list_element(title, description, url):
    """Get the html list element for the article"""
    aritcle_list_element = ARTICLE_LIST_ELEMENT
    aritcle_list_element = aritcle_list_element.replace(ARTICLE_TITLE, title)
    aritcle_list_element = aritcle_list_element.replace(
        ARTICLE_DESCRIPTION, description
    )
    aritcle_list_element = aritcle_list_element.replace(ARTICLE_URL, url)
    return aritcle_list_element


def get_article_list_html(article_list):
    """Get the html list of articles"""
    html = ""
    for article in article_list:
        title = get_article_title(article)
        description = get_article_description(article)
        url = "../articles/" + article.name
        html += get_article_list_element(title, description, url)
    return html


def get_article_list_for_dir(dir_path):
    """Get the html list of articles for the given directory"""
    article_list = get_article_list(dir_path)
    return get_article_list_html(article_list)


def find_article_list(html):
    """Pair of ints,first int <div class="article-list">, second int </div>"""
    soup = BeautifulSoup(html, "html.parser")
    div = soup.find("div", {"class": "article-list"})
    if div:
        return html.index(str(div)), html.index(str(div)) + len(str(div))
    return -1, -1


def main():
    """Main function"""
    article_list = get_article_list_for_dir(INPUT_DIR)
    list_structure = LIST_STRUCTURE.replace("...", article_list)

    input_file = Path(INPUT_FILE)
    html = input_file.read_text()
    html_as_list = html.splitlines()
    html_as_list = [line.strip() for line in html_as_list if line.strip()]
    html = "\n".join(html_as_list)

    start, end = find_article_list(html)
    if start != -1 and end != -1:
        html = html[:start] + list_structure + html[end:]
        input_file.write_text(html)


if __name__ == "__main__":
    main()
