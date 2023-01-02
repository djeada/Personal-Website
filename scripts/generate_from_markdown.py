import requests
import markdown
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


def apply_filters(html):

    # if no body tag, add one at the beginning of the file and at the end
    if "<body>" not in html:
        html = "<body>" + html + "</body>"

    # if no head tag, add one at the beginning of the file and at the end
    if "<head>" not in html:
        html = "<head>" + html + "</head>"

    # if no <!DOCTYPE html> <html lang="en"> add one at the beginning of the file and at the end
    if "<!DOCTYPE html>" not in html:
        html = '<!DOCTYPE html>\n<html lang="en">' + html + "</html>"

    # put everything inside the body tag in a div in <section id="article"> </section>
    body_start = html.find("<body>")
    body_end = html.find("</body>")
    body = html[body_start + 6 : body_end]
    html = html[:body_start + 6] + f'<section id="article">{body}</section>' + html[body_end:]
    
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
