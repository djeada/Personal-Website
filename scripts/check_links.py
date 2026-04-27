"""
Script for finding and reporting dead or broken links on the website.

Scans all HTML files under src/, extracts internal and external links,
and validates them. Internal links are checked by verifying the target
file exists on disk; external links are checked with HTTP requests.

Usage:
    python check_links.py [--external] [--json report.json]

Options:
    --external   Also check external (http/https) links (slow).
    --json FILE  Write the report as JSON to FILE.
"""

import argparse
import json
import logging
import re
import sys
import warnings
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urldefrag

import requests
from bs4 import BeautifulSoup


SRC_DIR = Path(__file__).resolve().parent.parent / "src"
EXCLUDE_PATTERN = re.compile(r"building_blocks")


LINK_ATTRS: List[Tuple[str, str]] = [
    ("a", "href"),
    ("img", "src"),
    ("link", "href"),
    ("script", "src"),
    ("source", "src"),
    ("video", "src"),
    ("audio", "src"),
    ("iframe", "src"),
]


EXTERNAL_SCHEMES = ("http://", "https://")


SKIP_PATTERNS = re.compile(r"^(javascript:|mailto:|tel:|data:|#|$)", re.IGNORECASE)

REQUEST_TIMEOUT = 15
MAX_WORKERS = 10

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


@dataclass
class BrokenLink:
    """Represents a single broken link found during the scan."""

    source_file: str
    tag: str
    attribute: str
    url: str
    reason: str


@dataclass
class LinkReport:
    """Aggregate report of the link-checking run."""

    total_files: int = 0
    total_links: int = 0
    internal_links_checked: int = 0
    external_links_checked: int = 0
    broken_links: List[BrokenLink] = field(default_factory=list)

    @property
    def broken_count(self) -> int:
        return len(self.broken_links)


def collect_html_files(root: Path) -> List[Path]:
    """Return all HTML files under *root*, excluding building_blocks."""
    return [
        p for p in sorted(root.rglob("*.html")) if not EXCLUDE_PATTERN.search(str(p))
    ]


def extract_links(
    html_path: Path,
) -> List[Tuple[str, str, str]]:
    """Extract (tag, attribute, url) triples from an HTML file."""
    results: List[Tuple[str, str, str]] = []
    try:
        content = html_path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        logger.warning("Cannot read %s: %s", html_path, exc)
        return results

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=UserWarning)
        soup = BeautifulSoup(content, "html.parser")
    for tag_name, attr in LINK_ATTRS:
        for element in soup.find_all(tag_name):
            value = element.get(attr)
            if value and isinstance(value, str):
                value = value.strip()
                if not SKIP_PATTERNS.match(value):
                    results.append((tag_name, attr, value))
    return results


def resolve_internal_link(
    url: str, source_file: Path, src_root: Path
) -> Optional[Path]:
    """Resolve a relative URL to an absolute file-system path.

    Returns *None* when the URL is external or cannot be mapped to a file.
    """
    if any(url.startswith(s) for s in EXTERNAL_SCHEMES):
        return None

    url_no_frag, _ = urldefrag(url)
    if not url_no_frag:
        return None

    base_dir = source_file.parent
    target = (base_dir / url_no_frag).resolve()

    try:
        target.relative_to(src_root.resolve())
    except ValueError:
        return None

    return target


def check_internal_link(target: Path) -> Optional[str]:
    """Return a reason string if the internal link is broken, else None."""
    if target.exists():
        return None
    return "File not found"


