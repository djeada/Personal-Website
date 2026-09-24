"""Fetch the Algorithms & Data Structures YouTube playlist and generate
one lesson page per video plus update the course index page.

Requires ``yt-dlp`` to be installed (used at build time only). Without
network access the playlist is recovered from the generated course index.

Each lesson page combines the video (loaded on demand through the site-wide
``.video-facade`` contract) with study notes from ``LESSON_NOTES``, links to
the matching site articles and interactive tools, structured data, and
progress tracking handled by ``course.js``.
"""

import html as html_mod
import json
import logging
import re
import subprocess
import textwrap
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, NamedTuple, Optional, Tuple

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

PLAYLIST_URL = (
    "https://www.youtube.com/playlist?list=PLjHlsBDcsWnNzmNAsb-LjVElCO3gUZbbV"
)
CHANNEL_URL = "https://www.youtube.com/channel/UCGPoHTVjMN77wcGknXPHl1Q"
SITE_URL = "https://adamdjellouli.com"

ROOT_DIR = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT_DIR / "src"
COURSE_ROOT = SRC_DIR / "courses" / "algorithms_and_data_structures"
LESSONS_DIR = COURSE_ROOT / "lessons"
COURSE_PAGE = COURSE_ROOT / "index.html"
COURSE_PATH = "/courses/algorithms_and_data_structures/"
COURSE_URL = f"{SITE_URL}{COURSE_PATH}"
COURSES_URL = f"{SITE_URL}/core/courses"
RESOURCE_PREFIX = "../../../"
COURSE_TITLE = "Algorithms and Data Structures"
COURSE_DESCRIPTION = (
    "Structured interview-style practice with Python walkthroughs for arrays, "
    "strings, linked lists, trees, graphs, greedy methods, and dynamic programming."
)
AUTHOR = {"@type": "Person", "name": "Adam Djellouli", "url": SITE_URL}

ARTICLES = "/articles/algorithms_and_data_structures/"
DATA_STRUCTURE_LAB = ("Data Structure Lab", "/tools/data_structures/index.html")


class Topic(NamedTuple):
    name: str
    blurb: str
    articles: Tuple[Tuple[str, str], ...]
    tools: Tuple[Tuple[str, str], ...] = ()


TOPICS: Dict[str, Topic] = {
    "hashing": Topic(
        "Arrays & hashing",
        "Trade memory for speed: sets and dictionaries answer 'have I seen this?' in O(1).",
        (
            ("Hash tables", f"{ARTICLES}data_structures.html#hash-tables"),
            (
                "Working with arrays",
                f"{ARTICLES}brain_teasers.html#working-with-arrays",
            ),
        ),
        (DATA_STRUCTURE_LAB,),
    ),
    "two-pointers": Topic(
        "Two pointers & sliding window",
        "Move two indices through a sequence so each element is visited a constant number of times.",
        (
            (
                "The two-pointer technique",
                f"{ARTICLES}brain_teasers.html#two-pointer-technique",
            ),
            (
                "Working with strings",
                f"{ARTICLES}brain_teasers.html#working-with-strings",
            ),
        ),
    ),
    "binary-search": Topic(
        "Binary search",
        "Discard half of the remaining search space with every comparison.",
        (
            (
                "Divide-and-conquer search",
                f"{ARTICLES}searching.html#divide-conquer-search",
            ),
            (
                "Recognising O(log n) running times",
                f"{ARTICLES}basic_concepts.html#recognising-o-log-n-and-o-n-log-n-running-times",
            ),
        ),
        (("Search algorithm visualizer", "/tools/searching/index.html"),),
    ),
    "linked-lists": Topic(
        "Linked lists",
        "Re-wire next pointers carefully; a dummy head and fast/slow pointers remove most edge cases.",
        (
            ("Linked lists", f"{ARTICLES}data_structures.html#linked-lists"),
            (
                "Working with linked lists",
                f"{ARTICLES}brain_teasers.html#working-with-linked-lists",
            ),
        ),
        (DATA_STRUCTURE_LAB,),
    ),
    "stacks-heaps": Topic(
        "Stacks & heaps",
        "Stacks match the most recent item; heaps keep the smallest or largest item one pop away.",
        (
            ("Stacks", f"{ARTICLES}data_structures.html#stacks"),
            ("Heaps", f"{ARTICLES}data_structures.html#heaps"),
            ("Working with heaps", f"{ARTICLES}brain_teasers.html#working-with-heaps"),
        ),
        (DATA_STRUCTURE_LAB,),
    ),
    "trees": Topic(
        "Trees & tries",
        "Most tree problems are a recursive question asked of the left subtree, the right subtree, and the root.",
        (
            (
                "Binary search trees",
                f"{ARTICLES}data_structures.html#binary-search-trees-bst-",
            ),
            (
                "Working with trees",
                f"{ARTICLES}brain_teasers.html#working-with-trees-and-binary-trees",
            ),
        ),
        (DATA_STRUCTURE_LAB,),
    ),
    "graphs": Topic(
        "Graphs",
        "Model the problem as nodes and edges, then pick the traversal: DFS, BFS or a topological order.",
        (
            ("Graph traversals", f"{ARTICLES}graphs.html#traversals"),
            ("Topological sort", f"{ARTICLES}graphs.html#topological-sort"),
        ),
        (("Graph algorithm visualizer", "/tools/graphs/index.html"),),
    ),
    "matrices": Topic(
        "Matrices & grids",
        "Keep row and column boundaries explicit and treat grid cells as graph nodes when needed.",
        (
            ("Grid traversal patterns", f"{ARTICLES}matrices.html#traversal-patterns"),
            ("Grids as graphs", f"{ARTICLES}matrices.html#grids-as-graphs"),
        ),
    ),
    "backtracking": Topic(
        "Backtracking",
        "Build a candidate one choice at a time and undo the choice when it cannot lead to a solution.",
        (
            ("Backtracking", f"{ARTICLES}backtracking.html#backtracking"),
            ("Backtracking on grids", f"{ARTICLES}matrices.html#backtracking-on-grids"),
        ),
    ),
    "dp": Topic(
        "Dynamic programming",
        "Define a state, write the recurrence between states, and compute each state only once.",
        (
            (
                "Dynamic programming principles",
                f"{ARTICLES}dynamic_programming.html#principles",
            ),
            (
                "Memoization and tabulation",
                f"{ARTICLES}dynamic_programming.html#implementation-techniques",
            ),
        ),
    ),
    "greedy": Topic(
        "Greedy & intervals",
        "Make the locally best choice, usually after sorting, and argue why it never hurts later.",
        (
            (
                "Greedy patterns",
                f"{ARTICLES}greedy_algorithms.html#examples-grouped-by-pattern",
            ),
            (
                "Proving a greedy choice",
                f"{ARTICLES}greedy_algorithms.html#the-greedy-proof-toolkit",
            ),
        ),
    ),
    "bits": Topic(
        "Bit manipulation & math",
        "Use XOR, AND and shifts to work on the binary representation directly.",
        (
            (
                "Bit manipulation techniques",
                f"{ARTICLES}brain_teasers.html#bit-manipulation-techniques",
            ),
            ("Bit masks", f"{ARTICLES}brain_teasers.html#bit-masks"),
        ),
    ),
}

COMPLEXITY_ARTICLE = (
    "Understanding algorithmic complexity",
    f"{ARTICLES}basic_concepts.html#understanding-algorithmic-complexity",
)


class Note(NamedTuple):
    """Study notes for one LeetCode problem, keyed by number in LESSON_NOTES.

    ``problem`` restates the task, ``idea`` is the standard optimal approach,
    and ``time``/``space`` are that approach's bounds.
    """

    topic: str
    problem: str
    idea: str
    time: str
    space: str
    extra: Tuple[Tuple[str, str], ...] = ()


