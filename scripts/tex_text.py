"""Plain-text versions of inline TeX for places MathJax never runs, such as
article list excerpts and meta descriptions."""

import re

SYMBOLS = {
    "alpha": "α",
    "beta": "β",
    "gamma": "γ",
    "delta": "δ",
    "epsilon": "ε",
    "varepsilon": "ε",
    "zeta": "ζ",
    "eta": "η",
    "theta": "θ",
    "kappa": "κ",
    "lambda": "λ",
    "mu": "μ",
    "nu": "ν",
    "xi": "ξ",
    "pi": "π",
    "rho": "ρ",
    "sigma": "σ",
    "tau": "τ",
    "phi": "φ",
    "varphi": "φ",
    "chi": "χ",
    "psi": "ψ",
    "omega": "ω",
    "Gamma": "Γ",
    "Delta": "Δ",
    "Theta": "Θ",
    "Lambda": "Λ",
    "Sigma": "Σ",
    "Phi": "Φ",
    "Psi": "Ψ",
    "Omega": "Ω",
    "in": "∈",
    "notin": "∉",
    "subset": "⊂",
    "subseteq": "⊆",
    "cup": "∪",
    "cap": "∩",
    "times": "×",
    "cdot": "·",
    "pm": "±",
    "div": "÷",
    "le": "≤",
    "leq": "≤",
    "ge": "≥",
    "geq": "≥",
    "ne": "≠",
    "neq": "≠",
    "approx": "≈",
    "sim": "~",
    "equiv": "≡",
    "propto": "∝",
    "to": "→",
    "rightarrow": "→",
    "leftarrow": "←",
    "Rightarrow": "⇒",
    "iff": "⇔",
    "mapsto": "↦",
    "infty": "∞",
    "partial": "∂",
    "nabla": "∇",
    "sum": "Σ",
    "prod": "Π",
    "int": "∫",
    "ldots": "…",
    "dots": "…",
    "cdots": "…",
    "mid": " | ",
    "top": "ᵀ",
    "forall": "∀",
    "exists": "∃",
    "lfloor": "⌊",
    "rfloor": "⌋",
    "lceil": "⌈",
    "rceil": "⌉",
    "langle": "⟨",
    "rangle": "⟩",
    "emptyset": "∅",
    "neg": "¬",
    "land": "∧",
    "lor": "∨",
}
FUNCTIONS = {
    "log",
    "ln",
    "exp",
    "sin",
    "cos",
    "tan",
    "max",
    "min",
    "arg",
    "det",
    "lim",
    "Pr",
    "Var",
    "Cov",
}
BLACKBOARD = {"R": "ℝ", "N": "ℕ", "Z": "ℤ", "Q": "ℚ", "C": "ℂ", "E": "𝔼", "P": "ℙ"}
SUPERSCRIPTS = str.maketrans("0123456789+-niT", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱᵀ")
SUBSCRIPTS = str.maketrans("0123456789+-ijkmnt", "₀₁₂₃₄₅₆₇₈₉₊₋ᵢⱼₖₘₙₜ")
GROUP = r"\{((?:[^{}]|\{[^{}]*\})*)\}"
UNWRAP = r"\\(?:text|mathrm|mathbf|mathit|mathcal|boldsymbol|operatorname|textbf|hat|bar|vec|tilde)\s*"
INLINE_MATH = re.compile(r"(?<!\\)\$(?!\$)([^$]+?)(?<!\\)\$|\\\((.+?)\\\)", re.S)
DISPLAY_MATH = re.compile(r"\$\$.*?\$\$|\\\[.*?\\\]", re.S)


def _wrap(part: str) -> str:
    part = part.strip()
    return f"({part})" if re.search(r"[\s+\-*/=,]", part) else part


def _command(match: re.Match) -> str:
    name = match.group(1)
    if name in FUNCTIONS:
        return f" {name} "
    return SYMBOLS.get(name, " ")


def _script(match: re.Match) -> str:
    mark, body = match.group(1), (match.group(2) or match.group(3)).strip()
    table = SUPERSCRIPTS if mark == "^" else SUBSCRIPTS
    if body == "ᵀ" or (body and all(ord(char) in table for char in body)):
        return body.translate(table)
    return mark + (body if len(body) == 1 else f"({body})")


def tex_to_text(latex: str) -> str:
    """Readable text for a short formula, e.g. A\\in\\mathbb R^{m\\times n} -> A ∈ ℝ^(m×n)."""
    text = re.sub(
        r"\\(?:left|right|big|Big|bigl|bigr|Bigl|Bigr|displaystyle)\b", "", latex
    )
    text = re.sub(
        r"\\mathbb\s*\{?([A-Z])\}?",
        lambda m: BLACKBOARD.get(m.group(1), m.group(1)),
        text,
    )
    for _ in range(3):
        text = re.sub(UNWRAP + GROUP, "\x03\\1", text)
        text = re.sub(
            r"\\[dt]?frac\s*" + GROUP + r"\s*" + GROUP,
            lambda m: f"{_wrap(m.group(1))}/{_wrap(m.group(2))}",
            text,
        )
        text = re.sub(r"\\sqrt\s*" + GROUP, lambda m: "√" + _wrap(m.group(1)), text)
    text = re.sub(r"\\[,;:!> ]|~", " ", text)
    text = text.replace(r"\{", "\x01").replace(r"\}", "\x02")
    text = re.sub(r"\\([a-zA-Z]+)", _command, text)
    text = text.replace("\\", "").replace("\x03", "")
    text = re.sub(r"([\^_])\s*(?:" + GROUP + r"|([^\s{}]))", _script, text)
    text = (
        text.replace("{", "").replace("}", "").replace("\x01", "{").replace("\x02", "}")
    )
    text = re.sub(r"\s*×\s*", "×", text)
    text = re.sub(r"\s*([=<>≤≥≠≈∈∉→⇒·~])\s*", r" \1 ", text)
    return re.sub(r"\s+", " ", text).strip()


def strip_math(text: str, drop_display: bool = True) -> str:
    """Replace $...$ and \\(...\\) with plain text; drop or convert display math."""
    text = DISPLAY_MATH.sub(
        lambda m: " " if drop_display else tex_to_text(m.group(0)[2:-2]), text
    )
    text = INLINE_MATH.sub(lambda m: tex_to_text(m.group(1) or m.group(2)), text)
    return text.replace(r"\$", "$")
