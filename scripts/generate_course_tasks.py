"""
Generates the exercise pages of "Kurs Podstaw Pythona".

Task sets are downloaded from the Nauka-Programowania repository and rendered
into src/courses/kurs_podstaw_pythona/tasks/<slug>.html using the runner
template (src/courses/python_intro/runner/index.html). The template's
PYK:HEAD and PYK:MAIN regions are replaced per task; the judge itself lives in
runner/judge.js + runner/judge-worker.js and the styles in
src/resources/assets/19_course.css. The course index gets the task list
between its TASKS:START / TASKS:END markers.
"""

import html
import json
import re
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT_DIR / "src"
COURSE_ROOT = SRC_DIR / "courses/kurs_podstaw_pythona"
TASKS_DIR = COURSE_ROOT / "tasks"
COURSE_PAGE = COURSE_ROOT / "index.html"
RUNNER_DIR = SRC_DIR / "courses/python_intro/runner"
RUNNER_TEMPLATE = RUNNER_DIR / "index.html"
ARTICLES_DIR = SRC_DIR / "articles/kurs_podstaw_pythona"
SITE_URL = "https://adamdjellouli.com/"
COURSE_NAME = "Kurs Podstaw Pythona"
PRISM = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0"
DESCRIPTION_LENGTH = 158

SOURCE_BASE = "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/"
SOURCE_FILES = [
    "01_interakcja_z_konsola",
    "02_instrukcja_warunkowa",
    "03_daty",
    "04_petla_wprowadzenie",
    "05_petla_wyznaczanie_cyfr_liczby",
    "06_funkcje_wprowadzenie",
    "07_petla_algorytmy_matematyczne",
    "08_petla_petle_zagniezdzone",
    "09_listy_wprowadzenie",
    "10_listy_dwie_listy",
    "11_napisy_wprowadzenie",
    "12_napisy_anagramy_i_palindromy",
    "13_listy_2d",
    "14_funkcje_wielomiany",
    "15_funkcje_rekurencja",
    "16_system_binarny",
    "17_slowniki",
    "18_klasy",
    "19_dziedziczenie",
    "20_operacje_na_plikach",
    "21_sortowanie_algorytmy",
    "22_sortowanie_praktyka",
    "23_wyrazenia_regularne",
    "24_listy_trudne",
    "25_napisy_trudne",
]
SOURCES = [f"{SOURCE_BASE}{name}.json" for name in SOURCE_FILES]

BASICS = "01_podstawy/"
INTERMEDIATE = "02_sredniozawansowane/"
PRACTICE = "04_python_w_praktyce/"
VARIABLES = (
    BASICS + "03_zmienne.html",
    "Zmienne i konwersja typów",
    "konwersja-typów-rzutowanie-",
)
FORMATTING = (
    BASICS + "07_napisy.html",
    "Formatowanie f-string",
    "formatowanie-napisów-za-pomocą-f-string",
)
CONDITIONS = (BASICS + "04_warunki.html", "Warunki (if / elif / else)", None)
LOOPS = (BASICS + "05_petle.html", "Pętle for i while", None)
WHILE = (BASICS + "05_petle.html", "Pętla while", "pętla-while")
NESTED = (BASICS + "05_petle.html", "Zagnieżdżone pętle", "zagnieżdżone-pętle")
ZIP = (
    BASICS + "05_petle.html",
    "Iteracja z enumerate i zip",
    "iteracja-z-enumerate-i-zip",
)
FUNCTIONS = (BASICS + "06_funkcje.html", "Funkcje", None)
STRINGS = (BASICS + "07_napisy.html", "Napisy", None)
LISTS = (BASICS + "08_struktury_danych.html", "Listy", "lista")
MATRICES = (
    BASICS + "08_struktury_danych.html",
    "Listy dwuwymiarowe (macierze)",
    "listy-dwuwymiarowe-macierze-",
)
DICTS = (BASICS + "08_struktury_danych.html", "Słowniki", "słownik")
CLASSES = (INTERMEDIATE + "01_klasy_i_obiekty.html", "Klasy i obiekty", None)
INHERITANCE = (
    INTERMEDIATE + "04_dziedziczenie_i_kompozycja.html",
    "Dziedziczenie i kompozycja",
    None,
)
REGEX = (INTERMEDIATE + "05_wyrazenia_regularne.html", "Wyrażenia regularne", None)
LAMBDAS = (INTERMEDIATE + "10_lambdy.html", "Lambdy (np. sorted z key=)", None)
FILES = (
    PRACTICE + "02_praca_z_plikami_i_folderami.html",
    "Praca z plikami i folderami",
    None,
)


