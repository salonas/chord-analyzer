// Dev-only look at the app cuts that fall on the resolution of an appoggiatura (session of 2026-11-02, run against main
// 5dc0e33 with the end-to-end definition of laneStretches). A cut of the app where the analyst does not cut, and where a
// note outside the analyst's chord resolves by step (1 or 2 semitones) into a note of it, is counted by kind: appoggiatura
// (the note starts with the app chord before the cut, or later inside it) or suspension (it was already sounding before).
// It also simulates a remedy on the app's side, which knows no analyst chord: an app chord whose notes are those of the next
// chord plus notes that resolve by step into it takes the name of the next chord, with its own bass (the cut stays). The
// end-to-end rows are scored as corpus-eval does, with a paired bootstrap by work. It measures, changes nothing, and is not
// part of the suite:
//   node tools/appoggiatura-cuts.mjs [examples]
const R = new URL('../src/', import.meta.url).href;
const { isTest, listJson, Tally, bootstrapCI, bootstrapDiff, laneStretches } = await import(R + 'test/corpus-eval.js');
const { analyzeProgression } = await import(R + 'analysis.js');
const { harmonySegs, splitHarmony } = await import(R + 'harmony.js');
const { normProg, segStep } = await import(R + 'model.js');

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const TOL = 12, NEAR = 48;
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const ov = (x, y) => Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));
const best = (s, os) => { let b = null, bo = 0; for (const o of os) { const v = ov(s, o); if (v > bo) { bo = v; b = o; } } return b; };
const chordOf = c => {
  if (!c) return null;
  const d = c.type.degs.find(x => x.pc === (c.bass - c.root + 12) % 12);
  const inv = !c.slash ? 0 : d && d.n === 3 ? 1 : d && d.n === 5 ? 2 : d && d.n === 7 ? 3 : 4;
  return { root: c.root, q: c.type.q, sym: c.type.sym, seventh: isSeventh(c.type.sym), inv };
};
const pcsOf = c => new Set(c.type.degs.map(d => (d.pc + c.root) % 12));
const show = c => (c ? NAMES[c.root] + c.type.sym + (c.slash ? '/' + NAMES[c.bass] : '') : '-');

// the notes sounding in [a,b) that end at b and resolve by step into a note that starts at b and belongs to pcs
const resolving = (notes, a, b, inPcs) => notes.filter(n => n.s < b && n.s + n.l > a && Math.abs(n.s + n.l - b) <= TOL && !inPcs.has(n.m % 12)
  && notes.some(m => Math.abs(m.s - b) <= TOL && Math.abs(m.m - n.m) >= 1 && Math.abs(m.m - n.m) <= 2 && inPcs.has(m.m % 12)));

// appoggiatura: it starts with the app chord before the cut or on a beat; suspension: it was already sounding before that
// chord; else a passing or neighbour note
const kindOf = (n, x) => (n.s < x.a - TOL ? 'retardo' : Math.abs(n.s - x.a) <= TOL || n.s % 96 <= TOL || n.s % 96 >= 96 - TOL ? 'apoyatura' : 'nota de paso o bordadura');

