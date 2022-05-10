import argparse
import csv
import json
import sys
from collections import namedtuple
from contextlib import nullcontext
from pprint import pformat

from PIL import Image
from lxml import etree
from pathlib import Path

import logging
from rich.logging import RichHandler
from rich.progress import track

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
            logger.warning(f"No facsimile element for {id}")
            result[id] = {"downloadable": "unknown"}
    if "print" not in result:
        result["print"] = {"downloadable": "yes"}
    return result


_Allowance = namedtuple("Allowance", "download level reason width dpi", defaults=(None, None))


def find_allowed_facsimile(root: Path, path: str, rules: dict) -> _Allowance:
    """
    Finds the first allowed image according to the rules.

    Args:
        root: root path for the images
        path: base path to the page image
        rules: repository-specific rule set

    Returns: A triple:
        - path to the downloadable JPEG file, relative to root, already containing scale (or None if no download possible)
        - scale of the image file (or None)
        - (last) reason why no better scale is available
    """
    forbidden = ""
    if rules.get("downloadable") != "yes":
        logger.debug('downloadable != yes for %s (rules: %s)', path, rules)
        return _Allowance(None, None, "no-download")
    elif rules.get("resolution") == "reduced":
        logger.debug('reduced resulution for %s', path)
        return _Allowance(f"{path}_2.jpg", 2, "reduced")
    else:
        try:
            with Image.open(root / f"{path}_0.jpg") as img:
                orig_width, _ = img.size
                orig_dpi = img.info.get("resolution", 300)
            for variant in range(9):
                filename = f"{path}_{variant}.jpg"
                with Image.open(root / filename) as img:
                    width, _ = img.size
                dpi = int(orig_dpi * (width / orig_width))
                forbidden, last_violation = is_forbidden(width, dpi, rules), forbidden
                if not forbidden:
                    return _Allowance(filename, variant, last_violation, width, dpi)
        except OSError as e:
            logger.error('Failed to read image (path=%s, root=%s): %s', path, root, e)
            return _Allowance(None, None, "not-found")
    return _Allowance(None, None, forbidden)


def is_forbidden(width: int, resolution: int, rules: dict[str, str]) -> str:
    """
    Checks width and resolution against the specific rule set.

    Args:
        width: image's width in pixels
        resolution: image's resolution in dpi
        rules: a single repository's rule set as extracted by `download_config`

    Returns:
        An empty string if the image is conformant, a short descriptive string of the first violated rule otherwise.
    """
    reason = ""
    if rules.get("downloadable") != "yes":
        reason = "forbidden"
    elif "max-width" in rules and width > int(rules["max-width"]):
        reason = f"max-width:{rules['max-width']}"
    elif "max-dpi" in rules and resolution > int(rules["max-dpi"]):
        reason = f"max-dpi:{rules['max-dpi']}"
    return reason


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
        base = Path(*Path(ms["base"]).parts[1:])
        for page_number, page in enumerate(ms["page"], start=1):
            doc = page["doc"]
            if len(doc) > 1:
                logger.warning(f"{sigil_t:>6} {page_number}: {len(doc)} docs")
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
    p.add_argument("-l", "--log", metavar="LOGFILE", help="Write a debug log")
    return p


def main():
    options = getargparser().parse_args()
    console_handler = RichHandler(show_time=False)
    if options.log:
        logging.basicConfig(level=logging.DEBUG, format="%(funcName)s:%(levelname)s:%(message)s", filename=options.log, filemode="w")
        console = console_handler
        console.setLevel(logging.WARNING)
        console.setFormatter(logging.Formatter('%(message)s'))
        logger.addHandler(console)
    else:
        logging.basicConfig(level=logging.INFO, format="%(message)s", handlers=[console_handler])
    rules = download_config(options.archives)
    if logger.isEnabledFor(logging.INFO):
        logger.info('Rules:\n%s', pformat(rules))
    page_data = per_documents_data(options.document_metadata)
    for page in track(page_data, description='Analyzing images ...'):
        page.update(find_allowed_facsimile(
                options.image_root, page["img"], rules.get(page["repo"], {})
        )._asdict())
    writer = csv.DictWriter(options.output, fieldnames=list(page_data[0]))
    writer.writeheader()
    writer.writerows(page_data)
    options.output.close()


if __name__ == "__main__":
    main()
