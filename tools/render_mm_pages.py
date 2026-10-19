#!/usr/bin/env python3
"""Render pages of your own 2014 Monster Manual PDF to public/monster-manual-2014/page-NNN.jpg
(NNN = PDF page number) for the compendium's "read the book page" view.
Usage: python tools/render_mm_pages.py "Monster Manual.pdf" [first last]"""
import sys, os, json
import pymupdf
pdf = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'monster-manual-2014')
os.makedirs(out, exist_ok=True)
doc = pymupdf.open(pdf)
if len(sys.argv) > 3: pages = range(int(sys.argv[2]), int(sys.argv[3]) + 1)
else:
    data = json.load(open(os.path.join(out, '..', 'monster-manual-compendium.json'), encoding='utf-8'))
    pages = sorted({p for m in data['monsters'] for p in m.get('imagePages', [])})
for n in pages:
    doc[n - 1].get_pixmap(matrix=pymupdf.Matrix(2.2, 2.2)).save(os.path.join(out, f'page-{n:03d}.jpg'), jpg_quality=72)
print(len(pages), 'pages written to', os.path.normpath(out))
