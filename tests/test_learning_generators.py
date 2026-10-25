import json
import tempfile
import textwrap
import unittest
from pathlib import Path

from scripts import generate_flashcards, generate_quizzes
from scripts.learning_sources import (
    has_math,
    LINUX,
    STATISTICS,
    Category,
    Source,
    SourceFile,
    SourceLoader,
    render_markdown,
    write_json,
)

QUIZ = textwrap.dedent(
    """\
    # Processes Quiz

    Notes: [Processes](../notes/processes.md)

    #### Q. Which signal cannot be caught?

    * [ ] `SIGTERM`
    * [x] `SIGKILL`
    * [ ] `SIGINT`

    > **Explanation:** The kernel handles `SIGKILL` itself.

    #### Q. What does this print?

    ```bash
    x=5; echo "${x:-7}"
    * [x] this line is code, not an option
    ```

    * [x] `5`
    * [ ] `7`
    * [ ] Nothing

    > **Explanation:** The default only applies when `x` is unset.

    #### Q. Two answers are marked here.

    * [x] One
    * [x] Two
    * [ ] Three

    #### Q. Which signal cannot be caught?

    * [ ] A
    * [x] B
    * [ ] C

    #### Q. Pick the right statement.

    * [ ] First
    * [ ] Second
    * [x] All of the above
    """
)

CARDS = textwrap.dedent(
    """\
    # Quizzes on Probability

    ## Bayes' Theorem

    <details>
    <summary>1. What is Bayes' Theorem?</summary><br>

    It updates a prior with evidence:
    - $P(A|B)$ is the posterior,
    - $P(A)$ is the prior.

    $$P(A|B) = \\frac{P(B|A)P(A)}{P(B)}$$

    See [the notes](../notes/bayes.md) and ![tree](img/tree.png).
    </details>

    ### A sub-heading inside the section

    <details>
    <summary>What is a prior?</summary>

    Belief before seeing data, e.g. `x < $y`.

    </details>

    ## Independence

    <details>
    <summary>What is Bayes' theorem?</summary>

    Duplicate question with different case, should be skipped.
    </details>

    <details>
    <summary>When are A and B independent?</summary>

    When $P(A \\cap B) = P(A)P(B)$.
    </details>
    """
)


def quiz_category():
    return Category("linux", "Linux", "Linux quizzes.", (Source(LINUX, "quizzes"),))


class QuizParsingTests(unittest.TestCase):
    def setUp(self):
        self.report = generate_quizzes.Report()
        source = SourceFile(LINUX, "quizzes/processes.md", QUIZ)
        self.data = generate_quizzes.build_category(
            quiz_category(), [source], self.report
        )

    def test_valid_questions_are_kept_and_broken_ones_reported(self):
        texts = [q["text"] for q in self.data["questions"]]
        self.assertEqual(len(texts), 3)
        self.assertTrue(
            any("2 options marked correct" in p.message for p in self.report.errors)
        )
        self.assertTrue(any("duplicate of" in p.message for p in self.report.warnings))

    def test_options_inside_code_fences_belong_to_the_question(self):
        question = self.data["questions"][1]
        self.assertIn('<pre><code class="language-bash">', question["text"])
        self.assertIn("this line is code", question["text"])
        self.assertEqual(
            question["options"], ["<code>5</code>", "<code>7</code>", "Nothing"]
        )
        self.assertEqual(question["correctOptionIndex"], 0)

    def test_explanation_notes_and_source_are_exported(self):
        question = self.data["questions"][0]
        self.assertEqual(
            question["explanation"],
            "<p>The kernel handles <code>SIGKILL</code> itself.</p>",
        )
        self.assertEqual(
            question["source"],
            "https://github.com/djeada/Linux-Notes/blob/main/quizzes/processes.md#L5",
        )
        topic = self.data["topics"][0]
        self.assertEqual(topic["name"], "Processes")
        self.assertEqual(
            topic["notes"],
            [
                {
                    "title": "Processes",
                    "url": "https://github.com/djeada/Linux-Notes/blob/main/notes/processes.md",
                }
            ],
        )

    def test_positional_options_disable_shuffling(self):
        self.assertTrue(self.data["questions"][2]["fixedOrder"])
        self.assertNotIn("fixedOrder", self.data["questions"][0])

    def test_ids_are_stable_and_unique(self):
        again = generate_quizzes.build_category(
            quiz_category(),
            [SourceFile(LINUX, "quizzes/processes.md", QUIZ)],
            generate_quizzes.Report(),
        )
        ids = [q["id"] for q in self.data["questions"]]
        self.assertEqual(ids, [q["id"] for q in again["questions"]])
        self.assertEqual(len(set(ids)), len(ids))


POLISH_QUIZ = textwrap.dedent(
    """\
    # Zmienne i typy danych — quiz

    Notatki: [Zmienne](../notatki/03_zmienne.md)

    #### Q. Co wypisze ten program?

    ```python
    x = [1, 2]
    y = x
    y.append(3)
    print(len(x))
    ```

    * [ ] `2`
    * [x] `3`
    * [ ] `TypeError`

    > **Wyjaśnienie:** `y = x` nie kopiuje listy.

    #### Q. Które zdanie jest prawdziwe?

    * [x] Pierwsze
    * [ ] Drugie
    * [ ] Wszystkie powyższe
    """
)


