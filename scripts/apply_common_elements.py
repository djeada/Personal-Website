'''
Input: a html file
Output: modified html file with common navbar, footer and so on.
'''

# TODO:
# - add option of replacing content based on comments and not only tags


import argparse
from dataclasses import dataclass
import logging
from pathlib import Path
from enum import Enum, auto
from typing import List

class Position(Enum):
    BEFORE = auto()
    AFTER = auto()
    REPLACE = auto()

@dataclass
class Placment:
    tag: str
    position: Position

PATHS = [ Path(__file__).parent.parent / 'src' / 'building_blocks' / 'navbar.html',
Path(__file__).parent.parent / 'src' / 'building_blocks' / 'footer.html']

PATHS_TO_POSITION = { PATHS[0]: Placment('nav', Position.REPLACE), PATHS[1]: Placment('footer', Position.REPLACE) }

def update_content(html: List[str], content: List[str], placement):

    if placement.position == Position.REPLACE:
        opening_tag = f'<{placement.tag}>'
        closing_tag = f'</{placement.tag}>'
        # find index of tag 
        opening_tag_index = [i for i, x in enumerate(html) if opening_tag in x][0]
        closing_tag_index = [i for i, x in enumerate(html) if closing_tag in x][0]

        # replace content
        html[opening_tag_index:closing_tag_index+1] = content

    return html


def get_args():
    parser = argparse.ArgumentParser(description='Apply common elements to html files')
    parser.add_argument('-i', '--input', help='input html file', required=True)
    parser.add_argument('-o', '--output', help='output html file', required=True)
    parser.add_argument('-d', '--debug', help='debug mode', action='store_true')
    return parser.parse_args()


def apply_common_elements(input_file, output_file, debug=False):

    if debug:
        logging.basicConfig(level=logging.DEBUG)
    else:
        logging.basicConfig(level=logging.INFO)

    logging.info(f'Applying common elements to {input_file}')
    logging.info(f'Output file: {output_file}')

    html = Path(input_file).read_text()
    html_as_list = html.split('\n')
    for path in PATHS:
        content_as_list = Path(path).read_text().split('\n')
        update_content(html_as_list, content_as_list, PATHS_TO_POSITION[path]) 
    
    Path(output_file).write_text('\n'.join(html_as_list))
    logging.info(f'Done!')


def main():
    args = get_args()
    apply_common_elements(args.input, args.output, args.debug)


if __name__ == '__main__':
    main()