THEORY: Dict[str, List[Tuple[str, str, Optional[str]]]] = {
    "01_interakcja_z_konsola": [VARIABLES, FORMATTING],
    "02_instrukcja_warunkowa": [CONDITIONS],
    "03_daty": [CONDITIONS],
    "04_petla_wprowadzenie": [LOOPS],
    "05_petla_wyznaczanie_cyfr_liczby": [WHILE],
    "06_funkcje_wprowadzenie": [FUNCTIONS],
    "07_petla_algorytmy_matematyczne": [LOOPS],
    "08_petla_petle_zagniezdzone": [NESTED],
    "09_listy_wprowadzenie": [LISTS],
    "10_listy_dwie_listy": [LISTS, ZIP],
    "11_napisy_wprowadzenie": [STRINGS],
    "12_napisy_anagramy_i_palindromy": [STRINGS],
    "13_listy_2d": [MATRICES],
    "14_funkcje_wielomiany": [FUNCTIONS, LISTS],
    "15_funkcje_rekurencja": [FUNCTIONS, LISTS],
    "16_system_binarny": [VARIABLES],
    "17_slowniki": [DICTS],
    "18_klasy": [CLASSES],
    "19_dziedziczenie": [INHERITANCE],
    "20_operacje_na_plikach": [FILES],
    "21_sortowanie_algorytmy": [LISTS, LOOPS],
    "22_sortowanie_praktyka": [LISTS, LAMBDAS],
    "23_wyrazenia_regularne": [REGEX],
    "24_listy_trudne": [LISTS],
    "25_napisy_trudne": [STRINGS],
}


@dataclass
class Chapter:
    number: int
    key: str
    title: str
    name: str
    description: str
    theory: List[Tuple[str, str]] = field(default_factory=list)
    tasks: List["Task"] = field(default_factory=list)

    @property
    def anchor(self) -> str:
        return f"rozdzial-{self.number}"


@dataclass
class Task:
    slug: str
    title: str
    difficulty: str
    level: int
    tags: List[str]
    summary: str
    plain: str
    statement: str
    input_format: str
    output_format: str
    constraints: str
    notes: str
    examples: List[Dict[str, str]]
    tests: List[Dict[str, str]]
    starter_code: str = ""
    chapter: Optional[Chapter] = None
    number: int = 0

    @property
    def label(self) -> str:
        return f"{self.chapter.number}.{self.number}" if self.chapter else ""


LIST_RE = re.compile(r"^(\s*)([*-]|\d+[.)])\s+(.*)$")


def _inline_markup(text: str) -> str:
    parts = re.split(r"(`[^`]+`)", text)
    out = []
    for part in parts:
        if len(part) > 1 and part.startswith("`") and part.endswith("`"):
            out.append(f"<code>{html.escape(part[1:-1])}</code>")
            continue
        escaped = html.escape(part)
        escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
        escaped = re.sub(
            r"(?<![*\w])\*(?![\s*])([^*]+?)(?<!\s)\*(?![*\w])", r"<em>\1</em>", escaped
        )
        out.append(escaped)
    return "".join(out)


def _indent(line: str) -> int:
    return len(line) - len(line.lstrip())


def _parse_list(lines: List[str], i: int) -> Tuple[str, int]:
    first = LIST_RE.match(lines[i])
    indent = len(first.group(1))
    ordered = first.group(2)[0].isdigit()
    start = int(re.sub(r"\D", "", first.group(2))) if ordered else 1
    items: List[List[str]] = []
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines) and (
                _indent(lines[j]) > indent
                or (LIST_RE.match(lines[j]) and _indent(lines[j]) == indent)
            ):
                i = j
                continue
            break
        match = LIST_RE.match(line)
        ind = _indent(line)
        if match and ind == indent:
            if match.group(2)[0].isdigit() != ordered:
                break
            items.append([_inline_markup(match.group(3).strip())])
            i += 1
        elif ind > indent and items:
            if match:
                sub, i = _parse_list(lines, i)
                items[-1].append(sub)
            else:
                items[-1].append("<br>" + _inline_markup(line.strip()))
                i += 1
        else:
            break
    tag = "ol" if ordered else "ul"
    start_attr = f' start="{start}"' if ordered and start != 1 else ""
    body = "".join(f"<li>{''.join(parts)}</li>" for parts in items)
    return f"<{tag}{start_attr}>{body}</{tag}>", i


