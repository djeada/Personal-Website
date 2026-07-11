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
CHANNEL_URL = "https://www.youtube.com/channel/UCGPoHTVjMN77wcGknXPHl1Q"

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

TOPIC_RULES = [
    ("Trees & tries", ("tree", "subtree", "bst", "trie", "ancestor")),
    ("Graphs", ("graph", "island", "course schedule", "pacific atlantic", "visiting all nodes")),
    ("Linked lists", ("linked list", "node from end", "reorder list", "merge k sorted lists")),
    ("Dynamic programming", ("subsequence", "coin change", "house robber", "decode ways", "unique paths", "climbing stairs", "word break", "partition array", "maximum product subarray", "palindromic substring")),
    ("Intervals & greedy", ("interval", "jump game", "flower", "pair chain", "stock", "buy and sell")),
    ("Bits & math", ("bits", "missing number", "sum of two integers")),
    ("Backtracking", ("combination sum", "word search")),
    ("Heaps & design", ("median from data stream", "top k frequent", "design add")),
    ("Two pointers & windows", ("substring", "palindrome", "container", "triplet", "character replacement")),
]


def _topic_for_title(title: str) -> str:
    """Assign a friendly study topic using stable title keywords."""
    lowered = title.lower()
    for topic, keywords in TOPIC_RULES:
        if any(re.search(rf"\b{re.escape(keyword)}\b", lowered) for keyword in keywords):
            return topic
    return "Arrays & hashing"


def _topic_slug(topic: str) -> str:
    return _slugify(topic).replace("_", "-")


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


