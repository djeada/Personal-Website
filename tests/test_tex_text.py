import unittest

from scripts.tex_text import strip_math, tex_to_text


class TexToTextTests(unittest.TestCase):
    def test_common_notation_reads_as_text(self):
        self.assertEqual(tex_to_text(r"A\in\mathbb R^{m\times n}"), "A ∈ ℝ^(m×n)")
        self.assertEqual(tex_to_text(r"X\sim\mathrm{Poisson}(\lambda)"), "X ~ Poisson(λ)")
        self.assertEqual(tex_to_text(r"\mathbf x=(x_1,\ldots,x_n)^\top"), "x = (x₁,…,xₙ)ᵀ")
        self.assertEqual(tex_to_text(r"\frac{a+b}{2}"), "(a+b)/2")
        self.assertEqual(tex_to_text(r"O(n \log n)"), "O(n log n)")
        self.assertEqual(tex_to_text(r"\{0,1,2,\ldots\}"), "{0,1,2,…}")

    def test_strip_math_replaces_inline_and_drops_display_math(self):
        text = strip_math(r"For $A\in\mathbb R^n$, $$x^2$$ costs \$5.")
        self.assertEqual(" ".join(text.split()), "For A ∈ ℝⁿ, costs $5.")


if __name__ == "__main__":
    unittest.main()
