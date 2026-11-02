import { CTX, DISS, FN_TENSION, analyze, analyzeProgression, detectKey, resolveStep, tenDetail, tensionHelp } from './analysis.js';
import { setLang } from './i18n.js';
import { EXAMPLE, segs, segStep } from './model.js';
import fx from './test/fixtures/analysis.json';
import turnaround from './test/fixtures/turnaround.json';
import { PREFS_BY, clone } from './test/helpers.js';

const simpleCand = c => ({ root: c.root, sym: c.type.sym, missing: c.missing.map(d => d.label), score: c.score, slash: c.slash, bass: c.bass });
const simpleSpelled = s => ({ midi: s.midi, l: s.l, a: s.a, oct: s.oct, deg: s.deg ? s.deg.label : null });
const simpleProg = A => ({
  labels: A.rs.map(r => r.label),
  spelled: A.rs.map(r => r.spelled.map(simpleSpelled)),
  romans: A.romans.map(r => r && { text: r.text, deg: r.deg, base: r.base, token: r.token, diatonic: r.diatonic, secondary: !!r.secondary }),
  key: A.key || null, alt: A.alt || null, found: A.found, cad: A.cad ?? null, fn: A.fn ?? null, ten: A.ten ?? null,
});

describe('EXAMPLE', () => {
  it('builds the turnaround project of the fixtures', () => {
    const ex = EXAMPLE();
    ex.id = 'proj1'; ex.patterns[0].id = 'pat1'; ex.active = 'pat1';
    ex.patterns[0].notes.forEach((n, i) => n.id = 'n' + i);
    expect(clone(ex)).toEqual(turnaround);
  });
});

describe('analyze', () => {
  it.each(fx.analyze.map(c => [c.notes.join(' ') || '(empty)', c.locked, c]))('%s, locked root %s', (_, locked, c) => {
    expect(clone(analyze(c.notes, locked).map(simpleCand))).toEqual(c.cands);
  });
});

describe('resolveStep', () => {
  for (const [name, prefs] of Object.entries(PREFS_BY)) {
    it.each(fx.resolve[name].map(c => [c.notes.join(' ') || '(empty)', c]))(`%s with ${name} preferences`, (_, c) => {
      const { label, spelled, ...step } = c;
      const r = resolveStep(clone(step), prefs);
      expect(r.label).toBe(label);
      expect(clone(r.spelled.map(simpleSpelled))).toEqual(spelled);
    });
  }
});

describe('detectKey', () => {
  it.each(Object.keys(fx.detect))('%s', k => {
    expect(clone(detectKey(clone(fx.detect[k].items)))).toEqual(fx.detect[k].ranking);
  });
});

describe('analyzeProgression', () => {
  it('names the turnaround Cmaj7, Am7, Dm7, G7 with the default preferences', () => {
    const p = clone(turnaround.patterns[0]);
    const A = analyzeProgression(segs(p).map(S => segStep(p, S)), PREFS_BY.default);
    expect(A.rs.map(r => r.label)).toEqual(['Cmaj7', 'Am7', 'Dm7', 'G7']);
    expect(A.romans.map(r => r.text)).toEqual(['Imaj7', 'vi7', 'ii7', 'V7']);
  });
  for (const [name, prefs] of Object.entries(PREFS_BY)) {
    it.each(Object.keys(fx.progs))(`%s with ${name} preferences`, k => {
      expect(clone(simpleProg(analyzeProgression(clone(fx.progs[k]), prefs)))).toEqual(fx.progressions[name][k]);
    });
  }
});