LESSON_NOTES: Dict[int, Note] = {
    1: Note(
        "hashing",
        "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
        "Scan the array once while storing each value's index in a dictionary. For every number, check whether target − number has already been seen.",
        "O(n)",
        "O(n)",
    ),
    3: Note(
        "two-pointers",
        "Find the length of the longest substring that contains no repeated characters.",
        "Grow a sliding window to the right and remember where each character was last seen. When a character repeats inside the window, jump the left edge just past its previous position.",
        "O(n)",
        "O(min(n, alphabet))",
    ),
    5: Note(
        "two-pointers",
        "Return the longest substring of a string that reads the same forwards and backwards.",
        "Every palindrome has a centre. Expand outwards from each of the 2n − 1 centres (characters and gaps between them) and keep the longest match.",
        "O(n²)",
        "O(1)",
    ),
    11: Note(
        "two-pointers",
        "Choose two vertical lines that, together with the x-axis, hold the most water.",
        "Start with pointers at both ends. The shorter line limits the area, so move that pointer inwards; moving the taller one can never help.",
        "O(n)",
        "O(1)",
    ),
    15: Note(
        "two-pointers",
        "Find all unique triplets in an array whose values sum to zero (LeetCode's 3Sum).",
        "Sort the array, fix one element, and run a two-pointer search for the remaining pair. Skip equal neighbours to avoid duplicate triplets.",
        "O(n²)",
        "O(1) extra, excluding sorting and output",
    ),
    19: Note(
        "linked-lists",
        "Remove the n-th node from the end of a singly linked list and return its head.",
        "Put a dummy node before the head and move a fast pointer n steps ahead. Advance both pointers until fast reaches the end; slow then sits just before the node to delete.",
        "O(L)",
        "O(1)",
    ),
    20: Note(
        "stacks-heaps",
        "Decide whether a string of brackets ()[]{} is opened and closed in the correct order.",
        "Push opening brackets onto a stack. Each closing bracket must match the top of the stack, and the string is valid only if the stack ends up empty.",
        "O(n)",
        "O(n)",
    ),
    21: Note(
        "linked-lists",
        "Merge two sorted linked lists into a single sorted list.",
        "Use a dummy head and repeatedly attach the smaller of the two current nodes, then append whatever remains.",
        "O(n + m)",
        "O(1)",
    ),
    23: Note(
        "stacks-heaps",
        "Merge k sorted linked lists into one sorted linked list.",
        "Keep the current head of every list in a min-heap. Pop the smallest node, append it to the result, and push its successor.",
        "O(N log k)",
        "O(k)",
    ),
    33: Note(
        "binary-search",
        "Find the index of a target in a sorted array of distinct values that was rotated at an unknown pivot.",
        "Run binary search, but at every step note that one half is still sorted. Check whether the target lies inside that sorted half to decide which half to keep.",
        "O(log n)",
        "O(1)",
    ),
    39: Note(
        "backtracking",
        "List every unique combination of candidate numbers (each usable any number of times) that sums to a target.",
        "Backtrack over the candidates in order, allowing the current candidate to be chosen again, and stop a branch as soon as the running sum exceeds the target.",
        "Exponential in target / smallest candidate",
        "O(target / smallest candidate) recursion depth",
    ),
    48: Note(
        "matrices",
        "Rotate an n × n matrix by 90 degrees clockwise, in place.",
        "Transpose the matrix (swap across the main diagonal), then reverse every row.",
        "O(n²)",
        "O(1)",
    ),
    49: Note(
        "hashing",
        "Group a list of words so that anagrams end up together.",
        "Give every word a canonical key, such as its sorted letters or a 26-letter count tuple, and collect words by key in a dictionary.",
        "O(n · k log k) with sorted keys",
        "O(n · k)",
    ),
    53: Note(
        "dp",
        "Find the contiguous subarray with the largest sum.",
        "Kadane's algorithm: at every index either extend the best subarray ending at the previous index or start fresh, and track the best sum seen.",
        "O(n)",
        "O(1)",
    ),
    54: Note(
        "matrices",
        "Return all elements of a matrix in spiral order.",
        "Keep four boundaries (top, bottom, left, right). Walk the top row, right column, bottom row and left column, shrinking the matching boundary after each pass.",
        "O(m · n)",
        "O(1) extra",
    ),
    55: Note(
        "greedy",
        "Each element is the maximum jump length from that index. Decide whether the last index is reachable from the first.",
        "Track the furthest index reachable so far. If the current index is ever beyond it, the end cannot be reached.",
        "O(n)",
        "O(1)",
    ),
    56: Note(
        "greedy",
        "Merge all overlapping intervals.",
        "Sort intervals by start. Extend the last merged interval when the next one overlaps it; otherwise start a new merged interval.",
        "O(n log n)",
        "O(n)",
    ),
    57: Note(
        "greedy",
        "Insert a new interval into a sorted list of non-overlapping intervals, merging where necessary.",
        "In one pass, copy intervals that end before the new one, merge every interval that overlaps it, then copy the rest.",
        "O(n)",
        "O(n) for the output",
    ),
    62: Note(
        "dp",
        "Count the paths from the top-left to the bottom-right of an m × n grid when you may only move right or down.",
        "The number of paths to a cell is the sum of the paths to the cell above and the cell to the left. A single row of the table is enough.",
        "O(m · n)",
        "O(n)",
    ),
    70: Note(
        "dp",
        "Count the distinct ways to climb n stairs when each move is one or two steps.",
        "ways(n) = ways(n − 1) + ways(n − 2), the Fibonacci recurrence. Keep only the last two values.",
        "O(n)",
        "O(1)",
    ),
    73: Note(
        "matrices",
        "Whenever a matrix element is 0, set its entire row and column to 0, in place.",
        "Use the first row and first column as marker storage, with two flags that remember whether they originally contained a zero.",
        "O(m · n)",
        "O(1)",
    ),
    76: Note(
        "two-pointers",
        "Find the smallest substring of s that contains every character of t, including duplicates.",
        "Expand the window to the right until it covers all counts from t, then shrink it from the left while it stays valid, recording the smallest window.",
        "O(|s| + |t|)",
        "O(alphabet)",
    ),
    79: Note(
        "backtracking",
        "Decide whether a word can be traced through horizontally or vertically adjacent grid cells, using each cell at most once.",
        "Start a depth-first search from every cell that matches the first letter. Mark cells as visited on the way down and restore them when backtracking.",
        "O(m · n · 3^L)",
        "O(L) recursion depth",
    ),
    91: Note(
        "dp",
        "Count the ways to decode a string of digits where 'A' = 1 … 'Z' = 26.",
        "dp[i] adds dp[i − 1] when the last digit is 1–9 and dp[i − 2] when the last two digits form 10–26. Only two previous values are needed.",
        "O(n)",
        "O(1)",
    ),
    98: Note(
        "trees",
        "Check whether a binary tree is a valid binary search tree.",
        "Recurse with the range of values each node is allowed to take, tightening the upper bound on the left and the lower bound on the right. An in-order traversal that stays strictly increasing works too.",
        "O(n)",
        "O(h)",
    ),
    100: Note(
        "trees",
        "Check whether two binary trees have the same structure and the same node values.",
        "Compare the two roots, then recursively compare the left subtrees and the right subtrees.",
        "O(n)",
        "O(h)",
    ),
    102: Note(
        "trees",
        "Return the values of a binary tree level by level, from left to right.",
        "Breadth-first search with a queue, processing exactly the nodes of one level per iteration.",
        "O(n)",
        "O(n)",
    ),
    104: Note(
        "trees",
        "Find the maximum depth of a binary tree.",
        "The depth of a node is 1 + the larger depth of its two subtrees; an empty tree has depth 0.",
        "O(n)",
        "O(h)",
    ),
    105: Note(
        "trees",
        "Rebuild a binary tree from its preorder and inorder traversals.",
        "The next preorder value is the root; its position in the inorder list splits the left and right subtrees. A dictionary of inorder positions makes each lookup O(1).",
        "O(n)",
        "O(n)",
    ),
    121: Note(
        "greedy",
        "Given daily stock prices, find the largest profit from one buy followed by one later sell.",
        "Walk through the prices once, keeping the lowest price so far and the best difference between today's price and that minimum.",
        "O(n)",
        "O(1)",
    ),
    124: Note(
        "trees",
        "Find the largest sum of any path between two nodes in a binary tree.",
        "A post-order DFS returns the best downward gain from each node, ignoring negative branches, and updates the answer with node + left gain + right gain.",
        "O(n)",
        "O(h)",
    ),
    125: Note(
        "two-pointers",
        "Decide whether a string is a palindrome after ignoring case and non-alphanumeric characters.",
        "Move two pointers inwards from both ends, skipping characters that are not letters or digits and comparing the rest case-insensitively.",
        "O(n)",
        "O(1)",
    ),
    128: Note(
        "hashing",
        "Find the length of the longest run of consecutive integers in an unsorted array, in O(n) time.",
        "Put every number in a set and only start counting from numbers whose predecessor is missing, so each run is walked once.",
        "O(n)",
        "O(n)",
    ),
    133: Note(
        "graphs",
        "Return a deep copy of a connected undirected graph.",
        "Traverse the graph with DFS or BFS while a dictionary maps every original node to its clone, which also prevents copying a node twice.",
        "O(V + E)",
        "O(V)",
    ),
    139: Note(
        "dp",
        "Decide whether a string can be split into a sequence of dictionary words.",
        "dp[i] is true when some earlier split point j has dp[j] true and s[j:i] is a dictionary word. Store the words in a set for fast lookups.",
        "O(n²) substring checks",
        "O(n)",
    ),
    141: Note(
        "linked-lists",
        "Detect whether a linked list contains a cycle.",
        "Floyd's tortoise and hare: a slow pointer moves one step and a fast pointer two. They meet if and only if there is a cycle.",
        "O(n)",
        "O(1)",
    ),
    143: Note(
        "linked-lists",
        "Reorder a list L0 → L1 → … → Ln into L0 → Ln → L1 → Ln−1 → …, in place.",
        "Find the middle with slow and fast pointers, reverse the second half, then merge the two halves alternately.",
        "O(n)",
        "O(1)",
    ),
    152: Note(
        "dp",
        "Find the contiguous subarray with the largest product.",
        "Track both the largest and the smallest product ending at each index, because multiplying by a negative number swaps them.",
        "O(n)",
        "O(1)",
    ),
    153: Note(
        "binary-search",
        "Find the minimum of a sorted array of distinct values that was rotated at an unknown pivot.",
        "Binary search against the right end: if nums[mid] > nums[right] the minimum is to the right of mid, otherwise it is at mid or to its left.",
        "O(log n)",
        "O(1)",
    ),
    190: Note(
        "bits",
        "Reverse the bits of a 32-bit unsigned integer.",
        "Repeat 32 times: shift the result left, add the lowest bit of n, then shift n right.",
        "O(1) (32 iterations)",
        "O(1)",
    ),
    191: Note(
        "bits",
        "Count the number of 1 bits in an unsigned integer (its Hamming weight).",
        "n & (n − 1) clears the lowest set bit, so count how many times it can be applied before n becomes 0.",
        "O(number of set bits)",
        "O(1)",
    ),
    198: Note(
        "dp",
        "Find the most money you can rob from a row of houses without robbing two adjacent houses.",
        "For each house take the better of skipping it or robbing it plus the best total from two houses back. Two variables are enough.",
        "O(n)",
        "O(1)",
    ),
    200: Note(
        "matrices",
        "Count the islands (groups of horizontally or vertically connected land cells) in a grid.",
        "Scan the grid; each unvisited land cell starts a new island, and a DFS or BFS flood fill marks the whole island as visited.",
        "O(m · n)",
        "O(m · n) in the worst case",
        (("Graph algorithm visualizer", "/tools/graphs/index.html"),),
    ),
    206: Note(
        "linked-lists",
        "Reverse a singly linked list.",
        "Walk the list with prev, current and next pointers, pointing each node back at the previous one.",
        "O(n)",
        "O(1)",
    ),
    207: Note(
        "graphs",
        "Given course prerequisites, decide whether it is possible to finish every course.",
        "Courses and prerequisites form a directed graph, and all courses can be finished exactly when it has no cycle. Kahn's topological sort (or DFS with visit states) detects this.",
        "O(V + E)",
        "O(V + E)",
    ),
    208: Note(
        "trees",
        "Implement a trie with insert, search and startsWith operations.",
        "Each node stores a dictionary of children and a flag that marks the end of a word; every operation walks one node per character.",
        "O(L) per operation",
        "O(total characters inserted)",
    ),
    210: Note(
        "graphs",
        "Return an order in which all courses can be taken, or an empty list if that is impossible.",
        "Kahn's algorithm: repeatedly take courses with no remaining prerequisites. If fewer than all courses are output, the graph has a cycle.",
        "O(V + E)",
        "O(V + E)",
    ),
    211: Note(
        "trees",
        "Design a word dictionary that supports adding words and searching with '.' as a wildcard letter.",
        "Store words in a trie. When searching, follow the matching child for normal letters and try every child for a '.'.",
        "O(L) to add; search can visit the whole trie with wildcards",
        "O(total characters added)",
    ),
    212: Note(
        "backtracking",
        "Find every word from a list that can be traced through adjacent cells of a letter grid.",
        "Put the words in a trie and run one DFS from every cell that follows trie edges, collecting words at end nodes and pruning branches that are exhausted.",
        "O(m · n · 4 · 3^(L−1)) in the worst case",
        "O(total characters in the word list)",
    ),
    213: Note(
        "dp",
        "House Robber, but the houses stand in a circle, so the first and last house are neighbours.",
        "The first and last house cannot both be robbed, so solve the linear House Robber problem twice (without the first house and without the last) and take the better result.",
        "O(n)",
        "O(1)",
    ),
    217: Note(
        "hashing",
        "Decide whether any value appears at least twice in an array.",
        "Add values to a set and stop at the first value that is already present.",
        "O(n)",
        "O(n)",
    ),
    226: Note(
        "trees",
        "Mirror a binary tree by swapping the left and right child of every node.",
        "Swap the children of the current node and recurse into both subtrees (or do the same with a queue).",
        "O(n)",
        "O(h)",
    ),
    230: Note(
        "trees",
        "Return the k-th smallest value in a binary search tree.",
        "An in-order traversal visits BST values in sorted order, so stop at the k-th visited node. An explicit stack makes early exit easy.",
        "O(h + k)",
        "O(h)",
    ),
    235: Note(
        "trees",
        "Find the lowest common ancestor of two nodes in a binary search tree.",
        "Walk down from the root: go left if both values are smaller, right if both are larger. The first node where they split is the answer.",
        "O(h)",
        "O(1)",
    ),
    238: Note(
        "hashing",
        "For every index, return the product of all other elements without using division.",
        "Fill the output with prefix products from the left, then multiply in suffix products from the right using a single running variable.",
        "O(n)",
        "O(1) extra, excluding the output",
        (
            (
                "Product of array except self (worked example)",
                f"{ARTICLES}brain_teasers.html#product-of-array-except-self",
            ),
        ),
    ),
    242: Note(
        "hashing",
        "Decide whether two strings are anagrams of each other.",
        "Compare the character counts of the two strings, for example with a Counter or a 26-slot array.",
        "O(n)",
        "O(1) for a fixed alphabet",
    ),
    268: Note(
        "bits",
        "An array holds n distinct numbers from the range 0 … n. Find the one that is missing.",
        "Subtract the array's sum from n(n + 1) / 2, or XOR every index with every value so that only the missing number survives.",
        "O(n)",
        "O(1)",
    ),
    295: Note(
        "stacks-heaps",
        "Design a structure that accepts a stream of numbers and returns the current median.",
        "Keep the smaller half in a max-heap and the larger half in a min-heap with balanced sizes; the median comes from the heap tops.",
        "O(log n) to add, O(1) for the median",
        "O(n)",
    ),
    297: Note(
        "trees",
        "Convert a binary tree to a string and rebuild the identical tree from that string.",
        "Serialize with a preorder DFS that writes a marker for every missing child; deserialize by reading the tokens back in the same order.",
        "O(n)",
        "O(n)",
    ),
    300: Note(
        "dp",
        "Find the length of the longest strictly increasing subsequence.",
        "The O(n²) DP compares each element with all earlier ones. The faster method keeps the smallest tail of every subsequence length and places each number with binary search.",
        "O(n log n)",
        "O(n)",
    ),
    322: Note(
        "dp",
        "Find the fewest coins needed to make an amount, or −1 if it cannot be made.",
        "Bottom-up DP: dp[a] is 1 + the minimum of dp[a − coin] over all coins that fit.",
        "O(amount · number of coins)",
        "O(amount)",
    ),
    338: Note(
        "bits",
        "For every i from 0 to n, return how many 1 bits i has.",
        "Reuse earlier answers: bits(i) = bits(i >> 1) + (i & 1).",
        "O(n)",
        "O(n) for the output",
    ),
    347: Note(
        "stacks-heaps",
        "Return the k most frequent elements of an array.",
        "Count frequencies with a dictionary, then either keep a size-k heap or bucket the values by frequency and read the buckets from the top.",
        "O(n) with buckets, O(n log k) with a heap",
        "O(n)",
    ),
    371: Note(
        "bits",
        "Add two integers without using the + or − operators.",
        "XOR adds the bits without carries and AND shifted left produces the carries; repeat until no carry is left. In Python, mask to 32 bits to imitate fixed-width integers.",
        "O(1) for 32-bit integers",
        "O(1)",
    ),
    417: Note(
        "graphs",
        "Find the grid cells from which rain water can flow to both the Pacific and the Atlantic ocean.",
        "Reverse the flow: search uphill from the cells bordering each ocean, then return the cells reached from both sides.",
        "O(m · n)",
        "O(m · n)",
        (("Grids as graphs", f"{ARTICLES}matrices.html#grids-as-graphs"),),
    ),
    424: Note(
        "two-pointers",
        "Find the longest substring of one repeated letter you can get after replacing at most k characters.",
        "Keep a sliding window with letter counts. The window is valid while its length minus the most frequent count is at most k; otherwise move the left edge.",
        "O(n)",
        "O(alphabet)",
    ),
    435: Note(
        "greedy",
        "Find the minimum number of intervals to remove so that the rest do not overlap.",
        "Sort by end time and keep every interval that starts after the last kept one ends; each overlapping interval is a removal.",
        "O(n log n)",
        "O(1) extra, excluding sorting",
    ),
    572: Note(
        "trees",
        "Decide whether one binary tree appears as a subtree of another.",
        "At every node of the main tree, run the Same Tree check against the smaller tree.",
        "O(m · n)",
        "O(h)",
    ),
    605: Note(
        "greedy",
        "Decide whether n new flowers can be planted in a flowerbed without any two flowers being adjacent.",
        "Scan left to right and plant in every empty plot whose neighbours are empty, treating positions outside the bed as empty.",
        "O(n)",
        "O(1)",
    ),
    646: Note(
        "greedy",
        "Pairs (a, b) can be chained when b < c for the next pair (c, d). Find the longest possible chain.",
        "Sort pairs by their second value and greedily take every pair that starts after the end of the last pair taken.",
        "O(n log n)",
        "O(1) extra, excluding sorting",
    ),
    647: Note(
        "two-pointers",
        "Count the palindromic substrings of a string.",
        "Expand around each of the 2n − 1 centres and count every palindrome found along the way.",
        "O(n²)",
        "O(1)",
    ),
    847: Note(
        "graphs",
        "Find the length of the shortest walk that visits every node of an undirected graph, starting and ending anywhere.",
        "Breadth-first search over (node, visited-set bitmask) states, starting from every node at once; the first state with all bits set gives the answer.",
        "O(2ⁿ · n²)",
        "O(2ⁿ · n)",
    ),
    849: Note(
        "hashing",
        "In a row of seats (1 = taken, 0 = empty), choose a seat that maximizes the distance to the closest person.",
        "Measure the runs of empty seats: a run between two people gives half its length (rounded up), while a run at either end of the row counts in full.",
        "O(n)",
        "O(1)",
    ),
    1043: Note(
        "dp",
        "Partition an array into contiguous blocks of length at most k; every element becomes its block's maximum. Maximize the final sum.",
        "dp[i] is the best sum for the first i elements: try every last block length j ≤ k and add j × (maximum of that block) to dp[i − j].",
        "O(n · k)",
        "O(n)",
    ),
    1143: Note(
        "dp",
        "Find the length of the longest subsequence shared by two strings.",
        "dp[i][j] = dp[i − 1][j − 1] + 1 when the characters match, otherwise the larger of dp[i − 1][j] and dp[i][j − 1].",
        "O(m · n)",
        "O(m · n), or O(min(m, n)) with rolling rows",
    ),
    1857: Note(
        "graphs",
        "In a coloured directed graph, find the largest count of one colour along any path, or −1 if the graph has a cycle.",
        "Process nodes in topological order (Kahn's algorithm) while carrying, for every node, the best count of each of the 26 colours on paths ending there. Unprocessed nodes mean a cycle.",
        "O((V + E) · 26)",
        "O(V · 26)",
    ),
}

