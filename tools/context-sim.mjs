// Dev-only measurement for the second stage of segmentation and root by context (session of 2026-11-02, run against
// feat/broken-accompaniment 4255437): breaks down the end-to-end failures where the app cuts like the analyst but reads
// another root, and scores the two candidate rules on the TAVERN development works, with a paired bootstrap by work.
//   (a) app chords longer than two beats re-read on the beat grid (the stale-chord case)
//   (b) root by context: the candidates of every note in the stretch, ornaments left out by timing, weighed by the key and
//       by the next chord (V → I)
// The guards of (a) here count every note of the chord, passing basses too; the rule (decision 10) counts the pitch classes
// struck with it, as the stricter count split the template's turnaround. Its base is the current harmonySegs.
// It measures, changes nothing, and is not part of the suite:
//   node tools/context-sim.mjs
const R = new URL('../src/', import.meta.url).href;
const { isTest, listJson, Tally, bootstrapDiff, bootstrapCI } = await import(R + 'test/corpus-eval.js');
const { analyze, analyzeProgression, spellCandidate } = await import(R + 'analysis.js');
const { gridChords, harmonySegs } = await import(R + 'harmony.js');
const { normProg, segStep } = await import(R + 'model.js');

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const T = 96, TOL = 48;
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const ov = (x, y) => Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));
const best = (s, os) => { let b = null, bo = 0; for (const o of os) { const v = ov(s, o); if (v > bo) { bo = v; b = o; } } return b; };
const chordOf = c => (c ? { root: c.root, q: c.type.q, sym: c.type.sym, seventh: isSeventh(c.type.sym) } : null);
const hitOf = (ch, exps) => !!ch && exps.some(x => ch.root === x.root && ch.q === x.quality && ch.seventh === x.seventh);
const rootOf = (ch, exps) => !!ch && exps.some(x => ch.root === x.root);

// every note sounding in [a,b), with timing
const rawStep = (notes, a, b) => { const on = notes.filter(n => n.s < b && n.s + n.l > a), ms = [...new Set(on.map(n => n.m))].sort((x, y) => x - y); return ms.length ? { notes: ms, dur: b - a, a, evs: on.map(n => ({ m: n.m, s: n.s, l: n.l })) } : null; };

// ---------- (a) long chords on the grid ----------
const read1 = st => { if (!st) return null; const c = analyzeProgression([st], P).rs[0].c; return c ? c.root + ':' + c.type.sym : null; };
function gridFill(notes, a, b) {
  const out = [];
  for (let t = Math.floor(a / T) * T; t < b; t += T) {
    const x = Math.max(a, t), y = Math.min(b, t + T); if (y <= x) continue;
    const st = rawStep(notes, x, y); if (!st) continue;
    const k = read1(st), prev = out[out.length - 1];
    if (prev && prev.k === k && prev.b === x) prev.b = y; else out.push({ a: x, b: y, k });
  }
  return out.map(o => ({ a: o.a, b: o.b, raw: true }));
}
// the rule as the app would run it: gridChords inside the long chord; the beats it leaves keep the old chord
// guard: a beat is re-read only when the old chord has gone stale there: some pitch class of its own notes (alguna), or
// half of them (mitad), no longer sounds
function ruleFill(pat, c, guard) {
  const ns = [...pat.notes].sort((x, y) => x.s - y.s || x.m - y.m), own = pat.notes.filter(n => c.ids.has(n.id));
  const pcs = [...new Set(own.map(n => n.m % 12))];
  const gone = g => pcs.filter(pc => !own.some(n => n.m % 12 === pc && n.s < g.b && n.s + n.l > g.a)).length;
  const G = gridChords(ns, c.a, c.b).filter(g => !guard || (guard === 'alguna' ? gone(g) > 0 : gone(g) * 2 >= pcs.length));
  if (!G.length) return [c];
  const out = []; let t = c.a;
  for (const g of G) { if (g.a > t) out.push({ ...c, a: t, b: g.a }); out.push({ a: g.a, b: g.b, raw: true }); t = g.b; }
  if (t < c.b) out.push({ ...c, a: t, b: c.b });
  return out;
}
const SEG = {
  base: (pat, app) => app,
  a_rejilla: (pat, app) => app.flatMap(c => (c.b - c.a > 2 * T ? gridFill(pat.notes, c.a, c.b) : [c])),
  a_regla: (pat, app) => app.flatMap(c => (c.b - c.a > 2 * T ? ruleFill(pat, c) : [c])),
  a_alguna: (pat, app) => app.flatMap(c => (c.b - c.a > 2 * T ? ruleFill(pat, c, 'alguna') : [c])),
  a_mitad: (pat, app) => app.flatMap(c => (c.b - c.a > 2 * T ? ruleFill(pat, c, 'mitad') : [c])),
};

