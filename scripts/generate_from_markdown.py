"""
Transforms Markdown to HTML.
"""

import argparse
import html as html_lib
import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Optional

import requests
import markdown
from pathlib import Path
import re
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
from multiprocessing import Pool
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.append(str(SCRIPT_DIR))
import clean_output_dirs
import date_utils
import source_dates

PATH_TO_CONFIG = "input.json"
OUTPUT_DIR = Path("../src/articles")
GITHUB_RAW_BASE = "https://raw.githubusercontent.com"
GITHUB_API_BASE = "https://api.github.com/repos"

SOURCE_REPOSITORIES = [
    {
        "owner": "djeada",
        "repo": "Backend-Engineers-Guide",
        "branch": "main",
        "root": "notes",
        "language": "EN",
    },
    {
        "owner": "djeada",
        "repo": "Statistics-Notes",
        "branch": "main",
        "root": "notes",
        "language": "EN",
    },
    {
        "owner": "djeada",
        "repo": "Standard-of-Iron",
        "branch": "main",
        "root": "docs",
        "language": "EN",
    },
]

LANGUAGE_MAP: Dict[str, str] = {"🇵🇱": "pl", "🇺🇸": "en", "pl": "🇵🇱", "en": "🇺🇸"}

RANDOM_DATE_RANGE = False
RANDOM_DATE_START = datetime(2016, 1, 1)
RANDOM_DATE_END: Optional[datetime] = None
RANDOM_DATE_SEED = ""


SOURCE_DATES: Dict[str, datetime] = {}
ARTICLE_PATHS: Dict[tuple, Path] = {}

CODE_PLACEHOLDER = "CODEBLOCKPLACEHOLDER{:04d}END"
MATH_PLACEHOLDER = "MATHPLACEHOLDER{:04d}END"
DISPLAY_MATH_PATTERN = re.compile(r"\$\$[^`]+?\$\$", re.DOTALL)
INLINE_MATH_PATTERN = re.compile(r"(?<![\\$\w])\$(?=\S)[^$\n`]+?(?<=\S)\$(?![\w$])")
MATH_PRESENCE_PATTERN = re.compile(
    r"\$\$|\\\(|(?<![\\$\w])\$(?=\S)[^$\n<]+?(?<=\S)\$(?![\w$])"
)

LANGUAGE_ALIASES = {
    "c++": "cpp",
    "py": "python",
    "js": "javascript",
    "ts": "typescript",
}
PRISM_BASE = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0"


@dataclass
class UrlData:
    url: str
    title: str
    category: List[str]
    language: str

    @property
    def output_path(self) -> Path:
        def process(string: str) -> str:

            exceptions = {
                "neo4j": "neo4j",
            }

            for key, replacement in exceptions.items():
                if key in string.lower():
                    string = string.lower().replace(key, replacement)

            string = re.sub(r"(?<=[a-z0-9A-Z])[A-Z]", r"_\g<0>", string)
            string = re.sub(r"\s+", "_", string)
            string = re.sub(r"[^a-zA-Z0-9./]", "_", string.strip())
            return string.lower()

        categories = "/".join(process(cat) for cat in self.category)
        title = process(self.title)
        return OUTPUT_DIR / f"{categories}/{title}.html"

    def __repr__(self) -> str:
        return (
            f"<UrlData(url='{self.url}', output_name='{self.output_path.stem}', "
            f"category='{self.category}', language='{LANGUAGE_MAP[self.language.lower()]}')>"
        )

    @classmethod
    def from_json(cls, json_data):
        """
        Creates an instance of MarkdownFile from a JSON object.
        """
        return cls(**json_data)


