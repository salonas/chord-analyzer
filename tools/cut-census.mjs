// Dev-only census of the app cuts that the analyst does not make and that no note resolving by step explains (session of
// 2026-11-02, run against main 5dc0e33 with the end-to-end definition of laneStretches; the cuts on a resolution are in
// tools/appoggiatura-cuts.mjs). Each such cut is put in a group by what made it (the path of splitHarmony that opened the
// chord after it, whether the bass changes there, whether every note is struck again) and by how the two readings differ,
// with the analyst stretches that hold it and how many of them the end-to-end reading misses. Then it scores a few simple
// rules that only use what the app knows: the chords of a run under the same bass are read as one (the lane keeps its cuts
// and gives them that one name), with a paired bootstrap by work. It measures, changes nothing, and is not part of the
// suite:
//   node tools/cut-census.mjs
const R = new URL('../src/', import.meta.url).href;
const { isTest, listJson, Tally, bootstrapCI, bootstrapDiff, laneStretches } = await import(R + 'test/corpus-eval.js');
const { analyzeProgression } = await import(R + 'analysis.js');
const { harmonySegs, splitHarmony } = await import(R + 'harmony.js');
const { normProg, segStep } = await import(R + 'model.js');
const { sigOf } = await import(R + 'data.js');

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const T = 96, TOL = 12;
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const ov = (x, y) => Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));
const best = (s, os) => { let b = null, bo = 0; for (const o of os) { const v = ov(s, o); if (v > bo) { bo = v; b = o; } } return b; };
const hitOf = (c, exps) => !!c && exps.some(x => c.root === x.root && c.type.q === x.quality && isSeventh(c.type.sym) === x.seventh);
const resolves = (notes, a, b, inPcs) => notes.some(n => n.s < b && n.s + n.l > a && Math.abs(n.s + n.l - b) <= TOL && !inPcs.has(n.m % 12)
  && notes.some(m => Math.abs(m.s - b) <= TOL && Math.abs(m.m - n.m) >= 1 && Math.abs(m.m - n.m) <= 2 && inPcs.has(m.m % 12)));
const onBeat = t => t % T <= TOL || t % T >= T - TOL;

// a rule joins neighbouring app chords into one before reading them; join(X, Y) says whether Y goes with the run of X
const RULES = {
  base: null,
  'mismo bajo y misma raíz': (X, Y, rx, ry) => X.notes[0] % 12 === Y.notes[0] % 12 && rx && ry && rx.root === ry.root,
  'mismo bajo, corte fuera del tiempo': (X, Y) => X.notes[0] % 12 === Y.notes[0] % 12 && !onBeat(Y.a),
  'mismo bajo, trozo de menos de un tiempo': (X, Y) => X.notes[0] % 12 === Y.notes[0] % 12 && Math.min(X.b - X.a, Y.b - Y.a) < T,
  'mismo bajo': (X, Y) => X.notes[0] % 12 === Y.notes[0] % 12,
  'misma raíz (el bajo se mueve dentro del acorde)': (X, Y, rx, ry) => rx && ry && rx.root === ry.root,
  'el trozo siguiente no suma notas fuera del acorde': (X, Y, rx) => !!rx && Y.notes.every(m => [...rx.type.degs].some(d => (d.pc + rx.root) % 12 === m % 12)),
};
const joinSegs = (pat, app, rs, f) => {
  const out = [];
  app.forEach((S, i) => {
    const g = out[out.length - 1];
    if (g && Math.abs(g.b - S.a) <= 5 && f(app[i - 1], S, rs[i - 1].c, rs[i].c)) {
      const notes = [...new Set([...g.notes, ...S.notes])].sort((x, y) => x - y);
      out[out.length - 1] = { ...g, b: S.b, notes, sig: sigOf(notes), ids: new Set([...g.ids, ...S.ids]) };
    } else out.push(S);
  });
  return out;
};

