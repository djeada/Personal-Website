import html
import json
import re
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict, Iterable


@dataclass
class Task:
    slug: str
    title: str
    difficulty: str
    summary: str
    statement: str
    input_format: str
    output_format: str
    examples: List[Dict[str, str]]
    public_tests: List[Dict[str, str]]
    hidden_tests: List[Dict[str, str]]
    starter_code: str
    chapter_title: str = ""
    chapter_description: str = ""
    constraints: str = ""
    notes: str = ""


ROOT_DIR = Path(__file__).resolve().parent.parent
COURSE_ROOT = ROOT_DIR / "src/courses/kurs_podstaw_pythona"
TASKS_DIR = COURSE_ROOT / "tasks"
COURSE_PAGE = COURSE_ROOT / "index.html"
RUNNER_TEMPLATE = ROOT_DIR / "src/courses/python_intro/runner/index.html"
RESOURCE_PREFIX = "../../../"
FOOTER_TEMPLATE = ROOT_DIR / "src/building_blocks/footer_tool.html"
SOURCES = [
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/01_interakcja_z_konsola.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/02_instrukcja_warunkowa.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/03_daty.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/04_petla_wprowadzenie.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/05_petla_wyznaczanie_cyfr_liczby.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/06_funkcje_wprowadzenie.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/07_petla_algorytmy_matematyczne.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/08_petla_petle_zagniezdzone.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/09_listy_wprowadzenie.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/10_listy_dwie_listy.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/11_napisy_wprowadzenie.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/12_napisy_anagramy_i_palindromy.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/13_listy_2d.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/14_funkcje_wielomiany.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/15_funkcje_rekurencja.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/16_system_binarny.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/17_slowniki.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/18_klasy.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/19_dziedziczenie.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/20_operacje_na_plikach.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/21_sortowanie_algorytmy.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/22_sortowanie_praktyka.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/23_wyrazenia_regularne.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/24_listy_trudne.json",
    "https://raw.githubusercontent.com/djeada/Nauka-Programowania/refs/heads/master/zbior_zadan_json/25_napisy_trudne.json",
]


def load_tasks() -> List[Task]:
    tasks: List[Task] = []
    for url in SOURCES:
        data = _fetch_json(url)
        chapter_title = data.get("chapter_title", "").strip()
        chapter_description = _markdown_to_html(
            data.get("chapter_description", "").strip()
        )
        for exercise in data.get("exercises", []):
            slug = _slugify(
                exercise.get("slug")
                or exercise.get("id")
                or exercise.get("title")
                or ""
            )
            title = exercise.get("title", "").strip()
            difficulty = _format_difficulty(exercise)
            description = exercise.get("description", "").strip()
            summary = _summary_from_text(description)
            statement = _markdown_to_html(description)
            input_format = _markdown_to_html(exercise.get("input", "").strip())
            output_format = _markdown_to_html(exercise.get("output", "").strip())
            constraints = _markdown_to_html(exercise.get("constraints", "").strip())
            notes = _markdown_to_html(exercise.get("notes", "").strip())
            examples = _select_examples(exercise)
            tests = _convert_testcases(exercise.get("testcases", []))
            public_tests = tests[:3]
            hidden_tests = tests[3:]
            tasks.append(
                Task(
                    slug=slug,
                    title=title,
                    difficulty=difficulty,
                    summary=summary,
                    statement=statement,
                    input_format=input_format,
                    output_format=output_format,
                    examples=examples,
                    public_tests=public_tests,
                    hidden_tests=hidden_tests,
                    starter_code=_default_starter_code(title),
                    chapter_title=chapter_title,
                    chapter_description=chapter_description,
                    constraints=constraints,
                    notes=notes,
                )
            )
    return tasks


def _fetch_json(url: str) -> Dict:
    with urllib.request.urlopen(url, timeout=20) as response:
        return json.load(response)


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", text.lower()).strip("_")
    return slug or "task"


def _format_difficulty(exercise: Dict) -> str:
    display = exercise.get("difficulty_display")
    if display:
        return display
    level = exercise.get("difficulty")
    if isinstance(level, int):
        return "*" * level or "?"
    return str(level) if level is not None else "?"


