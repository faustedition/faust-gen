#!/usr/bin/env python3

import argparse
import json
import logging
import re
import sys
from argparse import ArgumentParser
from pathlib import Path

logger = logging.getLogger(__name__)


def get_options(argv=None):
    parser = ArgumentParser()
    parser.add_argument('document_metadata', type=argparse.FileType(mode='rt'), help='js file with metadata')
    parser.add_argument('-d', '--facsimile-directory', help='root directory to check')
    options = parser.parse_args(argv)
    logger.debug(options)
    return options

def _read_md(filelike):
    md_str = filelike.read()
    md_str = re.sub(r'var\s+\w+\s*=\s*', '', md_str)
    md = json.loads(md_str)
    return md['metadata']

def _link(sigil, page, transcript, layer=0):
    sigil_t = re.sub(r'[^A-Za-z0-9.-]', '_', sigil.replace('α', 'alpha'))
    href = 'http://dev.faustedition.net/document?sigil={}&page={}'.format(sigil_t, page)
    if layer > 0:
        href += '&layer={}'.format(layer)
    return '[{} S. {} Layer {}]({})'.format(sigil, page, layer, href)

def _check_metadata(documents, rootdir):
    img_root = Path(rootdir)
    for document in documents:
        sigil = document['sigils']['idno_faustedition']
        for pageno, page in enumerate(document['page'], start=1):
            for docno, doc in enumerate(page['doc'], start=1):
                if 'img' in doc:
                    for imgno, img in enumerate(doc['img'], start=0):
                        img_json_file = img_root / (img + ".json")
                        if not img_json_file.exists():
                            logger.warning('%s: json file missing: %s', _link(sigil, pageno, docno, imgno), img_json_file)
                else:
                    logger.debug('%s: Page %3d, transcript %d has no images', sigil, pageno, docno)



def _main():
    logging.basicConfig(level=logging.INFO)
    options = get_options()
    md = _read_md(options.document_metadata)
    _check_metadata(md, options.facsimile_directory)



if __name__ == '__main__':
    _main()