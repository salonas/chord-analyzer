"""Converts the TAVERN corpus (Humdrum **kern + **harm) into theory cases.

Usage: python -I tools/corpus_tavern.py <TAVERN checkout> <output folder>

Source: https://github.com/jcdevaney/TAVERN, CC BY-SA 4.0. The cases are Adapted Material under the same license.
Reads only the 'Joined' files (score + analysis of annotator A or B). A label that cannot be turned into a chord without
interpreting it is skipped and counted: nothing is guessed.
"""
import glob
import json
import os
import re
import sys
from collections import Counter
from fractions import Fraction

TICKS_WHOLE = 384  # 96 ticks per quarter note, as in the app (T = 96)
LETTER = {'c': 0, 'd': 2, 'e': 4, 'f': 5, 'g': 7, 'a': 9, 'b': 11}
MAJ = {'I': 0, 'II': 2, 'III': 4, 'IV': 5, 'V': 7, 'VI': 9, 'VII': 11}
MIN = {'I': 0, 'II': 2, 'III': 3, 'IV': 5, 'V': 7, 'VI': 8, 'VII': 10}
IVALS = {'maj': [0, 4, 7], 'min': [0, 3, 7], 'dim': [0, 3, 6], 'aug': [0, 4, 8],
         'dom7': [0, 4, 7, 10], 'min7': [0, 3, 7, 10], 'hdim7': [0, 3, 6, 10], 'dim7': [0, 3, 6, 9]}
QUAL = {'maj': ('maj', False), 'min': ('min', False), 'dim': ('dim', False), 'aug': ('aug', False),
        'dom7': ('dom', True), 'min7': ('min', True), 'hdim7': ('hdim', True), 'dim7': ('dim', True)}
LABEL = re.compile(r'^(?P<acc>[-#]?)(?P<rn>VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(?P<ext>om7|oD7|o|\+|7)?(?P<inv>[bcd])?$')


def spell(letters, acc):
    return letters[0].upper() + acc.replace('-', 'b')


def parse_kern_note(tok):
    """-> (pitch name, midi, whole-note fraction, tie) or a reason string"""
    m = re.match(r'^[\(\{&\\/]*(\[?)(\d+)(\.*)(.*)$', tok)
    if not m:
        return 'grace' if re.search(r'[qQ]', tok) else 'unreadable'
    tie_open, dur, dots, rest = m.groups()
    if 'q' in rest or 'Q' in rest:
        return 'grace'
    if re.match(r'^[\(\{&\\/]*[\[]', tok):
        tie_open = '['
    if 'r' in rest and not re.search(r'[a-gA-G]', rest.replace('r', '')):
        return 'rest'
    pm = re.search(r'(a+|b+|c+|d+|e+|f+|g+|A+|B+|C+|D+|E+|F+|G+)([#\-n]*)', rest)
    if not pm:
        return 'unreadable'
    letters, acc = pm.groups()
    n = int(dur)
    frac = Fraction(2) if n == 0 else Fraction(1, n)
    frac = frac * (2 - Fraction(1, 2 ** len(dots)))
    low = letters[0].islower()
    octave = (3 + len(letters)) if low else (4 - len(letters))
    semi = acc.count('#') - acc.count('-')
    midi = 12 * (octave + 1) + LETTER[letters[0].lower()] + semi
    tie = 'start' if ('[' in tok) else 'end' if (']' in tok) else 'mid' if ('_' in tok) else None
    return (spell(letters, acc.replace('n', '')), midi, frac, tie)