def _markdown_to_html(text: str) -> str:
    if not text:
        return ""
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
    blocks: List[str] = []
    i = 0

    def starts_block(line: str) -> bool:
        stripped = line.strip()
        return bool(
            LIST_RE.match(line) or stripped.startswith("```") or stripped == "["
        )

    while i < len(lines):
        stripped = lines[i].strip()
        if not stripped:
            i += 1
            continue
        if stripped.startswith("```"):
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith("```"):
                j += 1
            code = "\n".join(lines[i + 1 : j])
            blocks.append(
                f'<pre class="pyk-pre"><code>{html.escape(code)}</code></pre>'
            )
            i = j + 1
            continue
        if stripped == "[":
            j = i + 1
            while j < len(lines) and lines[j].strip() != "]" and j - i < 12:
                j += 1
            if j < len(lines) and lines[j].strip() == "]":
                formula = "\n".join(line.strip() for line in lines[i + 1 : j])
                blocks.append(f'<pre class="pyk-pre">{html.escape(formula)}</pre>')
                i = j + 1
                continue
        if LIST_RE.match(lines[i]):
            block, i = _parse_list(lines, i)
            blocks.append(block)
            continue
        paragraph = [_inline_markup(stripped)]
        i += 1
        while i < len(lines) and lines[i].strip() and not starts_block(lines[i]):
            paragraph.append(_inline_markup(lines[i].strip()))
            i += 1
        blocks.append("<p>" + "<br>".join(paragraph) + "</p>")
    return "\n".join(blocks)


def _plain_text(text: str) -> str:
    text = re.sub(r"```.*?```", " ", text or "", flags=re.S)
    text = re.sub(r"(?m)^\s*\[\s*$.*?^\s*\]\s*$", " ", text, flags=re.S)
    text = re.sub(r"(?m)^\s*([*-]|\d+[.)])\s+", "", text)
    text = text.replace("`", "").replace("**", "")
    text = re.sub(r"(?<!\w)\*(\S[^*]*?)\*", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:–-")
    return cut + "…"


def _first_sentences(text: str, limit: int) -> str:
    sentences = re.split(r"(?<=[.!?:])\s+", text)
    out = ""
    for sentence in sentences:
        if out and len(out) + len(sentence) + 1 > limit:
            break
        out = f"{out} {sentence}".strip()
        if len(out) >= limit * 0.6:
            break
    out = re.sub(r":$", ".", out)
    return _truncate(out, limit)


def _fetch_json(url: str) -> Dict:
    with urllib.request.urlopen(url, timeout=20) as response:
        return json.load(response)


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", text.lower()).strip("_")
    return slug or "task"


def _difficulty(exercise: Dict) -> Tuple[str, int]:
    level = exercise.get("difficulty")
    level = level if isinstance(level, int) else 0
    display = exercise.get("difficulty_display") or ("★" * level or "?")
    return display, level


def _chapter_name(title: str) -> str:
    return re.sub(r"^Rozdział(\s+\d+)?\s*:\s*", "", title.strip()) or title.strip()


def _theory_links(key: str) -> List[Tuple[str, str]]:
    links = []
    for rel_path, label, anchor in THEORY.get(key, []):
        article = ARTICLES_DIR / rel_path
        if not article.exists():
            print(f"warning: theory article missing: {article}")
            continue
        href = f"articles/kurs_podstaw_pythona/{rel_path}"
        if anchor and f'id="{anchor}"' in article.read_text(encoding="utf-8"):
            href += f"#{anchor}"
        links.append((href, label))
    return links


def _starter_code(task: Task) -> str:
    lines = [f"# Zadanie {task.label}: {task.title}"]
    if any((t.get("input") or "").strip() for t in task.tests + task.examples):
        lines.append("# Wczytaj dane, np.: a = int(input())")
    lines.append("# Wypisz wynik: print(...)")
    return "\n".join(lines) + "\n\n"


def load_chapters() -> List[Chapter]:
    chapters: List[Chapter] = []
    for number, (key, url) in enumerate(zip(SOURCE_FILES, SOURCES), start=1):
        data = _fetch_json(url)
        name = _chapter_name(data.get("chapter_title", "") or key)
        chapter = Chapter(
            number=number,
            key=key,
            title=f"Rozdział {number}: {name}",
            name=name,
            description=_markdown_to_html(data.get("chapter_description", "").strip()),
            theory=_theory_links(key),
        )
        for index, exercise in enumerate(data.get("exercises", []), start=1):
            description = (exercise.get("description") or "").strip()
            plain = _plain_text(description)
            if not plain:
                parts = [
                    f"{label} {_plain_text(exercise.get(key) or '').rstrip('.')}."
                    for key, label in (("input", "Wejście:"), ("output", "Wyjście:"))
                    if (exercise.get(key) or "").strip()
                ]
                plain = " ".join(parts)
            display, level = _difficulty(exercise)
            task = Task(
                slug=_slugify(
                    exercise.get("slug")
                    or exercise.get("id")
                    or exercise.get("title")
                    or ""
                ),
                title=(exercise.get("title") or "").strip(),
                difficulty=display,
                level=level,
                tags=[str(tag) for tag in exercise.get("tags") or []],
                summary=_first_sentences(plain, 120),
                plain=plain,
                statement=_markdown_to_html(description),
                input_format=_markdown_to_html((exercise.get("input") or "").strip()),
                output_format=_markdown_to_html((exercise.get("output") or "").strip()),
                constraints=_markdown_to_html(
                    (exercise.get("constraints") or "").strip()
                ),
                notes=_markdown_to_html((exercise.get("notes") or "").strip()),
                examples=[
                    {"input": ex.get("input", ""), "output": ex.get("output", "")}
                    for ex in exercise.get("examples") or []
                ],
                tests=[
                    {"input": tc.get("input", ""), "expected": tc.get("output", "")}
                    for tc in exercise.get("testcases") or []
                ],
                chapter=chapter,
                number=index,
            )
            task.starter_code = _starter_code(task)
            chapter.tasks.append(task)
        chapters.append(chapter)
    return chapters


def _e(text: str) -> str:
    return html.escape(text or "", quote=True)


def _plural(n: int, one: str, few: str, many: str) -> str:
    if n == 1:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


def _json_script(data: Dict) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    payload = payload.replace("</", "<\\/").replace("<!--", "<\\!--")
    return f'<script type="application/json" id="pyk-data">{payload}</script>'


def _io_block(label: str, text: str) -> str:
    text = (text or "").rstrip("\n")
    if not text.strip():
        return f'<div class="pyk-io"><div class="pyk-io-label">{label}</div><pre class="pyk-pre is-empty">(brak)</pre></div>'
    return f'<div class="pyk-io"><div class="pyk-io-label">{label}</div><pre class="pyk-pre">{_e(text)}</pre></div>'


def _description(task: Task) -> str:
    base = task.plain or task.title
    if len(base) < 90:
        base = base.rstrip(" :")
        base = f"{base if base.endswith(('.', '!', '?')) else base + '.'} Rozwiąż zadanie w Pythonie online i sprawdź je automatycznymi testami."
    return _truncate(
        f"{task.title}: {base}" if task.title not in base else base, DESCRIPTION_LENGTH
    )


def _page_title(task: Task) -> str:
    return f"{task.title} – zadanie {task.label} | {COURSE_NAME}"


def render_head(
    title: str, description: str, canonical: str, breadcrumbs: List[Tuple[str, str]]
) -> str:
    crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": pos, "name": name, "item": url}
            for pos, (name, url) in enumerate(breadcrumbs, start=1)
        ],
    }
    return "\n".join(
        [
            f"<title>{_e(title)}</title>",
            f'    <meta name="description" content="{_e(description)}">',
            f'    <link rel="canonical" href="{canonical}">',
            f'    <meta property="og:title" content="{_e(title)}">',
            f'    <meta property="og:description" content="{_e(description)}">',
            '    <meta property="og:type" content="website">',
            f'    <meta property="og:url" content="{canonical}">',
            '    <meta property="og:locale" content="pl_PL">',
            '    <script type="application/ld+json" id="pyk-breadcrumbs">'
            + json.dumps(crumbs, ensure_ascii=False).replace("</", "<\\/")
            + "</script>",
        ]
    )


