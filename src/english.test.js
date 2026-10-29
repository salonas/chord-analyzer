import { INSTRUMENTS, TYPES, intervalName } from './data.js';
import { FN_NAME, PATTERNS, analyzeProgression, inversionText, analyze, keyName } from './analysis.js';
import { FEELINGS, exDefaults, exprSummary, expressPattern } from './expression.js';
import { DRUMS, GROOVES, expressDrums, genGroove } from './drums.js';
import { libText, parseText, progText, projectText } from './text.js';
import { buildPack } from './midi.js';
import { parseMidi, separatePatterns, separateVoices } from './importer.js';
import { EXAMPLE, normProg, normProject } from './model.js';
import { instDefaults } from './data.js';
import { HTML_EN, setLang } from './i18n.js';
import fx from './test/fixtures/text.json';
import ifx from './test/fixtures/importer.json';
import mfx from './test/fixtures/midi.json';
import turnaround from './test/fixtures/turnaround.json';
import { PREFS, PREFS_BY, clone, fixDate, fromHex, noId, sha256 } from './test/helpers.js';

// Words that only the Spanish export writes; none may be left in the English one
const SPANISH = /Proyecto|Tonalidad|Patrones|Final:|Instrumento|Expresi[oó]n|Formato|Notas|Octavas|tiempos?\b|semilla|comp[aá]s|t[oó]nica|dominante|funci[oó]n|cient[ií]fica|sensibilidad|recorte|octava\b|Gen[eé]rico|golpes|Bater[ií]a ·|Acordes guardados|mayor|menor|Cadencia|Ciclo|seleccionadas|todas\b/;
const parsedNoId = r => { const o = clone(r); o.projects.forEach(pr => pr.patterns.forEach(pt => { pt.notes = noId(pt.notes); })); return o; };
const inEnglish = f => { setLang('en'); try { return f(); } finally { setLang('es'); } };
const TURNAROUND_EN = `# Project: Ejemplo: turnaround en Do
# 90 BPM · 4/4 time · humanize seed 20261027 · 1 pattern
# Octaves: scientific (C4 = MIDI 60)

# Pattern: Turnaround
# Estimated key: C major · total 12 beats (3 bars)
# Patterns: Turnaround I–vi–ii–V; ii–V–I; Circle of fifths (3 chords in a row)
# Ending: Half cadence (ends on V)
# Instrument: Generic (no adjustment) · velocity limits 1–127 · used 100 · sensitivity 100 % · accents 100 % · humanize velocity 100 % · low trim 0/octave below C2 · high trim 0/octave above C7
# Format: n. chord | degree (function · tension 0–1) | notes | MIDI | length — octaves: scientific (C4 = MIDI 60)
1. Cmaj7 | Imaj7 (tonic · 0.1) | C3 B3 E4 G4 | 48 59 64 67 | 4 beats
2. Am7 | vi7 (tonic · 0.13) | A2 G3 C4 E4 | 45 55 60 64 | 4 beats
3. Dm7 | ii7 (subdominant · 0.28) | D3 C4 F4 A4 | 50 60 65 69 | 2 beats
4. G7 | V7 (dominant · 0.68) | G2 F3 B3 D4 | 43 53 59 62 | 2 beats`;

afterEach(() => setLang('es'));