// the remedy: each app chord whose sounding notes are those of the next chord plus notes resolving by step into it takes
// the next chord's name (from the first reading), with its own bass. kinds: which resolving notes count
const PLAIN = new Set(['', 'm', 'dim', 'aug', '7', 'm7', 'maj7', 'm7♭5', 'dim7']);
function remedy(pat, app, rs, kinds, plainOnly) {
  const out = rs.map(r => r.c);
  for (let i = 0; i + 1 < app.length; i++) {
    const X = app[i], Y = app[i + 1], yc = rs[i + 1].c, xc = rs[i].c;
    if (!yc || Math.abs(X.b - Y.a) > 5) continue;
    const ypcs = pcsOf(yc), res = resolving(pat.notes, X.a, X.b, ypcs).filter(n => kinds.includes(kindOf(n, X)));
    if (!res.length) continue;
    const rp = new Set(res.map(n => n.m % 12)), on = pat.notes.filter(n => n.s < X.b && n.s + n.l > X.a);
    if (rp.size > 2 || !on.every(n => ypcs.has(n.m % 12) || rp.has(n.m % 12))) continue;
    // the next chord's root and third already sound before the cut: a V7 going to I, all of whose notes move by step, is not it
    const held = new Set(on.filter(n => !rp.has(n.m % 12)).map(n => n.m % 12));
    if (!yc.type.degs.filter(d => d.n === 1 || d.n === 3).every(d => held.has((d.pc + yc.root) % 12))) continue;
    if (xc && xc.root === yc.root && xc.type.sym === yc.type.sym) continue;
    // the next chord is a plain one (a triad or a seventh, with its third) and this one is not: the resolution goes into the
    // stable chord, not out of it (D going to Dsus4, or E/G# going to G#dim, keep their names)
    if (plainOnly && (!PLAIN.has(yc.type.sym) || (xc && PLAIN.has(xc.type.sym)))) continue;
    const bass = X.notes[0] % 12;
    if (!ypcs.has(bass)) continue;
    out[i] = { ...yc, bass, slash: bass !== yc.root };
  }
  return out;
}

