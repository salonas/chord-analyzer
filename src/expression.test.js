import { exDefaults, expressPattern } from './expression.js';
import { instDefaults } from './data.js';
import fx from './test/fixtures/expression.json';
import importer from './test/fixtures/importer.json';
import turnaround from './test/fixtures/turnaround.json';
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
