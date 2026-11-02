// Simulates key rules on the development set before they go into detectKey: a copy of detectKey's scoring (src/analysis.js)
// with each candidate rule behind a switch, scored as the goal rows (TAVERN tonic and mode by annotated stretch, and end to end;
// Rock Corpus tonic, accepting either analyst), with the paired Δ by work or song against the copy with no rule. The copy with
// no rule must give the app's own figures (it checks). The test works and songs are left out. Not part of the suite:
//   node tools/key-sim.mjs [--base r1,r2] [rule ...]
// --test: the test set instead, looked at once at the end of a stage; the «after» (the base plus the rules given) must then be
// the app, and the «before» is the base
// with no rule, every rule alone
import { analyzeProgression, resolveStep } from '../src/analysis.js';
import { harmonySegs } from '../src/harmony.js';
import { normProg, segStep } from '../src/model.js';
import { Tally, bootstrapCI, bootstrapDiff, isTest, listJson } from '../src/test/corpus-eval.js';

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
// as it was before the triad V weighed 1 (that rule is vsym here)
const resolvesToTonic = (it, nx, t, mode) => !!nx && nx.root === t && (it.q === 'dom' || it.q === 'aug' || (it.q === 'maj' && mode === 'minor')) && (it.root - t + 12) % 12 === 7;
// bookends as it was before the half cadence (that rule is hc here), so that the copy with no rule stays the app of 5dc0e33
function bookends(items, t, mode) {
  const tq = tonicQ(mode), f = items[0], l = items[items.length - 1], pv = items[items.length - 2];
  const deceptive = mode === 'minor' && pv && pv.q === 'dom' && pv.root === (t + 10) % 12;
  return { first: f.root === t && tq.includes(f.q), last: l.root === t && tq.includes(l.q) && !deceptive,
    closed: items.length > 2 && f.root === t && l.root === t && f.q === l.q && tq.includes(f.q) };
}
const rels = (items, t) => new Set(items.flatMap(it => it.pcs).map(p => (p - t + 12) % 12));

