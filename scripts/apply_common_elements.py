import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Tuple, Dict, Callable, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup


CONFIG = {
    "ARTICLES": {
        "HEADER": "../src/building_blocks/head_article.html",
        "NAVBAR": "../src/building_blocks/navbar_article.html",
        "FOOTER": "../src/building_blocks/footer_article.html",
        "INPUT_DIR": "../src/articles",
    },
    "COURSES": {
        "NAVBAR": "../src/building_blocks/navbar_tool.html",
        "FOOTER": "../src/building_blocks/footer_tool.html",
        "INPUT_DIR": "../src/courses",
    },
    "TOOLS": {
        "HEADER": "../src/building_blocks/head_tool.html",
        "NAVBAR": "../src/building_blocks/navbar_tool.html",
        "FOOTER": "../src/building_blocks/footer_tool.html",
        "INPUT_DIR": "../src/tools",
    },
}
PREDEFINED_DESCRIPTIONS = {
    "algorithms_and_data_structures": "Explore fundamental algorithms and data structures. Understand their design, implementation, and optimization techniques for efficient problem-solving.",
    "frontend_notes": "Dive into frontend development with notes on HTML, CSS, JavaScript, and popular frameworks. Enhance your web design and user interface skills.",
    "git_notes": "Master the essentials of Git with detailed notes on version control, branching, merging, and collaboration techniques.",
    "kurs_podstaw_pythona": "Kurs dla początkujących z podstaw Pythona. Naucz się składni, podstawowych pojęć programistycznych i praktycznych zastosowań.",
    "linux_notes": "Comprehensive notes on Linux operating system, covering commands, shell scripting, and system administration.",
    "numpy_tutorials": "Tutorials on NumPy, the fundamental package for numerical computing in Python. Learn array operations, mathematical functions, and more.",
    "od_c_do_cpp": "Przewodnik po przejściu od języka C do C++. Poznaj różnice, nowe funkcje i najlepsze praktyki programowania.",
    "parallel_and_concurrent_programming": "Learn the principles and techniques of parallel and concurrent programming to write efficient and high-performance code.",
    "stanford_machine_learning": "Insights and notes from Stanford's machine learning course. Understand key concepts, algorithms, and applications.",
    "statistics_notes": "Detailed notes on statistics covering probability, distributions, hypothesis testing, and data analysis techniques.",
    "vtk_examples": "Examples and tutorials on VTK (Visualization Toolkit) for 3D computer graphics, image processing, and visualization.",
}
SITE_BASE_URL = "https://adamdjellouli.com/"
SITE_NAME = "Adam Djellouli"
TITLE_SUFFIX = f" | {SITE_NAME}"
DESCRIPTION_LENGTH = 155
ABBREVIATIONS = ("ang.", "np.", "tzw.", "e.g.", "i.e.", "etc.", "vs.", "cf.", "approx.")
STRUCTURED_DATA_ID = "structured-data"
THEME_INIT_ID = "theme-init"
THEME_INIT_BODY_ID = "theme-init-body"
THEME_INIT_BODY_SCRIPT = (
    'if (document.documentElement.classList.contains("dark-mode")) '
    'document.body.classList.add("dark-mode");'
)

THEME_INIT_SCRIPT = (
    "(function () {"
    " if (!/(?:^|;\\s*)darkMode=true/.test(document.cookie)) return;"
    " var root = document.documentElement;"
    ' root.classList.add("dark-mode");'
    ' root.style.colorScheme = "dark";'
    ' root.style.backgroundColor = "#0d1117";'
    " new MutationObserver(function (changes, observer) {"
    ' if (document.body) { document.body.classList.add("dark-mode"); observer.disconnect(); }'
    " }).observe(root, { childList: true });"
    " })();"
)
LAST_MODIFIED_PATTERN = re.compile(
    r'<p style="text-align: right;"><i>Last modified: (.*?)</i></p>'
)


def extract_element_from_html(html: str, tag: str) -> Tuple[re.Match, re.Match]:
    """Extract the start and end positions of a given HTML tag from the HTML content."""
    start_pattern = re.compile(rf"<{tag}[^>]*>")
    end_pattern = re.compile(rf"</{tag}>")
    start_match = start_pattern.search(html)
    end_match = end_pattern.search(html)
    return start_match, end_match


