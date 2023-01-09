import requests
import markdown
import markdownify
import re
from pathlib import Path
from dataclasses import dataclass

from bs4 import BeautifulSoup

PATH_TO_CONFIG = "input.txt"
OUTPUT_DIR = "../src/articles"


@dataclass
class UrlData:
    url: str
    output_name: str
    language: str = "🇺🇸"  # "🇵🇱"

    def language_as_string(self):
        if self.language == "🇵🇱":
            return "pl"
        return "en"


def read_urls():
    # Open the input file
    input_path = Path(PATH_TO_CONFIG)
    urls = input_path.read_text().splitlines()
    urls = [url.strip() for url in urls]
    urls = [UrlData(url.split()[0], url.split()[1], url.split()[2]) for url in urls]
    return urls


def markdown_to_html_table(markdown_table: str) -> str:
    rows = markdown_table.split("\n")
    rows = [row[1:] if row.startswith("|") else row for row in rows]
    rows = [row[:-1] if row.endswith("|") else row for row in rows]
    rows = [row.split("|") for row in rows]
    # if there is a row that mathces ' -- | -- ' then it should be removed
    rows = [
        row
        for row in rows
        if not all([re.match(r"\s*-+\s*", cell) or not cell.strip() for cell in row])
    ]
    rows = [[cell.strip() for cell in row] for row in rows]
    html_table = "<table>"
    for row in rows:
        html_table += "<tr>"
        for cell in row:
            html_table += f"<td>{cell}</td>"
        html_table += "</tr>"
    html_table += "</table>"
    html_table = "\n" + html_table + "\n"
    return html_table


def replace_all_tables(html: str) -> str:
    # find all tables, every table starts with <p>| (there could be a space before the |) and ends with </p>
    table_start_pattern = re.compile(r"<p>\s*\|")
    table_end_pattern = re.compile(r"</p>")
    table_start_match = table_start_pattern.search(html)
    while table_start_match is not None:
        table_end_match = table_end_pattern.search(html, table_start_match.end())
        start = table_start_match.start() + len("<p>")
        end = table_end_match.start()
        table = html[start:end]
        html = html[:start] + markdown_to_html_table(table) + html[end:]
        table_start_match = table_start_pattern.search(html, table_end_match.end())
    return html


def strip_html(html: str) -> str:

    html = re.sub("<h1>", "# ", html)
    # strip opening and closing tags
    html = re.sub(r"<[^>]*>", "", html)

    return html


def apply_prism_for_code_samples(html: str) -> str:

    # find where the code samples start and end, they are represented by ``` and ```
    code_start_pattern = re.compile(r"```")
    code_start_match = code_start_pattern.search(html)
    while code_start_match is not None:
        code_end_match = code_start_pattern.search(html, code_start_match.end())
        if code_end_match is None:
            break
        start = code_start_match.start()
        end = code_end_match.end()
        code_sample = html[start:end]
        # code_sample = strip_html(code_sample)
        # check if there is language specified
        language = re.match(r"```(\w+)", code_sample)
        if language is None:
            language = "shell"
        else:
            language = language.group(1)
        code_sample = re.sub(r"`{3,}(\w+)?", "", code_sample).strip()
        code_sample = strip_html(code_sample)
        code_sample = re.sub(r"\n@", "\n\n@", code_sample)
        code_sample = re.sub(r"def init\(", "def __init__(", code_sample)
        while "\n\n\n" in code_sample:
            code_sample = code_sample.replace("\n\n\n", "\n\n")
        # if first line is empty, remove it
        if code_sample.startswith("\n"):
            code_sample = code_sample[1:]
        html = (
            html[:start]
            + f'<div><pre><code class="language-{language}">{code_sample}</code></pre></div>'
            + html[end:]
        )
        code_start_match = code_start_pattern.search(html, code_end_match.end())
    return html


def replace_code_tags(html):
    # Find all code tags that span multiple lines there must be at least two time \n in the content
    regex = r"<code>((?:(?!<code>|</code>).)+\n(?:(?!<code>|</code>).)+)</code>"
    matches = re.finditer(regex, html, re.DOTALL)
    for match in matches:
        # Extract the content between the code tags
        content = match.group().replace("<code>", "").replace("</code>", "")
        # Replace the code tags with backticks
        html = html.replace(match.group(), f"```{content}```")
    return html


def correct_image_sources(html: str) -> str:

    # find all images
    soup = BeautifulSoup(html, "html.parser")
    images = soup.find_all("img")
    for image in images:
        src = image["src"]
        if src.startswith("https://github.com"):
            src = src.replace("https://github.com", "https://raw.githubusercontent.com")
            src = src.replace("/blob/", "/")
            image["src"] = src
    return str(soup)