def check_external_link(url: str) -> Optional[str]:
    """Return a reason string if the external URL is unreachable, else None."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; LinkChecker/1.0; "
            "+https://github.com/djeada/Personal-Website)"
        ),
    }
    try:
        resp = requests.head(
            url, headers=headers, timeout=REQUEST_TIMEOUT, allow_redirects=True
        )
        if resp.status_code < 400:
            return None

        resp = requests.get(
            url,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
            stream=True,
        )
        if resp.status_code < 400:
            return None
        return f"HTTP {resp.status_code}"
    except requests.ConnectionError:
        return "Connection error"
    except requests.Timeout:
        return "Timeout"
    except requests.TooManyRedirects:
        return "Too many redirects"
    except requests.RequestException as exc:
        return str(exc)


def scan_links(
    src_root: Path,
    check_external: bool = False,
) -> LinkReport:
    """Scan HTML files for broken links and return a report."""
    report = LinkReport()
    html_files = collect_html_files(src_root)
    report.total_files = len(html_files)
    logger.info("Found %d HTML files to scan.", report.total_files)

    all_links: List[Tuple[Path, str, str, str]] = []
    for html_path in html_files:
        for tag_name, attr, url in extract_links(html_path):
            all_links.append((html_path, tag_name, attr, url))

    report.total_links = len(all_links)
    logger.info("Extracted %d links in total.", report.total_links)

    external_queue: List[Tuple[Path, str, str, str]] = []
    seen_external: Dict[str, Optional[str]] = {}

    for html_path, tag_name, attr, url in all_links:
        if any(url.startswith(s) for s in EXTERNAL_SCHEMES):
            external_queue.append((html_path, tag_name, attr, url))
            continue

        target = resolve_internal_link(url, html_path, src_root)
        if target is None:
            continue

        report.internal_links_checked += 1
        reason = check_internal_link(target)
        if reason:
            report.broken_links.append(
                BrokenLink(
                    source_file=str(html_path.relative_to(src_root)),
                    tag=tag_name,
                    attribute=attr,
                    url=url,
                    reason=reason,
                )
            )

    logger.info(
        "Checked %d internal links; %d broken so far.",
        report.internal_links_checked,
        report.broken_count,
    )

    if check_external and external_queue:
        unique_urls: Set[str] = set()
        for _, _, _, url in external_queue:
            clean, _ = urldefrag(url)
            unique_urls.add(clean)

        logger.info(
            "Checking %d unique external URLs with %d workers…",
            len(unique_urls),
            MAX_WORKERS,
        )

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            futures = {pool.submit(check_external_link, u): u for u in unique_urls}
            for future in as_completed(futures):
                ext_url = futures[future]
                try:
                    reason = future.result()
                except Exception as exc:
                    logger.debug("Unexpected error checking %s: %s", ext_url, exc)
                    reason = str(exc)
                seen_external[ext_url] = reason

        for html_path, tag_name, attr, url in external_queue:
            report.external_links_checked += 1
            clean, _ = urldefrag(url)
            reason = seen_external.get(clean)
            if reason:
                report.broken_links.append(
                    BrokenLink(
                        source_file=str(html_path.relative_to(src_root)),
                        tag=tag_name,
                        attribute=attr,
                        url=url,
                        reason=reason,
                    )
                )

        logger.info(
            "Checked %d external links; %d broken total.",
            report.external_links_checked,
            report.broken_count,
        )

    return report


def print_report(report: LinkReport) -> None:
    """Print a human-readable report to stdout."""
    print("\n" + "=" * 70)
    print("LINK CHECK REPORT")
    print("=" * 70)
    print(f"Files scanned:          {report.total_files}")
    print(f"Total links found:      {report.total_links}")
    print(f"Internal links checked: {report.internal_links_checked}")
    print(f"External links checked: {report.external_links_checked}")
    print(f"Broken links:           {report.broken_count}")
    print("=" * 70)

    if report.broken_links:
        for entry in report.broken_links:
            print(
                f"\n  [{entry.tag} {entry.attribute}] {entry.url}"
                f"\n    Source: {entry.source_file}"
                f"\n    Reason: {entry.reason}"
            )
        print()
    else:
        print("\nNo broken links found. \u2705\n")


def write_json_report(report: LinkReport, path: Path) -> None:
    """Write the report as JSON."""
    data = {
        "total_files": report.total_files,
        "total_links": report.total_links,
        "internal_links_checked": report.internal_links_checked,
        "external_links_checked": report.external_links_checked,
        "broken_count": report.broken_count,
        "broken_links": [asdict(b) for b in report.broken_links],
    }
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    logger.info("JSON report written to %s", path)


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Find and report dead or broken links on the website.",
    )
    parser.add_argument(
        "--external",
        action="store_true",
        help="Also check external (http/https) links (slower).",
    )
    parser.add_argument(
        "--json",
        metavar="FILE",
        type=Path,
        default=None,
        help="Write the report as JSON to FILE.",
    )
    parser.add_argument(
        "--src-dir",
        metavar="DIR",
        type=Path,
        default=SRC_DIR,
        help="Root directory of the site sources (default: ../src relative to this script).",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    report = scan_links(src_root=args.src_dir, check_external=args.external)
    print_report(report)

    if args.json:
        write_json_report(report, args.json)

    return 1 if report.broken_count else 0


if __name__ == "__main__":
    sys.exit(main())
