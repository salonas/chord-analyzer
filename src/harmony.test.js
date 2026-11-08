import { harmonySegs, splitHarmony } from './harmony.js';
import { parseText, progText } from './text.js';
import { T } from './data.js';
import { setLang } from './i18n.js';
import { PREFS } from './test/helpers.js';

// The default MIDI (src/default_in_c.mid): Cmaj7 Am7 Dm7 G7 under a tune, with a passing bass and an inner voice
const ROWS = '48 0 1|59 0 2|64 0 2|67 0 2|50 1 .5|49 1.5 .5|48 2 1.25|60 2 .5|59 2.5 1|64 2.5 1|67 2.5 1|69 2.5 1|64 3.5 .5|45 4 1|55 4 1|60 4 1|64 4 1|67 4 1|65 5 .5|64 5.5 .5|65 6 .5|53 6.5 1|50 7.5 .5|50 8 .5|60 8 .5|65 8 .5|69 8 .5|55 8.5 .5|69 9 .5|72 9.5 .5|43 10 1|53 10 .5|59 10 1|62 10 1|50 10.5 .5|65 11 .5|69 11.5 .5';
const pattern = rows => ({ id: 'p', name: 'Turnaround', beats: 4, names: {},
  notes: rows.split('|').map((r, i) => { const [m, s, l] = r.split(' ').map(Number); return { id: 'n' + i, m, s: s * T, l: l * T, v: 100 }; }) });
const beats = t => t / T;

describe('splitHarmony', () => {
  const r = splitHarmony(pattern(ROWS));
  it('finds the four chords, not one per note', () => {
    expect(r.chords.map(c => [beats(c.a), beats(c.b), c.notes])).toEqual([
      [0, 4, [48, 59, 64, 67]], [4, 8, [45, 55, 60, 64, 67]], [8, 10, [50, 60, 65, 69]], [10, 12, [43, 53, 59, 62]]]);
  });
  it('keeps the passing bass and the added voices inside the chord', () => {
    expect(r.chords[0].bass.map(b => [b.m, beats(b.s), !!b.pass])).toEqual([[48, 0, false], [50, 1, true], [49, 1.5, true], [48, 2, false]]);
    expect(r.chords[0].adds.map(a => [a.m, beats(a.s)])).toEqual([[60, 2], [69, 2.5]]);
    expect(r.chords[3].adds.map(a => [a.m, beats(a.s)])).toEqual([[50, 10.5]]);
  });
  it('lists the tune apart', () => {
    expect(r.mel.map(m => [m.notes[0], beats(m.s)])).toEqual([[64, 3.5], [65, 5], [64, 5.5], [65, 6], [53, 6.5], [50, 7.5], [55, 8.5], [69, 9], [72, 9.5], [65, 11], [69, 11.5]]);
  });
  it('a note doubled in octaves with no chord around is one melody note', () => {
    const d = splitHarmony(pattern('48 0 1|60 0 1|64 .5 .5'));
    expect([d.chords.length, d.mel.map(m => m.notes)]).toEqual([0, [[48, 60], [64]]]);
  });
  // a broken accompaniment under a tune: read beat by beat where no chord has started
  it('reads an Alberti bass under a held tune as chords, and the chord owns the bass notes, not the tune', () => {
    const d = splitHarmony(pattern('48 0 .5|55 .5 .5|52 1 .5|55 1.5 .5|76 0 2|79 2 2|48 2 .5|55 2.5 .5|52 3 .5|55 3.5 .5'));
    expect(d.chords.map(c => [beats(c.a), beats(c.b), c.notes])).toEqual([[0, 4, [48, 52, 55, 76, 79]]]);
    const S = harmonySegs(pattern('48 0 .5|55 .5 .5|52 1 .5|55 1.5 .5|76 0 2|79 2 2|48 2 .5|55 2.5 .5|52 3 .5|55 3.5 .5'));
    expect([...S[0].ids].sort()).toEqual(['n0', 'n1', 'n2', 'n3', 'n6', 'n7', 'n8', 'n9']);
  });
  it('leaves a fast legato scale as notes, even with three pitch classes in a beat', () => {
    expect(splitHarmony(pattern('60 0 .3|62 .25 .3|64 .5 .3|65 .75 .3|67 1 .3|69 1.25 .3|71 1.5 .3|72 1.75 .3')).chords).toEqual([]);
  });
  it('a note in octaves plus its fifth is a power chord, even when the fifth moves on first', () => {
    const d = splitHarmony(pattern('38 0 4|50 0 4|62 0 4|69 0 3|72 1.5 1.5|70 3 1'));
    expect(d.chords.map(c => [beats(c.a), beats(c.b), c.notes])).toEqual([[0, 4, [38, 50, 62, 69]]]);
    expect(d.mel.map(m => m.notes[0])).toEqual([72, 70]);
  });
  it('plain blocks stay one chord per block, a lone note too', () => {
    expect(splitHarmony(pattern('48 0 2|52 0 2|55 0 2|67 2 2')).chords.map(c => c.notes)).toEqual([[48, 52, 55], [67]]);
  });
  it('block chords struck again are new chords, even when one contains the other', () => {
    expect(splitHarmony(pattern('48 0 4|52 0 4|55 0 4|48 4 4|52 4 4|55 4 4|59 4 4')).chords.map(c => c.notes)).toEqual([[48, 52, 55], [48, 52, 55, 59]]);
  });
});

