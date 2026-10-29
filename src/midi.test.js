import { buildPack, midiFile, zipFiles } from './midi.js';
import fx from './test/fixtures/midi.json';
import turnaround from './test/fixtures/turnaround.json';
import { PREFS, PREFS_BY, clone, fixDate, fromHex, hex, sha256 } from './test/helpers.js';

const bytesOf = async blob => new Uint8Array(await blob.arrayBuffer());

describe('midiFile', () => {
  it('writes the turnaround in 216 bytes with the default preferences', () => {
    const r = midiFile(clone(turnaround.patterns[0]), 90, PREFS);
    expect(r.bytes.length).toBe(216);
    expect(r.skipped).toBe(0);
  });
  for (const [name, prefs] of Object.entries(PREFS_BY)) {
    it(`turnaround with ${name} preferences`, () => {
      const r = midiFile(clone(turnaround.patterns[0]), 90, prefs);
      expect(hex(r.bytes)).toBe(fx.midi[name].turnaround.hex);
      expect(r.skipped).toBe(fx.midi[name].turnaround.skipped);
    });
    it(`notes above MIDI 127 with ${name} preferences`, () => {
      const c = fx.midi[name].high, r = midiFile(clone(c.input), c.bpm, prefs);
      expect(hex(r.bytes)).toBe(c.hex);
      expect(r.skipped).toBe(c.skipped);
    });
  }
  it('drum pattern without chord markers', () => {
    const c = fx.midi.default.drums, r = midiFile(clone(c.input), c.bpm, PREFS);
    expect(hex(r.bytes)).toBe(c.hex);
  });
});

describe('zipFiles', () => {
  beforeEach(fixDate);
  afterEach(() => vi.useRealTimers());
  it('stores the files byte for byte', async () => {
    const z = await bytesOf(zipFiles(fx.zip.input.map(f => ({ name: f.name, data: fromHex(f.hex) }))));
    expect(z.length).toBe(fx.zip.length);
    expect(hex(z)).toBe(fx.zip.hex);
  });
});

describe('buildPack', () => {
  beforeEach(fixDate);
  afterEach(() => vi.useRealTimers());
  it('packs the turnaround with an empty library in 6 files', () => {
    expect(buildPack(clone(turnaround), [], PREFS).files.length).toBe(6);
  });
  it.each(Object.keys(fx.packs))('%s', async k => {
    const c = fx.packs[k], pk = buildPack(clone(c.project), clone(c.chords), c.prefs);
    expect([pk.nprog, pk.nchord, pk.skipped, pk.base]).toEqual([c.nprog, c.nchord, c.skipped, c.base]);
    expect(pk.files.map(f => ({ name: f.name, length: f.data.length, sha256: sha256(f.data) }))).toEqual(c.files);
    const z = await bytesOf(zipFiles(pk.files));
    expect({ length: z.length, sha256: sha256(z) }).toEqual(c.zip);
  });
});
