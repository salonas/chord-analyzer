import { T, TYPES } from './data.js';
import { analyze, analyzeProgression, candSymbol, resolveStep, spellCandidate } from './analysis.js';
import { progText } from './text.js';
import { RULES } from './expression.js';
import { HTML_EN, setLang } from './i18n.js';
import { LIMITS, MUDDY, activeCands, candTags, chordDesc, chordWarnings, emptySheetText, endingText, intervalText, sheetHint, spellActive, warningText } from './panel.js';
import { against } from './roles.js';
import { harmonySegs } from './harmony.js';
import { normProg } from './model.js';
import { indexTexts } from './test/html-texts.js';
import { PREFS } from './test/helpers.js';

const inEnglish = f => { setLang('en'); try { return f(); } finally { setLang('es'); } };

// Rows of the UI audit (inversiones-tension-ui.md, section 3): every label the inspector shows has a rule and a test here
describe('row 2: the name of every chord type', () => {
  const NAMES = {
    '': ['mayor', 'major'], m: ['menor', 'minor'], dim: ['disminuido', 'diminished'], aug: ['aumentado', 'augmented'],
    sus2: ['suspendido de 2ª', 'suspended 2nd'], sus4: ['suspendido de 4ª', 'suspended 4th'], '5': ['quinta (power chord)', 'fifth (power chord)'],
    '6': ['sexta', 'sixth'], m6: ['menor sexta', 'minor sixth'], '6/9': ['seis nueve', 'six nine'], 'm6/9': ['menor seis nueve', 'minor six nine'],
    '7': ['séptima de dominante', 'dominant seventh'], maj7: ['séptima mayor', 'major seventh'], m7: ['menor séptima', 'minor seventh'],
    'm(maj7)': ['menor con séptima mayor', 'minor major seventh'], 'm7♭5': ['semidisminuido', 'half-diminished'], dim7: ['disminuido séptima', 'diminished seventh'],
    '7♯5': ['séptima aumentada', 'augmented seventh'], 'maj7♯5': ['séptima mayor aumentada', 'augmented major seventh'], '7♭5': ['séptima con 5ª disminuida', 'seventh flat five'],
    '7sus4': ['séptima suspendida de 4ª', 'seventh suspended 4th'], '7sus2': ['séptima suspendida de 2ª', 'seventh suspended 2nd'],
    add9: ['con 9ª añadida', 'added 9th'], 'm(add9)': ['menor con 9ª añadida', 'minor added 9th'], add11: ['con 11ª añadida', 'added 11th'],
    '9': ['novena de dominante', 'dominant ninth'], maj9: ['novena mayor', 'major ninth'], m9: ['menor novena', 'minor ninth'], 'm(maj9)': ['menor con 9ª y 7ª mayor', 'minor major ninth'],
    '7♭9': ['séptima con 9ª menor', 'seventh flat nine'], '7♯9': ['séptima con 9ª aumentada', 'seventh sharp nine'], '9sus4': ['novena suspendida de 4ª', 'ninth suspended 4th'],
    '11': ['oncena', 'eleventh'], m11: ['menor oncena', 'minor eleventh'], maj11: ['oncena mayor', 'major eleventh'], '7♯11': ['séptima con 11ª aumentada', 'seventh sharp eleven'],
    '9♯11': ['novena con 11ª aumentada', 'ninth sharp eleven'], 'maj7♯11': ['séptima mayor con 11ª aumentada', 'major seventh sharp eleven'],
    '13': ['trecena', 'thirteenth'], m13: ['menor trecena', 'minor thirteenth'], maj13: ['trecena mayor', 'major thirteenth'], '7♭13': ['séptima con 13ª menor', 'seventh flat thirteen'],
    '13♯11': ['trecena con 11ª aumentada', 'thirteenth sharp eleven'], '7(no3)': ['séptima sin 3ª', 'seventh no third'],
    'maj9♯11': ['novena mayor con 11ª aumentada', 'major ninth sharp eleven'], '7♯5♯9': ['séptima con 5ª y 9ª aumentadas', 'seventh sharp five sharp nine'],
    '7♭5♭9': ['séptima con 5ª disminuida y 9ª menor', 'seventh flat five flat nine'], '7♯5♭9': ['séptima con 5ª aumentada y 9ª menor', 'seventh sharp five flat nine'],
    '7♭9♯11': ['séptima con 9ª menor y 11ª aumentada', 'seventh flat nine sharp eleven'], '13♭9': ['trecena con 9ª menor', 'thirteenth flat nine'],
  };
  it('has a Spanish and an English name for each of the types, and no type is missing from the table', () => {
    expect(TYPES.map(t => t.sym).sort()).toEqual(Object.keys(NAMES).sort());
    TYPES.forEach(t => expect([t.name, inEnglish(() => t.name)]).toEqual(NAMES[t.sym]));
  });
});

