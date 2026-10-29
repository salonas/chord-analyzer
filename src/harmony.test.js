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
    expect(L).toContain('E4 (64) | 3.5 | 0.5 | Cmaj7 | 3 | baja | nota del acorde');
    expect(L).toContain('F4 (65) | 5 | 0.5 | Am7 | ♭6 | alta | bordadura');
    expect(L).toContain('A4 (69) | 11.5 | 0.5 | G7 | 9 | media | tensión');
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
