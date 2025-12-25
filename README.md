# Personal Website

<div align="center">

[![Netlify Status](https://api.netlify.com/api/v1/badges/5a8f7823-3cef-4732-807d-6cb1838b9d4c/deploy-status)](https://app.netlify.com/projects/goofy-brahmagupta-0a14f0/deploys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg)](https://github.com/djeada/Personal-Website/graphs/commit-activity)
[![Website](https://img.shields.io/website-up-down-green-red/https/adamdjellouli.com.svg)](https://adamdjellouli.com)

</div>

Welcome to the GitHub repository for [adamdjellouli.com](https://adamdjellouli.com)! This is the source code for my personal website where I share my thoughts, projects, and various topics of interest. Your feedback, comments, and suggestions for improvements are highly appreciated.

## 📖 Overview

This repository hosts the code for my personal website. It's a space where I share my thoughts, projects, and various topics that spark my interest. The site is meticulously crafted using HTML, CSS, and TypeScript, augmented with custom Python scripts for updating common elements across pages.

## 🌐 Live Demo

Check out the live website: [adamdjellouli.com](https://adamdjellouli.com)

## 🖼️ Screenshot

![A glimpse of adamdjellouli.com](https://user-images.githubusercontent.com/37275728/185813314-328d17a4-df7c-4156-8bf0-0fb211d055eb.PNG)

## 📑 Table of Contents

- [Overview](#-overview)
- [Live Demo](#-live-demo)
- [Screenshot](#️-screenshot)
- [Philosophy](#-philosophy)
- [Building Blocks](#️-building-blocks)
- [Technologies](#-technologies)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Scripts](#-scripts)
  - [Script Descriptions](#script-descriptions)
  - [Usage](#usage)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)
- [Roadmap](#-roadmap)
- [Acknowledgments](#-acknowledgments)
- [Contact](#-contact)
- [License](#-license)

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

Follow these instructions to set up the project on your local machine for development and testing purposes.

### Prerequisites

Ensure you have the following installed on your system:

- **Node.js** (version 14.x or higher)
- **npm** (usually comes with Node.js)
- **Python 3** (version 3.7 or higher)
- **pip** (Python package manager)

You can verify your installations by running:

```bash
node --version
npm --version
python3 --version
pip3 --version
```

### Installation

Follow these steps to get your development environment set up:

1. **Clone the repository**

```bash
git clone https://github.com/djeada/Personal-Website.git
cd Personal-Website
```

2. **Install Python dependencies**

```bash
cd scripts
pip3 install -r requirements.txt
cd ..
```

3. **Run Build Scripts**

Execute the main build script to generate the website:

```bash
cd scripts
python3 run_all.py
cd ..
```

The generated website files will be available in the output directory, ready for deployment or local testing.

4. **View the website locally** (optional)

You can use any local web server to view the generated site. For example, using Python's built-in HTTP server:

```bash
cd src
python3 -m http.server 8000
```

Then open your browser and navigate to `http://localhost:8000`

## 📜 Scripts

This directory contains a set of Python scripts designed to build and maintain the personal website. Each script serves a specific purpose in the process of converting content, styling, and organizing the website's structure.

### Script Descriptions

| Script | Description |
|--------|-------------|
| **`apply_common_elements.py`** | Integrates common elements (like headers and footers) across all HTML files in the website, ensuring consistency in design and navigation. |
| **`bundle_css.py`** | Consolidates multiple CSS files from the `resources/assets` directory into a single `style.css` file. This improves page load times by reducing the number of HTTP requests. |
| **`clean_output_dirs.py`** | Cleans and prepares output directories, ensuring a fresh environment for each build process. |
| **`create_site_map.py`** | Generates a sitemap of the website, which is crucial for SEO and helps search engines index the site more effectively. |
| **`format.sh`** | A shell script to format and lint code, maintaining code quality and consistency throughout the project. |
| **`generate_article_list.py`** | Compiles a list of all articles or blog posts rendered on a specific section of the website (blog). |
| **`generate_from_markdown.py`** | Converts Markdown files, primarily used for the blog section, into HTML format for web presentation. |
| **`generate_related_articles_section.py`** | Creates a section on each article page that suggests related articles, enhancing user engagement. |
| **`generate_table_of_contents.py`** | Produces a table of contents for articles, making longer content more navigable. |
| **`get_markdown_urls.py`** | Extracts and lists URLs from Markdown files, which are sources from which the articles will be generated. |
| **`run_all.py`** | A comprehensive script that executes all the above scripts in the required sequence. It acts as a one-click solution to rebuild or update the entire website. |

### Usage

To run the entire website building process, execute:

```bash
cd scripts
python3 run_all.py
```

Alternatively, individual scripts can be run separately for specific tasks as needed. For example:

```bash
# Generate sitemap only
python3 create_site_map.py

# Bundle CSS files only
python3 bundle_css.py

# Generate articles from Markdown
python3 generate_from_markdown.py
```

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

Please ensure your code follows the existing style and all tests pass before submitting a pull request.

## 📁 Project Structure

```
Personal-Website/
├── images/              # Image assets
├── scripts/             # Build and maintenance scripts
│   ├── apply_common_elements.py
│   ├── bundle_css.py
│   ├── generate_from_markdown.py
│   ├── run_all.py
│   └── ...
├── src/                 # Source files for the website
│   ├── articles/        # Article HTML files
│   ├── building_blocks/ # Common HTML elements (header, footer)
│   ├── core/            # Core pages (about, blog, projects)
│   └── tools/           # Interactive tools
├── .gitignore
├── LICENSE
└── README.md
```

## 🔧 Troubleshooting

### Common Issues

**Issue**: Python scripts fail with module import errors

**Solution**: Ensure all dependencies are installed:
```bash
cd scripts
pip3 install -r requirements.txt
```

**Issue**: Generated website doesn't display correctly

**Solution**: Make sure you've run the complete build process:
```bash
cd scripts
python3 run_all.py
```

**Issue**: Netlify deployment fails

**Solution**: Check the Netlify badge status above and review the deployment logs in your Netlify dashboard.

### Getting Help

If you encounter any issues not listed here, please [open an issue](https://github.com/djeada/Personal-Website/issues) on GitHub.

## 🗺️ Roadmap

- [x] Basic website structure with HTML/CSS/TypeScript
- [x] Automated build scripts in Python
- [x] Blog section with Markdown support
- [x] Responsive design
- [x] SEO optimization with sitemap
- [ ] Dark mode support
- [ ] Improved accessibility features
- [ ] Performance optimization
- [ ] Multi-language support

See the [open issues](https://github.com/djeada/Personal-Website/issues) for a full list of proposed features and known issues.

## 🙏 Acknowledgments

- Thanks to all contributors who have helped improve this project
- Inspired by the philosophy of building from scratch without frameworks
- Built with love for the web development community

## 📧 Contact

Adam Djellouli - [@djeada](https://github.com/djeada)

Project Link: [https://github.com/djeada/Personal-Website](https://github.com/djeada/Personal-Website)

Website: [adamdjellouli.com](https://adamdjellouli.com)

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.