def replace_element(html: str, element_html: str, tag: str, fallback_tag: str) -> str:
    """Replace or insert an HTML element in the given HTML content."""
    start_match, end_match = extract_element_from_html(html, tag)
    if start_match is None or end_match is None:
        fallback_start_match = re.compile(rf"<{fallback_tag}[^>]*>").search(html)
        if tag == "footer":

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


def replace_header(html: str, header_html: str) -> str:
    """Replace or insert the header element in the given HTML content."""
    return replace_element(html, header_html, "head", "body")


def replace_navbar(html: str, navbar_html: str) -> str:
    """Replace or insert the navbar element in the given HTML content."""
    return replace_element(html, navbar_html, "nav", "body")


def replace_footer(html: str, footer_html: str) -> str:
    """Replace or insert the footer element in the given HTML content."""
    return replace_element(html, footer_html, "footer", "body")


def change_title_in_head(html: str, file_path: Optional[Path] = None) -> str:
    """Update the <title> tag to match the primary page heading (prefer <h1>)."""
    soup = BeautifulSoup(html, "html.parser")

    title_text = None
    article_body = soup.find("article-section", {"id": "article-body"})
    if article_body:
        first_heading = article_body.find(["h1", "h2", "h3", "h4"])
        if first_heading and first_heading.get_text(strip=True):
            title_text = first_heading.get_text(strip=True)

    if not title_text:
        h1 = soup.find("h1")
        if h1 and h1.get_text(strip=True):
            title_text = h1.get_text(strip=True)
        else:
            header = soup.find("header")
            if header:
                h1_in_header = header.find("h1")
                if h1_in_header and h1_in_header.get_text(strip=True):
                    title_text = h1_in_header.get_text(strip=True)
            if not title_text:
                h2 = soup.find("h2")
                if h2 and h2.get_text(strip=True):
                    title_text = h2.get_text(strip=True)

    if not title_text:
        return str(soup)

    page = re.fullmatch(r"blog_(\d+)", file_path.stem) if file_path else None
    if page and page.group(1) != "1":
        title_text += f" – Page {page.group(1)}"
    if len(title_text + TITLE_SUFFIX) <= 65:
        title_text += TITLE_SUFFIX

    title_tag = soup.find("title")
    if title_tag:
        title_tag.string = title_text
    else:

        if not soup.head:
            if soup.html:
                soup.html.insert(0, soup.new_tag("head"))
            else:
                soup.insert(0, soup.new_tag("head"))
        new_title = soup.new_tag("title")
        new_title.string = title_text
        soup.head.append(new_title)

    return str(soup)


def plain_math(latex: str) -> str:
    """Readable text for a short inline formula, e.g. $f(x)$ -> f(x)."""
    text = re.sub(r"\\[a-zA-Z]+|[{}\\]", "", latex).strip()
    return text if len(text) <= 20 else "…"


def summarize(texts: list) -> Optional[str]:
    """Joins the opening sentences of an article into a ~155 character summary."""
    sentences = []
    for text in texts:
        text = re.sub(r"\$\$.*?\$\$", "", text, flags=re.S)
        text = re.sub(r"\$([^$]+)\$", lambda m: plain_math(m.group(1)), text)
        text = re.sub(r"\s+", " ", text).strip()
        pieces = re.split(r"(?<=[.!?]) +", text)
        for piece in pieces:
            if sentences and sentences[-1].lower().endswith(ABBREVIATIONS):
                sentences[-1] += " " + piece
            elif piece:
                sentences.append(piece)

    summary = ""
    for sentence in sentences:
        if summary and len(summary) + len(sentence) + 1 > DESCRIPTION_LENGTH:
            break
        summary = f"{summary} {sentence}".strip()
        if len(summary) >= 110 and not summary.endswith(":"):
            break

    if len(summary) > DESCRIPTION_LENGTH:
        summary = summary[: DESCRIPTION_LENGTH - 1].rsplit(" ", 1)[0] + "…"
    summary = re.sub(r"\s*:$", ".", summary)
    return summary or None


