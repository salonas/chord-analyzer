// Dev-only simulation behind the broken-accompaniment rule (session of 2026-11-02, run against main 52a2eea): fills the
// stretches where the app has no chord in several ways and scores the end-to-end row, counting phrases with no app chord
// as uncovered, with a paired bootstrap by work. The variant that became the rule is rejilla1_guarda (beat grid with a
// two-voice guard; the rule then asked for three pitch classes too). Not part of the suite:
//   node tools/segment-sim.mjs
const R = new URL('../src/', import.meta.url).href;
const { isTest, listJson, Tally, bootstrapDiff, bootstrapCI } = await import(R + 'test/corpus-eval.js');
const { analyzeProgression } = await import(R + 'analysis.js');
const { harmonySegs } = await import(R + 'harmony.js');
const { normProg, segStep } = await import(R + 'model.js');

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const T = 96;
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const ov = (x, y) => Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));
const best = (s, os) => { let b = null, bo = 0; for (const o of os) { const v = ov(s, o); if (v > bo) { bo = v; b = o; } } return b; };
const appChord = r => { const c = r && r.c; return c ? { root: c.root, q: c.type.q, sym: c.type.sym, seventh: isSeventh(c.type.sym) } : null; };
const hitOf = (ch, exps) => !!ch && exps.some(x => ch.root === x.root && ch.q === x.quality && ch.seventh === x.seventh);

// a step from every note sounding in [a,b), with timing (what the per-stretch reading gets)
const rawStep = (notes, a, b) => { const on = notes.filter(n => n.s < b && n.s + n.l > a), ms = [...new Set(on.map(n => n.m))].sort((x, y) => x - y); return ms.length ? { notes: ms, dur: b - a, a, evs: on.map(n => ({ m: n.m, s: n.s, l: n.l })) } : null; };
const read1 = st => { if (!st) return null; const c = analyzeProgression([st], P).rs[0].c; return c ? c.root + ':' + c.type.sym : null; };

// fill [a,b) with chords read on a grid of g ticks; neighbours with the same reading merge, then the merged span is one step
function gridFill(notes, a, b, g, guard) {
  const out = [];
  for (let t = Math.floor(a / g) * g; t < b; t += g) {
    const x = Math.max(a, t), y = Math.min(b, t + g); if (y <= x) continue;
    const st = rawStep(notes, x, y); if (!st) continue;
    if (guard) { const on = notes.filter(n => n.s < y && n.s + n.l > x); if (!on.some(p => on.some(q => q !== p && q.m % 12 !== p.m % 12 && Math.min(p.s + p.l, q.s + q.l) - Math.max(p.s, q.s) > 5))) continue; }
    const k = read1(st), prev = out[out.length - 1];
    if (prev && prev.k === k && prev.b === x) prev.b = y; else out.push({ a: x, b: y, k });
  }
  return out.map(o => ({ a: o.a, b: o.b, raw: true }));
}

const VARIANTS = {
  base: (pat, app) => app,
  // the first app chord also covers the stretch before it (no help to phrases without any chord)
  vecino: (pat, app) => (app.length ? [{ ...app[0], a: 0 }, ...app.slice(1)] : app),
  // where the app has no chord (before the first, or the whole phrase), a beat grid with equal neighbours merged
  rejilla1: (pat, app) => { const end = Math.max(...pat.notes.map(n => n.s + n.l)), first = app.length ? app[0].a : end; return [...(first > 0 ? gridFill(pat.notes, 0, first, T) : []), ...app]; },
  rejilla1_guarda: (pat, app) => { const end = Math.max(...pat.notes.map(n => n.s + n.l)), first = app.length ? app[0].a : end; return [...(first > 0 ? gridFill(pat.notes, 0, first, T, true) : []), ...app]; },
  solo_rejilla: (pat, app) => gridFill(pat.notes, 0, Math.max(...pat.notes.map(n => n.s + n.l)), T),
  // rejilla1, and app chords longer than two beats re-read on the beat grid (the stale-chord case)
  rejilla1_largos: (pat, app) => { const end = Math.max(...pat.notes.map(n => n.s + n.l)), first = app.length ? app[0].a : end;
    return [...(first > 0 ? gridFill(pat.notes, 0, first, T) : []), ...app.flatMap(c => (c.b - c.a > 2 * T ? gridFill(pat.notes, c.a, c.b, T) : [c]))]; },
  rejilla2: (pat, app) => { const end = Math.max(...pat.notes.map(n => n.s + n.l)), first = app.length ? app[0].a : end; return [...(first > 0 ? gridFill(pat.notes, 0, first, 2 * T) : []), ...app]; },
};

const pieces = listJson('tavern').filter(p => !isTest(p.piece));
const units = {};
for (const name of Object.keys(VARIANTS)) units[name] = [];
for (const piece of pieces) {
  const U = {}; for (const name of Object.keys(VARIANTS)) U[name] = new Tally();
  for (const ph of piece.phrases) {
    const pat = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
    const app = harmonySegs(pat);
    for (const [name, f] of Object.entries(VARIANTS)) {
      const S = f(pat, app);
      const steps = S.map(s => (s.raw ? rawStep(pat.notes, s.a, s.b) : segStep(pat, s)));
      const A = S.length ? analyzeProgression(steps, P) : null;
      for (const who of ['A', 'B']) {
        const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'];
        for (const s of mine.filter(x => x.exp)) {
          const o = best(s, theirs), exps = [s.exp, ...(o && o.exp ? [o.exp] : [])];
          const k = S.reduce((b, c, i) => (ov(s, c) > (b < 0 ? 0 : ov(s, S[b])) ? i : b), -1);
          const covered = !!A && k >= 0 && ov(s, S[k]) * 2 >= s.b - s.a;
          const hit = covered && hitOf(appChord(A.rs[k]), exps);
          U[name].add('cobertura', covered);
          U[name].add('punta a punta (corregida)', hit);
          if (A) U[name].add('punta a punta (como el reporte)', hit);
        }
      }
    }
  }
  for (const name of Object.keys(VARIANTS)) units[name].push(U[name]);
}
const sum = us => { const o = {}; for (const u of us) for (const [k, c] of u.cats) { o[k] = o[k] || { n: 0, ok: 0 }; o[k].n += c.n; o[k].ok += c.ok; } return Object.fromEntries(Object.entries(o).map(([k, c]) => [k, `${(100 * c.ok / c.n).toFixed(1)} % (${c.ok}/${c.n})`])); };
for (const name of Object.keys(VARIANTS)) {
  console.log('\n==', name, JSON.stringify(sum(units[name])));
  console.log('   IC', JSON.stringify(bootstrapCI(units[name])));
  if (name !== 'base') console.log('   Δ vs base', JSON.stringify(bootstrapDiff(units.base, units[name])));
}