describe('row 3: the interval of two notes is named by letters', () => {
  const L = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const iv = (lo, hi, a, b) => intervalText(lo, hi, { l: L[a] }, { l: L[b] });
  it('calls C–D♯ an augmented 2nd and C–E♭ a minor 3rd, with the same semitones', () => {
    expect(iv(60, 63, 'C', 'D')).toBe('Intervalo de 2ª aumentada · 3 semitonos');
    expect(iv(60, 63, 'C', 'E')).toBe('Intervalo de 3ª menor · 3 semitonos');
  });
  it('calls F–B an augmented 4th and B–F a diminished 5th', () => {
    expect(iv(65, 71, 'F', 'B')).toBe('Intervalo de 4ª aumentada · 6 semitonos');
    expect(iv(59, 65, 'B', 'F')).toBe('Intervalo de 5ª disminuida · 6 semitonos');
  });
  it('names the plain intervals, the octave, the compound ones and the English form', () => {
    expect(iv(60, 64, 'C', 'E')).toBe('Intervalo de 3ª mayor · 4 semitonos');
    expect(iv(60, 67, 'C', 'G')).toBe('Intervalo de 5ª justa · 7 semitonos');
    expect(iv(60, 72, 'C', 'C')).toBe('Intervalo de octava · 12 semitonos');
    expect(iv(60, 74, 'C', 'D')).toBe('Intervalo de 2ª mayor + 1 octava (compuesto) · 14 semitonos');
    expect(iv(60, 61, 'C', 'C')).toBe('Intervalo de unísono aumentado · 1 semitonos');
    expect(inEnglish(() => iv(60, 63, 'C', 'D'))).toBe('Augmented 2nd interval · 3 semitones');
  });
});

describe('row 4: the spelling of the active chord', () => {
  const notes = [44, 48, 51, 54];
  const cur = analyze(notes, null).find(c => c.root === 8 && c.type.sym === '7');
  const names = s => s.map(n => 'CDEFGAB'[n.l] + (n.a > 0 ? '#'.repeat(n.a) : 'b'.repeat(-n.a))).join(' ');
  it('spells G♯7 in C♯ minor with B♯, as the lane reads it', () => {
    expect(names(spellActive(notes, cur, PREFS, { tonic: 1, mode: 'minor' }).spelled)).toBe('G# B# D# F#');
  });
  it('spells the notes alone when no chord fits', () => {
    expect(names(spellActive([60, 61, 62], null, PREFS).spelled)).toBe('C Db D');
    expect(spellActive([60, 61, 62], null, PREFS).sp).toBe(null);
  });
});

describe('row 6: the tags of a candidate name', () => {
  const tags = (notes, root, sym, locked = null) => {
    const c = analyze(notes, null).find(x => x.root === root && x.type.sym === sym);
    return candTags(c, spellCandidate(c, notes, PREFS), locked).map(t => t.text);
  };
  it('tags C as an exact match with the bass as its root', () => expect(tags([48, 52, 55], 0, '')).toEqual(['coincidencia exacta', 'bajo = fundamental']));
  it('tags Am7 over C as an inversion and gives its other name', () => expect(tags([48, 52, 55, 57], 9, 'm7')).toEqual(['1ª inversión', 'también A-7']));
  it('tags a C9 without its 5th', () => expect(tags([48, 52, 58, 62], 0, '9')).toEqual(['bajo = fundamental', 'sin 5']));
  it('tags C-7 as an exact match with its other name, and marks a chosen root', () => {
    expect(tags([48, 51, 55, 58], 0, 'm7')).toEqual(['coincidencia exacta', 'bajo = fundamental', 'también C-7']);
    expect(tags([48, 51, 55, 58], 0, 'm7', 0)).toEqual(['coincidencia exacta', 'bajo = fundamental', 'raíz elegida', 'también C-7']);
  });
});

