import re
from pathlib import Path
from bs4 import BeautifulSoup


def slugify(text: str) -> str:
    """Convert text into a URL-friendly slug."""
    return re.sub(r"\W+", "-", text.lower().strip())


def inject_article_buttons(html: str) -> str:
    """
    Injects a row of action buttons (Suggest Edit, Create Issue, Download with icons)
    into the <section id="article-body"> of the given HTML.
    """
    soup = BeautifulSoup(html, "html.parser")

    # 1. Find the article body
    article_body = soup.find("section", {"id": "article-body"})
    if not article_body:
        return html  # No <section id="article-body"> found, return as-is

    # 2. Create container for the buttons
    button_container = soup.new_tag("div", attrs={"class": "article-action-buttons"})

    # 3. SVG icons
    svg_edit = """
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
        <path d="M4 21h4l11-11-4-4L4 17v4z" stroke="currentColor" stroke-width="2" />
    </svg>
    """
    svg_issue = """
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
        <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
    """
    svg_download = """
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
        <path d="M12 5v14m0 0l-6-6m6 6l6-6" stroke="currentColor" stroke-width="2"/>
    </svg>
    """

    # 4. Create buttons with SVG icons and titles
    suggest_button = soup.new_tag(
        "button", attrs={"class": "btn-suggest-edit", "title": "Suggest Edit"}
    )
    suggest_button.append(BeautifulSoup(svg_edit, "html.parser"))

    issue_button = soup.new_tag(
        "button", attrs={"class": "btn-create-issue", "title": "Create Issue"}
    )
    issue_button.append(BeautifulSoup(svg_issue, "html.parser"))

    download_button = soup.new_tag(
        "button", attrs={"class": "btn-download", "title": "Download"}
    )
    download_button.append(BeautifulSoup(svg_download, "html.parser"))

    # 5. Append to container and insert
    button_container.extend([suggest_button, issue_button, download_button])
    article_body.insert(0, button_container)

    return str(soup)


def inject_spinner_overlay(html: str) -> str:
    """
    Injects a spinner overlay div at the end of the <body> section in the HTML.
    Assumes CSS is handled separately.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Check if spinner already exists
    if soup.find(id="pdf-spinner-overlay"):
        return str(soup)

    spinner_div = soup.new_tag("div", attrs={"id": "pdf-spinner-overlay"})
    spinner_inner = soup.new_tag("div", attrs={"class": "spinner"})
    spinner_div.append(spinner_inner)

    if soup.body:
        soup.body.append(spinner_div)
    else:
        # If no <body>, inject at the end of <html>
        soup.append(spinner_div)

    return str(soup)


def process_html_file(file_path: Path):
    """
    Processes an HTML file, injecting article buttons and spinner overlay.
    """
    html = file_path.read_text(encoding="utf-8")

    # Inject buttons
    html = inject_article_buttons(html)

    # Inject spinner overlay
    html = inject_spinner_overlay(html)

    file_path.write_text(html, encoding="utf-8")


def main():
    INPUT_ARTICLES_DIR = Path("../src/articles")

    for html_file in INPUT_ARTICLES_DIR.rglob("*.html"):
        process_html_file(html_file)


if __name__ == "__main__":
    main()