// ---------- (b) root by context ----------
const EXP = { major: { 0: ['maj'], 2: ['min'], 4: ['min'], 5: ['maj'], 7: ['maj', 'dom'], 9: ['min'], 11: ['dim', 'hdim'] },
  minor: { 0: ['min'], 2: ['dim', 'hdim'], 3: ['maj', 'aug'], 5: ['min'], 7: ['min', 'maj', 'dom'], 8: ['maj'], 10: ['maj', 'dom'], 11: ['dim'] } };
const inKey = (c, key) => { const e = EXP[key.mode][(c.root - key.tonic + 12) % 12]; return !!e && e.includes(c.type.q); };
const leads = (c, nx) => !!c && !!nx && (((c.type.q === 'dom' || c.type.q === 'maj') && (nx.root - c.root + 12) % 12 === 5) || ((c.type.q === 'dim' || c.type.q === 'hdim') && (nx.root - c.root + 12) % 12 === 1));
// the readings of a step: each set of up to five non-bass pitch classes left out (and, as a pedal, the bass too), its
// cost as in the ornament rule (decision 8): the type's points, 3 per tenth of weight left out, 2 per light extension
function readings(st, pedal) {
  const notes = st.notes, a = st.a, dur = st.dur, b = a + dur, W = new Map();
  for (const x of st.evs) W.set(x.m % 12, (W.get(x.m % 12) || 0) + (Math.min(x.s + x.l, b) - Math.max(x.s, a)) / dur);
  const tot = [...W.values()].reduce((s, v) => s + v, 0); W.forEach((v, k) => W.set(k, v / tot));
  const bassPc = notes[0] % 12, free = [...W.keys()].filter(pc => pc !== bassPc), sets = [[]];
  for (const x of free) for (const s of [...sets]) if (s.length < 5) sets.push([...s, x]);
  const out = [];
  for (const D0 of sets) for (const dropBass of pedal ? [false, true] : [false]) {
    const D = dropBass ? [...D0, bassPc] : D0, keep = notes.filter(m => !D.includes(m % 12));
    if (new Set(keep.map(m => m % 12)).size < 2) continue;
    for (const c of analyze(keep, null).slice(0, 4)) {
      const ext = c.type.degs.filter(d => d.n >= 7).map(d => (d.pc + c.root) % 12).filter(pc => W.has(pc) && !D.includes(pc) && W.get(pc) < 0.15).length;
      out.push({ c, cost: c.score + 30 * D.reduce((s, pc) => s + (W.get(pc) || 0), 0) + 2 * ext + (dropBass ? PED : 0), D, dropBass });
    }
  }
  return out.sort((x, y) => x.cost - y.cost);
}
let PED = 4;
// one pass: each step takes the cheapest reading after the context weights; the next chord is the first-pass reading
function contextChords(steps, A, w, pedalOk) {
  const first = A.rs.map(r => r.c);
  return steps.map((st, i) => {
    if (!st || !st.evs || !st.evs.length) return first[i];
    const rs = readings(st, pedalOk && pedalOk[i]); if (!rs.length) return first[i];
    let bestR = null, bc = Infinity;
    for (const r of rs) {
      let cost = r.cost;
      if (w.key && !inKey(r.c, A.key)) cost += w.key;
      if (w.next && leads(r.c, first[i + 1]) && first[i + 1] && inKey(first[i + 1], A.key)) cost -= w.next;
      if (w.prev && i > 0 && leads(first[i - 1], r.c) && inKey(r.c, A.key)) cost -= w.prev;
      if (cost < bc - 1e-9) { bc = cost; bestR = r; }
    }
    return bestR.c;
  });
}
// a bass is a pedal when the same bass note holds under two or more app chords in a row
function pedals(pat, S) {
  return S.map((s, i) => {
    const low = pat.notes.filter(n => n.s < s.b && n.s + n.l > s.a).reduce((x, n) => (!x || n.m < x.m ? n : x), null);
    if (!low) return false;
    const holds = t => t && low.s <= t.a + TOL && low.s + low.l >= t.b - TOL;
    return low.l >= 2 * T && (holds(S[i - 1]) || holds(S[i + 1]) || low.l >= s.b - s.a + 2 * T);
  });
}
const CHORDS = {
  actual: { seg: 'base', fn: (pat, S, steps, A) => A.rs.map(r => r.c) },
  b_todas: { seg: 'base', all: true, fn: (pat, S, steps, A) => A.rs.map(r => r.c) },
  b_tonalidad: { seg: 'base', all: true, fn: (pat, S, steps, A) => contextChords(steps, A, { key: 1 }) },
  b_tonalidad_sig: { seg: 'base', all: true, fn: (pat, S, steps, A) => contextChords(steps, A, { key: 1, next: 1 }) },
  b_ton_sig_ant: { seg: 'base', all: true, fn: (pat, S, steps, A) => contextChords(steps, A, { key: 1, next: 1, prev: 0.5 }) },
  b_ton2_sig: { seg: 'base', all: true, fn: (pat, S, steps, A) => contextChords(steps, A, { key: 2, next: 1 }) },
  b_ton_sig_pedal: { seg: 'base', all: true, fn: (pat, S, steps, A) => contextChords(steps, A, { key: 1, next: 1 }, pedals(pat, S)) },
  b_app_ton_sig: { seg: 'base', fn: (pat, S, steps, A) => contextChords(steps, A, { key: 1, next: 1 }) },
  a_rejilla: { seg: 'a_rejilla', fn: (pat, S, steps, A) => A.rs.map(r => r.c) },
  a_regla: { seg: 'a_regla', fn: (pat, S, steps, A) => A.rs.map(r => r.c) },
  a_regla_b: { seg: 'a_regla', all: true, fn: (pat, S, steps, A) => contextChords(steps, A, { key: 1, next: 1 }) },
  a_alguna: { seg: 'a_alguna', fn: (pat, S, steps, A) => A.rs.map(r => r.c) },
  a_mitad: { seg: 'a_mitad', fn: (pat, S, steps, A) => A.rs.map(r => r.c) },
  a_alguna_b: { seg: 'a_alguna', all: true, fn: (pat, S, steps, A) => contextChords(steps, A, { key: 1, next: 1, prev: 0.5 }) },
};

