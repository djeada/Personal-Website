"""Apply repeatable SEO and usability enhancements without reformatting page bodies.

Run after the other generators. Only published pages with shared navigation are
changed; redirect stubs and standalone demos retain their original markup.
"""
import html
import json
import re
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'src'
TITLES = {
    'index.html': 'Adam Djellouli — Software Engineer in Berlin',
    'core/tools.html': 'Free Developer Tools & Interactive Visualizers',
    'articles/backend_engineers_guide/01_api_design/02_rest.html': 'REST APIs: Principles, HTTP Methods, and Examples',
    'articles/backend_engineers_guide/01_api_design/03_graphql.html': 'GraphQL APIs: Queries, Mutations, and Schemas',
    'articles/backend_engineers_guide/01_api_design/04_grpc.html': 'gRPC: Protocol Buffers and RPC Communication',
}
DESCRIPTIONS = {
    'index.html': 'Adam Djellouli, software engineer in Berlin. Explore open-source projects, practical programming guides, courses, and free developer tools.',
    'core/tools.html': 'Free browser tools for comparing text, working with matrices, and exploring algorithms, statistics, and physics through interactive visualizers.',
}


def label(path):
    text = re.sub(r'^\d+[_ ]*', '', path.stem).replace('_', ' ').strip().title()
    return re.sub(r'\b(Api|Http|Sql|Rpc|Dbms|Nosql)\b', lambda m: {'Nosql': 'NoSQL'}.get(m[0], m[0].upper()), text)


@lru_cache(maxsize=None)
def page_heading(path):
    if not path.exists():
        return label(path)
    text = path.read_text()
    match = re.search(r'<h1\b[^>]*>(.*?)</h1>', text, re.S)
    return BeautifulSoup('<span>' + match[1] + '</span>', 'html.parser').get_text(' ', strip=True) if match else label(path)


@lru_cache(maxsize=None)
def dimensions(path):
    try:
        with Image.open(path) as image:
            return image.size
    except (OSError, ValueError):
        return None


def update_tag(match, transform):
    soup = BeautifulSoup(match.group(0), 'html.parser')
    tag = soup.find()
    original_attrs = dict(tag.attrs)
    transform(tag)
    if tag.attrs == original_attrs:
        return match.group(0)
    return str(tag).split('>', 1)[0] + '>'