def render_main(
    task: Task,
    *,
    course_href: str,
    judge_src: str,
    prev_task: Optional[Task] = None,
    next_task: Optional[Task] = None,
    position: str = "",
    track: bool = True,
    root: str = "../../../",
    heading: Optional[str] = None,
) -> str:
    chapter = task.chapter
    chapter_href = f"{course_href}#{chapter.anchor}" if chapter else course_href

    meta = []
    if position:
        meta.append(f'<span class="pyk-chip">{_e(position)}</span>')
    meta.append(
        f'<span class="pyk-chip pyk-chip--difficulty" title="Trudność: {task.level} z 3">Trudność: '
        f'<span aria-hidden="true">{_e(task.difficulty)}</span><span class="pyk-sr">{task.level} z 3</span></span>'
        if task.level
        else ""
    )
    meta.extend(f'<span class="pyk-chip">{_e(tag)}</span>' for tag in task.tags[:4])
    meta.append(
        '<span class="pyk-chip pyk-chip--solved" id="pyk-solved" hidden>✓ Rozwiązane</span>'
    )

    statement = [f'<h2 id="pyk-statement-title">Treść zadania</h2>']
    statement.append(task.statement or f"<p>{_e(task.title)}.</p>")
    for label, content in (
        ("Dane wejściowe", task.input_format),
        ("Dane wyjściowe", task.output_format),
        ("Ograniczenia", task.constraints),
        ("Uwagi", task.notes),
    ):
        if content:
            statement.append(f"<h2>{label}</h2>\n{content}")
    if task.examples:
        statement.append(
            "<h2>Przykład</h2>" if len(task.examples) == 1 else "<h2>Przykłady</h2>"
        )
        for example in task.examples:
            statement.append(
                '<div class="pyk-example">'
                + _io_block("Wejście", example.get("input", ""))
                + _io_block("Wyjście", example.get("output", ""))
                + "</div>"
            )
    if chapter and chapter.theory:
        links = "".join(
            f'<li><a href="{root}{href}">{_e(label)}</a></li>'
            for href, label in chapter.theory
        )
        statement.append(
            f'<div class="pyk-theory"><p>Potrzebujesz teorii?</p><ul>{links}</ul></div>'
        )
    if chapter and chapter.description:
        statement.append(
            f'<details class="pyk-details"><summary>Zasady obowiązujące w rozdziale {chapter.number}</summary>{chapter.description}</details>'
        )

    tests_html = []
    for idx, test in enumerate(task.tests):
        tests_html.append(
            f"""<div class="pyk-test" data-index="{idx}" data-state="idle">
                <div class="pyk-test-head"><h3>Test {idx + 1}</h3><span class="pyk-test-state">Nie uruchomiono</span></div>
                <div class="pyk-test-io">{_io_block("Wejście", test["input"])}{_io_block("Oczekiwane wyjście", test["expected"])}</div>
                <div class="pyk-test-result"></div>
            </div>"""
        )
    if task.tests:
        tests_section = f"""<div class="pyk-card">
                <h2>Testy</h2>
                <p class="pyk-note">Program dostaje „Wejście” przez <code>input()</code> i musi wypisać „Oczekiwane wyjście”. Liczby porównywane są z tolerancją 0,01, a tekst podany w <code>input("…")</code> nie jest sprawdzany.</p>
                <div class="pyk-tests" id="pyk-tests">{"".join(tests_html)}</div>
            </div>"""
        run_label = "Sprawdź rozwiązanie"
        done_button = ""
    else:
        tests_section = """<div class="pyk-card">
                <h2>Testy</h2>
                <p class="pyk-note">To zadanie nie ma testów automatycznych (to projekt interaktywny). Uruchom program z własnymi danymi poniżej, a gdy działa, oznacz zadanie jako ukończone.</p>
            </div>"""
        run_label = "Uruchom program"
        done_button = '<button type="button" class="pyk-btn" id="pyk-mark-done">Oznacz jako ukończone</button>'

    sample_input = (task.examples or task.tests or [{"input": ""}])[0].get("input", "")

    pager = []
    if prev_task:
        pager.append(
            f'<a class="pyk-pager-prev" href="{prev_task.slug}.html" rel="prev"><small>← Poprzednie zadanie {prev_task.label}</small><span>{_e(prev_task.title)}</span></a>'
        )
    if next_task:
        pager.append(
            f'<a class="pyk-pager-next" href="{next_task.slug}.html" rel="next"><small>Następne zadanie {next_task.label} →</small><span>{_e(next_task.title)}</span></a>'
        )
    pager.append(
        f'<a class="pyk-pager-up" href="{chapter_href}"><small>Lista zadań</small><span>{_e(chapter.title if chapter else COURSE_NAME)}</span></a>'
    )

    crumbs = [f'<li><a href="{course_href}">{COURSE_NAME}</a></li>']
    if chapter:
        crumbs.append(
            f'<li><a href="{chapter_href}">Rozdział {chapter.number}</a></li>'
        )
    crumbs.append(
        f'<li aria-current="page">{"Zadanie " + task.label if task.label else _e(task.title)}</li>'
    )

    data = {
        "slug": task.slug,
        "tests": task.tests,
        "starter": task.starter_code,
        "track": track,
        "next": (
            {"href": f"{next_task.slug}.html", "title": next_task.title}
            if next_task
            else None
        ),
    }

    return f"""<main class="pyk" id="pyk-main">
        <div class="pyk-breadcrumbs" role="navigation" aria-label="Ścieżka nawigacji"><ol>{"".join(crumbs)}</ol></div>
        <div class="pyk-header">
            <h1>{_e(heading or task.title)}</h1>
            <div class="pyk-meta">{"".join(meta)}</div>
        </div>
        <div class="pyk-layout">
            <section class="pyk-card pyk-statement" aria-labelledby="pyk-statement-title">
                {"".join(statement)}
            </section>
            <section class="pyk-workspace" aria-label="Rozwiązanie">
                <div class="pyk-card">
                    <div class="pyk-editor-head">
                        <label for="pyk-code">Twój kod w Pythonie</label>
                        <p class="pyk-note" id="pyk-restored" hidden>Przywrócono Twój zapisany kod.</p>
                    </div>
                    <div class="pyk-editor">
                        <div class="pyk-gutter-wrap" aria-hidden="true"><div class="pyk-gutter" id="pyk-gutter"></div></div>
                        <div class="pyk-code-area">
                            <pre aria-hidden="true"><code id="pyk-highlight" class="language-python"></code></pre>
                            <textarea id="pyk-code" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-describedby="pyk-editor-help">{_e(task.starter_code)}</textarea>
                        </div>
                    </div>
                    <div class="pyk-controls">
                        <button type="button" class="pyk-btn pyk-btn--primary" id="pyk-run"><span class="pyk-spinner" aria-hidden="true"></span>{run_label} <kbd id="pyk-shortcut">Ctrl+Enter</kbd></button>
                        <button type="button" class="pyk-btn" id="pyk-reset">Przywróć kod startowy</button>
                        {done_button}
                        <p class="pyk-status" id="pyk-status" role="status">Python uruchomi się w przeglądarce przy pierwszym teście.</p>
                    </div>
                    <p class="pyk-note" id="pyk-editor-help">Kod zapisuje się automatycznie w tej przeglądarce. Tab wstawia wcięcie; aby opuścić edytor klawiaturą, naciśnij Esc, a potem Tab.</p>
                </div>
                <div class="pyk-summary" id="pyk-summary" aria-live="polite" hidden></div>
                {tests_section}
                <details class="pyk-card pyk-custom"{" open" if not task.tests else ""}>
                    <summary>Uruchom z własnymi danymi</summary>
                    <label for="pyk-stdin">Dane wejściowe (to, co program odczyta przez <code>input()</code>)</label>
                    <textarea id="pyk-stdin" spellcheck="false" autocapitalize="off" autocomplete="off" rows="4">{_e(sample_input)}</textarea>
                    <button type="button" class="pyk-btn" id="pyk-run-custom"><span class="pyk-spinner" aria-hidden="true"></span>Uruchom program</button>
                    <div class="pyk-custom-output" id="pyk-custom-output" aria-live="polite"></div>
                </details>
            </section>
        </div>
        <div class="pyk-pager" role="navigation" aria-label="Nawigacja między zadaniami">{"".join(pager)}</div>
        {_json_script(data)}
        <script src="{PRISM}/prism.min.js" data-manual defer></script>
        <script src="{PRISM}/components/prism-python.min.js" defer></script>
        <script src="{judge_src}" defer></script>
    </main>"""


