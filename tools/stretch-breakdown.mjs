// Dev-only breakdown of the per-stretch chord failures on the TAVERN development works (session of 2026-11-02, run against
// main 15508a7): the app gets the notes of each annotated stretch, as in the «por tramo» rows of evalTavern, and each miss of
// root + quality (A or B) falls in one group: no chord, wrong root, wrong quality, a seventh too many, a seventh too few.
// For each group: count, examples, and two ceilings: every miss of the group fixed, and only the misses whose expected chord
// is one of the readings the ornament rule already weighs (some set of notes left out, any of the 10 best names), with the
// gap in cost to the reading it chose. It measures, changes nothing, and is not part of the suite:
//   node tools/stretch-breakdown.mjs [examples per subgroup]
const R = new URL('../src/', import.meta.url).href;
const { isTest, listJson } = await import(R + 'test/corpus-eval.js');
const { analyze, analyzeProgression } = await import(R + 'analysis.js');

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const pc = x => NAMES[((x % 12) + 12) % 12];
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const expSym = e => (e.seventh ? ({ maj: 'maj7', min: 'm7', dom: '7', hdim: 'm7b5', dim: 'dim7' })[e.quality] : ({ maj: '', min: 'm', dim: 'dim', aug: 'aug' })[e.quality]);
// the triad under a quality: a dominant seventh is a major triad, a half-diminished one a diminished triad
const BASE = { maj: 'maj', dom: 'maj', min: 'min', dim: 'dim', hdim: 'dim', aug: 'aug', sus: 'sus' };
const NEX = +(process.argv[2] || 3);

// the ornament rule's costs (src/analysis.js, ORN and ornWeights), here over every name of every set, not only the best one
const ORN = { drop: 3, ext: 2, extUnder: .15, maxDrop: 5 };
function weights(evs, a, dur) {
  const W = new Map(), b = a + dur;
  for (const x of evs) W.set(x.m % 12, (W.get(x.m % 12) || 0) + (Math.min(x.s + x.l, b) - Math.max(x.s, a)) / dur);
  const tot = [...W.values()].reduce((s, v) => s + v, 0);
  W.forEach((v, k) => W.set(k, v / tot));
  return W;
}
function readings(st) {
  const notes = st.notes, ev = st.evs.filter(x => x.s < st.a + st.dur && x.s + x.l > st.a), W = weights(ev, st.a, st.dur);
  const free = [...W.keys()].filter(p => p !== notes[0] % 12), sets = [[]];
  for (const x of free) for (const s of [...sets]) if (s.length < ORN.maxDrop) sets.push([...s, x]);
  const out = [];
  for (const D of sets) {
    const keep = notes.filter(m => !D.includes(m % 12)); if (new Set(keep.map(m => m % 12)).size < 2) continue;
    for (const c of analyze(keep, null)) {
      const ext = c.type.degs.filter(d => d.n >= 7).map(d => (d.pc + c.root) % 12).filter(p => W.has(p) && !D.includes(p) && W.get(p) < ORN.extUnder).length;
      out.push({ c, D, cost: c.score + ORN.drop * 10 * D.reduce((s, p) => s + W.get(p), 0) + ORN.ext * ext });
    }
  }
  return out.sort((x, y) => x.cost - y.cost);
}
const fits = (c, x) => c.root === x.root && c.type.q === x.quality && isSeventh(c.type.sym) === x.seventh;

