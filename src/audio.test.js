import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SYNTHS, channelFor } from './audio.js';

const man = JSON.parse(readFileSync('public/samples/manifest.json', 'utf8'));
const pat = (name, preset = 'generico') => ({ name, inst: { preset } });

describe('samples manifest', () => {
  it('points only at files that exist', () => {
    const files = [...Object.values(man.drums).flat(), ...Object.values(man.channels).flatMap(c => c.samples)].map(x => x.file);
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter(f => !existsSync('public/samples/' + f))).toEqual([]);
  });
  it('covers every drum note with at least one layer', () => {
    const src = readFileSync('src/drums.js', 'utf8');
    const notes = [...src.match(/const DRUMS_ES=\{([\s\S]*?)\n\};/)[1].matchAll(/(\d+):\{s:/g)].map(m => m[1]);
    expect(notes.filter(n => !man.drums[n])).toEqual([]);
  });
  it('falls back to channels that have samples or a synth preset', () => {
    expect(Object.values(man.profiles).filter(c => !man.channels[c] && !SYNTHS[(man.synths || {})[c]])).toEqual([]);
  });
  it('plays the template Pad with a synth, not the bagpipe samples', () => {
    expect(man.channels.Pad).toBeUndefined();
    expect(SYNTHS[man.synths.Pad]).toBeTruthy();
    expect(channelFor(pat('Pad', 'pad'), man)).toBe('Pad');
  });
});

describe('channelFor', () => {
  it('finds the template channel by the pattern name, with or without accents and number', () => {
    expect(channelFor(pat('Violas - 1', 'cuerdas'), man)).toBe('Violas');
    expect(channelFor(pat('violin solista - 2', 'cuerdasolista'), man)).toBe('Violín Solista');
    expect(channelFor(pat('Piano FM - 1', 'pianofm'), man)).toBe('Piano FM');
    expect(channelFor(pat('Piano - 3', 'piano'), man)).toBe('Piano');
  });
  it('takes the shortest channel that starts with a shorter pattern name', () => {
    expect(channelFor(pat('Violín - 1', 'cuerdas'), man)).toBe('Violines');
  });
  it('falls back to the default channel of the instrument profile', () => {
    expect(channelFor(pat('Mi melodía', 'flauta'), man)).toBe('Flauta');
    expect(channelFor(pat('', 'piano'), man)).toBe('Piano');
  });
  it('plays the choir, lead, church bell and chiptune channels from their samples', () => {
    expect(channelFor(pat('Coro Aahs - 1', 'voces'), man)).toBe('Coro Aahs');
    expect(channelFor(pat('Coro Oohs - 1', 'voces'), man)).toBe('Coro Oohs');
    expect(channelFor(pat('Campana (Iglesia) - 1', 'mallets'), man)).toBe('Campana (Iglesia)');
    expect(channelFor(pat('Lead - 1', 'lead'), man)).toBe('Lead');
    expect(channelFor(pat('Chiptune - 1', 'chiptune'), man)).toBe('Chiptune');
  });
  it('leaves to the oscillators a channel without samples, instead of borrowing another', () => {
    const bare = { ...man, oscillators: ['Canal sin muestras'] };
    expect(channelFor(pat('Canal sin muestras - 1', 'mallets'), bare)).toBe(null);
    expect(channelFor(pat('Algo', 'generico'), man)).toBe(null);
  });
  it('has no solo voice channel', () => {
    expect(channelFor(pat('Voz solista - 1', 'generico'), man)).toBe(null);
  });
  it('sends drum patterns to the drum kit', () => {
    expect(channelFor(pat('Batería - 1', 'bateria'), man)).toBe('drums');
  });
});
