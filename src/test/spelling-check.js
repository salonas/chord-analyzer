// The spelling property (decided 4 Nov 2026, BRIMSTONE pattern 3): every chord tone the app writes takes the letter of its interval
// number above the letter of the root it names (the 5th of A is an E, with whatever accidental it needs, never an F), with at
// most a double accidental; a slash bass is a chord tone too. It is checked on what each surface shows, read back from it, against
// the chord that surface names: the inspector (the chips and every name of «Posibles nombres», through the pure functions the
// panel draws with), the exported text (the line of each chord) and the chord markers of the exported .mid.
// Used by src/spelling.test.js, in the thread of the test and in worker threads (spelling-shard.js).
import { TYPES } from '../data.js';
import { analyze, candSymbol, spellCandidate } from '../analysis.js';
import { normProg } from '../model.js';
import { libText, progText } from '../text.js';
import { buildPack, midiFile } from '../midi.js';
import { spellActive } from '../panel.js';

export const PREFS = ['auto', 'sharp', 'flat'].map(accPref => ({ naming: 'letters', accPref, octConv: 'sci', midiShift: 0 }));
// no key, then every major and every minor key
export const KEYS = [null, ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].flatMap(t => [{ tonic: t, mode: 'major' }, { tonic: t, mode: 'minor' }])];
const TONIC = { major: 'C D♭ D E♭ E F F♯ G A♭ A B♭ B'.split(' '), minor: 'C C♯ D E♭ E F F♯ G G♯ A B♭ B'.split(' ') };
export const keyLabel = k => (k ? `${TONIC[k.mode][k.tonic]} ${k.mode === 'major' ? 'mayor' : 'menor'}` : 'sin tonalidad');

