"""Converts the Rock Corpus (RS 200, harmonic analyses .har) into theory cases.

Usage: python -I tools/corpus_rock.py <rs200_harmony folder> <output folder>

Source: https://rockcorpus.midside.com (de Clercq and Temperley), CC BY 4.0. The cases are Adapted Material.
The corpus gives Roman numerals and keys, not notes: each numeral is realized in root position (close position, root between
C3 and B3), with the given bass when it carries an inversion figure. Only the tonic and the key changes are used as expected
values. A chord that cannot be realized without interpreting it is dropped and counted; a song that loses more than a tenth of
its chords is skipped.
"""
import glob
import json
import os
import re
import sys
from collections import Counter

MAJ = {'I': 0, 'II': 2, 'III': 4, 'IV': 5, 'V': 7, 'VI': 9, 'VII': 11}
IVALS = {'maj': [0, 4, 7], 'min': [0, 3, 7], 'dim': [0, 3, 6], 'aug': [0, 4, 8], 'dom7': [0, 4, 7, 10],
         'maj7': [0, 4, 7, 11], 'min7': [0, 3, 7, 10], 'hdim7': [0, 3, 6, 10], 'dim7': [0, 3, 6, 9]}
HEAD = re.compile(r'^(?P<acc>[b#]?)(?P<rn>VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(?P<rest>.*)$')
REST = re.compile(r'^(?P<pre>[dhxoa]?)(?P<fig>7|65|43|42|64|6)?$')
KEY = re.compile(r'^\[([A-G])([b#]?)\]$')
LET = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
INV = {None: 0, '7': 0, '6': 1, '65': 1, '64': 2, '43': 2, '42': 3}


def strip(line):
    return line.split('%')[0].strip()


def load_rules(path):
    rules = {}
    for ln in open(path, encoding='utf-8', errors='replace').read().splitlines():
        ln = strip(ln)
        if ':' not in ln:
            continue
        name, rhs = ln.split(':', 1)
        rules[name.strip()] = rhs.split()
    return rules


def accidental(a):
    return 1 if a == '#' else -1 if a == 'b' else 0


def realize(tok, tonic):
    """-> (notes, None) or (None, reason)"""
    head, _, target = tok.partition('/')
    m = HEAD.match(head)
    if not m:
        return None, 'not a Roman numeral'
    rn = m.group('rn')
    upper = rn.isupper()
    r = REST.match(m.group('rest'))
    if not r:
        return None, 'figure outside the converted set'
    pre, fig = r.group('pre'), r.group('fig')
    base = tonic
    if target:
        tm = HEAD.match(target)
        if not tm or tm.group('rest'):
            return None, 'applied target outside the converted set'
        base = (tonic + MAJ[tm.group('rn').upper()] + accidental(tm.group('acc'))) % 12
    root = (base + MAJ[rn.upper()] + accidental(m.group('acc'))) % 12
    seventh = fig in ('7', '65', '43', '42')
    if pre == 'd':
        q = 'dom7' if seventh else None
    elif pre == 'h':
        q = 'hdim7' if seventh else None
    elif pre == 'x':
        q = 'dim7' if seventh else None
    elif pre == 'o':
        q = 'dim' if fig in (None, '6', '64') else None
    elif pre == 'a':
        q = 'aug' if fig is None else None
    elif seventh:
        q = 'dom7' if (rn == 'V' and not m.group('acc')) else 'maj7' if upper else 'min7'
    else:
        q = 'maj' if upper else 'min'
    if q is None:
        return None, 'figure outside the converted set'
    tones = [root + i for i in IVALS[q]]
    k = INV[fig]
    if k >= len(tones):
        return None, 'inversion not valid for the chord'
    tones = [t + 12 if i < k else t for i, t in enumerate(tones)]
    low = 48 + (root % 12)
    shift = low - root
    return sorted(t + shift for t in tones), None


def meter_beats(tok):
    m = re.match(r'^\[(\d+)/(\d+)\]$', tok)
    return int(m.group(1)) * 4 / int(m.group(2)) if m else None