const pieces = listJson('tavern').filter(p => !isTest(p.piece));
const units = Object.fromEntries(Object.keys(RULES).map(k => [k, []])), census = [];
for (const piece of pieces) {
  const U = Object.fromEntries(Object.keys(RULES).map(k => [k, new Tally()])), C = new Tally();
  for (const ph of piece.phrases) {
    const pat = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
    const H = splitHarmony(pat), app = harmonySegs(pat);
    const appA = app.length ? analyzeProgression(app.map(S => segStep(pat, S)), P) : null;
    const plainPath = H.mel.length === 0 && H.top.length === 0;
    const hits = new Map();
    for (const [name, f] of Object.entries(RULES)) {
      const segs = appA && f ? joinSegs(pat, app, appA.rs, f) : app;
      const A = !segs.length ? null : f ? analyzeProgression(segs.map(S => segStep(pat, S)), P) : appA;
      const lane = A ? laneStretches(segs, A) : [];
      for (const who of ['A', 'B']) {
        const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'];
        for (const s of mine.filter(x => x.exp)) {
          const o = best(s, theirs), exps = [s.exp, ...(o && o.exp ? [o.exp] : [])];
          const g = lane.reduce((b, c, i) => (ov(s, c) > (b < 0 ? 0 : ov(s, lane[b])) ? i : b), -1);
          const covered = g >= 0 && ov(s, lane[g]) * 2 >= s.b - s.a;
          const k = covered ? lane[g].parts.reduce((b, i) => (ov(s, segs[i]) > ov(s, segs[b]) ? i : b)) : -1;
          const hit = covered && hitOf(A.rs[k].c, exps);
          U[name].add('acorde de punta a punta, contando como fallo los tramos sin acorde', hit);
          U[name].add('tramo cubierto', covered);
          if (name === 'base') hits.set(who + '|' + s.a, hit);
        }
      }
    }
    if (!appA) continue;
    // census of the base: the cuts between lane stretches that the analyst does not make (±12 ticks) and no resolution explains
    const lane = laneStretches(app, appA);
    for (const who of ['A', 'B']) {
      const mine = ph.segs[who], ab = mine.slice(1).map(x => x.a), marked = new Map();
      for (let j = 1; j < lane.length; j++) {
        const c = lane[j].a, s = mine.find(x => x.a <= c && c < x.b);
        if (ab.some(t => Math.abs(t - c) <= TOL) || !s || !s.exp || resolves(pat.notes, lane[j - 1].a, c, new Set(s.exp.pcs))) continue;
        const xi = lane[j - 1].parts[lane[j - 1].parts.length - 1], yi = lane[j].parts[0], X = app[xi], Y = app[yi], rx = appA.rs[xi].c, ry = appA.rs[yi].c;
        const hc = H.chords.find(h => Math.abs(h.a - Y.a) <= 5);
        const path = plainPath ? 'bloques o arpegio' : hc && hc.own ? 'rejilla (decisiones 9 y 10)' : 'acorde atacado';
        const on = pat.notes.filter(n => n.s <= c + TOL && n.s + n.l > c + TOL);
        const why = X.notes[0] % 12 !== Y.notes[0] % 12 ? 'cambia el bajo' : on.length && on.every(n => Math.abs(n.s - c) <= TOL) ? 'mismo bajo, se ataca todo de nuevo' : 'mismo bajo, cambian las voces de arriba';
        const reading = !rx || !ry ? 'un lado sin acorde' : rx.root === ry.root ? 'misma raíz, otro tipo' : 'otra raíz';
        const key = `${path} · ${why} · ${reading}`;
        C.add('corte: ' + key, true);
        if (!marked.has(s.a)) marked.set(s.a, key);
      }
      for (const [a, key] of marked) { C.add('tramo: ' + key, true); if (!hits.get(who + '|' + a)) C.add('tramo mal: ' + key, true); }
    }
  }
  for (const k of Object.keys(RULES)) units[k].push(U[k]);
  census.push(C);
}
const sum = us => { const o = {}; for (const u of us) for (const [k, c] of u.cats) { o[k] = o[k] || { n: 0, ok: 0 }; o[k].n += c.n; o[k].ok += c.ok; } return o; };
console.log(`desarrollo: ${pieces.length} obras\n\n== cortes de la app que el analista no hace, sin nota que resuelva por grado conjunto (cortes · tramos con el corte · de ellos, mal)`);
const cs = sum(census), keys = [...new Set(Object.keys(cs).map(k => k.replace(/^(corte|tramo|tramo mal): /, '')))];
const n = k => (cs[k] ? cs[k].ok : 0);
keys.sort((x, y) => n('corte: ' + y) - n('corte: ' + x)).forEach(k => console.log(`${n('corte: ' + k)} · ${n('tramo: ' + k)} · ${n('tramo mal: ' + k)}   ${k}`));
console.log(`total: ${keys.reduce((s, k) => s + n('corte: ' + k), 0)} · ${keys.reduce((s, k) => s + n('tramo: ' + k), 0)} · ${keys.reduce((s, k) => s + n('tramo mal: ' + k), 0)}`);
const sb = sum(units.base);
for (const name of Object.keys(RULES)) {
  const s = sum(units[name]), ci = bootstrapCI(units[name]), d = name === 'base' ? null : bootstrapDiff(units.base, units[name]);
  console.log(`\n== ${name}`);
  for (const [k, c] of Object.entries(s)) console.log(`   ${k}: ${(100 * c.ok / c.n).toFixed(1)} % (${c.ok}/${c.n}; ${ci[k].join('–')})${d ? `   Δ ${(100 * (c.ok / c.n - sb[k].ok / sb[k].n)).toFixed(1)} (${d[k][0]} a ${d[k][1]})` : ''}`);
}
