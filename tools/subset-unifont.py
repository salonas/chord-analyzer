# Subsets GNU Unifont to the characters this app shows, as public/fonts/Unifont.woff2 (plane 0:
# Basic Latin, Latin-1 and every non-ASCII character in index.html and src/) and
# public/fonts/Unifont-music.woff2 (plane 1: the clefs and double accidentals of the staff).
# Usage, from the repo root: python tools/subset-unifont.py <folder with unifont-X.otf and unifont_upper-X.otf>
# Fonts from https://unifoundry.com/pub/unifont/ (OFL 1.1); all name records are kept for the license.
import sys, re, glob
from fontTools import subset
from fontTools.ttLib import TTFont

def used_chars():
    esc = re.compile(chr(92) * 2 + 'u([0-9a-fA-F]{4})')
    out = {'♮'}
    for f in ['index.html', 'src/style.css'] + [p for p in glob.glob('src/*.js') if not p.endswith('.test.js')]:
        s = esc.sub(lambda m: chr(int(m.group(1), 16)), open(f, encoding='utf-8').read())
        out |= {c for c in s if ord(c) > 126}
    return out

def build(src, codes, dst):
    opt = subset.Options(); opt.flavor = 'woff2'; opt.name_IDs = ['*']; opt.name_languages = ['*']; opt.layout_features = ['*']
    font = TTFont(src); sub = subset.Subsetter(opt); sub.populate(unicodes=codes); sub.subset(font)
    subset.save_font(font, dst, opt)
    print(dst, len(font.getBestCmap()), 'glyphs')

d = sys.argv[1]
lo, up = (glob.glob(f'{d}/{n}-*.otf')[0] for n in ('unifont', 'unifont_upper'))
chars = used_chars()
missing = [c for c in chars if ord(c) not in TTFont(lo).getBestCmap() and ord(c) not in TTFont(up).getBestCmap()]
if missing: print('not in Unifont:', ' '.join(f'U+{ord(c):04X}' for c in sorted(missing)))
build(lo, list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) + [ord(c) for c in chars if ord(c) <= 0xFFFF], 'public/fonts/Unifont.woff2')
build(up, [ord(c) for c in chars if ord(c) > 0xFFFF], 'public/fonts/Unifont-music.woff2')