describe('rows 7 and 8: the thresholds of the warnings', () => {
  const kinds = (notes, cands = 1) => chordWarnings(notes, cands).map(w => w.kind);
  it('warns below the 88 keys, above them and above MIDI', () => {
    expect(LIMITS).toMatchObject({ pianoLow: 21, pianoHigh: 108, midiHigh: 127 });
    expect(kinds([20, 60])).toEqual(['below']);
    expect(kinds([21, 108])).toEqual([]);
    expect(kinds([60, 109])).toEqual(['above']);
    expect(kinds([60, 128])).toEqual(['above', 'noMidi']);
  });
  it('warns under 20 Hz and over 15 kHz', () => {
    expect(kinds([15])).toEqual(['below', 'infra']);
    expect(kinds([16])).toEqual(['below']);
    expect(kinds([130, 60])).toEqual(['above', 'noMidi']);
    expect(kinds([60, 130]).includes('ultra')).toBe(false);
    expect(kinds([60, 131])).toEqual(['above', 'noMidi', 'ultra']);
  });
  it('warns of a muddy interval only when it is a 3rd or smaller with its upper note under C3', () => {
    expect(MUDDY).toEqual({ below: 48, maxSemitones: 4 });
    expect(kinds([40, 44])).toEqual(['muddy']);
    expect(kinds([46, 47])).toEqual(['muddy']);
    expect(kinds([40, 45])).toEqual([]);
    expect(kinds([48, 50])).toEqual([]);
    expect(kinds([47, 52])).toEqual([]);
  });
  it('warns of a cluster that no chord fits and of more notes than two hands hold', () => {
    expect(kinds([60, 61, 62], 0)).toEqual(['unknown']);
    expect(kinds([60, 61], 0)).toEqual([]);
    expect(kinds([60, 62, 64, 65, 67, 69, 71, 72, 74, 76])).toEqual([]);
    expect(kinds([60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77])).toEqual(['hands']);
  });
  it('labels the muddy rule as a rule of thumb', () => {
    const t = warningText({ kind: 'muddy', notes: [40, 44] }, a => a.join(','), m => 'C3');
    expect(t).toContain('Regla práctica');
    expect(inEnglish(() => warningText({ kind: 'muddy', notes: [40, 44] }, a => a.join(','), m => 'C3'))).toContain('Rule of thumb');
  });
});

describe('row 19: the interval of a melody note over its chord goes by letters', () => {
  const C7 = resolveStep({ notes: [48, 52, 55, 58] }, PREFS);
  const iv = (m, l, a) => against(m, C7, { l, a }).iv;
  it('calls E♭ over C7 a ♭3 and D♯ a ♯9', () => {
    expect(iv(63, 2, -1)).toBe('♭3');
    expect(iv(63, 1, 1)).toBe('♯9');
  });
  it('tells ♯11 from ♭5, and ♭6 from ♯5', () => {
    expect(iv(66, 3, 1)).toBe('♯11');
    expect(iv(66, 4, -1)).toBe('♭5');
    expect(iv(68, 5, -1)).toBe('♭6');
    expect(iv(68, 4, 1)).toBe('♯5');
  });
  it('keeps the chord tones as the chord names them, and falls back to the pitch class without a spelling', () => {
    expect(iv(52, 2, 0)).toBe('3');
    expect(against(63, C7).iv).toBe('♯9');
  });
});

