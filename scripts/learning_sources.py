"""
Shared plumbing for the quiz and flashcard generators.

Quizzes and flashcards are written in the notes repositories (Linux-Notes,
Frontend-Notes, Statistics-Notes, ...). This module knows where those files
live, fetches them either from a local checkout or from GitHub, and turns
their Markdown into the HTML fragments the two web apps display.
"""

import hashlib
import json
import logging
import os
import posixpath
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import markdown
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

GITHUB_OWNER = "djeada"
SCHEMA_VERSION = 2
REQUEST_TIMEOUT = 30

logger = logging.getLogger("learning_sources")


@dataclass(frozen=True)
class Repository:
    name: str
    branch: str

    @property
    def web_url(self) -> str:
        return f"https://github.com/{GITHUB_OWNER}/{self.name}"

    def blob_url(self, path: str) -> str:
        return f"{self.web_url}/blob/{self.branch}/{path}"

    def raw_url(self, path: str) -> str:
        return f"https://raw.githubusercontent.com/{GITHUB_OWNER}/{self.name}/{self.branch}/{path}"

    def contents_api_url(self, path: str) -> str:
        return f"https://api.github.com/repos/{GITHUB_OWNER}/{self.name}/contents/{path}?ref={self.branch}"


@dataclass(frozen=True)
class Source:
    """A file or directory of Markdown in a notes repository."""

    repo: Repository
    path: str
    exclude: Tuple[str, ...] = ()

    @property
    def is_file(self) -> bool:
        return self.path.endswith(".md")


@dataclass(frozen=True)
class Category:
    slug: str
    name: str
    description: str
    sources: Tuple[Source, ...]
    math: bool = False
    language: str = "en"

    def to_dict(self, **extra: Any) -> Dict[str, Any]:
        repos = sorted({s.repo.web_url for s in self.sources})
        return {
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "math": self.math,
            "language": self.language,
            "repositories": repos,
            **extra,
        }


@dataclass
class SourceFile:
    repo: Repository
    path: str
    text: str

    @property
    def url(self) -> str:
        return self.repo.blob_url(self.path)

    @property
    def stem(self) -> str:
        return Path(self.path).stem


LINUX = Repository("Linux-Notes", "main")
FRONTEND = Repository("Frontend-Notes", "main")
STATISTICS = Repository("Statistics-Notes", "main")
PARALLEL = Repository("Parallel-And-Concurrent-Programming", "master")
DATABASES = Repository("Databases-Notes", "main")
DEVOPS = Repository("Way-Of-DevOps", "main")
PYTHON_PL = Repository("Kurs-Podstaw-Pythona", "master")
C_CPP_PL = Repository("Od-C-do-Cpp", "master")


def _is_dotted(path: str) -> bool:
    return any(part.startswith(".") for part in path.split("/"))