const pieces = listJson('tavern').filter(p => !isTest(p.piece));
const G = new Map(); let total = 0, hits = 0;
const add = (group, sub, row) => {
  const g = G.get(group) || { n: 0, inReach: 0, gap1: 0, complete: 0, subs: new Map(), ex: [] }; G.set(group, g); g.ex.push(row);
  g.n++; if (row.gap !== null) { g.inReach++; if (row.gap <= 1) g.gap1++; } if (row.complete) g.complete++;
  const s = g.subs.get(sub) || { n: 0, inReach: 0, ex: [] }; g.subs.set(sub, s);
  s.n++; if (row.gap !== null) s.inReach++; s.ex.push(row);
};
for (const piece of pieces) for (const ph of piece.phrases) for (const who of ['A', 'B']) {
  const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'];
  const steps = [], idx = [];
  mine.forEach((s, i) => {
    const on = ph.notes.filter(n => n[1] < s.b && n[1] + n[2] > s.a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y);
    if (ms.length) { idx.push(i); steps.push({ notes: ms, dur: s.b - s.a, a: s.a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) }); }
  });
  if (!steps.length) continue;
  const A = analyzeProgression(steps, P);
  idx.forEach((si, j) => {
    const s = mine[si]; if (!s.exp) return;
    total++;
    let o = null, bo = 0; for (const t of theirs) { const v = Math.max(0, Math.min(s.b, t.b) - Math.max(s.a, t.a)); if (v > bo) { bo = v; o = t; } }
    const exps = [s.exp, ...(o && o.exp ? [o.exp] : [])];
    const c = A.rs[j].c, ch = c && { root: c.root, q: c.type.q, sym: c.type.sym, seventh: isSeventh(c.type.sym) };
    if (ch && exps.some(x => ch.root === x.root && ch.q === x.quality && ch.seventh === x.seventh)) { hits++; return; }
    const st = steps[j], pcs = [...new Set(st.notes.map(m => m % 12))];
    const rd = readings(st), chosen = rd[0] ? rd[0].cost : null, match = rd.find(r => exps.some(x => fits(r.c, x)));
    const row = {
      ph: ph.id, who, label: s.label, key: ph.key.token, exp: exps.map(x => pc(x.root) + expSym(x)).join(' | '),
      got: ch ? pc(ch.root) + ch.sym : '(sin acorde)', notes: st.notes.map(m => pc(m) + (Math.floor(m / 12) - 1)).join(' '),
      complete: s.exp.complete, gap: match && chosen !== null ? +(match.cost - chosen).toFixed(2) : null,
    };
    if (!ch) {
      const n = pcs.length, e = s.exp;
      const sub = n === 1 ? (pcs[0] === e.root ? '1 clase de altura, la raíz' : e.pcs.includes(pcs[0]) ? '1 clase de altura, otra nota del acorde' : '1 clase de altura, ajena')
        : n === 2 ? (pcs.every(p => e.pcs.includes(p)) ? (pcs.includes(e.root) ? '2 clases, del acorde, con la raíz' : '2 clases, del acorde, sin la raíz') : '2 clases, con una ajena')
        : '3 o más clases (ningún tipo calza)';
      add('sin acorde', sub, row); return;
    }
    const e = exps.find(x => x.root === ch.root);
    if (!e) {
      const k = s.exp.pcs.indexOf(ch.root), pos = ['', 'su 3ª', 'su 5ª', 'su 7ª'][k] || 'una nota ajena';
      add('raíz mal', `raíz en ${pos}${s.exp.pcs.includes(st.notes[0] % 12) && st.notes[0] % 12 === ch.root ? ' (el bajo)' : ''}`, row); return;
    }
    const bg = BASE[ch.q], be = BASE[e.quality];
    if (bg === be && ch.seventh && !e.seventh) add('extensión de más', `${expSym(e) || 'mayor'} leído ${ch.sym}`, row);
    else if (bg === be && !ch.seventh && e.seventh) add('extensión de menos', `${expSym(e)} leído ${ch.sym || 'mayor'}`, row);
    else add('calidad mal', bg === be ? `7ª de otra clase: ${expSym(e)} leído ${ch.sym}` : `${expSym(e) || 'mayor'} leído ${ch.sym || 'mayor'}`, row);
  });
}
const f = (a, b) => (100 * a / b).toFixed(1);
console.log(`desarrollo: ${pieces.length} obras; tramos ${total}, aciertos ${hits} (${f(hits, total)} %), fallos ${total - hits}`);
console.log('techo 1: el grupo entero corregido; techo 2: solo los fallos cuyo acorde esperado ya está entre las lecturas que pesa la regla de adornos');
for (const [name, g] of [...G].sort((x, y) => y[1].n - x[1].n)) {
  console.log(`\n## ${name}: ${g.n} (${f(g.n, total - hits)} % de los fallos); con todas las notas del acorde sonando ${g.complete}`);
  console.log(`   techo 1: ${f(hits + g.n, total)} % (+${f(g.n, total)}); techo 2: ${f(hits + g.inReach, total)} % (+${f(g.inReach, total)}), de ellos a ≤ 1 punto de costo ${g.gap1}`);
  // examples spread over the list, so that they do not all come from the first work
  const show = (ex, k, pad) => { for (let i = 0; i < Math.min(k, ex.length); i++) { const r = ex[Math.floor(i * ex.length / Math.min(k, ex.length))]; console.log(`${pad}${r.ph} ${r.who} «${r.label}» en ${r.key}: ${r.notes} → esperado ${r.exp}, la app ${r.got}${r.gap === null ? '' : ` (costo +${r.gap})`}`); } };
  show(g.ex, 3, '   ejemplo: ');
  for (const [sub, s] of [...g.subs].sort((x, y) => y[1].n - x[1].n)) {
    console.log(`   - ${sub}: ${s.n} (al alcance ${s.inReach})`);
    show(s.ex, NEX, '       ');
  }
}
