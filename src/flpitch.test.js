import { readFileSync } from 'node:fs';
import { fstClip, pitchClip, pitchCurve } from './flpitch.js';
import { buildPack } from './midi.js';
import { instDefaults } from './data.js';
import turnaround from './test/fixtures/turnaround.json';
import { PREFS, clone, hex } from './test/helpers.js';

const pat = notes => ({ id: 'g', name: 'Slides', beats: 8, names: {}, inst: instDefaults('bajo'), notes });
// the example FL tested: D3 held with slides to E3, D#3 and back to D3, then D3 and three portamentos
const slides = () => pat([
  { id: 'a', m: 50, s: 0, l: 384, v: 100 },
  { id: 'b', m: 52, s: 96, l: 48, v: 100, g: 's' },
  { id: 'c', m: 51, s: 192, l: 48, v: 100, g: 's' },
  { id: 'd', m: 50, s: 288, l: 48, v: 100, g: 's' },
  { id: 'e', m: 50, s: 384, l: 96, v: 100 },
  { id: 'f', m: 52, s: 480, l: 96, v: 100, g: 'p' },
  { id: 'g', m: 53, s: 576, l: 96, v: 100, g: 'p' },
  { id: 'h', m: 51, s: 672, l: 96, v: 100, g: 'p' },
]);
const pts = c => c.points.map(x => [x.t, x.d]);

describe('pitchCurve', () => {
  it('follows the slides, holds, and jumps in one tick to each voice with its own attack', () => {
    const c = pitchCurve(slides());
    expect(pts(c)).toEqual([[0, 0], [96, 0], [144, 2], [192, 2], [240, 1], [288, 1], [336, 0],
      [479, 0], [480, -2], [504, 0], [575, 0], [576, -1], [600, 0], [671, 0], [672, 2], [696, 0]]);
    expect([c.clashes, c.skipped]).toEqual([0, 0]);
  });
  it('stays at the new pitch after a slide until another voice starts, then jumps back', () => {
    const c = pitchCurve(pat([
      { id: 'a', m: 50, s: 0, l: 192, v: 100 },
      { id: 'b', m: 55, s: 96, l: 48, v: 100, g: 's' },
      { id: 'c', m: 50, s: 288, l: 96, v: 100 },
    ]));
    expect(pts(c)).toEqual([[0, 0], [96, 0], [144, 5], [287, 5], [288, 0]]);
  });
  it('leaves jumps over 12 semitones out, as glidePlan(p, 12) does', () => {
    const c = pitchCurve(pat([
      { id: 'a', m: 40, s: 0, l: 96, v: 100 },
      { id: 'b', m: 53, s: 96, l: 96, v: 100, g: 'p' },
      { id: 'c', m: 52, s: 192, l: 96, v: 100, g: 'p' },
    ]));
    expect(c.skipped).toBe(1);
    expect(pts(c)).toEqual([[0, 0], [191, 0], [192, 1], [216, 0]]);
  });
  it('counts a voice that sounds while another is off its pitch, and keeps the bent curve', () => {
    const c = pitchCurve(pat([
      { id: 'a', m: 50, s: 0, l: 384, v: 100 },
      { id: 'b', m: 52, s: 96, l: 48, v: 100, g: 's' },
      { id: 'c', m: 57, s: 192, l: 96, v: 100 },
    ]));
    expect(c.clashes).toBe(1);
    expect(pts(c)).toEqual([[0, 0], [96, 0], [144, 2]]);
  });
  it('does not count a voice that only overlaps a settled portamento', () => {
    const c = pitchCurve(pat([
      { id: 'a', m: 50, s: 0, l: 96, v: 100 },
      { id: 'b', m: 52, s: 96, l: 192, v: 100, g: 'p' },
      { id: 'c', m: 57, s: 192, l: 96, v: 100 },
    ]));
    expect(c.clashes).toBe(0);
  });
  it('is empty without glides and for drums', () => {
    expect(pitchCurve(clone(turnaround).patterns[0]).points).toEqual([]);
    const d = slides(); d.inst = instDefaults('bateria');
    expect(pitchCurve(d).points).toEqual([]);
    expect(pitchClip(d)).toBe(null);
  });
});

describe('fstClip', () => {
  it('writes the same bytes as make-fst.py, the clip FL played right', () => {
    const want = readFileSync(new URL('./test/fixtures/fl-pitch-make-fst.fst', import.meta.url));
    const got = fstClip([[0, 0], [2, 7], [3, 7], [4, -5], [6, -5], [7, 0]].map(([b, d]) => ({ t: b * 96, d })));
    expect(hex(got)).toBe(hex(want));
  });
  it('stores positions in beats relative to the previous point and value = 0.5 + semitones / 24', () => {
    const { bytes } = pitchClip(slides());
    const dv = new DataView(bytes.buffer, bytes.byteOffset);
    const k = Buffer.from(bytes).indexOf(Buffer.from('0100000040000000', 'hex'));
    expect(dv.getUint32(k + 17, true)).toBe(16);
    const point = i => [dv.getFloat64(k + 21 + 24 * i, true), dv.getFloat64(k + 29 + 24 * i, true), dv.getFloat32(k + 37 + 24 * i, true), dv.getUint32(k + 41 + 24 * i, true)];
    expect(point(0)).toEqual([0, 0.5, 0, 0]);
    expect(point(2)).toEqual([0.5, 0.5 + 2 / 24, 0, 0x02000000]);
    expect(point(8)).toEqual([1 / 96, 0.5 - 2 / 24, 0, 0x02000000]);
    expect(dv.getUint32(18, true)).toBe(bytes.length - 22);
  });
});

describe('pack', () => {
  it('takes a pitch clip only for patterns that bend, so other packs keep their bytes', () => {
    const pr = { ...clone(turnaround), patterns: [...clone(turnaround).patterns, slides()] };
    const names = buildPack(pr, [], PREFS).files.map(f => f.name).filter(n => n.endsWith('.fst'));
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/\/5 Clips de pitch \(VST\)\/\d\d Slides\.fst$/);
    expect(buildPack(clone(turnaround), [], PREFS).files.some(f => f.name.endsWith('.fst'))).toBe(false);
  });
});
