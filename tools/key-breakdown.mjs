// The key errors on the development set, by kind: TAVERN (tonic and mode, by annotated stretch, as the goal row) and the Rock
// Corpus (tonic, accepting either analyst, as the goal row). For each kind: how many, three examples, the ceiling (the row if
// every error of the kind were right) and how far the right key was in the app's own ranking (2nd, within the 2 points that show
// it as the alternate, the median gap). The test works and songs are left out. Not part of the suite:
//   node tools/key-breakdown.mjs [--tavern|--rock] [--all]
// --all prints every error instead of three per kind
import { analyzeProgression, detectKey, resolveStep } from '../src/analysis.js';
import { isTest, listJson } from '../src/test/corpus-eval.js';

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const pc = x => NAMES[((x % 12) + 12) % 12];
const MODE = { major: 'mayor', minor: 'menor' };
const args = process.argv.slice(2), all = args.includes('--all');
const only = args.includes('--tavern') ? 'tavern' : args.includes('--rock') ? 'rock' : null;

// the same step as the evaluator's by annotated stretch (src/test/corpus-eval.js, stepOf)
const stepOf = (notes, a, b) => {
  const on = notes.filter(n => n[1] < b && n[1] + n[2] > a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y);
  return ms.length ? { notes: ms, dur: b - a, a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) } : null;
};
// the items analyzeProgression scores the key on, and its ranking with the plain-tonic tiebreak
function ranking(steps) {
  const first = steps.map(s => resolveStep(s, P));
  const items = first.map((r, i) => ({ root: r.c ? r.c.root : r.notes.length ? r.notes[0] % 12 : 0, q: r.c ? r.c.type.q : null, pcs: [...new Set(r.notes.map(m => m % 12))], dur: steps[i].dur || 1 }));
  const leads = (it, nx) => !!(it.q && nx.q) && (((it.q === 'dom' || it.q === 'maj') && (nx.root - it.root + 12) % 12 === 5) || ((it.q === 'dim' || it.q === 'hdim') && (nx.root - it.root + 12) % 12 === 1));
  let plain = -1;
  if (!items.some((it, i) => i + 1 < items.length && leads(it, items[i + 1]))) {
    const f = items[0], l = items[items.length - 1];
    if (f.q && l.q && f.root === l.root) plain = f.root;
    else { const d = new Map(); items.forEach(it => { if (it.q) d.set(it.root, (d.get(it.root) || 0) + it.dur); }); let most = 0; d.forEach((v, r) => { if (v > most) { most = v; plain = r; } }); }
  }
  const keys = detectKey(items).map(k => ({ ...k, rank: k.score + (k.tonic === plain ? 3 : 0) })).sort((a, b) => b.rank - a.rank);
  return { items, keys, plain };
}
const median = xs => { if (!xs.length) return '-'; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)].toFixed(1); };
const pct = (a, n) => (n ? (100 * a / n).toFixed(1) : '-');
// what the chords say about the expected tonic e
function features(items, e, got) {
  const f = items[0], l = items[items.length - 1], rel = it => (it.root - e + 12) % 12;
  return {
    first: f.root === e, last: l.root === e, lastV: rel(l) === 7, flat7: items.some(it => rel(it) === 10 && (it.q === 'maj' || it.q === 'dom')),
    // begins on the expected tonic chord and ends on the major chord a fifth above it (a half cadence)
    hc: f.root === e && (l.q === 'maj' || l.q === 'dom') && rel(l) === 7,
    // the leading tone of the key the app read sounds somewhere
    lt: items.some(it => it.pcs.includes((got.tonic + 11) % 12)),
    inGot: items.every(it => it.pcs.every(p => (got.mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]).includes((p - got.tonic + 12) % 12))),
  };
}
function report(title, rows, n) {
  const ok = n - rows.length, kinds = new Map();
  rows.forEach(r => { if (!kinds.has(r.kind)) kinds.set(r.kind, []); kinds.get(r.kind).push(r); });
  console.log(`\n=== ${title}: ${pct(ok, n)} % (${ok}/${n}); ${rows.length} errores ===`);
  for (const [kind, rs] of [...kinds].sort((a, b) => b[1].length - a[1].length)) {
    const second = rs.filter(r => r.pos === 1).length, near = rs.filter(r => r.gap < 2).length, cnt = k => rs.filter(r => r.f[k]).length;
    console.log(`\n-- ${kind}: ${rs.length} (${pct(rs.length, rows.length)} % de los errores); techo ${pct(ok + rs.length, n)} % (+${pct(rs.length, n)})`);
    console.log(`   la correcta es 2ª en el ranking: ${second}; a menos de 2 puntos: ${near}; brecha mediana ${median(rs.map(r => r.gap))}`);
    console.log(`   empieza en la tónica correcta: ${cnt('first')}; termina en ella: ${cnt('last')}; termina en su V: ${cnt('lastV')}; tiene ♭VII mayor: ${cnt('flat7')}; semicadencia (empieza en la tónica y termina en su V): ${cnt('hc')}; suena la sensible de la tonalidad leída: ${cnt('lt')}; todas las notas en la escala leída: ${cnt('inGot')}`);
    (all ? rs : rs.slice(0, 3)).forEach(r => console.log(`   · ${r.id}: corpus ${r.exp}, app ${r.got} (brecha ${r.gap.toFixed(1)}, ${r.pos + 1}ª) ${r.chords}`));
  }
}
const kindOf = (got, exp) => {
  if (got.tonic === exp.tonic) return 'homónima (misma tónica, otro modo)';
  if (exp.mode && got.mode !== exp.mode && got.tonic === (exp.tonic + (exp.mode === 'major' ? 9 : 3)) % 12) return 'relativa';
  const d = (got.tonic - exp.tonic + 12) % 12;
  if (d === 7) return 'una quinta arriba (la app lee la tónica en el V)';
  if (d === 5) return 'una quinta abajo (la app lee la tónica en el IV)';
  if (!exp.mode && (d === 9 || d === 3)) return 'relativa';
  return 'otra';
};
const chordText = (items, e) => items.slice(0, 10).map(it => `${pc(it.root)}${it.q === 'min' ? 'm' : it.q === 'maj' || !it.q ? '' : it.q}`).join(' ') + (items.length > 10 ? ' …' : '');

