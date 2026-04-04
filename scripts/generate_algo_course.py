"""Fetch the Algorithms & Data Structures YouTube playlist and generate
one lesson page per video plus update the course index page.

Requires ``yt-dlp`` to be installed (used at build time only).
"""

import html as html_mod
import json
import logging
import re
import subprocess
import textwrap
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLjHlsBDcsWnNzmNAsb-LjVElCO3gUZbbV"

ROOT_DIR = Path(__file__).resolve().parent.parent
COURSE_ROOT = ROOT_DIR / "src" / "courses" / "algorithms_and_data_structures"
LESSONS_DIR = COURSE_ROOT / "lessons"
COURSE_PAGE = COURSE_ROOT / "index.html"
FOOTER_TEMPLATE = ROOT_DIR / "src" / "building_blocks" / "footer_article.html"
RESOURCE_PREFIX = "../../../"


@dataclass
class Video:
    video_id: str
    title: str
    description: str
    index: int  # 0-based position in playlist


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return slug[:80] or "video"


def fetch_playlist() -> List[Video]:
    """Use yt-dlp to get flat playlist metadata."""
    logging.info("Fetching playlist metadata from YouTube …")
    result = subprocess.run(
        [
            "yt-dlp",
            "--flat-playlist",
            "--dump-json",
            "--no-warnings",
            PLAYLIST_URL,
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        logging.error("yt-dlp failed: %s", result.stderr)
        raise RuntimeError("yt-dlp failed – is it installed?")

    videos: List[Video] = []
    for idx, line in enumerate(result.stdout.strip().splitlines()):
        data = json.loads(line)
        videos.append(
            Video(
                video_id=data.get("id", ""),
                title=data.get("title", f"Video {idx + 1}"),
                description=data.get("description") or "",
                index=idx,
            )
        )
    logging.info("Found %d videos in playlist.", len(videos))
    return videos


def _format_description(description: str) -> str:
    """Convert a plain-text YouTube description into simple HTML."""
    if not description.strip():
        return ""
    paragraphs = []
    for block in re.split(r"\n{2,}", description.strip()):
        lines = block.strip().splitlines()
        escaped = "<br>\n".join(html_mod.escape(l) for l in lines)
        # Convert URLs to links
        escaped = re.sub(
            r"(https?://[^\s<]+)",
            r'<a href="\1" target="_blank" rel="noopener">\1</a>',
            escaped,
        )
        # Convert timestamps like 0:00 or 1:23:45 to bold
        escaped = re.sub(
            r"\b(\d{1,2}:\d{2}(?::\d{2})?)\b",
            r"<strong>\1</strong>",
            escaped,
        )
        paragraphs.append(f"<p>{escaped}</p>")
    return "\n".join(paragraphs)


def build_lesson_pages(videos: List[Video]) -> None:
    """Build all per-video lesson pages with correct prev/next links."""
    LESSONS_DIR.mkdir(parents=True, exist_ok=True)

    # First pass: compute slugs
    slugs = [_slugify(f"{v.index + 1:02d}_{v.title}") for v in videos]

    for i, video in enumerate(videos):
        num = video.index + 1
        safe_title = html_mod.escape(video.title)
        description_html = _format_description(video.description)

        # Prev/next
        prev_link = ""
        next_link = ""
        if i > 0:
            prev_link = f'<a href="./{slugs[i-1]}.html" class="lesson-nav-prev">&larr; Previous</a>'
        if i < len(videos) - 1:
            next_link = f'<a href="./{slugs[i+1]}.html" class="lesson-nav-next">Next &rarr;</a>'

        footer_html = ""
        if FOOTER_TEMPLATE.exists():
            footer_html = FOOTER_TEMPLATE.read_text(encoding="utf-8")

        page = textwrap.dedent(f"""\
<!DOCTYPE html>
<html lang="en">
<head>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5593122079896089" crossorigin="anonymous"></script>
    <meta charset="utf-8">
    <title>{safe_title} | Algorithms and Data Structures Course</title>
    <meta name="description" content="{safe_title} — video lesson from the Algorithms and Data Structures course by Adam Djellouli.">
    <meta name="author" content="Adam Djellouli">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
    <link rel="icon" href="https://raw.githubusercontent.com/djeada/Personal-Website/master/images/icon.ico">
    <link rel="stylesheet" href="{RESOURCE_PREFIX}resources/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="canonical" href="https://adamdjellouli.com/courses/algorithms_and_data_structures/lessons/{slugs[i]}">
    <script id="structured-data" type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": "{safe_title}",
        "description": "{safe_title} — video lesson from the Algorithms and Data Structures course.",
        "thumbnailUrl": "https://img.youtube.com/vi/{video.video_id}/maxresdefault.jpg",
        "embedUrl": "https://www.youtube.com/embed/{video.video_id}",
        "author": {{
            "@type": "Person",
            "name": "Adam Djellouli"
        }}
    }}
    </script>
    <style>
        .video-container {{
            position: relative;
            width: 100%;
            padding-bottom: 56.25%;
            margin: 1.5em 0;
            border-radius: var(--radius-sm, 8px);
            overflow: hidden;
            background: var(--surface-1, #f1f5f9);
        }}
        .video-container iframe {{
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: 0;
        }}
        .lesson-nav {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 2em 0;
            padding: 1em 0;
            border-top: 1px solid var(--border-default, rgba(0,0,0,0.06));
        }}
        .lesson-nav a {{
            display: inline-flex;
            align-items: center;
            gap: 0.5em;
            padding: 0.6em 1.2em;
            border-radius: var(--radius-sm, 8px);
            background: var(--surface-1, #f1f5f9);
            color: var(--text-primary, #0f172a);
            text-decoration: none;
            font-weight: 500;
            transition: background 0.2s;
        }}
        .lesson-nav a:hover {{
            background: var(--accent, #3b82f6);
            color: #fff;
        }}
        .video-description {{
            margin: 2em 0;
            padding: 1.25em;
            background: var(--surface-1, #f1f5f9);
            border-radius: var(--radius-sm, 8px);
            border: 1px solid var(--border-default, rgba(0,0,0,0.06));
            line-height: 1.7;
        }}
        .video-description p {{
            margin: 0.5em 0;
        }}
        .lesson-number {{
            color: var(--text-secondary, #64748b);
            font-size: 0.9em;
            font-weight: 500;
            margin-bottom: 0.25em;
        }}
    </style>
</head>
<body>
    <nav aria-label="Main navigation">
        <a class="logo" href="{RESOURCE_PREFIX}index.html">
            <img id="logo-image" src="https://raw.githubusercontent.com/djeada/Personal-Website/master/images/logo.PNG" alt="Adam Djellouli - Home Page Logo">
        </a>
        <input id="navbar-toggle" type="checkbox" aria-label="Toggle navigation menu" />
        <ul role="menu" aria-labelledby="navbar-toggle">
            <li role="menuitem"><a href="{RESOURCE_PREFIX}index.html" title="Go to Home Page"> Home </a></li>
            <li role="menuitem"><a href="{RESOURCE_PREFIX}core/blog.html" title="Read Adam Djellouli Blog on Programming and Technology"> Blog </a></li>
            <li role="menuitem"><a href="{RESOURCE_PREFIX}core/tools.html" title="Discover Tools Created by Adam Djellouli"> Tools </a></li>
            <li role="menuitem"><a href="{RESOURCE_PREFIX}core/projects.html" title="Explore Projects Developed by Adam Djellouli"> Projects </a></li>
            <li role="menuitem"><a href="{RESOURCE_PREFIX}core/courses.html" title="Browse Courses by Adam Djellouli"> Courses </a></li>
            <li role="menuitem"><a href="{RESOURCE_PREFIX}core/resume.html" title="View Adam Djellouli Professional Resume"> Resume </a></li>
            <li><script async src="https://cse.google.com/cse.js?cx=8160ef9bb935f4f68"></script><div class="gcse-search"></div></li>
            <li><button id="dark-mode-button" aria-label="Toggle dark mode"></button></li>
        </ul>
    </nav>
    <div id="article-wrapper">
        <article id="article-body">
            <p class="lesson-number">Lesson {num} of {len(videos)}</p>
            <h1>{safe_title}</h1>
            <div class="video-container">
                <iframe
                    src="https://www.youtube.com/embed/{video.video_id}"
                    title="{safe_title}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    loading="lazy">
                </iframe>
            </div>
""")

        if description_html:
            page += f'        <div class="video-description">\n{description_html}\n        </div>\n'

        page += f"""        <div class="lesson-nav">
            <span>{prev_link}</span>
            <span>{next_link}</span>
        </div>
        </article>
    </div>
{footer_html}
</body>
</html>
"""
        out_path = LESSONS_DIR / f"{slugs[i]}.html"
        out_path.write_text(page, encoding="utf-8")
        logging.info("  wrote %s", out_path.name)


def update_course_page(videos: List[Video]) -> None:
    """Update index.html lesson cards between markers."""
    if not COURSE_PAGE.exists():
        logging.warning("Course page not found: %s", COURSE_PAGE)
        return

    slugs = [_slugify(f"{v.index + 1:02d}_{v.title}") for v in videos]
    html = COURSE_PAGE.read_text(encoding="utf-8")

    cards = []
    for i, video in enumerate(videos):
        safe_title = html_mod.escape(video.title)
        thumb = f"https://img.youtube.com/vi/{video.video_id}/mqdefault.jpg"
        cards.append(
            f'<a href="./lessons/{slugs[i]}.html" class="tool-card">'
            f"<img src=\"{thumb}\" alt=\"{safe_title}\" loading=\"lazy\" "
            f'style="width:100%;border-radius:6px 6px 0 0;aspect-ratio:16/9;object-fit:cover;">'
            f"<h3>{i + 1}. {safe_title}</h3>"
            f"</a>"
        )

    lessons_html = '<div class="tools-grid">\n' + "\n".join(cards) + "\n</div>"
    pattern = r"<!-- LESSONS:START -->.*?<!-- LESSONS:END -->"
    replacement = f"<!-- LESSONS:START -->\n{lessons_html}\n<!-- LESSONS:END -->"
    updated = re.sub(pattern, lambda _: replacement, html, flags=re.S)
    COURSE_PAGE.write_text(updated, encoding="utf-8")
    logging.info("Updated course index with %d lesson cards.", len(videos))


def main() -> None:
    try:
        videos = fetch_playlist()
    except (RuntimeError, FileNotFoundError) as exc:
        logging.warning("Skipping algo course generation: %s", exc)
        return

    if not videos:
        logging.warning("Playlist returned 0 videos – skipping.")
        return

    build_lesson_pages(videos)
    update_course_page(videos)
    logging.info("Done – %d lessons generated.", len(videos))


if __name__ == "__main__":
    main()
