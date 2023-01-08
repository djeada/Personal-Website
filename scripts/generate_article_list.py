from pathlib import Path
from bs4 import BeautifulSoup
import string
import math

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
    title = file_path.stem.replace("_", " ").title()
    html = file_path.read_text()
    soup = BeautifulSoup(html, "html.parser")
    #'<p><i>This article is written in: {language}</i></p>'
    try:
        language = soup.find("p").text.split(":")[1].strip()
        return f"{title} {language}"
    except:
        return title


def get_article_description(article):
    """Get the description of the article"""
    soup = BeautifulSoup(article.read_text(), "html.parser")
    text = soup.find("p").text[:300]
    # if contains This article is written in: then look for the next paragraph
    if "This article is written in: " in text:
        text = soup.find_all("p")[1].text[:300]

    if not text:
        return "Description not found..."

    # check if ends in punctuation, if so remove the last character
    if text[-1] in string.punctuation:
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


def convert_list_to_html(article_list):
    """Get the html list of articles"""
    html = ""
    for article in article_list:
        title = get_article_title(article)
        description = get_article_description(article)
        url = "../articles/" + article.name
        html += get_article_list_element(title, description, url)

    list_structure = LIST_STRUCTURE.replace("...", html)
    return list_structure


def get_article_list_for_dir(dir_path):
    """Get the html list of articles for the given directory"""
    article_list = get_article_list(dir_path)
    return article_list


def find_article_list(html):
    """Pair of ints,first int <div class="article-list">, second int </div>"""
    soup = BeautifulSoup(html, "html.parser")
    div = soup.find("div", {"class": "article-list"})
    if div:
        start_index = html.find(str(div))
        end_index = start_index + len(str(div))
        return start_index, end_index
    return -1, -1


def get_nth_input_file(n):

    base_input_file = Path(INPUT_FILE)
    if n == 0:
        return base_input_file

    input_file = base_input_file.parent / (
        base_input_file.stem + f"_{n+1}" + base_input_file.suffix
    )
    if not input_file.exists():
        input_file.write_text(base_input_file.read_text())
    return input_file


def replace_pagination(html, link_name, current, n, article_list_len):
    """Replace the pagination with the correct one"""

    pagination = '<div class="pagination">'
    pagination += (
        f'<a href="{link_name}.html">1</a>'
        if current != 0
        else '<a class="active" href="#"><b>1</b></a>'
    )
    for i in range(1, math.ceil(article_list_len / n)):
        if i == current:
            pagination += (
                f'<a class="active" href="{link_name}_{i+1}.html"><b>{i+1}</b></a>'
            )
        else:
            pagination += f'<a href="{link_name}_{i+1}.html">{i+1}</a>'
    pagination += "</div>"
    # use beautiful soup to find the pagination
    soup = BeautifulSoup(html, "html.parser")
    div = soup.find("div", {"class": "pagination"})
    if div:
        return html.replace(str(div), pagination)
    return html


def main():
    """Main function"""
    n = 35
    article_list = get_article_list_for_dir(INPUT_DIR)

    # maximal n articles on the page

    for i in range(math.ceil(len(article_list) / n)):
        article_list_as_html = convert_list_to_html(article_list[i * n : (i + 1) * n])
        input_file = get_nth_input_file(i)
        html = input_file.read_text()
        html_as_list = html.splitlines()
        html_as_list = [line.strip() for line in html_as_list if line.strip()]
        html = "\n".join(html_as_list)

        start, end = find_article_list(html)
        if start != -1 and end != -1:
            html = html[:start] + article_list_as_html + html[end:]
            html = replace_pagination(html, "blog", i, n, len(article_list))
            input_file.write_text(html)


if __name__ == "__main__":
    main()