if (only !== 'rock') {
  const rows = []; let n = 0;
  for (const p of listJson('tavern').filter(p => !isTest(p.piece))) for (const ph of p.phrases) for (const who of ['A', 'B']) {
    const steps = ph.segs[who].map(s => stepOf(ph.notes, s.a, s.b)).filter(Boolean);
    if (!steps.length) continue;
    n++;
    const A = analyzeProgression(steps, P), exp = { tonic: ph.key.tonic, mode: ph.key.mode }, got = A.key;
    if (got.tonic === exp.tonic && got.mode === exp.mode) continue;
    const { items, keys } = ranking(steps), top = keys[0], pos = keys.findIndex(k => k.tonic === exp.tonic && k.mode === exp.mode);
    rows.push({ id: `${ph.id} (${who})`, kind: kindOf(got, exp), exp: `${pc(exp.tonic)} ${MODE[exp.mode]}`, got: `${pc(got.tonic)} ${MODE[got.mode]}`, pos, gap: top.rank - keys[pos].rank, f: features(items, exp.tonic, got), chords: chordText(items) });
  }
  report('TAVERN, desarrollo, tonalidad (tónica y modo) por tramo anotado', rows, n);
}
if (only !== 'tavern') {
  const rows = []; let n = 0;
  for (const song of listJson('rock').filter(s => !isTest(s.song))) for (const who of Object.keys(song.analyses)) {
    const a = song.analyses[who], accepted = new Set(Object.values(song.analyses).map(x => x.mainTonic));
    const steps = a.chords.map(c => ({ notes: c.notes, dur: Math.round(c.dur * 96) }));
    n++;
    const A = analyzeProgression(steps, P), got = A.key;
    if (accepted.has(got.tonic)) continue;
    const { items, keys } = ranking(steps), top = keys[0];
    const pos = keys.findIndex(k => k.tonic === a.mainTonic), gap = top.rank - keys[pos].rank;
    rows.push({ id: `${song.song} (${who})`, kind: kindOf(got, { tonic: a.mainTonic }), exp: pc(a.mainTonic), got: `${pc(got.tonic)} ${MODE[got.mode]}${A.key.modal ? ' ' + A.key.modal : ''}`, pos, gap, f: features(items, a.mainTonic, got), chords: chordText(items) });
  }
  report('Rock Corpus, desarrollo, tónica (acepta ambos analistas)', rows, n);
}
