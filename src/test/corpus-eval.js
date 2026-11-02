// Scores the analysis against the external corpus cases in fixtures/theory/corpus/ (TAVERN and Rock Corpus).
// It measures; it asserts nothing and is not part of the probe's ratchet (passing.json). Run it with
// CORPUS_REPORT=1 npx vitest run src/corpus.report.test.js
import crypto from 'node:crypto';
import fs from 'node:fs';
import { analyzeProgression } from '../analysis.js';
import { harmonySegs } from '../harmony.js';
import { normProg, segStep } from '../model.js';

const DIR = new URL('./fixtures/theory/corpus/', import.meta.url);
const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const pcName = pc => NAMES[((pc % 12) + 12) % 12];
const spellName = s => 'CDEFGAB'[s.l] + ({ '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' })[s.a];
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const EXP_SYM = { maj: '', min: 'm', dim: 'dim', aug: 'aug' };
const expSym = e => (e.seventh ? ({ maj: 'maj7', min: 'm7', dom: '7', hdim: 'm7♭5', dim: 'dim7' })[e.quality] : EXP_SYM[e.quality]);
const INV_NAME = ['fundamental', '1ª inversión', '2ª inversión', '3ª inversión', 'bajo en otra nota'];

// Held-out test set: whole works (TAVERN) and whole songs (Rock Corpus), picked by a hash of the name so that the split does not
// move when cases are added and no phrase of a theme leaks into the other side. About one in five. The rules are tuned on the
// rest only; the error analysis in the report is read from the rest too.
export const isTest = name => parseInt(crypto.createHash('sha1').update('chord-analyzer-corpus-v1:' + name).digest('hex').slice(0, 8), 16) % 5 === 0;

export function readJson(rel) { return JSON.parse(fs.readFileSync(new URL(rel, DIR), 'utf8')); }
export function listJson(sub) {
  return fs.readdirSync(new URL(sub + '/', DIR)).filter(f => f.endsWith('.json') && f !== 'skipped.json').sort().map(f => readJson(sub + '/' + f));
}

// ---------- reading what the app says about one step ----------
function appChord(r) {
  const c = r.c; if (!c) return null;
  const d = c.type.degs.find(x => x.pc === (c.bass - c.root + 12) % 12);
  const inv = !c.slash ? 0 : d && d.n === 3 ? 1 : d && d.n === 5 ? 2 : d && d.n === 7 ? 3 : 4;
  return { root: c.root, q: c.type.q, sym: c.type.sym, seventh: isSeventh(c.type.sym), inv };
}
const spellOf = r => { const m = new Map(); (r.spelled || []).forEach(s => m.set(s.midi, spellName(s))); return m; };
const keyRelation = (got, exp) => {
  if (got.tonic === exp.tonic && got.mode === exp.mode) return 'ok';
  if (got.tonic === exp.tonic) return 'misma tónica, otro modo';
  if (exp.mode === 'major' && got.mode === 'minor' && got.tonic === (exp.tonic + 9) % 12) return 'la relativa';
  if (exp.mode === 'minor' && got.mode === 'major' && got.tonic === (exp.tonic + 3) % 12) return 'la relativa';
  if (got.tonic === (exp.tonic + 7) % 12) return 'la tonalidad de la dominante';
  if (got.tonic === (exp.tonic + 5) % 12) return 'la tonalidad de la subdominante';
  return 'otra tonalidad';
};

