import { expressDrums, genGroove } from './drums.js';
import { exDefaults } from './expression.js';
import { instDefaults } from './data.js';
import { progText } from './text.js';
import fx from './test/fixtures/drums.json';
import { PREFS, clone, noId } from './test/helpers.js';

describe('genGroove', () => {
  it.each(Object.keys(fx.grooves))('%s', k => {
    const [style, bars, fill, crash] = k.split('-');
    expect(noId(genGroove(style, +bars, +fill, crash === 'true'))).toEqual(fx.grooves[k]);
  });
});

describe('expressDrums', () => {
  it.each(fx.runs.map(r => [r.style, r.feel, r]))('%s · %s', (style, feel, r) => {
    const notes = genGroove(style, 4, 4, true).map((n, i) => ({ ...n, id: 'd' + i }));
    const p = { id: 'patD', name: 'Batería', beats: 4, names: {}, v: 2, inst: instDefaults('bateria'), notes };
    expressDrums(p, p.notes, exDefaults(feel), 7, false);
    expect(p.notes.map(n => n.id).join(',')).toBe(r.ids);
    expect(p.notes.map(n => n.v)).toEqual(r.v);
    expect(clone(p.expr)).toEqual(r.expr);
    if (r.drumText) expect(progText(p, PREFS)).toBe(r.drumText);
  });
});
