# Personal Website

Welcome to the GitHub repository for [adamdjellouli.com](https://adamdjellouli.com)! Your feedback, comments, and suggestions for improvements are highly appreciated. Your support is invaluable to me.

[![Netlify Status](https://api.netlify.com/api/v1/badges/5a8f7823-3cef-4732-807d-6cb1838b9d4c/deploy-status)](https://app.netlify.com/projects/goofy-brahmagupta-0a14f0/deploys)

## 📖 Overview

This repository hosts the code for my personal website. It's a space where I share my thoughts, projects, and various topics that spark my interest. The site is meticulously crafted using HTML, CSS, and TypeScript, augmented with custom Python scripts for updating common elements across pages.

## 🌐 Live Demo

Check out the live website: [adamdjellouli.com](https://adamdjellouli.com)

## 🖼️ Screenshot

![A glimpse of adamdjellouli.com](https://user-images.githubusercontent.com/37275728/185813314-328d17a4-df7c-4156-8bf0-0fb211d055eb.PNG)

## 📑 Table of Contents

- [Philosophy](#💡-philosophy)
- [Building Blocks](#🛠️-building-blocks)
- [Technologies](#🔧-technologies)
- [Getting Started](#🚀-getting-started)
- [Scripts](#📜-scripts)
- [Contributing](#🤝-contributing)
- [License](#📄-license)

## 💡 Philosophy

- **Dedication to Originality**: No use of boilerplates, templates, or frameworks.
- **From Scratch**: Building everything from the ground up with HTML, CSS, and TypeScript.
- **Automation**: Regular updates to all common page elements through custom Python scripts for consistency and efficiency.

## 🛠️ Building Blocks

The website consists of these fundamental components:

### **HTML Elements**

- Header
- Navigation Bar
- Footer
- Main Content Section
- Individual Article Pages

### **CSS Files**

- General Components
- Navigation Bar Styling
- Footer Styling

## 🔧 Technologies

This project employs the following technologies:

- [HTML5](https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/HTML5)
- [CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS)
- [TypeScript](https://www.typescriptlang.org/)
- [Python](https://www.python.org/) (for build scripts)

## 🚀 Getting Started

### Prerequisites

- **Node.js** and **npm** installed.
- **Python 3** installed.

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/yourrepository.git
cd yourrepository
```

2. **Run Build Scripts**

```bash
python run_all.py
```

## 📜 Scripts

This directory contains a set of Python scripts designed to build and maintain the personal website. Each script serves a specific purpose in the process of converting content, styling, and organizing the website's structure.

### Script Descriptions

- **`apply_common_elements.py`**: Integrates common elements (like headers and footers) across all HTML files in the website, ensuring consistency in design and navigation.

- **`bundle_css.py`**: Consolidates multiple CSS files from the `resources/assets` directory into a single `style.css` file. This improves page load times by reducing the number of HTTP requests.

- **`clean_output_dirs.py`**: Cleans and prepares output directories, ensuring a fresh environment for each build process.

- **`create_site_map.py`**: Generates a sitemap of the website, which is crucial for SEO and helps search engines index the site more effectively.

- **`format.sh`**: A shell script to format and lint code, maintaining code quality and consistency throughout the project.

- **`generate_article_list.py`**: Compiles a list of all articles or blog posts rendered on a specific section of the website (blog).

- **`generate_from_markdown.py`**: Converts Markdown files, primarily used for the blog section, into HTML format for web presentation.

- **`generate_related_articles_section.py`**: Creates a section on each article page that suggests related articles, enhancing user engagement.

- **`generate_table_of_contents.py`**: Produces a table of contents for articles, making longer content more navigable.

- **`get_markdown_urls.py`**: Extracts and lists URLs from Markdown files, which are sources from which the articles will be generated.

- **`run_all.py`**: A comprehensive script that executes all the above scripts in the required sequence. It acts as a one-click solution to rebuild or update the entire website.

### Usage

To run the entire website building process, execute:

```bash
python run_all.py
```

Alternatively, individual scripts can be run separately for specific tasks as needed.

## 🤝 Contributing

We encourage contributions that enhance the repository's value. To contribute:

1. **Fork the repository**

2. **Create your feature branch**

```bash
git checkout -b feature/AmazingFeature
```

3. **Commit your changes**

```bash
git commit -m 'Add some AmazingFeature'
```

4. **Push to the branch**

```bash
git push origin feature/AmazingFeature
```

5. **Open a Pull Request**

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.
