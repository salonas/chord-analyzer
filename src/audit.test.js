import { TYPES } from './data.js';
import { analyze, resolveStep, spellCandidate } from './analysis.js';
import { RULES } from './expression.js';
import { HTML_EN, setLang } from './i18n.js';
import { LIMITS, MUDDY, candTags, chordWarnings, emptySheetText, intervalText, spellActive, warningText } from './panel.js';
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
  it('says all of this, in both languages', () => {
    const es = emptySheetText();
    for (const w of ['tres notas a la vez', 'dos si las dos duran un tiempo o más', 'arpegio']) expect(es).toContain(w);
    const en = inEnglish(emptySheetText);
    for (const w of ['three notes at once', 'two if both last a beat or more', 'arpeggio']) expect(en).toContain(w);
  });
});
