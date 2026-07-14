import unittest

from scripts.generate_from_markdown import HtmlEnhancer


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