def parse_file(path, stats):
    """-> dict(key, notes, events, end) or None"""
    cols, cur = [], []
    keys, notes, events, open_ties = [], [], [], {}
    inconsistent = False
    for ln in open(path, encoding='utf-8', errors='replace').read().splitlines():
        if not ln or ln.startswith('!'):
            continue
        t = ln.split('\t')
        if ln.startswith('**'):
            cols = t[:]
            cur = [Fraction(0)] * len(cols)
            continue
        if not cols:
            continue
        if ln.startswith('='):
            continue
        if ln.startswith('*'):
            ncols, ncur, i = [], [], 0
            while i < len(t):
                x = t[i]
                if re.match(r'^\*[A-Ga-g][#-]?:$', x):
                    keys.append(x[1:-1])
                if x == '*^':
                    ncols += [cols[i], cols[i]]
                    ncur += [cur[i], cur[i]]
                elif x == '*v':
                    j = i
                    while j + 1 < len(t) and t[j + 1] == '*v':
                        j += 1
                    ncols.append(cols[i])
                    ncur.append(max(cur[i:j + 1]))
                    i = j
                elif x == '*-':
                    ncols.append(cols[i])
                    ncur.append(cur[i])
                else:
                    ncols.append(cols[i])
                    ncur.append(cur[i])
                i += 1
            if len(ncols) != len(cols) or '*^' in t or '*v' in t:
                cols, cur = ncols, ncur
            continue
        if len(t) != len(cols):
            stats['bad line width'] += 1
            return None
        for i, (c, x) in enumerate(zip(cols, t)):
            if x == '.':
                continue
            if c == '**kern':
                longest = Fraction(0)
                for part in x.split(' '):
                    r = parse_kern_note(part)
                    if isinstance(r, str):
                        stats['kern: ' + r] += 1
                        if r == 'rest':
                            mm = re.match(r'^[\(\{&\\/]*(\d+)(\.*)', part)
                            if mm:
                                f = (Fraction(2) if int(mm.group(1)) == 0 else Fraction(1, int(mm.group(1)))) * (2 - Fraction(1, 2 ** len(mm.group(2))))
                                longest = max(longest, f)
                        continue
                    name, midi, frac, tie = r
                    start = cur[i]
                    longest = max(longest, frac)
                    key = (i, midi)
                    if tie in ('mid', 'end') and key in open_ties:
                        n = open_ties[key]
                        n[2] = int(round((start + frac) * TICKS_WHOLE)) - n[1]
                        if tie == 'end':
                            del open_ties[key]
                        continue
                    n = [midi, int(round(start * TICKS_WHOLE)), int(round(frac * TICKS_WHOLE)), name]
                    notes.append(n)
                    if tie == 'start':
                        open_ties[key] = n
                cur[i] += longest
            elif c == '**harm':
                m = re.match(r'^(\d+)(\.*)(.*)$', x)
                if not m:
                    stats['harm: no duration'] += 1
                    continue
                n = int(m.group(1))
                f = (Fraction(2) if n == 0 else Fraction(1, n)) * (2 - Fraction(1, 2 ** len(m.group(2))))
                events.append((int(round(cur[i] * TICKS_WHOLE)), m.group(3)))
                cur[i] += f
            elif c == '**function':
                m = re.match(r'^(\d+)(\.*)', x)
                if m:
                    n = int(m.group(1))
                    cur[i] += (Fraction(2) if n == 0 else Fraction(1, n)) * (2 - Fraction(1, 2 ** len(m.group(2))))
    end = int(round(max(cur) * TICKS_WHOLE)) if cur else 0
    return {'keys': keys, 'notes': notes, 'events': events, 'end': end}


def key_info(token):
    return {'token': token, 'tonic': (LETTER[token[0].lower()] + token.count('#') - token.count('-')) % 12,
            'mode': 'major' if token[0].isupper() else 'minor'}


def chord_for(label, key):
    """-> (expected dict, None) or (None, reason)"""
    mode = key['mode']
    table = MAJ if mode == 'major' else MIN
    if label == 'Cc':
        q = 'maj' if mode == 'major' else 'min'
        return {'root': key['tonic'], 'quality': q, 'seventh': False, 'inv': 2, 'pcs': [(key['tonic'] + i) % 12 for i in IVALS[q]],
                'degree': (0, 7), 'cad64': True}, None
    if '[' in label or label.count('/') > 1:
        return None, 'nested or bracketed applied chord'
    head, _, target = label.partition('/')
    m = LABEL.match(head)
    if not m:
        return None, 'label outside the converted set'
    acc, rn, ext, inv = m.group('acc'), m.group('rn'), m.group('ext'), m.group('inv')
    upper = rn.isupper()
    # the chord's own numeral is read in the key of the target (or the home key)
    home_tonic, home_table = key['tonic'], table
    degree_shift = 0
    if target:
        tm = re.match(r'^(?P<acc>[-#]?)(?P<rn>VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)$', target)
        if not tm:
            return None, 'applied target outside the converted set'
        if tm.group('rn').lower() == 'vii' and tm.group('rn').islower():
            return None, 'lowercase vii as an applied target'
        if tm.group('acc') and mode == 'minor':
            return None, 'altered degree in a minor key'
        trn = tm.group('rn').upper()
        d = table[trn] + (-1 if tm.group('acc') == '-' else 1 if tm.group('acc') == '#' else 0)
        home_tonic = (key['tonic'] + d) % 12
        home_table = MAJ if tm.group('rn').isupper() else MIN
    if acc and (mode == 'minor' and not target):
        return None, 'altered degree in a minor key'
    if acc and target:
        return None, 'altered degree inside an applied chord'
    rn_up = rn.upper()
    if rn.lower() == 'vii':
        if not (ext in ('o', 'om7', 'oD7')):
            return None, 'vii without o'
        d = 11
    else:
        d = home_table[rn_up] + (-1 if acc == '-' else 1 if acc == '#' else 0)
    if ext is None:
        q = 'maj' if upper else 'min'
    elif ext == '+':
        if not upper:
            return None, 'lowercase augmented'
        q = 'aug'
    elif ext == 'o':
        if upper:
            return None, 'uppercase diminished'
        q = 'dim'
    elif ext == 'om7':
        q = 'hdim7' if not upper else None
    elif ext == 'oD7':
        q = 'dim7' if not upper else None
    elif ext == '7':
        if rn == 'V' and not acc:
            q = 'dom7'
        elif not upper:
            q = 'min7'
        else:
            return None, 'uppercase 7 other than V7 is ambiguous'
    if q is None:
        return None, 'label outside the converted set'
    n_tones = len(IVALS[q])
    inv_i = {None: 0, 'b': 1, 'c': 2, 'd': 3}[inv]
    if inv_i >= n_tones:
        return None, 'inversion not valid for the chord'
    root = (home_tonic + d) % 12
    qual, sev = QUAL[q]
    return {'root': root, 'quality': qual, 'seventh': sev, 'inv': inv_i, 'pcs': [(root + i) % 12 for i in IVALS[q]],
            'degree': ((root - key['tonic']) % 12,), 'cad64': False}, None