HEAD_RE = re.compile(r"<!-- PYK:HEAD:START -->.*?<!-- PYK:HEAD:END -->", re.S)
MAIN_RE = re.compile(r"<!-- PYK:MAIN:START -->.*?<!-- PYK:MAIN:END -->", re.S)
STALE_HEAD_TAGS = [
    re.compile(r"\s*<title>.*?</title>", re.S),
    re.compile(r'\s*<meta\b[^>]*\bname="description"[^>]*>'),
    re.compile(r'\s*<link\b[^>]*\brel="canonical"[^>]*>'),
    re.compile(r'\s*<meta\b[^>]*\bproperty="og:[^"]*"[^>]*>'),
    re.compile(r'\s*<meta\b[^>]*\bname="twitter:[^"]*"[^>]*>'),
    re.compile(r"\s*<script\b[^>]*application/ld\+json[^>]*>.*?</script>", re.S),
]


def fill_template(template: str, head: str, main: str) -> str:
    if "<!-- PYK:MAIN:START -->" not in template and '<main class="pyk"' in template:
        template = template.replace(
            '<main class="pyk"', '<!-- PYK:MAIN:START -->\n    <main class="pyk"', 1
        )
    if not HEAD_RE.search(template) or not MAIN_RE.search(template):
        raise ValueError("Runner template is missing PYK:HEAD / PYK:MAIN markers")
    page = HEAD_RE.sub(
        "<!-- PYK:HEAD:START --><!-- PYK:HEAD:END -->", template, count=1
    )
    head_end = page.index("</head>")
    head_html, rest = page[:head_end], page[head_end:]

    for pattern in STALE_HEAD_TAGS:
        head_html = pattern.sub("", head_html)
    page = head_html + rest
    page = page.replace(
        "<!-- PYK:HEAD:START --><!-- PYK:HEAD:END -->",
        f"<!-- PYK:HEAD:START -->\n    {head}\n    <!-- PYK:HEAD:END -->",
        1,
    )
    return MAIN_RE.sub(
        lambda _: f"<!-- PYK:MAIN:START -->\n    {main}\n    <!-- PYK:MAIN:END -->",
        page,
        count=1,
    )


