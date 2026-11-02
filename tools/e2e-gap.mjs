// Dev-only split of the gap between the per-stretch chord row and the end-to-end one (session of 2026-11-02, run against
// main 5dc0e33): every analyst stretch of the TAVERN development works is put in one group by what the per-stretch reading
// and the end-to-end reading say, and by how the app's chord meets the stretch (uncovered, the same cut within an eighth
// note, or another cut). Each app chord counts on its own, as the evaluator did before its neighbours with the same
// reading became one stretch (laneStretches, the old definition of the end-to-end rows). Each share has its 95 % interval (bootstrap by work); with a group (or «dos», the uncovered
// stretches with at most two pitch classes per beat) it prints examples. It measures, changes nothing, and is not part
// of the suite:
//   node tools/e2e-gap.mjs [group | dos]
const R = new URL('../src/', import.meta.url).href;
const { isTest, listJson, Tally, bootstrapCI } = await import(R + 'test/corpus-eval.js');
const { analyzeProgression } = await import(R + 'analysis.js');
const { harmonySegs, splitHarmony } = await import(R + 'harmony.js');
const { normProg, segStep } = await import(R + 'model.js');

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const T = 96, TOL = 12; // the same cut: both ends within a 32nd note
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const pc = x => NAMES[((x % 12) + 12) % 12];
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const expSym = e => (e.seventh ? ({ maj: 'maj7', min: 'm7', dom: '7', hdim: 'm7b5', dim: 'dim7' })[e.quality] : ({ maj: '', min: 'm', dim: 'dim', aug: 'aug' })[e.quality]);
const ov = (x, y) => Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));
const best = (s, os) => { let b = null, bo = 0; for (const o of os) { const v = ov(s, o); if (v > bo) { bo = v; b = o; } } return b; };
const appChord = r => { const c = r && r.c; return c ? { root: c.root, q: c.type.q, sym: c.type.sym, seventh: isSeventh(c.type.sym) } : null; };
const hitOf = (ch, exps) => !!ch && exps.some(x => ch.root === x.root && ch.q === x.quality && ch.seventh === x.seventh);
const show = ch => (ch ? pc(ch.root) + ch.sym : '-');
const stepOf = (notes, a, b) => { const on = notes.filter(n => n[1] < b && n[1] + n[2] > a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y); return ms.length ? { notes: ms, dur: b - a, a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) } : null; };
// the most pitch classes sounding in any beat of the stretch
const maxPcsPerBeat = (notes, a, b) => { let m = 0; for (let t = Math.floor(a / T) * T; t < b; t += T) { const x = Math.max(a, t), y = Math.min(b, t + T); m = Math.max(m, new Set(notes.filter(n => n[1] < y && n[1] + n[2] > x).map(n => n[0] % 12)).size); } return m; };

