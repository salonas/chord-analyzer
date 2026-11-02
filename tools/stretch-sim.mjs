// Dev-only simulation for the per-stretch reading (session of 2026-11-02, against main 15508a7): the «por tramo» rows of
// evalTavern, with the ornament rule's readings of each stretch picked again under candidate cost terms. It changes nothing
// in the app and is not part of the suite:
//   node tools/stretch-sim.mjs
const R = new URL('../src/', import.meta.url).href;
const { isTest, listJson } = await import(R + 'test/corpus-eval.js');
const { analyze, analyzeProgression } = await import(R + 'analysis.js');

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const ORN = { drop: 3, ext: 2, extUnder: .15, maxDrop: 5 };
const EXP = { major: { 0: ['maj'], 2: ['min'], 4: ['min'], 5: ['maj'], 7: ['maj', 'dom'], 9: ['min'], 11: ['dim', 'hdim'] },
  minor: { 0: ['min'], 2: ['dim', 'hdim'], 3: ['maj', 'aug'], 5: ['min'], 7: ['min', 'maj', 'dom'], 8: ['maj'], 10: ['maj', 'dom'], 11: ['dim'] } };
const EXP_MODE = { dorian: { 2: ['min'], 5: ['maj', 'dom'], 8: [], 9: ['dim', 'hdim'] }, phrygian: { 1: ['maj', 'dom'], 2: [], 7: ['min', 'dim', 'hdim'], 10: ['min', 'maj', 'dom'] },
  lydian: { 2: ['maj', 'dom'], 5: [], 6: ['dim', 'hdim'], 11: ['min'] }, mixolydian: { 4: ['dim', 'hdim'], 7: ['min'], 10: ['maj', 'dom'], 11: [] } };