describe('row 22: the help of the Expression tab quotes the weights of the code', () => {
  const pct = x => Math.round(Math.abs(x) * 100);
  const text = frag => indexTexts().find(t => t.includes(frag));
  it('quotes the voice balance and the bar accents', () => {
    const voices = text('la más aguda (la melodía)'), accents = text('tiempo 1 +');
    expect(voices).toContain(`+${pct(RULES.voiceTop)} %`);
    expect(voices).toContain(`+${pct(RULES.voiceBass)} %`);
    expect(voices).toContain(`−${pct(RULES.voiceInner)} %`);
    expect(accents).toContain(`tiempo 1 +${pct(RULES.beat1)} %`);
    expect(accents).toContain(`tiempo 3 +${pct(RULES.beat3)} %`);
    expect(accents).toContain(`−${pct(RULES.offbeat)} %`);
  });
  it('quotes the appoggiatura and passing-tone weights, in both languages', () => {
    const es = text('la que el texto exportado llama apoyatura');
    expect(RULES.apoyResolve).toBe(-0.5);
    expect(es).toContain('a la mitad');
    expect(es).toContain(`bajan un ${pct(RULES.passing)} %`);
    expect(HTML_EN[es]).toContain('lightened by half');
    expect(HTML_EN[es]).toContain(`drop ${pct(RULES.passing)} %`);
  });
  it('gives the English help the same numbers as the Spanish one', () => {
    const num = s => (s.match(/[+−]\d+ %/g) || []).join(' ');
    for (const frag of ['la más aguda (la melodía)', 'tiempo 1 +']) { const es = text(frag); expect(num(HTML_EN[es]).replace(/−/g, '-')).toBe(num(es).replace(/−/g, '-')); }
  });
});

describe('row 18: what the empty sheet says about chords', () => {
  const pattern = notes => normProg({ id: 'p', name: 'p', beats: 4, names: {}, notes: notes.map(([m, s, l], i) => ({ id: 'n' + i, m, s: s * 96, l: l * 96, v: 100 })) });
  const chords = notes => harmonySegs(pattern(notes)).length;
  it('starts a chord with three notes at once', () => expect(chords([[48, 0, 2], [52, 0, 2], [55, 0, 2]])).toBe(1));
  it('starts a chord with two notes when both last a beat or more, and not when only one does', () => {
    expect(chords([[48, 0, 1], [55, 0, 1.5], [60, 2, 1]])).toBe(1);
    expect(chords([[48, 0, 1], [55, 0, 0.5], [60, 2, 1]])).toBe(0);
  });
  it('starts a chord with an arpeggio: one voice leaping between three or more notes of a chord', () => {
    expect(chords([[60, 0, 0.5], [64, 0.5, 0.5], [67, 1, 0.5], [72, 1.5, 0.5]])).toBe(1);
  });
  it('reads a legato tune as melody only', () => expect(chords([[60, 0, 1.5], [62, 1, 1.5], [64, 2, 1.5], [65, 3, 1.5]])).toBe(0));
  it('reads a broken accompaniment under a held voice as chords', () => {
    expect(chords([[48, 0, 0.5], [55, 0.5, 0.5], [52, 1, 0.5], [55, 1.5, 0.5], [76, 0, 2]])).toBe(1);
  });
  it('says all of this as a list, in both languages', () => {
    expect(emptySheetText()).toEqual({ head: 'Solo melodía: no hay acordes. La app arma un acorde cuando hay:', items: ['tres notas a la vez', 'dos notas a la vez que duran un tiempo o más',
      'un arpegio: una sola voz que salta entre tres o más notas de un acorde', 'un acompañamiento: tres o más notas distintas en un tiempo mientras otra voz se sostiene'] });
    expect(inEnglish(emptySheetText)).toEqual({ head: 'Melody only: no chords. The app builds a chord when there are:', items: ['three notes at once', 'two notes at once that last a beat or more',
      'an arpeggio: a single voice leaping between three or more notes of a chord', 'an accompaniment: three or more different notes in a beat while another voice holds'] });
  });
});

