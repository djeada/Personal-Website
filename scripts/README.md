# Scripts

This dir contains a set of Python scripts designed to build and maintain a personal website. Each script serves a specific purpose in the process of converting content, styling, and organizing the website's structure. Below is a detailed description of each script and its functionality.

## Script Descriptions

- `apply_common_elements.py`: Integrates common elements (like headers and footers) across all HTML files in the website, ensuring consistency in design and navigation.

- `bundle_css.py`: Consolidates multiple CSS files from the `resources/assets` directory into a single `style.css` file. This improves page load times by reducing the number of HTTP requests.

- `clean_output_dirs.py`: Clears the generated article directories. `generate_from_markdown.py` calls it only after every markdown source downloaded successfully, so a failed fetch never leaves the site half-built.

- `create_site_map.py`: Generates `sitemap.xml` from each page's canonical URL, skipping redirect stubs, `noindex` pages, empty files and verification files. `lastmod` is the article date or the page's last commit.

- `format.sh`: A shell script to format and lint code, maintaining code quality and consistency throughout the project.

- `generate_article_list.py`: Compiles a list of all articles or blog posts rendered on a specific section of the website (blog).

- `generate_from_markdown.py`: Converts the Markdown notes into article pages. It fetches every source first (with retries), stamps each article with the date of its last upstream commit (see `source_dates.py`), turns links between notes into links between articles, and only loads Prism and MathJax on pages with code or math.

- `source_dates.py`: Keeps blobless clones of the note repositories in `scripts/.source-cache/` (git-ignored) and reads the last commit date of each markdown file. Articles only show a new "Last modified" date when their source actually changed.

- `generate_related_articles_section.py`: Creates a section on each article page that suggests related articles, enhancing user engagement.

- `localize_article_images.py`: Downloads GitHub-hosted images referenced by the generated articles, resizes them to at most 960 px wide, converts them to WebP and rewrites the `<img>` tags to point at `src/resources/article-images/`. Results are cached in `article_images_manifest.json`, so a rebuild only downloads new images; pass `--refresh` to re-download everything. Images no article references anymore are deleted.

- `generate_table_of_contents.py`: Produces a table of contents for articles, making longer content more navigable.

- `get_markdown_urls.py`: Extracts and lists URLs from Markdown files, those are source from which the articles will be generated.

- `restore_broken_js.py`: Used by `format.sh`. js-beautify can mangle nested template literals, so any JS file it leaves with broken syntax is put back as it was. `strip_comments.py` applies the same check and skips files it would break.

- `run_all.py`: A comprehensive script that executes all the above scripts in the required sequence. It acts as a one-click solution to rebuild or update the entire website.

## Usage

To run the entire website building process, execute:

```
python run_all.py
```

Alternatively, individual scripts can be run separately for specific tasks as needed.

## Layout stability

Keep Google Fonts links on `display=optional` in both templates and generated
pages: slow downloads should leave the fallback font in place for that visit,
instead of reflowing visible text. The contents generator emits `class="collapsed"`
so mobile articles start in the same layout that `app.js` initializes. Desktop
contents remain expanded through CSS, and links remain visible without JavaScript.

The shared logo CSS reserves the dimensions of both logo variants before they
download. After editing shared CSS, run `python bundle_css.py` from this directory.
Run `npx playwright test tests/layout-stability.spec.js` from the repository root
to check delayed logo loading, delayed article initialization, search insertion,
and contents accessibility without JavaScript. These tests isolate third parties;
check live ads and real-user CLS separately after deployment.
