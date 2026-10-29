import { bendAt, glidePlan } from './glide.js';
import { instDefaults } from './data.js';
import { midiFile } from './midi.js';
import { parseText, progText } from './text.js';
import { PREFS, clone, hex } from './test/helpers.js';

// C4, D4 by portamento with E4 sliding on top of it, then B♭4 by portamento (6 st, out of ±2) and a slide that starts with a chord (nothing to bend: silent)
const line = () => ({ id: 'g', name: 'Glide', beats: 4, names: {}, inst: instDefaults('generico'), notes: [
  { id: 'a', m: 60, s: 0, l: 96, v: 100 },
  { id: 'b', m: 62, s: 96, l: 192, v: 100, g: 'p' },
  { id: 'c', m: 64, s: 192, l: 96, v: 100, g: 's' },
  { id: 'd', m: 70, s: 288, l: 96, v: 100, g: 'p' },
  { id: 'e', m: 60, s: 384, l: 96, v: 100 },
  { id: 'f', m: 64, s: 384, l: 96, v: 100, g: 's' },
] });

describe('glidePlan', () => {
  it('turns portamento into a new voice and a slide into the previous voice', () => {
    const { voices, glides, skipped } = glidePlan(line());
    expect(voices.map(V => [V.m, V.s, V.e])).toEqual([[60, 0, 96], [62, 96, 288], [70, 288, 384], [60, 384, 480]]);
    expect(voices[1].bend).toEqual([{ t: 96, d: -2 }, { t: 120, d: 0 }, { t: 192, d: 0 }, { t: 288, d: 2 }]);
    expect(glides.map(x => [x.n.id, x.from])).toEqual([['b', 60], ['c', 62]]);
    expect(skipped).toBe(2);
  });
  it('lets a wider bend range take the bigger jump', () => {
    const p = line(); p.bend = 12;
    expect(glidePlan(p).glides.map(x => x.n.id)).toEqual(['b', 'c', 'd']);
  });
  it('takes any jump when the range is unlimited (playback and native glides)', () => {
    const { glides, skipped } = glidePlan(line(), Infinity);
    expect(glides.map(x => [x.n.id, x.from])).toEqual([['b', 60], ['c', 62], ['d', 64]]);
    expect(skipped).toBe(1);
  });
  it('chains slides and portamentos when the first note overlaps the first glide', () => {
    // slides sit on top of the note still sounding; portamentos follow one another
    const chain = (g, c, la) => ({ notes: [
      { id: 'a', m: 56, s: 0, l: la }, { id: 'b', m: 60, s: 36, l: 24, g }, { id: 'c', m: 57, s: c, l: 48, g },
    ] });
    const s = glidePlan(chain('s', 56, 112), Infinity), p = glidePlan(chain('p', 64, 48), Infinity);
    expect([s.glides.map(x => x.n.id), s.skipped]).toEqual([['b', 'c'], 0]);
    expect(s.voices.map(V => [V.m, V.s, V.e])).toEqual([[56, 0, 112]]);
    expect([p.glides.map(x => x.n.id), p.skipped]).toEqual([['b', 'c'], 0]);
  });
  it('skips a slide once the previous note has stopped, as in FL', () => {
    const q = { notes: [{ id: 'a', m: 56, s: 0, l: 24 }, { id: 'b', m: 60, s: 12, l: 24, g: 's' }, { id: 'c', m: 56, s: 96, l: 24, g: 's' }, { id: 'd', m: 58, s: 120, l: 24, g: 's' }] };
    expect([glidePlan(q, Infinity).glides.map(x => x.n.id), glidePlan(q, Infinity).skipped]).toEqual([['b'], 2]);
  });
  it('skips a slide when another note sounds where the voice is stretched or bent', () => {
    const q = { notes: [{ id: 'x', m: 72, s: 0, l: 30 }, { id: 'a', m: 60, s: 6, l: 18 }, { id: 'b', m: 62, s: 48, l: 24, g: 's' }] };
    expect(glidePlan(q, Infinity).skipped).toBe(1);
  });
  it('keeps a slide with nothing to bend silent and cuts a glide where its note ends, as in FL', () => {
    const q = { notes: [{ id: 'a', m: 60, s: 0, l: 48 }, { id: 'b', m: 64, s: 24, l: 48, g: 's' }, { id: 'c', m: 62, s: 96, l: 24, g: 's' }] };
    const { voices, glides, skipped } = glidePlan(q, Infinity);
    expect([glides.map(x => x.n.id), skipped]).toEqual([['b'], 1]);
    expect(voices.map(V => [V.m, V.s, V.e, V.bend])).toEqual([[60, 0, 48, [{ t: 24, d: 0 }, { t: 48, d: 2 }]]]);
  });
  it('follows the curve linearly between points', () => {
    const { voices } = glidePlan(line());
    expect(bendAt(voices[1].bend, 96)).toBe(-2);
    expect(bendAt(voices[1].bend, 108)).toBe(-1);
    expect(bendAt(voices[1].bend, 240)).toBe(1);
    expect(bendAt(voices[1].bend, 300)).toBe(2);
    expect(bendAt([], 50)).toBe(0);
  });
});

describe('glides in the .mid', () => {
  const noteOns = b => [...b].filter(x => x === 0x90).length;
  it('writes pitch bend scaled to the range and back to the centre, with one note per voice', () => {
    const h = hex(midiFile(line(), 90, PREFS).bytes);
    expect(noteOns(midiFile(line(), 90, PREFS).bytes)).toBe(4);
    expect(h).toContain('e00000');   // -2 st at ±2: the bottom of the range
    expect(h).toContain('e00040');   // back to the centre (8192)
    expect(h).not.toContain('b041');
  });
  it('writes portamento controllers instead when the instrument glides by itself', () => {
    const p = line(); p.glideNative = true;
    const r = midiFile(p, 90, PREFS), h = hex(r.bytes);
    expect(noteOns(r.bytes)).toBe(5);   // the slide continues D4's voice as a legato note; the silent slide is left out
    expect(h).toContain('b0543c');   // CC84: glide from C4
    expect(h).toContain('b0543e');   // CC84: the slide from D4
    expect(h).toContain('b05440');   // CC84: glide from E4 to B♭4, past the ±2 bend range
    expect(h).toContain('b0417f');   // CC65 on
    expect(h).toContain('b04100');   // CC65 off
    expect(r.bytes.includes(0xE0)).toBe(false);
  });
  it('leaves patterns without glides as they were', () => {
    const p = line(); p.notes.forEach(n => delete n.g);
    expect(hex(midiFile(p, 90, PREFS).bytes)).not.toContain('e000');
  });
});

describe('glides in the text', () => {
  it('writes the range and the flags, and reads them back', () => {
    const p = line(); p.bend = 12; p.glideNative = true;
    const t = progText(clone(p), PREFS);
    expect(t).toContain('# Deslizamiento: bend ±12 st · nativo (CC65 y CC84)');
    expect(t).toContain('| 100 | porta');
    expect(t).toContain('| 100 | slide');
    const back = parseText(t, PREFS).projects[0].patterns[0];
    expect([back.bend, back.glideNative]).toEqual([12, true]);
    expect(back.notes.map(n => n.g || '')).toEqual(['', 'p', 's', 'p', '', 's']);
  });
});
