import unittest

from bs4 import BeautifulSoup

from scripts.generate_from_markdown import HtmlEnhancer, MarkdownProcessor


class PrismCodeBlockTests(unittest.TestCase):
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
