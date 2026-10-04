import importlib.util
import json
import re
import unittest

from scripts import generate_course_tasks as course


def load_harness():
    spec = importlib.util.spec_from_file_location("judge_harness", course.HARNESS_FILE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def exercise(**overrides):
    base = {
        "id": "ZAD-01",
        "slug": "02_instrukcja_warunkowa/ZAD-01",
        "title": "Suma",
        "difficulty": 1,
        "difficulty_display": "★☆☆",
        "tags": ["if"],
        "description": "Wczytaj $a$ i $b$, wypisz $a+b$.",
        "input": "Dwie liczby.",
        "output": "Suma.",
        "examples": [{"input": "1\n2", "output": "3", "explanation": ""}],
        "testcases": [{"input": "2\n2", "output": "4"}],
        "constraints": "",
        "notes": "",
        "starter_code": "",
    }
    base.update(overrides)
    return base


class HarnessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.harness = load_harness()

    def run_code(self, code, **case):
        result = self.harness.run(code, [case])
        self.assertNotIn("compile_error", result)
        return result["results"][0]

    def test_numbers_are_compared_with_tolerance_but_text_is_strict(self):
        same = self.harness.same_output
        self.assertTrue(same("3.0\n", "3"))
        self.assertTrue(same("Pole: 28.274", "Pole: 28.27"))
        self.assertFalse(same("pole: 28.27", "Pole: 28.27"))
        self.assertFalse(same("1 2 3", "1\n2\n3"))
        self.assertFalse(same("28.3", "28.27"))
        self.assertFalse(same("1:5", "01:05"))
        self.assertFalse(same("10", "010"))
        self.assertTrue(same("-3", "-3.0"))
        self.assertTrue(same("a  \n\n", "a"))

    def test_prompts_passed_to_input_are_not_printed(self):
        result = self.run_code('n = int(input("Podaj n: "))\nprint(n * 2)', input="21", expected="42")
        self.assertTrue(result["ok"])
        self.assertEqual(result["output"], "42\n")

    def test_runtime_error_reports_line(self):
        result = self.run_code("x = 1\ny = x / 0", input="", expected="")
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["type"], "ZeroDivisionError")
        self.assertEqual(result["error"]["line"], 2)

    def test_syntax_error_is_reported_as_compile_error(self):
        result = self.harness.run("if True print(1)", [{"input": "", "expected": "1"}])
        self.assertEqual(result["compile_error"]["line"], 1)

    def test_file_fixtures_and_expected_files(self):
        code = (
            "import os\n"
            "folder = input()\n"
            "for name in sorted(os.listdir(folder)):\n"
            "    if name.endswith('.tmp'):\n"
            "        os.remove(os.path.join(folder, name))\n"
            "        print(name)\n"
            "open('raport.txt', 'w').write('ok\\n')\n"
        )
        case = {
            "input": "dane",
            "expected": "a.tmp",
            "files": {"dane/a.tmp": "x", "dane/b.txt": {"repeat": "y", "times": 3}},
            "expected_files": {"dane/a.tmp": None, "dane/b.txt": "yyy", "raport.txt": "ok"},
        }
        self.assertTrue(self.run_code(code, **case)["ok"])
        failing = self.run_code("print('a.tmp')", **case)
        self.assertFalse(failing["ok"])
        self.assertEqual([f["path"] for f in failing["files"] if not f["ok"]], ["dane/a.tmp", "raport.txt"])


class SnapshotValidationTests(unittest.TestCase):
    def chapter(self, *exercises):
        return {"02_instrukcja_warunkowa": {"chapter_title": "Rozdział", "exercises": list(exercises)}}

    def test_valid_chapter_passes(self):
        self.assertEqual(course.validate_chapters(self.chapter(exercise())), [])

    def test_duplicate_slugs_and_bad_fields_are_rejected(self):
        problems = course.validate_chapters(
            self.chapter(
                exercise(),
                exercise(id="ZAD-1", difficulty=5, description=" "),
            )
        )
        joined = "\n".join(problems)
        self.assertIn("already used", joined)
        self.assertIn("invalid id", joined)
        self.assertIn("difficulty", joined)
        self.assertIn("empty description", joined)

    def test_file_paths_must_stay_inside_the_working_directory(self):
        bad = exercise(testcases=[{"input": "", "output": "", "files": {"../etc/passwd": "x"}}])
        self.assertTrue(any("invalid relative path" in p for p in course.validate_chapters(self.chapter(bad))))

    def test_unknown_chapters_need_theory_links(self):
        problems = course.validate_chapters({"99_nowy_rozdzial": {"exercises": [exercise()]}})
        self.assertTrue(any("THEORY" in p for p in problems))


class RenderingTests(unittest.TestCase):
    def test_math_is_protected_from_markdown_emphasis(self):
        html = course._inline_markup("Oblicz $a*b*c$ oraz *ważne*")
        self.assertIn('<span class="pyk-math">$a*b*c$</span>', html)
        self.assertIn("<em>ważne</em>", html)

    def test_plain_text_converts_latex_for_meta_descriptions(self):
        text = course._plain_text(r"Pole to $\frac{1}{2} a \cdot h$, gdzie $a \le 10$.")
        self.assertEqual(text, "Pole to 1/2 a · h, gdzie a ≤ 10.")
        self.assertEqual(course._plain_text(r"$\frac{a+b}{2}$"), "(a+b)/2")

    def test_starter_code_from_snapshot_is_used(self):
        task = course.Task(
            slug="s", title="Suma", difficulty="★", level=1, tags=[], summary="", plain="",
            statement="", input_format="", output_format="", constraints="", notes="",
            examples=[], tests=[], starter_template="def suma(a, b):\n    pass\n",
        )
        self.assertEqual(course._starter_code(task), "# Zadanie : Suma\ndef suma(a, b):\n    pass\n")


class TheoryLinkTests(unittest.TestCase):
    def test_every_theory_link_points_to_an_existing_article_and_anchor(self):
        for key, entries in course.THEORY.items():
            links = course._theory_links(key)
            self.assertEqual(len(links), len(entries), f"{key}: missing theory article")
            for (href, _), (_, _, anchor) in zip(links, entries):
                if anchor:
                    self.assertTrue(href.endswith("#" + anchor), f"{key}: anchor #{anchor} not found")


class CommittedSnapshotTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.chapters = course.read_snapshot()

    def test_snapshot_comes_from_a_clean_commit(self):
        source = json.loads(course.SOURCE_FILE.read_text(encoding="utf-8"))
        self.assertRegex(source["commit"], r"^[0-9a-f]{40}$")
        self.assertFalse(source["dirty"], "sync_course_tasks.py was run on a checkout with uncommitted changes")

    def test_every_task_has_an_up_to_date_page(self):
        expected = {}
        for key, data in self.chapters.items():
            for ex in data["exercises"]:
                expected[course._slugify(ex["slug"]) + ".html"] = ex
        pages = {path.name for path in course.TASKS_DIR.glob("*.html")}
        self.assertEqual(pages, set(expected), "re-run generate_course_tasks.py after syncing")
        for name, ex in expected.items():
            page = (course.TASKS_DIR / name).read_text(encoding="utf-8")
            match = re.search(r'<script[^>]*id="pyk-data"[^>]*>(.*?)</script>', page, re.S)
            data = json.loads(match.group(1))
            self.assertEqual([t["expected"] for t in data["tests"]], [t["output"] for t in ex["testcases"]], name)


if __name__ == "__main__":
    unittest.main()