def load_existing_playlist() -> List[Video]:
    """Recover video IDs and titles from the generated index for offline builds."""
    if not COURSE_PAGE.exists():
        return []
    page = COURSE_PAGE.read_text(encoding="utf-8")
    matches = re.findall(
        r'<img\s+src="https://img\.youtube\.com/vi/([^/]+)/[^\"]+"[^>]*>.*?<h3>(.*?)</h3>',
        page,
        flags=re.S,
    )
    videos = [
        Video(
            video_id=video_id,
            title=html_mod.unescape(re.sub(r"<[^>]+>", "", title)).strip(),
            description="",
            index=index,
        )
        for index, (video_id, title) in enumerate(matches)
    ]
    logging.info("Recovered %d videos from the existing course page.", len(videos))
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
        topic = _topic_for_title(video.title)
        active_class = ' class="active"' if idx == current_index else ""
        playlist_items.append(
            f'<li data-course-lesson="{idx + 1}"><a href="./{slugs[idx]}.html"{active_class}>'
            f'<span>{idx + 1}. {safe_title}</span><small>{html_mod.escape(topic)}</small></a></li>'
        )
    playlist_html = "\n".join(playlist_items)

    return textwrap.dedent(
        f"""\
        <aside id="article-sidebar" class="course-lesson-sidebar">
            <div class="course-sidebar-progress" aria-label="Course progress">
                <span class="course-eyebrow">Your progress</span>
                <strong><span data-course-completed-count>0</span> of {len(videos)} complete</strong>
                <div class="course-progress-track"><span data-course-progress-bar></span></div>
                <a href="../index.html">Course overview</a>
            </div>
            <details id="table-of-contents" class="course-playlist" open>
                <summary>All {len(videos)} lessons</summary>
                <ol>{playlist_html}</ol>
            </details>
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
        topic = _topic_for_title(video.title)
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
<body class="course-lesson-page" data-course-page="lesson" data-lesson-number="{num}" data-lesson-total="{len(videos)}">
    <div id="article-wrapper">
{sidebar_html}
        <article id="article-body">
            <div class="course-breadcrumbs" aria-label="Breadcrumb">
                <a href="../index.html">Algorithms &amp; Data Structures</a>
                <span aria-hidden="true">/</span>
                <span>Lesson {num}</span>
            </div>
            <div class="course-lesson-meta">
                <span class="course-page-badge">{html_mod.escape(topic)}</span>
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
            <div class="course-watch-actions">
                <button type="button" class="course-complete-button" data-course-complete="{num}">
                    <span data-complete-label>Mark lesson complete</span>
                </button>
                <a href="https://www.youtube.com/watch?v={video.video_id}" target="_blank" rel="noopener" class="course-youtube-button">Watch on YouTube <span aria-hidden="true">↗</span></a>
            </div>
            <section class="course-lesson-method" aria-labelledby="lesson-method-title">
                <div><span class="course-step-number">1</span><h2 id="lesson-method-title">Understand</h2><p>Identify the inputs, output, and edge cases.</p></div>
                <div><span class="course-step-number">2</span><h2>Try it</h2><p>Pause and sketch a solution before the implementation begins.</p></div>
                <div><span class="course-step-number">3</span><h2>Compare</h2><p>Finish the walkthrough, then explain the complexity aloud.</p></div>
            </section>
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
    <script src="../course.js"></script>
</body>
</html>
"""
        out_path = LESSONS_DIR / f"{slugs[i]}.html"
        out_path.write_text(page, encoding="utf-8")
        logging.info("  wrote %s", out_path.name)


def update_course_page(videos: List[Video]) -> None:
    """Build a navigable, searchable course overview between marker comments."""
    if not COURSE_PAGE.exists():
        logging.warning("Course page not found: %s", COURSE_PAGE)
        return

    slugs = [_slugify(f"{v.index + 1:02d}_{v.title}") for v in videos]
    html = COURSE_PAGE.read_text(encoding="utf-8")
    cards = []

    for i, video in enumerate(videos):
        safe_title = html_mod.escape(video.title)
        topic = _topic_for_title(video.title)
        lesson_summary = html_mod.escape(_summarize_text(
            video.description,
            "Step-by-step Python solution with the core pattern and complexity explained.",
            width=120,
        ))
        cards.append(textwrap.dedent(f"""\
            <article class="tool-card course-lesson-card" data-course-card data-topic="{_topic_slug(topic)}" data-title="{safe_title.lower()}" data-lesson-number="{i + 1}">
                <a href="./lessons/{slugs[i]}.html" class="course-card-main" aria-label="Open lesson {i + 1}: {safe_title}">
                    <div class="course-lesson-card-media">
                        <img src="https://img.youtube.com/vi/{video.video_id}/mqdefault.jpg" alt="" loading="lazy" class="course-lesson-card-thumb">
                        <span class="course-lesson-card-index">{i + 1}</span>
                        <span class="course-card-status" data-course-card-status>Not started</span>
                    </div>
                    <div class="course-lesson-card-content">
                        <span class="course-topic-label">{html_mod.escape(topic)}</span>
                        <h3>{safe_title}</h3>
                        <p>{lesson_summary}</p>
                    </div>
                </a>
                <div class="course-card-actions">
                    <a href="./lessons/{slugs[i]}.html">Open lesson <span aria-hidden="true">→</span></a>
                    <a href="https://www.youtube.com/watch?v={video.video_id}" target="_blank" rel="noopener" aria-label="Watch {safe_title} on YouTube">YouTube <span aria-hidden="true">↗</span></a>
                </div>
            </article>""").rstrip())

    cards_html = "\n".join(cards)
    topics = list(dict.fromkeys(_topic_for_title(video.title) for video in videos))
    topic_filters = "\n".join(
        f'<button type="button" class="course-filter" data-course-filter="{_topic_slug(topic)}">{html_mod.escape(topic)}</button>'
        for topic in topics
    )

    lessons_html = textwrap.dedent(f"""\
        <div class="course-overview-card" data-course-page="overview" data-lesson-total="{len(videos)}">
            <div class="course-overview-copy">
                <span class="course-page-badge">Free video course · Python</span>
                <h2>Build the patterns behind coding interviews</h2>
                <p>{COURSE_DESCRIPTION} Watch the explanation, pause to solve, then compare your approach.</p>
                <div class="course-overview-actions">
                    <a href="./lessons/{slugs[0]}.html" class="course-start-button" data-course-continue>Start lesson 1 <span aria-hidden="true">→</span></a>
                    <a href="{PLAYLIST_URL}" class="course-playlist-link" target="_blank" rel="noopener">YouTube playlist <span aria-hidden="true">↗</span></a>
                </div>
            </div>
            <div class="course-overview-stats">
                <div class="course-stat-card"><span class="course-stat-value"><span data-course-completed-count>0</span> / {len(videos)}</span><span class="course-stat-label">Lessons complete</span></div>
                <div class="course-stat-card"><span class="course-stat-value">10</span><span class="course-stat-label">Core topic groups</span></div>
                <div class="course-stat-card"><span class="course-stat-value">Free</span><span class="course-stat-label">Self-paced</span></div>
                <div class="course-progress-track" aria-label="Course progress"><span data-course-progress-bar></span></div>
            </div>
        </div>
        <section class="course-how" aria-labelledby="course-how-title">
            <div class="course-section-heading"><span class="course-page-badge">A clear routine</span><h2 id="course-how-title">How to use this course</h2></div>
            <div class="course-how-grid">
                <div><span>01</span><h3>Watch the setup</h3><p>Understand the problem, constraints, and pattern being tested.</p></div>
                <div><span>02</span><h3>Pause and solve</h3><p>Write your own Python solution before seeing the full walkthrough.</p></div>
                <div><span>03</span><h3>Compare and mark done</h3><p>Review complexity, finish the lesson, and continue where you stopped.</p></div>
            </div>
        </section>
        <aside class="course-channel-card">
            <div><span class="course-page-badge">Learn with Adam</span><h2>Prefer learning directly on YouTube?</h2><p>Open the complete playlist or visit the channel for more programming walkthroughs.</p></div>
            <div class="course-overview-actions"><a href="{PLAYLIST_URL}" target="_blank" rel="noopener" class="course-youtube-primary">Play the full playlist <span aria-hidden="true">▶</span></a><a href="{CHANNEL_URL}" target="_blank" rel="noopener" class="course-channel-link">Visit my channel <span aria-hidden="true">↗</span></a></div>
        </aside>
        <section class="course-curriculum" aria-labelledby="curriculum-title">
            <div class="course-section-heading"><span class="course-page-badge">Curriculum</span><h2 id="curriculum-title">Choose your next problem</h2><p>Start at lesson 1 for the full path, or filter by the pattern you want to practise.</p></div>
            <div class="course-discovery" role="search"><label for="course-search">Find a lesson</label><div class="course-search-wrap"><span aria-hidden="true">⌕</span><input id="course-search" type="search" placeholder="Search by problem or LeetCode number…" autocomplete="off"></div></div>
            <div class="course-filters" aria-label="Filter lessons by topic"><button type="button" class="course-filter is-active" data-course-filter="all">All lessons</button>{topic_filters}</div>
            <p class="course-results" aria-live="polite"><strong data-course-result-count>{len(videos)}</strong> lessons shown</p>
        </section>
        <div class="tools-grid course-lessons-grid" data-course-grid>{cards_html}</div>
        <div class="course-empty" data-course-empty hidden><h3>No lessons found</h3><p>Try a different problem name, number, or topic.</p></div>
        <script src="./course.js"></script>
    """)
    pattern = r"<!-- LESSONS:START -->.*?<!-- LESSONS:END -->"
    replacement = f"<!-- LESSONS:START -->\n{lessons_html}\n<!-- LESSONS:END -->"
    updated = re.sub(pattern, lambda _: replacement, html, flags=re.S)
    COURSE_PAGE.write_text(updated, encoding="utf-8")
    logging.info("Updated course index with %d lesson cards.", len(videos))


def main() -> None:
    try:
        videos = fetch_playlist()
    except (RuntimeError, FileNotFoundError) as exc:
        logging.warning("YouTube fetch unavailable (%s); using existing metadata.", exc)
        videos = load_existing_playlist()

    if not videos:
        logging.warning("Playlist returned 0 videos – skipping.")
        return

    build_lesson_pages(videos)
    update_course_page(videos)
    logging.info("Done – %d lessons generated.", len(videos))


if __name__ == "__main__":
    main()
