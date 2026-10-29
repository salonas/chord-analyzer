"""Flattens an .sfz program into its regions, with the opcodes inherited from
<global>, <master> and <group>, after #define and #include are resolved.

    python tools/sfzregions.py program.sfz [key]
"""
import os
import re
import sys

HEADERS = ['global', 'control', 'master', 'group', 'region']


def note_number(v):
    try:
        return int(v)
    except ValueError:
        m = re.match(r'([a-gA-G])(#|b)?(-?\d)$', v)
        if not m:
            return None
        base = [0, 2, 4, 5, 7, 9, 11]['cdefgab'.index(m.group(1).lower())]
        return 12 * (int(m.group(3)) + 1) + base + {'#': 1, 'b': -1}.get(m.group(2), 0)


def expand(path, defs, seen):
    out = []
    for line in open(path, encoding='latin-1').read().split('\n'):
        line = re.sub(r'//.*', '', line)
        m = re.match(r'\s*#define\s+(\$\w+)\s+(\S+)', line)
        if m:
            defs[m.group(1)] = m.group(2)
            continue
        for k in sorted(defs, key=len, reverse=True):
            line = line.replace(k, defs[k])
        m = re.match(r'\s*#include\s+"([^"]+)"', line)
        if m:
            inc = os.path.normpath(os.path.join(os.path.dirname(path), m.group(1)))
            if not os.path.exists(inc):
                inc = os.path.normpath(os.path.join(os.path.dirname(path), '..', m.group(1)))
            if os.path.exists(inc) and inc not in seen:
                seen.add(inc)
                out.append(expand(inc, defs, seen))
            continue
        out.append(line)
    return '\n'.join(out)


def program(path):
    """Returns (control opcodes, regions); each region's 'sample' is an absolute path."""
    text = expand(path, {}, set())
    tokens = re.findall(r'<(\w+)>|([\w]+)=("[^"]*"|[^\s<]+(?:\s(?![\w$]+=|<)[^\s<]+)*)', text)
    ctx = {h: {} for h in HEADERS}
    control = {}
    current = None
    found = []

    def close():
        merged = {}
        for h in ['global', 'master', 'group', 'region']:
            merged.update(ctx[h])
        found.append(merged)

    for header, key, value in tokens:
        if header:
            if current == 'region':
                close()
            current = header
            if header in HEADERS and header != 'control':
                for lower in HEADERS[HEADERS.index(header):]:
                    ctx[lower] = {}
            continue
        value = value.strip().strip('"')
        if current == 'control':
            control[key] = value
        elif current in ctx:
            ctx[current][key] = value
    if current == 'region':
        close()

    root = os.path.join(os.path.dirname(path), control.get('default_path', '').replace('\\', '/'))
    regions = []
    for r in found:
        if 'sample' not in r:
            continue
        # an sfz region with no key opcodes spans the whole keyboard (the converted .sf2 banks write them that way)
        lo = r.get('lokey', r.get('key', 0))
        hi = r.get('hikey', r.get('key', 127))
        r['lokey'], r['hikey'] = note_number(lo), note_number(hi)
        r['lovel'], r['hivel'] = int(r.get('lovel', 1)), int(r.get('hivel', 127))
        if not r['sample'].startswith('*'):
            r['sample'] = os.path.normpath(os.path.join(root, r['sample'].replace('\\', '/')))
        regions.append(r)
    return control, regions


def cc_defaults(control, regions):
    """MIDI CC values before any controller moves: set_ccN from <control> or any header, else 0."""
    cc = {}
    for opcodes in [control, *regions]:
        for k, v in opcodes.items():
            m = re.match(r'set_cc(\d+)$', k)
            if m:
                cc.setdefault(int(m.group(1)), float(v))
    return cc


if __name__ == '__main__':
    key = int(sys.argv[2]) if len(sys.argv) > 2 else None
    for r in program(sys.argv[1])[1]:
        if key is None or r['lokey'] <= key <= r['hikey']:
            extra = {k: v for k, v in r.items() if re.match(r'(lo|hi)cc|amplitude|volume|seq_|trigger', k)}
            print(r['lokey'], r['hikey'], r['lovel'], r['hivel'], os.path.basename(r['sample']), extra)