def expand(rules, name, key, beats, out, depth=0):
    if depth > 24 or name not in rules:
        raise ValueError('rule ' + name)
    toks = rules[name]
    bar, bars = [], []
    for tk in toks:
        if tk == '|':
            bars.append(bar)
            bar = []
        elif tk.startswith('|*'):
            for _ in range(int(tk[2:])):
                bars.append([])
        else:
            bar.append(tk)
    if bar:
        bars.append(bar)
    for b in bars:
        # a bar splits its beats equally among its chord symbols; keys and meters apply from where they appear
        slots = [t for t in b if not (KEY.match(t) or meter_beats(t) is not None or t == '[0]' or t.startswith('$') or re.match(r'^\*\d+$', t))]
        n_slots = max(1, len(slots))
        for t in b:
            km = KEY.match(t)
            if km:
                key = (LET[km.group(1)] + accidental(km.group(2))) % 12
                continue
            if meter_beats(t) is not None:
                beats = meter_beats(t)
                continue
            if t == '[0]' or re.match(r'^\*\d+$', t):
                continue
            if t.startswith('$'):
                nm, _, rep = t[1:].partition('*')
                for _ in range(int(rep) if rep else 1):
                    expand(rules, nm, key, beats, out, depth + 1)
                continue
            if t == '.':
                if out:
                    out[-1]['dur'] += beats / n_slots
                continue
            if t == 'R':
                continue
            out.append({'token': t, 'tonic': key, 'dur': beats / n_slots})
    return key


def convert(path, stats):
    rules = load_rules(path)
    if 'S' not in rules:
        stats['analysis without S'] += 1
        return None
    first = rules['S'][0] if rules['S'] else ''
    km = KEY.match(first)
    if not km:
        stats['analysis whose S does not start with a key'] += 1
        return None
    key0 = (LET[km.group(1)] + accidental(km.group(2))) % 12
    out = []
    try:
        expand(rules, 'S', key0, 4.0, out)
    except (ValueError, RecursionError):
        stats['analysis with an undefined or looping rule'] += 1
        return None
    chords, dropped = [], Counter()
    for ev in out:
        notes, why = realize(ev['token'], ev['tonic'])
        if notes is None:
            dropped[ev['token'] + ' (' + why + ')'] += 1
            continue
        chords.append({'token': ev['token'], 'tonic': ev['tonic'], 'notes': notes, 'dur': round(ev['dur'], 3)})
    n_drop = sum(dropped.values())
    if not chords or n_drop > 0.1 * len(out):
        stats['analysis skipped: more than a tenth of the chords not converted'] += 1
        return None
    dur = Counter()
    for c in chords:
        dur[c['tonic']] += c['dur']
    main = max(dur, key=lambda k: dur[k])
    regions = []
    for i, c in enumerate(chords):
        if regions and regions[-1]['tonic'] == c['tonic']:
            regions[-1]['to'] = i
        else:
            regions.append({'tonic': c['tonic'], 'from': i, 'to': i})
    for c, d in dropped.items():
        stats['chord dropped: ' + c] += d
    stats['chords converted'] += len(chords)
    stats['chords dropped'] += n_drop
    return {'mainTonic': main, 'regions': regions, 'chords': chords, 'dropped': n_drop}


def main():
    src, out = sys.argv[1], sys.argv[2]
    stats = Counter()
    songs = {}
    for path in sorted(glob.glob(os.path.join(src, '*.har'))):
        m = re.match(r'^(.*)_(dt|tdc)\.har$', os.path.basename(path))
        if not m:
            stats['file name outside the pattern'] += 1
            continue
        song, who = m.groups()
        r = convert(path, stats)
        if r is not None:
            songs.setdefault(song, {})[who] = r
            stats['analyses converted'] += 1
    os.makedirs(out, exist_ok=True)
    header = {
        'source': 'Rock Corpus RS 200 v2.1 (harmonic analyses), Trevor de Clercq and David Temperley',
        'sourceUrl': 'https://rockcorpus.midside.com/',
        'license': 'CC BY 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/legalcode.en',
        'modified': 'Converted by chord-analyzer (tools/corpus_rock.py), 2026: the .har rules were expanded into chord lists and each Roman numeral was realized as notes in root position (the corpus has no notes). Not the original files.',
        'analysts': {'dt': 'David Temperley', 'tdc': 'Trevor de Clercq'},
        'units': 'notes: MIDI numbers; dur: beats; tonic: pitch class 0-11 (the corpus does not say major or minor)',
    }
    for song, by in sorted(songs.items()):
        with open(os.path.join(out, song + '.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump({**header, 'song': song, 'analyses': by}, f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')
    stats['songs with at least one analysis'] = len(songs)
    with open(os.path.join(out, 'skipped.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'note': 'Counts of what the converter did not turn into cases (see corpus/README.md).', 'stats': dict(sorted(stats.items()))},
                  f, ensure_ascii=False, indent=1)
        f.write('\n')
    print(json.dumps({k: v for k, v in sorted(stats.items()) if not k.startswith('chord dropped')}, indent=1))


main()
