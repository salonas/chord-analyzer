// Simulates spelling a note outside the key by where it goes, on the development set: a note outside the scale of the key the app
// read that the same voice follows a semitone up is written with the letter under its goal (G♯ → A, not A♭ → A), one followed a
// semitone down with the letter above it (A♭ → G). «The same voice» is a note that starts when this one ends, a semitone away,
// with no other note starting then a semitone the other way. Only what the app knows is used (its key, its chord, the notes);
// the annotators' spelling only scores. Scored as the goal row (TAVERN, by annotated stretch, every note of the stretch right),
// with the paired Δ by work against the app. The test works are left out. Not part of the suite:
//   node tools/spelling-sim.mjs
// Variants: orn, only the notes the app's chord leaves out (ornaments and notes it does not name); all, every note outside the key,
// chord notes too; +from, when nothing follows a semitone away, the note it comes from a semitone away decides (from under, ♯;
// from above, ♭); up, only the notes that go a semitone up (the ones going down keep the name they have)
import { analyzeProgression, plainSpell } from '../src/analysis.js';
import { Tally, bootstrapCI, bootstrapDiff, isTest, listJson } from '../src/test/corpus-eval.js';

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const NAT = [0, 2, 4, 5, 7, 9, 11];
const STEPS = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10, 11, 9] };
const spellName = s => 'CDEFGAB'[s.l] + ({ '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' })[s.a];
const stepOf = (notes, a, b) => {
  const on = notes.filter(n => n[1] < b && n[1] + n[2] > a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y);
  return ms.length ? { notes: ms, dur: b - a, a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) } : null;
};
const VARIANTS = [['orn', false, false], ['orn+from', false, true], ['all', true, false], ['all+from', true, true], ['orn up', false, false, true], ['all up', true, false, true]];
const ROWS = ['por tramo | enarmonía (tramo con todas las notas bien)', 'por tramo | enarmonía (nota a nota)'];

// +1 up, -1 down, 0 neither or both
function direction(notes, m, a, b, from) {
  const occ = notes.filter(n => n[0] === m && n[1] < b && n[1] + n[2] > a);
  const dirs = occ.map(o => {
    const e = o[1] + o[2], nx = new Set(notes.filter(n => n[1] === e && Math.abs(n[0] - m) === 1).map(n => n[0] - m));
    if (nx.size === 1) return [...nx][0];
    if (!from || nx.size) return 0;
    const pv = new Set(notes.filter(n => n[1] + n[2] === o[1] && Math.abs(n[0] - m) === 1).map(n => m - n[0]));
    return pv.size === 1 ? [...pv][0] : 0;
  }).filter(Boolean);
  return dirs.length && dirs.every(d => d === dirs[0]) ? dirs[0] : 0;
}
function respelled(r, key, notes, a, b, all, from, up) {
  const sc = STEPS[key.mode].map(x => (x + key.tonic) % 12), out = new Map();
  for (const s of r.spelled) {
    let name = spellName(s);
    const pc = s.midi % 12, chordNote = !!(r.sp && r.sp.byPc[pc]) && !s.orn && !(r.orn || []).includes(s.midi);
    if (!sc.includes(pc) && (all || !chordNote)) {
      const d = direction(notes, s.midi, a, b, from);
      if (d > 0 || (d && !up)) {
        const t = plainSpell(s.midi + d, P, key), l = (t.l + (d > 0 ? 6 : 1)) % 7;
        let acc = ((s.midi - NAT[l]) % 12 + 12) % 12; if (acc > 6) acc -= 12;
        if (Math.abs(acc) <= 1) name = spellName({ l, a: acc });
      }
    }
    out.set(s.midi, name);
  }
  return out;
}

const units = { app: [] }, change = {};
VARIANTS.forEach(([v]) => { units[v] = []; });
for (const p of listJson('tavern').filter(p => !isTest(p.piece))) {
  const T = { app: new Tally() };
  VARIANTS.forEach(([v]) => { T[v] = new Tally(); });
  for (const ph of p.phrases) {
    const kern = new Map(); ph.notes.forEach(x => { if (!kern.has(x[0])) kern.set(x[0], new Set()); kern.get(x[0]).add(x[3]); });
    for (const who of ['A', 'B']) {
      const mine = ph.segs[who], steps = [], idx = [];
      mine.forEach((s, i) => { const st = stepOf(ph.notes, s.a, s.b); if (st) { idx.push(i); steps.push(st); } });
      if (!steps.length) continue;
      const A = analyzeProgression(steps, P);
      idx.forEach((si, j) => {
        const s = mine[si]; if (!s.exp) return;
        const r = A.rs[j];
        const score = (tally, got) => {
          let allOk = true;
          tally.last = got;
          for (const m of r.notes) { const ok = got.has(m) && (kern.get(m) || new Set()).has(got.get(m)); tally.add(ROWS[1], ok); if (!ok) allOk = false; }
          tally.add(ROWS[0], allOk);
          return allOk;
        };
        const was = score(T.app, new Map(r.spelled.map(x => [x.midi, spellName(x)])));
        for (const [v, all, from, up] of VARIANTS) {
          const got = respelled(r, A.key, ph.notes, s.a, s.b, all, from, up), now = score(T[v], got);
          if (was !== now) {
            const c = change[v] || (change[v] = { won: 0, lost: 0, ex: [] });
            if (now) c.won++; else { c.lost++; if (c.ex.length < 4) c.ex.push(`${ph.id} (${who}) · ${ph.key.token} · ${s.label} · ${r.label} · ${r.notes.filter(m => got.get(m) !== spellName(r.spelled.find(x => x.midi === m))).map(m => `${[...(kern.get(m) || [])][0]} escrito ${got.get(m)} (antes ${spellName(r.spelled.find(x => x.midi === m))})`).join(', ')}`); }
          }
        }
      });
    }
  }
  for (const k in T) units[k].push(T[k]);
}
const tot = us => { const c = new Map(); us.forEach(u => u.cats.forEach((x, k) => { const y = c.get(k) || { n: 0, ok: 0 }; y.n += x.n; y.ok += x.ok; c.set(k, y); })); return c; };
const f = x => String(x).replace('.', ',');
const base = tot(units.app), ciB = bootstrapCI(units.app);
for (const row of ROWS) {
  const b = base.get(row);
  console.log(`\n${row}\n  app: ${f((100 * b.ok / b.n).toFixed(1))} % (${b.ok}/${b.n}; ${f(ciB[row][0])}–${f(ciB[row][1])})`);
  for (const [v] of VARIANTS) {
    const a = tot(units[v]).get(row), d = bootstrapDiff(units.app, units[v])[row];
    console.log(`  ${v}: ${f((100 * a.ok / a.n).toFixed(1))} % (${a.ok}/${a.n}), Δ ${f((100 * (a.ok / a.n - b.ok / b.n)).toFixed(1))} (${f(d[0])} a ${f(d[1])})`);
  }
}
for (const [v] of VARIANTS) {
  const c = change[v] || { won: 0, lost: 0, ex: [] };
  console.log(`
${v}: tramos que pasan a bien ${c.won}, a mal ${c.lost}`);
  c.ex.forEach(e => console.log('  ' + e));
}