// The ornament rule orders the names of a lane chord, it does not take any away: C goes first, Cmaj7 stays as an alternative
describe('row 6: the names of a lane chord with an ornament', () => {
  const notes = [48, 52, 55, 59];
  const names = cs => cs.map(c => { const sp = spellCandidate(c, notes, PREFS); return [c.root, c.type.sym, candTags(c, sp, null, PREFS).map(t => t.text)]; });
  it('puts the reading without the ornament first, tagged with it, and keeps every reading with all the notes below', () => {
    const cs = activeCands(notes, null, [59]);
    expect(names(cs)).toEqual([[0, '', ['Adorno: B3', 'bajo = fundamental']], ...names(analyze(notes, null))]);
    expect(names(cs)[1]).toEqual([0, 'maj7', ['coincidencia exacta', 'bajo = fundamental', 'también CΔ7']]);
    expect(inEnglish(() => names(cs)[0][2])).toEqual(['Ornament: B3', 'bass is the root']);
  });
  it('names two ornaments in the plural', () => {
    const ns = [48, 55, 62, 64, 65], cs = activeCands(ns, null, [62, 65]);
    expect(candTags(cs[0], spellCandidate(cs[0], ns, PREFS), null, PREFS)[0].text).toBe('Adornos: D4, F4');
  });
  it('keeps the reading without the ornament, last, once the user names the chord Cmaj7', () => {
    const r = resolveStep({ notes, dur: 384, a: 0, evs: notes.map(m => ({ m, s: 0, l: m === 59 ? 24 : 384 })), root: 0, sym: 'maj7' }, PREFS);
    expect([r.label, r.orn, r.ornAlt]).toEqual(['Cmaj7', undefined, [59]]);
    expect(names(activeCands(notes, null, r.ornAlt, true))).toEqual([...names(analyze(notes, null)), [0, '', ['Adorno: B3', 'bajo = fundamental']]]);
  });
  it('puts a lane reading that takes a note of the tune first, tagged with it', () => {
    const ns = [48, 64], r = resolveStep({ notes: ns, dur: 384, a: 0, evs: ns.map(m => ({ m, s: 0, l: 384 })), all: [48, 64, 67].map(m => ({ m, s: 0, l: 384 })) }, PREFS);
    const cs = activeCands(ns, null, [], false, r.c), tags = c => candTags(c, spellCandidate(c, ns, PREFS), null, PREFS).map(t => t.text);
    expect([cs[0].root, cs[0].type.sym, tags(cs[0])]).toEqual([0, '', ['Con la melodía: G', 'bajo = fundamental']]);
    expect(inEnglish(() => tags(cs[0]))).toEqual(['With the melody: G', 'bass is the root']);
    expect([cs[1].root, cs[1].type.sym, tags(cs[1])]).toEqual([0, '', ['bajo = fundamental', 'sin 5']]);
    expect(activeCands(ns, 0, [], false, r.c)).toEqual(analyze(ns, 0));
  });
  it('is the plain list without ornaments or with a chosen root', () => {
    expect(activeCands(notes, null, [])).toEqual(analyze(notes, null));
    expect(activeCands(notes, 0, [59])).toEqual(analyze(notes, 0));
  });
});