const want = process.argv[2] || '';
const pieces = listJson('tavern').filter(p => !isTest(p.piece));
const units = [], EX = [];
for (const piece of pieces) {
  const U = new Tally();
  for (const ph of piece.phrases) {
    const pat = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
    const H = splitHarmony(pat), app = harmonySegs(pat);
    const appA = app.length ? analyzeProgression(app.map(S => segStep(pat, S)), P) : null;
    for (const who of ['A', 'B']) {
      const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'];
      // per stretch, as the evaluator does it
      const idx = [], st = [];
      mine.forEach((s, i) => { const x = stepOf(ph.notes, s.a, s.b); if (x) { idx.push(i); st.push(x); } });
      const PT = new Map();
      if (st.length) { const A = analyzeProgression(st, P); idx.forEach((si, j) => PT.set(si, A.rs[j])); }
      mine.forEach((s, si) => {
        if (!s.exp) return;
        const o = best(s, theirs), exps = [s.exp, ...(o && o.exp ? [o.exp] : [])];
        const pt = appChord(PT.get(si)), ptHit = hitOf(pt, exps);
        const k = app.reduce((b, c, i) => (ov(s, c) > (b < 0 ? 0 : ov(s, app[b])) ? i : b), -1);
        const covered = !!appA && k >= 0 && ov(s, app[k]) * 2 >= s.b - s.a;
        const e2e = covered ? appChord(appA.rs[k]) : null, e2eHit = hitOf(e2e, exps);
        const same = covered && Math.abs(app[k].a - s.a) <= TOL && Math.abs(app[k].b - s.b) <= TOL;
        const cut = !covered ? 'sin cubrir' : same ? 'mismo corte' : app[k].b - app[k].a > s.b - s.a + TOL ? 'corte más largo' : 'corte más corto o corrido';
        const nPc = new Set(st[idx.indexOf(si)] ? st[idx.indexOf(si)].notes.map(m => m % 12) : []).size;
        const why = !covered ? (!appA ? 'frase sin acorde' : k < 0 || ov(s, app[k]) === 0 ? 'hueco' : 'cubierto a medias') : '';
        const grp = `${ptHit ? 'por tramo bien' : 'por tramo mal'} · ${cut}${why ? ' (' + why + ')' : ''} · punta a punta ${e2eHit ? 'bien' : 'mal'}`;
        U.add('punta a punta bien', e2eHit);
        U.add('por tramo bien', ptHit);
        U.add('grupo: ' + grp, true);
        for (const g of ['sin cubrir', 'mismo corte', 'corte más largo', 'corte más corto o corrido']) U.add('corte: ' + g, cut === g);
        // the gap: stretches the per-stretch reading gets and end to end does not, by where they are lost
        U.add('pérdida: por tramo bien, sin cubrir', ptHit && !covered);
        U.add('pérdida: por tramo bien, otro corte', ptHit && covered && !same && !e2eHit);
        U.add('pérdida: por tramo bien, mismo corte, otra lectura', ptHit && same && !e2eHit);
        U.add('ganancia: por tramo mal, punta a punta bien', !ptHit && e2eHit);
        if (ptHit && same && !e2eHit) {
          const own = new Set(app[k].notes), on = pat.notes.filter(n => n.s < s.b && n.s + n.l > s.a && !own.has(n.m));
          const roles = [...new Set(on.map(n => H.role.get(n.id) === 'mel' ? 'melodía' : 'voz interior o bajo de paso'))].sort().join(' y ');
          U.add(`mismo corte, otra lectura: la franja deja fuera ${roles || 'nada'}`, true);
        }
        if (!covered) {
          const mp = maxPcsPerBeat(ph.notes, s.a, s.b);
          U.add(`sin cubrir: ${mp <= 2 ? '≤ 2' : '3 o más'} clases por tiempo · por tramo ${ptHit ? 'bien' : 'mal'}`, true);
        }
        if (want && (grp.includes(want) || (want === 'dos' && !covered && maxPcsPerBeat(ph.notes, s.a, s.b) <= 2)) && EX.length < 40) EX.push({ ph: ph.id, who, span: [s.a, s.b], exp: pc(s.exp.root) + expSym(s.exp), pt: show(pt), e2e: show(e2e), app: covered ? [app[k].a, app[k].b] : null, notes: st[idx.indexOf(si)] ? st[idx.indexOf(si)].notes.join(' ') : '' });
      });
    }
  }
  units.push(U);
}
const all = new Tally(); for (const u of units) for (const [k, c] of u.cats) { const o = all.cats.get(k) || { n: 0, ok: 0 }; o.n += c.n; o.ok += c.ok; all.cats.set(k, o); }
const N = all.cats.get('punta a punta bien').n, ci = bootstrapCI(units);
console.log(`desarrollo: ${pieces.length} obras, ${N} tramos`);
for (const [k, c] of [...all.cats].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
  const counted = k.startsWith('grupo') || k.startsWith('sin cubrir:') || k.startsWith('mismo corte,');
  console.log(`${k}: ${c.ok} (${(100 * c.ok / N).toFixed(1)} %${counted ? '' : '; IC ' + ci[k].join('–')})`);
}
if (EX.length) console.log(JSON.stringify(EX, null, 0).replace(/\},\{/g, '},\n{'));
