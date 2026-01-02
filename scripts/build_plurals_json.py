"""Build plurals.json from the german-nouns dataset for current word lists."""

from __future__ import annotations

import csv
import io
import json
import re
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WORDLIST_DIR = REPO_ROOT / "src/tools/der_die_das"

SOURCE_URL = (
    "https://raw.githubusercontent.com/gambolputty/german-nouns/main/"
    "german_nouns/nouns.csv"
)

WORD_RE = re.compile(r"^[A-Za-zÄÖÜäöüß]+$")


def normalize(word: str) -> str:
    return word.strip().lower()


def load_words() -> set[str]:
    words = set()
    for article in ("der", "die", "das"):
        path = WORDLIST_DIR / f"{article}.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        for level in ("easy", "intermediate", "hard"):
            for word in data.get(level, []):
                if word:
                    words.add(normalize(word))

    multi_path = WORDLIST_DIR / "multi_articles.json"
    if multi_path.exists():
        data = json.loads(multi_path.read_text(encoding="utf-8"))
        for word in data.keys():
            words.add(normalize(word))

    return words


def split_plurals(value: str) -> list[str]:
    parts = re.split(r"[,/;]", value)
    return [item.strip() for item in parts if item.strip()]


def main() -> None:
    target_words = load_words()
    plurals: dict[str, list[str]] = {}

    with urllib.request.urlopen(SOURCE_URL) as resp:
        wrapper = io.TextIOWrapper(resp, encoding="utf-8", errors="ignore")
        reader = csv.DictReader(wrapper)
        for row in reader:
            lemma = (row.get("lemma") or "").strip()
            plural = (row.get("nominativ plural") or "").strip()
            if not lemma or not plural:
                continue

            if not WORD_RE.match(lemma):
                continue

            key = normalize(lemma)
            if key not in target_words:
                continue

            plurals[key] = split_plurals(plural)

    output_path = WORDLIST_DIR / "plurals.json"
    output_path.write_text(
        json.dumps(plurals, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Wrote {len(plurals)} plural entries")


if __name__ == "__main__":
    main()