// ---------- tallies ----------
export class Tally {
  constructor() { this.cats = new Map(); this.errs = new Map(); }
  add(cat, ok, err, only = true) {
    if (!only) return;
    const c = this.cats.get(cat) || { n: 0, ok: 0 }; c.n++; if (ok) c.ok++; this.cats.set(cat, c);
    if (!ok && err) {
      const k = cat + ' — ' + err.sig, e = this.errs.get(k) || { cat, sig: err.sig, n: 0, example: err.example }; e.n++; this.errs.set(k, e);
    }
  }
  rows() { return [...this.cats].map(([cat, c]) => ({ cat, n: c.n, ok: c.ok, pct: c.n ? +(100 * c.ok / c.n).toFixed(1) : null })); }
  top(k) { return [...this.errs.values()].sort((a, b) => b.n - a.n).slice(0, k); }
}
export function mergeTallies(list) {
  const out = new Tally();
  for (const t of list) {
    for (const [k, c] of t.cats) { const o = out.cats.get(k) || { n: 0, ok: 0 }; o.n += c.n; o.ok += c.ok; out.cats.set(k, o); }
    for (const [k, e] of t.errs) { const o = out.errs.get(k); if (o) o.n += e.n; else out.errs.set(k, { ...e }); }
  }
  return out;
}
// The runs of evalTavern or evalRock on single works or songs, added up: the same numbers as one run over all of them
export function mergeRuns(runs) {
  const info = {};
  for (const k of Object.keys(runs[0] ? runs[0].info : {})) {
    const vs = runs.map(r => r.info[k]);
    info[k] = vs[0] instanceof Tally ? mergeTallies(vs) : Array.isArray(vs[0]) ? vs.flat(1) : vs.reduce((s, v) => s + v, 0);
  }
  return { T: mergeTallies(runs.map(r => r.T)), info };
}

// ---------- confidence intervals ----------
// Percentile bootstrap over whole units (a TAVERN work, a Rock Corpus song): the phrases of a work are not independent, so the
// unit of resampling is the work. The draws come from a fixed seed, and every category and both sides of a comparison use the
// same draws. With few units (6 test works) the interval is optimistic: it cannot see the variation of works it has not met.
const BOOT = 2000;
function draws(nUnits, B = BOOT, seed = 20261102) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return Array.from({ length: B }, () => Array.from({ length: nUnits }, () => Math.floor(rnd() * nUnits)));
}
const pctile = (xs, q) => { const a = [...xs].sort((x, y) => x - y), i = (a.length - 1) * q, lo = Math.floor(i); return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (i - lo); };
const cats = units => [...new Set(units.flatMap(t => [...t.cats.keys()]))];
// {category: [low, high]} in percent, one decimal
export function bootstrapCI(units) {
  const D = draws(units.length), out = {};
  for (const cat of cats(units)) {
    const c = units.map(t => t.cats.get(cat) || { n: 0, ok: 0 });
    const v = D.map(d => { let n = 0, ok = 0; d.forEach(i => { n += c[i].n; ok += c[i].ok; }); return n ? 100 * ok / n : null; }).filter(x => x !== null);
    out[cat] = [+pctile(v, .025).toFixed(1), +pctile(v, .975).toFixed(1)];
  }
  return out;
}
// The same for the difference after − before, unit by unit (paired: each draw takes the same works on both sides)
export function bootstrapDiff(before, after) {
  const D = draws(before.length), out = {};
  for (const cat of cats([...before, ...after])) {
    const b = before.map(t => t.cats.get(cat) || { n: 0, ok: 0 }), a = after.map(t => t.cats.get(cat) || { n: 0, ok: 0 });
    const v = D.map(d => { let nb = 0, ob = 0, na = 0, oa = 0; d.forEach(i => { nb += b[i].n; ob += b[i].ok; na += a[i].n; oa += a[i].ok; }); return nb && na ? 100 * (oa / na - ob / nb) : null; }).filter(x => x !== null);
    out[cat] = [+pctile(v, .025).toFixed(1), +pctile(v, .975).toFixed(1)];
  }
  return out;
}

