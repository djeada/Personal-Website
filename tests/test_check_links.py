import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.check_links import resolve_internal_link, scan_links


class LinkResolutionTests(unittest.TestCase):
    def test_browser_urls_resolve_to_real_site_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            page = root / "tools/demo/index.html"
            page.parent.mkdir(parents=True)
            page.write_text("<html></html>")
            script = page.parent / "app.js"
            script.touch()
            category = root / "articles/topic.html"
            category.parent.mkdir()
            category.touch()
            (root / "articles/topic").mkdir()
            for url, expected in [
                ("app.js?v=build#part", script),
                ("/tools/demo/", page),
                ("https://adamdjellouli.com/tools/demo/", page),
                ("//www.adamdjellouli.com/articles/topic", category),
                ("/articles/%74opic", category),
            ]:
                with self.subTest(url=url):
                    self.assertEqual(resolve_internal_link(url, page, root), expected)
            self.assertIsNone(resolve_internal_link("../../../outside.html", page, root))

    def test_audit_checks_root_links_and_distinguishes_access_restrictions(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text(
                '<link rel="preconnect" href="https://fonts.example.test">'
                '<a href="/missing.html">missing</a>'
                '<a href="https://adamdjellouli.com/absent.html">absent</a>'
                '<a href="https://example.test/dead">dead</a>'
                '<a href="https://example.test/blocked">blocked</a>'
                '<a href="https://example.test/limited">limited</a>'
            )
            reasons = {"dead": "HTTP 404", "blocked": "HTTP 403", "limited": "HTTP 429"}
            with patch("scripts.check_links.check_external_link", side_effect=lambda url: reasons[url.rsplit("/", 1)[-1]]):
                report = scan_links(root, check_external=True)
            self.assertEqual(report.internal_links_checked, 2)
            self.assertEqual(report.external_links_checked, 3)
            self.assertEqual(report.broken_count, 3)
            self.assertEqual(len(report.unverified_links), 2)


if __name__ == "__main__":
    unittest.main()