def enhance(text, path):
    relative = path.relative_to(ROOT).as_posix()
    if 'http-equiv="refresh"' in text or 'resources/style.css' not in text or not re.search(r'<nav\b', text):
        return text
    if relative in TITLES:
        title = TITLES[relative]
        text = re.sub(r'<title>.*?</title>', '<title>' + html.escape(title) + '</title>', text, count=1, flags=re.S)
        if relative.startswith('articles/'):
            text = re.sub(r'(<h1\b[^>]*>).*?(</h1>)', lambda m: m[1] + html.escape(title) + m[2], text, count=1, flags=re.S)
        def metadata(tag):
            if tag.get('property') == 'og:title':
                tag['content'] = title
        text = re.sub(r'<meta\b[^>]*>', lambda m: update_tag(m, metadata), text)
    if relative in DESCRIPTIONS:
        def description(tag):
            if tag.get('name') == 'description' or tag.get('property') == 'og:description':
                tag['content'] = DESCRIPTIONS[relative]
        text = re.sub(r'<meta\b[^>]*>', lambda m: update_tag(m, description), text)
    if relative in TITLES or relative in DESCRIPTIONS:
        def structured(match):
            data = json.loads(match[2])
            if relative in TITLES:
                for key in ('name', 'headline'):
                    if key in data:
                        data[key] = TITLES[relative]
            if relative in DESCRIPTIONS:
                data['description'] = DESCRIPTIONS[relative]
            return match[1] + json.dumps(data, ensure_ascii=True) + match[3]
        text = re.sub(r'(<script\b[^>]*id="structured-data"[^>]*>)(.*?)(</script>)', structured, text, flags=re.S)

    def navigation(match):
        nav = re.sub(r' role="(?:menu|menuitem)"', '', match[0])
        nav = nav.replace(' aria-labelledby="navbar-toggle"', '')
        section = ('Blog' if relative.startswith('articles/') else 'Tools' if relative.startswith('tools/') else
                   'Courses' if relative.startswith('courses/') else
                   {'index.html': 'Home', 'core/tools.html': 'Tools', 'core/courses.html': 'Courses',
                    'core/projects.html': 'Projects', 'core/resume.html': 'Resume'}.get(relative))
        def active_link(link_match):
            tag = BeautifulSoup(link_match[0], 'html.parser').a
            tag.attrs.pop('aria-current', None)
            if tag.get_text(strip=True) == section:
                current = 'page' if relative in ('index.html', 'core/tools.html', 'core/projects.html', 'core/courses.html', 'core/resume.html', 'articles/blog_1.html') else 'true'
                return re.sub(r' aria-current="[^"]*"', '', link_match[0]).replace('>', f' aria-current="{current}">', 1)
            return re.sub(r' aria-current="[^"]*"', '', link_match[0])
        return re.sub(r'<a\b[^>]*>.*?</a>', active_link, nav, flags=re.S)
    text = re.sub(r'<nav\b[^>]*>.*?</nav>', navigation, text, count=1, flags=re.S)
    if 'class="skip-link"' not in text:
        text = re.sub(r'(<body\b[^>]*>)', r'\1\n    <a class="skip-link" href="#main-content">Skip to content</a>', text, count=1)
    existing_main = re.search(r'<main\b[^>]*>', text)
    if existing_main:
        def focus_main(tag):
            tag['tabindex'] = '-1'
            if not tag.get('id'):
                tag['id'] = 'main-content'
        opening = update_tag(existing_main, focus_main)
        target = BeautifulSoup(opening, 'html.parser').main['id']
        text = text[:existing_main.start()] + opening + text[existing_main.end():]
        text = text.replace('class="skip-link" href="#main-content"', f'class="skip-link" href="#{target}"')
    if not re.search(r'<main\b', text):
        text = text.replace('</nav>', '</nav>\n    <main class="site-main" id="main-content" tabindex="-1">', 1)
        if '<footer' in text:
            text = text.replace('<footer', '</main>\n    <footer', 1)
        else:
            text = text.replace('</body>', '</main>\n</body>', 1)

    if relative.startswith(('articles/', 'tools/')) and 'class="breadcrumbs"' not in text:
        crumbs = [('<a href="/index.html">Home</a>')]
        if relative.startswith('tools/'):
            crumbs.append('<a href="/core/tools.html">Tools</a>')
        else:
            crumbs.append('<a href="/articles/blog_1.html">Writing</a>')
            parts = Path(relative).parts
            if len(parts) > 2:
                category = ROOT / 'articles' / (parts[1] + '.html')
                if category.exists():
                    crumbs.append(f'<a href="/{category.relative_to(ROOT).as_posix()}">{html.escape(page_heading(category))}</a>')
                if len(parts) > 3:
                    crumbs.append(html.escape(label(Path(parts[-2]))))
        crumbs.append(f'<span aria-current="page">{html.escape(TITLES.get(relative, page_heading(path)))}</span>')
        markup = '<div class="breadcrumbs" role="navigation" aria-label="Breadcrumb"><ol>' + ''.join('<li>' + c + '</li>' for c in crumbs) + '</ol></div>'
        text = re.sub(r'(<main\b[^>]*>)', lambda m: m[1] + '\n' + markup, text, count=1)

    if relative.startswith('articles/') and 'id="article-body"' in text and 'class="read-next"' not in text:
        siblings = sorted(p for p in path.parent.glob('*.html') if p.read_text().strip())
        index = siblings.index(path)
        nearby = sorted((p for p in siblings if p != path), key=lambda p: (abs(siblings.index(p) - index), siblings.index(p)))[:3]
        if nearby:
            links = ''.join(f'<li><a href="/{p.relative_to(ROOT).as_posix()}">{html.escape(TITLES.get(p.relative_to(ROOT).as_posix(), page_heading(p)))}</a></li>' for p in nearby)
            text = re.sub(r'(<div\b[^>]*id="related-articles"[^>]*>)', lambda m: m[1] + '<section class="read-next" aria-label="Read next"><h2>Read next</h2><ul>' + links + '</ul></section>', text, count=1)

    def image_tag(tag):
        source = urlparse(tag.get('src', '')).path
        local = ROOT / source.lstrip('/') if source.startswith('/') else path.parent / source
        size = dimensions(local.resolve()) if source and not urlparse(tag.get('src', '')).netloc else None
        if size and not tag.get('width') and not tag.get('height'):
            tag['width'], tag['height'] = map(str, size)
        # Only known below-the-fold content; keep logos and lead images eager.
        if tag.get('class') and 'footer-mark' in tag['class']:
            tag['loading'] = 'lazy'
        tag['decoding'] = 'async'
    text = re.sub(r'<img\b[^>]*>', lambda m: update_tag(m, image_tag), text)
    article_start = text.find('id="article-body"')
    if article_start >= 0:
        before, article = text[:article_start], text[article_start:]
        seen = 0
        def article_image(match):
            nonlocal seen
            seen += 1
            if seen == 1:
                return match[0]
            return update_tag(match, lambda tag: tag.attrs.update(loading='lazy'))
        text = before + re.sub(r'<img\b[^>]*>', article_image, article)
    text = re.sub(r'<script\b([^>]*src="[^"]*prism[^\"]*"[^>]*)>', lambda m: '<script' + m[1] + (' defer' if 'defer' not in m[1] else '') + '>', text)
    return text


def main():
    count = 0
    for path in ROOT.rglob('*.html'):
        if 'building_blocks' in path.parts:
            continue
        original = path.read_text()
        updated = enhance(original, path)
        if updated != original:
            path.write_text(updated)
            count += 1
    print(f'Enhanced {count} pages')


if __name__ == '__main__':
    main()