LEETCODE_SLUGS = {15: "3sum", 121: "best-time-to-buy-and-sell-stock"}
DISPLAY_NAMES = {
    15: "Triplet Sum (3Sum)",
    121: "Best Time to Buy and Sell Stock",
    646: "Maximum Length of Pair Chain",
}

TOPIC_RULES = [
    ("trees", ("tree", "subtree", "bst", "trie", "ancestor")),
    ("graphs", ("graph", "course schedule", "visiting all nodes")),
    ("linked-lists", ("linked list", "list")),
    ("dp", ("subsequence", "coin", "robber", "paths", "stairs", "partition")),
    ("greedy", ("interval", "jump", "stock", "chain")),
    ("bits", ("bits", "bit", "missing number")),
    ("backtracking", ("combination", "word search", "permutation", "subsets")),
    ("stacks-heaps", ("median", "top k", "heap", "stack", "parentheses")),
    ("matrices", ("matrix", "grid", "island")),
    ("binary-search", ("rotated", "binary search")),
    ("two-pointers", ("substring", "palindrome", "window")),
]


@dataclass
class Video:
    video_id: str
    title: str
    description: str
    index: int
    duration: Optional[int] = None
    upload_date: str = ""


@dataclass
class Lesson:
    video: Video
    number: int
    slug: str
    name: str
    leetcode: Optional[int]
    topic_key: str
    note: Optional[Note]

    @property
    def topic(self) -> Topic:
        return TOPICS[self.topic_key]

    @property
    def url(self) -> str:
        return f"{COURSE_URL}lessons/{self.slug}"

    @property
    def heading(self) -> str:
        return self.name

    @property
    def seo_title(self) -> str:
        if self.leetcode:
            title = f"{self.name} – LeetCode {self.leetcode} Python Solution Explained"
            if len(title) > 70:
                title = f"{self.name} – LeetCode {self.leetcode} in Python"
            return title
        return f"{self.name} – {COURSE_TITLE} Video Lesson"

    @property
    def meta_description(self) -> str:
        if self.note:
            pieces = [
                f"{self.name} (LeetCode {self.leetcode}) explained in Python.",
                self.note.problem,
                f"Target: {self.note.time} time, {self.note.space} space.",
                "Free video lesson with notes.",
            ]
            text = " ".join(pieces[:2])
            for piece in pieces[2:]:
                if len(text) + len(piece) + 1 > 158:
                    break
                text = f"{text} {piece}"
        else:
            text = (
                f"{self.name}: a Python video walkthrough from the free "
                f"{COURSE_TITLE} course by Adam Djellouli."
            )
        return _shorten(text, 158)

    @property
    def leetcode_url(self) -> Optional[str]:
        if not self.leetcode:
            return None
        slug = LEETCODE_SLUGS.get(self.leetcode) or _slugify(self.name).replace(
            "_", "-"
        )
        return f"https://leetcode.com/problems/{slug}/"


