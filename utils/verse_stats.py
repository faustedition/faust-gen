#!/usr/bin/env python3

"""
Extracts per-verse information from the edition and writes it to a CSV file.

This script creates a CSV file with a row for each 'line' of the edition. A 'line' is, essentially,
anything that may have an apparatus:  A verse, a part of an antilabial verse, a stage direction,
a speaker name etc. The CSV file contains the number of variants and witnesses (from the text view),
the number of relevant paralipomena (from the genetic bargraph) and a few data directly extracted from
the TEI file. See the source code of the class Verse for details.

"""
from __future__ import annotations

from functools import lru_cache

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
from rich.progress import track
from textdistance import NeedlemanWunsch
from string import punctuation
from functools import lru_cache

_ns = {'tei': 'http://www.tei-c.org/ns/1.0',
       'xh': 'http://www.w3.org/1999/xhtml'}


@dataclass
class Verse:
    """Represents a single line. Directly maps to the CSV file."""
    n: str  # line id (source: @n). 1-12111 for verses, something like before_1178_b for paratext.
    variants: int  # number of variants for this line.
    witnesses: int  # number of witnesses that have this line.
    manuscripts: int # number of manuscripts that have this line.
    paralipomena: int  # number of witnesses with paralipomena that are related to this line (only for verses!)
    paralipomena_uncertain: int  # ditto, but uncertain relationship
    speaker: Optional[str]  # speaker of the line, if inside a speech act (tei:sp/tei:speaker)
    element: str  # local name of the TEI element representing the line (e.g., l or stage)
    is_text: bool  # True iff it’s main text
    section: str  # innermost section number (e.g., 2.3.1 for Faust II, 3rd act, first scene)
    lg: str  # if line is inside <lg>, n of the respective lg’s first verse
    variance: float # how different are text and first variant
    text: str  # plain text contents of the line
    first_variant: str # plain text contents of the first variant from the variant app (emended version)

@lru_cache
def _punct_is_similar(a, b):
    if a == b:
        return True
    elif a in punctuation and b in punctuation:
        return 0.8
    elif a in punctuation or b in punctuation:
        return 0.5
    else:
        return False

needleman_wunsch = NeedlemanWunsch(sim_func=_punct_is_similar)

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

    def _parse_tree(self, location: str) -> etree._ElementTree:
        if self.from_web:
            return etree.parse(self.edition + location)
        else:
            return etree.parse(fspath(self.edition / location))

    def load(self):
        self.html = self._parse_tree(self.html_location)
        self.tei = self._parse_tree(self.xml_location)

        if self.from_web:
            with urlopen(self.edition + self.bargraph_location) as response:
                self.bargraph = parse_bargraph_info(json.load(response))
        else:
            with (self.edition / self.bargraph_location).open() as f:
                self.bargraph = parse_bargraph_info(json.load(f))

        # remove critical apparatus from TEI version
        for note in self.tei.xpath('//tei:note[@type="textcrit"]', namespaces=_ns):
            note.getparent().remove(note)

        # build HTML cache for speedup
        html_lines: dict[str, etree._Element] = {}
        for el in self.html.xpath('//*[@data-n]', namespaces=_ns):
            n = el.get('data-n')
            if n not in html_lines:
                html_lines[n] = el
        self.html_lines = html_lines

        self.loaded = True


    @lru_cache(10)
    def _load_vargroup(self, vargroup):
        """Loads a vargroup (= HTML file with variants for ~10 verses) and cleans it."""
        vg = self._parse_tree(f'print/variants/{vargroup}.html')
        remove_elements(vg, '//xh:span[@class="sigils"]')  # visual display of sigils with that variant
        remove_elements(vg, '//xh:div[contains(@class, "variant-lines")]')  # lines with inline apparatus
        remove_elements(vg, '//comment()')
        return vg

    def get_variants(self, n) -> etree._Element:
        """loads the variants HTML for a given n. Returns the parent div."""
        ref_element = self.html_lines[n]
        vargroup = ref_element.get('data-vargroup')
        variants_html = self._load_vargroup(vargroup)
        return variants_html.xpath(f'//xh:div[@class="variants"][@data-n="{n}"]', namespaces=_ns)[0]

    def lines(self):
        if not self.loaded:
            self.load()
        for el_t in self.tei.xpath('//*[@n][not(self::tei:div)]', namespaces=_ns):
            n = el_t.get('n')
            n_h = n[:-1] if n[-1] in 'imf' and n[-2] != '_' else n       # antilabial n's are contracted in html
            el_h = self.html_lines[n_h] #self.html.xpath(f'//*[@data-n="{n_h}"]', namespaces=_ns)[0]
            variants = int(el_h.get('data-variants'))
            witnesses = int(el_h.get('data-varcount'))
            speaker = normalize_space(''.join(el_t.xpath('ancestor::tei:sp//tei:speaker//text()', namespaces=_ns)))
            variants_html = self.get_variants(n_h)
            first_variant = normalize_space(variants_html[0])
            text = normalize_space(''.join(el_t.xpath('.//text()', namespaces=_ns)))
            variance = needleman_wunsch(first_variant, text)
            v = Verse(n, variants, witnesses,
                      manuscripts=len(self.bargraph[n]['ms_verseLine']),
                      paralipomena=len(self.bargraph[n]['paralipomena']),
                      paralipomena_uncertain=len(self.bargraph[n]['paralipomena_uncertain']),
                      speaker=speaker,
                      element=el_t.tag.split('}')[-1],
                      text=text,
                      is_text=n.isnumeric() or n.startswith('ttf_'),
                      lg=first(el_t.xpath('ancestor::tei:lg[1]/tei:l[@n][1]/@n', namespaces=_ns)),
                      section=first(el_t.xpath('ancestor::tei:div[1]/@n', namespaces=_ns)),
                      variance=variance,
                      first_variant=first_variant)
            yield v


def first(it: Iterable, default=None):
    try:
        return next(iter(it))
    except StopIteration:
        return default


def normalize_space(s: str | etree._Element, ignore_missing=True):
    if ignore_missing and s is None:
        return None
    if isinstance(s, etree._Element):
        s = ''.join(s.itertext())
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
        is_print = doc['print']
        for interval in doc['intervals']:
            kind = interval['type']
            for n in range(interval['start'], interval['end'] + 1):
                verses[str(n)][kind].add(sigil)
                if not is_print:
                    verses[str(n)]['ms_' + kind].add(sigil)

    return verses

def remove_elements(tree: etree._Element, xpath: str, namespaces=_ns):
    for el in tree.xpath(xpath, namespaces=namespaces):
        el.getparent().remove(el)

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
        for verse in track(vs.lines(), total=15200, description='Analyzing'):
            writer.writerow(asdict(verse))
    finally:
        if output_file != sys.stdout:
            output_file.close()


if __name__ == '__main__':
    main()
