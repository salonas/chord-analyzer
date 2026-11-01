import { defaultProject, multiPattern, parseMidi, separatePatterns, separateVoices, splitTracks } from './importer.js';
import { glidePlan } from './glide.js';
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

describe('parseMidi channels', () => {
  const bytes = a => new Uint8Array(a).buffer;
  const trk = d => [0x4D, 0x54, 0x72, 0x6B, 0, 0, 0, d.length + 4, ...d, 0, 0xFF, 0x2F, 0];
  const hdr = (n, fmt = n === 1 ? 0 : 1) => [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, fmt, 0, n, 0, 96];
  const on = (ch, m) => [0, 0x90 | ch, m, 100, 96, 0x80 | ch, m, 0];
  it('splits the single track of a format 0 file into one track per channel', () => {
    const r = parseMidi(bytes([...hdr(1), ...trk([...on(0, 60), ...on(1, 64)])]));
    expect(r.tracks.map(t => [t.name, t.notes.map(n => [n.m, n.ch])])).toEqual([['ch 1', [[60, 0]]], ['ch 2', [[64, 1]]]]);
  });
  it('leaves a format 1 track that mixes channels as one', () => {
    const r = parseMidi(bytes([...hdr(1, 1), ...trk([...on(0, 60), ...on(1, 64)])]));
    expect(r.tracks.length).toBe(1);
  });
  it('keeps a track of one channel as it is', () => {
    const r = parseMidi(bytes([...hdr(2), ...trk(on(0, 60)), ...trk(on(1, 64))]));
    expect(r.tracks.length).toBe(2);
  });
});

describe('defaultProject', () => {
  it('adds a portamento and slide test pattern after the turnaround', () => {
    const pr = defaultProject();
    expect(pr.patterns.length).toBe(2);
    expect(pr.active).toBe(pr.patterns[0].id);
    expect(pr.patterns[1].notes.map(n => n.g || null)).toEqual([null, 'p', null, 's']);
    expect(glidePlan(pr.patterns[1]).skipped).toBe(0);
  });
});

describe('multitrack patterns', () => {
  const tracks = [
    { name: 'Lead', notes: [{ id: 'a', m: 72, s: 0, l: 96, v: 100, ch: 0 }] },
    { name: 'Kit', notes: [{ id: 'b', m: 36, s: 0, l: 48, v: 90, ch: 9 }, { id: 'c', m: 38, s: 96, l: 48, v: 90, ch: 9 }] },
  ];
  it('puts every track in one pattern, the kit track on drums', () => {
    const p = multiPattern('Song', tracks);
    expect(p.tracks.map(t => [t.name, t.inst.preset])).toEqual([['Lead', 'lead'], ['Kit', 'bateria']]);
    expect(p.notes.map(n => p.tracks.findIndex(t => t.id === n.tr))).toEqual([0, 1, 1]);
    expect(p.notes.some(n => 'ch' in n)).toBe(false);
  });
  it('splits back into a pattern per track with its instrument', () => {
    const q = splitTracks(multiPattern('Song', tracks));
    expect(q.map(x => [x.name, x.notes.length, x.inst.preset, x.tracks])).toEqual([['Lead', 1, 'lead', undefined], ['Kit', 2, 'bateria', undefined]]);
    expect(q.every(x => x.notes.every(n => !('tr' in n)))).toBe(true);
  });
});
