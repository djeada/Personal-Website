"""
Used to run all the specified scripts with provided command line arguments.
"""

import subprocess

SCRIPTS_TO_ARGS = {
    "apply_common_elements.py": ["-i ..\src\index.html -o ..\src\index.html"],
}


def run_all():
    """
    Runs all the scripts with provided command line arguments.
    """
    for script, args_list in SCRIPTS_TO_ARGS.items():
        print("Running {}".format(script))
        for args in args_list:
            print("Arguments: {}".format(args))
            print("----------------------------------------------------")
            subprocess.call([script, args])
            print("----------------------------------------------------")
            print()


if __name__ == "__main__":
    run_all()
    print("Done!")
