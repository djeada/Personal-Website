import logging
from pathlib import Path

INPUT_DIRS = [Path("../src/articles"), Path("../src/pages")]
SPARED_FILE = Path("../src/articles/blog_1.html")


def clear_directory(directory: Path, spared_file: Path):
    for file in directory.rglob("*"):
        if file.is_file() and file != spared_file:
            file.unlink()
            logging.info(f"Removed file: {file}")
        elif file.is_dir() and not any(file.iterdir()):
            file.rmdir()
            logging.info(f"Removed empty directory: {file}")


def main():
    for dir_path in INPUT_DIRS:
        clear_directory(dir_path, spared_file=SPARED_FILE)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
    )
    main()
