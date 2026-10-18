"""Preserve published article URLs whose source notes were renamed or removed."""

from html import escape
from pathlib import Path

ARTICLE_ROOT = Path(__file__).resolve().parent.parent / "src/articles"
REDIRECTS = {
    "databases_notes/06_distributed_databases/08_distributed_database_systems.html": "01_distributed_database_systems.html",
}


def create_redirects(root=ARTICLE_ROOT):
    for old_path, destination in REDIRECTS.items():
        path = root / old_path
        target = path.parent / destination
        if not target.is_file():
            raise FileNotFoundError(f"Redirect destination does not exist: {target}")
        canonical = "https://adamdjellouli.com/articles/" + target.relative_to(
            root
        ).as_posix().removesuffix(".html")
        href = escape(destination, quote=True)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
            '    <meta charset="utf-8">\n'
            f'    <meta http-equiv="refresh" content="0;url={href}">\n'
            '    <meta name="robots" content="noindex">\n'
            f'    <link rel="canonical" href="{escape(canonical, quote=True)}">\n'
            "    <title>Distributed Database Systems — moved</title>\n"
            "</head>\n<body>\n"
            f'    <p>This article has moved to <a href="{href}">Distributed Database Systems</a>.</p>\n'
            "</body>\n</html>\n",
            encoding="utf-8",
        )
    print(f"Created {len(REDIRECTS)} article redirects")


if __name__ == "__main__":
    create_redirects()