const VARIANTS = { base: null, apoyatura: ['apoyatura'], 'apoyatura y retardo': ['apoyatura', 'retardo'], 'toda nota que resuelva': ['apoyatura', 'retardo', 'nota de paso o bordadura'], 'apoyatura, hacia un acorde común': ['apoyatura', 'plain'], 'toda nota, hacia un acorde común': ['apoyatura', 'retardo', 'nota de paso o bordadura', 'plain'] };
const want = process.argv[2];
const pieces = listJson('tavern').filter(p => !isTest(p.piece));
const units = Object.fromEntries(Object.keys(VARIANTS).map(k => [k, []])), census = [], EX = [];
for (const piece of pieces) {
  const U = Object.fromEntries(Object.keys(VARIANTS).map(k => [k, new Tally()])), C = new Tally();
  for (const ph of piece.phrases) {
    const pat = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
    const H = splitHarmony(pat), app = harmonySegs(pat);
    const appA = app.length ? analyzeProgression(app.map(S => segStep(pat, S)), P) : null;
    const baseHit = new Map();
    for (const [name, kinds] of Object.entries(VARIANTS)) {
      const cs = appA ? (kinds ? remedy(pat, app, appA.rs, kinds, kinds.includes('plain')) : appA.rs.map(r => r.c)) : [];
      const lane = appA ? laneStretches(app, { rs: cs.map(c => ({ c })) }) : [];
      for (const who of ['A', 'B']) {
        const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'];
        for (const s of mine.filter(x => x.exp)) {
          const o = best(s, theirs), exps = [s.exp, ...(o && o.exp ? [o.exp] : [])];
          const g = lane.reduce((b, c, i) => (ov(s, c) > (b < 0 ? 0 : ov(s, lane[b])) ? i : b), -1);
          const covered = g >= 0 && ov(s, lane[g]) * 2 >= s.b - s.a;
          const k = covered ? lane[g].parts.reduce((b, i) => (ov(s, app[i]) > ov(s, app[b]) ? i : b)) : -1;
          const ch = covered ? chordOf(cs[k]) : null, hit = !!ch && exps.some(x => ch.root === x.root && ch.q === x.quality && ch.seventh === x.seventh);
          U[name].add('acorde de punta a punta, contando como fallo los tramos sin acorde', hit);
          if (name === 'base') baseHit.set(who + '|' + s.a, hit);
          U[name].add('tramo cubierto', covered);
          if (hit) U[name].add('inversión, dado el acorde correcto', exps.some(x => x.inv === ch.inv));
          if (name === want && covered && EX.length < 30 && cs[k] !== appA.rs[k].c) {
            const was = chordOf(appA.rs[k].c), wasHit = !!was && exps.some(x => was.root === x.root && was.q === x.quality && was.seventh === x.seventh);
            EX.push({ ph: ph.id, who, span: [s.a, s.b], exp: NAMES[s.exp.root] + (s.exp.quality === 'min' ? 'm' : s.exp.quality === 'maj' ? '' : s.exp.quality) + (s.exp.seventh ? '7' : ''), app: [app[k].a, app[k].b], antes: show(appA.rs[k].c), despues: show(cs[k]), ok: `${wasHit ? 'bien' : 'mal'} → ${hit ? 'bien' : 'mal'}` });
          }
        }
      }
      if (name !== 'base' || !appA) continue;
      // census: the app's cuts (between the lane stretches) that the analyst does not make, and why
      const cuts = lane.slice(1).map(x => x.a), marked = new Set();
      for (const who of ['A', 'B']) {
        const mine = ph.segs[who], ab = mine.slice(1).map(x => x.a);
        for (const c of cuts) {
          const near = ab.reduce((m, t) => Math.min(m, Math.abs(t - c)), Infinity);
          if (near <= TOL) { C.add('corte de la app que el analista también corta (±12 ticks)', true); continue; }
          const s = mine.find(x => x.a <= c && c < x.b);
          const where = near <= NEAR ? 'corrido hasta una corchea del corte del analista' : 'dentro de un tramo del analista';
          C.add('corte de la app que el analista no corta (±12 ticks): ' + where, true);
          if (!s || !s.exp) continue;
          const x = lane.find(l => l.b === c) || lane[0];
          const res = resolving(pat.notes, x.a, c, new Set(s.exp.pcs));
          const ks = res.map(n => kindOf(n, x)), kind = !res.length ? 'sin nota que resuelva por grado conjunto' : ['apoyatura', 'retardo', 'nota de paso o bordadura'].find(k => ks.includes(k));
          const voice = res.length ? (res.some(n => H.role.get(n.id) === 'mel') ? ', en la melodía' : ', en una voz del acorde') : '';
          C.add(`   ${where}: ${kind}${voice}`, true);
          if (res.length) marked.add(who + '|' + s.a);
        }
      }
      // the analyst stretches that hold such a cut (a resolution by step where the analyst does not cut), and how many of
      // them the end-to-end reading misses: the most a remedy for these cuts could win
      for (const k of marked) { C.add('tramos del analista con un corte de la app en una resolución', true); if (!baseHit.get(k)) C.add('   de ellos, de punta a punta mal', true); }
    }
  }
  for (const k of Object.keys(VARIANTS)) units[k].push(U[k]);
  census.push(C);
}
const sum = us => { const o = {}; for (const u of us) for (const [k, c] of u.cats) { o[k] = o[k] || { n: 0, ok: 0 }; o[k].n += c.n; o[k].ok += c.ok; } return o; };
console.log(`desarrollo: ${pieces.length} obras`);
console.log('\n== cortes de la app (entre tramos de laneStretches), por anotador');
for (const [k, c] of Object.entries(sum(census)).sort((x, y) => (x[0].trim() < y[0].trim() ? -1 : 1))) console.log(`${k}: ${c.ok}`);
for (const name of Object.keys(VARIANTS)) {
  const s = sum(units[name]), ci = bootstrapCI(units[name]), d = name === 'base' ? null : bootstrapDiff(units.base, units[name]);
  console.log(`\n== ${name}`);
  for (const [k, c] of Object.entries(s)) console.log(`   ${k}: ${(100 * c.ok / c.n).toFixed(1)} % (${c.ok}/${c.n}; ${ci[k].join('–')})${d ? `   Δ ${(100 * (c.ok / c.n - sum(units.base)[k].ok / sum(units.base)[k].n)).toFixed(1)} (${d[k][0]} a ${d[k][1]})` : ''}`);
}
if (EX.length) console.log(JSON.stringify(EX, null, 0).replace(/\},\{/g, '},\n{'));