class MarkdownProcessor:
    @staticmethod
    def extract_code_blocks(markdown_text: str) -> List[str]:
        return re.findall(r"```.*?```", markdown_text, re.DOTALL)

    @classmethod
    def remove_code_blocks(cls, markdown_text: str) -> str:
        counter = iter(range(1_000_000))
        return re.sub(
            r"```.*?```",
            lambda _: "\n" + CODE_PLACEHOLDER.format(next(counter)) + "\n\n",
            markdown_text,
            flags=re.DOTALL,
        )

    @staticmethod
    def protect_math(markdown_text: str) -> tuple[str, List[str]]:
        """Swaps LaTeX for placeholders so markdown cannot rewrite it."""
        formulas: List[str] = []

        def stash(match: re.Match) -> str:
            formulas.append(match.group(0))
            return MATH_PLACEHOLDER.format(len(formulas) - 1)

        markdown_text = DISPLAY_MATH_PATTERN.sub(stash, markdown_text)
        markdown_text = INLINE_MATH_PATTERN.sub(stash, markdown_text)
        return markdown_text, formulas

    @classmethod
    def convert_markdown_to_html(cls, markdown_text: str) -> str:

        markdown_text = re.sub(
            r"<details(?![^>]*\bmarkdown=)", '<details markdown="1"', markdown_text
        )
        html = markdown.markdown(markdown_text, extensions=["md_in_html"])
        return re.sub(r"<p>\s*(<summary>.*?</summary>)\s*</p>", r"\1", html, flags=re.S)

    @staticmethod
    def restore(html: str, template: str, items: List[str]) -> str:
        for idx, item in enumerate(items):
            html = html.replace(
                template.format(idx), html_lib.escape(item, quote=False)
            )
        return html

    @classmethod
    def insert_code_blocks(cls, html: str, code_blocks: List[str]) -> str:
        return cls.restore(html, CODE_PLACEHOLDER, code_blocks)

    @classmethod
    def run(cls, text: str) -> str:
        code_blocks = cls.extract_code_blocks(text)
        text = cls.remove_code_blocks(text)
        text, formulas = cls.protect_math(text)

        html = cls.convert_markdown_to_html(text)
        html = cls.restore(html, MATH_PLACEHOLDER, formulas)
        return cls.insert_code_blocks(html, code_blocks)


