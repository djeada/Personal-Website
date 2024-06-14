"""
Transforms Markdown to HTML.
"""
import json
from datetime import datetime
from typing import List, Dict

import requests
import markdown
from pathlib import Path
import re
from dataclasses import dataclass
from multiprocessing import Pool

from bs4 import BeautifulSoup

PATH_TO_CONFIG = "input.json"
OUTPUT_DIR = Path("../src/articles")

LANGUAGE_MAP: Dict[str, str] = {"🇵🇱": "pl", "🇺🇸": "en", "pl": "🇵🇱", "en": "🇺🇸"}


@dataclass
class UrlData:
    url: str
    title: str
    category: List[str]
    language: str

    @property
    def output_path(self) -> Path:
        def process(string: str) -> str:
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
        return re.sub(
            r"```.*?```", "\nCODE_BLOCK_PLACEHOLDER", markdown_text, flags=re.DOTALL
        )

    @classmethod
    def convert_markdown_to_html(cls, markdown_text: str) -> str:
        return markdown.markdown(markdown_text)

    @classmethod
    def insert_code_blocks(cls, html: str, code_blocks: List[str]) -> str:
        soup = BeautifulSoup(html, "html.parser")
        placeholders = soup.find_all(string="CODE_BLOCK_PLACEHOLDER")

        for idx, placeholder in enumerate(placeholders):
            placeholder.replace_with(BeautifulSoup(code_blocks[idx], "html.parser"))

        return str(soup)

    @classmethod
    def run(cls, text: str) -> str:
        code_blocks = cls.extract_code_blocks(text)
        text_without_code_blocks = cls.remove_code_blocks(text)

        html = cls.convert_markdown_to_html(text_without_code_blocks)
        enhanced_html = cls.insert_code_blocks(html, code_blocks)

        return enhanced_html