// ---------- TAVERN ----------
// with plain, the steps carry no timing and the analysis reads them as it did before the ornament rule (the «before» of a comparison)
const stepOf = (notes, a, b, plain) => {
  const on = notes.filter(n => n[1] < b && n[1] + n[2] > a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y);
  return ms.length ? { notes: ms, dur: b - a, ...(!plain && { a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) }) } : null;
};
const kernNames = notes => { const m = new Map(); notes.forEach(n => { if (!m.has(n[0])) m.set(n[0], new Set()); m.get(n[0]).add(n[3]); }); return m; };
const overlap = (x, y) => Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));
function bestOverlap(seg, others) {
  let best = null, bo = 0;
  for (const o of others) { const v = overlap(seg, o); if (v > bo) { bo = v; best = o; } }
  return best;
}
// The app's chords as the analyst cuts: neighbours that the app reads the same (root, type and bass, as the lane shows them,
// with the key and the context) are one stretch, because the app gave the same harmony on several attacks. It is part of
// what the end-to-end rows measure (decided 2 Nov 2026), not a change of the app: the lane still shows each attack
const sameReading = (x, y) => !!x.c && !!y.c && x.c.root === y.c.root && x.c.type.sym === y.c.type.sym && x.c.bass % 12 === y.c.bass % 12;
export function laneStretches(segs, A) {
  const out = [];
  segs.forEach((s, i) => {
    const g = out[out.length - 1];
    if (g && s.a - g.b <= 5 && sameReading(A.rs[g.parts[g.parts.length - 1]], A.rs[i])) { g.b = s.b; g.parts.push(i); }
    else out.push({ a: s.a, b: s.b, parts: [i] });
  });
  return out;
}
const sameChord = (e, o) => o && o.exp && e.root === o.exp.root && e.quality === o.exp.quality && e.seventh === o.exp.seventh;

