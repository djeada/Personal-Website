"""
Used to run all the specified scripts with provided command line arguments.
"""

import subprocess

SCRIPTS_TO_ARGS = {
    "python get_markdown_urls.py": [],
    "python generate_from_markdown.py": [],
    "python apply_common_elements.py": [],
    "python generate_article_list.py": [],
    "python bundle_css.py": [],
}


def run_all():
    """
    Runs all the scripts with provided command line arguments.
    """
    for script, args_list in SCRIPTS_TO_ARGS.items():
        args = " ".join(args_list)
        print(f"Running {script} {args}")
        subprocess.run(f"{script} {args}", shell=True, check=True)


if __name__ == "__main__":
    print("Running all scripts...")
    run_all()
    print("Done!")