class PolishQuizTests(unittest.TestCase):
    def test_polish_labels_are_understood(self):
        category = Category(
            "kurs", "Kurs", "Opis.", (Source(LINUX, "quizzes"),), language="pl"
        )
        report = generate_quizzes.Report()
        source = SourceFile(LINUX, "quizzes/01_zmienne.md", POLISH_QUIZ)
        data = generate_quizzes.build_category(category, [source], report)

        self.assertEqual(data["category"]["language"], "pl")
        self.assertEqual(data["topics"][0]["name"], "Zmienne i typy danych")
        self.assertEqual(data["topics"][0]["notes"][0]["title"], "Zmienne")
        first, second = data["questions"]
        self.assertEqual(
            first["explanation"], "<p><code>y = x</code> nie kopiuje listy.</p>"
        )
        self.assertTrue(second["fixedOrder"])
        self.assertTrue(any("positional" in p.message for p in report.warnings))


class FlashcardParsingTests(unittest.TestCase):
    def setUp(self):
        category = Category(
            "statistics",
            "Statistics",
            "Stats.",
            (Source(STATISTICS, "flashcards"),),
            math=True,
        )
        self.report = generate_quizzes.Report()
        source = SourceFile(STATISTICS, "flashcards/probability.md", CARDS)
        self.data = generate_flashcards.build_category(category, [source], self.report)

    def test_cards_are_grouped_by_their_level_two_heading(self):
        topics = [(t["group"], t["name"], t["cardCount"]) for t in self.data["topics"]]
        self.assertEqual(
            topics,
            [("Probability", "Bayes' Theorem", 2), ("Probability", "Independence", 1)],
        )
        self.assertEqual(len(self.data["cards"]), 3)

    def test_numbering_is_stripped_and_lists_render(self):
        card = self.data["cards"][0]
        self.assertEqual(card["front"], "What is Bayes' Theorem?")
        self.assertIn("<ul>", card["back"])
        self.assertIn("$P(A|B)$", card["back"])
        self.assertIn("\\frac{P(B|A)P(A)}{P(B)}", card["back"])

    def test_relative_links_point_at_github(self):
        back = self.data["cards"][0]["back"]
        self.assertIn(
            'href="https://github.com/djeada/Statistics-Notes/blob/main/notes/bayes.md"',
            back,
        )
        self.assertIn(
            'src="https://raw.githubusercontent.com/djeada/Statistics-Notes/main/flashcards/img/tree.png"',
            back,
        )

    def test_code_with_dollar_signs_is_not_treated_as_maths(self):
        self.assertIn("<code>x &lt; $y</code>", self.data["cards"][1]["back"])

    def test_math_comparisons_are_escaped_for_html(self):
        source = SourceFile(STATISTICS, "flashcards/x.md", "")
        self.assertEqual(
            render_markdown("$a < b$", source, math=True, inline=True), "$a &lt; b$"
        )


class RenderingTests(unittest.TestCase):
    def test_inline_code_is_tagged_for_highlighting_but_blocks_keep_their_language(
        self,
    ):
        source = SourceFile(LINUX, "quizzes/x.md", "")
        html = render_markdown(
            "Run `ls -la`:\n\n```python\nprint(1)\n```", source, code_language="bash"
        )
        self.assertIn('<code class="language-bash">ls -la</code>', html)
        self.assertIn('<pre><code class="language-python">', html)

    def test_inline_code_keeps_significant_spaces_and_markup(self):
        source = SourceFile(LINUX, "quizzes/x.md", "")
        for math in (True, False):
            html = render_markdown(
                "` M a.txt` `M  a.txt` `` `x` `` `<!--`", source, math=math, inline=True
            )
            self.assertEqual(
                html,
                "<code> M a.txt</code> <code>M  a.txt</code> <code>`x`</code> "
                "<code>&lt;!--</code>",
            )

    def test_maths_is_detected_outside_code_only(self):
        self.assertTrue(has_math("Speedup is $S = \\frac{1}{1-p}$."))
        self.assertFalse(has_math("Print `echo $HOME and $PATH` in a shell."))
        self.assertFalse(has_math("It costs 5 dollars."))


class GenerationTests(unittest.TestCase):
    def test_local_generation_writes_index_and_removes_stale_files(self):
        with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as out:
            quizzes = Path(root) / "Linux-Notes" / "quizzes"
            quizzes.mkdir(parents=True)
            (quizzes / "processes.md").write_text(QUIZ)
            (Path(out) / "old_category.json").write_text("{}")

            category = quiz_category()
            original = generate_quizzes.CATEGORIES
            generate_quizzes.CATEGORIES = (category,)
            try:
                built, report = generate_quizzes.generate(
                    SourceLoader(Path(root)), Path(out)
                )
            finally:
                generate_quizzes.CATEGORIES = original

            self.assertEqual(
                sorted(p.name for p in Path(out).iterdir()),
                ["categories.json", "linux.json"],
            )
            index = json.loads((Path(out) / "categories.json").read_text())
            self.assertEqual(index["categories"][0]["questionCount"], 3)
            self.assertEqual((Path(out) / "linux.json").stat().st_mode & 0o777, 0o644)

    def test_missing_source_directory_is_skipped_with_a_warning(self):
        with tempfile.TemporaryDirectory() as root:
            report = generate_quizzes.Report()
            files = generate_quizzes.load_files(
                SourceLoader(Path(root)), quiz_category(), report
            )
            self.assertEqual(files, [])
            self.assertIn("source not found", report.warnings[0].message)

    def test_write_json_reports_whether_content_changed(self):
        with tempfile.TemporaryDirectory() as out:
            path = Path(out) / "data.json"
            self.assertTrue(write_json({"a": 1}, path))
            self.assertFalse(write_json({"a": 1}, path))
            self.assertTrue(write_json({"a": 2}, path))


if __name__ == "__main__":
    unittest.main()