def find_first_ascii_sentence(paragraphs: list, file_path: Path) -> str:
    """Build a description from predefined text or the article's opening paragraphs."""

    if file_path.stem.lower() in PREDEFINED_DESCRIPTIONS:
        return PREDEFINED_DESCRIPTIONS[file_path.stem.lower()]
    blog_page = re.fullmatch(r"blog_(\d+)", file_path.stem.lower())
    if blog_page:
        return (
            "Notes and tutorials on algorithms, data structures, Linux, Git, Python, "
            "C++, databases, statistics, machine learning and web development "
            f"(page {blog_page.group(1)})."
        )

    def usable(tag):
        return (
            tag.get("style") != "text-align: right;"
            and not tag.find_parent(class_="article-header")
            and tag.get_text(strip=True)
        )

    texts = [p.get_text() for p in paragraphs if p.name == "p" and usable(p)]
    items = [li.get_text() for li in paragraphs if li.name == "li" and usable(li)]
    return summarize(texts) or summarize(items)


def change_meta_description_in_head(html_content: str, file_path: Path) -> str:
    """Change the meta description tag in the head based on the first ASCII sentence found in paragraphs."""
    soup = BeautifulSoup(html_content, "html.parser")
    article_body = soup.find(id="article-body")
    paragraphs = (article_body or soup).find_all(["p", "li"])
    first_ascii_sentence = find_first_ascii_sentence(
        paragraphs=paragraphs, file_path=file_path
    )
    if not first_ascii_sentence:
        logging.error(f"No suitable description found! {file_path}")
        return str(soup)

    meta_desc_tag = soup.find("meta", attrs={"name": "description"})

    if meta_desc_tag:
        current_description = meta_desc_tag.get("content", "").strip()
        if (
            current_description.lower() == "xxx"
            or file_path.stem.lower() in PREDEFINED_DESCRIPTIONS
        ):
            meta_desc_tag["content"] = first_ascii_sentence
        else:
            logging.info(f"Not changing description in {file_path}")
    else:

        new_meta_tag = soup.new_tag("meta")
        new_meta_tag.attrs["name"] = "description"
        new_meta_tag.attrs["content"] = first_ascii_sentence
        soup.head.append(new_meta_tag)

    return str(soup)


def build_canonical_url(file_path: Path) -> str:
    """Build the canonical URL for a given HTML file."""
    base_dir = Path("../src").resolve()
    relative_path = file_path.resolve().relative_to(base_dir).as_posix()
    relative_path = relative_path.removesuffix(".html")
    if relative_path == "index":
        relative_path = ""
    elif relative_path.endswith("/index"):
        relative_path = relative_path[:-5]
    return f"{SITE_BASE_URL}{relative_path}"


def extract_last_modified_date(html_content: str) -> str:
    """Extract the last modified date from HTML if present."""
    match = LAST_MODIFIED_PATTERN.search(html_content)
    if not match:
        return None
    try:
        parsed_date = datetime.strptime(match.group(1), "%B %d, %Y")
        return parsed_date.strftime("%Y-%m-%d")
    except ValueError:
        return None


def upsert_canonical_link(soup: BeautifulSoup, canonical_url: str) -> None:
    """Insert or update the canonical link tag."""
    canonical_tag = soup.find("link", attrs={"rel": "canonical"})
    if canonical_tag:
        canonical_tag["href"] = canonical_url
        return
    new_tag = soup.new_tag("link", rel="canonical", href=canonical_url)
    if soup.head:
        soup.head.append(new_tag)


def find_share_image(soup: BeautifulSoup, canonical_url: str) -> Optional[str]:
    """Absolute URL of the first article image, if the article has one."""
    article_body = soup.find(id="article-body")
    image = article_body.find("img", src=True) if article_body else None
    if image is None:
        return None
    return urljoin(canonical_url, image["src"])


def upsert_meta(soup: BeautifulSoup, key: str, name: str, content: str) -> None:
    tag = soup.find("meta", attrs={key: name})
    if tag is None:
        tag = soup.new_tag("meta", attrs={key: name})
        soup.head.append(tag)
    tag["content"] = content