class HtmlEnhancer:
    def run(self, html: str, url_data, date_override: Optional[str] = None) -> str:
        """Main method to enhance the provided HTML content."""
        html = self.rewrite_links(html, url_data)
        html = self.apply_filters(html, url_data.language.lower())
        html = self.add_language_info(html, LANGUAGE_MAP[url_data.language.lower()])
        html = self.add_date_info(html, date_override)
        return html

    @classmethod
    def apply_filters(cls, html: str, lang: str = "en") -> str:
        """Applies a series of filters to enhance the provided HTML content."""
        html = cls.replace_all_tables(html)
        html = cls.correct_image_sources(html)
        html = cls.handle_code_blocks(html)
        html = cls.apply_prism_for_code_samples(html)
        html = cls.ensure_structure(html, lang)
        html = cls.replace_backticks_with_code_tags(html)
        return html

    @classmethod
    def replace_backticks_with_code_tags(cls, text: str) -> str:
        """Turns leftover `code` spans into tags, leaving code and scripts alone."""
        protected = re.compile(
            r"(<(pre|code|script)\b.*?</\2>)", re.DOTALL | re.IGNORECASE
        )
        parts = protected.split(text)
        output = []
        for idx in range(0, len(parts), 3):
            output.append(re.sub(r"`([^`]+)`", r"<code>\1</code>", parts[idx]))
            if idx + 1 < len(parts):
                output.append(parts[idx + 1])
        return "".join(output)

    @staticmethod
    def rewrite_links(html: str, url_data) -> str:
        """Points links to other notes at their article pages instead of GitHub."""
        source = source_dates.parse_raw_url(url_data.url)
        if not source:
            return html
        owner, repo, branch, _ = source
        soup = BeautifulSoup(html, "html.parser")
        for link in soup.find_all("a", href=True):
            href = link["href"].strip()
            target, _, fragment = href.partition("#")
            parsed = urlparse(target)
            if not target or parsed.scheme in ("mailto", "tel"):
                continue
            if not parsed.scheme:
                target_key = source_dates.parse_raw_url(urljoin(url_data.url, target))
            elif parsed.netloc == "github.com" and "/blob/" in parsed.path:
                parts = parsed.path.strip("/").split("/")
                target_key = (parts[0], parts[1], parts[3], "/".join(parts[4:]))
            else:
                continue
            if not target_key:
                continue

            article = ARTICLE_PATHS.get(target_key)
            if article:
                new_href = os.path.relpath(article, url_data.output_path.parent)
            elif parsed.scheme:
                continue
            else:
                t_owner, t_repo, t_branch, t_path = target_key
                new_href = (
                    f"https://github.com/{t_owner}/{t_repo}/blob/{t_branch}/{t_path}"
                )
            link["href"] = new_href + (f"#{fragment}" if fragment else "")
        return str(soup)

    @classmethod
    def replace_all_tables(cls, html: str) -> str:

        table_start_pattern = re.compile(r"<p>\s*\|")
        table_end_pattern = re.compile(r"</p>")
        output_html = ""
        last_end = 0

        while True:
            table_start_match = table_start_pattern.search(html, last_end)
            if not table_start_match:
                break
            table_end_match = table_end_pattern.search(html, table_start_match.end())
            if not table_end_match:
                break

            start = table_start_match.start()
            end = table_end_match.end()
            table = html[table_start_match.end() : table_end_match.start()]

            output_html += html[last_end:start] + cls.markdown_to_html_table(table)
            last_end = table_end_match.end()

        output_html += html[last_end:]

        return output_html

    @classmethod
    def correct_image_sources(cls, html: str) -> str:

        soup = BeautifulSoup(html, "html.parser")
        images = soup.find_all("img")
        for image in images:
            image["src"] = re.sub(
                r"^https://github\.com/([^/]+)/([^/]+)/(?:blob|raw)/",
                r"https://raw.githubusercontent.com/\1/\2/",
                image.get("src", ""),
            )
        return str(soup)

    @staticmethod
    def handle_code_blocks(html: str) -> str:

        soup = BeautifulSoup(html, "html.parser")
        for code in soup.find_all("code"):
            if code.find_parent("pre") is not None:
                code.attrs.setdefault("class", ["language-none"])
            elif "\n" in code.get_text():
                code.wrap(soup.new_tag("pre"))
                code.attrs.setdefault("class", ["language-none"])
        return str(soup)

    @classmethod
    def apply_prism_for_code_samples(cls, html: str) -> str:
        pattern = re.compile(
            r"(?:<p>)?```[ \t]*(?:(?P<lang>[\w+-]+)[ \t]*)?\r?\n(?P<code>.*?)```(?:</p>)?",
            re.DOTALL,
        )

        def replacer(match: re.Match) -> str:
            language = match.group("lang") or "shell"
            language = LANGUAGE_ALIASES.get(language.lower(), language.lower())

            code_sample = re.sub(r"\r?\n\Z", "", match.group("code"))
            code_sample = re.sub(r"<", "&lt;", code_sample)
            code_sample = re.sub(r">", "&gt;", code_sample)

            if language in {"math", "latex", "tex"}:
                return f"<div>$${code_sample}$$</div>"

            return f'<div><pre><code class="language-{language}">{code_sample}</code></pre></div>'

        return pattern.sub(replacer, html)

    @classmethod
    def ensure_structure(cls, html: str, lang: str) -> str:
        """Ensures a standard structure for the provided HTML."""
        html = cls.add_missing_tags(html, lang)
        html = cls.wrap_content(html)
        html = cls.add_scripts(html)
        html = cls.promote_title(html)
        html = cls.clean_whitespace(html)
        return html

    @staticmethod
    def add_missing_tags(html: str, lang: str) -> str:
        """Adds missing essential HTML tags."""
        if re.match(r"\s*(<!DOCTYPE|<html)", html, re.IGNORECASE):
            return html
        return (
            f'<!DOCTYPE html>\n<html lang="{lang}">\n<head></head>\n'
            f"<body>\n{html}\n</body>\n</html>"
        )

    @staticmethod
    def wrap_content(html: str) -> str:
        """Wraps the content inside the body tag in a section."""
        body_start = html.find("<body>")
        body_end = html.rfind("</body>")
        body_content = html[body_start + 6 : body_end]
        html = (
            html[: body_start + 6]
            + f'\n<article-section id="article-body">\n{body_content}\n</article-section>\n'
            + html[body_end:]
        )
        return html

    @staticmethod
    def add_scripts(html: str) -> str:
        """Adds necessary scripts to the provided HTML."""
        prism_scripts = "\n".join(
            [
                f'<script src="{PRISM_BASE}/components/prism-core.min.js"></script>',
                f'<script src="{PRISM_BASE}/plugins/autoloader/prism-autoloader.min.js"></script>',
            ]
        )
        mathjax_config = "\n".join(
            [
                '<script type="text/x-mathjax-config">',
                "MathJax.Hub.Config({",
                'jax: ["input/TeX", "output/HTML-CSS"],',
                'extensions: ["tex2jax.js"],',
                '"HTML-CSS": { preferredFont: "TeX", availableFonts: ["STIX","TeX"] },',
                'tex2jax: { inlineMath: [ ["$", "$"] ], displayMath: [ ["$$","$$"] ], processEscapes: true, ignoreClass: "tex2jax_ignore|dno" },',
                'TeX: { noUndefined: { attributes: { mathcolor: "red", mathbackground: "#FFEEEE", mathsize: "90%" } } },',
                'messageStyle: "none"',
                "});",
                "</script>",
                '<script type="text/javascript" id="MathJax-script" async src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js?config=TeX-MML-AM_CHTML"></script>',
            ]
        )
        soup = BeautifulSoup(html, "html.parser")
        body = soup.find("body")
        if body is None:
            return html
        code_text = "".join(pre.get_text() for pre in body.find_all("pre"))
        body_text = (
            body.get_text().replace(code_text, "") if code_text else body.get_text()
        )

        scripts = []
        if body.find("pre"):
            scripts.append(prism_scripts)
        if MATH_PRESENCE_PATTERN.search(body_text):
            scripts.append(mathjax_config)
        if scripts:
            body.append(BeautifulSoup("\n".join(scripts), "html.parser"))
        return str(soup)

    @staticmethod
    def promote_title(html: str) -> str:
        """Makes the first heading the article's only <h1>."""
        soup = BeautifulSoup(html, "html.parser")
        section = soup.find(id="article-body")
        if section is None:
            return html
        title = section.find(["h1", "h2"])
        if title is None:
            return html
        for heading in section.find_all("h1"):
            if heading is not title:
                heading.name = "h2"
        title.name = "h1"
        return str(soup)

    @staticmethod
    def clean_whitespace(html: str) -> str:
        """Cleans unnecessary whitespace, especially after code tags."""
        soup = BeautifulSoup(html, "html.parser")
        for code in soup.find_all("code"):
            if code.find_parent("pre") is None and code.contents:
                first = code.contents[0]
                if isinstance(first, str):
                    first.replace_with(first.lstrip())
        return str(soup)

    @classmethod
    def add_language_info(cls, html: str, language: str = "en") -> str:
        """Adds a language information paragraph."""
        insertion_point = re.search(r"<article-section id=\"article-body\">", html)
        if insertion_point:
            insert_at = insertion_point.end()
            info_paragraph = f"\n<p style='text-align: right;'><i>This article is written in: {language}</i></p>\n"
            html = html[:insert_at] + info_paragraph + html[insert_at:]
        return html

    @classmethod
    def add_date_info(cls, html: str, date_override: Optional[str] = None) -> str:
        """Adds a date information paragraph."""
        insertion_point = re.search(r"<article-section id=\"article-body\">", html)
        if insertion_point:
            insert_at = insertion_point.end()
            current_date = date_override or datetime.now().strftime("%B %d, %Y")
            date_paragraph = f"\n<p style='text-align: right;'><i>Last modified: {current_date}</i></p>\n"
            html = html[:insert_at] + date_paragraph + html[insert_at:]
        return html

    @classmethod
    def markdown_to_html_table(cls, markdown_table: str) -> str:
        rows = markdown_table.split("\n")

        processed_rows = []
        for row in rows:

            row = row.strip("|")

            cells = []
            current_cell = ""
            inside_backticks = False
            inside_code_tags = False
            i = 0

            while i < len(row):
                char = row[i]

                if char == "`":
                    inside_backticks = not inside_backticks
                    current_cell += char

                elif row[i : i + 6] == "<code>":
                    inside_code_tags = True
                    current_cell += "<code>"
                    i += 5
                elif row[i : i + 7] == "</code>":
                    inside_code_tags = False
                    current_cell += "</code>"
                    i += 6
                elif char == "|" and not inside_backticks and not inside_code_tags:
                    cells.append(current_cell.strip())
                    current_cell = ""
                else:
                    current_cell += char

                i += 1

            if current_cell:
                cells.append(current_cell.strip())

            processed_rows.append(cells)

        def is_separator(row: List[str]) -> bool:
            return all(
                re.match(r"\s*:?-+:?\s*", cell) or not cell.strip() for cell in row
            )

        has_header = len(processed_rows) > 1 and is_separator(processed_rows[1])
        processed_rows = [row for row in processed_rows if not is_separator(row)]

        html_table = "<table>"
        for idx, row in enumerate(processed_rows):
            is_header = has_header and idx == 0
            cell_tag = "th" if is_header else "td"
            if is_header:
                html_table += "<thead>"
            elif idx == (1 if has_header else 0):
                html_table += "<tbody>"
            html_table += "<tr>"
            for cell in row:
                html_table += f"<{cell_tag}>{cell}</{cell_tag}>"
            html_table += "</tr>"
            if is_header:
                html_table += "</thead>"
        if len(processed_rows) > (1 if has_header else 0):
            html_table += "</tbody>"
        html_table += "</table>"

        return "\n" + html_table + "\n"


