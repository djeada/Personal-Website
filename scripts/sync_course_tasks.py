"""
Refreshes the pinned Nauka-Programowania snapshot used by generate_course_tasks.py.

The course is never built from a moving branch: chapters live in
scripts/course_data/nauka_programowania/chapters/ together with source.json,
which records the exact commit they came from. The judge (judge_harness.py)
is copied next to the browser runner, so the site grades solutions exactly
like the repository's CI.

    python3 sync_course_tasks.py --source ../../Nauka-Programowania
    python3 sync_course_tasks.py --ref master
    python3 sync_course_tasks.py --ref 3f2a9c1
"""

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import generate_course_tasks as course

REPOSITORY = "djeada/Nauka-Programowania"
API = f"https://api.github.com/repos/{REPOSITORY}"
RAW = f"https://raw.githubusercontent.com/{REPOSITORY}"
JSON_DIR = "zbior_zadan_json"
HARNESS = "scripts/judge_harness.py"


def _get(url: str) -> bytes:
    request = urllib.request.Request(
        url, headers={"User-Agent": "adamdjellouli.com-course-sync"}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def _from_github(ref: str, target: Path) -> dict:
    commit = json.loads(_get(f"{API}/commits/{ref}"))["sha"]
    listing = json.loads(_get(f"{API}/contents/{JSON_DIR}?ref={commit}"))
    names = sorted(item["name"] for item in listing if item["name"].endswith(".json"))
    for name in names:
        (target / "chapters" / name).write_bytes(
            _get(f"{RAW}/{commit}/{JSON_DIR}/{name}")
        )
    (target / "judge_harness.py").write_bytes(_get(f"{RAW}/{commit}/{HARNESS}"))
    return {"repository": REPOSITORY, "commit": commit, "dirty": False}


def _git(source: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(source), *args], check=True, capture_output=True, text=True
    ).stdout.strip()


def _from_checkout(source: Path, target: Path) -> dict:
    for path in sorted((source / JSON_DIR).glob("*.json")):
        shutil.copy2(path, target / "chapters" / path.name)
    shutil.copy2(source / HARNESS, target / "judge_harness.py")
    dirty = bool(_git(source, "status", "--porcelain", "--", JSON_DIR, HARNESS))
    return {
        "repository": REPOSITORY,
        "commit": _git(source, "rev-parse", "HEAD"),
        "dirty": dirty,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--source", type=Path, help="local Nauka-Programowania checkout")
    group.add_argument("--ref", help="commit, tag or branch on GitHub")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        staging = Path(tmp)
        (staging / "chapters").mkdir()
        meta = (
            _from_checkout(args.source.resolve(), staging)
            if args.source
            else _from_github(args.ref, staging)
        )

        chapters = {
            path.stem: json.loads(path.read_text(encoding="utf-8"))
            for path in sorted((staging / "chapters").glob("*.json"))
        }
        problems = course.validate_chapters(chapters)
        if problems:
            print("Snapshot rejected:\n  " + "\n  ".join(problems), file=sys.stderr)
            return 1

        shutil.rmtree(course.CHAPTERS_DIR, ignore_errors=True)
        shutil.copytree(staging / "chapters", course.CHAPTERS_DIR)
        shutil.copy2(staging / "judge_harness.py", course.HARNESS_FILE)
        course.SOURCE_FILE.write_text(
            json.dumps(meta, indent=2) + "\n", encoding="utf-8"
        )

    tasks = sum(len(chapter["exercises"]) for chapter in chapters.values())
    note = " (uncommitted changes!)" if meta["dirty"] else ""
    print(
        f"Synced {len(chapters)} chapters / {tasks} tasks from {REPOSITORY}@{meta['commit'][:10]}{note}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
