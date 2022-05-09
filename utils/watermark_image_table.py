#!/usr/bin/env python3

from collections import defaultdict
from pathlib import Path
from typing import Union
from lxml import etree
import re

from find_sigil_refs import encode_sigil
import sys
import os
import logging

logger = logging.getLogger(__name__)

this_script = Path(sys.argv[0])
project_root = this_script.parent.parent

NS={'f': 'http://www.faustedition.net/ns'}
#                             GSA_25-W_1362_wm_hand_drawn_150.jpg
IMG_FN_PATTERN = re.compile(r'GSA_25-W_(\d+)_wm_([a-z_]+)_(.*)')
CAT_LABELS = {'all': 'Blatt', 'detail': 'Detail', 'hand_drawn': 'Zeichnung'}

def etree_by_id(root: Path, idno_type: str):
    result = {}
    for mdfile in root.glob('**/*.xml'):
        tree = etree.parse(str(mdfile))
        id = tree.xpath(f'//f:idno[@type="{idno_type}"]/text()', namespaces=NS)
        if id:
            result[id[0]] = tree
    return result

def collect_wm_imgs(imgfolder: Path):
    by_sigpart = defaultdict(list)
    for image in sorted(imgfolder.glob('*')):
        match = IMG_FN_PATTERN.match(image.stem)
        if match:
            sigpart = match.group(1)
            by_sigpart[sigpart].append(dict(
                path = image,
                category = CAT_LABELS.get(match.group(2), match.group(2)),
                resolution = match.group(3)
            ))
        else:
            logger.warning('Ignoring unmatched file %s', image)
    return by_sigpart

class WMLabels(dict):
        
    def __init__(self, watermark_map:Path=None):
        if watermark_map is None:
            watermark_map = project_root / "src/main/xproc/xslt/watermark-labels.xml"
        self.path = watermark_map
        wm_tree = etree.parse(os.fspath(watermark_map))
        self.tree = wm_tree
        for el in wm_tree.xpath('//f:watermark', namespaces=NS):
            id = el.get('id')
            if id != "none":
                self[id] = el.text

    def register_image(self, wm_id, row_ref):
        els = self.tree.xpath(f"//f:watermark[@id='{wm_id}']", namespaces=NS)
        if els:
            for el in els:
                el.set('imgref', row_ref)
        else:
            logger.warning('WMLabels: id %s not found in the label table, cannot link to %s', wm_id, row_ref)

    def save(self, path: Path = None):
        if path is None:
            path = self.path
        self.tree.write(os.fspath(path), pretty_print=True, encoding='utf-8')
        

def image_cell(image: dict, signature, td=True):
    url='/img/watermarks/' + image['path'].name
    thumb='/img/watermarks/thumb/' + image['path'].name
    caption=f"{signature} ({image['category']}, {image['resolution']} dpi)"
    link = f"""<a href="{url}" class="chocolat-image" title="{caption}"><img src="{thumb}" /></a>"""
    if td:
        return '<td>' + link + '</td>'
    else:
        return link

def reorder_images(images: list[dict]) -> dict[str, Union[list, dict]]:
    result = {'rest': []}
    for image in images:
        if image['category'] in result:
            result['rest'].append(image)
        else:
            result[image['category']] = image
    return result

def normalize_whitespace(text: str) -> str:
    return re.sub(r'\s+', ' ', text).strip()

def generate_table(by_sigpart, idmap, wmmap: WMLabels):
    rows = []
    for sigpart, images in by_sigpart.items():
        signature = f'GSA 25/W {sigpart}'
        metadata = idmap.get(signature)
        cols = []

        # Image columns
        img_by_cat = reorder_images(images)
        for cat in ['Blatt', 'Detail', 'Zeichnung']:
            img = img_by_cat.get(cat)
            if img:
                cols.append(image_cell(img, signature))
            else:
                cols.append('<td></td>')
        cols.append('<td>' + ''.join(image_cell(img, signature, td=False) for img in img_by_cat['rest']) + '</td>')

        if metadata:
            sigil = metadata.xpath('//f:idno[@type="faustedition"]/text()', namespaces=NS)[0]
            sigil_t = encode_sigil(sigil)
            wmids = metadata.xpath('//f:watermarkID/text() | //f:countermarkID/text()', namespaces=NS)
            if wmids:
                wm_raw = normalize_whitespace(wmids[0])
                wm_normalized = wmmap.get(wm_raw)
                if wm_normalized:
                    wm_id = re.sub(r'\W', '_', wm_normalized)
                    wm_link = f'<a href="/watermark-table#{wm_id}">{wm_normalized}</a>'
                    wmmap.register_image(wm_raw, 'wm_' + sigil_t)
                else:
                    wm_link = ''
            else:
                wm_link = ''
            row = f"""<tr id="wm_{sigil_t}">
                        <td><a href="/document?sigil={sigil_t}&view=structure">{sigil}</a></td>
                        <td><a href="/document?sigil={sigil_t}&view=structure">{signature}</a></td>
                        {''.join(cols)}
                        <td>{wm_link}</td>
                    </tr>"""
        else:
            logger.warning('Signature %s not found', sigpart)
            row = f"""<tr><td>{signature}</td>{''.join(cols)}</tr>"""
        rows.append(row)
    return ''.join(rows)

HEAD = """
<?php include "includes/header.php"?>
<!-- WARNING: This file can be re-generated using faust-gen/utils/watermark_image_table.py. Do not edit directly. -->
<section class="main"
    data-breadcrumbs="Archiv@archive|Materialien@archive_materials"
    data-title="Wasserzeichenaufnahmen">

    <article class="pure-u-1">
        <p>Auf dieser Seite werden die 2013 im Goethe- und Schiller-Archiv angefertigten
            Wasserzeichenaufnahmen verfügbar gemacht.</p>
        <p>Vgl. den <a href="watermarks">ausführlichen Bericht über die Anfertigung der
                Aufnahmen</a> sowie die <a href="watermark-table">Liste der in der Faustedition
                vorkommenden Wasserzeichen</a>.</p>
    </article>

<table class="pure-table" data-sortable="true">
    <thead>
        <th data-sortable-type="sigil">Sigle</th>
        <th data-sortable-type="sigil">Signatur</th>
        <th>Blatt</th>
        <th>Detail</th>
        <th>Zeichnung</th>
        <th>weitere</th>
        <th data-sortable-type="alpha">Beschreibung (Link: Vorkommen)</th>
    </thead>
    <tbody>
"""

FOOT = """
</tbody>
</table>
</section>
<script type="text/javascript">
requirejs(['faust_common', 'svg-pan-zoom', 'sortable', 'jquery', 'jquery.table'],
function(Faust, svgPanZoom, Sortable, $, $table) {
    // document.getElementById('breadcrumbs').appendChild(Faust.createBreadcrumbs([{"caption": "Über die Ausgabe", "link": "/intro"}, {"caption": "Wasserzeichen"}]));
    Sortable.init();
    $("table[data-sortable]").fixedtableheader();
});
</script>
<?php include "includes/footer.php"?>
"""

if __name__ == '__main__':
    images = collect_wm_imgs(project_root / 'src/main/web/img/watermarks')
    metadata = etree_by_id(project_root / 'data/xml/document', 'gsa_2')
    wm_map = WMLabels()
    content = generate_table(images, metadata, wm_map)
    output_file = project_root / 'src/main/web/archive_watermarks.php'
    output_file.write_text(HEAD + content + FOOT, encoding='utf-8')
    wm_map.save()