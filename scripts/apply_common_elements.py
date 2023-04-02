"""
Input: html file
Output: modified html file with common elements applied to it (header, footer, etc.)
"""

import re
from pathlib import Path
from argparse import ArgumentParser

ARTICLES_HEADER_SOURCE_PATH = "../src/building_blocks/head_article.html"
ARTICLES_NAVBAR_SOURCE_PATH = "../src/building_blocks/navbar_article.html"
TOOL_HEADER_SOURCE_PATH = "../src/building_blocks/head_tool.html"
TOOL_NAVBAR_SOURCE_PATH = "../src/building_blocks/navbar_tool.html"
ARTICLES_FOOTER_SOURCE_PATH = "../src/building_blocks/footer_article.html"
TOOL_FOOTER_SOURCE_PATH = "../src/building_blocks/footer_tool.html"


INPUT_ARTICLES_DIR = "../src/articles"
INPUT_TOOL_DIR = "../src/tools"


def find_common_element(original_html, tag):
    # Find the element in the original HTML
    start_pattern = re.compile(rf"<{tag}[^>]*>")
    end_pattern = re.compile(rf"</{tag}>")
    start_match = start_pattern.search(original_html)
    end_match = end_pattern.search(original_html)

    return start_match, end_match


def replace_head(html, header_html):
    # Find the head element in the original HTML
    TAG = "head"
    head_start_match, head_end_match = find_common_element(html, TAG)

    # If the head element is not found, add the new head before the <body> element
    if head_start_match is None or head_end_match is None:
        body_start_pattern = re.compile(r"<body[^>]*>")
        body_start_match = body_start_pattern.search(html)
        new_html = (
            html[: body_start_match.start()]
            + header_html
            + html[body_start_match.start() :]
        )
    else:
        # Replace the head with the new head HTML
        new_html = (
            html[: head_start_match.start()]
            + header_html
            + html[head_end_match.end() :]
        )

    return new_html


def replace_navbar(html, navbar_html):
    # Find the navbar element in the original HTML
    TAG = "nav"
    navbar_start_match, navbar_end_match = find_common_element(html, TAG)

    # If the navbar element is not found, add the new navbar HTML just after the <body> get's opened
    if navbar_start_match is None or navbar_end_match is None:
        body_start_pattern = re.compile(r"<body[^>]*>")
        body_start_match = body_start_pattern.search(html)
        new_html = (
            html[: body_start_match.end()]
            + navbar_html
            + html[body_start_match.end() :]
        )
    else:
        # Replace the navbar with the new navbar HTML
        new_html = (
            html[: navbar_start_match.start()]
            + navbar_html
            + html[navbar_end_match.end() :]
        )

    return new_html


def replace_footer(html, footer_html):
    # Find the footer element in the original HTML
    TAG = "footer"
    footer_start_match, footer_end_match = find_common_element(html, TAG)

    # If the footer element is not found, add the new footer HTML at the end of the <body> element
    if footer_start_match is None or footer_end_match is None:
        body_end_pattern = re.compile(r"</body>")
        body_end_match = body_end_pattern.search(html)
        new_html = (
            html[: body_end_match.start()]
            + footer_html
            + html[body_end_match.start() :]
        )
    else:
        # Replace the footer with the new footer HTML
        new_html = (
            html[: footer_start_match.start()]
            + footer_html
            + html[footer_end_match.end() :]
        )

    return new_html


class Parser(ArgumentParser):
    def __init__(self, *args, **kwargs):
        super(Parser, self).__init__(*args, **kwargs)
        self.add_argument("path", type=str, help="path to the html file")
        self.add_argument(
            "--inplace",
            action="store_true",
            help="modify the file inplace",
            default=True,
        )
        self.add_argument(
            "--debug", action="store_true", help="print debug info to stdout"
        )


def change_title_in_head(html: str) -> str:
    # Find the first occurrence of <h1>, <header>, or <h2> in the HTML content
    first_header_match = re.search(
        r"<(h1|header|h2)[^>]*>(.+?)<\/(h1|header|h2)>", html
    )
    if first_header_match:
        first_header = first_header_match.group(2)
        # Replace the title in the head section with the first header
        html = re.sub(r"<title>.+<\/title>", f"<title>{first_header}</title>", html)
    return html


def change_meta_description_in_head(html: str) -> str:
    # Find the first occurrence of <h1>, <header>, or <h2> in the HTML content
    first_header_match = re.search(
        r"<(h1|header|h2)[^>]*>(.+?)<\/(h1|header|h2)>", html
    )
    if first_header_match:
        # Find the first sentence after the header
        content_after_header = html[first_header_match.end() :]
        first_sentence_match = re.search(r"([^.!?]*[.!?])", content_after_header)

        if first_sentence_match:
            first_sentence = first_sentence_match.group(1).strip()
            escaped_first_sentence = re.escape(first_sentence)
            # remove all the HTML tags from the first sentence
            escaped_first_sentence = re.sub(r"<[^>]*>", "", escaped_first_sentence)
            # remove all \ from the first sentence
            escaped_first_sentence = re.sub(r"\\", "", escaped_first_sentence)

            # Replace the meta description in the head section with the first sentence
            html = re.sub(
                r"<meta\s+name=['\"]description['\"]\s+content=['\"].+?['\"]",
                f'<meta name="description" content="{escaped_first_sentence}"',
                html,
                flags=re.IGNORECASE,
            )
    return html


def correct_file(file_path, paths_filters_pairs):
    html = Path(file_path).read_text()

    for path, filter_function in paths_filters_pairs:
        correct_html = Path(path).read_text()
        html = filter_function(html, correct_html)

    # Apply the change_title_in_head function
    html = change_title_in_head(html)

    # Apply the change_meta_description_in_head function
    html = change_meta_description_in_head(html)

    Path(file_path).write_text(html)


"""
def main():

    parser = Parser()
    args = parser.parse_args()
    input_file_path = args.path
    inplace = args.inplace
    
    correct_file(input_file_path)
"""


def main():

    articles_paths_filters_pairs = [
        (ARTICLES_HEADER_SOURCE_PATH, replace_head),
        (ARTICLES_NAVBAR_SOURCE_PATH, replace_navbar),
        (ARTICLES_FOOTER_SOURCE_PATH, replace_footer),
    ]

    tools_paths_filters_pairs = [
        (TOOL_HEADER_SOURCE_PATH, replace_head),
        (TOOL_NAVBAR_SOURCE_PATH, replace_navbar),
        (TOOL_FOOTER_SOURCE_PATH, replace_footer),
    ]

    # for file in Path(INPUT_DIR).glob("*.html"):
    #    correct_file(file)

    for file in Path(INPUT_ARTICLES_DIR).glob("*.html"):
        correct_file(file, articles_paths_filters_pairs)

    for file in Path(INPUT_TOOL_DIR).glob("**/*.html"):
        correct_file(file, tools_paths_filters_pairs)


if __name__ == "__main__":
    main()