describe('chord types 13♯11 and 7(no3)', () => {
  const P = PREFS_BY.default;
  it('names D A C as D7(no3), chords 2 and 16 of brimstone-03-pattern-3', () => {
    for (const notes of [[38, 50, 62, 69, 72], [38, 45, 50, 62, 69, 72]]) {
      const r = resolveStep({ notes }, P);
      expect(r.label).toBe('D7(no3)');
      expect([...new Set(r.spelled.map(s => s.deg.label))]).toEqual(['1', '5', '♭7']);
    }
  });
  it('names E♭ D♭ A G C as E♭13♯11, chord 13 of brimstone-03-pattern-3', () => {
    const r = resolveStep({ notes: [39, 49, 57, 61, 67, 72] }, P);
    expect(r.label).toBe('E♭13♯11');
    expect(r.spelled.map(s => s.deg.label)).toEqual(['1', '♭7', '♯11', '♭7', '3', '13']);
    expect(r.c.missing.map(d => d.label)).toEqual(['5', '9']);
  });
  it('keeps the existing names when the third or the 13th is there', () => {
    expect(resolveStep({ notes: [38, 54, 57, 60] }, P).label).toBe('D7');
    expect(resolveStep({ notes: [36, 52, 55, 58, 62, 66] }, P).label).toBe('C9♯11');
  });
  it('reads both as dominant chords in a progression', () => {
    const A = analyzeProgression([{ notes: [38, 50, 57, 60] }, { notes: [43, 55, 59, 62] }], P);
    expect(A.romans.map(r => r.text)).toEqual(['V7(no3)', 'I']);
    expect(A.fn).toEqual(['D', 'T']);
    const B = analyzeProgression([{ notes: [39, 49, 57, 61, 67, 72] }, { notes: [38, 50, 54, 57] }], P);
    expect(B.romans.map(r => r.text)).toEqual(['♭II13♯11', 'I']);
  });
});

describe('D minor with a Phrygian ♭II (brimstone-03-pattern-3)', () => {
  const steps = [[38, 50, 62, 69], [41, 50, 62, 69], [37, 45, 55, 61, 67, 70], [39, 49, 55, 61, 67, 70], [38, 50, 62, 69]].map(notes => ({ notes }));
  const A = analyzeProgression(steps, PREFS_BY.default);
  it('reads D minor, not B♭ major', () => {
    expect([A.key.tonic, A.key.mode]).toEqual([2, 'minor']);
  });
  it('names the D–F–A chord Dm/F instead of F6 without its fifth', () => {
    expect(A.rs.map(r => r.label)).toEqual(['D5', 'Dm/F', 'A7♭9/C♯', 'E♭7', 'D5']);
    expect(A.romans.map(r => r.text)).toEqual(['I5', 'i⁶', 'V7♭9 en 1ª inversión', '♭II7', 'I5']);
  });
  it('spells B♭ and C♯ after the key and writes no double accidental', () => {
    const spelled = A.rs.flatMap(r => r.spelled);
    expect(spelled.filter(s => s.midi === 70).every(s => s.l === 6 && s.a === -1)).toBe(true);
    expect(spelled.filter(s => s.midi === 61).every(s => s.l === 0 && s.a === 1)).toBe(true);
    expect(spelled.some(s => Math.abs(s.a) > 1)).toBe(false);
  });
  it('keeps the sharps when the preference asks for them, still without double accidentals', () => {
    const B = analyzeProgression(steps, { ...PREFS_BY.default, accPref: 'sharp' });
    expect([B.key.tonic, B.key.mode]).toEqual([2, 'minor']);
    expect(B.rs[3].label).toBe('D♯7');
    expect(B.rs.flatMap(r => r.spelled).some(s => Math.abs(s.a) > 1)).toBe(false);
  });
});

describe('tension with context', () => {
  const N = { C: [48, 52, 55], F: [53, 57, 60], G7: [43, 47, 50, 53], Am: [45, 48, 52], E7: [40, 44, 47, 50], A7: [45, 49, 52, 55], D7: [50, 54, 57, 60] };
  const run = names => analyzeProgression(names.map(n => ({ notes: N[n] })), PREFS_BY.default);
  it('writes the breakdown for the tooltip', () => {
    const A = run(['C', 'F', 'G7', 'Am']);
    expect([0, 3].map(i => tenDetail(A, i))).toEqual(['base 0,1', 'base 0,13 + sorpresa 0,15 = 0,28']);
    expect(tenDetail(run(['C', 'F', 'G7', 'C']), 3)).toBe('base 0,1 − llegada 0,15 = 0');
    setLang('en');
    try { expect(tenDetail(A, 3)).toBe('base 0.13 + surprise 0.15 = 0.28'); } finally { setLang('es'); }
  });
  it('adds no more than the maximum for a chain of dominants (T07)', () => {
    const A = run(['C', 'E7', 'A7', 'D7', 'G7', 'C']);
    expect(A.tenCtx.map(c => c && c.val)).toEqual([null, null, 0.05, 0.1, 0.1, -0.15]);
    A.tenCtx.forEach(c => { if (c && c.rule === 'wait') expect(c.val).toBeLessThanOrEqual(CTX.waitMax); });
  });
  it('keeps the total as the base plus the context', () => {
    const A = run(['C', 'F', 'G7', 'Am']);
    expect(A.ten[3]).toBeCloseTo(A.tenBase[3] + A.tenCtx[3].val, 2);
  });
  it('writes the help of the Expression tab from the constants', () => {
    const n = x => String(x).replace('.', ',');
    const h = tensionHelp();
    for (const x of [FN_TENSION.T, FN_TENSION.S, FN_TENSION.D, FN_TENSION.C, DISS.maj, DISS.dim, CTX.surprise, CTX.wait, CTX.waitMax, Math.abs(CTX.arrival)]) expect(h).toContain(n(x));
  });
});