def _shorten(text: str, width: int) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= width:
        return text
    return text[: width - 1].rsplit(" ", 1)[0].rstrip(",;:") + "…"


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return slug[:80] or "video"


def _topic_for_title(title: str) -> str:
    lowered = title.lower()
    for key, keywords in TOPIC_RULES:
        if any(re.search(rf"\b{re.escape(word)}\b", lowered) for word in keywords):
            return key
    return "hashing"


def _parse_title(title: str) -> Tuple[str, Optional[int]]:
    match = re.match(
        r"^\s*(?P<name>.+?)\s*[-–]\s*leetcode\s*#?(?P<num>\d+)\b", title, flags=re.I
    )
    if not match:
        return title.strip(), None
    return match.group("name").strip(), int(match.group("num"))


def build_lessons(videos: List[Video]) -> List[Lesson]:
    lessons = []
    for position, video in enumerate(videos):
        name, leetcode = _parse_title(video.title)
        note = LESSON_NOTES.get(leetcode) if leetcode else None
        if leetcode and not note:
            logging.warning("No lesson notes for LeetCode %s (%s)", leetcode, name)
        lessons.append(
            Lesson(
                video=video,
                number=position + 1,
                slug=_slugify(f"{position + 1:02d}_{video.title}"),
                name=DISPLAY_NAMES.get(leetcode, name),
                leetcode=leetcode,
                topic_key=note.topic if note else _topic_for_title(video.title),
                note=note,
            )
        )
    return lessons


