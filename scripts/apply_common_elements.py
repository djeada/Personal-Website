import re
from pathlib import Path

# Configuration settings
CONFIG = {
    "ARTICLES": {
        "HEADER": "../src/building_blocks/head_article.html",
        "NAVBAR": "../src/building_blocks/navbar_article.html",
        "FOOTER": "../src/building_blocks/footer_article.html",
        "INPUT_DIR": "../src/articles",
    },
    "TOOLS": {
        "HEADER": "../src/building_blocks/head_tool.html",
        "NAVBAR": "../src/building_blocks/navbar_tool.html",
        "FOOTER": "../src/building_blocks/footer_tool.html",
        "INPUT_DIR": "../src/tools",
    },
}


def extract_element_from_html(original_html, tag):
    """Extract content between a given HTML tag from original HTML."""
    start_pattern = re.compile(rf"<{tag}[^>]*>")
    end_pattern = re.compile(rf"</{tag}>")
    start_match = start_pattern.search(original_html)
    end_match = end_pattern.search(original_html)
    return start_match, end_match


def replace_element(html, element_html, tag, fallback_tag):
    """Replace or insert an HTML element in the given HTML content."""
    start_match, end_match = extract_element_from_html(html, tag)
    if start_match is None or end_match is None:
        fallback_start_match = re.compile(rf"<{fallback_tag}[^>]*>").search(html)
        if tag == "footer":
            # Add the footer content just before the closing </body> tag
            body_end_match = re.search(r"</body>", html, re.IGNORECASE)
            new_html = (
                html[: body_end_match.start()]
                + element_html
                + html[body_end_match.start() :]
            )
        else:
            new_html = (
                html[: fallback_start_match.end()]
                + element_html
                + html[fallback_start_match.end() :]
            )
    else:
        new_html = html[: start_match.start()] + element_html + html[end_match.end() :]
    return new_html


def replace_header(html, header_html):
    return replace_element(html, header_html, "head", "body")


def replace_navbar(html, navbar_html):
    return replace_element(html, navbar_html, "nav", "body")


def replace_footer(html, footer_html):
    return replace_element(html, footer_html, "footer", "body")


def update_meta_content(html, tag_content, tag):
    """Update the content of a meta tag in the HTML."""
    pattern = re.compile(rf"<{tag}[^>]*>(.+?)</{tag}>")
    match = pattern.search(html)
    if match:
        content = match.group(1)
        html = html.replace(content, tag_content)
    return html


def change_title_in_head(html):
    """Update the title tag based on the first header tag content."""
    header_content = re.search(r"<(h1|header|h2)[^>]*>(.+?)<\/(h1|header|h2)>", html)
    if header_content:
        title_content = header_content.group(2)
        html = update_meta_content(html, title_content, "title")
    return html


def change_meta_description_in_head(html):
    """Update the meta description based on the content after the first header."""
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


def process_file(file_path, category, configurations):
    """Read an HTML file, apply corrections and save it."""
    html = file_path.read_text()

    for config_key, replace_func in configurations.items():
        element_html = Path(CONFIG[category][config_key]).read_text()
        html = replace_func(html, element_html)

    html = change_title_in_head(html)
    html = change_meta_description_in_head(html)

    file_path.write_text(html)


def main():
    """Entry function: Process each HTML file in the articles and tools directories."""
    article_configurations = {
        "HEADER": replace_header,
        "NAVBAR": replace_navbar,
        "FOOTER": replace_footer,
    }
    tool_configurations = {"NAVBAR": replace_navbar, "FOOTER": replace_footer}

    article_dir = Path(CONFIG["ARTICLES"]["INPUT_DIR"])
    for file in article_dir.rglob("**/*.html"):
        process_file(file, "ARTICLES", article_configurations)

    tool_dir = Path(CONFIG["TOOLS"]["INPUT_DIR"])
    for file in tool_dir.rglob("**/*.html"):
        process_file(file, "TOOLS", tool_configurations)


if __name__ == "__main__":
    main()
