// Simulates key rules on the development set before they go into detectKey: a copy of detectKey's scoring (src/analysis.js)
// with each candidate rule behind a switch, scored as the goal rows (TAVERN tonic and mode by annotated stretch, and end to end;
// Rock Corpus tonic, accepting either analyst), with the paired Δ by work or song against the copy with no rule. The copy with
// no rule must give the app's own figures (it checks). The test works and songs are left out. Not part of the suite:
//   node tools/key-sim.mjs [rule ...]
// with no rule, every rule alone
import { analyzeProgression, bookends, resolveStep, resolvesToTonic } from '../src/analysis.js';
import { harmonySegs } from '../src/harmony.js';
import { normProg, segStep } from '../src/model.js';
import { Tally, bootstrapDiff, isTest, listJson } from '../src/test/corpus-eval.js';

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
// copied from src/analysis.js
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
const EXP = { major: { 0: ['maj'], 2: ['min'], 4: ['min'], 5: ['maj'], 7: ['maj', 'dom'], 9: ['min'], 11: ['dim', 'hdim'] },
  minor: { 0: ['min'], 2: ['dim', 'hdim'], 3: ['maj', 'aug'], 5: ['min'], 7: ['min', 'maj', 'dom'], 8: ['maj'], 10: ['maj', 'dom'], 11: ['dim'] } };
const EXPK = { major: { ...EXP.major, 0: ['maj', 'dom'], 5: ['maj', 'dom'] }, minor: EXP.minor };
const MIXO = { 4: ['dim', 'hdim'], 7: ['min', 'maj', 'dom'], 10: ['maj', 'dom'], 11: [] };
const tonicQ = mode => (mode === 'major' ? ['maj', 'dom'] : ['min']);
const leads = (it, nx) => !!(it.q && nx.q) && (((it.q === 'dom' || it.q === 'maj') && (nx.root - it.root + 12) % 12 === 5) || ((it.q === 'dim' || it.q === 'hdim') && (nx.root - it.root + 12) % 12 === 1));
function plainTonic(items) {
  if (items.some((it, i) => i + 1 < items.length && leads(it, items[i + 1]))) return -1;
  const f = items[0], l = items[items.length - 1];
  if (f.q && l.q && f.root === l.root) return f.root;
  const dur = new Map(); items.forEach(it => { if (it.q) dur.set(it.root, (dur.get(it.root) || 0) + (it.dur || 1)); });
  let best = -1, most = 0; dur.forEach((d, r) => { if (d > most) { most = d; best = r; } });
  return best;
}
const rels = (items, t) => new Set(items.flatMap(it => it.pcs).map(p => (p - t + 12) % 12));

// ---------- the rules ----------
// mixo: a major key whose 7th never sounds and whose ♭7 does is scored on the mixolydian scale (♭7 in the scale, v and ♭VII in the key)
// mixo7: the same, only when a major chord on the ♭7 sounds (I–♭VII–IV)
// hc: a progression that begins on a tonic chord and ends on the major chord a fifth above it ends on a half cadence: the last chord's
//     key loses its «ends on the tonic» and the first chord's key gets it
const RULES = ['mixo', 'mixo7', 'hc'];
let show = false;
function choose(items, on) {
  const res = [], f = items[0], l = items[items.length - 1];
  const hc = on.has('hc') && items.length > 2 && f.q && (l.q === 'maj' || l.q === 'dom') && (l.root - f.root + 12) % 12 === 7;
  for (let t = 0; t < 12; t++) for (const mode of ['major', 'minor']) {
    const R = rels(items, t);
    const mixo = mode === 'major' && (on.has('mixo') || on.has('mixo7')) && !R.has(11) && R.has(10) &&
      (!on.has('mixo7') || items.some(it => (it.root - t + 12) % 12 === 10 && (it.q === 'maj' || it.q === 'dom')));
    const sc = mode === 'major' ? (mixo ? [0, 2, 4, 5, 7, 9, 10] : MAJ) : MIN, ek = mixo ? { ...EXPK.major, ...MIXO } : EXPK[mode];
    let s = 0;
    items.forEach((it, i) => {
      const own7 = it.q === 'dom' ? (it.root + 10) % 12 : -1;
      const nx = items[i + 1], lead = !!nx && nx.q && sc.includes((nx.root - t + 12) % 12) &&
        (((it.q === 'dom' || it.q === 'maj') && (nx.root - it.root + 12) % 12 === 5) || ((it.q === 'dim' || it.q === 'hdim') && (nx.root - it.root + 12) % 12 === 1));
      it.pcs.forEach(p => { const r = (p - t + 12) % 12; s += sc.includes(r) ? 1 : p === own7 || lead ? 0 : (mode === 'minor' && (r === 11 || r === 1) ? .3 : mode === 'major' && (r === 3 || r === 8 || r === 10) ? -.5 : -1.2); });
      if (it.q) { const e = ek[(it.root - t + 12) % 12]; if (e && e.includes(it.q)) s += 1.5; else if (e && it.q === 'sus') s += .5; }
    });
    const tq = tonicQ(mode), be = bookends(items, t, mode);
    if (be.first) s += 2;
    if (be.last && !(hc && t === l.root)) s += 3;
    if (hc && t === f.root && tq.includes(f.q)) s += 3;
    if (be.closed) s += 1.5;
    items.forEach((it, i) => {
      if (it.root === t && tq.includes(it.q)) s += .5;
      if (resolvesToTonic(it, items[i + 1], t, mode)) s += 3;
    });
    if (mode === 'major') s += .01;
    res.push({ tonic: t, mode, score: s });
  }
  res.sort((a, b) => b.score - a.score);
  const plain = plainTonic(items), rank = k => k.score + (k.tonic === plain ? 3 : 0);
  if (show) return res.map(k => ({ ...k, rank: rank(k) })).sort((a, b) => b.rank - a.rank);
  return res.reduce((b, k) => (rank(k) > rank(b) ? k : b));
}