describe('harmonySegs', () => {
  it('gives the lane four chords whose ids leave the tune out', () => {
    const p = pattern(ROWS), S = harmonySegs(p), mel = new Set(['n12', 'n18', 'n36']);
    expect(S.map(s => [beats(s.a), beats(s.b), s.sig])).toEqual([[0, 4, '48,59,64,67'], [4, 8, '45,55,60,64,67'], [8, 10, '50,60,65,69'], [10, 12, '43,53,59,62']]);
    expect(S.flatMap(s => [...s.ids]).filter(id => mel.has(id))).toEqual([]);
    expect(S[0].ids.size).toBe(12);
  });
});

describe('harmony and melody in the text', () => {
  const t = progText(pattern(ROWS), PREFS), L = t.split('\n');
  // «(breve)» says only what is detected: D3 and D♭3 are short notes under the chord (D3 is a neighbour, not a passing tone)
  it('writes four chord lines and no lone note as a chord', () => {
    expect(L.filter(l => /^\d+\. /.test(l))).toEqual([
      '1. Cmaj7 | Imaj7 (tónica · 0,1) | 0–4 | B3 E4 G4 (+C4 en 2 · +A4 en 2,5) | C3 → D3 (breve) → D♭3 (breve) → C3',
      '2. Am7 | vi7 (tónica · 0,13) | 4–8 | G3 C4 E4 G4 | A2',
      '3. Dm7 | ii7 (subdominante · 0,28) | 8–10 | C4 F4 A4 | D3',
      '4. G7 | V7 (dominante · 0,68) | 10–12 | F3 B3 D4 (+D3 en 10,5) | G2']);
  });
  it('explains each melody note against its chord', () => {
    expect(L).toContain('E4 (64) | 3.5 | 0.5 | Cmaj7 | 3 | baja (0,15) | nota del acorde');
    expect(L).toContain('F4 (65) | 5 | 0.5 | Am7 | ♭6 | alta (0,85) | bordadura');
    expect(L).toContain('A4 (69) | 11.5 | 0.5 | G7 | 9 | media (0,5) | tensión');
  });
  it('a note outside its chord that the next chord owns, just before the change, is an anticipation', () => {
    const t = progText(pattern('48 0 4|52 0 4|55 0 4|50 4 4|53 4 4|57 4 4|72 .5 .5|77 2.5 .5'), PREFS);
    expect(t).toContain('F5 (77) | 2.5 | 0.5 | C | 4 | alta (0,85) | anticipación → Dm');
  });
  it('a note of the next chord that is not the last before the change is a tension, not an anticipation', () => {
    expect(L).toContain('D3 (50) | 7.5 | 0.5 | Am7 | 4 | media (0,5) | anticipación → Dm7');
    expect(L).toContain('F3 (53) | 6.5 | 1 | Am7 | ♭6 | alta (0,85) | tensión');
    expect(L).toContain('G3 (55) | 8.5 | 0.5 | Dm7 | 4 | media (0,5) | tensión');
  });
  it('reads back the exact notes and the chord names', () => {
    const back = parseText(t, PREFS).projects[0].patterns[0];
    expect(back.notes.length).toBe(37);
    expect(back.steps.map(s => [s.name, s.notes])).toEqual([['Cmaj7', [48, 59, 64, 67]], ['Am7', [45, 55, 60, 64, 67]], ['Dm7', [50, 60, 65, 69]], ['G7', [43, 53, 59, 62]]]);
  });
  it('writes a power chord as E(5), never E5', () => {
    const p = pattern('40 0 4|47 0 4|64 1 .5');
    expect(progText(p, PREFS).split('\n').find(l => l.startsWith('1. '))).toMatch(/^1\. E\(5\) \| /);
  });
});

