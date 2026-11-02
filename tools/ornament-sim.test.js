// Dev-only simulation behind the ornament rule (session of 2026-11-01): scores candidate ways of choosing the chord
// of a TAVERN stretch with non-chord tones, on the development set only. It measures, changes nothing, and only runs
// on request:  ORNAMENT_SIM=out.txt npx vitest run tools/ornament-sim.test.js
import fs from 'node:fs';
import { analyze } from '../src/analysis.js';
import { isTest, listJson } from '../src/test/corpus-eval.js';

const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const isSev = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const EXP = e => NAMES[e.root] + (e.seventh ? ({ maj: 'maj7', min: 'm7', dom: '7', hdim: 'm7♭5', dim: 'dim7' })[e.quality] : ({ maj: '', min: 'm', dim: 'dim', aug: 'aug' })[e.quality]);
const ok = (c, exps) => !!c && exps.some(x => c.root === x.root && c.type.q === x.quality && isSev(c.type.sym) === x.seventh);
const show = c => c ? NAMES[c.root] + c.type.sym + (c.slash ? '/' + NAMES[c.bass] : '') : '(sin acorde)';

// note events of one stretch, with what a rule could use
function events(ph, a, b) {
  const ns = ph.notes.filter(n => n[1] < b && n[1] + n[2] > a);
  const low = Math.min(...ns.map(n => n[0]));
  return ns.map(n => {
    const [m, s, l, sp] = n, e = s + l;
    const inDur = (Math.min(e, b) - Math.max(s, a)) / (b - a);
    const before = ph.notes.some(o => o !== n && o[1] + o[2] === s && Math.abs(o[0] - m) <= 2 && Math.abs(o[0] - m) > 0);
    const after = ph.notes.some(o => o !== n && o[1] === e && Math.abs(o[0] - m) <= 2 && Math.abs(o[0] - m) > 0);
    return { m, sp, on: (s - a) / 96, len: l / 96, inDur, beat: s % 96 === 0, held: s < a, bass: m === low, step: before && after };
  });
}
function weights(ev, opt) {
  const W = new Map();
  for (const x of ev) {
    let w = x.inDur;
    if (opt.beat && x.beat && !x.held) w *= opt.beat;
    if (opt.bass && x.bass) w *= opt.bass;
    W.set(x.m % 12, (W.get(x.m % 12) || 0) + w);
  }
  const tot = [...W.values()].reduce((s, v) => s + v, 0);
  W.forEach((v, k) => W.set(k, v / tot));
  return W;
}
function subsets(arr, k) { const out = [[]]; for (const x of arr) for (const s of [...out]) if (s.length < k) out.push([...s, x]); return out; }
// pick the chord that best explains the stretch: drop up to 3 pitch classes (never the bass), paying lambda × their weight
function pick(ev, opt) {
  const notes = [...new Set(ev.map(x => x.m))].sort((p, q) => p - q), bassPc = notes[0] % 12;
  const W = weights(ev, opt), pcs = [...W.keys()];
  const removable = pcs.filter(pc => pc !== bassPc && (!opt.ornOnly || ev.filter(x => x.m % 12 === pc).every(x => x.step || x.inDur < .5)));
  let best = null;
  for (const D of subsets(removable, opt.maxDrop ?? 3)) {
    const keep = notes.filter(m => !D.includes(m % 12));
    if (new Set(keep.map(m => m % 12)).size < (opt.minKeep ?? 2)) continue;
    const c = analyze(keep, null)[0]; if (!c) continue;
    // an extension (7th and up) that weighs little costs kappa: prefer the triad unless the 7th lasts or falls on the beat
    const ext = c.type.degs.filter(d => d.n >= 7).map(d => (d.pc + c.root) % 12).filter(pc => W.has(pc) && !D.includes(pc) && W.get(pc) < (opt.theta ?? 0));
    const cost = c.score + opt.lambda * D.reduce((s, pc) => s + W.get(pc), 0) * 10 + (opt.kappa || 0) * ext.length;
    if (!best || cost < best.cost - 1e-9) best = { c, cost, D };
  }
  return best;
}

