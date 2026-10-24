"""
Quiz generator.

Reads the multiple-choice quizzes kept in the notes repositories
(``quizzes/*.md``) and writes the JSON the quiz app loads from
``src/tools/quiz_app``. The source format is::

    # Processes Quiz

    Notes: [Processes](../notes/processes.md)

    #### Q. Which signal cannot be caught or ignored?

    * [ ] `SIGTERM`
    * [x] `SIGKILL`
    * [ ] `SIGINT`

    > **Explanation:** The kernel handles SIGKILL itself.

Every question is validated. Broken questions (no or several correct
answers, duplicate options) are left out and reported; questions that only
fall short of the style rules produce warnings, which ``--strict`` turns
into failures.

Usage:
    python3 generate_quizzes.py                       # fetch from GitHub
    python3 generate_quizzes.py --local-root ~/my_repos
    python3 generate_quizzes.py --check --strict      # validate only
"""

import argparse
import logging
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.append(str(SCRIPT_DIR))

from learning_sources import (  # noqa: E402
    DATABASES,
    DEVOPS,
    FRONTEND,
    LINUX,
    PARALLEL,
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

OUTPUT_DIR = SCRIPT_DIR.parent / "src" / "tools" / "quiz_app"

CATEGORIES: Tuple[Category, ...] = (
    Category(
        slug="linux",
        name="Linux",
        description="Files, permissions, users, processes, the shell, networking, storage and package managers.",
        sources=(Source(LINUX, "quizzes"),),
    ),
    Category(
        slug="frontend",
        name="Frontend",
        description="HTML semantics and forms, CSS layout and preprocessors, and modern JavaScript.",
        sources=(Source(FRONTEND, "quizzes"),),
    ),
    Category(
        slug="databases",
        name="Databases",
        description="SQL, schema design, indexing, transactions and how databases scale.",
        sources=(Source(DATABASES, "quizzes"),),
    ),
    Category(
        slug="devops",
        name="DevOps and Google Cloud",
        description="Delivery pipelines, infrastructure as code, containers and operations, plus Google Cloud architecture in the style of the Professional Cloud Architect exam.",
        sources=(Source(DEVOPS, "quizzes"),),
    ),
    Category(
        slug="parallel_programming",
        name="Parallel Programming",
        description="Threads, processes, async I/O, synchronisation, hardware and distributed systems.",
        sources=(Source(PARALLEL, "quizzes"),),
    ),
    Category(
        slug="statistics",
        name="Statistics",
        description="Probability, distributions, descriptive statistics, inference, regression and time series.",
        sources=(Source(STATISTICS, "quizzes"),),
        math=True,
    ),
)

QUESTION_HEADING = re.compile(r"^#{2,6}\s*Q\.\s*", re.M)
OPTION = re.compile(r"^\s*[*-]\s*\[([ xX])\]\s?(.*)$")
FENCE = re.compile(r"^\s*(```|~~~)")
NOTES_LINE = re.compile(r"^Notes:\s*(.+)$", re.M | re.I)
MARKDOWN_LINK = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")
EXPLANATION_PREFIX = re.compile(r"^\*\*Explanation:?\*\*:?\s*", re.I)
POSITIONAL_OPTION = re.compile(
    r"\b(all|none|both|neither) of the (above|options|answers)\b|^(both|neither) [a-e]\b|^[a-e] and [a-e]$",
    re.I,
)

MIN_OPTIONS = 3


@dataclass
class Problem:
    level: str  # "error" drops the question, "warning" only reports it
    location: str
    message: str

    def __str__(self) -> str:
        return f"{self.location}: {self.message}"


@dataclass
class ParsedQuestion:
    text: str
    options: List[Tuple[bool, str]]
    explanation: str
    line: int


@dataclass
class Report:
    problems: List[Problem] = field(default_factory=list)

    def add(self, level: str, location: str, message: str) -> None:
        self.problems.append(Problem(level, location, message))

    @property
    def errors(self) -> List[Problem]:
        return [p for p in self.problems if p.level == "error"]

    @property
    def warnings(self) -> List[Problem]:
        return [p for p in self.problems if p.level == "warning"]


def split_questions(text: str) -> List[Tuple[int, str]]:
    """Return ``(line number, block)`` for every ``#### Q.`` heading."""
    matches = list(QUESTION_HEADING.finditer(text))
    blocks = []
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        line = text.count("\n", 0, match.start()) + 1
        blocks.append((line, text[match.end() : end]))
    return blocks


def parse_block(block: str, line: int) -> ParsedQuestion:
    question: List[str] = []
    options: List[List] = []
    explanation: List[str] = []
    in_fence = False
    stage = "question"

    for raw in block.split("\n"):
        if stage == "question":
            if FENCE.match(raw):
                in_fence = not in_fence
            option = None if in_fence else OPTION.match(raw)
            if option:
                stage = "options"
            else:
                question.append(raw)
                continue
        if stage == "options":
            option = OPTION.match(raw)
            if option:
                options.append(
                    [option.group(1).lower() == "x", option.group(2).strip()]
                )
            elif raw.startswith((" ", "\t")) and raw.strip() and options:
                options[-1][1] += " " + raw.strip()
            elif raw.lstrip().startswith(">"):
                stage = "explanation"
            elif raw.strip():
                break
        if stage == "explanation":
            stripped = raw.strip()
            if stripped.startswith(">"):
                explanation.append(stripped[1:].strip())
            elif stripped:
                break

    explanation_text = EXPLANATION_PREFIX.sub(
        "", " ".join(e for e in explanation if e).strip()
    )
    return ParsedQuestion(
        text="\n".join(question).strip(),
        options=[(correct, text) for correct, text in options],
        explanation=explanation_text,
        line=line,
    )


def parse_notes(source: SourceFile) -> List[Dict[str, str]]:
    match = NOTES_LINE.search(source.text)
    if not match:
        return []
    notes = []
    for title, href in MARKDOWN_LINK.findall(match.group(1)):
        html = render_markdown(f"[{title}]({href})", source, inline=True)
        url = re.search(r'href="([^"]+)"', html)
        notes.append({"title": title, "url": url.group(1) if url else href})
    return notes


def topic_slug(source: SourceFile) -> str:
    return slugify(re.sub(r"^\d+[_-]", "", source.stem))


def build_question(
    parsed: ParsedQuestion,
    source: SourceFile,
    category: Category,
    topic: str,
    report: Report,
) -> Optional[Dict]:
    location = f"{source.repo.name}/{source.path}:{parsed.line}"
    label = parsed.text.split("\n")[0][:70]

    if len(parsed.text) < 5:
        report.add("error", location, "question text is missing")
        return None
    correct = [i for i, (is_correct, _) in enumerate(parsed.options) if is_correct]
    if len(correct) != 1:
        report.add("error", location, f"{len(correct)} options marked correct: {label}")
        return None
    texts = [text for _, text in parsed.options]
    if any(not t for t in texts):
        report.add("error", location, f"empty option: {label}")
        return None
    if len({t.strip() for t in texts}) != len(texts):
        report.add("error", location, f"duplicate options: {label}")
        return None
    if len(texts) < MIN_OPTIONS:
        report.add("warning", location, f"only {len(texts)} options: {label}")
    fixed_order = any(POSITIONAL_OPTION.search(t) for t in texts)
    if fixed_order:
        report.add(
            "warning", location, f"positional option, shuffling disabled: {label}"
        )
    if not parsed.explanation:
        report.add("warning", location, f"no explanation: {label}")

    question = {
        "id": stable_id(category.slug, topic, normalise_text(parsed.text)),
        "topic": topic,
        "text": render_markdown(parsed.text, source, math=category.math),
        "options": [
            render_markdown(t, source, math=category.math, inline=True) for t in texts
        ],
        "correctOptionIndex": correct[0],
        "explanation": (
            render_markdown(parsed.explanation, source, math=category.math)
            if parsed.explanation
            else ""
        ),
        "source": f"{source.url}#L{parsed.line}",
    }
    if fixed_order:
        question["fixedOrder"] = True
    return question


def build_category(category: Category, files: List[SourceFile], report: Report) -> Dict:
    topics: List[Dict] = []
    questions: List[Dict] = []
    seen: Dict[str, str] = {}

    for source in files:
        blocks = split_questions(source.text)
        if not blocks:
            report.add(
                "warning", f"{source.repo.name}/{source.path}", "no questions found"
            )
            continue
        topic = topic_slug(source)
        kept = 0
        for line, block in blocks:
            parsed = parse_block(block, line)
            question = build_question(parsed, source, category, topic, report)
            if not question:
                continue
            key = normalise_text(parsed.text)
            if key in seen:
                report.add(
                    "warning",
                    f"{source.repo.name}/{source.path}:{line}",
                    f"duplicate of {seen[key]}, skipped",
                )
                continue
            seen[key] = f"{source.path}:{line}"
            questions.append(question)
            kept += 1
        if kept:
            topics.append(
                {
                    "slug": topic,
                    "name": document_title(
                        source, strip_words=(r"\bquiz(zes)?\b", r"^quizzes on\b")
                    ),
                    "source": source.url,
                    "notes": parse_notes(source),
                    "questionCount": kept,
                }
            )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "category": category.to_dict(
            questionCount=len(questions), topicCount=len(topics)
        ),
        "topics": topics,
        "questions": questions,
    }