// Closing trace (2 Nov 2026): labels of the sheet and the text export whose words THEORY.md fixes and that had no test of their own
describe('closing trace: the words THEORY.md fixes', () => {
  const run = chords => analyzeProgression(chords.map(notes => ({ notes })), PREFS);
  const pattern = (chords, mel = []) => {
    const notes = []; let t = 0;
    chords.forEach(([ns, b]) => { ns.forEach(m => notes.push({ id: 'n' + notes.length, m, s: t, l: b * T, v: 100 })); t += b * T; });
    mel.forEach(([m, s, l]) => notes.push({ id: 'n' + notes.length, m, s: s * T, l: l * T, v: 100 }));
    return normProg({ id: 'p', name: 'p', beats: 4, names: {}, notes });
  };
  // the minor v has no leading tone: v → i is modal, not authentic, and the cadence writes the degrees as the chords are
  it('calls v → i in minor a modal cadence', () => {
    const cad = run([[45, 48, 52], [50, 53, 57], [52, 55, 59], [45, 48, 52]]).cad;
    expect(cad).toContain('modal');
    expect(cad).not.toContain('auténtica');
    expect(cad).toContain('(v → i)');
  });
  // decision 7: the degree column of the text says the tension is an estimate and what it is made of, with chords alone and under a tune
  const TEN_HEAD = 'tensión estimada 0–1: base (función y disonancia) + contexto (llegada, sorpresa, espera)';
  it('heads the degree column with the estimated tension and its parts', () => {
    const blocks = progText(pattern([[[48, 52, 55], 4], [[43, 47, 50, 53], 4]]), PREFS).split('\n');
    expect(blocks.find(l => l.startsWith('# Formato:'))).toContain(TEN_HEAD);
    const tune = progText(pattern([[[48, 52, 55], 4], [[43, 47, 50, 53], 4]], [[76, 0, 2], [74, 2, 2], [71, 4, 4]]), PREFS).split('\n');
    expect(tune.find(l => l.startsWith('# Armonía:'))).toContain(TEN_HEAD);
  });
  // row 20: the column of the melody's tension says it is an estimate
  it('heads the tension column of the melody as an estimate', () => {
    const t = progText(pattern([[[48, 52, 55], 4]], [[64, 0, 1], [62, 1, 1], [65, 2, 1], [67, 3, 1]]), PREFS).split('\n');
    expect(t.find(l => l.startsWith('# Melodía:'))).toContain('| tensión estimada 0–1 |');
  });
  // J07: the suspension is added to the role, in the same column, «nota del acorde · retardo 4–3 → E4»
  it('adds the suspension to the role of the held note', () => {
    const t = progText(pattern([[[43, 47, 50, 53], 2], [[48, 52, 55], 2]], [[67, 0, 1], [65, 1, 2], [64, 3, 1]]), PREFS).split('\n');
    expect(t.find(l => l.startsWith('F4 (65) |'))).toMatch(/\| nota del acorde · retardo 4–3 → E4$/);
  });
  // row 10 and decision 15: the text gives the reasons of the key in one line, or one line per region
  it('writes why this key, one line per region when it modulates', () => {
    const one = progText(pattern([[[48, 52, 55], 4], [[53, 57, 60], 4], [[43, 47, 50, 53], 4], [[48, 52, 55], 4]]), PREFS).split('\n');
    expect(one.filter(l => l.startsWith('# Por qué la tonalidad: '))).toEqual(['# Por qué la tonalidad: C mayor: un V resuelve a la tónica · empieza y termina en la tónica · todos los acordes son de la escala']);
    const F11 = [[48, 52, 55], [53, 57, 60], [43, 47, 50, 53], [48, 52, 55], [45, 48, 52], [50, 54, 57, 60], [43, 47, 50], [50, 54, 57, 60], [43, 47, 50]];
    const two = progText(pattern(F11.map(ns => [ns, 4])), PREFS).split('\n').filter(l => l.startsWith('# Por qué la tonalidad: '));
    expect(two.map(l => l.slice(0, l.indexOf(':', 25) + 1))).toEqual(['# Por qué la tonalidad: C mayor (acordes 1–4):', '# Por qué la tonalidad: G mayor (acordes 5–9):']);
  });
  // row 24: the footer names the reading under a tune and the tension among the estimates (approved on 2 Nov 2026)
  it('names the reading under a tune and the tension in the footer among the estimates, in both languages', () => {
    const es = indexTexts().find(t => t.includes('son una estimación'));
    expect(es).toContain('Bajo una melodía, la app separa la melodía, lee el acompañamiento por ataques y por tiempos y deja las notas cortas como adorno; esa lectura, la tonalidad, los patrones y la tensión son una estimación.');
    expect(HTML_EN[es]).toContain('Under a tune, the app sets the tune apart, reads the accompaniment by attacks and by beats and leaves short notes as ornaments; that reading, the key, the patterns and the tension are an estimate.');
  });
  // row 16: the help under the sheet calls the tension an estimate (decision 7)
  it('calls the tension of the sheet an estimate in its help, in both languages', () => {
    expect(sheetHint()).toContain('su tensión estimada (0 a 1)');
    expect(inEnglish(sheetHint)).toContain('its estimated tension (0 to 1)');
  });
});

