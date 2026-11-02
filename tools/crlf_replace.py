# Replaces exact text in a CRLF file without touching its line endings.
# Usage: python -I tools/crlf_replace.py <file> <spec.json>
# spec.json is a list of [old, new] pairs written with plain "\n"; each old must occur exactly once.
# The script writes the file only if every pair matches, and checks that every line still ends in CRLF.
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')
path, spec = sys.argv[1], sys.argv[2]
with open(path, encoding='utf-8', newline='') as f:
    text = f.read()
with open(spec, encoding='utf-8') as f:
    pairs = json.load(f)
for old, new in pairs:
    old, new = old.replace('\n', '\r\n'), new.replace('\n', '\r\n')
    n = text.count(old)
    if n != 1:
        sys.exit(f'{path}: expected 1 match, found {n}: {old[:80]!r}')
    text = text.replace(old, new)
lf, crlf = text.count('\n'), text.count('\r\n')
if lf != crlf:
    sys.exit(f'{path}: {lf - crlf} line(s) would end in LF only; nothing written')
with open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(text)
print(f'{path}: {len(pairs)} replacement(s), {crlf} CRLF lines')
