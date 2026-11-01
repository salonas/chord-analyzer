// Theory probe: ~418 checks of chord, key, degree, function, cadence, pattern, spelling and text output against
// accepted readings. The cases are the project's own, not a human-annotated corpus (see docs/teoria-fallos.md).
import { analyze, analyzeProgression, candSymbol, inversionText, keyName, resolveStep, spellCandidate } from '../analysis.js';
import { normProg } from '../model.js';
import { parseText, progText } from '../text.js';

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const T = 96;
const LET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { '': 0, '#': 1, '♯': 1, '##': 2, 'x': 2, '𝄪': 2, 'b': -1, '♭': -1, 'bb': -2, '𝄫': -2 };
const midiOf = x => { const m = x.match(/^([A-G])(##|bb|#|b|x|♯|♭|𝄪|𝄫)?(-?\d+)$/); if (!m) throw new Error('nota ' + x); return 12 * (+m[3] + 1) + LET[m[1]] + ACC[m[2] || '']; };
const N = s => s.trim().split(/\s+/).map(midiOf);
const norm = s => String(s ?? '').replace(/♯/g, '#').replace(/♭/g, 'b').replace(/𝄪/g, '##').replace(/𝄫/g, 'bb').trim();
const spellName = s => 'CDEFGAB'[s.l] + ({ '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' })[s.a];
const acc = (exp, got) => (Array.isArray(exp) ? exp : [exp]).some(e => norm(e) === norm(got));

const R = [];
const add = (cat, id, level, desc, expected, actual, pass, ref, note) => R.push({ cat, id, level, desc, expected, actual, pass, ref: ref || '', note: note || '' });

// ---------- A. chord names (no key) ----------
const chordCases = [
  ['A01', 1, 'Tríada mayor', 'C4 E4 G4', 'C'],
  ['A02', 1, 'Tríada menor', 'A3 C4 E4', 'Am'],
  ['A03', 1, 'Tríada disminuida', 'B3 D4 F4', 'Bdim'],
  ['A04', 1, 'Tríada aumentada (bajo C)', 'C4 E4 G#4', 'Caug'],
  ['A05', 1, 'Sus2', 'C4 D4 G4', ['Csus2', 'Gsus4/C']],
  ['A06', 1, 'Sus4', 'C4 F4 G4', ['Csus4', 'Fsus2/C']],
  ['A07', 1, 'Power chord', 'C3 G3', 'C5'],
  ['A08', 1, 'Séptima de dominante', 'C4 E4 G4 Bb4', 'C7'],
  ['A09', 1, 'Séptima mayor', 'C4 E4 G4 B4', 'Cmaj7'],
  ['A10', 1, 'Menor séptima', 'C4 Eb4 G4 Bb4', 'Cm7'],
  ['A11', 1, 'Semidisminuido', 'B3 D4 F4 A4', 'Bm7♭5'],
  ['A12', 1, 'Disminuido séptima', 'B3 D4 F4 Ab4', 'Bdim7'],
  ['A13', 2, 'Menor con 7ª mayor', 'C4 Eb4 G4 B4', 'Cm(maj7)'],
  ['A14', 2, 'Sexta (bajo C) frente a Am7', 'C4 E4 G4 A4', 'C6'],
  ['A15', 2, 'Am7 (bajo A) frente a C6', 'A3 C4 E4 G4', 'Am7'],
  ['A16', 2, 'Add9', 'C4 E4 G4 D5', 'Cadd9'],
  ['A17', 2, 'Novena de dominante', 'C4 E4 G4 Bb4 D5', 'C9'],
  ['A18', 2, 'Novena sin 5ª (voicing usual)', 'C3 E3 Bb3 D4', 'C9'],
  ['A19', 2, 'Séptima sin 5ª', 'C3 E3 Bb3', ['C7', 'C7(no5)']],
  ['A20', 2, 'Primera inversión', 'E3 G3 C4', 'C/E'],
  ['A21', 2, 'Segunda inversión', 'G3 C4 E4', 'C/G'],
  ['A22', 2, 'Tercera inversión de C7', 'Bb2 C4 E4 G4', 'C7/B♭'],
  ['A23', 2, 'Disposición abierta', 'C2 G3 E4', 'C'],
  ['A24', 2, 'Disposición muy amplia', 'C2 E5 G6', 'C'],
  ['A25', 2, 'Cluster cromático (no es acorde)', 'C4 C#4 D4', '?'],
  ['A26', 2, 'Sexta y novena', 'C4 E4 G4 A4 D5', 'C6/9'],
  ['A27', 2, 'Raíz con bemol sin tonalidad', 'Db4 F4 Ab4', ['D♭', 'C♯']],
  ['A28', 2, 'Raíz con sostenido sin tonalidad (menor)', 'C#4 E4 G#4', ['C♯m', 'D♭m']],
  ['A29', 2, 'Em7 frente a G6/E', 'E3 G3 B3 D4', 'Em7'],
  ['A30', 2, 'Add11', 'C4 E4 F4 G4', ['Cadd11', 'Cadd4']],
  ['A31', 3, 'Séptima con 9ª menor', 'E3 G#3 B3 D4 F4', 'E7♭9'],
  ['A32', 3, 'Séptima con 9ª aumentada (acorde Hendrix)', 'E2 G#3 D4 G4', 'E7♯9'],
  ['A33', 3, 'Trecena', 'C3 E3 G3 Bb3 D4 A4', 'C13'],
  ['A34', 3, 'Trecena sin 5ª ni 9ª (voicing jazz)', 'G2 F3 B3 E4', ['G13', 'G7(13)']],
  ['A35', 3, 'Séptima con 13ª menor', 'C3 E3 Bb3 Ab4', ['C7♭13', 'C7♯5']],
  ['A36', 3, 'Maj7♯11 con 9ª (lidio)', 'C3 E3 G3 B3 D4 F#4', ['Cmaj9♯11', 'Cmaj7♯11']],
  ['A37', 3, 'Séptima mayor aumentada', 'C4 E4 G#4 B4', 'Cmaj7♯5'],
  ['A38', 3, 'Dim7 con 𝄫7', 'C4 Eb4 Gb4 A4', 'Cdim7'],
  ['A39', 3, 'Acorde cuartal', 'C3 F3 Bb3 Eb4', ['F7sus4/C', 'Cm7sus4', 'C7sus4(♭10)', 'B♭sus4/C']],
  ['A40', 3, 'So What (cuartal + 3ª mayor)', 'E3 A3 D4 G4 B4', ['Em11', 'Em7(11)']],
  ['A41', 3, 'Séptima 7♯11 sin 5ª (ambigua con 7♭5)', 'C3 E3 Bb3 F#4', ['C7♯11', 'C7♭5']],
  ['A42', 3, 'Mayor con 7ª menor y 6ª (13 sin 9)', 'C3 E3 Bb3 A4', ['C13', 'C7(13)', 'C7/6']],
  ['A43', 3, 'Dominante alterado (7♯5♯9)', 'C3 E3 Bb3 D#4 G#4', ['C7♯5♯9', 'C7alt', 'C+7♯9']],
  ['A44', 1, 'Nota sola', 'C4', 'C4'],
  ['A45', 1, 'Octava', 'C4 C5', ['C', 'C (8ª)', 'C4+C5', 'C–C']],
  ['A46', 2, 'Díada de 3ª mayor', 'C4 E4', ['C–E', 'C(no5)', 'C']],
  ['A47', 2, 'Díada de 4ª justa', 'G3 C4', ['G–C', 'C5/G']],
  ['A48', 2, 'Tritono solo', 'B3 F4', ['B–F', 'G7(no root)']],
  ['A49', 3, 'Policordio D/C (D sobre C)', 'C3 D4 F#4 A4', ['D/C', 'C7♯11', 'D7/C']],
  ['A50', 3, 'Mayor con 7ª menor sobre bajo de 5ª (V/I pedal)', 'C3 G3 B3 D4 F4', ['G7/C', 'G11/C', 'C(pedal)']],
];
for (const [id, lv, desc, notes, exp] of chordCases) {
  const r = resolveStep({ notes: N(notes) }, P);
  const alts = analyze([...N(notes)].sort((a, b) => a - b), null).slice(0, 4).map(c => { const sy = candSymbol(c, spellCandidate(c, N(notes), P), P); return sy.main + sy.slash; });
  add('acorde', id, lv, `${desc}: ${notes}`, exp, r.label, acc(exp, r.label), '', 'alternativas: ' + alts.join(', '));
}

// ---------- B. inversions ----------
const invCases = [
  ['B01', 1, 'C/E', 'E3 G3 C4', '1ª inversión'],
  ['B02', 1, 'C/G', 'G3 C4 E4', '2ª inversión'],
  ['B03', 1, 'G7/B', 'B2 D3 F3 G3', '1ª inversión'],
  ['B04', 1, 'G7/D', 'D3 F3 G3 B3', '2ª inversión'],
  ['B05', 1, 'G7/F', 'F2 G3 B3 D4', '3ª inversión'],
  ['B06', 2, 'Cadd9 con bajo en D', 'D3 C4 E4 G4', ['bajo en la 9', '']],
  ['B07', 2, 'Csus4 con bajo en F', 'F3 C4 G4', ['bajo en la 4', '']],
  ['B08', 2, 'Cmaj7 con bajo en B (3ª inversión)', 'B2 C4 E4 G4', '3ª inversión'],
  ['B09', 3, 'Dim7 con bajo en D (sin contexto)', 'D3 F3 Ab3 B3', ['', '1ª inversión']],
];
for (const [id, lv, desc, notes, exp] of invCases) {
  const r = resolveStep({ notes: N(notes) }, P);
  const got = r.c ? inversionText(r.c) : '';
  add('inversión', id, lv, `${desc}: ${notes} → ${r.label}`, exp, got || '(fundamental)', acc(exp, got) || (Array.isArray(exp) && exp.includes('') && !got), '');
}

// ---------- progression helper ----------
const runProg = chs => {
  const A = analyzeProgression(chs.map(c => ({ notes: N(c) })), P);
  return {
    A,
    key: keyName(A.key, P), alt: A.alt ? keyName(A.alt, P) : '',
    labels: A.rs.map(r => r.label), romans: A.romans.map(r => r ? r.text : '?'), fn: A.fn,
    spelled: A.rs.map(r => r.spelled.map(spellName)), cad: A.cad || '', found: A.found.map(f => f.name),
  };
};
const progCases = [];
const prog = (id, level, desc, chords, checks, ref) => progCases.push({ id, level, desc, chords, checks, ref });

// C. enharmonic spelling in context (spell: index -> expected set of note names)
prog('C01', 1, 'Do mayor I–IV–V7–I', ['C3 E3 G3', 'F3 A3 C4', 'G2 B2 D3 F3', 'C3 E3 G3'], { key: 'C mayor', spell: { 2: 'G B D F' } });
prog('C02', 1, 'Fa mayor I–IV–V–I (B♭)', ['F3 A3 C4', 'Bb2 D3 F3', 'C3 E3 G3', 'F3 A3 C4'], { key: 'F mayor', spell: { 1: 'Bb D F' } });
prog('C03', 1, 'Mi♭ mayor I–IV–V7–I', ['Eb3 G3 Bb3', 'Ab2 C3 Eb3', 'Bb2 D3 F3 Ab3', 'Eb3 G3 Bb3'], { key: 'Eb mayor', spell: { 1: 'Ab C Eb', 2: 'Bb D F Ab' } });
prog('C04', 1, 'La mayor V7 (G♯)', ['A2 C#3 E3', 'D3 F#3 A3', 'E2 G#2 B2 D3', 'A2 C#3 E3'], { key: 'A mayor', spell: { 2: 'E G# B D' } });
prog('C05', 1, 'Mi mayor V7 (D♯)', ['E3 G#3 B3', 'A2 C#3 E3', 'B2 D#3 F#3 A3', 'E3 G#3 B3'], { key: 'E mayor', spell: { 2: 'B D# F# A' } });
prog('C06', 2, 'Si mayor V7 (A♯)', ['B2 D#3 F#3', 'E3 G#3 B3', 'F#2 A#2 C#3 E3', 'B2 D#3 F#3'], { key: 'B mayor', spell: { 2: 'F# A# C# E' } });
prog('C07', 2, 'Fa♯ mayor V7 (E♯)', ['F#3 A#3 C#4', 'B2 D#3 F#3', 'C#3 E#3 G#3 B3', 'F#3 A#3 C#4'], { key: ['F# mayor', 'Gb mayor'], spell: { 0: ['F# A# C#', 'Gb Bb Db'], 2: ['C# E# G# B', 'Db F Ab Cb'] } });
prog('C08', 2, 'Re♭ mayor V7 (G♭)', ['Db3 F3 Ab3', 'Gb2 Bb2 Db3', 'Ab2 C3 Eb3 Gb3', 'Db3 F3 Ab3'], { key: 'Db mayor', spell: { 1: 'Gb Bb Db', 2: 'Ab C Eb Gb' } });
prog('C09', 1, 'La menor V (sensible G♯)', ['A2 C3 E3', 'D3 F3 A3', 'E2 G#2 B2', 'A2 C3 E3'], { key: 'A menor', spell: { 2: 'E G# B' } });
prog('C10', 1, 'Re menor V7 y VI (C♯, B♭)', ['D3 F3 A3', 'Bb2 D3 F3', 'A2 C#3 E3 G3', 'D3 F3 A3'], { key: 'D menor', spell: { 1: 'Bb D F', 2: 'A C# E G' } });
prog('C11', 1, 'Mi menor V7 (D♯)', ['E3 G3 B3', 'A2 C3 E3', 'B2 D#3 F#3 A3', 'E3 G3 B3'], { key: 'E menor', spell: { 2: 'B D# F# A' } });
prog('C12', 2, 'Si menor V7 (A♯)', ['B2 D3 F#3', 'E3 G3 B3', 'F#2 A#2 C#3 E3', 'B2 D3 F#3'], { key: 'B menor', spell: { 2: 'F# A# C# E' } });
prog('C13', 2, 'Fa♯ menor V7 (E♯)', ['F#3 A3 C#4', 'B2 D3 F#3', 'C#3 E#3 G#3 B3', 'F#3 A3 C#4'], { key: 'F# menor', spell: { 2: 'C# E# G# B' } });
prog('C14', 2, 'Do♯ menor V7 (B♯)', ['C#3 E3 G#3', 'F#3 A3 C#4', 'G#2 B#2 D#3 F#3', 'C#3 E3 G#3'], { key: 'C# menor', spell: { 2: 'G# B# D# F#' } });
prog('C15', 3, 'Sol♯ menor V7 (F𝄪)', ['G#3 B3 D#4', 'C#3 E3 G#3', 'D#3 F##3 A#3 C#4', 'G#3 B3 D#4'], { key: ['G# menor', 'Ab menor'], spell: { 2: 'D# F## A# C#' } });
prog('C16', 1, 'Do menor V7 y ♭VI', ['C3 Eb3 G3', 'Ab2 C3 Eb3', 'G2 B2 D3 F3', 'C3 Eb3 G3'], { key: 'C menor', spell: { 1: 'Ab C Eb', 2: 'G B D F' } });
prog('C17', 1, 'Fa menor V7 y ♭II (D♭)', ['F3 Ab3 C4', 'Db3 F3 Ab3', 'C3 E3 G3 Bb3', 'F3 Ab3 C4'], { key: 'F menor', spell: { 1: 'Db F Ab', 2: 'C E G Bb' } });
prog('C18', 2, 'Si♭ menor V7 y VI (G♭)', ['Bb2 Db3 F3', 'Gb2 Bb2 Db3', 'F2 A2 C3 Eb3', 'Bb2 Db3 F3'], { key: 'Bb menor', spell: { 1: 'Gb Bb Db', 2: 'F A C Eb' } });
prog('C19', 3, 'Mi♭ menor VI (C♭ mayor)', ['Eb3 Gb3 Bb3', 'Cb3 Eb3 Gb3', 'Bb2 D3 F3 Ab3', 'Eb3 Gb3 Bb3'], { key: 'Eb menor', spell: { 1: 'Cb Eb Gb', 2: 'Bb D F Ab' } });
prog('C20', 2, 'Do mayor V7/V (F♯)', ['C3 E3 G3', 'D3 F#3 A3 C4', 'G2 B2 D3', 'C3 E3 G3'], { key: 'C mayor', spell: { 1: 'D F# A C' } });
prog('C21', 2, 'Do mayor vii°7/ii (C♯)', ['C3 E3 G3', 'C#3 E3 G3 Bb3', 'D3 F3 A3', 'G2 B2 D3 F3', 'C3 E3 G3'], { key: 'C mayor', spell: { 1: 'C# E G Bb' } });
prog('C22', 3, 'Do menor sexta aumentada alemana (F♯, no G♭)', ['C3 Eb3 G3', 'Ab2 C3 Eb3 F#3', 'G2 B2 D3 F3', 'C3 Eb3 G3'], { key: 'C menor', spell: { 1: 'Ab C Eb F#' } });
prog('C23', 3, 'Do mayor sexta aumentada francesa', ['C3 E3 G3', 'Ab2 C3 D3 F#3', 'G2 B2 D3', 'C3 E3 G3'], { key: 'C mayor', spell: { 1: 'Ab C D F#' } });
prog('C24', 3, 'Do mayor sexta aumentada italiana', ['C3 E3 G3', 'Ab2 C3 F#3', 'G2 B2 D3', 'C3 E3 G3'], { key: 'C mayor', spell: { 1: 'Ab C F#' } });
prog('C25', 3, 'Do mayor dim7 de nota común (D♯ F♯ A C)', ['C3 E3 G3', 'C3 D#3 F#3 A3', 'C3 E3 G3'], { key: 'C mayor', spell: { 1: 'C D# F# A' } });
prog('C26', 2, 'Mi mayor iii y vi', ['E3 G#3 B3', 'G#2 B2 D#3', 'C#3 E3 G#3', 'B2 D#3 F#3', 'E3 G#3 B3'], { key: 'E mayor', spell: { 1: 'G# B D#', 2: 'C# E G#' } });
prog('C27', 2, 'Re mayor viiø7 (C♯ E G B)', ['D3 F#3 A3', 'C#3 E3 G3 B3', 'D3 F#3 A3'], { key: 'D mayor', spell: { 1: 'C# E G B' } });
prog('C28', 2, 'Si menor vii°7 (A♯)', ['B2 D3 F#3', 'A#2 C#3 E3 G3', 'B2 D3 F#3'], { key: 'B menor', spell: { 1: 'A# C# E G' } });
prog('C29', 3, 'Fa♯ menor vii°7 (E♯)', ['F#3 A3 C#4', 'E#3 G#3 B3 D4', 'F#3 A3 C#4'], { key: 'F# menor', spell: { 1: 'E# G# B D' } });
prog('C30', 3, 'Do mayor Napolitana (D♭ F A♭) prestada', ['C3 E3 G3', 'F3 Ab3 Db4', 'G2 B2 D3 F3', 'C3 E3 G3'], { key: 'C mayor', spell: { 1: 'F Ab Db' } });

// D. degrees / E. functions / F. key / G. cadence / H. patterns
prog('D01', 1, 'Do mayor I–IV–V–I', ['C3 E3 G3', 'F3 A3 C4', 'G2 B2 D3', 'C3 E3 G3'], { romans: ['I', 'IV', 'V', 'I'], fn: ['T', 'S', 'D', 'T'], cad: { has: 'auténtica' } });
prog('D02', 1, 'ii7–V7–Imaj7', ['D3 F3 A3 C4', 'G2 B2 D3 F3', 'C3 E3 G3 B3'], { key: 'C mayor', romans: ['ii7', 'V7', 'Imaj7'], fn: ['S', 'D', 'T'], found: ['ii–V–I'] });
prog('D03', 1, 'Inversiones con cifrado: I⁶ V⁶₅ I', ['E3 G3 C4', 'B2 D3 F3 G3', 'C3 E3 G3'], { key: 'C mayor', romans: ['I⁶', 'V⁶₅', 'I'] });
prog('D04', 2, 'V⁴₃ y V⁴₂', ['C3 E3 G3', 'D3 F3 G3 B3', 'C3 E3 G3', 'F2 G3 B3 D4', 'E3 G3 C4'], { key: 'C mayor', romans: ['I', 'V⁴₃', 'I', 'V⁴₂', 'I⁶'] });
prog('D05', 1, 'Menor i–iv–V–i', ['A2 C3 E3', 'D3 F3 A3', 'E2 G#2 B2', 'A2 C3 E3'], { key: 'A menor', romans: ['i', 'iv', 'V', 'i'], fn: ['T', 'S', 'D', 'T'] });
prog('D06', 2, 'Menor iiø7–V7–i', ['D3 F3 Ab3 C4', 'G2 B2 D3 F3', 'C3 Eb3 G3'], { key: 'C menor', romans: ['iiø7', 'V7', 'i'], found: ['ii–V–i menor'] });
prog('D07', 2, 'Menor III y VII naturales', ['C3 Eb3 G3', 'Bb2 D3 F3', 'Eb3 G3 Bb3', 'Ab2 C3 Eb3', 'G2 B2 D3', 'C3 Eb3 G3'], { key: 'C menor', romans: ['i', ['♭VII', 'VII'], ['♭III', 'III'], ['♭VI', 'VI'], 'V', 'i'] });
prog('D08', 2, 'Dominante secundaria V/V', ['C3 E3 G3', 'D3 F#3 A3', 'G2 B2 D3', 'C3 E3 G3'], { key: 'C mayor', romans: ['I', 'V/V', 'V', 'I'], fn: ['T', 'D', 'D', 'T'] });
prog('D09', 2, 'Cadena de dominantes secundarias', ['C3 E3 G3', 'E3 G#3 B3 D4', 'A2 C#3 E3 G3', 'D3 F#3 A3 C4', 'G2 B2 D3 F3', 'C3 E3 G3'], { key: 'C mayor', romans: ['I', 'V7/vi', 'V7/ii', 'V7/V', 'V7', 'I'] }, 'Aldwell & Schachter, cap. 16; Kostka & Payne, cap. 15');
prog('D10', 2, 'V7/IV', ['C3 E3 G3', 'C3 E3 G3 Bb3', 'F3 A3 C4', 'C3 E3 G3'], { key: 'C mayor', romans: ['I', 'V7/IV', 'IV', 'I'] });
prog('D11', 3, 'vii°7/V (sensible secundaria)', ['C3 E3 G3', 'F#3 A3 C4 Eb4', 'G2 B2 D3', 'C3 E3 G3'], { key: 'C mayor', romans: ['I', 'vii°7/V', 'V', 'I'], fn: ['T', 'D', 'D', 'T'] }, 'Kostka & Payne, cap. 16');
prog('D12', 2, 'Napolitana ♭II⁶ en menor', ['C3 Eb3 G3', 'F3 Ab3 Db4', 'G2 B2 D3 F3', 'C3 Eb3 G3'], { key: 'C menor', romans: ['i', '♭II⁶', 'V7', 'i'], fn: ['T', 'S', 'D', 'T'] });
prog('D13', 3, 'Sexta aumentada alemana', ['C3 Eb3 G3', 'Ab2 C3 Eb3 F#3', 'G2 B2 D3 F3', 'C3 Eb3 G3'], { key: 'C menor', romans: ['i', ['Ger+6', 'Ger⁶₅', '+6 al.'], 'V7', 'i'], fn: ['T', 'S', 'D', 'T'] }, 'Aldwell & Schachter, cap. 26');
prog('D14', 3, '6/4 cadencial', ['C3 E3 G3', 'F3 A3 C4', 'G2 C4 E4', 'G2 B3 D4 F4', 'C3 E3 G3'], { key: 'C mayor', romans: ['I', 'IV', ['I⁶₄', 'V⁶₄', 'Cad⁶₄'], 'V7', 'I'], fn: ['T', 'S', 'D', 'D', 'T'] }, 'Aldwell & Schachter, cap. 15; Schachter 1995');
prog('D15', 2, 'Préstamo iv en mayor', ['C3 E3 G3', 'F3 Ab3 C4', 'C3 E3 G3'], { key: 'C mayor', romans: ['I', 'iv', 'I'], fn: ['T', 'S', 'T'] });
prog('D16', 2, 'Cadencia ♭VI–♭VII–I (préstamo)', ['C3 E3 G3', 'Ab2 C3 Eb3', 'Bb2 D3 F3', 'C3 E3 G3'], { key: 'C mayor', romans: ['I', '♭VI', '♭VII', 'I'] });
prog('D17', 3, 'Préstamo ♭VI e iv (tonalidad debe seguir en Do)', ['C3 E3 G3', 'Ab2 C3 Eb3', 'F3 Ab3 C4', 'C3 E3 G3'], { key: 'C mayor', romans: ['I', '♭VI', 'iv', 'I'] });
prog('D18', 2, 'Tercera de picardía', ['C3 Eb3 G3', 'F3 Ab3 C4', 'G2 B2 D3 F3', 'C3 E3 G3'], { key: ['C menor', 'C mayor'], romans: ['i', 'iv', 'V7', 'I'] });
prog('D19', 2, 'V7sus4 → V7 → I', ['C3 E3 G3', 'G2 C3 D3 F3', 'G2 B2 D3 F3', 'C3 E3 G3'], { key: 'C mayor', romans: ['I', ['V7sus4', 'V7sus'], 'V7', 'I'] });
prog('D20', 1, 'Blues I7–IV7–V7', ['C3 E3 G3 Bb3', 'F3 A3 C4 Eb4', 'G2 B2 D3 F3', 'C3 E3 G3 Bb3'], { key: 'C mayor', romans: ['I7', 'IV7', 'V7', 'I7'] });
prog('D21', 2, 'Cadencia rota V7–vi', ['C3 E3 G3', 'F3 A3 C4', 'G2 B2 D3 F3', 'A2 C3 E3'], { key: 'C mayor', romans: ['I', 'IV', 'V7', 'vi'], cad: { has: 'rota' } });
prog('D22', 3, 'Sustituto tritonal ♭II7 → I', ['D3 F3 A3 C4', 'Db3 F3 Ab3 B3', 'C3 E3 G3 B3'], { key: 'C mayor', romans: ['ii7', ['subV7', '♭II7'], 'Imaj7'], fn: ['S', 'D', 'T'], cad: { has: 'tritonal' } });
prog('D23', 3, 'iii como dominante débil (iii → vi)', ['C3 E3 G3', 'E3 G3 B3', 'A2 C3 E3', 'F3 A3 C4', 'G2 B2 D3', 'C3 E3 G3'], { key: 'C mayor', romans: ['I', 'iii', 'vi', 'IV', 'V', 'I'], fn: ['T', ['T', 'D'], ['T', 'S'], 'S', 'D', 'T'] });

prog('F01', 1, 'Tonalidad trivial Do', ['C3 E3 G3', 'F3 A3 C4', 'G2 B2 D3', 'C3 E3 G3'], { key: 'C mayor' });
prog('F02', 1, 'Tonalidad trivial La menor', ['A2 C3 E3', 'D3 F3 A3', 'E2 G#2 B2', 'A2 C3 E3'], { key: 'A menor' });
prog('F03', 1, 'Un solo acorde mayor', ['C3 E3 G3'], { key: 'C mayor' });
prog('F04', 1, 'Un solo acorde menor', ['A2 C3 E3'], { key: 'A menor' });
prog('F05', 1, 'Pop I–V–vi–IV en Sol', ['G2 B2 D3', 'D3 F#3 A3', 'E3 G3 B3', 'C3 E3 G3'], { key: 'G mayor', found: ['I–V–vi–IV'] });
prog('F06', 2, 'vi–IV–I–V (relativas ambiguas)', ['A2 C3 E3', 'F2 A2 C3', 'C3 E3 G3', 'G2 B2 D3'], { key: ['A menor', 'C mayor'], alt: ['A menor', 'C mayor'], found: [['vi–IV–I–V', 'i–♭VI–♭III–♭VII']] });
prog('F07', 2, 'Cadencia andaluza', ['A2 C3 E3', 'G2 B2 D3', 'F2 A2 C3', 'E2 G#2 B2'], { key: 'A menor', found: ['andaluza'], cad: { has: 'Semicadencia' } });
prog('F08', 2, 'Mixolidio I–♭VII–IV–I en Sol', ['G2 B2 D3', 'F2 A2 C3', 'C3 E3 G3', 'G2 B2 D3'], { key: ['G mayor', 'G mixolidio'], found: ['Mixolidia'] });
prog('F09', 3, 'Dórico i–IV en Re', ['D3 F3 A3', 'G2 B2 D3', 'D3 F3 A3', 'G2 B2 D3', 'D3 F3 A3'], { key: ['D menor', 'D dórico'] });
prog('F10', 3, 'Frigio i–♭II en Mi', ['E3 G3 B3', 'F3 A3 C4', 'E3 G3 B3', 'F3 A3 C4', 'E3 G3 B3'], { key: ['E menor', 'E frigio'] });
prog('F11', 3, 'Modulación Do → Sol (dos regiones)', ['C3 E3 G3', 'F3 A3 C4', 'G2 B2 D3 F3', 'C3 E3 G3', 'A2 C3 E3', 'D3 F#3 A3 C4', 'G2 B2 D3', 'D3 F#3 A3 C4', 'G2 B2 D3'], { key: ['G mayor', 'C mayor → G mayor'], regions: true });
prog('F12', 2, 'Re♭ mayor (nombre de tonalidad)', ['Db3 F3 Ab3', 'Gb2 Bb2 Db3', 'Ab2 C3 Eb3 Gb3', 'Db3 F3 Ab3'], { key: 'Db mayor' });
prog('F13', 2, 'Sol♯ menor (nombre de tonalidad)', ['G#2 B2 D#3', 'C#3 E3 G#3', 'D#3 F##3 A#3 C#4', 'G#2 B2 D#3'], { key: ['G# menor', 'Ab menor'] });
prog('F14', 2, 'Mi♭ menor (nombre de tonalidad)', ['Eb3 Gb3 Bb3', 'Ab2 Cb3 Eb3', 'Bb2 D3 F3 Ab3', 'Eb3 Gb3 Bb3'], { key: ['Eb menor', 'D# menor'] });
prog('F15', 2, 'Blues en La', ['A2 C#3 E3 G3', 'D3 F#3 A3 C4', 'A2 C#3 E3 G3', 'E2 G#2 B2 D3', 'D3 F#3 A3 C4', 'A2 C#3 E3 G3'], { key: 'A mayor' });
prog('F16', 3, 'Ciclo tipo Autumn Leaves en Mi menor', ['A2 C3 E3 G3', 'D3 F#3 A3 C4', 'G2 B2 D3 F#3', 'C3 E3 G3 B3', 'F#2 A2 C3 E3', 'B2 D#3 F#3 A3', 'E3 G3 B3'], { key: ['E menor', 'G mayor'], found: ['Ciclo de quintas'] });
prog('F17', 2, 'Canon de Pachelbel', ['D3 F#3 A3', 'A2 C#3 E3', 'B2 D3 F#3', 'F#2 A2 C#3', 'G2 B2 D3', 'D3 F#3 A3', 'G2 B2 D3', 'A2 C#3 E3'], { key: 'D mayor', found: ['Pachelbel'] });
prog('F18', 2, 'Royal road IV–V–iii–vi', ['F2 A2 C3', 'G2 B2 D3', 'E3 G3 B3', 'A2 C3 E3'], { key: ['C mayor', 'A menor'], found: [['Royal road', 'iv–v–♭VII–i']] });

prog('G01', 1, 'Auténtica V7–I', ['F3 A3 C4', 'G2 B2 D3 F3', 'C3 E3 G3'], { cad: { has: 'auténtica' } });
prog('G02', 1, 'Plagal IV–I', ['C3 E3 G3', 'F3 A3 C4', 'C3 E3 G3'], { cad: { has: 'plagal' } });
prog('G03', 1, 'Semicadencia I–V', ['C3 E3 G3', 'F3 A3 C4', 'G2 B2 D3'], { key: 'C mayor', cad: { has: 'Semicadencia' } });
prog('G04', 2, 'v–i menor sin sensible: no es auténtica', ['A2 C3 E3', 'D3 F3 A3', 'E3 G3 B3', 'A2 C3 E3'], { key: 'A menor', cad: { not: 'auténtica' } }, 'Aldwell & Schachter, cap. 4 (la cadencia auténtica requiere V mayor)');
prog('G05', 2, 'Auténtica imperfecta (V⁶₅–I)', ['C3 E3 G3', 'B2 D3 F3 G3', 'C3 E3 G3'], { cad: { has: ['auténtica imperfecta', 'auténtica'] } });
prog('G06', 2, 'Semicadencia frigia iv⁶–V', ['C3 Eb3 G3', 'Ab2 C3 F3', 'G2 B2 D3'], { key: 'C menor', cad: { has: ['frigia', 'Semicadencia'] } });
prog('G07', 1, 'Sensible vii°–I', ['C3 E3 G3', 'B2 D3 F3', 'C3 E3 G3'], { cad: { has: 'sensible' } });
prog('G08', 2, 'Backdoor ♭VII–I', ['C3 E3 G3', 'F3 A3 C4', 'Bb2 D3 F3', 'C3 E3 G3'], { key: 'C mayor', cad: { has: '♭VII' } });
prog('G09', 2, 'Rota en menor V–♭VI', ['C3 Eb3 G3', 'F3 Ab3 C4', 'G2 B2 D3 F3', 'Ab2 C3 Eb3'], { key: 'C menor', cad: { has: 'rota' } });
prog('G10', 2, 'I⁶₄–I no es cadencia', ['C3 E3 G3', 'G2 C3 E3', 'C3 E3 G3'], { cad: { none: true } });
prog('G11', 2, 'Plagal menor iv–I en mayor', ['C3 E3 G3', 'F3 Ab3 C4', 'C3 E3 G3'], { key: 'C mayor', cad: { has: 'plagal' } });
prog('G12', 2, 'V/V–V termina en semicadencia', ['C3 E3 G3', 'D3 F#3 A3 C4', 'G2 B2 D3'], { key: 'C mayor', cad: { has: 'Semicadencia' } });
prog('G13', 3, 'Cadencia en menor: el texto usa mayúsculas (V → I)', ['A2 C3 E3', 'E2 G#2 B2 D3', 'A2 C3 E3'], { key: 'A menor', cad: { has: ['V → i', '(V → i)'] } });

prog('H01', 1, 'Pop I–V–vi–IV', ['C3 E3 G3', 'G2 B2 D3', 'A2 C3 E3', 'F2 A2 C3'], { found: ['I–V–vi–IV'] });
prog('H02', 1, 'Doo-wop I–vi–IV–V', ['C3 E3 G3', 'A2 C3 E3', 'F2 A2 C3', 'G2 B2 D3'], { found: ['Años 50'] });
prog('H03', 2, '12 compases de blues', ['C3 E3 G3 Bb3', 'C3 E3 G3 Bb3', 'C3 E3 G3 Bb3', 'C3 E3 G3 Bb3', 'F3 A3 C4 Eb4', 'F3 A3 C4 Eb4', 'C3 E3 G3 Bb3', 'C3 E3 G3 Bb3', 'G2 B2 D3 F3', 'F3 A3 C4 Eb4', 'C3 E3 G3 Bb3', 'C3 E3 G3 Bb3'], { key: 'C mayor', found: ['Blues de 12 compases'] });
prog('H04', 2, 'Pop con inversión I–V⁶–vi–IV', ['C3 E3 G3', 'B2 D3 G3', 'A2 C3 E3', 'F2 A2 C3'], { found: ['I–V–vi–IV'] });
prog('H05', 2, 'Rotación V–vi–IV–I (patrón en bucle)', ['G2 B2 D3', 'A2 C3 E3', 'F2 A2 C3', 'C3 E3 G3'], { key: 'C mayor', found: ['I–V–vi–IV'] });
prog('H06', 2, 'Ciclo de quintas iii–vi–ii–V–I', ['E3 G3 B3', 'A2 C3 E3', 'D3 F3 A3', 'G2 B2 D3', 'C3 E3 G3'], { key: 'C mayor', found: ['Ciclo de quintas', 'iii–vi–ii–V'] });
prog('H07', 2, 'Sin patrón (acordes al azar)', ['C3 E3 G3', 'Eb3 G3 Bb3', 'F#3 A#3 C#4', 'A2 C#3 E3'], { found: [] });

for (const c of progCases) {
  const o = runProg(c.chords);
  const ch = c.checks;
  const head = `${c.desc}: ${o.labels.join(' – ')}`;
  if (ch.key) add('tonalidad', c.id, c.level, head, ch.key, o.key + (o.alt ? ` (alt ${o.alt})` : ''), acc(ch.key, o.key) && !ch.regions, c.ref, ch.regions ? 'la app da una sola tonalidad para todo el pattern' : '');
  if (ch.alt) add('tonalidad', c.id + '-alt', c.level, head + ' (alternativa visible)', ch.alt, o.alt || '(sin alternativa)', !!o.alt, c.ref);
  if (ch.romans) ch.romans.forEach((e, i) => { if (e == null) return; add('grado', `${c.id}.${i + 1}`, c.level, `${head} · acorde ${i + 1} (${o.labels[i]})`, e, o.romans[i], acc(e, o.romans[i]), c.ref); });
  if (ch.fn) ch.fn.forEach((e, i) => add('función', `${c.id}.${i + 1}`, c.level, `${head} · ${o.romans[i]}`, e, o.fn[i], acc(e, o.fn[i]), c.ref));
  if (ch.spell) Object.entries(ch.spell).forEach(([i, e]) => {
    const got = o.spelled[i].join(' ');
    const ok = (Array.isArray(e) ? e : [e]).some(x => [...new Set(norm(x).split(' '))].sort().join(' ') === [...new Set(got.split(' '))].sort().join(' '));
    add('enarmonía', `${c.id}.${+i + 1}`, c.level, `${head} · acorde ${+i + 1} en ${o.key}`, e, got, ok, c.ref);
  });
  if (ch.cad) {
    const cd = ch.cad; let ok, exp;
    if (cd.none) { ok = !o.cad; exp = '(ninguna)'; }
    else if (cd.not) { ok = !o.cad.includes(cd.not); exp = `no "${cd.not}"`; }
    else { const hs = Array.isArray(cd.has) ? cd.has : [cd.has]; ok = hs.some(h => o.cad.includes(h)); exp = hs.join(' | '); }
    add('cadencia', c.id, c.level, head, exp, o.cad || '(ninguna)', ok, c.ref);
  }
  if (ch.found) {
    if (!ch.found.length) add('patrón', c.id, c.level, head, '(ninguno)', o.found.join('; ') || '(ninguno)', !o.found.length, c.ref);
    ch.found.forEach(f => { const fs_ = Array.isArray(f) ? f : [f]; add('patrón', c.id, c.level, head, fs_.join(' | '), o.found.join('; ') || '(ninguno)', fs_.some(x => o.found.some(g => g.includes(x))), c.ref); });
  }
}

// ---------- I. text parsing of note names ----------
const parseCases = [
  ['I01', 1, 'Notas con octava', 'C4 E4 G4', [60, 64, 67]],
  ['I02', 1, 'Solfeo latino', 'Do4 Mi4 Sol4', [60, 64, 67]],
  ['I03', 1, 'Sostenido y bemol ASCII', 'C#4 Eb4', [61, 63]],
  ['I04', 1, 'Sostenido y bemol Unicode', 'C♯4 E♭4', [61, 63]],
  ['I05', 2, 'B♯3 es MIDI 60', 'B#3', [60]],
  ['I06', 2, 'C♭4 es MIDI 59', 'Cb4', [59]],
  ['I07', 2, 'E♯4 y F♭4', 'E#4 Fb4', [65, 64]],
  ['I08', 2, 'Doble sostenido (## y x)', 'C##4 Fx4', [62, 67]],
  ['I09', 2, 'Doble bemol', 'Dbb4 Bbb3', [60, 57]],
  ['I10', 2, 'Doble sostenido Unicode 𝄪', 'F𝄪4', [67]],
  ['I11', 2, 'Doble bemol Unicode 𝄫', 'B𝄫3', [57]],
  ['I12', 1, 'Solfeo con alteración', 'Sol#2 Si♭3', [44, 58]],
  ['I13', 2, 'Minúsculas', 'c4 e4 g4', [60, 64, 67]],
  ['I14', 2, 'Límite inferior C0 = 12', 'C0', [12]],
  ['I15', 2, 'Fuera de rango C-1', 'C-1 C4', [60]],
  ['I16', 2, 'Nombre de acorde antes de las notas', 'G7 B2 F3', [47, 53]],
  ['I17', 2, 'Formato exportado', 'Am7 | A3 C4 E4 G4 | 57 60 64 67 | 4 tiempos', [57, 60, 64, 67]],
  ['I18', 2, 'Cabecera FL Studio (C5 = 60)', '# Octavas: FL Studio (C5 = MIDI 60)\nC5 E5 G5', [60, 64, 67]],
  ['I19', 3, 'Notación alemana H (= B)', 'H3 D4 F#4', [59, 62, 66]],
  ['I20', 3, 'Re♯ escrito en solfeo con sostenido Unicode', 'Re♯4', [63]],
];
for (const [id, lv, desc, txt, exp] of parseCases) {
  let got;
  try { const o = parseText(txt, P); const st = o.projects[0]?.patterns[0]?.steps[0]; got = st ? st.notes : []; } catch (e) { got = 'ERROR ' + e.message; }
  add('parseo', id, lv, `${desc}: "${txt.replace(/\n/g, ' ⏎ ')}"`, exp.join(' '), Array.isArray(got) ? got.join(' ') : got, Array.isArray(got) && got.join(' ') === exp.join(' '));
}

// ---------- J. chords + melody in one pattern, read through the text export ----------
let uidn = 0;
const pat = (name, chords, mel) => {
  const notes = []; let t = 0;
  for (const [ns, beats] of chords) { N(ns).forEach(m => notes.push({ id: 'n' + (uidn++), m, s: t, l: beats * T, v: 100 })); t += beats * T; }
  for (const [x, s, l] of mel) notes.push({ id: 'n' + (uidn++), m: midiOf(x), s: Math.round(s * T), l: Math.round(l * T), v: 100 });
  return normProg({ id: 'p' + name, name, beats: 4, notes, names: {} });
};
const texts = {};
const melLine = (txt, note, start) => txt.split('\n').find(l => new RegExp(`^${note.replace(/[#♯]/g, '[#♯]').replace('b', '[b♭]')}\\s*\\(\\d+\\) \\| ${start} \\|`).test(norm(l)) || norm(l).startsWith(`${norm(note)} (`) && l.includes(`| ${start} |`));
const harmLines = txt => txt.split('\n').filter(l => /^\d+\. /.test(l) && l.split('|').length >= 5 && !/^\d+\. .*\| \d+ \d+/.test(l.split('|')[3] || ''));
const melCases = [];
const mc = (id, level, desc, chords, mel, checks, ref) => melCases.push({ id, level, desc, chords, mel, checks, ref });

mc('J01', 1, 'Nota de paso sobre C', [['C3 E3 G3', 4]], [['E4', 0, 1], ['F4', 1, 1], ['G4', 2, 2]], { role: [['F4', '1', 'paso']], chords: ['C'] });
mc('J02', 1, 'Bordadura sobre C', [['C3 E3 G3', 4]], [['E4', 0, 1], ['F4', 1, 1], ['E4', 2, 2]], { role: [['F4', '1', 'bordadura']] });
mc('J03', 1, 'Apoyatura en tiempo fuerte', [['C3 E3 G3', 4]], [['D4', 0, 1], ['C4', 1, 3]], { role: [['D4', '0', 'apoyatura']], chords: ['C'] });
mc('J04', 2, 'Escapada', [['C3 E3 G3', 4]], [['E4', 0, 1], ['F4', 1, 1], ['C4', 2, 2]], { role: [['F4', '1', 'escapada']] });
mc('J05', 2, 'Anticipación de G sobre el último octavo de C', [['C3 E3 G3', 4], ['G2 B2 D3', 4]], [['C4', 0, 3.5], ['B3', 3.5, 0.5], ['B3', 4, 4]], { role: [['B3', '3.5', 'anticipación']], chords: ['C', 'G'] }, 'Kostka & Payne, cap. 11');
mc('J06', 2, 'Paso cromático', [['C3 E3 G3', 4]], [['E4', 0, 1], ['F4', 1, 1], ['F#4', 2, 1], ['G4', 3, 1]], { role: [['F4', '1', 'paso'], ['F#4', '2', 'paso']] });
mc('J07', 3, 'Retardo 4–3 (F de G7 retenido sobre C)', [['G2 B2 D3 F3', 2], ['C3 E3 G3', 2]], [['G4', 0, 1], ['F4', 1, 2], ['E4', 3, 1]], { role: [['F4', '1', 'nota del acorde']], chords: ['G7', 'C'], textHas: ['retardo'] }, 'Aldwell & Schachter, cap. 18');
mc('J08', 3, 'Doble bordadura (cambiata)', [['C3 E3 G3', 4]], [['E4', 0, 1], ['F4', 1, 1], ['D4', 2, 1], ['E4', 3, 1]], { role: [['F4', '1', ['bordadura doble', 'bordadura']], ['D4', '2', ['bordadura doble', 'bordadura']]] });
mc('J09', 1, 'Saltos entre notas del acorde', [['C3 E3 G3', 4]], [['C4', 0, 1], ['G4', 1, 1], ['E4', 2, 2]], { role: [['G4', '1', 'nota del acorde'], ['E4', '2', 'nota del acorde']] });
mc('J10', 2, 'Progresión I–vi–IV–V con melodía: acordes no contaminados', [['C3 E3 G3', 4], ['A2 C3 E3', 4], ['F2 A2 C3', 4], ['G2 B2 D3', 4]],
  [['E5', 0, 1], ['D5', 1, 1], ['C5', 2, 2], ['C5', 4, 2], ['B4', 6, 1], ['A4', 7, 1], ['A4', 8, 2], ['C5', 10, 2], ['B4', 12, 2], ['D5', 14, 2]],
  { chords: ['C', 'Am', 'F', 'G'], romans: ['I', 'vi', 'IV', 'V'], key: 'C mayor', textHas: ['Años 50', 'Semicadencia'], role: [['D5', '1', 'paso'], ['B4', '6', 'paso']] });
mc('J11', 2, 'Melodía que empieza y dura igual que el acorde (redonda)', [['C3 E3 G3', 4], ['G2 B2 D3', 4]], [['E5', 0, 4], ['D5', 4, 4]], { chords: ['C', 'G'], melody: ['E5', 'D5'] });
mc('J12', 2, 'Melodía redonda que no es nota del acorde (9ª)', [['C3 E3 G3', 4]], [['D5', 0, 4]], { chords: [['C', 'Cadd9']], melody: ['D5'] });
mc('J13', 3, 'Acorde arpegiado (Alberti) sin bloque', [], [['C4', 0, .5], ['G4', .5, .5], ['E4', 1, .5], ['G4', 1.5, .5], ['C4', 2, .5], ['G4', 2.5, .5], ['E4', 3, .5], ['G4', 3.5, .5], ['B3', 4, .5], ['G4', 4.5, .5], ['D4', 5, .5], ['G4', 5.5, .5], ['B3', 6, .5], ['G4', 6.5, .5], ['D4', 7, .5], ['G4', 7.5, .5]], { chords: ['C', 'G'] });
mc('J14', 2, 'Bajo y melodía a dos voces', [], [['C3', 0, 4], ['E4', 0, 1], ['G4', 1, 1], ['C5', 2, 2], ['G2', 4, 4], ['D4', 4, 1], ['B3', 5, 1], ['G3', 6, 2]], { chords: [['C', 'C(no5)'], ['G', 'G(no3)', 'G5', 'G(5)']] });
mc('J15', 3, 'Melodía con E♯ en Fa♯ mayor (deletreo en el texto)', [['F#3 A#3 C#4', 4], ['B2 D#3 F#3', 4], ['C#3 E#3 G#3 B3', 4], ['F#3 A#3 C#4', 4]], [['A#4', 0, 4], ['B4', 4, 4], ['E#5', 8, 2], ['G#5', 10, 2], ['F#5', 12, 4]], { key: 'F# mayor', textHas: ['E#5'], textNot: ['F5 (77)'] });
mc('J16', 3, 'Melodía con B♯ (sensible) en Do♯ menor', [['C#3 E3 G#3', 4], ['G#2 B#2 D#3', 4], ['C#3 E3 G#3', 4]], [['E4', 0, 2], ['C#4', 2, 2], ['B#3', 4, 2], ['D#4', 6, 2], ['C#4', 8, 4]], { key: 'C# menor', textHas: ['B#3'], textNot: ['C4 (60)'] });
mc('J17', 2, 'Pedal de tónica bajo V7 (C sostenido)', [['C2 C3 E3 G3', 4], ['C2 B2 D3 F3 G3', 4], ['C2 C3 E3 G3', 4]], [], { chords: ['C', ['G7/C', 'G11/C', 'G7 (pedal C)'], 'C'] });
mc('J18', 2, 'Viaje de ida y vuelta: exportar e importar el texto', [['C3 E3 G3', 4], ['A2 C3 E3', 4]], [['E5', 0, 1], ['D5', 1, 1], ['C5', 2, 2], ['C5', 4, 4]], { roundtrip: true });

for (const c of melCases) {
  const p = pat(c.id, c.chords, c.mel);
  const txt = progText(p, P);
  texts[c.id] = { desc: c.desc, text: txt };
  const ch = c.checks;
  const hl = txt.split('\n').filter(l => /^\d+\. [^|]+\| [^|]+\([^)]*·/.test(l));
  const labels = hl.map(l => l.split('|')[0].replace(/^\d+\.\s*/, '').trim());
  const romans = hl.map(l => l.split('|')[1].trim().split(' (')[0]);
  const head = `${c.desc}`;
  if (ch.chords) {
    add('melodía+acordes', c.id + '-acordes', c.level, head + ' · acordes detectados', ch.chords.map(x => Array.isArray(x) ? x.join('/') : x).join(' – '), labels.join(' – ') || '(ninguno)',
      labels.length === ch.chords.length && ch.chords.every((e, i) => acc(e, labels[i])), c.ref);
  }
  if (ch.romans) add('melodía+acordes', c.id + '-grados', c.level, head + ' · grados', ch.romans.join(' – '), romans.join(' – '), romans.length === ch.romans.length && ch.romans.every((e, i) => acc(e, romans[i])), c.ref);
  if (ch.key) { const m = txt.match(/Tonalidad estimada: ([^·]+)/); const k = m ? m[1].trim() : '(sin línea)'; add('melodía+acordes', c.id + '-tonalidad', c.level, head + ' · tonalidad', ch.key, k, acc(ch.key, k), c.ref); }
  if (ch.textHas) ch.textHas.forEach(s => add('melodía+acordes', c.id + '-texto', c.level, head + ` · el texto contiene "${s}"`, s, txt.includes(s) || norm(txt).includes(norm(s)) ? 'sí' : 'no', txt.includes(s) || norm(txt).includes(norm(s)), c.ref));
  if (ch.textNot) ch.textNot.forEach(s => add('melodía+acordes', c.id + '-texto-no', c.level, head + ` · el texto no contiene "${s}"`, 'ausente', txt.includes(s) ? 'presente' : 'ausente', !txt.includes(s), c.ref));
  if (ch.melody) {
    const ml = txt.split('\n').filter(l => /^[A-G][#♯b♭]*\d+(\+[A-G][#♯b♭]*\d+)* \(\d/.test(l));
    const mm = [...new Set(ml.map(l => l.split(' (')[0]))];
    add('melodía+acordes', c.id + '-melodía', c.level, head + ' · melodía detectada', ch.melody.join(' '), mm.join(' ') || '(ninguna)', ch.melody.every(x => mm.some(y => norm(y) === norm(x))), c.ref);
  }
  if (ch.role) ch.role.forEach(([note, start, exp]) => {
    const line = txt.split('\n').find(l => norm(l).startsWith(norm(note) + ' (') && l.split('|')[1] && l.split('|')[1].trim() === start);
    const role = line ? line.split('|').pop().trim() : '(nota no listada como melodía)';
    add('melodía+acordes', `${c.id}-${note}@${start}`, c.level, `${head} · rol de ${note} en el tiempo ${start}`, exp, role, (Array.isArray(exp) ? exp : [exp]).some(e => role.startsWith(e)), c.ref);
  });
  if (ch.roundtrip) {
    const back = parseText(txt, P).projects[0]?.patterns[0];
    const a = p.notes.map(n => `${n.m}@${n.s}+${n.l}`).sort().join(' ');
    const b = back ? (back.notes.length ? back.notes : []).map(n => `${n.m}@${n.s}+${n.l}`).sort().join(' ') : '';
    add('texto', c.id, c.level, head, 'mismas notas al reimportar', b === a ? 'iguales' : `distintas (${back ? back.notes.length : 0} notas, pasos ${back ? back.steps.length : 0})`, b === a, c.ref);
  }
}

mc('K02', 2, 'Dos acordes C → G: tonalidad ambigua, el texto debe dar la alternativa', [['C3 E3 G3', 4], ['G2 B2 D3', 4]], [['E4', 0, 2], ['D4', 2, 2], ['D4', 4, 4]], { key: ['C mayor', 'G mayor'], textHas: ['C mayor', 'G mayor'] });
mc('K03', 2, 'Blues I7 con melodía de blue note (E♭ sobre C7)', [['C3 E3 G3 Bb3', 4], ['F3 A3 C4 Eb4', 4], ['C3 E3 G3 Bb3', 4]], [['G4', 0, 1], ['Eb4', 1, 1], ['E4', 2, 2], ['C4', 4, 4], ['C4', 8, 4]], { key: 'C mayor', romans: ['I7', 'IV7', 'I7'], role: [['E♭4', '1', ['nota de color', 'blue note', 'apoyatura', 'paso', 'bordadura']]] });
for (const c of melCases.slice(-2)) {
  const p = pat(c.id, c.chords, c.mel); const txt = progText(p, P); texts[c.id] = { desc: c.desc, text: txt }; const ch = c.checks;
  const hl = txt.split('\n').filter(l => /^\d+\. [^|]+\| [^|]+\([^)]*·/.test(l)); const romans = hl.map(l => l.split('|')[1].trim().split(' (')[0]);
  if (ch.key) { const m = txt.match(/Tonalidad estimada: ([^·]+)/); const k = m ? m[1].trim() : '(sin línea)'; add('melodía+acordes', c.id + '-tonalidad', c.level, c.desc + ' · tonalidad', ch.key, k, acc(ch.key, k)); }
  if (ch.romans) add('melodía+acordes', c.id + '-grados', c.level, c.desc + ' · grados', ch.romans.join(' – '), romans.join(' – '), romans.length === ch.romans.length && ch.romans.every((e, i) => acc(e, romans[i])));
  if (ch.textHas) { const ok = ch.textHas.every(s => norm(txt).includes(norm(s))); add('melodía+acordes', c.id + '-texto', c.level, c.desc + ' · el texto contiene ' + ch.textHas.join(' y '), ch.textHas.join(' y '), ok ? 'sí' : 'no: solo ' + (txt.match(/Tonalidad estimada: ([^·]+)/) || [, '?'])[1].trim(), ok); }
  if (ch.role) ch.role.forEach(([note, start, exp]) => { const line = txt.split('\n').find(l => norm(l).startsWith(norm(note) + ' (') && l.split('|')[1] && l.split('|')[1].trim() === start); const role = line ? line.split('|').pop().trim() : '(nota no listada como melodía)'; add('melodía+acordes', `${c.id}-${note}@${start}`, c.level, `${c.desc} · rol de ${note} en el tiempo ${start}`, exp, role, exp.some(e => role.startsWith(e))); });
}

// pure progression round trip and text labels
{
  const p = pat('K01', [['C3 E3 G3', 4], ['G2 B2 D3 F3', 4], ['A2 C3 E3', 4], ['F2 A2 C3', 4]], []);
  const txt = progText(p, P); texts.K01 = { desc: 'Progresión en bloque sin melodía', text: txt };
  const back = parseText(txt, P).projects[0].patterns[0];
  const a = p.notes.map(n => n.m).sort().join(' '), b = back.steps.flatMap(s => s.notes).sort().join(' ');
  add('texto', 'K01', 1, 'Progresión en bloque: exportar e importar', 'mismas notas', a === b ? 'iguales' : 'distintas', a === b);
  add('texto', 'K01-final', 1, 'Progresión en bloque: línea "# Final"', 'Cadencia rota o ninguna (termina en IV)', (txt.match(/# Final: (.*)/) || [, '(ninguna)'])[1], !/auténtica|Semicadencia/.test(txt.match(/# Final: (.*)/)?.[1] || ''));
}

const caseKey = r => `${r.cat}:${r.id}:${r.expected}`;
export { R as results, caseKey, texts };