// Two notes struck together for less than a beat are no chord in a pattern of blocks either (audit of 4 Nov 2026, C04;
// THEORY.md, «Dos notas cortas no son un acorde»)
describe('two short notes in a pattern of blocks', () => {
  // X07: Dm (3 beats), C–E and D–F of half a beat, Gm (3 beats), A–C and B♭–D, A, Dm
  const X07 = '50 0 3|53 0 3|57 0 3|62 0 3|60 3 .5|64 3 .5|62 3.5 .5|65 3.5 .5|43 4 3|55 4 3|58 4 3|62 4 3|57 7 .5|60 7 .5|58 7.5 .5|62 7.5 .5|45 8 4|57 8 4|61 8 4|64 8 4|50 12 4|57 12 4|62 12 4|65 12 4';
  const chords = rows => splitHarmony(pattern(rows)).chords.map(c => [beats(c.a), beats(c.b), c.notes, c.adds.map(x => [x.m, beats(x.s)])]);
  it('are ornaments of the chord before them, which lasts their time and keeps its notes', () => {
    expect(chords(X07)).toEqual([[0, 4, [50, 53, 57, 62], [[60, 3], [64, 3], [65, 3.5]]], [4, 8, [43, 55, 58, 62], [[57, 7], [60, 7]]],
      [8, 12, [45, 57, 61, 64], []], [12, 16, [50, 57, 62, 65], []]]);
  });
  it('go to the chord after them when none sounds right before', () => {
    expect(chords('60 0 .5|64 0 .5|48 .5 4|52 .5 4|55 .5 4')).toEqual([[0, 4.5, [48, 52, 55], [[60, 0], [64, 0]]]]);
  });
  it('stay as they were in a run longer than a beat or with no chord next to them (two voices in eighths)', () => {
    expect(chords('60 0 .5|64 0 .5|62 .5 .5|65 .5 .5|64 1 .5|67 1 .5|48 1.5 4|52 1.5 4|55 1.5 4').length).toBe(4);
    expect(chords('60 0 .5|64 0 .5|62 .5 .5|65 .5 .5').length).toBe(2);
  });
  it('three notes of half a beat, or two of a beat, are still a chord', () => {
    expect(chords('48 0 3|52 0 3|55 0 3|50 3 .5|57 3 .5|62 3 .5|43 3.5 4|55 3.5 4|59 3.5 4').length).toBe(3);
    expect(chords('48 0 3|52 0 3|55 0 3|53 3 1|57 3 1|43 4 4|55 4 4|59 4 4').length).toBe(3);
  });
  it('take the text out of the one-line-per-step form, as added notes of their chord', () => {
    const t = progText(pattern(X07), PREFS);
    expect(t).toContain('# Armonía');
    expect(t).toContain('1. Dm | i (tónica · 0,13) | 0–4 | F3 A3 D4 (+C4 en 3 · +E4 en 3 · +F4 en 3,5) | D3');
    expect(t).toContain('# Patrones: Menor i–iv–V');
  });
});

// With a tune in the pattern, the top of a struck chord an octave or more above the next voice, over a chord of three or
// more pitch classes, carries the tune on (manual test of 2 Nov 2026, P5 and P6)
describe('the top of a chord that carries the tune on', () => {
  const P5 = '36 0 4|48 0 4|52 0 4|55 0 4|76 0 1|74 1 1|72 2 2|33 4 4|45 4 4|48 4 4|52 4 4|72 4 1|71 5 1|69 6 2|29 8 4|41 8 4|45 8 4|48 8 4|69 8 1|67 9 1|65 10 2|31 12 4|43 12 4|47 12 4|50 12 4|74 12 1|71 13 1|67 14 2|36 16 4|48 16 4|52 16 4|55 16 4|72 16 4';
  const last = rows => splitHarmony(pattern(rows)).mel.map(x => [x.notes[0], beats(x.s)]).at(-1);
  it('takes the last note of the tune out of the last chord (P5)', () => {
    const r = splitHarmony(pattern(P5));
    expect(last(P5)).toEqual([72, 16]);
    expect(r.chords.at(-1).notes).toEqual([36, 48, 52, 55]);
  });
  it('asks an octave or more above the next voice: E4 over G3 stays in the chord, C5 does not', () => {
    const head = '48 0 4|52 0 4|55 0 4|76 0 1|74 1 1|72 2 2|48 4 4|52 4 4|55 4 4|';
    expect(last(head + '64 4 4')).toEqual([72, 2]);
    expect(last(head + '72 4 4')).toEqual([72, 4]);
  });
  it('asks for a tune elsewhere in the pattern: a held chord with a wide top stays a chord', () => {
    expect(splitHarmony(pattern('36 0 8|48 0 4|52 0 4|55 0 4|72 0 4|53 4 4|57 4 4|60 4 4|77 4 4')).mel).toEqual([]);
  });
});