def read_urls() -> List[UrlData]:
    """Read and parse URL data from a file."""
    data = read_url_config()
    return [UrlData.from_json(item) for item in data]


def read_url_config() -> list[dict]:
    """Read input.json and refresh configured GitHub source repositories."""
    config_path = Path(PATH_TO_CONFIG)
    data = json.loads(config_path.read_text())
    refreshed_data = refresh_configured_sources(data)
    if refreshed_data != data:
        config_path.write_text(json.dumps(refreshed_data, indent=4) + "\n")
    return refreshed_data


def refresh_configured_sources(data: list[dict]) -> list[dict]:
    refreshed_by_repo = {}
    for source in SOURCE_REPOSITORIES:
        entries = discover_source_entries(source)
        if entries:
            refreshed_by_repo[source["repo"]] = entries

    if not refreshed_by_repo:
        return data

    refreshed_repos = set(refreshed_by_repo)
    refreshed_data = [
        item for item in data if item.get("category", [""])[0] not in refreshed_repos
    ]
    for source in SOURCE_REPOSITORIES:
        refreshed_data.extend(refreshed_by_repo.get(source["repo"], []))
    return refreshed_data


def discover_source_entries(source: dict) -> list[dict]:
    owner = source["owner"]
    repo = source["repo"]
    branch = source["branch"]
    root = source["root"].strip("/")
    language = source["language"]
    api_url = f"{GITHUB_API_BASE}/{owner}/{repo}/git/trees/{branch}?recursive=1"

    try:
        response = requests.get(api_url, timeout=30)
        response.raise_for_status()
        tree_data = response.json()
    except requests.RequestException as exc:
        print(f"Warning: could not refresh {owner}/{repo}: {exc}", file=sys.stderr)
        return []

    if tree_data.get("truncated"):
        print(f"Warning: GitHub tree for {owner}/{repo} was truncated", file=sys.stderr)
        return []

    prefix = f"{root}/"
    entries = []
    for item in tree_data.get("tree", []):
        path = item.get("path", "")
        if item.get("type") != "blob":
            continue
        if not path.startswith(prefix) or not path.lower().endswith(".md"):
            continue
        if "readme" in Path(path).name.lower():
            continue

        parts = Path(path).parts
        entries.append(
            {
                "url": f"{GITHUB_RAW_BASE}/{owner}/{repo}/{branch}/{path}",
                "title": Path(path).stem.replace("_", " ").title(),
                "category": [repo] + list(parts[1:-1]),
                "language": language,
            }
        )

    return entries