def upsert_social_tags(
    soup: BeautifulSoup, canonical_url: str, page_type: str, last_modified: str
) -> None:
    """Open Graph and Twitter card tags for link previews."""
    if not soup.head:
        return
    title = soup.title.get_text(strip=True) if soup.title else SITE_NAME
    meta_desc = soup.find("meta", attrs={"name": "description"})
    description = meta_desc.get("content", "").strip() if meta_desc else ""
    image = find_share_image(soup, canonical_url)

    properties = {
        "og:title": title.removesuffix(TITLE_SUFFIX),
        "og:type": "article" if page_type == "ARTICLES" else "website",
        "og:url": canonical_url,
        "og:site_name": SITE_NAME,
    }
    if description:
        properties["og:description"] = description
    if image:
        properties["og:image"] = image
    if page_type == "ARTICLES" and last_modified:
        properties["article:modified_time"] = last_modified
    for name, content in properties.items():
        upsert_meta(soup, "property", name, content)
    upsert_meta(
        soup, "name", "twitter:card", "summary_large_image" if image else "summary"
    )


def build_structured_data(
    soup: BeautifulSoup, canonical_url: str, page_type: str, last_modified: str
) -> dict:
    """Build JSON-LD structured data for the page."""
    title = soup.title.get_text(strip=True) if soup.title else None
    if title:
        title = title.removesuffix(TITLE_SUFFIX)
    meta_desc = soup.find("meta", attrs={"name": "description"})
    description = meta_desc.get("content", "").strip() if meta_desc else None

    if page_type == "ARTICLES":
        data = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": title,
            "author": {"@type": "Person", "name": "Adam Djellouli"},
            "mainEntityOfPage": {"@type": "WebPage", "@id": canonical_url},
            "url": canonical_url,
        }
    else:
        data = {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": title,
            "url": canonical_url,
        }

    if description:
        data["description"] = description
    if last_modified:
        data["dateModified"] = last_modified
    image = find_share_image(soup, canonical_url)
    if image and page_type == "ARTICLES":
        data["image"] = image
    language = soup.html.get("lang") if soup.html else None
    if language:
        data["inLanguage"] = language

    return data


def upsert_theme_init(soup: BeautifulSoup) -> None:
    """Put the dark-mode bootstrap script at the top of <head>."""
    if not soup.head:
        return
    script = soup.find("script", attrs={"id": THEME_INIT_ID})
    if script is None:
        script = soup.new_tag("script", id=THEME_INIT_ID)
    script.string = THEME_INIT_SCRIPT
    script.extract()
    charset = soup.head.find("meta", attrs={"charset": True})
    if charset:
        charset.insert_after(script)
    else:
        soup.head.insert(0, script)

    if soup.body:
        body_script = soup.find("script", attrs={"id": THEME_INIT_BODY_ID})
        if body_script is None:
            body_script = soup.new_tag("script", id=THEME_INIT_BODY_ID)
        body_script.string = THEME_INIT_BODY_SCRIPT
        soup.body.insert(0, body_script.extract())


def upsert_structured_data(soup: BeautifulSoup, structured_data: dict) -> None:
    """Insert or update JSON-LD structured data in the head."""
    if not soup.head:
        return
    script_tag = soup.find("script", attrs={"id": STRUCTURED_DATA_ID})
    if script_tag is None:
        script_tag = soup.new_tag("script", type="application/ld+json")
        script_tag["id"] = STRUCTURED_DATA_ID
        soup.head.append(script_tag)
    script_tag.string = json.dumps(structured_data, ensure_ascii=True)