// ---------- the units, read once ----------
const itemsOf = steps => { const first = steps.map(s => resolveStep(s, P)); return first.map((r, i) => ({ root: r.c ? r.c.root : r.notes.length ? r.notes[0] % 12 : 0, q: r.c ? r.c.type.q : null, pcs: [...new Set(r.notes.map(m => m % 12))], dur: steps[i].dur || 1 })); };
const stepOf = (notes, a, b) => {
  const on = notes.filter(n => n[1] < b && n[1] + n[2] > a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y);
  return ms.length ? { notes: ms, dur: b - a, a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) } : null;
};
const ROW_T = 'TAVERN, por tramo | tonalidad (tónica y modo)', ROW_E = 'TAVERN, de punta a punta | tonalidad (tónica y modo)', ROW_R = 'Rock, tónica (acepta ambos analistas)';
// --show <song or phrase>: the chords and the first five keys, with no rule and with the rules given
const at = process.argv.indexOf('--show'), want = at > 0 ? process.argv[at + 1] : null;
if (want) process.argv.splice(at, 2);
const units = [];
let check = 0;
for (const p of listJson('tavern').filter(p => !isTest(p.piece))) {
  const cases = [];
  for (const ph of p.phrases) {
    const exp = { tonic: ph.key.tonic, mode: ph.key.mode };
    for (const who of ['A', 'B']) {
      const steps = ph.segs[who].map(s => stepOf(ph.notes, s.a, s.b)).filter(Boolean);
      if (steps.length) cases.push({ id: `${ph.id} (${who})`, row: ROW_T, items: itemsOf(steps), ok: k => k.tonic === exp.tonic && k.mode === exp.mode, app: analyzeProgression(steps, P).key });
    }
    const pat = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
    const segs = harmonySegs(pat);
    if (segs.length) { const steps = segs.map(S => segStep(pat, S)); cases.push({ id: ph.id, row: ROW_E, items: itemsOf(steps), ok: k => k.tonic === exp.tonic && k.mode === exp.mode, app: analyzeProgression(steps, P).key }); }
  }
  units.push(cases);
}
for (const song of listJson('rock').filter(s => !isTest(s.song))) {
  const accepted = new Set(Object.values(song.analyses).map(x => x.mainTonic));
  units.push(Object.entries(song.analyses).map(([who, a]) => {
    const steps = a.chords.map(c => ({ notes: c.notes, dur: Math.round(c.dur * 96) }));
    const c = { id: `${song.song} (${who})`, row: ROW_R, items: itemsOf(steps), ok: k => accepted.has(k.tonic), app: analyzeProgression(steps, P).key };
    if (want === song.song) {
      const N = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'], on = new Set(process.argv.slice(2));
      console.log(c.items.map(it => N[it.root] + (it.q || '?') + ':' + it.pcs.map(p => N[p]).join('')).join(' '));
      show = true;
      for (const s of [new Set(), on]) console.log([...s].join('+') || 'sin reglas', choose(c.items, s).slice(0, 5).map(k => `${N[k.tonic]} ${k.mode} ${k.score.toFixed(1)}/${k.rank.toFixed(1)}`).join(' · '));
      show = false;
    }
    return c;
  }));
}
const flips = new Map();
const run = on => units.map(cases => { const T = new Tally(); cases.forEach(c => {
  const k = choose(c.items, on), ok = c.ok(k); if (!on.size && (k.tonic !== c.app.tonic || k.mode !== c.app.mode)) check++; T.add(c.row, ok);
  if (on.size && ok !== c.ok(c.app)) { const f = flips.get(c.row) || { won: [], lost: [] }; (ok ? f.won : f.lost).push(c.id); flips.set(c.row, f); }
}); return T; });
const sum = (us, row) => us.reduce((o, u) => { const c = u.cats.get(row); if (c) { o.n += c.n; o.ok += c.ok; } return o; }, { n: 0, ok: 0 });
const pct = c => (100 * c.ok / c.n).toFixed(1);
const base = run(new Set());
if (check) { console.error(`la copia sin reglas no da lo que da la app en ${check} casos`); process.exit(1); }
const asked = process.argv.slice(2), variants = asked.length ? [asked] : RULES.map(r => [r]);
console.log('desarrollo; la copia sin reglas da lo mismo que la app en todos los casos');
for (const v of variants) {
  flips.clear();
  const after = run(new Set(v)), d = bootstrapDiff(base, after);
  console.log(`\n${v.join(' + ')}`);
  for (const row of [ROW_T, ROW_E, ROW_R]) {
    const b = sum(base, row), a = sum(after, row);
    console.log(`  ${row}: ${pct(b)} % (${b.ok}/${b.n}) → ${pct(a)} % (${a.ok}/${a.n})   Δ ${(100 * (a.ok / a.n - b.ok / b.n)).toFixed(1)} (${d[row][0]} a ${d[row][1]})`);
    const f = flips.get(row) || { won: [], lost: [] };
    console.log(`    gana ${f.won.length}, pierde ${f.lost.length}${f.lost.length ? ': ' + f.lost.slice(0, 8).join(', ') + (f.lost.length > 8 ? ' …' : '') : ''}`);
  }
}
