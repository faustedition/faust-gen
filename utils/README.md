## Metadata Tools

Features tools (well, currently one hack) to mass-maintain, e.g., metadata.


### sigils-table.py

A small python script to create an Excel table listing all idnos for all
documents, and to write new sigils created in that table back into the
metadata. 

Currently requires pandas and python3. Run with `--help` for help.

### add-gsa-numbers.py

Hack to add the gsa 'Idents' to the metadata.

Cf. faustedition/faust-gen-html#36.

## detect_pages.py

Tries to find the bounding box of the page in the facsimile images and writes them to a json file. Requires scikit-image, use `--help`.

## table2xml.py

Configuration-driven tool to convert tables (as in Excel) to an XML consumable by XSLTs.

Run `table2xml.py -o foo.xml foo.xlsx` to convert the table in foo.xlsx to a standard XML representation. If you wish to customize the transformation,

1. Generate a configuration file by calling `table2xml.py -C foo-config.yml foo.xlsx`
2. Edit `foo-config.yml` to your liking. It is a documented YAML file.
3. Run `table2xml.py -c foo-config.yml -o foo.xml foo.xlsx` to create the customized XML file.

You can use `-c` and `-C` at the same time to adjust an existing configuration to new table headers.