def segments(events, end):
    """merge consecutive identical labels; a rest or null label closes the segment"""
    segs = []
    for i, (t, lab) in enumerate(events):
        nxt = events[i + 1][0] if i + 1 < len(events) else end
        if lab in ('r', '!', '') or nxt <= t:
            continue
        if segs and segs[-1]['label'] == lab and segs[-1]['b'] == t:
            segs[-1]['b'] = nxt
        else:
            segs.append({'label': lab, 'a': t, 'b': nxt})
    return segs


def main():
    src, out = sys.argv[1], sys.argv[2]
    stats, skipped = Counter(), Counter()
    phrases = {}
    for path in sorted(glob.glob(os.path.join(src, '*', '*', 'Joined', '*.krn'))):
        base = os.path.basename(path)[:-4]
        m = re.match(r'^([A-Z]+\d+_\d+_\d+[a-z]?)_([ab])$', base)
        if not m:
            stats['file name outside the pattern'] += 1
            continue
        pid, who = m.groups()
        piece = os.path.basename(os.path.dirname(os.path.dirname(os.path.dirname(path)))) + '_' + os.path.basename(os.path.dirname(os.path.dirname(path)))
        parsed = parse_file(path, stats)
        if parsed is None:
            stats['file not parsed'] += 1
            continue
        phrases.setdefault((piece, pid), {})[who] = parsed
    files = {}
    for (piece, pid), by in sorted(phrases.items()):
        if 'a' not in by or 'b' not in by:
            stats['phrase without both annotators'] += 1
            continue
        ks = set(by['a']['keys']) | set(by['b']['keys'])
        if len(ks) != 1:
            stats['phrase skipped: ' + ('no key' if not ks else 'more than one key')] += 1
            continue
        key = key_info(next(iter(ks)))
        if by['a']['notes'] != by['b']['notes']:
            stats['phrase: score differs between A and B (A kept)'] += 1
        notes = by['a']['notes']
        rec = {'id': pid, 'key': key, 'notes': notes, 'end': max(by['a']['end'], by['b']['end']), 'segs': {}}
        for who, name in (('a', 'A'), ('b', 'B')):
            out_segs = []
            for s in segments(by[who]['events'], rec['end']):
                exp, why = chord_for(s['label'], key)
                sounding = {n[0] % 12 for n in notes if n[1] < s['b'] and n[1] + n[2] > s['a']}
                if exp is None:
                    skipped[s['label'] if why == 'label outside the converted set' else why] += 1
                    stats['segments skipped: ' + why] += 1
                    out_segs.append({'a': s['a'], 'b': s['b'], 'label': s['label'], 'skip': why})
                    continue
                if exp['cad64'] and not set(exp['pcs']) <= sounding:
                    stats['segments skipped: Cc whose triad is not in the notes'] += 1
                    out_segs.append({'a': s['a'], 'b': s['b'], 'label': s['label'], 'skip': 'Cc whose triad is not in the notes'})
                    continue
                exp['complete'] = set(exp['pcs']) <= sounding
                stats['segments converted'] += 1
                if not exp['complete']:
                    stats['segments converted, chord tones missing in the notes'] += 1
                out_segs.append({'a': s['a'], 'b': s['b'], 'label': s['label'], 'exp': exp})
            rec['segs'][name] = out_segs
        files.setdefault(piece, []).append(rec)
    os.makedirs(out, exist_ok=True)
    header = {
        'source': 'TAVERN: A Dataset of Theme and Variations (Mozart and Beethoven), repo jcdevaney/TAVERN',
        'sourceUrl': 'https://github.com/jcdevaney/TAVERN',
        'sourceCommit': os.environ.get('TAVERN_COMMIT', ''),
        'license': 'CC BY-SA 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/legalcode.en',
        'modified': 'Converted by chord-analyzer (tools/corpus_tavern.py), 2026: the Humdrum scores became note lists in ticks and the **harm labels became expected chord data. Not the original files.',
        'units': 'notes: [midi, start tick, length ticks, spelling]; 96 ticks per quarter note',
    }
    for piece, recs in files.items():
        with open(os.path.join(out, piece + '.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump({**header, 'piece': piece, 'phrases': recs}, f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')
    with open(os.path.join(out, 'skipped.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'note': 'Counts of what the converter did not turn into cases (see corpus/README.md).',
                   'stats': dict(sorted(stats.items())), 'labelsOutsideTheConvertedSet': dict(skipped.most_common())}, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(json.dumps(dict(sorted(stats.items())), indent=1))


main()