// ---------- the rules ----------
// mixo: a major key whose 7th never sounds and whose ♭7 does is scored on the mixolydian scale (♭7 in the scale, v and ♭VII in the key)
// mixo7: the same, only when a major chord on the ♭7 sounds (I–♭VII–IV)
// hc: a progression that begins on a tonic chord and ends on the major chord a fifth above it ends on a half cadence: the last chord's
//     key loses its «ends on the tonic» and the first chord's key gets it; hc:<h>:<l> gives the first chord's key h points and takes l
//     from the last chord's key (hc is hc:3:3)
// v3:<w>: a major V triad that goes to the minor tonic weighs w instead of 3 (only V7 → I counts in major)
// vsym:<w>: a major V triad that goes to the tonic weighs w in major and in minor; V7 → tonic stays at 3 in both
// tdur: the half point of each tonic chord goes by how long it lasts (the same when every chord lasts the same)
// first:<w>: starting on the tonic weighs w instead of 2
const RULES = ['mixo', 'mixo7', 'hc', 'v3:1.5', 'v3:0', 'tdur', 'first:3'];
let show = false;
function choose(items, on) {
  const res = [], f = items[0], l = items[items.length - 1];
  const num = (name, d) => { const r = [...on].find(x => x.startsWith(name + ':')); return r ? +r.split(':')[1] : d; };
  const hcr = [...on].find(r => r === 'hc' || r.startsWith('hc:')), [hh, hl] = hcr && hcr !== 'hc' ? hcr.split(':').slice(1, 3).map(Number) : [3, 3];
  // hc:<h>:<l>:v leaves out the end that its own V7 reaches (IV–V7–I is an authentic cadence, not I–V/V–V); hc:<h>:<l>:k keeps
  // that end's «ends on the tonic» and still gives the first chord's key its h points
  const pv = items[items.length - 2], byV7 = !!pv && pv.q === 'dom' && leads(pv, l);
  const v7 = !!hcr && hcr.endsWith(':v') && byV7, keep = !!hcr && hcr.endsWith(':k') && byV7;
  const hc = !!hcr && !v7 && items.length > 2 && f.q && (l.q === 'maj' || l.q === 'dom') && (l.root - f.root + 12) % 12 === 7;
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
    if (be.first) s += num('first', 2);
    if (be.last) s += hc && t === l.root && !keep ? 3 - hl : 3;
    if (hc && t === f.root && tq.includes(f.q)) s += hh;
    if (be.closed) s += 1.5;
    const total = items.reduce((n, it) => n + it.dur, 0);
    items.forEach((it, i) => {
      if (it.root === t && tq.includes(it.q)) s += on.has('tdur') ? .5 * items.length * it.dur / total : .5;
      const vs = [...on].some(x => x.startsWith('vsym:')), nx = items[i + 1];
      if (vs && mode === 'major' && nx && nx.root === t && it.q === 'maj' && (it.root - t + 12) % 12 === 7) s += num('vsym', 1);
      else if (resolvesToTonic(it, nx, t, mode)) s += mode === 'minor' && it.q === 'maj' ? (vs ? num('vsym', 1) : num('v3', 3)) : 3;
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
const ti = process.argv.indexOf('--test'), TEST = ti > 0;
if (TEST) process.argv.splice(ti, 1);
for (const p of listJson('tavern').filter(p => isTest(p.piece) === TEST)) {
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
for (const song of listJson('rock').filter(s => isTest(s.song) === TEST)) {
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
// --base r1,r2: the rules the app already has (the copy with them must give the app's figures); each variant adds its rules to them
const bi = process.argv.indexOf('--base'), baseRules = bi > 0 ? process.argv.splice(bi, 2)[1].split(',') : [];
const flips = new Map();
const run = (on, isBase) => units.map(cases => { const T = new Tally(); cases.forEach(c => {
  const k = choose(c.items, on), ok = c.ok(k); if (isBase && (k.tonic !== c.app.tonic || k.mode !== c.app.mode)) check++; T.add(c.row, ok);
  if (!isBase && ok !== c.ok(c.app)) { const f = flips.get(c.row) || { won: [], lost: [] }; (ok ? f.won : f.lost).push(c.id); flips.set(c.row, f); }
}); return T; });
const sum = (us, row) => us.reduce((o, u) => { const c = u.cats.get(row); if (c) { o.n += c.n; o.ok += c.ok; } return o; }, { n: 0, ok: 0 });
const pct = c => (100 * c.ok / c.n).toFixed(1);
const base = run(new Set(baseRules), !TEST);
if (check) { console.error(`la copia con las reglas de la base (${baseRules.join(' + ') || 'ninguna'}) no da lo que da la app en ${check} casos`); process.exit(1); }
const asked = process.argv.slice(2), variants = asked.length ? [asked] : RULES.map(r => [r]);
if (!TEST) console.log(`desarrollo; la copia con las reglas de la base (${baseRules.join(' + ') || 'ninguna'}) da lo mismo que la app en todos los casos`);
for (const v of variants) {
  flips.clear();
  const after = run(new Set([...baseRules, ...v]), TEST), d = bootstrapDiff(base, after), cb = bootstrapCI(base), ca = bootstrapCI(after);
  if (TEST) { if (check) { console.error(`la copia con ${[...baseRules, ...v].join(' + ')} no da lo que da la app en ${check} casos`); process.exit(1); } console.log(`PRUEBA; la copia con ${[...baseRules, ...v].join(' + ')} da lo mismo que la app en todos los casos`); }
  console.log(`\n${v.join(' + ')}`);
  for (const row of [ROW_T, ROW_E, ROW_R]) {
    const b = sum(base, row), a = sum(after, row);
    console.log(`  ${row}: ${pct(b)} % (${b.ok}/${b.n}; ${cb[row].join('–')}) → ${pct(a)} % (${a.ok}/${a.n}; ${ca[row].join('–')})   Δ ${(100 * (a.ok / a.n - b.ok / b.n)).toFixed(1)} (${d[row][0]} a ${d[row][1]})`);
    const f = flips.get(row) || { won: [], lost: [] };
    const ids = xs => (xs.length ? ' (' + xs.slice(0, 8).join(', ') + (xs.length > 8 ? ' …' : '') + ')' : '');
    console.log(`    gana ${f.won.length}${ids(f.won)}; pierde ${f.lost.length}${ids(f.lost)}`);
  }
}
