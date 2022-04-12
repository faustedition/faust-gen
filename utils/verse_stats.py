from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict
from dataclasses import dataclass, fields, asdict
from typing import Optional, Iterable

from lxml import etree
from pathlib import Path
from os import fspath

from lxml.etree import tostring
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


def read_bargraph_info(fn: Path) -> dict[int, dict[str, set[str]]]:
    """
    Reads and reorders the bargraph json.

    Parameters
    ----------
    fn: Path to the bargraph json file

    Returns
    -------
    Dictionary verse no -> type -> set of sigils

    """
    with fn.open() as f:
        data = json.load(f)
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
    n: str                          # line id (source: @n). 1-12111 for verses, something like before_1178_b for paratext.
    variants: int                   # number of variants for this line.
    witnesses: int                  # number of witnesses that have this line.
    paralipomena: int               # number of witnesses with paralipomena that are related to this line (only for verses!)
    paralipomena_uncertain: int     # ditto, but uncertain relationship
    speaker: Optional[str]          # speaker of the line, if inside a speech act (tei:sp/tei:speaker)
    element: str                    # local name of the TEI element representing the line (e.g., l or stage)
    is_text: bool                   # True iff it’s main text
    section: str                    # innermost section number (e.g., 2.3.1 for Faust II, 3rd act, first scene)
    text: str                       # plain text contents of the line


class VerseStats:

    def __init__(self, build_dir: Path | str):
        self.build_dir = Path(build_dir)
        self.html = etree.parse(fspath(self.build_dir / 'www/print/faust.all.html'))
        self.tei = etree.parse(fspath(self.build_dir / 'prepared/textTranscript/faust.xml'))
        self.bargraph = read_bargraph_info(self.build_dir / 'www/data/genetic_bar_graph.json')

    def lines(self):
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
                      is_text = n.isnumeric() or n.startswith('ttf_'),
                      section = first(el_t.xpath('ancestor::tei:div[1]/@n', namespaces=_ns))
                      )
            yield v


def main():
    vs = VerseStats('../build')
    writer = csv.DictWriter(sys.stdout, list(field.name for field in fields(Verse)))
    writer.writeheader()
    for verse in vs.lines():
        writer.writerow(asdict(verse))


if __name__ == '__main__':
    main()
