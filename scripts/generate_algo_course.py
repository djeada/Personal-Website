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

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

PLAYLIST_URL = (
    "https://www.youtube.com/playlist?list=PLjHlsBDcsWnNzmNAsb-LjVElCO3gUZbbV"
)

ROOT_DIR = Path(__file__).resolve().parent.parent
COURSE_ROOT = ROOT_DIR / "src" / "courses" / "algorithms_and_data_structures"
LESSONS_DIR = COURSE_ROOT / "lessons"
COURSE_PAGE = COURSE_ROOT / "index.html"
RESOURCE_PREFIX = "../../../"
COURSE_TITLE = "Algorithms and Data Structures"
COURSE_DESCRIPTION = (
    "Structured interview-style practice with Python walkthroughs for arrays, "
    "strings, linked lists, trees, graphs, greedy methods, and dynamic programming."
)


@dataclass
class Video:
    video_id: str
    title: str
    description: str
    index: int


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

        escaped = re.sub(
            r"(https?://[^\s<]+)",
            r'<a href="\1" target="_blank" rel="noopener">\1</a>',
            escaped,
        )

        escaped = re.sub(
            r"\b(\d{1,2}:\d{2}(?::\d{2})?)\b",
            r"<strong>\1</strong>",
            escaped,
        )
        paragraphs.append(f"<p>{escaped}</p>")
    return "\n".join(paragraphs)


def _summarize_text(text: str, fallback: str, width: int = 155) -> str:
    clean = re.sub(r"\s+", " ", text).strip()
    if not clean:
        return fallback
    return textwrap.shorten(clean, width=width, placeholder="...")


def _build_playlist_sidebar(
    videos: List[Video], slugs: List[str], current_index: int
) -> str:
    playlist_items = []
    for idx, video in enumerate(videos):
        safe_title = html_mod.escape(video.title)
        active_class = ' class="active"' if idx == current_index else ""
        playlist_items.append(
            f'<li><a href="./{slugs[idx]}.html"{active_class}>{idx + 1}. {safe_title}</a></li>'
        )
    playlist_html = "\n".join(playlist_items)

    return textwrap.dedent(
        f"""\
        <aside id="article-sidebar">
            <div id="table-of-contents" class="course-playlist">
                <h2>Course Playlist</h2>
                <ol>
                    {playlist_html}
                </ol>
            </div>
            <div id="related-articles" class="course-sidebar-summary">
                <h2>Lesson Guide</h2>
                <div class="course-sidebar-meta">
                    <p><strong>Course:</strong> {COURSE_TITLE}</p>
                    <p><strong>Lesson:</strong> {current_index + 1} of {len(videos)}</p>
                    <p><strong>Format:</strong> YouTube walkthrough</p>
                </div>
                <a href="../index.html" class="course-back-link">Back to course overview</a>
            </div>
        </aside>
        """
    )


def _build_nav_card(href: str, label: str, title: str, modifier: str) -> str:
    safe_title = html_mod.escape(textwrap.shorten(title, width=52, placeholder="..."))
    return (
        f'<a href="{href}" class="course-nav-link {modifier}">'
        f'<span class="course-nav-label">{label}</span>'
        f'<span class="course-nav-title">{safe_title}</span>'
        "</a>"
    )


def _build_nav_placeholder() -> str:
    return '<div class="course-nav-link course-nav-link-placeholder" aria-hidden="true"></div>'


def build_lesson_pages(videos: List[Video]) -> None:
    """Build all per-video lesson pages with correct prev/next links."""
    LESSONS_DIR.mkdir(parents=True, exist_ok=True)

    slugs = [_slugify(f"{v.index + 1:02d}_{v.title}") for v in videos]

    for i, video in enumerate(videos):
        num = video.index + 1
        safe_title = html_mod.escape(video.title)
        description_html = _format_description(video.description)
        lesson_summary = html_mod.escape(
            _summarize_text(
                video.description,
                "Interview-style Python walkthrough and explanation from the course playlist.",
            )
        )
        sidebar_html = _build_playlist_sidebar(videos, slugs, i)

        prev_link = _build_nav_placeholder()
        next_link = _build_nav_placeholder()
        if i > 0:
            prev_link = _build_nav_card(
                f"./{slugs[i-1]}.html",
                "Previous lesson",
                videos[i - 1].title,
                "course-nav-link-prev",
            )
        if i < len(videos) - 1:
            next_link = _build_nav_card(
                f"./{slugs[i+1]}.html",
                "Next lesson",
                videos[i + 1].title,
                "course-nav-link-next",
            )

        page = textwrap.dedent(
            f"""\
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
</head>
<body class="course-lesson-page">
    <div id="article-wrapper">
{sidebar_html}
        <article id="article-body">
            <div class="course-lesson-meta">
                <span class="course-page-badge">Video lesson</span>
                <p class="course-lesson-number">Lesson {num} of {len(videos)}</p>
            </div>
            <h1>{safe_title}</h1>
            <p class="course-lesson-summary">{lesson_summary}</p>
            <div class="video-container course-lesson-video">
                <iframe
                    src="https://www.youtube.com/embed/{video.video_id}"
                    title="{safe_title}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    loading="lazy">
                </iframe>
            </div>
"""
        )

        if description_html:
            page += f'            <section class="video-description course-lesson-description">\n{description_html}\n            </section>\n'

        page += f"""            <div class="course-lesson-nav">
                {prev_link}
                <a href="../index.html" class="course-nav-link course-nav-link-center">
                    <span class="course-nav-label">Playlist</span>
                    <span class="course-nav-title">Back to course overview</span>
                </a>
                {next_link}
            </div>
        </article>
    </div>
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
        lesson_summary = html_mod.escape(
            _summarize_text(
                video.description,
                f"Lesson {i + 1} in the playlist with a Python solution walkthrough.",
                width=135,
            )
        )
        cards.append(
            f'<a href="./lessons/{slugs[i]}.html" class="tool-card course-lesson-card">'
            f'    <div class="course-lesson-card-media">'
            f'        <img src="{thumb}" alt="{safe_title}" loading="lazy" class="course-lesson-card-thumb">'
            f'        <span class="course-lesson-card-index">Lesson {i + 1}</span>'
            f"    </div>"
            f'    <div class="course-lesson-card-content">'
            f"        <h3>{safe_title}</h3>"
            f"        <p>{lesson_summary}</p>"
            f"    </div>"
            f"</a>"
        )
    cards_html = "\n".join(cards)

    lessons_html = textwrap.dedent(
        f"""\
        <div class="course-overview-card reveal">
            <div class="course-overview-copy">
                <span class="course-page-badge">Video course</span>
                <h3>Interview-focused problem solving in Python</h3>
                <p>{COURSE_DESCRIPTION}</p>
            </div>
            <div class="course-overview-stats">
                <div class="course-stat-card">
                    <span class="course-stat-value">{len(videos)}</span>
                    <span class="course-stat-label">Lessons</span>
                </div>
                <div class="course-stat-card">
                    <span class="course-stat-value">Python</span>
                    <span class="course-stat-label">Language</span>
                </div>
                <div class="course-stat-card">
                    <span class="course-stat-value">YouTube</span>
                    <span class="course-stat-label">Format</span>
                </div>
            </div>
        </div>
        <div class="tools-grid course-lessons-grid reveal-stagger">
            {cards_html}
        </div>
        """
    )
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