def fetch_playlist() -> List[Video]:
    """Use yt-dlp to get flat playlist metadata."""
    logging.info("Fetching playlist metadata from YouTube …")
    result = subprocess.run(
        ["yt-dlp", "--flat-playlist", "--dump-json", "--no-warnings", PLAYLIST_URL],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0 or not result.stdout.strip():
        logging.error("yt-dlp failed: %s", result.stderr)
        raise RuntimeError("yt-dlp failed – is it installed and online?")

    videos: List[Video] = []
    for idx, line in enumerate(result.stdout.strip().splitlines()):
        data = json.loads(line)
        upload = data.get("upload_date") or ""
        if re.fullmatch(r"\d{8}", upload):
            upload = f"{upload[:4]}-{upload[4:6]}-{upload[6:]}"
        videos.append(
            Video(
                video_id=data.get("id", ""),
                title=data.get("title", f"Video {idx + 1}"),
                description=data.get("description") or "",
                index=idx,
                duration=int(data["duration"]) if data.get("duration") else None,
                upload_date=(
                    upload if re.fullmatch(r"\d{4}-\d{2}-\d{2}", upload) else ""
                ),
            )
        )
    logging.info("Found %d videos in playlist.", len(videos))
    return videos


def _attr(tag: str, name: str) -> str:
    match = re.search(rf'\b{name}="([^"]*)"', tag)
    return html_mod.unescape(match.group(1)) if match else ""


def load_existing_playlist() -> List[Video]:
    """Recover video metadata from the generated index for offline builds."""
    if not COURSE_PAGE.exists():
        return []
    page = COURSE_PAGE.read_text(encoding="utf-8")
    videos: List[Video] = []
    for tag in re.findall(r"<article\b[^>]*\bdata-course-card\b[^>]*>", page):
        video_id, title = _attr(tag, "data-video-id"), _attr(tag, "data-video-title")
        if not (video_id and title):
            continue
        duration = _attr(tag, "data-duration")
        videos.append(
            Video(
                video_id=video_id,
                title=title,
                description="",
                index=len(videos),
                duration=int(duration) if duration.isdigit() else None,
                upload_date=_attr(tag, "data-upload-date"),
            )
        )
    if not videos:
        matches = re.findall(
            r'<img\s+src="https://img\.youtube\.com/vi/([^/]+)/[^"]+"[^>]*>.*?<h3>(.*?)</h3>',
            page,
            flags=re.S,
        )
        videos = [
            Video(
                video_id=video_id,
                title=html_mod.unescape(re.sub(r"<[^>]+>", "", title)).strip(),
                description="",
                index=index,
            )
            for index, (video_id, title) in enumerate(matches)
        ]
    logging.info("Recovered %d videos from the existing course page.", len(videos))
    return videos


def _format_description(description: str) -> str:
    """Convert a plain-text YouTube description into simple HTML."""
    if not description.strip():
        return ""
    paragraphs = []
    for block in re.split(r"\n{2,}", description.strip()):
        lines = block.strip().splitlines()
        escaped = "<br>\n".join(html_mod.escape(line) for line in lines)
        escaped = re.sub(
            r"(https?://[^\s<]+)",
            r'<a href="\1" target="_blank" rel="noopener">\1</a>',
            escaped,
        )
        escaped = re.sub(
            r"\b(\d{1,2}:\d{2}(?::\d{2})?)\b", r"<strong>\1</strong>", escaped
        )
        paragraphs.append(f"<p>{escaped}</p>")
    return "\n".join(paragraphs)


def _minutes(seconds: Optional[int]) -> str:
    return f"{max(1, round(seconds / 60))} min" if seconds else ""


def _iso_duration(seconds: int) -> str:
    minutes, secs = divmod(int(seconds), 60)
    return f"PT{minutes}M{secs}S"


def _json_ld(data: dict) -> str:
    text = json.dumps(data, ensure_ascii=False, indent=2)
    return text.replace("</", "<\\/")


def _resolve_link(href: str) -> Optional[str]:
    """Return href if its target exists under src/, dropping a stale #anchor."""
    path, _, anchor = href.partition("#")
    target = SRC_DIR / path.lstrip("/")
    if not target.is_file():
        logging.warning("Skipping related link to missing page %s", path)
        return None
    if anchor and f'id="{anchor}"' not in target.read_text(encoding="utf-8"):
        logging.warning("Anchor #%s not found in %s; linking to the page", anchor, path)
        return path
    return href


def _related_links(lesson: Lesson) -> List[Tuple[str, str, str]]:
    links = []
    seen = set()
    candidates = [("Article", label, href) for label, href in lesson.topic.articles]
    if lesson.note:
        for label, href in lesson.note.extra:
            kind = "Interactive tool" if href.startswith("/tools/") else "Article"
            candidates.append((kind, label, href))
    candidates += [
        ("Interactive tool", label, href) for label, href in lesson.topic.tools
    ]
    for kind, label, href in candidates:
        resolved = _resolve_link(href)
        if resolved and resolved not in seen:
            seen.add(resolved)
            links.append((kind, label, resolved))
    return links


def _outline_html(lessons: List[Lesson], current: Lesson) -> str:
    items = []
    for lesson in lessons:
        is_current = lesson is current
        current_attr = ' aria-current="page"' if is_current else ""
        code = f"<small>LC {lesson.leetcode}</small>" if lesson.leetcode else ""
        items.append(
            f'<li data-course-lesson="{lesson.number}"><a href="./{lesson.slug}.html"{current_attr}>'
            f'<span class="course-outline-number">{lesson.number}</span>'
            f'<span class="course-outline-name">{html_mod.escape(lesson.name)}</span>{code}</a></li>'
        )
    return "\n".join(items)


def _nav_card(lesson: Optional[Lesson], label: str, modifier: str) -> str:
    if lesson is None:
        return '<div class="course-nav-link course-nav-link-placeholder" aria-hidden="true"></div>'
    next_attr = " data-course-next" if modifier == "course-nav-link-next" else ""
    return (
        f'<a href="./{lesson.slug}.html" class="course-nav-link {modifier}" rel="{"next" if next_attr else "prev"}"{next_attr}>'
        f'<span class="course-nav-label">{label}</span>'
        f'<span class="course-nav-title">{lesson.number}. {html_mod.escape(lesson.name)}</span>'
        "</a>"
    )


def _lesson_structured_data(lesson: Lesson, total: int) -> str:
    video = lesson.video
    resource = {
        "@type": "LearningResource",
        "@id": f"{lesson.url}#lesson",
        "name": lesson.seo_title,
        "description": lesson.meta_description,
        "url": lesson.url,
        "learningResourceType": "Video lesson",
        "inLanguage": "en",
        "isAccessibleForFree": True,
        "teaches": lesson.topic.name,
        "position": lesson.number,
        "thumbnailUrl": f"https://i.ytimg.com/vi/{video.video_id}/hqdefault.jpg",
        "author": AUTHOR,
        "isPartOf": {
            "@type": "Course",
            "name": COURSE_TITLE,
            "url": COURSE_URL,
            "numberOfLessons": total,
        },
    }
    if video.duration:
        resource["timeRequired"] = _iso_duration(video.duration)
    if video.upload_date:
        resource["video"] = {
            "@type": "VideoObject",
            "name": video.title,
            "description": lesson.meta_description,
            "thumbnailUrl": f"https://i.ytimg.com/vi/{video.video_id}/hqdefault.jpg",
            "uploadDate": video.upload_date,
            "embedUrl": f"https://www.youtube-nocookie.com/embed/{video.video_id}",
            "contentUrl": f"https://www.youtube.com/watch?v={video.video_id}",
        }
        if video.duration:
            resource["video"]["duration"] = _iso_duration(video.duration)
    breadcrumbs = {
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Courses",
                "item": COURSES_URL,
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": COURSE_TITLE,
                "item": COURSE_URL,
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": lesson.name,
                "item": lesson.url,
            },
        ],
    }
    return _json_ld(
        {"@context": "https://schema.org", "@graph": [breadcrumbs, resource]}
    )


