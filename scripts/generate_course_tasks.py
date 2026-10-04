"""
Generates the exercise pages of "Kurs Podstaw Pythona".

Task sets come from the pinned Nauka-Programowania snapshot in
scripts/course_data/nauka_programowania/ (refresh it with sync_course_tasks.py)
and are rendered into src/courses/kurs_podstaw_pythona/tasks/<slug>.html using
the runner template (src/courses/python_intro/runner/index.html). The template's
PYK:HEAD and PYK:MAIN regions are replaced per task; the judge itself lives in
runner/judge.js + runner/judge-worker.js + runner/judge_harness.py and the styles
in src/resources/assets/19_course.css. The course index gets the task list
between its TASKS:START / TASKS:END markers.
"""

import hashlib
import html
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT_DIR / "src"
COURSE_ROOT = SRC_DIR / "courses/kurs_podstaw_pythona"
TASKS_DIR = COURSE_ROOT / "tasks"
COURSE_PAGE = COURSE_ROOT / "index.html"
RUNNER_DIR = SRC_DIR / "courses/python_intro/runner"
RUNNER_TEMPLATE = RUNNER_DIR / "index.html"
HARNESS_FILE = RUNNER_DIR / "judge_harness.py"
ARTICLES_DIR = SRC_DIR / "articles/kurs_podstaw_pythona"
DATA_DIR = ROOT_DIR / "scripts/course_data/nauka_programowania"
CHAPTERS_DIR = DATA_DIR / "chapters"
SOURCE_FILE = DATA_DIR / "source.json"
SITE_URL = "https://adamdjellouli.com/"
COURSE_NAME = "Kurs Podstaw Pythona"
PRISM = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0"
KATEX = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.18.9"
REPOSITORY_URL = "https://github.com/djeada/Nauka-Programowania"
DESCRIPTION_LENGTH = 158
PROGRESS_VERSION = 2
PROGRESS_RESET = ["15_funkcje_rekurencja_"]
MIGRATION_JS = (
    "var pykStore = window.localStorage;"
    f"if (pykStore.getItem('pyk:version') !== '{PROGRESS_VERSION}') {{"
    f"var pykReset = {json.dumps(PROGRESS_RESET)};"
    "var pykStale = function (slug) { return pykReset.some(function (p) { return String(slug).indexOf(p) === 0; }); };"
    "var pykSolved = JSON.parse(pykStore.getItem('pyk:solved') || '[]');"
    "if (Array.isArray(pykSolved)) pykStore.setItem('pyk:solved', JSON.stringify(pykSolved.filter(function (s) { return !pykStale(s); })));"
    "if (pykStale(pykStore.getItem('pyk:last') || '')) pykStore.removeItem('pyk:last');"
    "Object.keys(pykStore).forEach(function (k) { if (k.indexOf('pyk:code:') === 0 && pykStale(k.slice(9))) pykStore.removeItem(k); });"
    f"pykStore.setItem('pyk:version', '{PROGRESS_VERSION}');"
    "}"
)

