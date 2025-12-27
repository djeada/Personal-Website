import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import List, Dict


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


ROOT_DIR = Path(__file__).resolve().parent.parent
COURSE_ROOT = ROOT_DIR / "src/courses/kurs_podstaw_pythona"
TASKS_DIR = COURSE_ROOT / "tasks"
COURSE_PAGE = COURSE_ROOT / "index.html"
RUNNER_TEMPLATE = ROOT_DIR / "src/courses/python_intro/runner/index.html"
RESOURCE_PREFIX = "../../../"
FOOTER_TEMPLATE = ROOT_DIR / "src/building_blocks/footer_tool.html"


def load_tasks() -> List[Task]:

    mock_tasks = [
        {
            "slug": "01_sum_of_numbers",
            "title": "Suma liczb",
            "difficulty": "Easy",
            "summary": "Wczytaj N liczb i wypisz ich sume.",
            "statement": "Masz podana liczbe N oraz N liczb calkowitych. Oblicz ich sume.",
            "input_format": "Pierwsza linia: N. Druga linia: N liczb calkowitych.",
            "output_format": "Jedna liczba: suma podanych liczb.",
            "examples": [
                {"input": "3\n1 2 3\n", "output": "6"},
                {"input": "4\n10 20 30 40\n", "output": "100"},
            ],
            "public_tests": [
                {"input": "3\n1 2 3\n", "expected": "6"},
                {"input": "2\n100 100\n", "expected": "200"},
                {"input": "1\n42\n", "expected": "42"},
            ],
            "hidden_tests": [
                {"input": "1\n-5\n", "expected": "-5"},
                {"input": "5\n0 0 0 0 0\n", "expected": "0"},
            ],
            "starter_code": """# Wczytaj N liczb i wypisz ich sume.
# Mozesz zdefiniowac solve(s) lub uzyc input()/print().

# def solve(s: str) -> str:
#     data = list(map(int, s.split()))
#     n, nums = data[0], data[1:]
#     return str(sum(nums[:n]))

# n = int(input().strip())
# nums = list(map(int, input().split()))
# print(sum(nums[:n]))
""",
        },
        {
            "slug": "02_count_vowels",
            "title": "Policz samogloski",
            "difficulty": "Easy",
            "summary": "Zlicz samogloski w podanym napisie.",
            "statement": "Otrzymujesz pojedyncza linie tekstu. Policz, ile zawiera samoglosek.",
            "input_format": "Jedna linia tekstu.",
            "output_format": "Jedna liczba: liczba samoglosek w tekscie.",
            "examples": [
                {"input": "Ala ma kota\n", "output": "5"},
                {"input": "xyz\n", "output": "0"},
            ],
            "public_tests": [
                {"input": "Ala ma kota\n", "expected": "5"},
                {"input": "Python\n", "expected": "1"},
                {"input": "xyz\n", "expected": "0"},
            ],
            "hidden_tests": [
                {"input": "Zazolc gesla jazn\n", "expected": "6"},
                {"input": "aeiouyAEIOUY\n", "expected": "12"},
            ],
            "starter_code": """# Policz samogloski w tekscie.
# Samogloski: a, e, i, o, u, y (takze wielkie litery).

# def solve(s: str) -> str:
#     vowels = set("aeiouyAEIOUY")
#     return str(sum(1 for ch in s if ch in vowels))

# text = input()
# vowels = set("aeiouyAEIOUY")
# print(sum(1 for ch in text if ch in vowels))
""",
        },
    ]
    return [Task(**task) for task in mock_tasks]


def _escape_stub(stub: str) -> str:
    return stub.replace("`", "\\`").rstrip()


def _format_examples(examples: List[Dict[str, str]]) -> str:
    blocks = []
    for example in examples:
        blocks.append(
            "Input:\n"
            + example["input"].rstrip()
            + "\n\nOutput:\n"
            + example["output"].rstrip()
        )
    return "\n\n---\n\n".join(blocks)


def _scope_css(css: str) -> str:
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

    summary_block = f"""<p class="muted">{task.summary}</p>
        <div class="panel" style="margin-bottom:16px;">
            <div class="task-meta">
                <span class="muted">Difficulty: {task.difficulty}</span>
                <a href="../index.html">Back to course</a>
            </div>
            <div class="task-section">
                <h2>Problem</h2>
                <p>{task.statement}</p>
                <h3>Input</h3>
                <p>{task.input_format}</p>
                <h3>Output</h3>
                <p>{task.output_format}</p>
                <h3>Examples</h3>
                <pre>{_format_examples(task.examples)}</pre>
            </div>
        </div>"""

    html = re.sub(
        r'<p class="muted">.*?</p>',
        summary_block,
        html,
        count=1,
        flags=re.S,
    )

    style_inject = """
        .task-meta {
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
            margin-bottom: 8px;
        }
        .task-section h2,
        .task-section h3 {
            margin: 10px 0 6px;
        }
        .task-section pre {
            background: #0b1022;
            border: 1px solid #1f2937;
            border-radius: 10px;
            padding: 10px;
            margin: 6px 0 0;
        }
    """
    html = html.replace("</style>", style_inject + "\n    </style>")

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
    tasks_cards = []
    for task in tasks:
        tasks_cards.append(
            f"""<a href="./tasks/{task.slug}.html" class="tool-card">
                    <h3>{task.title}</h3>
                    <p>{task.summary}</p>
                    <div class="muted">Difficulty: {task.difficulty}</div>
                </a>"""
        )
    tasks_html = '<div class="tools-grid">' + "\n".join(tasks_cards) + "</div>"
    pattern = r"<!-- TASKS:START -->.*?<!-- TASKS:END -->"
    replacement = f"<!-- TASKS:START -->\n{tasks_html}\n<!-- TASKS:END -->"
    updated_html = re.sub(pattern, replacement, html, flags=re.S)
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