// Scores one step against the expected data of its segment (and the other annotator's reading of the same stretch).
// Only the metrics that count something of their own record their errors: the others (root alone, raw degree) repeat them.
function scoreStep(T, mode, ph, seg, other, r, rom, keyOk, kern) {
  const e = seg.exp, o = other && other.exp ? other.exp : null;
  const ch = appChord(r);
  const exps = [e, ...(o ? [o] : [])];
  const nm = c => `${pcName(c.root)}${expSym(c)}`;
  const show = c => c ? `${pcName(c.root)}${c.sym}${c.inv ? '/' + INV_NAME[c.inv] : ''}` : '(sin acorde)';
  const kn = kern(r.notes);
  const spelled = [...kn].map(([m, set]) => [...set][0] + ' (' + m + ')').join(' ');
  const detail = { phrase: ph.id, mode, label: seg.label, key: ph.key.token, notes: spelled, expected: nm(e) + (e.inv ? '/' + INV_NAME[e.inv] : ''), got: show(ch) };
  const ordinal = ['', '3ª', '5ª', '7ª'];
  // chord
  const rootOwn = !!ch && ch.root === e.root, rootAny = !!ch && exps.some(x => x.root === ch.root);
  const qualOwn = rootOwn && ch.q === e.quality && ch.seventh === e.seventh;
  const qualAny = !!ch && exps.some(x => ch.root === x.root && ch.q === x.quality && ch.seventh === x.seventh);
  let sig;
  const nPc = new Set(r.notes.map(m => m % 12)).size;
  if (!ch) sig = `la app no leyó acorde (el tramo tiene ${nPc === 1 ? 'una sola clase de altura' : nPc === 2 ? '2 clases de altura' : nPc <= 4 ? '3 o 4 clases de altura' : '5 o más clases de altura'})`;
  else if (rootAny) sig = `raíz bien; esperado ${expSym(exps.find(x => x.root === ch.root)) || 'mayor'}, la app leyó ${ch.sym || 'mayor'}`;
  else { const k = e.pcs.indexOf(ch.root); sig = `raíz equivocada: ${expSym(e) || 'mayor'} leído con raíz en ${k > 0 ? 'su ' + ordinal[k] : 'una nota ajena al acorde'} (${ch.sym || 'mayor'})`; }
  T.add(mode + ' | acorde: raíz (solo la lectura propia)', rootOwn);
  T.add(mode + ' | acorde: raíz (acepta A o B)', rootAny);
  T.add(mode + ' | acorde: raíz + calidad (solo la lectura propia)', qualOwn);
  T.add(mode + ' | acorde: raíz + calidad (acepta A o B)', qualAny, qualAny ? null : { sig, example: detail });
  // the whole name: F7♭9 or Cadd11 count above as F7 and C, here they do not
  T.add(mode + ' | acorde: nombre exacto, sin extensiones (acepta A o B)', !!ch && exps.some(x => ch.root === x.root && ch.sym === expSym(x)));
  T.add(mode + ' | acorde: raíz + calidad (acepta A o B), tramos con todas las notas del acorde sonando', qualAny, null, e.complete);
  // control of the conversion: the notes of the stretch are exactly the pitch classes of the labelled chord
  T.add(mode + ' | acorde: raíz + calidad (acepta A o B), tramos cuyas notas son exactamente las del acorde (control)', qualAny, null, nPc === e.pcs.length && e.complete);
  T.add(mode + ' | acorde: raíz + calidad (acepta A o B), tramos a los que les falta alguna nota del acorde', qualAny, null, !e.complete);
  // what sounds does not tell the quality: a power chord on the expected root, or a single pitch class that is the expected root.
  // The app says what sounds (F5, or no chord) and does not guess the third from the key (decision of 2 Nov 2026), so these
  // stretches get a row of their own and a version of the chord row without them
  const undet = !qualAny && (ch ? ch.sym === '5' && rootAny : nPc === 1 && exps.some(x => x.root === r.notes[0] % 12));
  T.add(mode + ' | acorde: raíz correcta, calidad no determinable (power chord o una sola nota)', undet);
  T.add(mode + ' | acorde: raíz + calidad (acepta A o B), sin contar los tramos de calidad no determinable', qualAny, null, !undet);
  // inversion
  const invOk = !!ch && exps.some(x => x.inv === ch.inv);
  T.add(mode + ' | inversión (cruda)', invOk);
  if (qualAny) T.add(mode + ' | inversión (dado el acorde correcto)', invOk, invOk ? null : { sig: `con el acorde bien: esperado ${INV_NAME[e.inv]}, la app dio ${INV_NAME[ch.inv]}`, example: detail });
  // degree: it is the chord's root against the key's tonic, so it adds nothing of its own once the chord and the key are known
  const degOk = !!rom && exps.some(x => x.degree.includes(rom.deg));
  T.add(mode + ' | grado (crudo)', degOk);
  if (keyOk) T.add(mode + ' | grado (dada la tonalidad correcta)', degOk);
  // spelling: every distinct note of the step against the Humdrum spelling
  const got = spellOf(r);
  let allOk = true;
  for (const [midi, set] of kn) {
    const ok = got.has(midi) && set.has(got.get(midi));
    T.add(mode + ' | enarmonía (nota a nota)', ok, ok ? null : { sig: `${[...set][0]} escrito ${got.get(midi) || '?'}`, example: { phrase: ph.id, label: seg.label, key: ph.key.token, note: `${[...set][0]} (${midi})`, app: got.get(midi) || '?', appChord: show(ch) } });
    if (!ok) allOk = false;
  }
  T.add(mode + ' | enarmonía (tramo con todas las notas bien)', allOk);
  return { hit: qualAny, undet };
}

