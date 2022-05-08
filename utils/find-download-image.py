import argparse
import csv
import json
import sys
from contextlib import nullcontext
from pprint import pformat

from PIL import Image
from lxml import etree
from pathlib import Path

import logging

from tqdm.auto import tqdm
from tqdm.contrib.logging import logging_redirect_tqdm

logger = logging.getLogger(__name__)

ns = {"f": "http://www.faustedition.net/ns"}


def download_config(archives_xml="../data/xml/archives.xml"):
    """Extracts the per-repository download rules from  archives.xml"""
    result = {}
    archives = etree.parse(archives_xml)
    for archive in archives.xpath("//f:archive", namespaces=ns):
        id = archive.get("id")
        try:
            facs = archive.xpath("f:facsimile", namespaces=ns)[0]
            rules = facs.attrib
            result[id] = rules
        except IndexError:
            print(f"No facsimile element for {id}")
            result[id] = {"downloadable": "unknown"}
    return result


def find_allowed_facsimile(root: Path, path: str, rules: dict):
    if rules.get("downloadable") != "yes":
        logger.debug('downloadable != yes for %s (rules: %s)', path, rules)
        return None
    elif rules.get("resolution") == "reduced":
        logger.debug('reduced resulution for %s', path)
        return f"{path}_2.jpg"
    else:
        with Image.open(root / f"{path}_0.jpg") as img:
            orig_width, _ = img.size
            orig_dpi, _ = img.info.get("resolution", 300)
        if is_allowed(orig_width, orig_dpi, rules):
            return f"{path}_0.jpg"
        else:
            for variant in range(1, 9):
                filename = f"{path}_{variant}.jpg"
                with Image.open(root / filename) as img:
                    width, _ = img.size
                dpi = int(orig_dpi * (width / orig_width))
                if is_allowed(width, dpi, rules):
                    return filename
    return None


def is_allowed(width: int, resolution: int, rules: dict[str, str]):
    result = True
    if rules.get("downloadable") != "yes":
        result = False
    elif "max-width" in rules and width > int(rules["max-width"]):
        result = False
    elif "max-dpi" in rules and resolution > int(rules["max-dpi"]):
        result = False
    return result


def per_documents_data(metadata_json="../build/www/data/document_metadata.json"):
    md_path = Path(metadata_json)
    with md_path.open() as f:
        if md_path.suffix == ".js":
            f.readline()
        _md = json.load(f)
    mss = _md["metadata"]
    pages = []
    for ms in mss:
        sigil_t = ms["sigil"]
        repo_id = ms["sigils"]["repository"]
        base = Path(ms["base"])
        for page_number, page in enumerate(ms["page"], start=1):
            doc = page["doc"]
            if len(doc) > 1:
                print(f"{sigil_t:>6} {page_number}: {len(doc)} docs")
            if doc and doc[0]:
                imgs = doc[0]["img"]
                for img in imgs:
                    pages.append(
                        {
                            "repo": repo_id,
                            "sigil": sigil_t,
                            "base": base,
                            "page": page_number,
                            "img": img,
                        }
                    )
    return pages


def getargparser():
    p = argparse.ArgumentParser()
    p.add_argument(
        "-a",
        "--archives",
        metavar="XML",
        help="URL for archives.xml",
        default="https://raw.githubusercontent.com/faustedition/faust-xml/master/xml/archives.xml",
    )
    p.add_argument(
        "-d",
        "--document-metadata",
        metavar="JSON",
        help="Path to document_metadata.js[on]",
        required=True,
    )
    p.add_argument(
        "-i",
        "--image-root",
        metavar="PATH",
        type=Path,
        help="root folder for scaled (jpg) facsimiles",
    )
    p.add_argument(
        "-o",
        "--output",
        metavar="CSV",
        type=argparse.FileType("wt"),
        default=nullcontext(sys.stdout),
    )
    return p


def main():
    logging.basicConfig(level=logging.DEBUG)
    options = getargparser().parse_args()
    rules = download_config(options.archives)
    if logger.isEnabledFor(logging.DEBUG):
        logger.debug('Rules: {}', pformat(rules))
    page_data = per_documents_data(options.document_metadata)
    with logging_redirect_tqdm():
        for page in tqdm(page_data):
            page["download"] = find_allowed_facsimile(
                options.image_root, page["base"] / page["img"], rules[page["repo"]]
            )
    writer = csv.DictWriter(options.output, fieldnames=list(page_data[0]))
    writer.writeheader()
    writer.writerows(page_data)
    options.output.close()


if __name__ == "__main__":
    main()
