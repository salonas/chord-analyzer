# Renders the 16x16 button icons from icons.json (one mask per icon: '#' fill, '@' edge color and '+'
# shadow color inside the shape) with the colors in palette.json: a 1 px edge around the shape and the
# shadow one pixel down and right.
# Usage, from the repo root: python3 tools/icons/make-icons.py [out dir, default public/img/icons]
#   [--sheet <png>]  also writes a contact sheet at x4 and x8 on the button background
import json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BACKGROUNDS = ('#f2e5cc',)
INSIDE = {'#': 'fill', '@': 'edge', '+': 'shadow'}

def rgba(hex_color):
    return tuple(int(hex_color[i:i + 2], 16) for i in (1, 3, 5)) + (255,)

def check(name, rows):
    if len(rows) != 16 or any(len(r) != 16 or set(r) - {'.', *INSIDE} for r in rows):
        sys.exit(f'{name}: needs 16 rows of 16 characters, only "." and {", ".join(INSIDE)}')
    cells = [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c != '.']
    if not cells or any(not (1 <= x <= 13 and 1 <= y <= 13) for x, y in cells):
        sys.exit(f'{name}: the mask must stay inside columns and rows 1 to 13 so edge and shadow fit')

def render(rows, pal):
    at = lambda x, y: 0 <= x < 16 and 0 <= y < 16 and rows[y][x] != '.'
    edge = lambda x, y: not at(x, y) and (at(x - 1, y) or at(x + 1, y) or at(x, y - 1) or at(x, y + 1))
    body = lambda x, y: at(x, y) or edge(x, y)
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y in range(16):
        for x in range(16):
            c = INSIDE[rows[y][x]] if at(x, y) else 'edge' if edge(x, y) else 'shadow' if body(x - 1, y - 1) else None
            if c: im.putpixel((x, y), rgba(pal[c]))
    return im

def sheet(icons, path):
    pad, cols = 12, 6
    cell_w, cell_h = 16 * 8 + 16 * 4 + 3 * pad, 16 * 8 + 28
    rows = -(-len(icons) // cols)
    out = Image.new('RGB', (cols * cell_w * len(BACKGROUNDS) + pad, rows * cell_h + pad), '#cfbc96')
    d = ImageDraw.Draw(out)
    for i, (name, im) in enumerate(icons.items()):
        for j, bg in enumerate(BACKGROUNDS):
            x0 = pad + (j * cols + i % cols) * cell_w
            y0 = pad + (i // cols) * cell_h
            for k, s in enumerate((8, 4)):
                tile = Image.new('RGBA', (16, 16), rgba(bg))
                tile.alpha_composite(im)
                out.paste(tile.resize((16 * s, 16 * s), Image.NEAREST), (x0 + k * (16 * 8 + pad), y0))
            d.text((x0, y0 + 16 * 8 + 4), f'{name} on {bg}', fill='#1a1a1a')
    out.save(path)

def main():
    args = sys.argv[1:]
    sheet_path = None
    if '--sheet' in args:
        k = args.index('--sheet')
        sheet_path = args[k + 1]
        del args[k:k + 2]
    out_dir = args[0] if args else 'public/img/icons'
    pal = json.load(open(os.path.join(HERE, 'palette.json'), encoding='utf-8'))
    masks = json.load(open(os.path.join(HERE, 'icons.json'), encoding='utf-8'))
    os.makedirs(out_dir, exist_ok=True)
    icons = {}
    for name, rows in masks.items():
        check(name, rows)
        icons[name] = render(rows, pal)
        icons[name].save(os.path.join(out_dir, name + '.png'), optimize=True)
    if sheet_path:
        sheet(icons, sheet_path)
    print(f'{len(icons)} icons, 16x16, in {out_dir}')

main()
