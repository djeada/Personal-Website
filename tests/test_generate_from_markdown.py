import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

from bs4 import BeautifulSoup

from scripts.generate_from_markdown import HtmlEnhancer, MarkdownProcessor, UrlData
from scripts import generate_from_markdown as generator


class PrismCodeBlockTests(unittest.TestCase):
    def test_database_source_discovery_removes_a_stale_cached_duplicate(self):
        source = next(item for item in generator.SOURCE_REPOSITORIES if item['repo'] == 'Databases-Notes')
        stale = {'url': 'https://raw.githubusercontent.com/djeada/Databases-Notes/main/notes/06_distributed_databases/08_distributed_database_systems.md', 'title': '08 Distributed Database Systems', 'category': ['Databases-Notes', '06_distributed_databases'], 'language': 'EN'}
        response = Mock()
        response.json.return_value = {'tree': [{'type': 'blob', 'path': 'notes/06_distributed_databases/01_distributed_database_systems.md'}]}
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / 'input.json'
            config.write_text(json.dumps([stale]))
            with patch.object(generator, 'PATH_TO_CONFIG', str(config)), patch.object(generator, 'SOURCE_REPOSITORIES', [source]), patch.object(generator.requests, 'get', return_value=response):
                refreshed = generator.read_url_config()
            self.assertEqual(len(refreshed), 1)
            self.assertTrue(refreshed[0]['url'].endswith('/01_distributed_database_systems.md'))
            self.assertEqual(json.loads(config.read_text()), refreshed)

    def test_repository_images_resolve_relative_to_the_markdown_source(self):
        source = UrlData(
            url="https://raw.githubusercontent.com/djeada/Frontend-Notes/main/notes/07_ui.md",
            title="07 Ui", category=["Frontend-Notes"], language="EN",
        )
        html = '<img src="../assets/ui-patterns/modal.png"><img src="data:image/png;base64,eA==">'
        soup = BeautifulSoup(HtmlEnhancer.rewrite_links(html, source), "html.parser")
        self.assertEqual(soup.find_all("img")[0]["src"], "https://raw.githubusercontent.com/djeada/Frontend-Notes/main/assets/ui-patterns/modal.png")
        self.assertEqual(soup.find_all("img")[1]["src"], "data:image/png;base64,eA==")

    def test_unlabelled_ascii_block_keeps_its_top_line(self):
        source = """<p>```
+-------+
| value |
+-------+
```</p>"""

        result = HtmlEnhancer.apply_prism_for_code_samples(source)

        self.assertIn('class="language-shell"', result)
        self.assertIn("+-------+\n| value |\n+-------+", result)

    def test_full_pipeline_preserves_diagram_indentation(self):
        diagram = (
            "      +-----------------------+\n"
            "      |      Big Problem      |\n"
            "      +-----------+-----------+\n"
            "                  |\n"
            "        +---------+---------+\n"
            "        |         |         |\n"
            "   +----+----+ +--+--+ +----+----+\n"
            "   | Part 1  | |Part2| | Part 3  |\n"
            "   +---------+ +-----+ +---------+"
        )
        source = "# Partitioning\n\n```\n" + diagram + "\n```\n\nAfter."

        html = HtmlEnhancer.apply_filters(MarkdownProcessor.run(source))
        soup = BeautifulSoup(html, "html.parser")

        self.assertEqual(soup.select_one("pre code").get_text(), diagram)
        self.assertEqual(soup.find_all("p")[-1].get_text(), "After.")

    def test_indented_markdown_block_keeps_all_rows_and_spaces(self):
        diagram = "  +-------+\n  | value |\n  +-------+\n"
        source = "\n".join("    " + line for line in diagram.split("\n"))

        html = HtmlEnhancer.apply_filters(MarkdownProcessor.run(source))
        soup = BeautifulSoup(html, "html.parser")

        self.assertEqual(soup.select_one("pre code").get_text(), diagram)
        self.assertEqual(len(soup.select("pre")), 1)

    def test_explicit_language_stays_on_the_opening_fence(self):
        source = """<p>```python
print("hello")
```</p>"""

        result = HtmlEnhancer.apply_prism_for_code_samples(source)

        self.assertIn('class="language-python"', result)
        self.assertIn('print("hello")', result)

    def test_leading_spaces_on_first_code_line_are_preserved(self):
        source = """<p>```
       +-------+
       | value |
       +-------+
```</p>"""

        result = HtmlEnhancer.apply_prism_for_code_samples(source)

        self.assertIn(
            "       +-------+\n       | value |\n       +-------+", result
        )

    def test_leading_tab_and_trailing_spaces_are_preserved(self):
        source = "<p>```text\n\tindented\nlast   \n```</p>"

        result = HtmlEnhancer.apply_prism_for_code_samples(source)

        self.assertIn("\tindented\nlast   </code>", result)


if __name__ == "__main__":
    unittest.main()