def load_files(
    loader: SourceLoader, category: Category, report: Report
) -> List[SourceFile]:
    files: List[SourceFile] = []
    for source in category.sources:
        try:
            files.extend(loader.load(source))
        except FileNotFoundError as exc:
            report.add("warning", category.slug, f"source not found, skipped: {exc}")
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                report.add(
                    "warning",
                    category.slug,
                    f"source not published yet, skipped: {source.repo.name}/{source.path}",
                )
            else:
                raise
    return files


def generate(
    loader: SourceLoader, output_dir: Path, write: bool = True
) -> Tuple[Dict[str, Dict], Report]:
    report = Report()
    built: Dict[str, Dict] = {}
    for category in CATEGORIES:
        data = build_category(category, load_files(loader, category, report), report)
        if data["questions"]:
            built[category.slug] = data

    if write:
        index = {
            "schemaVersion": SCHEMA_VERSION,
            "categories": [data["category"] for data in built.values()],
        }
        for slug, data in built.items():
            if write_json(data, output_dir / f"{slug}.json"):
                logging.info("Updated %s.json", slug)
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
        logging.error("Could not download quiz sources: %s", exc)
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
            "%-22s %4d questions in %d topics",
            slug,
            len(data["questions"]),
            len(data["topics"]),
        )

    # A normal build publishes the valid questions and only logs the broken
    # ones, so one upstream typo cannot block a deploy; --check and --strict
    # are for CI and for authors fixing the sources.
    if (args.check or args.strict) and report.errors:
        return 1
    if args.strict and report.warnings:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
