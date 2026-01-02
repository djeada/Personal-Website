"""Normalize der/die/das lists and generate multi-article exceptions."""

from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WORDLIST_DIR = REPO_ROOT / "src/tools/der_die_das"

ARTICLES = ("der", "die", "das")
LEVELS = ("easy", "intermediate", "hard")

MANUAL_MULTI = {
    "See": ["der", "die"],
    "Leiter": ["der", "die"],
    "Band": ["der", "die", "das"],
    "Nutella": ["der", "die", "das"],
}


def normalize(word: str) -> str:
    return word.strip().lower()


def load_list(article: str) -> dict[str, list[str]]:
    path = WORDLIST_DIR / f"{article}.json"
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def save_list(article: str, data: dict[str, list[str]]) -> None:
    path = WORDLIST_DIR / f"{article}.json"
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def main() -> None:
    lists = {article: load_list(article) for article in ARTICLES}

    manual_multi_norm = {
        normalize(word): (word, articles) for word, articles in MANUAL_MULTI.items()
    }
    multi_articles: dict[str, list[str]] = {
        word: articles for word, articles in MANUAL_MULTI.items()
    }

    seen_primary: dict[str, str] = {}

    for article in ARTICLES:
        data = lists[article]
        for level in LEVELS:
            cleaned: list[str] = []
            for word in data.get(level, []):
                norm = normalize(word)
                if not norm:
                    continue

                if norm in manual_multi_norm:

                    continue

                if norm in seen_primary:

                    continue

                seen_primary[norm] = article
                cleaned.append(word)
            data[level] = cleaned

    save_list("der", lists["der"])
    save_list("die", lists["die"])
    save_list("das", lists["das"])

    multi_path = WORDLIST_DIR / "multi_articles.json"
    multi_path.write_text(
        json.dumps(multi_articles, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
