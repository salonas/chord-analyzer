import { GM_NAMES, gmName, gmNote, gmSamples } from './gm.js';
import { trackPat } from './model.js';

describe('General MIDI soundfont', () => {
  it('names the 128 programs in GM order', () => {
    expect(GM_NAMES.length).toBe(128);
    expect([0, 32, 56, 127].map(gmName)).toEqual(['Acoustic Grand Piano', 'Acoustic Bass', 'Trumpet', 'Gunshot']);
  });
  it('names notes as the rendered files do, with flats', () => {
    expect([21, 60, 61, 70, 108].map(gmNote)).toEqual(['A0', 'C4', 'Db4', 'Bb4', 'C8']);
  });
  it('loads every fourth note from A0 to C8, covering all keys', () => {
    const xs = gmSamples(56);
    expect(xs.length).toBe(22);
    expect(xs[0]).toMatchObject({ k: 21, lo: 0, hi: 22 });
    expect(xs.at(-1)).toMatchObject({ k: 105, lo: 103, hi: 127 });
    expect(xs.every((x, i) => i === 0 || x.lo === xs[i - 1].hi + 1)).toBe(true);
    expect(xs[9].url).toMatch(/\/FluidR3_GM\/trumpet-mp3\/A3\.mp3$/);
  });
  it('gives a track its program to sound, unless it was switched off', () => {
    const p = { bend: null }, inst = { preset: 'lead' };
    expect(trackPat(p, { id: 'a', name: 'A', inst, prog: 56 }).prog).toBe(56);
    expect('prog' in trackPat(p, { id: 'a', name: 'A', inst, prog: 56, gm: false })).toBe(false);
    expect('prog' in trackPat(p, { id: 'a', name: 'A', inst })).toBe(false);
  });
});