class HtmlEnhancer:
    def run(self, html: str, url_data) -> str:
        """Main method to enhance the provided HTML content."""
        html = self.apply_filters(html, url_data.language.lower())
        html = self.add_language_info(html, LANGUAGE_MAP[url_data.language.lower()])
        html = self.add_date_info(html)
        return html

    @classmethod
    def apply_filters(cls, html: str, lang: str = "en") -> str:
        """Applies a series of filters to enhance the provided HTML content."""
        html = cls.replace_all_tables(html)
        html = cls.correct_image_sources(html)
        html = cls.handle_code_blocks(html)
        html = cls.correct_math_blocks(html)
        html = cls.apply_prism_for_code_samples(html)
        html = cls.ensure_structure(html, lang)
        html = cls.replace_backticks_with_code_tags(html)
        return html

    @classmethod
    def replace_backticks_with_code_tags(cls, text: str) -> str:
        pattern = r"`([^`]+)`"
        replaced_text = re.sub(pattern, r"<code>\1</code>", text)
        return replaced_text

    @classmethod
    def replace_all_tables(cls, html: str) -> str:
        # find all tables, every table starts with <p>| (there could be a space before the |) and ends with </p>
        table_start_pattern = re.compile(r"<p>\s*\|")
        table_end_pattern = re.compile(r"</p>")
        table_start_match = table_start_pattern.search(html)
        while table_start_match is not None:
            table_end_match = table_end_pattern.search(html, table_start_match.end())
            start = table_start_match.start() + len("<p>")
            end = table_end_match.start()
            table = html[start:end]
            html = html[:start] + cls.markdown_to_html_table(table) + html[end:]
            table_start_match = table_start_pattern.search(html, table_end_match.end())
        return html

    @classmethod
    def correct_image_sources(cls, html: str) -> str:
        # find all images
        soup = BeautifulSoup(html, "html.parser")
        images = soup.find_all("img")
        for image in images:
            src = image["src"]
            if not src.endswith(".png"):
                continue
            if src.startswith("https://github.com"):
                src = src.replace(
                    "https://github.com", "https://raw.githubusercontent.com"
                )
                src = src.replace("/blob/", "/")
                image["src"] = src
        return str(soup)

    @staticmethod
    def handle_code_blocks(html: str) -> str:
        # Find all code tags that span multiple lines there must be at least two time \n in the content
        regex = r"<code>((?:(?!<code>|</code>).)+\n(?:(?!<code>|</code>).)+)</code>"
        matches = re.finditer(regex, html, re.DOTALL)
        for match in matches:
            # Extract the content between the code tags
            content = match.group().replace("<code>", "").replace("</code>", "")
            # Replace the code tags with backticks
            html = html.replace(match.group(), f"```{content}```")
        return html

    @classmethod
    def correct_math_blocks(cls, html: str) -> str:
        # math blocks are defined by $$ and $$,
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
            math_start_match = math_start_pattern.search(
                html, start + len(math_block) + 1
            )
        return html

    @classmethod
    def apply_prism_for_code_samples(cls, html: str) -> str:
        code_start_pattern = re.compile(r"```")
        code_start_match = code_start_pattern.search(html)
        while code_start_match is not None:
            code_end_match = code_start_pattern.search(html, code_start_match.end())
            if code_end_match is None:
                break
            start = code_start_match.start()
            end = code_end_match.end()
            code_sample = html[start:end]

            language = re.match(r"```([\w+]+)", code_sample)
            if language is None:
                language = "shell"
            else:
                language = language.group(1)
                language = language.lower()

            if language == "c++" or language == "cpp" or language == "c":
                language = "clike"

            code_sample = re.sub(r"`{3,}([\w+]+)?", "", code_sample).strip()

            # Escape '<' and '>' characters using regex
            code_sample = re.sub(r"<", "&lt;", code_sample)
            code_sample = re.sub(r">", "&gt;", code_sample)
            code_sample = re.sub(r"&lt;p&gt;", "", code_sample)
            code_sample = re.sub(r"&lt;\/p&gt;", "", code_sample)

            html = (
                html[:start]
                + f'<div><pre><code class="language-{language}">{code_sample}</code></pre></div>'
                + html[end:]
            )

            code_start_match = code_start_pattern.search(html, code_end_match.end())

        return html

    @classmethod
    def ensure_structure(cls, html: str, lang: str) -> str:
        """Ensures a standard structure for the provided HTML."""
        html = cls.add_missing_tags(html, lang)
        html = cls.wrap_content(html)
        html = cls.add_scripts(html)
        html = cls.replace_header_tags(html)
        html = cls.clean_whitespace(html)
        return html

    @staticmethod
    def add_missing_tags(html: str, lang: str) -> str:
        """Adds missing essential HTML tags."""
        if "<body>" not in html:
            html = "<body>\n" + html + "\n</body>"
        if "<head>" not in html:
            html = "<head></head>\n" + html
        if "<!DOCTYPE html>" not in html:
            html = f'<!DOCTYPE html>\n<html lang="{lang}">\n' + html + "\n</html>"
        return html

    @staticmethod
    def wrap_content(html: str) -> str:
        """Wraps the content inside the body tag in a section."""
        body_start = html.find("<body>")
        body_end = html.find("</body>")
        body_content = html[body_start + 6 : body_end]
        html = (
            html[: body_start + 6]
            + f'\n<section id="article-body">\n{body_content}\n</section>\n'
            + html[body_end:]
        )
        return html

    @staticmethod
    def add_scripts(html: str) -> str:
        """Adds necessary scripts to the provided HTML."""
        prism_scripts = "\n".join(
            [
                '<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/prism.min.js"></script>',
                '<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/components/prism-python.min.js"></script>',
                '<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/components/prism-bash.min.js"></script>',
                '<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/components/prism-javascript.min.js"></script>',
                '<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.17.1/components/prism-cpp.min.js"></script>',
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
        combined_scripts = prism_scripts + mathjax_config
        soup = BeautifulSoup(html, "html.parser")
        body_tag = soup.find("html")
        if body_tag:
            # Append the scripts just before the closing </body> tag
            body_tag.append(BeautifulSoup(combined_scripts, "html.parser"))

        return str(soup)

    @staticmethod
    def replace_header_tags(html: str) -> str:
        """Replaces h1 tags with header tags."""
        html = html.replace("<h1>", "<header>").replace("</h1>", "</header>")
        return html

    @staticmethod
    def clean_whitespace(html: str) -> str:
        """Cleans unnecessary whitespace, especially after code tags."""
        return re.sub(r"<code>\s+", "<code>", html)

    @classmethod
    def add_language_info(cls, html: str, language: str = "en") -> str:
        """Adds a language information paragraph."""
        insertion_point = re.search(r"<section id=\"article-body\">", html)
        if insertion_point:
            insert_at = insertion_point.end()
            info_paragraph = f"\n<p style='text-align: right;'><i>This article is written in: {language}</i></p>\n"
            html = html[:insert_at] + info_paragraph + html[insert_at:]
        return html

    @classmethod
    def add_date_info(cls, html: str) -> str:
        """Adds a date information paragraph."""
        insertion_point = re.search(r"<section id=\"article-body\">", html)
        if insertion_point:
            insert_at = insertion_point.end()
            current_date = datetime.now().strftime("%B %d, %Y")
            date_paragraph = f"\n<p style='text-align: right;'><i>Last modified: {current_date}</i></p>\n"
            html = html[:insert_at] + date_paragraph + html[insert_at:]
        return html

    @classmethod
    def markdown_to_html_table(cls, markdown_table: str) -> str:
        rows = markdown_table.split("\n")
        rows = [row[1:] if row.startswith("|") else row for row in rows]
        rows = [row[:-1] if row.endswith("|") else row for row in rows]
        rows = [row.split("|") for row in rows]
        # if there is a row that mathces ' -- | -- ' then it should be removed
        rows = [
            row
            for row in rows
            if not all(
                [re.match(r"\s*-+\s*", cell) or not cell.strip() for cell in row]
            )
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


def read_urls() -> List[UrlData]:
    """Read and parse URL data from a file."""
    file = Path(PATH_TO_CONFIG).read_text()
    data = json.loads(file)
    return [UrlData.from_json(item) for item in data]


def process_url(url_data):
    # This function will be executed by each worker.
    # Download the Markdown file from the URL
    website_text = requests.get(url_data.url).text

    code_blocks = MarkdownProcessor.extract_code_blocks(website_text)

    # Process markdown
    md_processor = MarkdownProcessor()
    html = md_processor.run(website_text)

    html = MarkdownProcessor.insert_code_blocks(html, code_blocks)

    # Enhance HTML
    enhancer = HtmlEnhancer()
    html = enhancer.run(html, url_data)

    # Save the processed HTML
    url_data.output_path.parent.mkdir(parents=True, exist_ok=True)
    url_data.output_path.write_text(html)


def main():
    urls = read_urls()

    # Using multiprocessing
    with Pool() as pool:
        pool.map(process_url, urls)


if __name__ == "__main__":
    main()