def correct_math_blocks(html: str) -> str:
    # math bloks are defined by $$ and $$,
    # find the blocks, and then // inside the blocks and replace them with ///

    # find all math blocks
    math_start_pattern = re.compile(r"\$\$")
    math_start_match = math_start_pattern.search(html)
    while math_start_match is not None:
        math_end_match = math_start_pattern.search(html, math_start_match.end())
        if math_end_match is None:
            break
        start = math_start_match.start()
        end = math_end_match.end()
        math_block = html[start:end]
        math_block = math_block.replace("\\\n", "\\\\\n")
        html = html[:start] + math_block + html[end:]
        math_start_match = math_start_pattern.search(html, start + len(math_block) + 1)
    return html


def apply_filters(html, lang="en"):

    # replace all tables
    html = replace_all_tables(html)

    # correct image sources
    html = correct_image_sources(html)

    # apply prism for code samples
    html = apply_prism_for_code_samples(html)
    html = replace_code_tags(html)
    html = apply_prism_for_code_samples(html)

    # correct math blocks
    html = correct_math_blocks(html)

    # if no body tag, add one at the beginning of the file and at the end
    if "<body>" not in html:
        html = "\n<body>\n" + html + "\n</body>\n"

    # if no head tag, add one at the beginning of the file and at the end
    if "<head>" not in html:
        html = "\n<head>\n\n</head>\n" + html

    # if no <!DOCTYPE html> <html lang="en"> add one at the beginning of the file and at the end
    if "<!DOCTYPE html>" not in html:
        html = f'\n<!DOCTYPE html>\n<html lang="{lang}">\n' + html + "\n</html>\n"

    # put everything inside the body tag in a div in <section id="article"> </section>
    body_start = html.find("<body>")
    body_end = html.find("</body>")
    body = html[body_start + 6 : body_end]
    html = (
        html[: body_start + 6]
        + f'\n<section id="article-body">\n{body}\n</section>\n'
        + html[body_end:]
    )

    html += '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/prism.min.js"></script>\n'
    html += '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/components/prism-python.min.js"></script>\n'

    html += '\n<script type="text/x-mathjax-config">\n'
    html += "MathJax.Hub.Config({\n"
    html += 'jax: ["input/TeX", "output/HTML-CSS"],\n'
    html += 'extensions: ["tex2jax.js"],\n'
    html += '"HTML-CSS": { preferredFont: "TeX", availableFonts: ["STIX","TeX"] },\n'
    html += 'tex2jax: { inlineMath: [ ["$", "$"] ], displayMath: [ ["$$","$$"] ], processEscapes: true, ignoreClass: "tex2jax_ignore|dno" },\n'
    html += 'TeX: { noUndefined: { attributes: { mathcolor: "red", mathbackground: "#FFEEEE", mathsize: "90%" } } },\n'
    html += 'messageStyle: "none"\n'
    html += "});\n"
    html += "</script>\n"
    html += '\n<script type="text/javascript" id="MathJax-script" async src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js?config=TeX-MML-AM_CHTML"></script>\n'

    # replace <h1> with <header>
    html = re.sub(r"<h1>", "<header>", html)
    html = re.sub(r"</h1>", "</header>", html)

    # remove all whitespace after <code> tag
    html = re.sub(r"<code>\s+", "<code>", html)

    return html


def add_language_info(html: str, language: str = "en") -> str:
    # find first p tag and insert <p><i>Language: English</i></p> before it
    p_tag_pattern = re.compile(r"<section id=\"article-body\">")
    p_tag_match = p_tag_pattern.search(html)
    if p_tag_match is not None:
        html = (
            html[: p_tag_match.end() + 1]
            + f"<p style='text-align: right;'><i>This article is written in: {language}</i></p>\n"
            + html[p_tag_match.end() + 1 :]
        )
    return html


def main():
    urls = read_urls()

    for url_data in urls:

        url = url_data.url
        output_name = url_data.output_name
        # Download the Markdown file from the URL
        response = requests.get(url)

        # Convert the Markdown to HTML
        html = markdown.markdown(response.text)
        html = apply_filters(html, url_data.language_as_string())
        html = add_language_info(html, url_data.language)

        # Create a Path object for the output file
        output_path = Path(OUTPUT_DIR) / f"{output_name.lower()}.html"

        # Save the HTML to the output file
        output_path.write_text(html)


if __name__ == "__main__":
    main()