def process_file(
    file_path: Path, category: str, configurations: Dict[str, Callable], depth: int = 1
) -> None:
    """Read an HTML file, apply corrections and save it."""
    html = file_path.read_text()
    depth_prefix = "../" * (1 + depth)

    for config_key, replace_func in configurations.items():
        element_html = Path(CONFIG[category][config_key]).read_text()
        if "__DEPTH__" in element_html:
            element_html = element_html.replace("__DEPTH__", f"{depth_prefix}")
        else:
            element_html = element_html.replace("../../", f"{depth_prefix}")
        html = replace_func(html, element_html)

    html = change_title_in_head(html, file_path)
    html = change_meta_description_in_head(html_content=html, file_path=file_path)

    soup = BeautifulSoup(html, "html.parser")
    canonical_url = build_canonical_url(file_path)
    upsert_canonical_link(soup, canonical_url)
    last_modified = extract_last_modified_date(html)
    structured_data = build_structured_data(
        soup=soup,
        canonical_url=canonical_url,
        page_type=category,
        last_modified=last_modified,
    )
    upsert_structured_data(soup, structured_data)
    upsert_social_tags(soup, canonical_url, category, last_modified)
    upsert_theme_init(soup)
    html = str(soup)

    file_path.write_text(html)


def process_metadata_file(file_path: Path, page_type: str) -> None:
    """Insert canonical and structured data into an existing HTML file."""
    html = file_path.read_text()
    if "<head" not in html and "<html" not in html:
        return

    soup = BeautifulSoup(html, "html.parser")
    canonical_url = build_canonical_url(file_path)
    upsert_canonical_link(soup, canonical_url)
    last_modified = extract_last_modified_date(html)
    structured_data = build_structured_data(
        soup=soup,
        canonical_url=canonical_url,
        page_type=page_type,
        last_modified=last_modified,
    )
    upsert_structured_data(soup, structured_data)
    upsert_social_tags(soup, canonical_url, page_type, last_modified)
    upsert_theme_init(soup)
    file_path.write_text(str(soup))


def process_course_file(file_path: Path, depth: int = 1) -> None:
    """Apply the shared course navbar/footer without replacing custom metadata."""
    html = file_path.read_text()
    depth_prefix = "../" * (1 + depth)
    course_configurations = {"NAVBAR": replace_navbar, "FOOTER": replace_footer}

    for config_key, replace_func in course_configurations.items():
        element_html = Path(CONFIG["COURSES"][config_key]).read_text()
        if "__DEPTH__" in element_html:
            element_html = element_html.replace("__DEPTH__", f"{depth_prefix}")
        else:
            element_html = element_html.replace("../../", f"{depth_prefix}")
        html = replace_func(html, element_html)

    file_path.write_text(html)
    process_metadata_file(file_path, "COURSES")


def main() -> None:
    """Main function to process HTML files for articles and tools."""
    article_configurations = {
        "HEADER": replace_header,
        "NAVBAR": replace_navbar,
        "FOOTER": replace_footer,
    }
    tool_configurations = {"NAVBAR": replace_navbar, "FOOTER": replace_footer}

    jobs = []
    article_dir = Path(CONFIG["ARTICLES"]["INPUT_DIR"])
    for file in article_dir.rglob("**/*.html"):
        depth = len(file.relative_to(article_dir).parts) - 1
        jobs.append((process_file, file, "ARTICLES", article_configurations, depth))

    tool_dir = Path(CONFIG["TOOLS"]["INPUT_DIR"])
    for file in tool_dir.rglob("**/*.html"):
        depth = len(file.relative_to(tool_dir).parts) - 1
        jobs.append((process_file, file, "TOOLS", tool_configurations, depth))

    course_dir = Path(CONFIG["COURSES"]["INPUT_DIR"])
    for file in course_dir.rglob("**/*.html"):
        depth = len(file.relative_to(course_dir).parts) - 1
        jobs.append((process_course_file, file, depth))

    for file in Path("../src/core").rglob("**/*.html"):
        jobs.append((process_metadata_file, file, "CORE"))

    empty = [job for job in jobs if not job[1].read_text().strip()]
    for job in empty:
        logging.warning(f"Skipping empty page {job[1]}")
    jobs = [job for job in jobs if job not in empty]

    with ThreadPoolExecutor() as executor:
        futures = {executor.submit(*job): job[1] for job in jobs}
    failures = [(path, f.exception()) for f, path in futures.items() if f.exception()]
    for path, error in failures:
        logging.error(f"Failed to process {path}: {error!r}")
    if failures:
        raise SystemExit(f"{len(failures)} pages failed to process")

    index_file = Path("../src/index.html")
    if index_file.exists():
        process_metadata_file(index_file, "CORE")


if __name__ == "__main__":
    main()