// a note outside the key that the chord leaves out and that goes a semitone up takes the letter under its goal (decision 14)
describe('spelling a chromatic ornament by where it goes', () => {
  const held = (ms, a, l = 384) => ms.map(m => ({ m, s: a, l }));
  // C E G with a note on the last beat, then the chord whose notes start when it ends
  const prog = (orn, next, prefs = PREFS_BY.default, timed = true) => {
    const steps = [{ notes: [48, 52, 55, orn], dur: 384, a: 0, evs: [...held([48, 52], 0), { m: 55, s: 0, l: 288 }, { m: orn, s: 288, l: 96 }] },
      { notes: next, dur: 384, a: 384, evs: held(next, 384) }];
    const A = analyzeProgression(timed ? steps : steps.map(({ notes, dur }) => ({ notes, dur })), prefs);
    const n = A.rs[0].spelled.find(x => x.midi === orn);
    return { name: 'CDEFGAB'[n.l] + ['b', '', '#'][n.a + 1], chord: A.rs[0].label };
  };
  it('writes G♯ when it goes to A, and leaves the chord as it was', () => {
    expect(prog(56, [53, 57, 60])).toEqual({ name: 'G#', chord: 'C' });
  });
  it('keeps A♭ when it goes down to G', () => {
    expect(prog(56, [48, 52, 55]).name).toBe('Ab');
  });
  it('keeps the accidentals the user chose and steps with no timing', () => {
    expect(prog(56, [53, 57, 60], PREFS_BY.alt).name).toBe('Ab');
    expect(prog(56, [53, 57, 60], PREFS_BY.default, false).name).toBe('Ab');
  });
  // D – G – A7 – D with C on the last sixteenth of G, going to the C♯ of A7: the letter under C♯ would be B♯
  it('keeps a natural note that goes up to its own letter: C → C♯ in D major, not B♯ → C♯', () => {
    const steps = [{ notes: [50, 54, 57], dur: 384, a: 0, evs: held([50, 54, 57], 0) },
      { notes: [43, 47, 50, 60], dur: 384, a: 384, evs: [...held([43, 47, 50], 384), { m: 60, s: 720, l: 48 }] },
      { notes: [45, 49, 52, 55, 61], dur: 384, a: 768, evs: held([45, 49, 52, 55, 61], 768) },
      { notes: [50, 54, 57], dur: 384, a: 1152, evs: held([50, 54, 57], 1152) }];
    const A = analyzeProgression(steps, PREFS_BY.default), n = A.rs[1].spelled.find(x => x.midi === 60);
    expect([A.key.tonic, A.key.mode, A.rs[1].label]).toEqual([2, 'major', 'G']);
    expect([n.l, n.a]).toEqual([0, 0]);
  });
  // C7 – F7 – C7 with E♭ for a beat going to E: the blue note over the tonic I7 is ♭3, not ♯9
  it('keeps the blue note E♭ over a tonic I7 when it goes up to E', () => {
    const steps = [{ notes: [48, 52, 55, 58], dur: 384, a: 0, evs: held([48, 52, 55, 58], 0) },
      { notes: [53, 57, 60, 63], dur: 384, a: 384, evs: held([53, 57, 60, 63], 384) },
      { notes: [48, 52, 55, 58, 63, 64], dur: 384, a: 768, evs: [...held([48, 52, 55, 58], 768), { m: 63, s: 768, l: 48 }, { m: 64, s: 816, l: 336 }] }];
    const A = analyzeProgression(steps, PREFS_BY.default), n = A.rs[2].spelled.find(x => x.midi === 63);
    expect([A.key.tonic, A.key.mode, A.rs[2].label]).toEqual([0, 'major', 'C7']);
    expect([n.l, n.a]).toEqual([2, -1]);
  });
});
