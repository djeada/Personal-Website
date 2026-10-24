"""
Flashcard generator.

Reads the question/answer cards kept in the notes repositories and writes
the JSON the flashcard app loads from ``src/tools/flash_cards``. A card is a
``<details>`` element; the heading above it names its topic::

    ## Bayes' Theorem

    <details>
    <summary>What is Bayes' Theorem?</summary>

    Answer in Markdown, with $\\TeX$ on maths decks.

    </details>

Usage:
    python3 generate_flashcards.py                       # fetch from GitHub
    python3 generate_flashcards.py --local-root ~/my_repos
    python3 generate_flashcards.py --check --strict      # validate only
"""

import argparse
import logging
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.append(str(SCRIPT_DIR))

from generate_quizzes import Report, load_files  # noqa: E402
from learning_sources import (  # noqa: E402
    DATABASES,
    DEVOPS,
    FRONTEND,
    SCHEMA_VERSION,
    STATISTICS,
    Category,
    Source,
    SourceFile,
    SourceLoader,
    document_title,
    normalise_text,
    remove_stale_json,
    render_markdown,
    slugify,
    stable_id,
    write_json,
)
import requests  # noqa: E402

OUTPUT_DIR = SCRIPT_DIR.parent / "src" / "tools" / "flash_cards"

CATEGORIES: Tuple[Category, ...] = (
    Category(
        slug="frontend",
        name="Frontend",
        description="Applied HTML, CSS, JavaScript, protocol and hosting questions to explain in your own words.",
        sources=(Source(FRONTEND, "notes/12_quizes.md"),),
    ),
    Category(
        slug="databases",
        name="Databases",
        description="Core database concepts: SQL objects, keys, normalisation, indexing, transactions and scaling.",
        sources=(Source(DATABASES, "notes/quizes.md"),),
    ),
    Category(
        slug="devops",
        name="DevOps and Google Cloud",
        description="DevOps practices and Google Cloud architecture decisions: what each service is for and when to choose it.",
        sources=(Source(DEVOPS, "flashcards"),),
    ),
    Category(
        slug="statistics",
        name="Statistics",
        description="Definitions and worked reasoning for probability, inference, regression and time series.",
        sources=(Source(STATISTICS, "flashcards"),),
        math=True,
    ),
)

TITLE_WORDS = (r"^quizzes on\b", r"\bquiz(zes)?\b", r"\bflashcards?\b", r"\breview\b")
HEADING = re.compile(r"^(#{2,6})\s+(.+?)\s*#*\s*$", re.M)
DETAILS = re.compile(r"<details[^>]*>(.*?)</details>", re.S | re.I)
SUMMARY = re.compile(r"^\s*<summary[^>]*>(.*?)</summary>\s*(?:<br\s*/?>)?", re.S | re.I)
FENCED_BLOCK = re.compile(r"^\s*(```|~~~).*?^\s*\1", re.S | re.M)
LEADING_NUMBER = re.compile(r"^\s*\d+[.)]\s+")


def _blank_fences(text: str) -> str:
    """Hide fenced code so headings or tags inside examples are not parsed."""
    return FENCED_BLOCK.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), text)


def parse_cards(source: SourceFile, report: Report) -> List[Tuple[str, str, str, int]]:
    """Return ``(topic, front, back, line)`` for every card in ``source``."""
    scan = _blank_fences(source.text)
    headings = [
        (m.start(), len(m.group(1)), m.group(2).strip()) for m in HEADING.finditer(scan)
    ]
    fallback = document_title(source, TITLE_WORDS)
    cards = []

    for match in DETAILS.finditer(scan):
        line = source.text.count("\n", 0, match.start()) + 1
        location = f"{source.repo.name}/{source.path}:{line}"
        body = source.text[match.start(1) : match.end(1)]
        summary = SUMMARY.match(body)
        if not summary:
            report.add("error", location, "card has no <summary>")
            continue
        front = LEADING_NUMBER.sub("", " ".join(summary.group(1).split()))
        back = body[summary.end() :].strip()
        if not front or not back:
            report.add("error", location, "card has an empty question or answer")
            continue

        above = [h for h in headings if h[0] < match.start()]
        # Cards are grouped by their nearest level-2 heading, so sub-headings
        # inside a section do not splinter it into tiny topics.
        section = next(
            (h for h in reversed(above) if h[1] == 2), above[-1] if above else None
        )
        if section is None:
            report.add("warning", location, "card is not under a heading")
        cards.append((section[2] if section else fallback, front, back, line))
    return cards