export function evalTavern(pieces, { plain = false } = {}) {
  const T = new Tally(), info = { phrases: 0, segsConverted: 0, segsSkipped: 0, complete: 0, incompleteSegs: 0, appChordsPerAnalystSeg: [], agreement: new Tally() };
  const kernOf = ph => { const m = kernNames(ph.notes); return midis => { const out = new Map(); midis.forEach(x => out.set(x, m.get(x) || new Set())); return out; }; };
  for (const piece of pieces) for (const ph of piece.phrases) {
    info.phrases++;
    const kern = kernOf(ph);
    // pattern for the app's own segmentation
    const pat = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
    const appSegs = harmonySegs(pat);
    const appA = appSegs.length ? analyzeProgression(appSegs.map(S => segStep(pat, S)).map(st => (plain ? { notes: st.notes, dur: st.dur } : st)), P) : null;
    const lane = appA ? laneStretches(appSegs, appA) : [];
    const expKey = { tonic: ph.key.tonic, mode: ph.key.mode };
    for (const who of ['A', 'B']) {
      const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'];
      // inter-annotator agreement (a ceiling for the readings): this annotator's segment against the other's on the same stretch
      for (const s of mine) if (s.exp) {
        const o = bestOverlap(s, theirs);
        if (o && o.exp) {
          info.agreement.add('raíz + calidad', sameChord(s.exp, o));
          info.agreement.add('inversión', s.exp.inv === o.exp.inv);
          info.agreement.add('grado', s.exp.degree.some(d => o.exp.degree.includes(d)));
        }
      }
      // ---- by annotated stretch: the app gets the notes of each stretch ----
      const steps = [], idx = [];
      mine.forEach((s, i) => { const st = stepOf(ph.notes, s.a, s.b, plain); if (st) { idx.push(i); steps.push(st); } });
      if (steps.length) {
        const A = analyzeProgression(steps, P);
        const keyRel = keyRelation(A.key, expKey), keyOk = keyRel === 'ok';
        const mode = 'por tramo';
        T.add(mode + ' | tonalidad (tónica y modo)', keyOk, keyOk ? null : { sig: `se leyó ${keyRel}`, example: { phrase: ph.id, mode, key: ph.key.token, got: `${pcName(A.key.tonic)} ${A.key.mode}` } });
        T.add(mode + ' | tonalidad (solo la tónica)', A.key.tonic === expKey.tonic);
        T.add(mode + ' | frases que la app parte en regiones (TAVERN anota una tonalidad por frase; menos es mejor)', !!A.regions);
        idx.forEach((si, j) => {
          const s = mine[si]; if (!s.exp) { info.segsSkipped++; return; }
          info.segsConverted++; if (s.exp.complete) info.complete++; else info.incompleteSegs++;
          scoreStep(T, mode, ph, s, bestOverlap(s, theirs), A.rs[j], A.romans[j], keyOk, kern);
        });
      }
      // ---- end to end: the app's own segmentation. A phrase where the app reads no chord at all counts too: every stretch
      // of it is uncovered (until 2 Nov 2026 such phrases were left out, which raised the coverage and the end-to-end row) ----
      {
        const mode = 'de punta a punta';
        const keyRel = appA ? keyRelation(appA.key, expKey) : null, keyOk = keyRel === 'ok';
        if (appA) {
          T.add(mode + ' | tonalidad (tónica y modo)', keyOk, keyOk ? null : { sig: `se leyó ${keyRel}`, example: { phrase: ph.id, mode, key: ph.key.token, got: `${pcName(appA.key.tonic)} ${appA.key.mode}` } });
          T.add(mode + ' | tonalidad (solo la tónica)', appA.key.tonic === expKey.tonic);
          T.add(mode + ' | frases que la app parte en regiones (TAVERN anota una tonalidad por frase; menos es mejor)', !!appA.regions);
        }
        const conv = mine.filter(s => s.exp);
        info.appChordsPerAnalystSeg.push([lane.length, mine.length]);
        // boundaries: each analyst boundary against the app's, within an eighth note
        const bounds = a => [...new Set(a.flatMap(s => [s.a]).slice(1))];
        const ab = bounds(mine), pb = bounds(lane);
        ab.forEach(t => T.add(mode + ' | segmentación: cortes del analista que la app también corta (±48 ticks)', pb.some(x => Math.abs(x - t) <= 48), null));
        pb.forEach(t => T.add(mode + ' | segmentación: cortes de la app que el analista también corta (±48 ticks)', ab.some(x => Math.abs(x - t) <= 48), null));
        for (const s of conv) {
          // the app stretch that covers most of the analyst's stretch, if it covers at least half; it is scored on its piece
          // that overlaps the analyst's stretch most (all its pieces have the same chord and bass)
          const g = lane.reduce((b, c, i) => (overlap(s, c) > (b < 0 ? 0 : overlap(s, lane[b])) ? i : b), -1);
          const covered = g >= 0 && overlap(s, lane[g]) * 2 >= s.b - s.a;
          const k = covered ? lane[g].parts.reduce((b, i) => (overlap(s, appSegs[i]) > overlap(s, appSegs[b]) ? i : b)) : -1;
          T.add(mode + ' | tramo del analista cubierto por un acorde de la app (≥ la mitad)', covered, null);
          const all = mode + ' | acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app';
          if (!covered) { T.add(all, false); T.add(all + ', sin contar los de calidad no determinable', false); continue; }
          const { hit, undet } = scoreStep(T, mode, ph, s, bestOverlap(s, theirs), appA.rs[k], appA.romans[k], keyOk, kern);
          T.add(all, hit);
          T.add(all + ', sin contar los de calidad no determinable', hit, null, !undet);
        }
      }
    }
  }
  return { T, info };
}