def build_task_page(
    task: Task, template: str, prev_task: Optional[Task], next_task: Optional[Task]
) -> str:
    chapter = task.chapter
    canonical = f"{SITE_URL}courses/kurs_podstaw_pythona/tasks/{task.slug}"
    course_url = f"{SITE_URL}courses/kurs_podstaw_pythona/"
    head = render_head(
        _page_title(task),
        _description(task),
        canonical,
        [
            (COURSE_NAME, course_url),
            (chapter.title, f"{course_url}#{chapter.anchor}"),
            (task.title, canonical),
        ],
    )
    main = render_main(
        task,
        course_href="../index.html",
        judge_src="../../python_intro/runner/judge.js",
        prev_task=prev_task,
        next_task=next_task,
        position=f"Zadanie {task.number} z {len(chapter.tasks)} · rozdział {chapter.number}",
    )
    return fill_template(template, head, main)


def demo_task() -> Task:
    tests = [
        {"input": "3\n1 2 3\n", "expected": "6"},
        {"input": "2\n100 100\n", "expected": "200"},
        {"input": "1\n42\n", "expected": "42"},
        {"input": "3\n-1 -2 -3\n", "expected": "-6"},
        {"input": "1\n-5\n", "expected": "-5"},
        {"input": "5\n0 0 0 0 0\n", "expected": "0"},
        {"input": "4\n10 20 30 40\n", "expected": "100"},
    ]
    return Task(
        slug="demo_suma_liczb",
        title="Suma liczb",
        difficulty="★☆☆",
        level=1,
        tags=["demo"],
        summary="",
        plain="",
        statement="<p>Wczytaj liczbę <code>n</code>, a w kolejnej linii <code>n</code> liczb całkowitych oddzielonych spacjami. Wypisz ich sumę.</p>",
        input_format="",
        output_format="",
        constraints="",
        notes="",
        examples=[{"input": "3\n1 2 3", "output": "6"}],
        tests=tests,
        starter_code="n = int(input())\nliczby = input().split()\n# Uzupełnij rozwiązanie i wypisz sumę.\n",
    )


