#!/usr/bin/env python3
# coding: utf-8

import pandas as pd
from lxml import etree
ns=dict(f='http://www.faustedition.net/ns')
import os
import sys
import logging
logging.basicConfig(level=logging.INFO,
                    format='%(levelname)s:%(funcName)s:%(message)s')
logger = logging.getLogger(__name__ if __name__ != '__main__' else sys.argv[0])


def read_table(mapping_filename,
               transcript_filename='../target/faust-transcripts.xml'):
    table = pd.read_excel(mapping_filename, index_col="Signatur")
    table['docpath'] = None
    idno_xml = etree.parse(transcript_filename)

    for idno_gsa in table.index:
        transcript_el = idno_xml.xpath("//*[f:idno = 'GSA %s']" % idno_gsa,
                                       namespaces=ns)
        if not transcript_el:
            logger.warn("No file found for signature %s", idno_gsa)
            continue
        else:
            logger.debug("Found an entry for signature %s", idno_gsa)

        docpath = transcript_el[0].attrib['document']
        oldpath = table.loc[idno_gsa, "docpath"]
        if oldpath is not None and oldpath != docpath:
            logger.warn("Overwriting %s with %s for signature %s", oldpath,
                        docpath, idno_gsa)
        table.loc[idno_gsa, "docpath"] = docpath
    return table


def write_idnos(table, rootdir='../data/xml'):
    for entry in table.itertuples():
        if entry.docpath is None:
            logger.warn("Skipping %s: Signature not in edition", entry)
            continue

        fullpath = os.path.join(rootdir, entry.docpath)
        md_xml = etree.parse(fullpath)
        if md_xml.xpath("//f:idno[. = '%s']" % entry.Ident,
                        namespaces=ns):
            logger.info("Skipping %s (%s): Already present in %s",
                        entry.Ident, entry.Index, entry.docpath)
            continue

        first_idno = md_xml.xpath("//f:idno[. = 'GSA %s']" % entry.Index,
                                  namespaces=ns)[0]
        tail = first_idno.tail
        new_idno = etree.Element("{http://www.faustedition.net/ns}idno")
        new_idno.attrib['type'] = 'gsa_ident'
        new_idno.text = str(entry.Ident)
        first_idno.addnext(new_idno)
        first_idno.tail = tail
        md_xml.write(fullpath, encoding='utf-8', xml_declaration=True)


def main():
    if len(sys.argv) < 2:
        logger.error("Usage: %s excel-file [xml-dir]", sys.argv[0])
        sys.exit(1)
    table = read_table(sys.argv[1])
    if len(sys.argv) >= 3:
        write_idnos(table, sys.argv[2])
    else:
        write_idnos(table)

if __name__ == '__main__':
    main()