const expFor = key => (key.modal ? { ...EXP[key.mode], ...EXP_MODE[key.modal] } : EXP[key.mode]);
const leads = (it, nx) => !!(it.q && nx.q) && (((it.q === 'dom' || it.q === 'maj') && (nx.root - it.root + 12) % 12 === 5) || ((it.q === 'dim' || it.q === 'hdim') && (nx.root - it.root + 12) % 12 === 1));
function weights(evs, a, dur) {
  const W = new Map(), b = a + dur;
  for (const x of evs) W.set(x.m % 12, (W.get(x.m % 12) || 0) + (Math.min(x.s + x.l, b) - Math.max(x.s, a)) / dur);
  const tot = [...W.values()].reduce((s, v) => s + v, 0);
  W.forEach((v, k) => W.set(k, v / tot));
  return W;
}
// every reading the ornament rule weighs (top k names of each set of notes left out), with its parts of the cost
function readings(st, k) {
  const notes = st.notes, ev = st.evs.filter(x => x.s < st.a + st.dur && x.s + x.l > st.a), W = weights(ev, st.a, st.dur);
  const free = [...W.keys()].filter(p => p !== notes[0] % 12), sets = [[]];
  for (const x of free) for (const s of [...sets]) if (s.length < ORN.maxDrop) sets.push([...s, x]);
  const out = [];
  for (const D of sets) {
    const keep = notes.filter(m => !D.includes(m % 12)); if (new Set(keep.map(m => m % 12)).size < 2) continue;
    for (const c of analyze(keep, null).slice(0, k)) {
      const ext = c.type.degs.filter(d => d.n >= 7).map(d => (d.pc + c.root) % 12).filter(p => W.has(p) && !D.includes(p) && W.get(p) < ORN.extUnder).length;
      out.push({ c, D, W, keep, base: c.score + ORN.drop * 10 * D.reduce((s, p) => s + W.get(p), 0) + ORN.ext * ext });
    }
  }
  return out;
}
const pieces = listJson('tavern').filter(p => !isTest(p.piece));
// the stretches of the development set, read once: readings, key, neighbours, expected chords
const S = [];
for (const piece of pieces) for (const ph of piece.phrases) for (const who of ['A', 'B']) {
  const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'], steps = [], idx = [];
  mine.forEach((s, i) => {
    const on = ph.notes.filter(n => n[1] < s.b && n[1] + n[2] > s.a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y);
    if (ms.length) { idx.push(i); steps.push({ notes: ms, dur: s.b - s.a, a: s.a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) }); }
  });
  if (!steps.length) continue;
  const A = analyzeProgression(steps, P), first = A.rs.map(r => r.c);
  idx.forEach((si, j) => {
    const s = mine[si]; if (!s.exp) return;
    let o = null, bo = 0; for (const t of theirs) { const v = Math.max(0, Math.min(s.b, t.b) - Math.max(s.a, t.a)); if (v > bo) { bo = v; o = t; } }
    S.push({ piece: piece.piece, exps: [s.exp, ...(o && o.exp ? [o.exp] : [])], app: first[j], rd: readings(steps[j], 4), key: A.key, prev: first[j - 1], next: first[j + 1], st: steps[j] });
  });
}
const hit = (c, exps) => !!c && exps.some(x => c.root === x.root && c.type.q === x.quality && isSeventh(c.type.sym) === x.seventh);
const it = c => c && { root: c.root, q: c.type.q };
// cost terms to try; each gets the stretch and one reading and returns what to add to its cost
function ctx(w) {
  return (s, r) => {
    const key = s.key, ek = expFor(key), inKey = x => { const e = ek[(x.root - key.tonic + 12) % 12]; return !!e && e.includes(x.type.q); };
    let v = 0;
    if (s.next && inKey(s.next) && leads(it(r.c), it(s.next))) v -= w.next;
    if (!inKey(r.c)) v += w.key;
    if (s.prev && inKey(r.c) && leads(it(s.prev), it(r.c))) v -= w.prev;
    return v;
  };
}
// the bass on a degree other than the root, the 3rd or the 5th: the 7th (a 4/2 chord) or an extension (9, 11, 13, an altered 5th)
const bassDeg = c => { if (!c.slash) return 1; const d = c.type.degs.find(x => x.pc === (c.bass - c.root + 12) % 12); return d ? d.n : 0; };
const bassCost = (on7, onExt) => (s, r) => { const n = bassDeg(r.c), alt5 = n === 5 && (r.c.bass - r.c.root + 12) % 12 !== 7; return n === 7 ? on7 : n >= 9 || n === 0 || n === 2 || n === 4 || n === 6 || alt5 ? onExt : 0; };
const both = (...fs) => (s, r) => fs.reduce((v, f) => v + f(s, r), 0);
const RUNS = { 'hoy (réplica)': () => 0, 'contexto de la decisión 11 (1; 1; 0,5)': ctx({ key: 1, next: 1, prev: .5 }) };
for (const extra of process.argv.slice(2)) {
  const [kind, ...v] = extra.split(':'), [a, b, c] = v.join(':').split(',').map(Number);
  if (kind === 'ctx') RUNS[`contexto (${a}; ${b}; ${c})`] = ctx({ key: a, next: b, prev: c });
  if (kind === 'bass') RUNS[`bajo en la 7ª +${a}, en una extensión +${b}`] = bassCost(a, b);
  if (kind === 'drop') RUNS[`adorno ${a} por décima (hoy 3)`] = (s, r) => (a - ORN.drop) * 10 * r.D.reduce((t, p) => t + r.W.get(p), 0);
  if (kind === 'all') RUNS[`adorno ${c} por décima, bajo +${a}/+${b} y contexto`] = both(bassCost(a, b), ctx({ key: 1, next: 1, prev: .5 }), (s, r) => (c - ORN.drop) * 10 * r.D.reduce((t, p) => t + r.W.get(p), 0));
  if (kind === 'both') RUNS[`bajo +${a}/+${b} y contexto de la decisión 11`] = both(bassCost(a, b), ctx({ key: 1, next: 1, prev: .5 }));
}
const works = [...new Set(S.map(s => s.piece))];
for (const [name, f] of Object.entries(RUNS)) {
  let ok = 0; const per = new Map(works.map(w => [w, { n: 0, ok: 0 }]));
  for (const s of S) {
    let best = null, bc = Infinity; for (const r of s.rd) { const c = r.base + f(s, r); if (c < bc - 1e-9) { bc = c; best = r.c; } }
    const h = hit(best, s.exps); if (h) ok++; const u = per.get(s.piece); u.n++; if (h) u.ok++;
  }
  console.log(`${name}: ${(100 * ok / S.length).toFixed(1)} % (${ok}/${S.length})`);
}
console.log('la app hoy:', (100 * S.filter(s => hit(s.app, s.exps)).length / S.length).toFixed(1), '%');