describe('English text export', () => {
  it('writes the turnaround in English', () => {
    expect(inEnglish(() => projectText(clone(turnaround), PREFS))).toBe(TURNAROUND_EN);
  });
  it('keeps the same numbers and note names as the Spanish export, line by line', () => {
    for (const prefs of Object.values(PREFS_BY)) {
      const es = projectText(clone(turnaround), prefs).split('\n'), en = inEnglish(() => projectText(clone(turnaround), prefs)).split('\n');
      expect(en.length).toBe(es.length);
      const chordLine = /^\d+\. /;
      es.forEach((l, i) => { if (chordLine.test(l)) expect(en[i].split(' | ').filter((_, j) => j !== 1 && j !== 4)).toEqual(l.split(' | ').filter((_, j) => j !== 1 && j !== 4)); });
    }
  });
  it('leaves no Spanish word in the project, the library, the exact notes or a drum pattern', () => {
    const texts = inEnglish(() => [
      ...Object.values(PREFS_BY).map(prefs => projectText(clone(turnaround), prefs)),
      projectText(clone(fx.loose.project), PREFS),
      libText({ chords: clone(fx.lib.chords), projects: clone(fx.lib.projects) }, PREFS),
      progText(clone(fx.drums.project.patterns[0]), PREFS),
    ]);
    texts.forEach(t => expect(t).not.toMatch(SPANISH));
  });
  it('writes the exact-notes block as «# Notes» and decimals with a point', () => {
    const t = inEnglish(() => projectText(clone(fx.loose.project), PREFS));
    expect(t).toContain('\n# Notes (exact): note | MIDI | start | length | velocity | channel');
    expect(t).toContain('\n# Harmony: n. chord | degree (function · tension 0–1) | start–end (beats) | voices | bass');
    expect(t).toContain('\nC5 (72) | 2 | 0.75 | C(no5) | 1 | low | chord tone');
    expect(t).not.toMatch(/\d,\d/);
  });
  it('writes the applied expression as «# Expression» with the scope in English', () => {
    const p = clone(turnaround.patterns[0]);
    expressPattern(p, p.notes.slice(0, 3), exDefaults('triste'), 7, false, PREFS);
    expect(p.expr.scope).toBe('3 seleccionadas');
    const line = inEnglish(() => progText(p, PREFS)).split('\n').find(l => l.startsWith('# Expression: '));
    expect(line).toBe('# Expression: Sad / melancholic on Generic (no adjustment) · base 56 · contrast 60 % · voices 12 · accent 3 · diminuendo 14 over 4 bars · contour 5 · harmonic tension 6 · appoggiaturas 12 · cadence -12 · humanize velocity ±3 · timing 0 (seed 7) · notes: 3 selected');
  });
  it('writes a drum pattern with its pieces and expression in English', () => {
    const notes = genGroove('rock', 1, 0, false).map((n, i) => ({ ...n, id: 'd' + i }));
    const p = { id: 'patD', name: 'Drums', beats: 4, names: {}, v: 2, inst: instDefaults('bateria'), notes };
    expressDrums(p, p.notes, exDefaults('agresivo'), 7, false);
    const L = inEnglish(() => progText(p, PREFS)).split('\n');
    expect(L.slice(0, 2)).toEqual(['# Pattern: Drums', `# Drums · ${p.notes.length} hits · total 3.75 beats`]);
    expect(L[2]).toMatch(/^# Instrument: Drums and percussion · /);
    expect(L[3]).toMatch(/^# Expression: Aggressive on Drums and percussion · drum rules · .* · hits: all$/);
    expect(L[5]).toBe('C2 | 36 | 0 | 0.25 | ' + p.notes.find(n => n.m === 36 && n.s === 0).v + ' | Kick (clean)');
  });
});

describe('importing text in both languages', () => {
  for (const [name, prefs] of Object.entries(PREFS_BY)) {
    it(`the English export reads back the same as the Spanish one, with ${name} preferences`, () => {
      const en = inEnglish(() => projectText(clone(turnaround), prefs));
      expect(parsedNoId(parseText(en, prefs))).toEqual(fx[name].parsed);
      expect(parsedNoId(inEnglish(() => parseText(en, prefs)))).toEqual(fx[name].parsed);
      const es = projectText(clone(turnaround), prefs);
      expect(parsedNoId(inEnglish(() => parseText(es, prefs)))).toEqual(fx[name].parsed);
    });
  }
  it('round trip in English: export, import and export again gives the same text', () => {
    const back = inEnglish(() => {
      const t = projectText(clone(fx.loose.project), PREFS), r = parseText(t, PREFS).projects[0];
      const pr = normProject({ id: 'x', name: r.name, bpm: r.bpm, seed: r.seed, patterns: r.patterns.map(ps => normProg({ id: 'p', name: ps.name, beats: 4, notes: ps.notes, names: {} })), active: 'p' });
      return [t, projectText(pr, PREFS)];
    });
    expect(back[1]).toBe(back[0]);
  });
  it('the exact notes come back from «# Notes»', () => {
    const t = inEnglish(() => projectText(clone(fx.loose.project), PREFS));
    expect(parsedNoId(parseText(t, PREFS))).toEqual(fx.loose.parsed);
  });
  it('the library comes back from «# Saved chords»', () => {
    const t = inEnglish(() => libText({ chords: clone(fx.lib.chords), projects: clone(fx.lib.projects) }, PREFS));
    const es = libText({ chords: clone(fx.lib.chords), projects: clone(fx.lib.projects) }, PREFS);
    expect(parsedNoId(parseText(t, PREFS))).toEqual(parsedNoId(parseText(es, PREFS)));
  });
  it('the English placeholder of the importer reads like the Spanish one', () => {
    const es = Object.keys(HTML_EN).find(k => k.startsWith('# Proyecto: Mi tema'));
    const steps = t => parseText(t, PREFS).projects.flatMap(pr => pr.patterns.flatMap(pt => pt.steps.map(({ notes, beats }) => ({ notes, beats }))));
    expect(steps(HTML_EN[es])).toEqual(steps(es));
    expect(parseText(HTML_EN[es], PREFS).projects[0].patterns[0].steps.map(s => s.beats)).toEqual([4, 2, undefined]);
  });
  it('a pattern without a project header is «Imported» in English', () => {
    expect(inEnglish(() => parseText('C3 E3 G3', PREFS)).projects[0].name).toBe('Imported');
    expect(parseText('C3 E3 G3', PREFS).projects[0].name).toBe('Importado');
  });
});

describe('English pack', () => {
  beforeEach(fixDate);
  afterEach(() => vi.useRealTimers());
  const toEn = n => n.replace('/1 Progresiones/', '/1 Progressions/').replace('/2 Acordes sueltos/', '/2 Single chords/').replace('/3 Biblioteca de acordes/', '/3 Chord library/').replace(/ sobre /g, ' over ');
  it.each(Object.keys(mfx.packs))('%s: English folders, the same .mid bytes', k => {
    const c = mfx.packs[k], es = buildPack(clone(c.project), clone(c.chords), c.prefs), en = inEnglish(() => buildPack(clone(c.project), clone(c.chords), c.prefs));
    expect(en.files.map(f => f.name)).toEqual(es.files.map(f => toEn(f.name)));
    en.files.forEach((f, i) => { if (f.name.endsWith('.mid')) expect(sha256(f.data)).toBe(sha256(es.files[i].data)); });
    expect(en.files.some(f => /\/(1 Progresiones|2 Acordes sueltos|3 Biblioteca de acordes)\//.test(f.name))).toBe(false);
  });
  it('a slash chord is named «C over E»', () => {
    const p = normProg({ id: 'p', name: 'Slash', beats: 4, steps: [{ notes: [52, 60, 67], beats: 4 }] });
    const pr = normProject({ id: 'x', name: 'Slash', bpm: 90, seed: 1, patterns: [p], active: 'p' });
    const names = inEnglish(() => buildPack(pr, [], PREFS)).files.map(f => f.name);
    expect(names).toContain('slash/2 Single chords/01 Slash/01 - C over E (I6).mid');
    expect(buildPack(pr, [], PREFS).files.map(f => f.name)).toContain('slash/2 Acordes sueltos/01 Slash/01 - C sobre E (I6).mid');
  });
});

describe('English labels of the tables', () => {
  const both = get => { const es = get(); return [es, inEnglish(get)]; };
  it('every chord type, instrument, feeling, groove, drum piece and pattern has an English name', () => {
    const lists = [
      () => TYPES.map(t => t.name), () => Object.values(INSTRUMENTS).map(i => i.label), () => Object.values(INSTRUMENTS).map(i => i.group),
      () => Object.values(FEELINGS).map(f => f.label), () => Object.values(GROOVES).map(g => g.label), () => PATTERNS.map(p => p.name),
      () => Object.values(DRUMS).map(d => d.n), () => Object.values(DRUMS).map(d => d.s), () => Object.values(DRUMS).map(d => d.ch),
      () => Array.from({ length: 12 }, (_, i) => intervalName(i)), () => Object.keys(FN_NAME).map(k => FN_NAME[k]),
    ];
    for (const get of lists) {
      const [es, en] = both(get);
      expect(en.length).toBe(es.length);
      expect(en.filter(x => typeof x !== 'string' || !x.trim())).toEqual([]);
      expect(en.join(' ')).not.toMatch(/[áéíóúñ]/i);
    }
    expect(inEnglish(() => INSTRUMENTS.bateria.label)).toBe('Drums and percussion');
    expect(inEnglish(() => TYPES.find(t => t.sym === 'maj7').name)).toBe('major seventh');
  });
  it('inversions, keys and cadences', () => {
    const c = analyze([52, 60, 67], null)[0];
    expect([inversionText(c), inEnglish(() => inversionText(c))]).toEqual(['1ª inversión', '1st inversion']);
    const A = analyzeProgression([{ notes: [55, 59, 62, 65] }, { notes: [48, 52, 55] }], PREFS);
    expect([keyName(A.key, PREFS), A.cad]).toEqual(['C mayor', 'Cadencia auténtica (V → I)']);
    const B = inEnglish(() => analyzeProgression([{ notes: [55, 59, 62, 65] }, { notes: [48, 52, 55] }], PREFS));
    expect([inEnglish(() => keyName(B.key, PREFS)), B.cad]).toEqual(['C major', 'Authentic cadence (V → I)']);
  });
  it('the expression summary of a flat application', () => {
    const e = { flat: true, base: 90, inst: instDefaults('piano') };
    expect([exprSummary(e), inEnglish(() => exprSummary(e))]).toEqual(['todo a la base (90) en Piano', 'all at the base (90) on Piano']);
  });
});

describe('English names made by the importer and the example', () => {
  it('MIDI errors', () => {
    for (const k of ['badHeader', 'smpte']) {
      const buf = fromHex(ifx.parseMidi[k].hex).buffer;
      expect(() => inEnglish(() => parseMidi(buf))).toThrow(k === 'badHeader' ? 'not a MIDI file (the MThd header is missing)' : 'uses SMPTE time, which is not supported');
    }
  });
  it('«Separate voices» names the patterns in English and keeps the chord names on the chords one', () => {
    const p = clone(turnaround.patterns[0]), opt = clone(ifx.separate.options.default);
    const made = inEnglish(() => separatePatterns(p, separateVoices(p, opt), opt));
    expect(made.map(q => q.name)).toEqual(['Turnaround · Melody', 'Turnaround · Chords', 'Turnaround · Bass']);
    expect(made.map(q => Object.keys(q.names).length > 0)).toEqual([false, Object.keys(p.names).length > 0, false]);
  });
  it('the example project', () => {
    expect([EXAMPLE().name, inEnglish(() => EXAMPLE().name)]).toEqual(['Ejemplo: turnaround en Do', 'Example: turnaround in C']);
  });
});