def make_session() -> requests.Session:
    retry = Retry(
        total=4,
        backoff_factor=1.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry, pool_maxsize=16))
    return session


def fetch_markdown(urls: List[UrlData]) -> Dict[str, str]:
    """Downloads every source first, so a failed fetch never leaves a half-built site."""
    session = make_session()

    def fetch(url_data: UrlData) -> tuple[str, Optional[str]]:
        try:
            response = session.get(url_data.url, timeout=30)
            response.raise_for_status()
        except requests.RequestException as exc:
            print(f"Error: could not fetch {url_data.url}: {exc}", file=sys.stderr)
            return url_data.url, None
        return url_data.url, response.text

    with ThreadPoolExecutor(max_workers=16) as executor:
        texts = dict(executor.map(fetch, urls))

    failed = [url for url, text in texts.items() if text is None]
    if failed:
        raise RuntimeError(
            f"{len(failed)} markdown sources could not be fetched; "
            "the existing articles were left untouched."
        )
    return texts


def process_url(item: tuple[UrlData, str]) -> None:
    url_data, website_text = item
    html = MarkdownProcessor.run(website_text)

    enhancer = HtmlEnhancer()
    date_override = None
    if url_data.url in SOURCE_DATES:
        date_override = date_utils.format_date(SOURCE_DATES[url_data.url])
    if RANDOM_DATE_RANGE:
        start_date = RANDOM_DATE_START or datetime(2016, 1, 1)
        end_date = RANDOM_DATE_END or datetime.now()
        if end_date < start_date:
            raise ValueError("RANDOM_DATE_END cannot be earlier than RANDOM_DATE_START")
        random_date = date_utils.get_random_date_for_path(
            url_data.output_path, start_date, end_date, RANDOM_DATE_SEED
        )
        date_override = date_utils.format_date(random_date)
    html = enhancer.run(html, url_data, date_override=date_override)

    url_data.output_path.parent.mkdir(parents=True, exist_ok=True)
    url_data.output_path.write_text(html)


