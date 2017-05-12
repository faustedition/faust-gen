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
from subprocess import check_output
import pandas as pd
import argparse
import re

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


def font_support_table(fontfile: str) -> pd.DataFrame:
    """
    Runs otfinfo -u on the fontfile to get a table describing the fonts' char support
    """
    def charinfo(line):
        codepoint_str, glyphno, glyphname = line.split()
        codepoint = int(codepoint_str[3:], base=16)
        return "{:>04X}".format(codepoint), chr(codepoint), glyphno, glyphname
    otfinfo = check_output(['otfinfo', '-u', fontfile], universal_newlines=True)
    return pd.DataFrame.from_records(
        data=[charinfo(line) for line in otfinfo.split('\n') if line],
        columns=['codepoint', 'char', 'glyphno', 'glyphname'],
        index='codepoint')

def font_support(fontfile: str) -> pd.Series:
    result = font_support_table(fontfile).glyphname
    font_info = check_output(['otfinfo', '-i', fontfile], universal_newlines=True)
    font_name = re.search(r'^Full name:\s*(.*)$', font_info, re.MULTILINE)
    if font_name is None:
        result.name = os.path.splitext(os.path.basename(fontfile))[0]
    else:
        result.name = font_name.group(1)
    return result

def _main_old(args):
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

def getargparser():
    p = argparse.ArgumentParser(description="Analyze font usage",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument('-o', '--output', nargs='+', metavar='TSV', default=['char_stats.tsv'],
                   help='Write the character statistics table to this file')
    ana = p.add_argument_group(
        title='Collecting character groups',
        description="""
        If at least one -d option is given, the tool recursively parses all
        files with one of the extensions from the -a option and counts all
        characters it finds therein. The other options in this group create
        various representations of this statistic. """)
    ana.add_argument('-d', '--directory', nargs='+', metavar="DIR",
                   help="Analyze all XML/HTML files in this directory")
    ana.add_argument('-a', '--accept', nargs='+', default=['.html', '.xml', '.svg', '.php'],
                   help='File extensions to accept')
    ana.add_argument('-r', '--ranges',
                   help='write a list of used character ranges to this file')
    ana.add_argument('-c', '--by-char',
                    help="""write a compressed JSON file that describes which
                     character occurs how often in which input file""")
    font = p.add_argument_group(
        title='Font analysis',
        description="""
        Uses otfinfo to analyze which characters each font supports and
        adds this info to the result table. The contents of the table cell
        is the glyph name in that font.

        Either uses the table created using -d, or reads one using -i.""")
    font.add_argument('-i', '--input-table',
                      help="Input TSV file to augment, format as written by -o")
    font.add_argument('-f', '--fonts', nargs='+',
                      help="Font files to analyze")
    font.add_argument('-k', '--keep-unused', action='store_true',
                      help='Keep unused characters in the table')
    return p

def main():
    parser = getargparser()
    options = parser.parse_args()
    summary = None
    if options.directory and options.input_table:
        parser.error("Cannot combine -d and -i. Use --help for more info.")
    if not(options.directory or options.input_table):
        parser.error("Either -d or -i is required. Use --help for more info.")

    if options.directory:
        # collect statistics
        stats = None
        for directory in options.directory:
            print("Collecting characters in {} ...".format(directory))
            dir_stat = collect_stats(directory, accept=options.accept)
            if stats is None:
                stats = dir_stat
            else:
                stats.update(dir_stat)

        print("Summarizing over all files ...")
        totals = sum_values(stats.values())

        if options.by_char:
            fn = options.by_char
            if ".json" not in fn: fn += ".json"
            if not fn.endswith('.gz'): fn += '.gz'
            print("Writing by-char statistics to {}...".format(fn))
            with gzip.open(fn, "wt", encoding="utf-8") as f:
                json.dump(ordered_by_char(file_by_char(stats), totals), f, indent=2,
                        ensure_ascii=False)

        if options.ranges:
            with open(options.ranges, "w", encoding="UTF-8") as ranges:
                intervs = intervals(map(ord, totals.keys()))
                formatted = ("{:0>4X}-{:0>4X}".format(*i) for i in intervs)
                ranges.write(",\n".join(formatted) + "\n")

        print("Preparing summary table ...")
        # now, prepare the support DF
        summary = pd.DataFrame.from_records((
            ("{:>04X}".format(ord(char)),
             char if char >= " " else "",
             unicodedata.name(char, None),
             count) for char, count in totals.items()),
            columns=['codepoint', 'character', 'name', 'count'],
            index='codepoint')

    if options.input_table:
        summary = pd.read_csv(options.input_table, sep='\t', index_col='codepoint')

    if options.fonts:
        for font in options.fonts:
            print("Analyzing font {} ...".format(font))
            support = font_support(font)
            summary.loc[:,support.name] = support

    if not(options.keep_unused):
        summary.dropna(subset=['count'], inplace=True)

    summary.sort_values(by='count', ascending=False, inplace=True)

    for output in options.output:
        print("Saving summary to {} ...".format(output))
        ext = os.path.splitext(output)[1]
        if ext == '.xls' or ext == '.xlsx':
            summary.to_excel(output)
        elif ext == '.html':
            summary.to_html(output)
        else:
            summary.to_csv(output, sep='\t', encoding='utf-8')


if __name__ == "__main__":
    main()