def _summary_from_text(text: str) -> str:
    if not text:
        return ""
    for line in text.splitlines():
        clean = line.strip()
        if not clean:
            continue
        if clean.startswith(("* ", "- ")):
            clean = clean[2:].strip()
        clean = re.sub(r"`([^`]*)`", r"\1", clean)
        clean = re.sub(r"\*\*([^*]+)\*\*", r"\1", clean)
        clean = re.sub(r"\s+", " ", clean).strip()
        return clean[:160]
    return ""


def _inline_markup(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    return escaped


def _markdown_to_html(text: str) -> str:
    if not text:
        return ""
    lines = [line.rstrip() for line in text.splitlines()]
    blocks: List[str] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith(("* ", "- ")):
            items = []
            while i < len(lines):
                line = lines[i].strip()
                if not line or not line.startswith(("* ", "- ")):
                    break
                items.append(f"<li>{_inline_markup(line[2:].strip())}</li>")
                i += 1
            blocks.append("<ul>" + "".join(items) + "</ul>")
            continue
        paragraph = []
        while i < len(lines):
            line = lines[i].strip()
            if not line or line.startswith(("* ", "- ")):
                break
            paragraph.append(_inline_markup(line))
            i += 1
        blocks.append("<p>" + "<br>".join(paragraph) + "</p>")
    return "\n".join(blocks)


def _select_examples(exercise: Dict) -> List[Dict[str, str]]:
    examples = exercise.get("examples") or []
    if examples:
        return [
            {"input": ex.get("input", ""), "output": ex.get("output", "")}
            for ex in examples
        ]
    fallback = []
    for tc in (exercise.get("testcases") or [])[:2]:
        fallback.append({"input": tc.get("input", ""), "output": tc.get("output", "")})
    return fallback


def _convert_testcases(testcases: Iterable[Dict[str, str]]) -> List[Dict[str, str]]:
    tests = []
    for tc in testcases:
        tests.append({"input": tc.get("input", ""), "expected": tc.get("output", "")})
    return tests


def _default_starter_code(title: str) -> str:
    return """# Wpisz rozwiazanie tutaj.
# TODO: Rozwiaz problem.
"""


def _escape_stub(stub: str) -> str:
    return stub.replace("`", "\\`").rstrip()


def _format_examples(examples: List[Dict[str, str]]) -> str:
    if not examples:
        return "Brak przykladow."
    blocks = []
    for example in examples:
        blocks.append(
            "Input:\n"
            + example.get("input", "").rstrip()
            + "\n\nOutput:\n"
            + example.get("output", "").rstrip()
        )
    return "\n\n---\n\n".join(blocks)


def _scope_css(css: str) -> str:
    if ".sandbox" in css:
        return css
    output = []
    chunks = css.split("}")
    for chunk in chunks:
        if "{" not in chunk:
            output.append(chunk)
            continue
        selector, body = chunk.split("{", 1)
        selector = selector.strip()
        if not selector:
            output.append(chunk)
            continue
        if selector.lstrip().startswith("@"):
            output.append(chunk + "}")
            continue
        selectors = [s.strip() for s in selector.split(",") if s.strip()]
        scoped = []
        for sel in selectors:
            if sel in ("html", "body", ":root"):
                scoped.append(".sandbox")
            elif sel.startswith(".sandbox"):
                scoped.append(sel)
            else:
                scoped.append(f".sandbox {sel}")
        output.append(", ".join(scoped) + " {" + body + "}")
    return "".join(output)


def build_task_page(task: Task, template: str) -> str:
    html = template

    html = html.replace(
        "</head>",
        f'    <link rel="stylesheet" type="text/css" href="{RESOURCE_PREFIX}resources/style.css">\n'
        "    <style>\n"
        "        body.task-page {\n"
        "            min-height: 100vh;\n"
        "            height: auto;\n"
        "            display: block;\n"
        "        }\n"
        "        body.task-page .sandbox {\n"
        "            max-width: 1200px;\n"
        "            margin: 24px auto 0;\n"
        "            padding: 0 20px 40px;\n"
        "        }\n"
        "    </style>\n"
        "</head>",
        1,
    )

    html = re.sub(
        r"<title>.*?</title>",
        f"<title>{task.title} | Kurs Podstaw Pythona</title>",
        html,
        count=1,
    )
    html = html.replace("<h1>Frontend-only Python Judge</h1>", f"<h1>{task.title}</h1>")

    html = html.replace("<body>", '<body class="task-page">', 1)
    html = html.replace(
        '<div class="wrap">',
        '<div class="sandbox">\n    <div class="wrap">',
        1,
    )
    html = html.replace("</body>", "    </div>\n</div>\n</body>", 1)
    html = html.replace(
        "</body>",
        f'    <script src="{RESOURCE_PREFIX}app.js"></script>\n</body>',
        1,
    )
    if FOOTER_TEMPLATE.exists():
        footer_html = FOOTER_TEMPLATE.read_text(encoding="utf-8")
        footer_html = footer_html.replace("../../", RESOURCE_PREFIX)
        html = html.replace("</body>", f"{footer_html}\n</body>", 1)

    def _style_replacer(match: re.Match) -> str:
        scoped = _scope_css(match.group(1))
        return f"<style>\n{scoped}\n    </style>"

    html = re.sub(r"<style>(.*?)</style>", _style_replacer, html, flags=re.S, count=1)

    description_block = (
        f'<div id="task-description-data" style="display:none">{task.statement}</div>'
    )

    if "<!-- TASK:SUMMARY -->" in html:
        html = html.replace("<!-- TASK:SUMMARY -->", description_block, 1)
    elif '<div id="task-summary"></div>' in html:
        html = html.replace('<div id="task-summary"></div>', description_block, 1)

    style_inject = ""

    public_js = json.dumps(task.public_tests, indent=4)
    hidden_js = json.dumps(task.hidden_tests, indent=4)
    html = re.sub(
        r"const PUBLIC_TESTS = \[.*?\];",
        lambda _: f"const PUBLIC_TESTS = {public_js};",
        html,
        flags=re.S,
    )
    html = re.sub(
        r"const HIDDEN_TESTS = \[.*?\];",
        lambda _: f"const HIDDEN_TESTS = {hidden_js};",
        html,
        flags=re.S,
    )

    stub = _escape_stub(task.starter_code)
    html = re.sub(r"const STUB = `.*?`;", f"const STUB = `{stub}`;", html, flags=re.S)

    return html


def update_course_page(tasks: List[Task]) -> None:
    html = COURSE_PAGE.read_text(encoding="utf-8")
    chapter_groups: Dict[str, List[Task]] = {}
    chapter_descriptions: Dict[str, str] = {}
    for task in tasks:
        chapter = task.chapter_title or "Zadania"
        chapter_groups.setdefault(chapter, []).append(task)
        if task.chapter_description:
            chapter_descriptions[chapter] = task.chapter_description

    sections = []
    for chapter_title, chapter_tasks in chapter_groups.items():
        cards = []
        for task in chapter_tasks:
            cards.append(
                f"""<a href="./tasks/{task.slug}.html" class="tool-card">
                        <h3>{task.title}</h3>
                        <p>{task.summary}</p>
                        <div class="muted">Trudnosc: {task.difficulty}</div>
                    </a>"""
            )
        description_html = ""
        if chapter_descriptions.get(chapter_title):
            description_html = f'<div class="muted chapter-description">{chapter_descriptions[chapter_title]}</div>'
        sections.append(
            f"""<div class="course-chapter">
                    <h3>{chapter_title}</h3>
                    {description_html}
                    <div class="tools-grid">
                        {"".join(cards)}
                    </div>
                </div>"""
        )
    tasks_html = "\n".join(sections)
    pattern = r"<!-- TASKS:START -->.*?<!-- TASKS:END -->"
    replacement = f"<!-- TASKS:START -->\n{tasks_html}\n<!-- TASKS:END -->"
    updated_html = re.sub(pattern, lambda _: replacement, html, flags=re.S)
    COURSE_PAGE.write_text(updated_html, encoding="utf-8")


def main() -> None:
    if not RUNNER_TEMPLATE.exists():
        raise FileNotFoundError(f"Runner template not found: {RUNNER_TEMPLATE}")

    template = RUNNER_TEMPLATE.read_text(encoding="utf-8")
    tasks = load_tasks()

    TASKS_DIR.mkdir(parents=True, exist_ok=True)
    for task in tasks:
        html = build_task_page(task, template)
        (TASKS_DIR / f"{task.slug}.html").write_text(html, encoding="utf-8")

    update_course_page(tasks)


if __name__ == "__main__":
    main()