def parse_args():
    parser = argparse.ArgumentParser(description="Generate HTML from Markdown.")
    parser.add_argument(
        "--random-date-range",
        action="store_true",
        help="Set a deterministic random Last modified date per article.",
    )
    parser.add_argument(
        "--random-date-start",
        default="2016-01-01",
        help="Oldest date in YYYY-MM-DD format.",
    )
    parser.add_argument(
        "--random-date-end",
        default="now",
        help="Newest date in YYYY-MM-DD format or 'now'.",
    )
    parser.add_argument(
        "--random-date-seed",
        default="",
        help="Optional seed for stable random dates.",
    )
    return parser.parse_args()


def main():
    global RANDOM_DATE_RANGE, RANDOM_DATE_START, RANDOM_DATE_END, RANDOM_DATE_SEED
    args = parse_args()
    if args.random_date_range:
        RANDOM_DATE_RANGE = True
        now = datetime.now()
        RANDOM_DATE_START = date_utils.parse_date_arg(args.random_date_start, now=now)
        RANDOM_DATE_END = date_utils.parse_date_arg(args.random_date_end, now=now)
        RANDOM_DATE_SEED = args.random_date_seed

    global SOURCE_DATES, ARTICLE_PATHS
    urls = read_urls()
    texts = fetch_markdown(urls)

    if not RANDOM_DATE_RANGE:
        SOURCE_DATES = source_dates.upstream_dates(url.url for url in urls)
        missing = len(urls) - len(SOURCE_DATES)
        if missing:
            print(
                f"Warning: {missing} articles fall back to today's date",
                file=sys.stderr,
            )
    ARTICLE_PATHS = {
        source_dates.parse_raw_url(url.url): url.output_path.resolve() for url in urls
    }

    clean_output_dirs.main()
    with Pool() as pool:
        pool.map(process_url, [(url, texts[url.url]) for url in urls])


if __name__ == "__main__":
    main()