class SourceLoader:
    """Lists and reads source files from a local checkout or from GitHub.

    With ``local_root`` set, ``<local_root>/<repo name>/<path>`` is read from
    disk, which is how upstream edits are previewed before they are pushed.
    """

    def __init__(self, local_root: Optional[Path] = None):
        self.local_root = Path(local_root).expanduser() if local_root else None
        self.session = requests.Session()
        retry = Retry(
            total=3, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504]
        )
        self.session.mount("https://", HTTPAdapter(max_retries=retry))
        token = os.environ.get("GITHUB_TOKEN")
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"

    def load(self, source: Source) -> List[SourceFile]:
        paths = self._list(source)
        paths = [p for p in paths if Path(p).name not in source.exclude]
        return [
            SourceFile(source.repo, path, self._read(source.repo, path))
            for path in sorted(paths)
        ]

    def _list(self, source: Source) -> List[str]:
        if source.is_file:
            return [source.path]
        if self.local_root:
            directory = self.local_root / source.repo.name / source.path
            if not directory.is_dir():
                raise FileNotFoundError(f"{directory} does not exist")
            return [
                f"{source.path}/{p.name}"
                for p in directory.glob("*.md")
                if not _is_dotted(p.name)
            ]
        response = self.session.get(
            source.repo.contents_api_url(source.path), timeout=REQUEST_TIMEOUT
        )
        response.raise_for_status()
        return [
            entry["path"]
            for entry in response.json()
            if entry.get("type") == "file"
            and entry["name"].endswith(".md")
            and not _is_dotted(entry["name"])
        ]

    def _read(self, repo: Repository, path: str) -> str:
        if self.local_root:
            return (self.local_root / repo.name / path).read_text(encoding="utf-8")
        response = self.session.get(repo.raw_url(path), timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        return response.text


# --------------------------------------------------------------------------
# Markdown rendering
# --------------------------------------------------------------------------

FENCE = re.compile(r"^\s*(```|~~~)")
LIST_ITEM = re.compile(r"^\s*(?:[*+-]|\d+[.)])\s+\S")
DISPLAY_MATH = re.compile(r"\$\$(.+?)\$\$", re.DOTALL)
INLINE_MATH = re.compile(r"(?<![\\$\w])\$(?=\S)([^$\n]+?)(?<=\S)\$(?![\w$])")
INLINE_CODE = re.compile(r"(`+)(.+?)\1", re.DOTALL)
LINK_ATTR = re.compile(r"""\b(href|src)=(["'])(.*?)\2""")
EXTERNAL_HREF = re.compile(
    r"""<a\s+(?![^>]*\btarget=)([^>]*\bhref=["']https?://[^"']*["'][^>]*)>"""
)
SINGLE_PARAGRAPH = re.compile(r"^<p>(.*)</p>$", re.DOTALL)


def _loosen_lists(text: str) -> str:
    """Add the blank line Python-Markdown needs before a list that follows a paragraph."""
    out: List[str] = []
    in_fence = False
    for line in text.split("\n"):
        if FENCE.match(line):
            in_fence = not in_fence
        elif not in_fence and LIST_ITEM.match(line) and out:
            previous = out[-1]
            if (
                previous.strip()
                and not LIST_ITEM.match(previous)
                and not previous.startswith((" ", "\t", ">"))
            ):
                out.append("")
        out.append(line)
    return "\n".join(out)


def _protect(text: str, math: bool) -> Tuple[str, Dict[str, str]]:
    """Swap inline code and (optionally) TeX for placeholders so Markdown leaves them alone."""
    stash: Dict[str, str] = {}

    def keep(value: str) -> str:
        key = f"\u0000{len(stash)}\u0000"
        stash[key] = value
        return key

    pieces = re.split(
        r"(^\s*(?:```|~~~).*?^\s*(?:```|~~~)[^\n]*$)", text, flags=re.M | re.S
    )
    for i, piece in enumerate(pieces):
        if i % 2 == 1:
            continue
        piece = INLINE_CODE.sub(
            lambda m: keep(m.group(0)) if math else m.group(0), piece
        )
        if math:
            piece = DISPLAY_MATH.sub(lambda m: keep(_escape_math(m.group(0))), piece)
            piece = INLINE_MATH.sub(lambda m: keep(_escape_math(m.group(0))), piece)
        pieces[i] = piece
    return "".join(pieces), stash


def _escape_math(tex: str) -> str:
    return tex.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _restore(html: str, stash: Dict[str, str]) -> str:
    # Inline code stashed for math pages still needs rendering as code.
    for key, value in reversed(list(stash.items())):
        if value.startswith("`"):
            value = markdown.markdown(value)[3:-4]
        html = html.replace(key, value)
    return html


def _rewrite_links(html: str, source: SourceFile) -> str:
    base = posixpath.dirname(source.path)

    def resolve(match: "re.Match[str]") -> str:
        attr, quote, url = match.groups()
        if re.match(r"^(?:[a-z][a-z0-9+.-]*:|//)", url, re.I):
            return match.group(0)
        if url.startswith("#"):
            target = source.url + url
        else:
            path, _, fragment = url.partition("#")
            resolved = posixpath.normpath(
                path.lstrip("/") if path.startswith("/") else posixpath.join(base, path)
            )
            if resolved.startswith(".."):
                return match.group(0)
            if attr == "src":
                target = source.repo.raw_url(resolved)
            else:
                target = source.repo.blob_url(resolved) + (
                    f"#{fragment}" if fragment else ""
                )
        return f"{attr}={quote}{target}{quote}"

    html = LINK_ATTR.sub(resolve, html)
    return EXTERNAL_HREF.sub(r'<a \1 target="_blank" rel="noopener">', html)


def render_markdown(
    text: str, source: SourceFile, math: bool = False, inline: bool = False
) -> str:
    """Render a Markdown fragment from ``source`` to HTML for the apps."""
    protected, stash = _protect(_loosen_lists(text.strip()), math)
    html = markdown.markdown(
        protected, extensions=["extra", "sane_lists"], output_format="html"
    )
    html = _rewrite_links(_restore(html, stash), source)
    if inline:
        single = SINGLE_PARAGRAPH.match(html)
        if single and "<p>" not in single.group(1):
            html = single.group(1)
    return html.strip()


# --------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def stable_id(*parts: str) -> str:
    digest = hashlib.sha1("␟".join(parts).encode("utf-8")).hexdigest()
    return digest[:12]


def normalise_text(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[`*_]", "", text)).strip().lower()


H1 = re.compile(r"^#\s+(.+?)\s*#*\s*$", re.M)


def document_title(source: SourceFile, strip_words: Tuple[str, ...] = ()) -> str:
    """The H1 of a file, minus words like "Quiz", or a title made from its file name."""
    match = H1.search(source.text)
    if match:
        title = match.group(1).strip()
        for word in strip_words:
            title = re.sub(word, "", title, flags=re.I).strip(" -:—")
        if title:
            return title
    stem = re.sub(r"^\d+[_-]", "", source.stem)
    words = stem.replace("-", "_").split("_")
    small = {"and", "or", "of", "the", "in", "on", "to", "a", "an", "for", "vs"}
    return " ".join(
        w.upper() if w in ACRONYMS else w if i and w in small else w.capitalize()
        for i, w in enumerate(words)
        if w
    )


ACRONYMS = {
    "css",
    "html",
    "js",
    "sql",
    "ssh",
    "scp",
    "http",
    "api",
    "dns",
    "cpu",
    "gpu",
    "io",
}


def write_json(data: Any, path: Path) -> bool:
    """Write ``data`` atomically; return True when the file content changed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == payload:
        return False
    with tempfile.NamedTemporaryFile(
        "w", delete=False, dir=path.parent, suffix=".tmp", encoding="utf-8"
    ) as tmp:
        tmp.write(payload)
    os.chmod(tmp.name, 0o644)
    Path(tmp.name).replace(path)
    return True


def remove_stale_json(directory: Path, keep: List[str]) -> List[Path]:
    """Delete generated JSON files in ``directory`` that are no longer produced."""
    removed = []
    for path in directory.glob("*.json"):
        if path.name not in keep:
            path.unlink()
            removed.append(path)
    return removed