// ---------- Rock Corpus: only the tonic and the key changes ----------
export function evalRock(songs) {
  const T = new Tally(), info = { songs: songs.length, analyses: 0, modulating: 0, modulatingLong: 0 };
  for (const song of songs) {
    const by = song.analyses;
    for (const who of Object.keys(by)) {
      const a = by[who], other = Object.keys(by).filter(k => k !== who).map(k => by[k].mainTonic);
      info.analyses++;
      const accepted = new Set([a.mainTonic, ...other]);
      const steps = a.chords.map(c => ({ notes: c.notes, dur: Math.round(c.dur * 96) }));
      const A = analyzeProgression(steps, P);
      const t = A.key.tonic, relTonic = A.key.mode === 'major' ? (t + 9) % 12 : (t + 3) % 12;
      const okOwn = t === a.mainTonic, ok = accepted.has(t);
      const d = (t - a.mainTonic + 12) % 12;
      const sig = `la app leyó la tónica ${pcName(t)} y el corpus ${pcName(a.mainTonic)} (${d === 7 ? 'una quinta arriba' : d === 5 ? 'una quinta abajo' : d === 9 || d === 3 ? 'a distancia de relativa' : 'otra relación'})`;
      const ex = { example: { song: song.song, analyst: who, got: `${pcName(t)} ${A.key.mode}`, expected: pcName(a.mainTonic), chords: a.chords.slice(0, 8).map(c => c.token).join(' ') } };
      T.add('tónica (solo la lectura propia)', okOwn);
      T.add('tónica (acepta ambos analistas)', ok, ok ? null : { sig, ...ex });
      T.add('tónica (o su relativa, suplementaria)', ok || accepted.has(relTonic), null);
      T.add('tónica (o la alternativa que muestra la app, suplementaria)', ok || (A.alt && accepted.has(A.alt.tonic)), null);
      const mod = a.regions.length > 1, modLong = a.regions.slice(1).some(r => r.to - r.from + 1 >= 4);
      if (mod) info.modulating++;
      if (modLong) info.modulatingLong++;
      // F11: the regions of the app against the annotated ones. Strict: a new region of the app has the tonic of an annotated new
      // region and covers at least half of its chords; the false changes are the brake (decided 2 Nov 2026: at most 5 %)
      const regs = A.regions || [], cover = (x, r) => Math.max(0, Math.min(x.to, r.to) - Math.max(x.from, r.from) + 1);
      if (mod) {
        T.add('modulación, estricta: de los análisis en que el corpus cambia de tonalidad, aquellos en que una región nueva de la app tiene la tónica de una región nueva anotada y cubre al menos su mitad', regs.slice(1).some(x => a.regions.slice(1).some(r => r.tonic === x.key.tonic && 2 * cover(x, r) >= r.to - r.from + 1)));
        T.add('modulación, suplementaria: de los análisis en que el corpus cambia de tonalidad, aquellos en que la app informa algún cambio', regs.length > 1);
      } else T.add('modulación falsa: de los análisis sin cambio de tonalidad anotado, aquellos en que la app informa uno (menos es mejor)', regs.length > 1);
      // the tonic the app reads for each region of 4 or more chords when it gets that region alone
      for (const r of a.regions) {
        if (r.to - r.from + 1 < 4) continue;
        const Ar = analyzeProgression(a.chords.slice(r.from, r.to + 1).map(c => ({ notes: c.notes, dur: Math.round(c.dur * 96) })), P);
        const okR = Ar.key.tonic === r.tonic;
        T.add('tónica por región de ≥ 4 acordes (la app recibe la región sola)', okR, okR ? null : { sig: `región en ${pcName(r.tonic)}, la app leyó ${pcName(Ar.key.tonic)}`, example: { song: song.song, analyst: who, expected: pcName(r.tonic), got: `${pcName(Ar.key.tonic)} ${Ar.key.mode}` } });
      }
    }
  }
  return { T, info };
}

