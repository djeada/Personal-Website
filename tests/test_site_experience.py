import unittest
import json
from bs4 import BeautifulSoup
from scripts.improve_site_experience import ROOT, enhance


class SiteExperienceTests(unittest.TestCase):
    def test_rendered_pages_are_idempotent_and_keep_a_populated_main(self):
        checked = 0
        for path in ROOT.rglob('*.html'):
            if 'building_blocks' in path.parts:
                continue
            text = path.read_text()
            if 'class="skip-link"' not in text:
                continue
            with self.subTest(page=path.relative_to(ROOT)):
                self.assertEqual(enhance(text, path), text)
                soup = BeautifulSoup(text, 'html.parser')
                self.assertEqual(len(soup.find_all('main')), 1)
                self.assertEqual(text.count('</main>'), 1)
                main = soup.main
                self.assertTrue(main.get_text(strip=True))
                self.assertEqual(soup.select_one('.skip-link')['href'], '#' + main['id'])
                self.assertFalse(soup.select('nav [role="menu"], nav [role="menuitem"]'))
                for link in soup.select('.read-next a, .breadcrumbs a'):
                    self.assertTrue((ROOT / link['href'].lstrip('/')).exists())
            checked += 1
        self.assertGreater(checked, 900)

    def test_existing_main_id_is_preserved(self):
        text = '<html><head><link href="/resources/style.css" rel="stylesheet"></head><body><nav><a href="/index.html">Home</a></nav><section><main id="container"><h1>Calculator</h1></main></section><footer></footer></body></html>'
        result = enhance(text, ROOT / 'tools/example/index.html')
        soup = BeautifulSoup(result, 'html.parser')
        self.assertEqual(soup.main['id'], 'container')
        self.assertEqual(soup.main.h1.get_text(), 'Calculator')
        self.assertEqual(soup.select_one('.skip-link')['href'], '#container')
        self.assertEqual(enhance(result, ROOT / 'tools/example/index.html'), result)

    def test_redirects_and_standalone_pages_are_untouched(self):
        for text in ['<html><body><h1>Demo</h1></body></html>', '<html><head><meta http-equiv="refresh" content="0;url=core/tools.html"></head><body><nav></nav></body></html>']:
            self.assertEqual(enhance(text, ROOT / 'tools.html'), text)

    def test_shared_page_without_footer_gets_a_closed_main(self):
        text = '<html><head><link href="/resources/style.css"></head><body><nav></nav><h1>Example</h1></body></html>'
        result = enhance(text, ROOT / 'example.html')
        self.assertEqual(result.count('</main>'), 1)
        self.assertIn('<h1>Example</h1>', str(BeautifulSoup(result, 'html.parser').main))

    def test_priority_metadata_stays_synchronized(self):
        for relative in ['index.html', 'core/tools.html']:
            soup = BeautifulSoup((ROOT / relative).read_text(), 'html.parser')
            data = json.loads(soup.find(id='structured-data').string)
            self.assertEqual(soup.title.get_text(), data['name'])
            self.assertEqual(soup.title.get_text(), soup.find('meta', property='og:title')['content'])
            description = soup.find('meta', attrs={'name': 'description'})['content']
            self.assertEqual(description, data['description'])
            self.assertEqual(description, soup.find('meta', property='og:description')['content'])

    def test_prism_is_deferred_in_original_order(self):
        text = '<html><head><link href="/resources/style.css" rel="stylesheet"></head><body><nav></nav><script src="https://cdn.example/prism-core.min.js"></script><script src="https://cdn.example/prism-autoloader.min.js"></script><h1>Code</h1><footer></footer></body></html>'
        soup = BeautifulSoup(enhance(text, ROOT / 'example.html'), 'html.parser')
        scripts = soup.find_all('script', src=True)
        self.assertTrue(all(s.has_attr('defer') for s in scripts))
        self.assertIn('prism-core', scripts[0]['src'])
        self.assertIn('prism-autoloader', scripts[1]['src'])


if __name__ == '__main__':
    unittest.main()
