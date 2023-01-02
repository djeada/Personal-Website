import requests
import markdown
import re
from pathlib import Path
from dataclasses import dataclass


PATH_TO_CONFIG = "input.txt"


@dataclass
class UrlData:
    url: str
    output_name: str


def read_urls():
    # Open the input file
    input_path = Path(PATH_TO_CONFIG)
    urls = input_path.read_text().splitlines()
    urls = [url.strip() for url in urls]
    urls = [UrlData(url.split()[0], url.split()[1]) for url in urls]
    return urls


def markdown_to_html_table(markdown_table: str) -> str:
    rows = markdown_table.split("\n")
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


def apply_filters(html):

    # replace all tables
    html = replace_all_tables(html)

    # if no body tag, add one at the beginning of the file and at the end
    if "<body>" not in html:
        html = "\n<body>\n" + html + "\n</body>\n"

    # if no head tag, add one at the beginning of the file and at the end
    if "<head>" not in html:
        html = "\n<head>\n\n</head>\n" + html

    # if no <!DOCTYPE html> <html lang="en"> add one at the beginning of the file and at the end
    if "<!DOCTYPE html>" not in html:
        html = '\n<!DOCTYPE html>\n<html lang="en">\n' + html + "\n</html>\n"

    # put everything inside the body tag in a div in <section id="article"> </section>
    body_start = html.find("<body>")
    body_end = html.find("</body>")
    body = html[body_start + 6 : body_end]
    html = (
        html[: body_start + 6]
        + f'\n<section id="article">\n{body}\n</section>\n'
        + html[body_end:]
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
        html = apply_filters(html)

        # Create a Path object for the output file
        output_path = Path(f"{output_name}.html")

        # Save the HTML to the output file
        output_path.write_text(html)


if __name__ == "__main__":
    main()
