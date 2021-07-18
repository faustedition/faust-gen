#!/usr/bin/env python3

from skimage.io import imread
from skimage.filters import gaussian, threshold_otsu
from skimage.segmentation import clear_border
from skimage.measure import label, regionprops
from pathlib import Path
from os import fspath
import argparse
from joblib import Parallel, delayed
import sys
import json
from tqdm import tqdm


def find_page_in(imfile):
    image = imread(fspath(imfile), as_gray=True)
    image = gaussian(image, sigma=10)
    thresh = 0.2 #threshold_otsu(image)
    bw = image > thresh
    labels = label(bw)
    regions = regionprops(labels)
    largest = max(regions, key=lambda rp: rp.bbox_area)
    y, x, yy, xx = largest.bbox
    return x, y, xx, yy


def process_dir(path, glob='*_0.jpg', verbose=1):
    files = list(path.glob(glob))
    results = parallel(delayed(find_page_in)(file) for file in tqdm(files,
                                                                    unit='image',
                                                                    desc=f'Analyzing images in {path.stem}',
                                                                    colour='blue',
                                                                    leave=False))
    return dict(zip(files, results))



def _main():
    p = argparse.ArgumentParser(#summary='Extract the largest region in each image.',
                                description="""
        The script analyzes all image files in the given directorie(s) and tries to automatically find
        the page region, i.e. the non-dark region with the largest bounding box. It will then generate
        a json file mapping the 'cleaned' version of each image file name to a bounding box.
    """)
    p.add_argument('folder', nargs='+', type=Path, help='image folder')
    p.add_argument('-r', '--recursive', action='store_true', help='recursively search all directories')
    p.add_argument('-f', '--force', action='store_true', help='overwrite existing files')
    p.add_argument('-g', '--glob', default='*_0.jpg', help='glob pattern to search through each folder')
    p.add_argument('-o', '--output', default='{folder}/zoom.json', help="""
        Pattern for the output file names. Available expansions: {folder} - full path to folder, more TODO
    """)
    p.add_argument('-p', '--parallel', nargs='?', const=-1, type=int, metavar='JOBS', help='Run multiple jobs in parallel.')
    p.add_argument('-v', '--verbose', action='count', default=0)
    options = p.parse_args()

    global parallel
    parallel = Parallel(options.parallel, verbose=5*options.verbose)

    if options.recursive:
        folders = []
        for folder in options.folder:
            folders.extend(folder.glob('**/'))
    else:
        folders = options.folder

    # noinspection PyBroadException
    try:
        suffix = options.glob[options.glob.rindex('*')+1:]
        suffix_length = len(suffix)
        def clean_path(path: Path):
            if path.name[-suffix_length:] == suffix:
                return path.name[:-suffix_length]
            else:
                return path.stem
    except:
        def clean_path(path: Path):
            return path.stem

    for folder in tqdm(folders, unit='folder', desc='Processing folders'):
        outpath = Path(options.output.format_map(dict(folder=folder, dirname=folder.name)))
        if options.force or not outpath.exists():
            bboxes = process_dir(folder, options.glob, options.verbose)
            if bboxes:
                final = {clean_path(path): bboxes for path, bboxes in bboxes.items()}
                outpath.parent.mkdir(parents=True, exist_ok=True)
                with outpath.open('wt') as f:
                    json.dump(dict(sorted(final.items())), f, separators=(',', ':'))



if __name__ == '__main__':
    _main()