// ---------- the ratchet of the development figures (src/corpus.ratchet.test.js) ----------
// The goals are measured on the test set, once per stage. npm test holds instead the development figures of the same rows and
// of the brakes of the modulation (decision 15), so that no rule lowers one without saying so. better: which way is better.
export const RATCHET_ROWS = [
  { row: 'acorde por tramo', set: 'tavern', better: 'up', cat: 'por tramo | acorde: raíz + calidad (acepta A o B), sin contar los tramos de calidad no determinable' },
  { row: 'acorde de punta a punta', set: 'tavern', better: 'up', cat: 'de punta a punta | acorde: raíz + calidad (acepta A o B), contando como fallo los tramos sin acorde de la app' },
  { row: 'inversión, dado el acorde correcto', set: 'tavern', better: 'up', cat: 'por tramo | inversión (dado el acorde correcto)' },
  { row: 'tonalidad de TAVERN por tramo', set: 'tavern', better: 'up', cat: 'por tramo | tonalidad (tónica y modo)' },
  { row: 'tonalidad de TAVERN de punta a punta', set: 'tavern', better: 'up', cat: 'de punta a punta | tonalidad (tónica y modo)' },
  { row: 'tónica del rock', set: 'rock', better: 'up', cat: 'tónica (acepta ambos analistas)' },
  { row: 'enarmonía', set: 'tavern', better: 'up', cat: 'por tramo | enarmonía (tramo con todas las notas bien)' },
  { row: 'modulación estricta', set: 'rock', better: 'up', cat: 'modulación, estricta: de los análisis en que el corpus cambia de tonalidad, aquellos en que una región nueva de la app tiene la tónica de una región nueva anotada y cubre al menos su mitad' },
  { row: 'modulaciones falsas (freno)', set: 'rock', better: 'down', cat: 'modulación falsa: de los análisis sin cambio de tonalidad anotado, aquellos en que la app informa uno (menos es mejor)' },
  { row: 'frases partidas por tramo (freno)', set: 'tavern', better: 'down', cat: 'por tramo | frases que la app parte en regiones (TAVERN anota una tonalidad por frase; menos es mejor)' },
  { row: 'frases partidas de punta a punta (freno)', set: 'tavern', better: 'down', cat: 'de punta a punta | frases que la app parte en regiones (TAVERN anota una tonalidad por frase; menos es mejor)' },
];
// {row: {ok, n}} from the categories of TAVERN and of the Rock Corpus (Maps of category → {n, ok})
export const ratchetCounts = (tavern, rock) => Object.fromEntries(RATCHET_ROWS.map(r => {
  const c = (r.set === 'rock' ? rock : tavern).get(r.cat);
  return [r.row, c ? { ok: c.ok, n: c.n } : null];
}));
// The test figures of the same rows, as a floor: written by the report at the one look at the test set that closes a stage, never
// checked by npm test. rows: {tavern, rock} as Tally.rows(); ci: {tavern, rock} as bootstrapCI
export const ratchetFloor = (rows, ci, date) => ({
  date,
  rows: Object.fromEntries(RATCHET_ROWS.map(r => {
    const x = rows[r.set].find(y => y.cat === r.cat);
    return [r.row, x ? { ok: x.ok, n: x.n, pct: x.pct, ci95: (ci[r.set] || {})[r.cat] || null } : null];
  })),
});
