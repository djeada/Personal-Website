import subprocess
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Dictionary mapping scripts to their respective command line arguments
SCRIPTS_TO_ARGS = {
    "python3 clean_output_dirs.py": [],
    # "python get_markdown_urls.py": [],
    "python3 generate_from_markdown.py": [],
    "python3 apply_common_elements.py": [],
    "python3 bundle_css.py": [],
    "python3 generate_table_of_contents.py": [],
    "python3 generate_related_articles_section.py": [],
    "python3 generate_quizzes.py": [],
    "python3 generate_flashcards.py": [],
    "./format.sh": [],
    "python3 generate_article_list.py": [],
    "python3 create_site_map.py": [],
}


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
    log_message = (
        "\n"
        "----------------------------------------\n"
        f"Running script: {script}\n"
        f"With arguments: {args}\n"
        "----------------------------------------"
    )
    logging.info(log_message)

    process = subprocess.Popen(
        f"{script} {args}",
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    stdout_lines = []
    stderr_lines = []

    def log_stream(stream, logger, storage):
        for line in iter(stream.readline, ""):
            logger(line.strip())
            storage.append(line)
        stream.close()

    import threading

    stdout_thread = threading.Thread(
        target=log_stream, args=(process.stdout, logging.info, stdout_lines)
    )
    stderr_thread = threading.Thread(
        target=log_stream, args=(process.stderr, logging.error, stderr_lines)
    )

    stdout_thread.start()
    stderr_thread.start()

    stdout_thread.join()
    stderr_thread.join()

    process.wait()

    if process.returncode == 0:
        logging.info(
            "\n"
            "----------------------------------------\n"
            "Script execution completed successfully.\n"
            "----------------------------------------\n"
            f"Output:\n{''.join(stdout_lines)}\n"
            "----------------------------------------"
        )
    else:
        logging.error(
            "\n"
            "----------------------------------------\n"
            "Script execution failed.\n"
            "----------------------------------------\n"
            f"Error:\n{''.join(stderr_lines)}\n"
            "----------------------------------------"
        )
        raise subprocess.CalledProcessError(
            process.returncode,
            script,
            output="".join(stdout_lines),
            stderr="".join(stderr_lines),
        )


def run_all():
    """
    Runs all predefined scripts with their associated command line arguments.
    """
    logging.info("Initiating the execution of all scripts...")
    for script, args_list in SCRIPTS_TO_ARGS.items():
        run_script(script, args_list)
    run_script("python apply_common_elements.py", [])
    run_script("./format.sh", [])
    logging.info("All scripts executed successfully.")


if __name__ == "__main__":
    run_all()
