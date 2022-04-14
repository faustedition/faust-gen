#!/usr/bin/env python3


from __future__ import annotations

import csv
import gzip
import json
import sys
from argparse import ArgumentParser
from collections import defaultdict
from dataclasses import dataclass, fields, asdict
from os import fspath
from pathlib import Path
from typing import Optional, Iterable
from urllib.request import urlopen

from lxml import etree
from tqdm import tqdm

_ns = {'tei': 'http://www.tei-c.org/ns/1.0',
       'xh': 'http://www.w3.org/1999/html'}


def first(it: Iterable, default=None):
    try:
        return next(iter(it))
    except StopIteration:
        return default


def normalize_space(s: str, ignore_missing=True):
    if ignore_missing and s is None:
        return None
    return " ".join(s.split())


def parse_bargraph_info(data) -> dict[int, dict[str, set[str]]]:
    """
    Reads and reorders the bargraph json.

    Parameters
    ----------
    fn: Path to the bargraph json file

    Returns
    -------
    Dictionary verse no -> type -> set of sigils

    """
    verses = defaultdict(lambda: defaultdict(set))
    for doc in data:
        sigil = doc['sigil']
        for interval in doc['intervals']:
            kind = interval['type']
            for n in range(interval['start'], interval['end'] + 1):
                verses[str(n)][kind].add(sigil)

    return verses


@dataclass
class Verse:
    """Represents a single line. Directly maps to the CSV file."""
    n: str  # line id (source: @n). 1-12111 for verses, something like before_1178_b for paratext.
    variants: int  # number of variants for this line.
    witnesses: int  # number of witnesses that have this line.
    paralipomena: int  # number of witnesses with paralipomena that are related to this line (only for verses!)
    paralipomena_uncertain: int  # ditto, but uncertain relationship
    speaker: Optional[str]  # speaker of the line, if inside a speech act (tei:sp/tei:speaker)
    element: str  # local name of the TEI element representing the line (e.g., l or stage)
    is_text: bool  # True iff it’s main text
    section: str  # innermost section number (e.g., 2.3.1 for Faust II, 3rd act, first scene)
    lg: str  # if line is inside <lg>, n of the respective lg’s first verse
    text: str  # plain text contents of the line


class VerseStats:
    DEFAULT_URL = "http://faustedition.net/"
    loaded = False
    html_location = 'print/faust.all.html'
    bargraph_location = 'data/genetic_bar_graph.json'
    xml_location = 'downloads/faust.xml'

    def __init__(self, edition: Optional[str]):

        if edition is None:
            # try to find build dir
            build_dir: Path = Path(sys.argv[0]).resolve().parent.parent / "build/www"
            if build_dir.is_dir():
                self.edition = build_dir
                self.from_web = False
            else:
                self.edition = self.DEFAULT_URL
                self.from_web = True
        elif Path(edition).is_dir():
            self.edition = Path(edition)
            self.from_web = False
        else:
            if edition[-1] != '/':
                edition += '/'
            self.edition = edition
            self.from_web = True

    def load(self):
        if self.from_web:
            self.html = etree.parse(self.edition + self.html_location)
            self.tei = etree.parse(self.edition + self.xml_location)
            with urlopen(self.edition + self.bargraph_location) as response:
                self.bargraph = parse_bargraph_info(json.load(response))
        else:
            self.html = etree.parse(fspath(self.edition / self.html_location))
            self.tei = etree.parse(fspath(self.edition / self.xml_location))
            with (self.edition / self.bargraph_location).open() as f:
                self.bargraph = parse_bargraph_info(json.load(f))
        self.loaded = True

    def lines(self):
        if not self.loaded:
            self.load()
        for el_h in self.html.xpath('//*[@data-varcount]', namespaces=_ns):
            n = el_h.get('data-n')
            el_t = self.tei.xpath(f'//*[@n="{n}"]', namespaces=_ns)[0]
            variants = int(el_h.get('data-variants'))
            witnesses = int(el_h.get('data-varcount'))
            speaker = normalize_space(
                    first(el_t.xpath('ancestor::tei:sp//tei:speaker/text()', namespaces=_ns), default=None))
            v = Verse(n, variants, witnesses,
                      paralipomena=len(self.bargraph[n]['paralipomena']),
                      paralipomena_uncertain=len(self.bargraph[n]['paralipomena_uncertain']),
                      speaker=speaker,
                      element=el_t.tag.split('}')[-1],
                      text=normalize_space(''.join(el_t.xpath('.//text()[not(ancestor::tei:note)]', namespaces=_ns))),
                      is_text=n.isnumeric() or n.startswith('ttf_'),
                      lg=first(el_t.xpath('ancestor::tei:lg[1]/tei:l[@n][1]/@n', namespaces=_ns)),
                      section=first(el_t.xpath('ancestor::tei:div[1]/@n', namespaces=_ns))
                      )
            yield v


def getargparser():
    p = ArgumentParser(description=__doc__)
    p.add_argument('edition', nargs='?',
                   help='URL or path to the edition. If missing, try to find the build dir and fall back to the released edition.')
    p.add_argument('-o', '--output', type=Path,
                   help='output file (csv or csv.gz). if missing, write to stdout.')
    return p


def main():
    options = getargparser().parse_args()
    vs = VerseStats(options.edition)
    print(f'Loading from {vs.edition} ...')
    vs.load()

    if options.output:
        if '.gz' in options.output.suffixes:
            output_file = gzip.open(options.output, 'wt')
        else:
            output_file = open(options.output, 'wt')
    else:
        output_file = sys.stdout
    try:
        writer = csv.DictWriter(output_file, list(field.name for field in fields(Verse)))
        writer.writeheader()
        for verse in tqdm(vs.lines(), total=15200, desc='Analyzing'):
            writer.writerow(asdict(verse))
    finally:
        if output_file != sys.stdout:
            output_file.close()


if __name__ == '__main__':
    main()
