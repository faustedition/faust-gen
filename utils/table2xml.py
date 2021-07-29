#!/usr/bin/env python3

import argparse
from email.policy import default
import re
from ast import arg
from dataclasses import dataclass
from io import StringIO
from os import fspath
from pathlib import Path
from typing import Iterable, Optional

import pandas as pd
from lxml import etree, objectify
from lxml.builder import E, ElementMaker
from ruamel.yaml import YAML

DOC = """
An opinionated and configurable converter from tables (Excel, csv) to XML input.

The script will parse a table (using pandas) and create an XML document that
contains <record> element for each table row which will contain a <value>
element for each non-nan value of that row. Many aspects are configurable: use
``table2xml.py -C config.yml input.xlsx`` to create a starting point config
file for the given table, modify config.yml and use 
``table2xml.py -c config.yml -o doc.xml input.xlsx`` to generate an XML file
according to this configuration file.
"""

DEFAULT_CONFIG = """
# Namespace of the XML document. "" = no namespace
namespace: ""
# Name of the root element
root: table
# Name of the element for reach record
row: record
# If true, transpose the table, i.e. one record is one column instead of one row
transpose: false

# Default column handling. The default generates <value key="column header">cell contents</value>
default:
  element: value 
  key: key
  skipna: true
  skipre: false

# Each column specification can have the following keys:
#
# header: the name of the table header. Required except for the default (see below)
# element: Name of the element to generate. If this is missing, fall back to the default and ignore key and value.
# key: If present, an attribute that will receive the key (i.e. the column header name)
# value: If present, an attribute that will receive the value. If missing, the value will be the element’s text content
# skip: If present and true, this column will never be included with the conversion.
# skipna: If present and true, missing (nan) values will be skipped in the xml
# skipre: If present and a non-empty regular expression, the cell will be skipped if it matches the expression

# Configuration for each column. If a column is not in this list, or if a column’s entry only has the header key,
# it will be handled according to the default column specification above.
columns: []
"""


def getargparser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description=DOC)
    p.add_argument("table", type=Path, help="Table to read")
    p.add_argument(
        "-C",
        "--write-config",
        type=argparse.FileType("wb"),
        help="Write a configuration file",
    )
    p.add_argument(
        "-c",
        "--config",
        type=argparse.FileType("rb"),
        help="Read the configuration file",
    )
    p.add_argument(
        "-o",
        "--output",
        type=argparse.FileType("wb"),
        help="Convert to XML and write file",
    )
    return p


def read_table(path: Path) -> pd.DataFrame:
    if path.suffix in {".xlsx", ".xls"}:
        return pd.read_excel(fspath(path))
    if path.suffix == ".csv":
        return pd.read_csv(fspath(path))
    return pd.read_table(fspath(path))


def without_keys(dictionary: dict, keys: Iterable) -> dict:
    """Returns a copy of the given dictionary without the given keys."""
    result = dict(dictionary)
    for key in keys:
        if key in result:
            del result[key]
    return result


class Converter:
    def __init__(self) -> None:
        yaml = YAML()
        self.config = yaml.load(StringIO(DEFAULT_CONFIG))
        self._columns = None

    def load_config(self, config_file):
        yaml = YAML()
        with config_file:
            self.config.update(yaml.load(config_file))
        self._columns = None

    def save_config(self, config_file):
        yaml = YAML()
        with config_file:
            yaml.dump(self.config, config_file)

    def add_columns(self, columns: Iterable):
        """Add column specs from the given list to the spec"""
        for header in map(str, columns):
            if header not in self.columns:
                self.config["columns"].append({"header": header})
        self._columns = None

    @property
    def columns(self):
        """
        The columns cache. A dictionary {header: spec}, where spec is a columns
        spec dictionary with values from the config defaults filled in.
        """
        if self._columns is None:
            self._columns = self._get_columns_cache()
        return self._columns

    def _get_columns_cache(self):
        columns = {}
        for col in self.config["columns"] or []:
            colspec = dict(col)
            # a colspec w/o header doesn’t really make sense, but if it has an element name, we expect a like-named column.
            if "header" not in colspec:
                if "element" in colspec:
                    colspec["header"] = colspec["element"]
                else:
                    continue  # skip broken config

            # copy the defaults and update them with the given config.
            if "element" in colspec:
                # if an element is specified, key and value will not be taken from the default config
                defaults = without_keys(
                    self.config["default"], ["key", "value", "skip"]
                )
            else:
                defaults = dict(self.config["default"])
            defaults.update(colspec)

            # now make the full spec accessable via header
            columns[colspec["header"]] = defaults
        return columns

    def table2xml(self, table: pd.DataFrame):
        if self.config.get("transpose", False):
            table = table.T
        self.add_columns(table.columns)  # just in case something is missing
        records = table.to_dict(orient="records")

        if self.config["namespace"]:
            nsargs = dict(
                namespace=self.config["namespace"],
                nsmap={None: self.config["namespace"]},
            )
        else:
            nsargs = {}

        E = ElementMaker(**nsargs)
        root_el = E(self.config["root"])
        for row in records:
            row_el = E(self.config["row"])
            for key, value in row.items():
                spec = self.columns[key]
                if spec.get("skip", False):
                    continue
                if spec.get("skipna", False) and pd.isna(value):
                    continue
                if spec.get("skipre", False) and re.match(spec["skipre"], str(value)):
                    continue
                item_el = E(spec["element"])
                if spec.get("key"):
                    item_el.set(spec["key"], key)
                if spec.get("value"):
                    item_el.set(spec["value"], value)
                else:
                    item_el.text = str(value)
                row_el.append(item_el)
            root_el.append(row_el)
        self.xml = root_el.getroottree()
        return root_el


def _main():
    options = getargparser().parse_args()
    converter = Converter()
    if options.config:
        converter.load_config(options.config)
    table = read_table(options.table)
    if converter.config.get("transpose"):
        converter.add_columns(table.index)
    else:
        converter.add_columns(table.columns)
    if options.write_config:
        converter.save_config(options.write_config)
    if options.output:
        et = converter.table2xml(table).getroottree()
        et.write(options.output, encoding="utf-8", pretty_print=True)


if __name__ == "__main__":
    _main()