describe.skipIf(!process.env.ORNAMENT_SIM)('ornament simulation', () => it('dev failures', () => {
  const pieces = listJson('tavern').filter(p => !isTest(p.piece));
  const variants = {
    'actual': null,
    'drop libre λ1': { lambda: 1 }, 'drop libre λ2': { lambda: 2 }, 'drop libre λ3': { lambda: 3 }, 'drop libre λ5': { lambda: 5 },
    'drop+beat1.5+bajo2 λ2': { lambda: 2, beat: 1.5, bass: 2 }, 'drop+beat1.5+bajo2 λ3': { lambda: 3, beat: 1.5, bass: 2 }, 'drop+beat1.5+bajo2 λ5': { lambda: 5, beat: 1.5, bass: 2 },
    'drop solo adorno λ2': { lambda: 2, ornOnly: true, beat: 1.5, bass: 2 }, 'drop solo adorno λ3': { lambda: 3, ornOnly: true, beat: 1.5, bass: 2 },
    'drop+beat+bajo λ3 max5': { lambda: 3, beat: 1.5, bass: 2, maxDrop: 5 },
    'λ2 ext<10% κ1': { lambda: 2, beat: 1.5, bass: 2, theta: .10, kappa: 1 },
    'λ2 ext<15% κ1': { lambda: 2, beat: 1.5, bass: 2, theta: .15, kappa: 1 },
    'λ2 ext<15% κ2': { lambda: 2, beat: 1.5, bass: 2, theta: .15, kappa: 2 },
    'λ3 ext<15% κ2 max5': { lambda: 3, beat: 1.5, bass: 2, theta: .15, kappa: 2, maxDrop: 5 },
    'λ2 ext<20% κ2 max5': { lambda: 2, beat: 1.5, bass: 2, theta: .20, kappa: 2, maxDrop: 5 },
    'λ3 ext<15% κ2 max5, sin pesos de pulso ni bajo': { lambda: 3, theta: .15, kappa: 2, maxDrop: 5 },
    'λ3 ext<15% κ2 max5, solo bajo ×2': { lambda: 3, bass: 2, theta: .15, kappa: 2, maxDrop: 5 },
    'λ3 ext<15% κ2 max5, solo pulso ×1,5': { lambda: 3, beat: 1.5, theta: .15, kappa: 2, maxDrop: 5 },
  };
  const acc = Object.fromEntries(Object.keys(variants).map(k => [k, { n: 0, ok: 0, exact: [0, 0], orn: [0, 0] }]));
  const cats = new Map();
  for (const piece of pieces) for (const ph of piece.phrases) for (const who of ['A', 'B']) {
    const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'];
    for (const s of mine) {
      if (!s.exp) continue;
      const ev = events(ph, s.a, s.b); if (!ev.length) continue;
      const o = theirs.reduce((b, t) => { const v = Math.max(0, Math.min(s.b, t.b) - Math.max(s.a, t.a)); return v > b[1] ? [t, v] : b; }, [null, 0])[0];
      const exps = [s.exp, ...(o && o.exp ? [o.exp] : [])];
      const notes = [...new Set(ev.map(x => x.m))].sort((p, q) => p - q);
      const nPc = new Set(notes.map(m => m % 12)).size, exact = nPc === s.exp.pcs.length && s.exp.complete;
      const cur = analyze(notes, null)[0] || null;
      for (const [k, opt] of Object.entries(variants)) {
        const c = opt ? (pick(ev, opt) || {}).c || null : cur;
        const A = acc[k]; A.n++; const hit = ok(c, exps); if (hit) A.ok++;
        A[exact ? 'exact' : 'orn'][0]++; if (hit) A[exact ? 'exact' : 'orn'][1]++;
      }
      if (ok(cur, exps)) continue;
      const nct = new Set(notes.map(m => m % 12).filter(pc => !s.exp.pcs.includes(pc)));
      let cat;
      if (!cur) cat = nPc >= 5 ? 'sin acorde, 5+ clases' : 'sin acorde, ' + nPc + ' clases';
      else if (exps.some(x => x.root === cur.root)) cat = 'raíz bien, calidad mal (' + (cur.type.sym || 'M') + ' por ' + (EXP(s.exp).slice(NAMES[s.exp.root].length) || 'M') + ')';
      else cat = 'raíz mal';
      if (!s.exp.complete) cat += ' · falta nota del acorde';
      const best = pick(ev, variants['drop+beat1.5+bajo2 λ3']);
      const rec = { id: ph.id, who, key: ph.key.token, label: s.label, a: s.a / 96, len: (s.b - s.a) / 96, expected: EXP(s.exp) + (s.exp.inv ? ' inv' + s.exp.inv : ''), got: show(cur), prop: best ? show(best.c) + (ok(best.c, exps) ? ' ✓' : ' ✗') : '-',
        notes: ev.sort((p, q) => p.on - q.on || p.m - q.m).map(x => `${x.sp}${Math.floor(x.m / 12) - 1}${nct.has(x.m % 12) ? '*' : ''} on=${x.on} len=${x.len}${x.beat ? ' T' : ''}${x.held ? ' ret' : ''}${x.step ? ' gc' : ''}${x.bass ? ' bajo' : ''}`) };
      if (!cats.has(cat)) cats.set(cat, []); cats.get(cat).push(rec);
    }
  }
  const out = [];
  for (const [k, A] of Object.entries(acc)) out.push(`${k}: ${(100 * A.ok / A.n).toFixed(1)} % (${A.ok}/${A.n}) | exactas ${(100 * A.exact[1] / A.exact[0]).toFixed(1)} % | con adorno o incompletas ${(100 * A.orn[1] / A.orn[0]).toFixed(1)} %`);
  out.push('');
  const sorted = [...cats].sort((x, y) => y[1].length - x[1].length);
  for (const [cat, list] of sorted.slice(0, 25)) out.push(`${list.length}\t${cat}`);
  out.push('');
  for (const [cat, list] of sorted.slice(0, 14)) {
    out.push('## ' + cat + ' (' + list.length + ')');
    for (const r of [list[Math.floor(list.length / 3)], list[Math.floor(2 * list.length / 3)]]) out.push(JSON.stringify(r, null, 0));
  }
  fs.writeFileSync(process.env.ORNAMENT_SIM, out.join('\n') + '\n');
}, 600000));