const pieces = listJson('tavern').filter(p => !isTest(p.piece));
const units = Object.fromEntries(Object.keys(CHORDS).map(k => [k, []]));
const BR = {}, add = k => { BR[k] = (BR[k] || 0) + 1; };
for (const piece of pieces) {
  const U = Object.fromEntries(Object.keys(CHORDS).map(k => [k, new Tally()]));
  for (const ph of piece.phrases) {
    const pat = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
    const app = harmonySegs(pat), cache = {};
    const kern = new Map(); ph.notes.forEach(n => { if (!kern.has(n[0])) kern.set(n[0], new Set()); kern.get(n[0]).add(n[3]); });
    // the notes of the current app chord that covers the stretch
    const baseNotes = s => { const k = app.reduce((b, c, i) => (ov(s, c) > (b < 0 ? 0 : ov(s, app[b])) ? i : b), -1); return k >= 0 && ov(s, app[k]) * 2 >= s.b - s.a ? app[k].notes : null; };
    for (const [name, V] of Object.entries(CHORDS)) {
      const S = SEG[V.seg](pat, app), ck = V.seg + (V.all ? ':all' : '');
      if (!cache[ck]) {
        const steps = S.map(s => ((V.all || s.raw) && rawStep(pat.notes, s.a, s.b)) || segStep(pat, s));
        cache[ck] = { steps, A: S.length ? analyzeProgression(steps, P) : null };
      }
      const { steps, A } = cache[ck], C = A ? V.fn(pat, S, steps, A) : [];
      for (const who of ['A', 'B']) {
        const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'];
        for (const s of mine.filter(x => x.exp)) {
          const o = best(s, theirs), exps = [s.exp, ...(o && o.exp ? [o.exp] : [])];
          const k = S.reduce((b, c, i) => (ov(s, c) > (b < 0 ? 0 : ov(s, S[b])) ? i : b), -1);
          const covered = !!A && k >= 0 && ov(s, S[k]) * 2 >= s.b - s.a;
          const ch = covered ? chordOf(C[k]) : null, hit = covered && hitOf(ch, exps);
          U[name].add('punta a punta (corregida)', hit);
          U[name].add('cobertura', covered);
          if (covered && C[k]) {
            // spelling, as the report counts it: every distinct note of the step against the Humdrum names; and only the notes
            // the current app step holds, so that more notes checked does not pass for worse spelling
            const sp = C[k] === A.rs[k].c ? A.rs[k].spelled : spellCandidate(C[k], steps[k].notes, P, A.key).notes;
            const got = new Map(sp.map(x => [x.midi, 'CDEFGAB'[x.l] + ({ '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' })[x.a]]));
            const ok = m => kern.get(m) && kern.get(m).has(got.get(m));
            U[name].add('enarmonía de punta a punta (tramo completo)', steps[k].notes.every(ok));
            const own = baseNotes(s);
            if (own) U[name].add('enarmonía, solo las notas del acorde actual de la app', own.every(m => !got.has(m) || ok(m)));
          }
          if (name !== 'actual' || !covered || hit) continue;
          // the breakdown of the current reading's failures with the cut in the right place
          const c = S[k], aligned = Math.abs(c.a - s.a) <= TOL && Math.abs(c.b - s.b) <= TOL;
          if (!aligned || rootOf(ch, exps)) continue;
          add('R corte bien, raíz mal');
          const all = rawStep(pat.notes, c.a, c.b), allC = analyzeProgression([all], P).rs[0].c;
          if (hitOf(chordOf(allC), exps)) add('R | todas las notas del tramo aciertan');
          if (analyze(c.notes, null).some(x => hitOf(chordOf(x), exps))) add('R | algún candidato de las notas de la app acierta');
          const rd = readings(all, true);
          if (rd.some(r => hitOf(chordOf(r.c), exps))) add('R | algún candidato de todas las notas acierta (techo de b)');
          if (rd.some(r => !r.dropBass && hitOf(chordOf(r.c), exps))) add('R | ... sin quitar el bajo');
          if (exps.some(x => x.cad64)) add('R | el analista lo rotula Cc (6/4 cadencial, se guarda como tríada de tónica)');
          if (exps.some(x => !x.pcs.includes(c.notes[0] % 12))) add('R | el bajo de la app no es del acorde esperado');
          const nx = C[k + 1];
          if (exps.some(x => nx && (x.root - nx.root + 12) % 12 === 7)) add('R | el esperado está una 5ª sobre el acorde siguiente de la app (V → I)');
          if (C[k] && A && !inKey(C[k], A.key)) add('R | la lectura de la app no es de la tonalidad que detecta');
        }
      }
    }
  }
  for (const k of Object.keys(CHORDS)) units[k].push(U[k]);
}
const sum = us => { const o = {}; for (const u of us) for (const [k, c] of u.cats) { o[k] = o[k] || { n: 0, ok: 0 }; o[k].n += c.n; o[k].ok += c.ok; } return o; };
const fmt = o => Object.entries(o).map(([k, c]) => `${k} ${(100 * c.ok / c.n).toFixed(1)} % (${c.ok}/${c.n})`).join(' · ');
console.log('dev works', pieces.length);
for (const k of Object.keys(BR)) console.log(String(BR[k]).padStart(6), k);
const b0 = sum(units.actual);
for (const k of Object.keys(CHORDS)) {
  const s = sum(units[k]), ci = bootstrapCI(units[k]), d = k === 'actual' ? null : bootstrapDiff(units.actual, units[k]);
  const delta = c => (100 * (s[c].ok / s[c].n - b0[c].ok / b0[c].n)).toFixed(1);
  console.log(`\n== ${k}: ${fmt(s)}\n   IC ${JSON.stringify(ci)}` + (d ? `\n   Δ ${Object.keys(s).map(c => c + ' ' + delta(c)).join(' · ')}\n   IC Δ ${JSON.stringify(d)}` : ''));
}
