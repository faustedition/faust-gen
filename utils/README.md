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
