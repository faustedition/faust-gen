#!/usr/bin/env python3

from lxml import etree
import os
import re
import pandas as pd
import argparse
import sys
import logging
logging.basicConfig(level=logging.WARNING,
                    format='%(levelname)s:%(funcName)s:%(message)s')
logger = logging.getLogger(__name__ if __name__ != '__main__' else sys.argv[0])

NS={"f": "http://www.faustedition.net/ns", "tei": "http://www.tei-c.org/ns/1.0"}

_number = re.compile(r'\b\d+\b')
def extract_numbers(items):
    for string in items:
        for match in _number.findall(string):
            yield int(match)


def write_sigils_table(options):
    df = pd.DataFrame()
    docdir = os.path.join(options.directory, 'document')
    logger.info('Reading metadata from %s ...', docdir)
    for path, dirs, files in os.walk(docdir):
        for file in files:
            filepath = os.path.join(path, file)
            rel = os.path.relpath(filepath, start=options.directory)
            uri = "faust://xml/" + rel
            logger.debug('Reading metadata %s (URI %s)', filepath, uri)
            meta = etree.parse(filepath)
            df.at[uri, "type"] = meta.getroot().tag.split('}')[1]

            textTranscripts = meta.xpath('//f:textTranscript', namespaces=NS)
            for textTranscript in textTranscripts:
                transcript = os.path.join(options.directory, textTranscript.base[12:] + textTranscript.attrib["uri"])
                logger.debug('  - textual transcript %s ...', transcript)
                text = etree.parse(transcript)
                lines = list(extract_numbers(text.xpath('//tei:l/@n', namespaces=NS)))
                df.at[uri, 'minVerse'] = min(lines, default=None)
                df.at[uri, 'maxVerse'] = max(lines, default=None)

            df.at[uri, options.column_name] = ''
            for idno in meta.xpath('//f:idno', namespaces=NS):
                if idno.text != 'none':
                    df.at[uri, idno.attrib["type"]] = idno.text

    df.index.name = 'URI'
    logger.debug(df.describe())
    if len(df) == 0:
        logger.error('No Faust data found at %s, not writing %s',
                     options.directory, options.excel_file)
    else:
        logger.info('Writing %d records to excel file %s, sheet %s', len(df),
                    options.excel_file, options.excel_sheet)
        df.to_excel(options.excel_file, sheet_name=options.excel_sheet)

def write_new_sigils(options):
    sheet = int(options.excel_sheet) \
        if options.excel_sheet.isnumeric() else options.excel_sheet
    df = pd.read_excel(options.excel_file, sheet, index_col=options.uri_column,
                       na_values=['?'])

    for uri in df.index:
        newsigil = df.at[uri, options.column_name]
        if not(isinstance(uri, str)) or len(uri) <= 12:
            logger.warn('%s: Skipping invalid URI for new sigil %s', uri, newsigil)
            continue
        filename = os.path.join(options.directory, uri[12:])
        logger.debug('Will add %s to %s ...', newsigil, filename)
        if not(newsigil) or not(isinstance(newsigil, str)):
            logger.warn('%s: No valid sigil: %s', uri, newsigil)
            continue
        meta = etree.parse(filename)
        exsigil = meta.xpath('//f:idno[@type="%s"]' % options.idno_type, namespaces=NS)
        if exsigil:
            if exsigil[0].text == newsigil:
                logger.info('%s: idno %s already present.', uri, newsigil)
                continue
            elif options.overwrite_sigils:
                logger.warn('%s: Replacing sigil "%s" with "%s"', uri,
                            exsigil[0].text, newsigil)
                exsigil[0].text = newsigil
            else:
                logger.error('%s: Refusing to replace sigil "%s" with "%s"',
                             uri, exsigil[0].text, newsigil)
                continue
        else:
            idnos = meta.xpath('/*/f:metadata/f:idno', namespaces=NS)
            if idnos:
                parent = idnos[0].getparent()
                position = parent.index(idnos[0])
                tail = idnos[0].tail
            else:
                parent = meta.xpath('/*/f:metadata', namespaces=NS)[0]
                position = 0
                tail = '\n   '
            idno = parent.makeelement('idno',
                                      attrib={'type': options.idno_type},
                                      nsmap=NS)
            idno.text = newsigil
            idno.tail = tail
            parent.insert(position, idno)
            logger.info('%s: Added sigil %s', uri, newsigil)
        meta.write(filename, encoding='utf-8', xml_declaration=True)


def get_argparser():
    parser = argparse.ArgumentParser(description='Tool to deal with the new sigils',
                                     formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument('-d', '--directory', default='.',
                        help='Source directory for XML files')
    parser.add_argument('-x', '--excel-file', default='sigils.xlsx',
                        help='Excel file for sigil maintenance')
    parser.add_argument('-s', '--excel-sheet', default='Sigils',
                        help='Name of excel sheet to use')
    parser.add_argument('-n', '--column-name', default='newSigil',
                        help='Column label for the new sigil column')
    parser.add_argument('-u', '--uri-column', default=0, type=int,
                        help='Column number of the URI column')
    parser.add_argument('-w', '--write-sigils', action='store_true',
                        help='Write mode: Write sigils from table to metadata')
    parser.add_argument('-W', '--overwrite-sigils', action='store_true',
                        help='Overwrite existing sigils')
    parser.add_argument('-i', '--idno-type', default='faustedition',
                        help='Sigil type for new sigil')
    parser.add_argument('-v', '--verbose', action='count', default=0,
                        help='increase verbosity')
    parser.add_argument('-q', '--quiet', action='count', default=0,
                        help='decrease verbosity')
    return parser

def main():
    options = get_argparser().parse_args()
    logger.setLevel(logger.getEffectiveLevel()
                    - (10*options.verbose)
                    + (10*options.quiet))
    logger.debug("Options: %s", options)
    if options.write_sigils:
        write_new_sigils(options)
    else:
        write_sigils_table(options)

if __name__ == '__main__':
    main()