def build_category(category: Category, files: List[SourceFile], report: Report) -> Dict:
    topics: Dict[str, Dict] = {}
    cards: List[Dict] = []
    seen: Dict[str, str] = {}

    for source in files:
        group = document_title(source, TITLE_WORDS)
        parsed = parse_cards(source, report)
        if not parsed:
            report.add("warning", f"{source.repo.name}/{source.path}", "no cards found")
        for topic_name, front, back, line in parsed:
            key = normalise_text(front)
            if key in seen:
                report.add(
                    "warning",
                    f"{source.repo.name}/{source.path}:{line}",
                    f"duplicate of {seen[key]}, skipped",
                )
                continue
            seen[key] = f"{source.path}:{line}"

            topic = slugify(f"{source.stem} {topic_name}")
            if topic not in topics:
                topics[topic] = {
                    "slug": topic,
                    "name": topic_name,
                    "group": group,
                    "source": source.url,
                    "cardCount": 0,
                }
            topics[topic]["cardCount"] += 1
            cards.append(
                {
                    "id": stable_id(category.slug, key),
                    "topic": topic,
                    "front": render_markdown(
                        front, source, math=category.math, inline=True
                    ),
                    "back": render_markdown(back, source, math=category.math),
                    "source": f"{source.url}#L{line}",
                }
            )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "category": category.to_dict(cardCount=len(cards), topicCount=len(topics)),
        "topics": list(topics.values()),
        "cards": cards,
    }


def generate(
    loader: SourceLoader, output_dir: Path, write: bool = True
) -> Tuple[Dict[str, Dict], Report]:
    report = Report()
    built: Dict[str, Dict] = {}
    for category in CATEGORIES:
        data = build_category(category, load_files(loader, category, report), report)
        if data["cards"]:
            built[category.slug] = data

    if write:
        for slug, data in built.items():
            if write_json(data, output_dir / f"{slug}.json"):
                logging.info("Updated %s.json", slug)
        index = {
            "schemaVersion": SCHEMA_VERSION,
            "categories": [d["category"] for d in built.values()],
        }
        write_json(index, output_dir / "categories.json")
        for path in remove_stale_json(
            output_dir, [f"{slug}.json" for slug in built] + ["categories.json"]
        ):
            logging.info("Removed stale %s", path.name)
    return built, report


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--local-root",
        type=Path,
        help="read the notes repositories from this directory instead of GitHub",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=OUTPUT_DIR,
        help="directory for the generated JSON",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate the sources without writing anything",
    )
    parser.add_argument(
        "--strict", action="store_true", help="treat warnings as failures"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="list every warning"
    )
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    try:
        built, report = generate(
            SourceLoader(args.local_root), args.output, write=not args.check
        )
    except requests.RequestException as exc:
        logging.error("Could not download flashcard sources: %s", exc)
        return 1

    for problem in report.errors:
        logging.error("%s", problem)
    if args.verbose or args.strict:
        for problem in report.warnings:
            logging.warning("%s", problem)
    elif report.warnings:
        logging.info("%d warnings (run with -v to list them)", len(report.warnings))

    for slug, data in built.items():
        logging.info(
            "%-12s %4d cards in %d topics",
            slug,
            len(data["cards"]),
            len(data["topics"]),
        )

    if (args.check or args.strict) and report.errors:
        return 1
    if args.strict and report.warnings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
