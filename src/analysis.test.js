import { analyze, analyzeProgression, detectKey, resolveStep } from './analysis.js';
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
