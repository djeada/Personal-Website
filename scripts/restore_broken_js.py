"""
Restores JS files that a formatter left with broken syntax.

Usage: python3 restore_broken_js.py BACKUP_DIR SOURCE_DIR
BACKUP_DIR mirrors SOURCE_DIR as it was before formatting.
"""

import logging
import shutil
import sys
from pathlib import Path

from strip_comments import is_valid_js

logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")


def main(backup_dir: Path, source_dir: Path) -> None:
    for backup in backup_dir.rglob("*.js"):
        target = source_dir / backup.relative_to(backup_dir)
        if not target.exists() or target.read_bytes() == backup.read_bytes():
            continue
        if is_valid_js(backup.read_text()) and not is_valid_js(target.read_text()):
            shutil.copy2(backup, target)
            logging.warning(
                f"Kept original formatting of {target}: js-beautify broke its syntax"
            )


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
