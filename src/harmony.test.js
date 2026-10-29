import { harmonySegs, splitHarmony } from './harmony.js';
import { parseText, progText } from './text.js';
import { T } from './data.js';
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
  it('writes four chord lines and no lone note as a chord', () => {
    expect(L.filter(l => /^\d+\. /.test(l))).toEqual([
      '1. Cmaj7 | Imaj7 (tónica · 0,1) | 0–4 | B3 E4 G4 (+C4 en 2 · +A4 en 2,5) | C3 → D3 (paso) → D♭3 (paso) → C3',
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

describe('top voice', () => {
  // brimstone-03-pattern-3: the tune moves with the chords, so only the highest voice gives it
  const BRIMSTONE = '38 0 4|50 0 4|62 0 4|69 0 3|72 1.5 1.5|70 3 1|37 4 4|46 4 2|57 4 2|61 4 4|65 4 2|53 5 2|45 6 2|67 6 2|49 7 1|41 8 4|50 8 2|62 8 4|69 8 3|72 9.5 1.5|53 10 2|69 11 1|70 11 1|39 12 4|49 12 4|55 12 2|61 12 4|67 12 4|70 12 2|57 14 2|72 14 2|38 16 4|50 16 3|62 16 4|69 16 1.5|45 17 1|69 17.5 1|72 17.5 1|46 18 1|70 18.5 1.5|74 18.5 1.5|50 19 1|37 20 4|43 20 3|53 20 3|61 20 4|65 20 2|72 20 2|67 22 2|70 22 2|45 23 1|55 23 1|41 24 2|57 24 2|62 24 4|69 24 2|41 26 2|46 26 2|58 26 2|70 26 2|72 26 2|39 28 2|55 28 2|61 28 4|69 28 2|39 30 2|48 30 2|58 30 2|67 30 2';
  const r = splitHarmony(pattern(BRIMSTONE));
  it('lists the highest note of each attack, not what is under another voice', () => {
    expect(r.top.map(x => [x.notes[0], beats(x.s)]).slice(0, 8)).toEqual([[69, 0], [72, 1.5], [70, 3], [65, 4], [67, 6], [69, 8], [72, 9.5], [70, 11]]);
  });
  it('is read on its own when the tune found covers under half of it', () => {
    const t = progText(pattern(BRIMSTONE), { ...PREFS, octConv: 'fl' }).split('\n');
    expect(t.filter(l => /^# (Melodía|Voz superior):/.test(l)).length).toBe(2);
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
