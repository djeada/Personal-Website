"""
Bundles many CSS files into one.
"""

import os
import glob
import argparse
import logging
from pathlib import Path


def get_args():
    """
    Gets the command line arguments.
    """
    parser = argparse.ArgumentParser(description="Bundles many CSS files into one.")
    parser.add_argument("-i", "--input", help="Input directory", required=True)
    parser.add_argument("-o", "--output", help="Output file", required=True)
    parser.add_argument("-d", "--debug", help="Debug mode", action="store_true")
    return parser.parse_args()


def get_files(input_dir):
    """
    Gets all files in the input directory.
    """
    return glob.glob(os.path.join(input_dir, "*.css"))


def main():
    """
    Main function.
    """
    args = get_args()
    if args.debug:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)
    logging.debug(args)
    files = get_files(args.input)
    logging.debug(files)
    contents = "\n".join([Path(file).read_text() for file in files])
    logging.debug(contents)
    Path(args.output).write_text(contents)


if __name__ == "__main__":
    main()
