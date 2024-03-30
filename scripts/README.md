# Scripts

This dir contains a set of Python scripts designed to build and maintain a personal website. Each script serves a specific purpose in the process of converting content, styling, and organizing the website's structure. Below is a detailed description of each script and its functionality.

## Script Descriptions

- `apply_common_elements.py`: Integrates common elements (like headers and footers) across all HTML files in the website, ensuring consistency in design and navigation.

- `bundle_css.py`: Consolidates multiple CSS files from the `resources/assets` directory into a single `style.css` file. This improves page load times by reducing the number of HTTP requests.

- `clean_output_dirs.py`: Cleans and prepares output directories, ensuring a fresh environment for each build process.

- `create_site_map.py`: Generates a sitemap of the website, which is crucial for SEO and helps search engines index the site more effectively.

- `format.sh`: A shell script to format and lint code, maintaining code quality and consistency throughout the project.

- `generate_article_list.py`: Compiles a list of all articles or blog posts rendered on a specific section of the website (blog).

- `generate_from_markdown.py`: Converts Markdown files, primarily used for the blog section, into HTML format for web presentation.

- `generate_related_articles_section.py`: Creates a section on each article page that suggests related articles, enhancing user engagement.

- `generate_table_of_contents.py`: Produces a table of contents for articles, making longer content more navigable.

- `get_markdown_urls.py`: Extracts and lists URLs from Markdown files, those are source from which the articles will be generated.

- `run_all.py`: A comprehensive script that executes all the above scripts in the required sequence. It acts as a one-click solution to rebuild or update the entire website.

## Usage

To run the entire website building process, execute:

```
python run_all.py
```

Alternatively, individual scripts can be run separately for specific tasks as needed.