def _notes_html(lesson: Lesson, lessons: List[Lesson]) -> str:
    note = lesson.note
    parts = []
    if note:
        complexity_label, complexity_href = COMPLEXITY_ARTICLE
        complexity_link = _resolve_link(complexity_href)
        complexity_more = (
            f' New to Big-O? Read <a href="{complexity_link}">{complexity_label.lower()}</a>.'
            if complexity_link
            else ""
        )
        parts.append(
            f"""
            <div class="course-notes">
                <h2 id="notes-title">Lesson notes</h2>
                <div class="course-note course-note-try">
                    <h3>Try it before you watch</h3>
                    <p>Restate the problem in your own words, list the edge cases, and sketch a solution with its running time. Then play the video and compare.</p>
                </div>
                <details class="course-note course-note-idea">
                    <summary>Reveal the key idea</summary>
                    <p>{html_mod.escape(note.idea)}</p>
                    <p class="course-note-pattern"><strong>Pattern:</strong> {html_mod.escape(lesson.topic.name)}. {html_mod.escape(lesson.topic.blurb)}</p>
                </details>
                <div class="course-complexity">
                    <h3>Complexity</h3>
                    <table>
                        <caption>Cost of the standard optimal approach for {html_mod.escape(lesson.name)}</caption>
                        <thead><tr><th scope="col">Measure</th><th scope="col">Bound</th></tr></thead>
                        <tbody>
                            <tr><th scope="row">Time</th><td>{html_mod.escape(note.time)}</td></tr>
                            <tr><th scope="row">Extra space</th><td>{html_mod.escape(note.space)}</td></tr>
                        </tbody>
                    </table>
                    <p class="course-note-small">Walkthroughs often start from a simpler approach first; aim to reach these bounds.{complexity_more}</p>
                </div>
            </div>"""
        )

    links = _related_links(lesson)
    if lesson.leetcode_url:
        links.append(
            (
                "Practice",
                f"Solve LeetCode {lesson.leetcode} yourself",
                lesson.leetcode_url,
            )
        )
    if links:
        items = []
        for kind, label, href in links:
            external = href.startswith("http")
            target = ' target="_blank" rel="noopener"' if external else ""
            arrow = ' <span aria-hidden="true">↗</span>' if external else ""
            items.append(
                f'<li><a href="{html_mod.escape(href)}"{target}><span class="course-resource-kind">{kind}</span>'
                f'<span class="course-resource-title">{html_mod.escape(label)}{arrow}</span></a></li>'
            )
        parts.append(
            f"""
            <div class="course-resources">
                <h2 id="resources-title">Keep learning</h2>
                <ul class="course-resource-list">
                    {"".join(items)}
                </ul>
            </div>"""
        )

    same_topic = [
        other
        for other in lessons
        if other.topic_key == lesson.topic_key and other is not lesson
    ]
    if same_topic:
        later = [other for other in same_topic if other.number > lesson.number]
        picks = (later + [o for o in same_topic if o not in later])[:4]
        cards = "".join(
            f'<li><a href="./{other.slug}.html"><span class="course-outline-number">{other.number}</span>'
            f"<span>{html_mod.escape(other.name)}</span></a></li>"
            for other in picks
        )
        parts.append(
            f"""
            <div class="course-more">
                <h2 id="more-title">More {html_mod.escape(lesson.topic.name.lower())} practice</h2>
                <ul class="course-more-list">{cards}</ul>
            </div>"""
        )
    return "\n".join(parts)