def build_template_demo(template: str) -> str:
    demo = demo_task()
    canonical = f"{SITE_URL}courses/python_intro/runner/"
    head = render_head(
        "Środowisko zadań Pythona – demo | Kurs Podstaw Pythona",
        "Demo środowiska do zadań z Pythona: kod uruchamia się w przeglądarce (Pyodide) i jest automatycznie sprawdzany testami.",
        canonical,
        [
            (COURSE_NAME, f"{SITE_URL}courses/kurs_podstaw_pythona/"),
            ("Środowisko zadań", canonical),
        ],
    )
    main = render_main(
        demo,
        course_href="../../kurs_podstaw_pythona/index.html",
        judge_src="judge.js",
        track=False,
        heading="Środowisko zadań Pythona",
        position="Demo: kod uruchamia się w przeglądarce (Pyodide)",
    )
    return fill_template(template, head, main)


def render_course_tasks(chapters: List[Chapter]) -> str:
    total = sum(len(ch.tasks) for ch in chapters)
    first = chapters[0].tasks[0]
    toc = []
    sections = []
    for ch in chapters:
        count = len(ch.tasks)
        toc.append(
            f'<li><a href="#{ch.anchor}"><span>{ch.number}. {_e(ch.name)}</span>'
            f'<span class="pyk-toc-count" data-chapter="{ch.number}">{count} {_plural(count, "zadanie", "zadania", "zadań")}</span></a></li>'
        )
        cards = []
        for task in ch.tasks:
            cards.append(
                f'<li><a class="pyk-task-card" data-slug="{task.slug}" href="./tasks/{task.slug}.html">'
                f'<span class="pyk-task-num">{task.label}</span>'
                f'<span class="pyk-task-title">{_e(task.title)}</span>'
                f'<span class="pyk-task-summary">{_e(task.summary)}</span>'
                f'<span class="pyk-task-meta">Trudność: {_e(task.difficulty)}</span></a></li>'
            )
        theory = ""
        if ch.theory:
            theory = (
                '<p class="pyk-note">Teoria: '
                + ", ".join(
                    f'<a href="../../{href}">{_e(label)}</a>'
                    for href, label in ch.theory
                )
                + "</p>"
            )
        details = (
            f'<details class="pyk-details"><summary>Wprowadzenie i zasady rozdziału</summary>{ch.description}</details>'
            if ch.description
            else ""
        )
        sections.append(
            f"""<section class="pyk-chapter" id="{ch.anchor}" data-chapter="{ch.number}" aria-labelledby="{ch.anchor}-title">
                    <h3 id="{ch.anchor}-title">{_e(ch.title)}</h3>
                    {theory}
                    {details}
                    <ol class="pyk-task-grid">{"".join(cards)}</ol>
                </section>"""
        )
    return f"""<div class="pyk pyk-index" id="pyk-course">
                    <div class="pyk-progress">
                        <p class="pyk-progress-text" id="pyk-progress-text">{total} zadań w {len(chapters)} rozdziałach. Rozwiązuj je w przeglądarce — postęp zapisuje się na tym urządzeniu.</p>
                        <div class="pyk-progress-bar" aria-hidden="true"><span id="pyk-progress-fill"></span></div>
                        <a class="pyk-btn pyk-btn--primary" id="pyk-continue" href="./tasks/{first.slug}.html">Zacznij od zadania 1.1</a>
                    </div>
                    <ol class="pyk-toc">{"".join(toc)}</ol>
                    {"".join(sections)}
                    <script>
                        (function () {{
                            var solved = [];
                            var last = null;
                            try {{
                                solved = JSON.parse(window.localStorage.getItem('pyk:solved') || '[]');
                                last = window.localStorage.getItem('pyk:last');
                            }} catch (err) {{
                                return;
                            }}
                            if (!Array.isArray(solved)) solved = [];
                            var done = {{}};
                            solved.forEach(function (slug) {{ done[slug] = true; }});
                            var cards = Array.prototype.slice.call(document.querySelectorAll('.pyk-task-card'));
                            var count = 0;
                            var lastIndex = -1;
                            cards.forEach(function (card, idx) {{
                                if (done[card.dataset.slug]) {{
                                    card.classList.add('is-solved');
                                    count += 1;
                                }}
                                if (card.dataset.slug === last) lastIndex = idx;
                            }});
                            if (!count && lastIndex < 0) return;
                            document.querySelectorAll('.pyk-chapter').forEach(function (section) {{
                                var all = section.querySelectorAll('.pyk-task-card').length;
                                var ok = section.querySelectorAll('.pyk-task-card.is-solved').length;
                                var label = document.querySelector('.pyk-toc-count[data-chapter="' + section.dataset.chapter + '"]');
                                if (label) {{
                                    label.textContent = ok + '/' + all;
                                    label.classList.toggle('is-complete', ok === all);
                                }}
                            }});
                            document.getElementById('pyk-progress-text').textContent = 'Rozwiązane: ' + count + ' z ' + cards.length + ' zadań.';
                            document.getElementById('pyk-progress-fill').style.width = (100 * count / cards.length) + '%';
                            var target = null;
                            if (lastIndex >= 0 && !done[cards[lastIndex].dataset.slug]) target = cards[lastIndex];
                            for (var i = Math.max(lastIndex, 0); !target && i < cards.length; i += 1) {{
                                if (!done[cards[i].dataset.slug]) target = cards[i];
                            }}
                            for (var j = 0; !target && j < cards.length; j += 1) {{
                                if (!done[cards[j].dataset.slug]) target = cards[j];
                            }}
                            var button = document.getElementById('pyk-continue');
                            if (target) {{
                                button.href = target.href;
                                button.textContent = 'Kontynuuj: ' + target.querySelector('.pyk-task-num').textContent + ' ' + target.querySelector('.pyk-task-title').textContent;
                            }} else {{
                                button.hidden = true;
                                document.getElementById('pyk-progress-text').textContent = 'Wszystkie zadania rozwiązane. Gratulacje!';
                            }}
                        }})();
                    </script>
                </div>"""


