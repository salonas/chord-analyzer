import { parseMidi, separatePatterns, separateVoices } from './importer.js';
import fx from './test/fixtures/importer.json';
import turnaround from './test/fixtures/turnaround.json';
import { clone, fromHex, noId } from './test/helpers.js';

const PATTERNS = { turnaround: turnaround.patterns[0], melody: fx.separate.melodyPattern };
const ids = r => ({ mel: r.mel.map(n => n.id), bass: r.bass.map(n => n.id), chords: r.chords.map(n => n.id) });

describe('parseMidi', () => {
  it.each(Object.keys(fx.parseMidi))('%s', k => {
    const c = fx.parseMidi[k], buf = fromHex(c.hex).buffer;
    if (c.error) { expect(() => parseMidi(buf)).toThrow(c.error); return; }
    const r = parseMidi(buf);
    expect(r.tempo).toBe(c.tempo);
    expect(r.tracks.map(t => ({ name: t.name, notes: noId(t.notes) }))).toEqual(c.tracks);
  });
});

describe('separateVoices', () => {
  it('splits the turnaround into a melody of 3 notes, a bass of 4 and chords of 9', () => {
    const r = separateVoices(clone(PATTERNS.turnaround), clone(fx.separate.options.default));
    expect([r.mel.length, r.bass.length, r.chords.length]).toEqual([3, 4, 9]);
  });
  for (const [pn, expected] of Object.entries(fx.separate.results)) {
    it.each(Object.keys(expected))(`${pn}, options %s`, on => {
      expect(ids(separateVoices(clone(PATTERNS[pn]), clone(fx.separate.options[on])))).toEqual(expected[on]);
    });
  }
});

describe('separatePatterns', () => {
  it.each(Object.keys(fx.separate.forms))('%s gives the patterns of «Separar voces»', pn => {
    const p = clone(PATTERNS[pn]), opt = clone(fx.separate.options.default);
    const made = separatePatterns(p, separateVoices(p, opt), opt);
    expect(clone(made.map(q => ({ name: q.name, beats: q.beats, inst: q.inst, names: q.names, notes: noId(q.notes) })))).toEqual(fx.separate.forms[pn].slice(1));
  });
});