def build_lesson_pages(lessons: List[Lesson]) -> None:
    """Build all per-video lesson pages with correct prev/next links."""
    LESSONS_DIR.mkdir(parents=True, exist_ok=True)
    expected = {f"{lesson.slug}.html" for lesson in lessons}
    for stale in LESSONS_DIR.glob("*.html"):
        if stale.name not in expected:
            logging.info("  removing stale lesson %s", stale.name)
            stale.unlink()

    total = len(lessons)
    for i, lesson in enumerate(lessons):
        video = lesson.video
        prev_lesson = lessons[i - 1] if i > 0 else None
        next_lesson = lessons[i + 1] if i < total - 1 else None
        safe_name = html_mod.escape(lesson.name)
        safe_video_title = html_mod.escape(video.title)
        summary = (
            lesson.note.problem
            if lesson.note
            else "Python video walkthrough from the course playlist."
        )
        meta_bits = [
            f'<span class="course-page-badge">{html_mod.escape(lesson.topic.name)}</span>'
        ]
        if lesson.leetcode:
            meta_bits.append(
                f'<span class="course-meta-chip">LeetCode {lesson.leetcode}</span>'
            )
        if video.duration:
            meta_bits.append(
                f'<span class="course-meta-chip">{_minutes(video.duration)} video</span>'
            )
        description_html = _format_description(video.description)
        description_section = (
            f"""
            <div class="video-description course-lesson-description">
                <h2 id="description-title">From the video description</h2>
{description_html}
            </div>"""
            if description_html
            else ""
        )

        page = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5593122079896089" crossorigin="anonymous"></script>
    <meta charset="utf-8">
    <title>{html_mod.escape(lesson.seo_title)}</title>
    <meta name="description" content="{html_mod.escape(lesson.meta_description)}">
    <meta name="author" content="Adam Djellouli">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=optional">
    <link rel="icon" href="/favicon.ico">
    <link rel="stylesheet" href="{RESOURCE_PREFIX}resources/style.css">
    <link rel="preload" as="image" href="https://i.ytimg.com/vi/{video.video_id}/hqdefault.jpg">
    <link rel="canonical" href="{lesson.url}">
    <script id="course-structured-data" type="application/ld+json">
{_lesson_structured_data(lesson, total)}
    </script>
</head>
<body class="course-lesson-page" data-course-page="lesson" data-lesson-number="{lesson.number}" data-lesson-total="{total}">
    <div id="article-wrapper" class="course-lesson-layout">
        <article id="article-body" class="course-lesson-main">
            <div class="course-breadcrumbs" role="navigation" aria-label="Breadcrumb">
                <ol>
                    <li><a href="/core/courses.html">Courses</a></li>
                    <li><a href="../index.html">Algorithms &amp; Data Structures</a></li>
                    <li><span aria-current="page">Lesson {lesson.number}</span></li>
                </ol>
            </div>
            <div class="course-lesson-meta">
                <div class="course-lesson-chips">{"".join(meta_bits)}</div>
                <p class="course-lesson-number">Lesson {lesson.number} of {total}</p>
            </div>
            <h1>{safe_name}</h1>
            <p class="course-lesson-summary">{html_mod.escape(summary)}</p>
            <div class="video-container course-lesson-video">
                <button type="button" class="video-facade" data-video-id="{video.video_id}" data-video-title="{safe_video_title}" aria-label="Play video: {safe_video_title}">
                    <img src="https://i.ytimg.com/vi/{video.video_id}/hqdefault.jpg" alt="" width="480" height="360" decoding="async" fetchpriority="high">
                    <span class="video-facade__play" aria-hidden="true"></span>
                </button>
            </div>
            <div class="course-watch-actions">
                <button type="button" class="course-complete-button" data-course-complete="{lesson.number}" aria-pressed="false">
                    <span data-complete-label>Mark lesson complete</span>
                </button>
                <a href="https://www.youtube.com/watch?v={video.video_id}" target="_blank" rel="noopener" class="course-youtube-button">Watch on YouTube <span aria-hidden="true">↗</span></a>
            </div>
            <p class="course-storage-note" data-course-storage-note hidden>Progress cannot be saved in this browser, so completed lessons will reset when you leave.</p>
{_notes_html(lesson, lessons)}
{description_section}
            <div class="course-lesson-nav" role="navigation" aria-label="Lesson navigation">
                {_nav_card(prev_lesson, "Previous lesson", "course-nav-link-prev")}
                <a href="../index.html" class="course-nav-link course-nav-link-center">
                    <span class="course-nav-label">All lessons</span>
                    <span class="course-nav-title">Back to course overview</span>
                </a>
                {_nav_card(next_lesson, "Next lesson", "course-nav-link-next")}
            </div>
        </article>
        <aside id="article-sidebar" class="course-lesson-sidebar" aria-label="Course outline">
            <div class="course-sidebar-progress">
                <span class="course-eyebrow">Your progress</span>
                <strong><span data-course-completed-count>0</span> of {total} lessons complete</strong>
                <div class="course-progress-track" role="img" aria-label="Course progress"><span data-course-progress-bar></span></div>
                <a href="../index.html">Course overview</a>
            </div>
            <details class="course-outline" open>
                <summary>Course outline <span>{total} lessons</span></summary>
                <ol data-course-outline>
{_outline_html(lessons, lesson)}
                </ol>
            </details>
        </aside>
    </div>
    <script src="../course.js"></script>
