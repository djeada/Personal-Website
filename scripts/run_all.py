import subprocess
import logging

# Dictionary mapping scripts to their respective command line arguments
SCRIPTS_TO_ARGS = {
    "python get_markdown_urls.py": [],
    "python generate_from_markdown.py": [],
    "python apply_common_elements.py": [],
    "python generate_article_list.py": [],
    "python bundle_css.py": [],
    "python generate_table_of_contents.py": [],
    "python generate_related_articles_section.py": [],
    "./format.sh": [],
}

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)


def run_script(script, args_list):
    """
    Executes a given script with specified arguments.

    Args:
    script (str): The script to be executed.
    args_list (list): A list of arguments for the script.

    Raises:
    subprocess.CalledProcessError: If the script execution fails.
    """
    args = " ".join(args_list)
    logging.info(f"Running {script} {args}")
    subprocess.run(f"{script} {args}", shell=True, check=True)


def run_all():
    """
    Runs all predefined scripts with their associated command line arguments.
    """
    logging.info("Initiating the execution of all scripts...")
    for script, args_list in SCRIPTS_TO_ARGS.items():
        run_script(script, args_list)
    logging.info("All scripts executed successfully.")


if __name__ == "__main__":
    run_all()