// Labels whose rule was written in THEORY.md at the close («Etiquetas fijadas al cierre»), from the theory first and then
// checked against the code
describe('labels fixed at the close', () => {
  const run = chords => analyzeProgression(chords.map(notes => ({ notes })), PREFS);
  const C = [48, 52, 55], Am = [45, 48, 52], Dm = [50, 53, 57], G = [43, 47, 50], F = [41, 45, 48];
  const blocks = chords => progText(normProg({ id: 'p', name: 'p', beats: 4, names: {}, notes: chords.flatMap((ns, i) => ns.map((m, j) => ({ id: `n${i}-${j}`, m, s: i * 4 * T, l: 4 * T, v: 100 }))) }), PREFS).split('\n');
  it('says there is no final cadence with one chord, or when the last two form no cadence, and writes no # Final line', () => {
    for (const p of [[C], [C, Am], [C, F, Dm, C]]) {
      expect(endingText(run(p).cad)).toBe('sin cadencia final');
      expect(blocks(p).some(l => l.startsWith('# Final:'))).toBe(false);
    }
    expect(inEnglish(() => endingText(run([C, Am]).cad))).toBe('no final cadence');
    expect(endingText(run([C, F, [43, 47, 50, 53], C]).cad)).toContain('auténtica');
  });
  it('writes a pattern that closes only when the pattern repeats with what it has and what comes on the repeat', () => {
    expect(blocks([G, Am, F, C]).find(l => l.startsWith('# Patrones:'))).toContain('I (continúa en V–vi–IV al repetir)');
    // I–V–vi–IV is whole inside C G Am F and keeps its name; vi–IV–I–V only closes on the repeat
    const pats = blocks([C, G, Am, F]).find(l => l.startsWith('# Patrones:'));
    expect(pats).toContain('Pop I–V–vi–IV');
    expect(pats).not.toContain('I–V–vi (continúa');
    expect(pats).toContain('vi–IV (continúa en I–V al repetir)');
  });
  it('writes one pitch class in several octaves as a doubled note, and a lone note without the word', () => {
    expect(blocks([[48, 60]]).find(l => l.startsWith('1. '))).toMatch(/^1\. nota: C3\+C4 \(doblada\) \|/);
    expect(blocks([[48]]).find(l => l.startsWith('1. '))).toMatch(/^1\. nota: C3 \|/);
  });
  // the 3rd is never left out: without it and with the 4th the chord is a sus4; an eleventh or a thirteenth can leave out its 9th
  it('names C G B♭ D F as C9sus4 and C E G B♭ A as C13 without its 9th', () => {
    const first = notes => { const c = analyze(notes, null)[0], sp = spellCandidate(c, notes, PREFS), sy = candSymbol(c, sp, PREFS); return [sy.main + sy.slash, chordDesc(c, sp, sp.notes, PREFS)]; };
    expect(first([48, 55, 58, 62, 65])).toEqual(['C9sus4', 'C novena suspendida de 4ª']);
    expect(first([48, 52, 55, 58, 69])).toEqual(['C13', 'C trecena · sin 9']);
  });
  // free is an avoid note: half a step above a chord tone; over a dominant the ♭9 and the ♭13 are tensions
  it('calls a note half a step above a chord tone free, except the ♭9 and the ♭13 over a dominant', () => {
    // the note comes and goes by leap, between two chord tones
    const role = (chord, m, by = 72) => {
      const notes = [...chord.map((x, i) => ({ id: 'c' + i, m: x, s: 0, l: 4 * T, v: 100 })), ...[[by, 0, 1], [m, 1, 1], [by, 2, 2]].map(([x, s, l], i) => ({ id: 'm' + i, m: x, s: s * T, l: l * T, v: 100 }))];
      const t = progText(normProg({ id: 'p', name: 'p', beats: 4, names: {}, notes }), PREFS).split('\n');
      return t.find(l => l.includes(`(${m}) | 1 |`)).split(' | ').at(-1);
    };
    const C7 = [48, 52, 55, 58];
    expect(role(C, 65)).toBe('libre');
    expect(role(C, 71, 76)).toBe('tensión');
    expect(role(C7, 61)).toBe('tensión');
    expect(role(C7, 68)).toBe('tensión');
    expect(role(C, 68)).toBe('libre');
  });
  it('says «sin 5» for a seventh chord without its 5th, in the description and in the tags', () => {
    const notes = [48, 52, 58], c = analyze(notes, null)[0], sp = spellCandidate(c, notes, PREFS);
    expect([c.root, c.type.sym]).toEqual([0, '7']);
    expect(chordDesc(c, sp, sp.notes, PREFS)).toBe('C séptima de dominante · sin 5');
    expect(candTags(c, sp, null, PREFS).map(t => t.text)).toContain('sin 5');
    expect(inEnglish(() => chordDesc(c, sp, sp.notes, PREFS))).toBe('C dominant seventh · no 5');
  });
});
