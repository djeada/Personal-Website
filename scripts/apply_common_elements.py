import logging
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from bs4 import BeautifulSoup

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
        title_content = BeautifulSoup(header_content.group(2), "html.parser").get_text()
        html = update_meta_content(html, title_content, "title")
    return html

def find_first_ascii_sentence(paragraphs):
    filtered_paragraphs = [
        p for p in paragraphs if p.get("style") != "text-align: right;"
    ]
    for paragraph in filtered_paragraphs:
        sentences = re.split(r"(?<=[.!?]) +", paragraph.get_text())
        for sentence in sentences:
            # Strip HTML tags using BeautifulSoup
            stripped_sentence = BeautifulSoup(sentence, "html.parser").get_text()
            return stripped_sentence
    return None


def change_meta_description_in_head(html_content):
    soup = BeautifulSoup(html_content, "html.parser")

    paragraphs = soup.find_all("p")
    first_ascii_sentence = find_first_ascii_sentence(paragraphs)
    if not first_ascii_sentence:
        logging.error(f"No suitable description found!")
        return str(soup)

    # Check for existing meta description tag
    meta_desc_tag = soup.find("meta", attrs={"name": "description"})

    if meta_desc_tag:
        current_description = meta_desc_tag.get("content", "").strip()
        if current_description.lower() == "xxx":
            meta_desc_tag["content"] = first_ascii_sentence
    else:
        # Create a new meta description tag if it doesn't exist
        new_meta_tag = soup.new_tag("meta")
        new_meta_tag.attrs["name"] = "description"
        new_meta_tag.attrs["content"] = first_ascii_sentence
        soup.head.append(new_meta_tag)

    return str(soup)


def process_file(file_path, category, configurations, depth=1):
    """Read an HTML file, apply corrections and save it."""
    html = file_path.read_text()
    depth_prefix = "../" * (1 + depth)

    for config_key, replace_func in configurations.items():
        element_html = Path(CONFIG[category][config_key]).read_text()
        element_html = element_html.replace("../../", f"{depth_prefix}")
        html = replace_func(html, element_html)

    html = change_title_in_head(html)
    html = change_meta_description_in_head(html)

    file_path.write_text(html)


def main():
    article_configurations = {
        "HEADER": replace_header,
        "NAVBAR": replace_navbar,
        "FOOTER": replace_footer,
    }
    tool_configurations = {"NAVBAR": replace_navbar, "FOOTER": replace_footer}

    # Process articles
    article_dir = Path(CONFIG["ARTICLES"]["INPUT_DIR"])
    with ThreadPoolExecutor() as executor:
        for file in article_dir.rglob("**/*.html"):
            depth = len(file.relative_to(article_dir).parts) - 1
            executor.submit(
                process_file, file, "ARTICLES", article_configurations, depth
            )

    # Process tools
    tool_dir = Path(CONFIG["TOOLS"]["INPUT_DIR"])
    with ThreadPoolExecutor() as executor:
        for file in tool_dir.rglob("**/*.html"):
            executor.submit(process_file, file, "TOOLS", tool_configurations)


if __name__ == "__main__":
    main()
    # change_meta_description_in_head(
    #   Path(
    #       "/home/adam/Personal-Website/src/articles/od_c_do_cpp/08_typ_wyliczeniowy.html"
    #    ).read_text()
    # )
