import { flScript } from './flscript.js';
import { buildPack } from './midi.js';
import { instDefaults } from './data.js';
import turnaround from './test/fixtures/turnaround.json';
import { PREFS, clone } from './test/helpers.js';

// D3 held with a slide to E3 on top, then a portamento to F3
const pat = () => ({ id: 'g', name: 'Slides "FL"', beats: 4, names: {}, inst: instDefaults('bajo'), notes: [
  { id: 'a', m: 50, s: 0, l: 384, v: 100 },
  { id: 'b', m: 52, s: 96, l: 48, v: 90, g: 's' },
  { id: 'c', m: 53, s: 384, l: 96, v: 110, g: 'p' },
] });

describe('flScript', () => {
  it('writes each note with its own slide and portamento flags, in start order', () => {
    const { text, skipped } = flScript(pat(), PREFS);
    expect(skipped).toBe(0);
    expect(text).toContain('    (50, 0, 384, 100, False, False),\n    (52, 96, 48, 90, True, False),\n    (53, 384, 96, 110, False, True),');
    expect(text).toContain('NAME = "Slides \\"FL\\""');
    expect(text).toContain('import flpianoroll as flp');
    expect(text).toContain('def apply(form):');
  });
  it('moves notes with the MIDI shift and leaves out the ones past the MIDI range', () => {
    const p = pat(); p.notes.push({ id: 'x', m: 125, s: 0, l: 96, v: 100 });
    const { text, skipped } = flScript(p, { ...PREFS, midiShift: 12 });
    expect(skipped).toBe(1);
    expect(text).toContain('(62, 0, 384, 100, False, False)');
  });
  it('goes in the pack only for patterns with glides, so other packs keep their bytes', () => {
    const pr = { ...clone(turnaround), patterns: [...clone(turnaround).patterns, pat()] };
    const names = buildPack(pr, [], PREFS).files.map(f => f.name).filter(n => n.endsWith('.pyscript'));
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/\/4 Scripts de FL\/\d\d Slides FL\.pyscript$/);
    expect(buildPack(clone(turnaround), [], PREFS).files.some(f => f.name.endsWith('.pyscript'))).toBe(false);
  });
});