describe('top voice', () => {
  // brimstone-03-pattern-3: the tune moves with the chords, so only the highest voice gives it
  const BRIMSTONE = '38 0 4|50 0 4|62 0 4|69 0 3|72 1.5 1.5|70 3 1|37 4 4|46 4 2|57 4 2|61 4 4|65 4 2|53 5 2|45 6 2|67 6 2|49 7 1|41 8 4|50 8 2|62 8 4|69 8 3|72 9.5 1.5|53 10 2|69 11 1|70 11 1|39 12 4|49 12 4|55 12 2|61 12 4|67 12 4|70 12 2|57 14 2|72 14 2|38 16 4|50 16 3|62 16 4|69 16 1.5|45 17 1|69 17.5 1|72 17.5 1|46 18 1|70 18.5 1.5|74 18.5 1.5|50 19 1|37 20 4|43 20 3|53 20 3|61 20 4|65 20 2|72 20 2|67 22 2|70 22 2|45 23 1|55 23 1|41 24 2|57 24 2|62 24 4|69 24 2|41 26 2|46 26 2|58 26 2|70 26 2|72 26 2|39 28 2|55 28 2|61 28 4|69 28 2|39 30 2|48 30 2|58 30 2|67 30 2';
  const r = splitHarmony(pattern(BRIMSTONE));
  it('lists the highest note of each attack, not what is under another voice', () => {
    expect(r.top.map(x => [x.notes[0], beats(x.s)]).slice(0, 8)).toEqual([[69, 0], [72, 1.5], [70, 3], [65, 4], [67, 6], [69, 8], [72, 9.5], [70, 11]]);
  });
  // «# Melodía» and «# Voz superior» never go together (manual test, P5 and P6): the tune found is 3 of its 19 notes
  it('is read instead of the tune when the tune found covers under half of it', () => {
    const t = progText(pattern(BRIMSTONE), { ...PREFS, octConv: 'fl' }).split('\n');
    expect(t.filter(l => /^# (Melodía|Voz superior):/.test(l)).map(l => l.split(':')[0])).toEqual(['# Voz superior']);
    expect(t).toContain('C6 (72) | 1.5 | 1.5 | D(5) | ♭7 | media (0,5) | tensión');
  });
  it('is not repeated when the tune is already most of it', () => {
    expect(progText(pattern(ROWS), PREFS)).not.toMatch(/# Voz superior/);
  });
  it('reads back without turning its lines into chords', () => {
    const back = parseText(progText(pattern(BRIMSTONE), PREFS), PREFS).projects[0].patterns[0];
    expect(back.notes.length).toBe(BRIMSTONE.split('|').length);
  });
});

// «(breve)» / «(short)»: a bass note that does not start with the chord, sounds under all its notes and lasts half a beat or less
describe('short bass notes', () => {
  // C (E3 G3 C4) held four beats, C2 for the first two, then half a beat of A1 reached by a leap
  const rows = '52 0 4|55 0 4|60 0 4|36 0 2|33 2 .5';
  it('marks the short note under the chord, whatever its function, in both languages', () => {
    expect(progText(pattern(rows), PREFS).split('\n').find(l => l.startsWith('1. '))).toMatch(/\| C2 → A1 \(breve\)$/);
    setLang('en');
    try { expect(progText(pattern(rows), PREFS).split('\n').find(l => l.startsWith('1. '))).toMatch(/\| C2 → A1 \(short\)$/); } finally { setLang('es'); }
  });
});