</body>
</html>
"""
        (LESSONS_DIR / f"{lesson.slug}.html").write_text(page, encoding="utf-8")
    logging.info("Wrote %d lesson pages.", total)


def _course_structured_data(lessons: List[Lesson]) -> str:
    topics = list(dict.fromkeys(lesson.topic.name for lesson in lessons))
    data = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Course",
                "@id": f"{COURSE_URL}#course",
                "name": COURSE_TITLE,
                "description": COURSE_DESCRIPTION,
                "url": COURSE_URL,
                "provider": AUTHOR,
                "author": AUTHOR,
                "inLanguage": "en",
                "isAccessibleForFree": True,
                "educationalLevel": "Intermediate",
                "teaches": topics,
                "numberOfLessons": len(lessons),
                "hasCourseInstance": {
                    "@type": "CourseInstance",
                    "courseMode": "Online",
                    "courseWorkload": f"{len(lessons)} video lessons, self-paced",
                },
                "offers": {
                    "@type": "Offer",
                    "price": 0,
                    "priceCurrency": "USD",
                    "category": "Free",
                },
            },
            {
                "@type": "ItemList",
                "name": f"{COURSE_TITLE} lessons",
                "numberOfItems": len(lessons),
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": lesson.number,
                        "name": lesson.name,
                        "url": lesson.url,
                    }
                    for lesson in lessons
                ],
            },
        ],
    }
    return _json_ld(data)


def update_course_page(lessons: List[Lesson]) -> None:
    """Build a navigable, searchable course overview between marker comments."""
    if not COURSE_PAGE.exists():
        logging.warning("Course page not found: %s", COURSE_PAGE)
        return

    html = COURSE_PAGE.read_text(encoding="utf-8")
    total = len(lessons)
    cards = []
    for lesson in lessons:
        video = lesson.video
        safe_name = html_mod.escape(lesson.name)
        summary = (
            lesson.note.problem
            if lesson.note
            else "Step-by-step Python solution with the core pattern and complexity explained."
        )
        search_text = " ".join(
            filter(
                None,
                [
                    lesson.name,
                    video.title,
                    str(lesson.leetcode or ""),
                    lesson.topic.name,
                    summary,
                ],
            )
        ).lower()
        extra_attrs = ""
        if video.duration:
            extra_attrs += f' data-duration="{video.duration}"'
        if video.upload_date:
            extra_attrs += f' data-upload-date="{video.upload_date}"'
        complexity = (
            f'<span class="course-card-complexity" title="Time complexity of the standard solution">{html_mod.escape(lesson.note.time)}</span>'
            if lesson.note
            else ""
        )
        code = (
            f'<span class="course-card-code">LeetCode {lesson.leetcode}</span>'
            if lesson.leetcode
            else ""
        )
        cards.append(
            f"""            <article class="tool-card course-lesson-card" data-course-card data-topic="{lesson.topic_key}" data-lesson-number="{lesson.number}" data-video-id="{video.video_id}" data-video-title="{html_mod.escape(video.title)}" data-search="{html_mod.escape(search_text)}"{extra_attrs}>
                <a href="./lessons/{lesson.slug}.html" class="course-card-main">
                    <div class="course-lesson-card-media">
                        <img src="https://i.ytimg.com/vi/{video.video_id}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async" class="course-lesson-card-thumb">
                        <span class="course-lesson-card-index" aria-hidden="true">{lesson.number}</span>
                        <span class="course-card-status" data-course-card-status>Not started</span>
                    </div>
                    <div class="course-lesson-card-content">
                        <span class="course-topic-label">{html_mod.escape(lesson.topic.name)}</span>
                        <h3><span class="course-visually-hidden">Lesson {lesson.number}: </span>{safe_name}</h3>
                        <p>{html_mod.escape(summary)}</p>
                        <div class="course-card-facts">{code}{complexity}</div>
                    </div>
                </a>
            </article>"""
        )

    topic_counts: Dict[str, int] = {}
    for lesson in lessons:
        topic_counts[lesson.topic_key] = topic_counts.get(lesson.topic_key, 0) + 1
    ordered_topics = [key for key in TOPICS if key in topic_counts]
    topic_filters = "".join(
        f'<button type="button" class="course-filter" data-course-filter="{key}">{html_mod.escape(TOPICS[key].name)} <span>{topic_counts[key]}</span></button>'
        for key in ordered_topics
    )
    first = lessons[0]

    lessons_html = f"""
            <div class="course-overview-card" data-course-page="overview" data-lesson-total="{total}">
                <div class="course-overview-copy">
                    <span class="course-page-badge">Free video course · Python</span>
                    <h2>Build the patterns behind coding interviews</h2>
                    <p>{COURSE_DESCRIPTION} Every lesson pairs a video walkthrough with notes, the target complexity, and links to deeper articles.</p>
                    <div class="course-overview-actions">
                        <a href="./lessons/{first.slug}.html" class="course-start-button" data-course-continue>Start lesson 1 <span aria-hidden="true">→</span></a>
                        <a href="{PLAYLIST_URL}" class="course-playlist-link" target="_blank" rel="noopener">YouTube playlist <span aria-hidden="true">↗</span></a>
                    </div>
                    <p class="course-storage-note" data-course-storage-note hidden>Progress cannot be saved in this browser, so it will reset when you leave.</p>
                </div>
                <div class="course-overview-stats">
                    <div class="course-stat-card"><span class="course-stat-value"><span data-course-completed-count>0</span> / {total}</span><span class="course-stat-label">Lessons complete</span></div>
                    <div class="course-stat-card"><span class="course-stat-value">{len(ordered_topics)}</span><span class="course-stat-label">Problem-solving patterns</span></div>
                    <div class="course-stat-card"><span class="course-stat-value">Free</span><span class="course-stat-label">Self-paced, no sign-up</span></div>
                    <div class="course-progress-track" role="img" aria-label="Course progress"><span data-course-progress-bar></span></div>
                    <button type="button" class="course-reset-button" data-course-reset hidden>Reset progress</button>
                </div>
            </div>
            <section class="course-how" aria-labelledby="course-how-title">
                <div class="course-section-heading"><span class="course-page-badge">A clear routine</span><h2 id="course-how-title">How to use this course</h2></div>
                <div class="course-how-grid">
                    <div><span>01</span><h3>Read the problem</h3><p>Each lesson opens with the task in one sentence. Sketch a solution and estimate its complexity first.</p></div>
                    <div><span>02</span><h3>Watch the walkthrough</h3><p>The video loads when you press play. Reveal the key idea in the notes if you get stuck.</p></div>
                    <div><span>03</span><h3>Compare and mark done</h3><p>Check the complexity table, follow a related article, and mark the lesson complete to resume later.</p></div>
                </div>
            </section>
            <section class="course-curriculum" aria-labelledby="curriculum-title">
                <div class="course-section-heading"><span class="course-page-badge">Curriculum</span><h2 id="curriculum-title">Choose your next problem</h2><p>Start at lesson 1 for the full path, or filter by the pattern you want to practise.</p></div>
                <div class="course-discovery" role="search"><label for="course-search">Find a lesson</label><div class="course-search-wrap"><span aria-hidden="true">⌕</span><input id="course-search" type="search" placeholder="Search by problem, pattern or LeetCode number…" autocomplete="off"></div></div>
                <div class="course-filters" role="group" aria-label="Filter lessons by pattern"><button type="button" class="course-filter is-active" data-course-filter="all">All lessons <span>{total}</span></button>{topic_filters}</div>
                <p class="course-results" aria-live="polite"><strong data-course-result-count>{total}</strong> lessons shown</p>
            </section>
            <div class="tools-grid course-lessons-grid" data-course-grid>
{chr(10).join(cards)}
            </div>
            <div class="course-empty" data-course-empty hidden>
                <h3>No lessons found</h3>
                <p>Try a different problem name, number, or pattern.</p>
            </div>
            <aside class="course-channel-card">
                <div><span class="course-page-badge">Learn with Adam</span><h2>Prefer learning directly on YouTube?</h2><p>Open the complete playlist or visit the channel for more programming walkthroughs.</p></div>
                <div class="course-overview-actions"><a href="{PLAYLIST_URL}" target="_blank" rel="noopener" class="course-youtube-primary">Play the full playlist <span aria-hidden="true">▶</span></a><a href="{CHANNEL_URL}" target="_blank" rel="noopener" class="course-channel-link">Visit my channel <span aria-hidden="true">↗</span></a></div>
            </aside>
            <script src="./course.js"></script>
"""
    html = re.sub(
        r"<!-- LESSONS:START -->.*?<!-- LESSONS:END -->",
        lambda _: f"<!-- LESSONS:START -->{lessons_html}            <!-- LESSONS:END -->",
        html,
        flags=re.S,
    )

    title = f"Algorithms & Data Structures Course: {total} LeetCode Problems in Python"
    description = _shorten(
        f"Free video course with {total} LeetCode problems solved in Python and grouped "
        f"into {len(ordered_topics)} patterns: hashing, two pointers, trees, graphs, "
        "dynamic programming and more, with notes and progress tracking.",
        160,
    )
    html = re.sub(
        r"<title>.*?</title>",
        lambda _: f"<title>{html_mod.escape(title)}</title>",
        html,
        count=1,
        flags=re.S,
    )
    html = re.sub(
        r'<meta\s+(?:name="description"\s+content="[^"]*"|content="[^"]*"\s+name="description")\s*/?>',
        lambda _: f'<meta name="description" content="{html_mod.escape(description)}">',
        html,
        count=1,
    )
    schema = (
        '<script id="course-structured-data" type="application/ld+json">\n'
        f"{_course_structured_data(lessons)}\n    </script>"
    )
    schema_pattern = r'<script[^>]*id="course-structured-data"[^>]*>.*?</script>'
    if re.search(schema_pattern, html, flags=re.S):
        html = re.sub(schema_pattern, lambda _: schema, html, count=1, flags=re.S)
    else:
        html = html.replace("</head>", f"    {schema}\n</head>", 1)

    COURSE_PAGE.write_text(html, encoding="utf-8")
    logging.info("Updated course index with %d lesson cards.", total)


def main() -> None:
    try:
        videos = fetch_playlist()
    except (RuntimeError, FileNotFoundError, subprocess.TimeoutExpired) as exc:
        logging.warning("YouTube fetch unavailable (%s); using existing metadata.", exc)
        videos = load_existing_playlist()

    if not videos:
        logging.warning("Playlist returned 0 videos – skipping.")
        return

    lessons = build_lessons(videos)
    build_lesson_pages(lessons)
    update_course_page(lessons)
    logging.info("Done – %d lessons generated.", len(lessons))


if __name__ == "__main__":
    main()