BASICS = "01_podstawy/"
INTERMEDIATE = "02_sredniozawansowane/"
PRACTICE = "04_python_w_praktyce/"
VARIABLES = (
    BASICS + "03_zmienne.html",
    "Zmienne i konwersja typów",
    "konwersja-typów-rzutowanie",
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
    "listy-dwuwymiarowe-macierze",
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
SETS = (BASICS + "08_struktury_danych.html", "Zbiory", "zbiór")
TUPLES = (BASICS + "08_struktury_danych.html", "Krotki", "krotka")
RANDOM = (
    BASICS + "10_liczby_losowe.html",
    "Liczby losowe i random.seed",
    "reprodukowalność-random-seed",
)
EXCEPTIONS = (
    INTERMEDIATE + "06_wyjatki.html",
    "Wyjątki: try / except",
    "obsługa-wyjątków-za-pomocą-bloków-try-i-except",
)
RAISE = (
    INTERMEDIATE + "06_wyjatki.html",
    "Zgłaszanie wyjątków (raise)",
    "generowanie-własnych-wyjątków",
)
CUSTOM_EXCEPTIONS = (
    INTERMEDIATE + "06_wyjatki.html",
    "Własne klasy wyjątków",
    "tworzenie-własnych-klas-wyjątków",
)
REFERENCES = (
    INTERMEDIATE + "02_referencje_i_kopiowanie.html",
    "Referencje i kopiowanie",
    "typowe-pułapki-z-referencjami",
)
PURE_FUNCTIONS = (
    INTERMEDIATE + "03_czyste_funkcje_i_skutki_uboczne.html",
    "Czyste funkcje i skutki uboczne",
    None,
)
DATACLASSES = (INTERMEDIATE + "12_klasy_danych.html", "Klasy danych (dataclass)", None)
GENERATORS = (INTERMEDIATE + "13_generatory.html", "Generatory (yield)", None)
JSON_FILES = (
    INTERMEDIATE + "16_serializacja.html",
    "Moduł json",
    "serializacja-z-użyciem-modułu-json",
)
UNIT_TESTS = (
    "03_inzynieria_oprogramowania/07_testy_jednostkowe.html",
    "Testy i asercje",
    None,
)
RECURSION = (
    INTERMEDIATE + "11_programowanie_funkcyjne.html",
    "Rekurencja i programowanie funkcyjne",
    None,
)
FILES = (
    PRACTICE + "02_praca_z_plikami_i_folderami.html",
    "Praca z plikami i folderami",
    None,
)


THEORY: Dict[str, List[Tuple[str, str, Optional[str]]]] = {
    "01_interakcja_z_konsola": [VARIABLES, FORMATTING],
    "02_instrukcja_warunkowa": [CONDITIONS],
    "03_daty": [CONDITIONS],
    "04_petla_wprowadzenie": [LOOPS, WHILE, EXCEPTIONS],
    "05_petla_wyznaczanie_cyfr_liczby": [WHILE],
    "06_funkcje_wprowadzenie": [FUNCTIONS, UNIT_TESTS],
    "07_petla_algorytmy_matematyczne": [LOOPS, FUNCTIONS],
    "08_petla_petle_zagniezdzone": [NESTED, FORMATTING],
    "09_listy_wprowadzenie": [LISTS, RANDOM],
    "10_listy_dwie_listy": [LISTS, ZIP, SETS],
    "11_napisy_wprowadzenie": [STRINGS, FORMATTING],
    "12_napisy_anagramy_i_palindromy": [STRINGS],
    "13_listy_2d": [MATRICES, REFERENCES],
    "14_funkcje_wielomiany": [FUNCTIONS, PURE_FUNCTIONS],
    "15_funkcje_rekurencja": [FUNCTIONS, RECURSION],
    "16_system_binarny": [VARIABLES],
    "17_slowniki": [DICTS, TUPLES],
    "18_klasy": [CLASSES, DATACLASSES, RAISE, GENERATORS],
    "19_dziedziczenie": [INHERITANCE, CUSTOM_EXCEPTIONS],
    "20_operacje_na_plikach": [FILES, JSON_FILES, EXCEPTIONS],
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
    tests: List[Dict[str, Any]]
    starter_code: str = ""
    starter_template: str = ""
    task_id: str = ""
    chapter: Optional[Chapter] = None
    number: int = 0

    @property
    def label(self) -> str:
        return f"{self.chapter.number}.{self.number}" if self.chapter else ""


LIST_RE = re.compile(r"^(\s*)([*-]|\d+[.)])\s+(.*)$")


INLINE_TOKEN_RE = re.compile(r"(`[^`]+`|\$[^$\n]+\$)")


def _fraction(match: "re.Match[str]") -> str:
    wrap = lambda part: (
        f"({part})" if re.search(r"[\s+\-*/]", part.strip()) else part.strip()
    )
    return f"{wrap(match.group(1))}/{wrap(match.group(2))}"


LATEX_TEXT = [
    (re.compile(r"\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}"), _fraction),
    (re.compile(r"\\sqrt\{([^{}]*)\}"), r"√(\1)"),
    (re.compile(r"\\(?:cdot|times)"), "·"),
    (re.compile(r"\\(?:le|leq)\b"), "≤"),
    (re.compile(r"\\(?:ge|geq)\b"), "≥"),
    (re.compile(r"\\(?:ne|neq)\b"), "≠"),
    (re.compile(r"\\(?:l?dots|cdots)"), "…"),
    (re.compile(r"\\pi\b"), "π"),
    (re.compile(r"\\(?:text|mathrm|operatorname)\{([^{}]*)\}"), r"\1"),
    (re.compile(r"\\[a-zA-Z]+\s?"), ""),
    (re.compile(r"[{}]"), ""),
]


def _latex_to_text(text: str) -> str:
    def convert(match: "re.Match[str]") -> str:
        formula = match.group(1)
        for pattern, replacement in LATEX_TEXT:
            formula = pattern.sub(replacement, formula)
        return re.sub(r"\s+", " ", formula).strip()

    return re.sub(r"\$\$?([^$]+)\$\$?", convert, text)


def _has_math(text: str) -> bool:
    return bool(re.search(r"\$[^$\n]+\$", text or ""))


def _inline_markup(text: str) -> str:
    parts = INLINE_TOKEN_RE.split(text)
    out = []
    for part in parts:
        if len(part) > 1 and part.startswith("`") and part.endswith("`"):
            out.append(f"<code>{html.escape(part[1:-1])}</code>")
            continue
        if len(part) > 2 and part.startswith("$") and part.endswith("$"):
            out.append(f'<span class="pyk-math">{html.escape(part)}</span>')
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
    text = _latex_to_text(text)
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
    if task.starter_template.strip():
        return (
            f"# Zadanie {task.label}: {task.title}\n"
            + task.starter_template.rstrip()
            + "\n"
        )
    lines = [f"# Zadanie {task.label}: {task.title}"]
    if any((t.get("input") or "").strip() for t in task.tests + task.examples):
        lines.append("# Wczytaj dane, np.: a = int(input())")
    lines.append("# Wypisz wynik: print(...)")
    return "\n".join(lines) + "\n\n"


TASK_ID_RE = re.compile(r"^ZAD-\d{2}[A-Z]?$")
TEXT_FIELDS = (
    "id",
    "slug",
    "title",
    "description",
    "input",
    "output",
    "constraints",
    "notes",
)


def _check_files(where: str, files: Any, allow_none: bool, problems: List[str]) -> None:
    if not isinstance(files, dict):
        problems.append(f"{where}: must be an object")
        return
    for path, content in files.items():
        if (
            not isinstance(path, str)
            or not path
            or path.startswith("/")
            or ".." in path.split("/")
        ):
            problems.append(f"{where}: invalid relative path {path!r}")
        ok = isinstance(content, str) or (allow_none and content is None)
        if isinstance(content, dict):
            ok = isinstance(content.get("repeat"), str) and isinstance(
                content.get("times"), int
            )
        if not ok:
            problems.append(f"{where}: invalid content for {path!r}")


def _check_cases(where: str, cases: Any, problems: List[str]) -> None:
    if not isinstance(cases, list):
        problems.append(f"{where}: must be a list")
        return
    for n, case in enumerate(cases, start=1):
        label = f"{where}[{n}]"
        if not isinstance(case, dict):
            problems.append(f"{label}: must be an object")
            continue
        for key in ("input", "output"):
            if not isinstance(case.get(key), str):
                problems.append(f"{label}: '{key}' must be a string")
        if "files" in case:
            _check_files(f"{label}.files", case["files"], False, problems)
        if "expected_files" in case:
            _check_files(
                f"{label}.expected_files", case["expected_files"], True, problems
            )


def validate_chapters(chapters: Dict[str, Dict[str, Any]]) -> List[str]:
    problems: List[str] = []
    slugs: Dict[str, str] = {}
    if not chapters:
        problems.append("snapshot contains no chapters")
    for key, data in chapters.items():
        if key not in THEORY:
            problems.append(f"{key}: add theory links for this chapter to THEORY")
        exercises = data.get("exercises") if isinstance(data, dict) else None
        if not isinstance(exercises, list) or not exercises:
            problems.append(f"{key}: no exercises")
            continue
        for exercise in exercises:
            where = f"{key}/{exercise.get('id', '?')}"
            for name in TEXT_FIELDS:
                if not isinstance(exercise.get(name), str):
                    problems.append(f"{where}: '{name}' must be a string")
            if not TASK_ID_RE.match(str(exercise.get("id", ""))):
                problems.append(f"{where}: invalid id")
            if not str(exercise.get("title", "")).strip():
                problems.append(f"{where}: empty title")
            if not str(exercise.get("description", "")).strip():
                problems.append(f"{where}: empty description")
            if exercise.get("difficulty") not in (1, 2, 3):
                problems.append(f"{where}: difficulty must be 1, 2 or 3")
            if not isinstance(exercise.get("tags"), list):
                problems.append(f"{where}: 'tags' must be a list")
            if not isinstance(exercise.get("starter_code", ""), str):
                problems.append(f"{where}: 'starter_code' must be a string")
            _check_cases(f"{where}.examples", exercise.get("examples"), problems)
            _check_cases(f"{where}.testcases", exercise.get("testcases"), problems)
            slug = _slugify(str(exercise.get("slug") or ""))
            if slug in slugs:
                problems.append(f"{where}: slug {slug!r} already used by {slugs[slug]}")
            slugs[slug] = where
    return problems


def read_snapshot() -> Dict[str, Dict[str, Any]]:
    chapters = {
        path.stem: json.loads(path.read_text(encoding="utf-8"))
        for path in sorted(CHAPTERS_DIR.glob("*.json"))
    }
    problems = validate_chapters(chapters)
    if problems:
        raise SystemExit("Invalid task snapshot:\n  " + "\n  ".join(problems))
    return chapters


def read_source() -> Dict[str, Any]:
    source = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    if source.get("dirty"):
        print(
            "warning: task snapshot was synced from a checkout with uncommitted changes"
        )
    return source


def _case(raw: Dict[str, Any], expected_key: str) -> Dict[str, Any]:
    case = {"input": raw.get("input", ""), expected_key: raw.get("output", "")}
    for key in ("files", "expected_files"):
        if key in raw:
            case[key] = raw[key]
    return case


def load_chapters() -> List[Chapter]:
    chapters: List[Chapter] = []
    for number, (key, data) in enumerate(read_snapshot().items(), start=1):
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
                    {
                        **_case(ex, "output"),
                        "explanation": _markdown_to_html(
                            (ex.get("explanation") or "").strip()
                        ),
                    }
                    for ex in exercise.get("examples") or []
                ],
                tests=[_case(tc, "expected") for tc in exercise.get("testcases") or []],
                starter_template=exercise.get("starter_code") or "",
                task_id=exercise.get("id") or "",
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


def _file_content(spec: Any) -> str:
    if isinstance(spec, dict):
        size = len(str(spec.get("repeat", "")).encode("utf-8")) * int(
            spec.get("times", 0)
        )
        return f"({size} B)"
    return str(spec)


def _files_block(label: str, files: Dict[str, Any], expected: bool = False) -> str:
    if not files:
        return f'<div class="pyk-io pyk-files"><div class="pyk-io-label">{label}</div><p class="pyk-note">(pusty katalog)</p></div>'
    items = []
    for path, spec in sorted(files.items()):
        if path.endswith("/"):
            body = '<span class="pyk-file-meta">(katalog)</span>'
        elif spec is None:
            body = '<span class="pyk-file-meta">(usunięty)</span>'
        elif isinstance(spec, dict):
            body = f'<span class="pyk-file-meta">{_e(_file_content(spec))}</span>'
        elif not str(spec).strip():
            body = '<span class="pyk-file-meta">(pusty plik)</span>'
        else:
            body = f'<pre class="pyk-pre">{_e(str(spec).rstrip(chr(10)))}</pre>'
        items.append(f"<li><code>{_e(path)}</code>{body}</li>")
    kind = " pyk-files--expected" if expected else ""
    return f'<div class="pyk-io pyk-files{kind}"><div class="pyk-io-label">{label}</div><ul class="pyk-file-list">{"".join(items)}</ul></div>'


def _uses_math(task: Task) -> bool:
    chapter_description = task.chapter.description if task.chapter else ""
    return any(
        "pyk-math" in part
        for part in (
            task.statement,
            task.input_format,
            task.output_format,
            task.constraints,
            task.notes,
            chapter_description,
        )
    ) or any("pyk-math" in ex.get("explanation", "") for ex in task.examples)


def _harness_version() -> str:
    return (
        hashlib.sha256(HARNESS_FILE.read_bytes()).hexdigest()[:10]
        if HARNESS_FILE.exists()
        else "dev"
    )


def _source_links(task: Task, commit: str) -> str:
    chapter = task.chapter
    ref = commit or "master"
    source = (
        f"{REPOSITORY_URL}/blob/{ref}/zbior_zadan/{chapter.key}.md"
        if chapter
        else REPOSITORY_URL
    )
    title = f"[{chapter.key}/{task.task_id}] {task.title}" if chapter else task.title
    issue = f"{REPOSITORY_URL}/issues/new?title={html.escape(_url_quote(title))}"
    return (
        '<p class="pyk-source pyk-note">Zadanie pochodzi z otwartego zbioru '
        f'<a href="{source}" rel="noopener" target="_blank">Nauka-Programowania</a> '
        "(z rozwiązaniami wzorcowymi). "
        f'<a href="{issue}" rel="noopener" target="_blank">Zgłoś błąd w treści lub testach</a>.</p>'
    )


def _url_quote(text: str) -> str:
    from urllib.parse import quote

    return quote(text, safe="")


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
    title: str,
    description: str,
    canonical: str,
    breadcrumbs: List[Tuple[str, str]],
    math: bool = False,
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
        + (
            [f'    <link rel="stylesheet" href="{KATEX}/katex.min.css">']
            if math
            else []
        )
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
    commit: str = "",
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
            before = (
                f'<div class="pyk-example pyk-example-files">{_files_block("Pliki przed uruchomieniem", example["files"])}</div>'
                if "files" in example
                else ""
            )
            after = (
                f'<div class="pyk-example pyk-example-files">{_files_block("Pliki po uruchomieniu", example["expected_files"], expected=True)}</div>'
                if "expected_files" in example
                else ""
            )
            statement.append(
                before
                + '<div class="pyk-example">'
                + _io_block("Wejście", example.get("input", ""))
                + _io_block("Wyjście", example.get("output", ""))
                + "</div>"
                + after
                + (
                    f'<div class="pyk-example-note">{example["explanation"]}</div>'
                    if example.get("explanation")
                    else ""
                )
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
    if chapter and task.task_id:
        statement.append(_source_links(task, commit))

    tests_html = []
    for idx, test in enumerate(task.tests):
        files_html = ""
        if "files" in test or "expected_files" in test:
            files_html = '<div class="pyk-test-io pyk-test-files">'
            files_html += _files_block(
                "Pliki przed uruchomieniem", test.get("files") or {}
            )
            if "expected_files" in test:
                files_html += _files_block(
                    "Pliki po uruchomieniu", test["expected_files"], expected=True
                )
            files_html += "</div>"
        tests_html.append(
            f"""<div class="pyk-test" data-index="{idx}" data-state="idle">
                <div class="pyk-test-head"><h3>Test {idx + 1}</h3><span class="pyk-test-state">Nie uruchomiono</span></div>
                <div class="pyk-test-io">{_io_block("Wejście", test["input"])}{_io_block("Oczekiwane wyjście", test["expected"])}</div>
                {files_html}
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

    sample_files = next(
        (c["files"] for c in task.examples + task.tests if "files" in c), None
    )
    data = {
        "slug": task.slug,
        "tests": task.tests,
        "starter": task.starter_code,
        "track": track,
        "harness": _harness_version(),
        "progress": {"version": PROGRESS_VERSION, "reset": PROGRESS_RESET},
        "sample_files": sample_files,
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
        {_math_scripts() if _uses_math(task) else ""}
        <script src="{PRISM}/prism.min.js" data-manual defer></script>
        <script src="{PRISM}/components/prism-python.min.js" defer></script>
        <script src="{judge_src}" defer></script>
    </main>"""


def _math_scripts() -> str:
    return (
        f'<script src="{KATEX}/katex.min.js" defer></script>'
        f'<script src="{KATEX}/contrib/auto-render.min.js" defer></script>'
    )


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
    task: Task,
    template: str,
    prev_task: Optional[Task],
    next_task: Optional[Task],
    commit: str = "",
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
        math=_uses_math(task),
    )
    main = render_main(
        task,
        course_href="../index.html",
        judge_src="../../python_intro/runner/judge.js",
        prev_task=prev_task,
        next_task=next_task,
        position=f"Zadanie {task.number} z {len(chapter.tasks)} · rozdział {chapter.number}",
        commit=commit,
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


def render_course_tasks(chapters: List[Chapter], commit: str = "") -> str:
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
                        <p class="pyk-note pyk-source">Zadania pochodzą z otwartego zbioru <a href="{REPOSITORY_URL}/tree/{commit or "master"}" rel="noopener" target="_blank">Nauka-Programowania</a> na GitHubie — znajdziesz tam też rozwiązania wzorcowe w Pythonie i innych językach.</p>
                    </div>
                    <ol class="pyk-toc">{"".join(toc)}</ol>
                    {"".join(sections)}
                    <script>
                        (function () {{
                            var solved = [];
                            var last = null;
                            try {{
                                {MIGRATION_JS}
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


def update_course_page(chapters: List[Chapter], commit: str = "") -> None:
    page = COURSE_PAGE.read_text(encoding="utf-8")
    pattern = r"<!-- TASKS:START -->.*?<!-- TASKS:END -->"
    replacement = f"<!-- TASKS:START -->\n{render_course_tasks(chapters, commit)}\n<!-- TASKS:END -->"
    COURSE_PAGE.write_text(
        re.sub(pattern, lambda _: replacement, page, flags=re.S), encoding="utf-8"
    )


def main() -> None:
    if not RUNNER_TEMPLATE.exists():
        raise FileNotFoundError(f"Runner template not found: {RUNNER_TEMPLATE}")

    if not HARNESS_FILE.exists():
        raise FileNotFoundError(
            f"Judge harness not found: {HARNESS_FILE} (run sync_course_tasks.py)"
        )

    template = RUNNER_TEMPLATE.read_text(encoding="utf-8")
    commit = read_source().get("commit", "")
    chapters = load_chapters()
    tasks = [task for chapter in chapters for task in chapter.tasks]

    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    written = set()
    for idx, task in enumerate(tasks):
        prev_task = tasks[idx - 1] if idx > 0 else None
        next_task = tasks[idx + 1] if idx + 1 < len(tasks) else None
        page = build_task_page(task, template, prev_task, next_task, commit)
        (TASKS_DIR / f"{task.slug}.html").write_text(page, encoding="utf-8")
        written.add(f"{task.slug}.html")

    removed = [path for path in TASKS_DIR.glob("*.html") if path.name not in written]
    for path in removed:
        path.unlink()

    RUNNER_TEMPLATE.write_text(build_template_demo(template), encoding="utf-8")
    update_course_page(chapters, commit)
    suffix = f", removed {len(removed)} stale" if removed else ""
    print(f"Generated {len(tasks)} task pages in {len(chapters)} chapters{suffix}.")


if __name__ == "__main__":
    main()
