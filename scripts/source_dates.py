"""
Looks up when each source markdown file last changed upstream.

Keeps blobless clones of the source repositories (commit history and trees
only, no file contents) in .source-cache and reads the date of the latest
commit touching each file.
"""

import logging
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, Optional, Tuple
from urllib.parse import urlparse

CACHE_DIR = Path(__file__).resolve().parent / ".source-cache"


def parse_raw_url(url: str) -> Optional[Tuple[str, str, str, str]]:
    """Splits a raw.githubusercontent.com URL into owner, repo, branch, path."""
    parsed = urlparse(url)
    if parsed.netloc != "raw.githubusercontent.com":
        return None
    parts = parsed.path.strip("/").split("/")
    if parts[2:4] == ["refs", "heads"]:
        parts = parts[:2] + parts[4:]
    if len(parts) < 4:
        return None
    owner, repo, branch, *path = parts
    return owner, repo, branch, "/".join(path)


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], check=True, capture_output=True, text=True
    ).stdout


def file_dates(owner: str, repo: str, branch: str) -> Dict[str, datetime]:
    """Maps every path in the branch history to its latest commit date."""
    directory = CACHE_DIR / f"{owner}__{repo}"
    if directory.exists():
        git("-C", str(directory), "fetch", "--quiet", "origin", branch)
        ref = "FETCH_HEAD"
    else:
        git(
            "clone",
            "--quiet",
            "--filter=blob:none",
            "--no-checkout",
            "--single-branch",
            "--branch",
            branch,
            f"https://github.com/{owner}/{repo}.git",
            str(directory),
        )
        ref = f"origin/{branch}"

    dates: Dict[str, datetime] = {}
    current = None
    log = git("-C", str(directory), "log", "--format=@%cs", "--name-only", ref)
    for line in log.splitlines():
        if line.startswith("@"):
            current = datetime.strptime(line[1:], "%Y-%m-%d")
        elif line and current:
            dates.setdefault(line, current)
    return dates


def upstream_dates(urls: Iterable[str]) -> Dict[str, datetime]:
    """Returns the last upstream change date for each URL that could be resolved."""
    by_repo: Dict[Tuple[str, str, str], Dict[str, str]] = {}
    for url in urls:
        parsed = parse_raw_url(url)
        if parsed:
            owner, repo, branch, path = parsed
            by_repo.setdefault((owner, repo, branch), {})[path] = url

    CACHE_DIR.mkdir(exist_ok=True)

    def lookup(key):
        try:
            return key, file_dates(*key)
        except (subprocess.CalledProcessError, OSError) as exc:
            stderr = getattr(exc, "stderr", "") or exc
            logging.warning(f"Could not read history of {'/'.join(key)}: {stderr}")
            return key, {}

    result: Dict[str, datetime] = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        for key, dates in executor.map(lookup, by_repo):
            for path, url in by_repo[key].items():
                if path in dates:
                    result[url] = dates[path]
    return result
