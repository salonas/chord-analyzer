import { exDefaults, expressPattern } from './expression.js';
import { instDefaults } from './data.js';
import fx from './test/fixtures/expression.json';
import importer from './test/fixtures/importer.json';
import turnaround from './test/fixtures/turnaround.json';
import { normProg } from './model.js';
import { PREFS, clone } from './test/helpers.js';

// Same figures as «Aplicar expresión» in the single-file version, for every feeling
describe('expressPattern', () => {
  it.each(fx.runs.map(r => [r.case, r.inst, r.feel, r]))('%s · %s · %s', (kind, inst, feel, r) => {
    const p = clone(kind === 'melody' ? importer.separate.melodyPattern : turnaround.patterns[0]);
    if (kind !== 'melody') p.inst = instDefaults(inst);
    const ns = r.sel.length ? p.notes.filter(n => r.sel.includes(n.id)) : p.notes;
    if (kind === 'twice') expressPattern(p, ns, exDefaults(feel), turnaround.seed, false, PREFS);
    expressPattern(p, ns, exDefaults(feel), turnaround.seed, r.flat, PREFS);
    expect(clone(p.notes.map(({ id, v, l, l0 }) => ({ id, v, l, l0 })))).toEqual(r.notes);
    expect(clone(p.expr)).toEqual(r.expr);
  });
});

// The roles are the ones of the exported text (J01 and J03 of the theory probe): a passing tone on the beat is not an appoggiatura
describe('expressPattern roles', () => {
  const T = 96;
  const pattern = (chord, mel) => normProg({ id: 'p', name: 'p', beats: 4, names: {},
    notes: [...chord.map((m, i) => ({ id: 'c' + i, m, s: 0, l: 4 * T, v: 100 })), ...mel.map(([m, s, l], i) => ({ id: 'm' + i, m, s: s * T, l: l * T, v: 100 }))] });
  // the velocity each melody note gains (or loses) when the appoggiatura slider goes from 0 to 20
  const shift = (p) => {
    const vel = apoy => { const q = clone(p); const napp = expressPattern(q, q.notes, { ...exDefaults('neutro'), apoy, human: 0 }, 1, false, PREFS); return { napp, v: q.notes.map(n => n.v) }; };
    const a = vel(0), b = vel(20);
    return { napp: b.napp, delta: b.v.map((v, i) => v - a.v[i]).slice(3) };
  };
  it('lifts an appoggiatura and lightens its resolution', () => {
    const r = shift(pattern([48, 52, 55], [[62, 0, 1], [60, 1, 3]]));
    expect(r.napp).toBe(2);
    expect(r.delta[0]).toBeGreaterThan(0);
    expect(r.delta[1]).toBeLessThan(0);
  });
  it('treats a passing tone on the beat as a passing tone', () => {
    const r = shift(pattern([48, 52, 55], [[64, 0, 1], [65, 1, 1], [67, 2, 2]]));
    expect(r.napp).toBe(1);
    expect(r.delta[0]).toBe(0);
    expect(r.delta[1]).toBeLessThan(0);
    expect(r.delta[2]).toBe(0);
  });
});