def update_course_page(chapters: List[Chapter]) -> None:
    page = COURSE_PAGE.read_text(encoding="utf-8")
    pattern = r"<!-- TASKS:START -->.*?<!-- TASKS:END -->"
    replacement = (
        f"<!-- TASKS:START -->\n{render_course_tasks(chapters)}\n<!-- TASKS:END -->"
    )
    COURSE_PAGE.write_text(
        re.sub(pattern, lambda _: replacement, page, flags=re.S), encoding="utf-8"
    )


def main() -> None:
    if not RUNNER_TEMPLATE.exists():
        raise FileNotFoundError(f"Runner template not found: {RUNNER_TEMPLATE}")

    template = RUNNER_TEMPLATE.read_text(encoding="utf-8")
    chapters = load_chapters()
    tasks = [task for chapter in chapters for task in chapter.tasks]

    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    for idx, task in enumerate(tasks):
        prev_task = tasks[idx - 1] if idx > 0 else None
        next_task = tasks[idx + 1] if idx + 1 < len(tasks) else None
        page = build_task_page(task, template, prev_task, next_task)
        (TASKS_DIR / f"{task.slug}.html").write_text(page, encoding="utf-8")

    RUNNER_TEMPLATE.write_text(build_template_demo(template), encoding="utf-8")
    update_course_page(chapters)
    print(f"Generated {len(tasks)} task pages in {len(chapters)} chapters.")


if __name__ == "__main__":
    main()
