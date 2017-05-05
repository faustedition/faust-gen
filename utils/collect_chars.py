#!/usr/bin/env python3

from lxml import etree, html
from collections import Counter, defaultdict, OrderedDict
from ftfy import fix_text
import unicodedata
import json
import gzip
import os
import sys
from tqdm import tqdm
from multiprocessing import Pool

def count_in_file(filename):
    try:
        tree = etree.parse(filename)
    except etree.XMLSyntaxError:
        tree = html.parse(filename)

    return Counter("".join(fix_text(node, fix_latin_ligatures=False,
                                    fix_character_width=False,
                                    uncurl_quotes=False)
                           for node in tree.xpath('//text()')))


def files_by_ext(path, accept=['.html', '.xml', '.svg', '.php']):
    for dirpath, dirnames, filenames in os.walk(path):
        for filename in filenames:
            __, ext = os.path.splitext(filename)
            if ext in accept:
                yield os.path.join(dirpath, filename)


def collect_stats(path, accept=['.html', '.xml', '.svg', '.php']):
    """
    Returns an iterable filename → Counter(char → count)
    """

    with Pool() as pool:
        files = list(files_by_ext(path, accept))
        counts = pool.imap(count_in_file, files)
        tuples = zip(files, counts)
        return dict(tqdm(tuples, unit=' files', total=len(files)))


def sum_values(counters):
    total = Counter()
    for counter in counters:
        total.update(counter)
    return total

def file_by_char(stats):
    result = defaultdict(Counter)
    for file, stat in stats.items():
        for char, count in stat.items():
            result[char][file] = count
    return result

def ordered_by_char(bychar, totals):
    result = OrderedDict()
    for char, __ in reversed(totals.most_common()):
        result[char] = OrderedDict(bychar[char].most_common())
    return result

def format_item(char, count=''):
    """
    Formats the given character & count to an info line, tab separated, with the following fields:

    - hexadecimal representation of the codepoint
    - the character itself if its not a control character
    - the count
    - the character's unicode name
    """
    return "{:0>4X}\t{}\t{}\t{}\n".format(
        ord(char),
        char if char >= ' ' else '',
        count,
        unicodedata.name(char, ''))

def intervals(iterable):
    """
    Sorts the iterable and calculates continuous intervals.mro

    Args:
        iterable:
            An iterable of integers (or anything else that supports +1 and <)

    Yields:
        (start, stop) tuples, start and stop are inclusive.

    Example:
        >>> list(intervals([20,7,25,1,2,3,4,6,12,13,14,15,5,5]))
        [(1, 7), (12, 15), (20, 20), (25, 25)]
    """
    ordered = sorted(iterable)
    if not(ordered):
        return
    start = ordered[0]
    stop  = start
    for item in ordered[1:]:
        if stop+1 < item:
            yield (start, stop)
            start = item
            stop = start
        else:
            stop = item
    yield (start, stop)

def _main(args):
    stats = collect_stats(args[1])
    totals = sum_values(stats.values())

    with open("char_stats.tsv", "w", encoding="UTF-8") as statfile:
        statfile.writelines(format_item(char, count)
                            for char, count in totals.most_common())

    with open("ranges.txt", "w", encoding="UTF-8") as ranges:
        intervs = intervals(map(ord, totals.keys()))
        formatted = ("{:0>4X}-{:0>4X}".format(*i) for i in intervs)
        ranges.write(",\n".join(formatted) + "\n")

    with gzip.open("by_char.json.gz", "wt", encoding="utf-8") as f:
        json.dump(ordered_by_char(file_by_char(stats), totals), f, indent=2,
                  ensure_ascii=False)

if __name__ == "__main__":
    _main(sys.argv)