const NAT = [0, 2, 4, 5, 7, 9, 11];
const OFF = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 14, 11: 17, 13: 21 };
const off = d => OFF[d.n] + d.acc;
// one note per degree; the bass on degree k (0: root position), an octave under the rest
export function voicing(t, r, k = 0) {
  const base = 48 + r;
  if (!k) return t.degs.map(d => base + off(d));
  return [base + (((off(t.degs[k]) % 12) + 12) % 12) - 12, ...t.degs.filter((_, j) => j !== k).map(d => base + off(d))];
}
const byTypeSym = new Map(TYPES.map(t => [t.sym, t]));
const asciiSym = s => s.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/Δ/g, 'maj').replace(/ø/g, 'm7b5').replace(/°/g, 'dim');
const byAsciiSym = new Map(TYPES.map(t => [asciiSym(t.sym), t]));
const ACC = { '': 0, '♯': 1, '♭': -1, '♯♯': 2, '♭♭': -2, '𝄪': 2, '𝄫': -2, '#': 1, 'b': -1, '##': 2, 'bb': -2 };
const pcOf = (l, a) => (((NAT[l] + a) % 12) + 12) % 12;
const letterOf = s => 'CDEFGAB'.indexOf(s);
// a written note or root: letter, accidental and pitch class; an accidental beyond a double one is kept as is (a = ±3…) to be flagged
function readNote(s, ascii) {
  const m = ascii ? s.match(/^([A-G])((?:#|b)*)/) : s.match(/^([A-G])((?:♯|♭|𝄪|𝄫)*)/);
  if (!m) return null;
  const a = [...m[2].matchAll(ascii ? /##|bb|#|b/g : /𝄪|𝄫|♯|♭/g)].reduce((x, y) => x + ACC[y[0]], 0);
  const l = letterOf(m[1]);
  return { l, a, pc: pcOf(l, a), len: m[0].length };
}
// what a chord name says: root, type and slash bass. null when the name has no root (It⁺⁶, a single note, «?»)
export function readName(name, ascii) {
  let s = name.replace(/\(5\)(?=\/|$)/, '5');
  const root = readNote(s, ascii); if (!root) return null;
  let bass = null;
  const sl = s.match(ascii ? /\/([A-G](?:#|b)*)$/ : /\/([A-G](?:♯|♭|𝄪|𝄫)*)$/);
  if (sl) { bass = readNote(sl[1], ascii); s = s.slice(0, -sl[0].length); }
  const sym = s.slice(root.len).replace(/\(no5\)$/, '');
  const type = ascii ? byAsciiSym.get(sym) : byTypeSym.get(sym);
  return type ? { root, type, bass } : null;
}
// The letter a written note must have, from the root it is written over: null if the note is no chord tone of that reading
function expect(root, type, note) {
  const d = type.degs.find(x => (x.pc + root.pc) % 12 === note.pc);
  return d ? { d, l: (root.l + d.step) % 7 } : null;
}
// The letters of a key's scale, written independently of the app: pitch class → letter. Its tonic as the key is named, then a
// letter per degree; minor adds the raised 6th and 7th with the letters of the 6th and the 7th, and a mode its characteristic note
const MODE_NOTE = { phrygian: [1, 1], lydian: [6, 3], mixolydian: [10, 6] };
export function scaleLetters(tonicName, mode, modal) {
  const t = readNote(tonicName, false), steps = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10], out = new Map();
  steps.forEach((x, k) => out.set((t.pc + x) % 12, (t.l + k) % 7));
  if (mode === 'minor') { out.set((t.pc + 11) % 12, (t.l + 6) % 7); out.set((t.pc + 9) % 12, (t.l + 5) % 7); }
  if (MODE_NOTE[modal]) out.set((t.pc + MODE_NOTE[modal][0]) % 12, (t.l + MODE_NOTE[modal][1]) % 7);
  return out;
}
export const MODAL = { dórico: 'dorian', frigio: 'phrygian', lidio: 'lydian', mixolidio: 'mixolydian' };
// Collects the failures of one surface: {surface, pref, key, chord, interval, got, want}. With scale (the letters of the key's scale),
// a chord tone that is a note of the scale may keep the key's letter instead of the chord's: the class kept as it was, pending
// (THEORY.md, «Escritura de notas»); those notes are counted apart (kept), not as failures
export class Fails {
  constructor() { this.list = []; this.checked = 0; this.kept = []; }
  note(ctx, root, type, note, label, scale) {
    this.checked++;
    if (Math.abs(root.a) > 2) return this.add(ctx, '1', label, 'triple alteración en la fundamental');
    const e = expect(root, type, note);
    if (!e) return this.add(ctx, '(ninguno)', label, 'no es nota del acorde nombrado');
    if (Math.abs(note.a) > 2) return this.add(ctx, e.d.label, label, 'como mucho doble alteración');
    if (note.l === e.l) return;
    if (scale && scale.get(note.pc) === note.l) { this.kept.push({ ...ctx, interval: e.d.label, got: label, want: 'CDEFGAB'[e.l] }); return; }
    return this.add(ctx, e.d.label, label, 'CDEFGAB'[e.l]);
  }
  add(ctx, interval, got, want) { this.list.push({ ...ctx, interval, got, want }); }
}

// ---------- the inspector: the chips of the chord in use and the form of every name in «Posibles nombres» ----------
// A chord built by hand has no key; one picked in the lane is spelled in the lane's key (spellActive with it). V is the voicing
// read once: its notes, its names and the reading in use (the one the step names: the user picks it, or the lane names it)
export function readVoicing(t, r, k) {
  const notes = voicing(t, r, k).sort((a, b) => a - b), cands = analyze(notes, null);
  const cur = cands.find(c => c.root === r && c.type === t) || analyze(notes, r).find(c => c.root === r && c.type === t);
  return { notes, cands, cur, chord: `${t.sym || 'mayor'} sobre ${r}, bajo ${k}` };
}
export function inspector(F, V, prefs, key) {
  const { notes, cands, cur } = V;
  const ctx = { surface: 'inspector', pref: prefs.accPref, key: keyLabel(key), chord: V.chord };
  const sc = key ? scaleLetters(keyLabel(key).split(' ')[0], key.mode) : null;
  for (const c of cands) {
    const sp = spellCandidate(c, notes, prefs, key || undefined), sy = candSymbol(c, sp, prefs);
    const nm = readName(sy.main + sy.slash, false);
    if (!nm) { F.add(ctx, '1', sy.main + sy.slash, 'un nombre con su fundamental'); continue; }
    // the form of the name: every degree of its type, with the letter it is written with
    c.type.degs.forEach(d => { const s = sp.byPc[(d.pc + c.root) % 12]; F.note(ctx, nm.root, c.type, { l: s.l, a: s.a, pc: (d.pc + c.root) % 12 }, `${sy.main + sy.slash}: ${d.label} ${'CDEFGAB'[s.l]}${s.a}`, sc); });
    if (nm.bass) F.note(ctx, nm.root, c.type, nm.bass, sy.main + sy.slash, sc);
  }
  if (!cur) return;
  const { sp, spelled } = spellActive(notes, cur, prefs, key || undefined), sy = candSymbol(cur, sp, prefs), nm = readName(sy.main + sy.slash, false);
  spelled.forEach(n => n.deg && F.note(ctx, nm.root, cur.type, { l: n.l, a: n.a, pc: n.midi % 12 }, `${sy.main + sy.slash}: ${'CDEFGAB'[n.l]}${n.a}`, sc));
}

// ---------- the exported text and the .mid markers, in a key: the chords in a pattern that sets the key ----------
// Each chord X goes before the tonic, after I – IV – V7 – I: X – I, or V7 – X – I for a dim7. No chromatic reading respells it then
// (a secondary or a dim7 by its resolution needs a chord after it that is not the tonic, an augmented sixth a V after it, and
// the common-tone dim7 the tonic before and after it, hence the V7 before a dim7): what is checked is the spelling of a named
// chord in the key. The chord is named as the user names it (p.names), so its reading is the one under test; its bass is on
// degree r % n, so that every degree is a bass somewhere.
const triad = (t, mode, deg) => {
  const sc = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 11];
  const at = i => sc[i % 7] + 12 * Math.floor(i / 7);
  return [at(deg), at(deg + 2), at(deg + 4)].map(x => 48 + t + x);
};
export function keyPattern(type, key, roots) {
  const I = triad(key.tonic, key.mode, 0), IV = triad(key.tonic, key.mode, 3), V7 = [...triad(key.tonic, key.mode, 4), 48 + key.tonic + 17].map(m => m - 12);
  const steps = [{ notes: I }, { notes: IV }, { notes: V7 }, { notes: I }], at = [];
  roots.forEach(r => {
    const k = r % type.degs.length;
    if (type.sym === 'dim7') steps.push({ notes: V7 });
    at.push({ i: steps.length, r, k });
    steps.push({ notes: voicing(type, r, k), root: r, sym: type.sym }, { notes: I });
  });
  return { p: normProg({ id: 'p', name: 'p', beats: 4, steps: steps.map(s => ({ ...s, beats: 4 })) }), at };
}
const markersOf = bytes => { const out = []; for (let i = 0; i < bytes.length - 3; i++) if (bytes[i] === 0xFF && bytes[i + 1] === 0x06) { const n = bytes[i + 2]; out.push(String.fromCharCode(...bytes.slice(i + 3, i + 3 + n))); i += 2 + n; } return out; };
// The notes a chord line writes, as [written name, pitch class]: a pattern of plain blocks writes «n. label | grado | notas | MIDI |
// duración»; any other, «n. label | grado | inicio–fin | voces (+agregados) | bajo», where the added notes are no chord tones
const lineOf = (txt, n) => txt.split('\n').find(l => l.startsWith(`${n}. `));
function lineNotes(cols) {
  if (/^[\d ]+$/.test(cols[3])) { const midis = cols[3].split(' ').map(Number); return cols[2].split(' ').map((s, j) => [s, midis[j] % 12]); }
  const voices = cols[3].replace(/ \(\+.*\)$/, '').split(' ').filter(x => x !== '—'), bass = cols[4].split(' → ')[0].replace(/ \(.*\)$/, '');
  return [bass, ...voices].map(s => { const n = readNote(s, false); return [s, n && n.pc]; });
}
// the lines of «# Melodía» or «# Voz superior»: «E5 (64) | inicio | duración | sobre | intervalo | tensión | rol»
const tuneLines = txt => { const L = txt.split('\n'), h = L.findIndex(l => /^# (Melodía|Voz superior|Melody|Top voice):/.test(l)); if (h < 0) return []; const out = []; for (let j = h + 1; j < L.length && !L[j].startsWith('#'); j++) out.push(L[j].split(' | ')); return out; };
export function textAndMarkers(F, type, key, prefs, roots) {
  const { p, at } = keyPattern(type, key, roots);
  const txt = progText(p, prefs), marks = markersOf(midiFile(p, 120, prefs).bytes);
  const keyLine = (txt.match(/^# Tonalidad estimada: (.*?)(?: \(| ·)/m) || [])[1] || '', modal = (txt.match(/^# Tonalidad estimada: [^(·]*\((dórico|frigio|lidio|mixolidio)/m) || [])[1];
  const sc = scaleLetters(keyLine.split(' ')[0], /mayor|major/.test(keyLine) ? 'major' : 'minor', MODAL[modal]);
  for (const { i, r, k } of at) {
    const chord = `${type.sym || 'mayor'} sobre ${r}, bajo ${k}`;
    const line = lineOf(txt, i + 1), cols = line.split(' | ');
    const ctx = { surface: 'texto', pref: prefs.accPref, key: keyLabel(key), chord, keyRead: keyLine };
    const label = cols[0].slice(`${i + 1}. `.length), nm = readName(label, false);
    if (!nm) { if (!/⁺⁶$/.test(label)) F.add(ctx, '1', label, 'un nombre con su fundamental'); }
    else {
      if (nm.bass) F.note(ctx, nm.root, nm.type, nm.bass, label, sc);
      lineNotes(cols).forEach(([s, pc]) => { const n = readNote(s, false); F.note(ctx, nm.root, nm.type, { ...n, pc }, `${label}: ${s}`, sc); });
    }
    const mk = marks[i], mctx = { ...ctx, surface: 'marcas MIDI' }, mn = readName(mk, true);
    if (!mn) { if (!/\+6$/.test(mk)) F.add(mctx, '1', mk, 'un nombre con su fundamental'); }
    else { F.note(mctx, mn.root, mn.type, mn.root, mk, sc); if (mn.bass) F.note(mctx, mn.root, mn.type, mn.bass, mk, sc); }
  }
  // the notes of the tune, against the chord they sound over, when they are its tones
  tuneLines(txt).forEach(c => {
    const nm = readName(c[3], false), m = +(c[0].match(/\((\d+)/) || [])[1], n = readNote(c[0], false);
    if (!nm || !n) return;
    const tone = nm.type.degs.some(d => (d.pc + nm.root.pc) % 12 === m % 12);
    if (tone) F.note({ surface: 'texto', pref: prefs.accPref, key: keyLabel(key), chord: `${type.sym || 'mayor'} (melodía)`, keyRead: keyLine }, nm.root, nm.type, { ...n, pc: m % 12 }, `${c[3]}: ${c[0]}`, sc);
  });
  // the key the pattern was read in, as the text names it: whether the context set the key it was built for
  const kn = readNote(keyLine, false), mode = /mayor|major/.test(keyLine) ? 'major' : 'minor';
  return { keyLine, sameKey: !!kn && kn.pc === key.tonic && mode === key.mode, usual: keyLine.replace(/ .*/, '') };
}
// without a key: a saved chord, as the library text writes it and as the pack's .mid of the library marks it
export function libraryChord(F, type, r, k, prefs) {
  const notes = voicing(type, r, k).sort((a, b) => a - b), chord = `${type.sym || 'mayor'} sobre ${r}, bajo ${k}`;
  const lib = { chords: [{ notes, root: r, sym: type.sym }], projects: [] };
  const line = libText(lib, prefs).split('\n')[3], cols = line.split(' | ');
  const ctx = { surface: 'texto', pref: prefs.accPref, key: 'sin tonalidad', chord };
  const nm = readName(cols[0], false);
  if (!nm) F.add(ctx, '1', cols[0], 'un nombre con su fundamental');
  else {
    if (nm.bass) F.note(ctx, nm.root, nm.type, nm.bass, cols[0]);
    const names = cols[1].split(' '), midis = cols[2].split(' ').map(Number);
    names.forEach((s, j) => { const n = readNote(s, false); F.note(ctx, nm.root, nm.type, { ...n, pc: midis[j] % 12 }, `${s} (${midis[j]})`); });
  }
  const pack = buildPack({ name: 'x', bpm: 120, seed: 1, patterns: [] }, lib.chords, prefs);
  const mk = markersOf(pack.files[0].data)[0], mctx = { ...ctx, surface: 'marcas MIDI' }, mn = readName(mk, true);
  if (!mn) F.add(mctx, '1', mk, 'un nombre con su fundamental');
  else { F.note(mctx, mn.root, mn.type, mn.root, mk); if (mn.bass) F.note(mctx, mn.root, mn.type, mn.bass, mk); }
}
