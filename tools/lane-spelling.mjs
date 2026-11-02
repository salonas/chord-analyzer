// How the notes the lane shows apart from its chords are spelled, before and after laneSpell (decision 14 brought to them), on the
// development set of TAVERN. Those notes are the added notes of a chord («+G♯3 en 2», harmonyLines in src/text.js) and the
// melody; they have no row in the corpus report, as a stretch is scored by the notes of its step. Each phrase goes through the
// app's own lane (splitHarmony and the steps harmonyLines gives analyzeProgression), and each added note and each melody note is
// scored against the Humdrum spelling of the same pitch in the phrase (any of its spellings there counts). «Before» is plainSpell
// with the key the app read; «after» is laneSpell. The causes of a change: the chord over the note gave its letter (a tone of the
// chord) or its goal did (decision 14). Paired Δ by work, 95 % bootstrap. The test works are left out. Not part of the suite:
//   node tools/lane-spelling.mjs
import { analyzeProgression, laneSpell, plainSpell } from '../src/analysis.js';
import { splitHarmony } from '../src/harmony.js';
import { normProg, stepTiming } from '../src/model.js';
import { sigOf } from '../src/data.js';
import { Tally, bootstrapCI, bootstrapDiff, isTest, listJson } from '../src/test/corpus-eval.js';

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const spellName = s => 'CDEFGAB'[s.l] + ({ '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' })[s.a];
const units = { before: [], after: [] }, changes = new Map(), examples = new Map();
let pieces = 0;
for (const piece of listJson('tavern').filter(p => !isTest(p.piece))) {
  pieces++;
  const B = new Tally(), A = new Tally();
  for (const ph of piece.phrases) {
    const kern = new Map();
    ph.notes.forEach(n => { if (!kern.has(n[0])) kern.set(n[0], new Set()); kern.get(n[0]).add(n[3]); });
    const p = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
    const Hm = splitHarmony(p);
    if (!Hm.chords.length) continue;
    const An = analyzeProgression(Hm.chords.map(c => ({ notes: c.notes, dur: c.b - c.a, ...stepTiming(p, c.a, c.b, c.notes, c.withMel), ...(p.names[sigOf(c.notes)] || {}) })), P);
    const evs = p.notes.map(n => ({ m: n.m, s: n.s, l: n.l }));
    const score = (kind, m, s, l, r) => {
      const was = plainSpell(m, P, An.key), now = laneSpell(m, s, l, r, evs, An.key, P), want = kern.get(m) || new Set();
      const okB = want.has(spellName(was)), okA = want.has(spellName(now));
      for (const k of [kind, 'todas']) { B.add(k, okB); A.add(k, okA); }
      if (spellName(was) === spellName(now)) return;
      const cause = r && r.sp && r.sp.byPc[m % 12] ? 'por el acorde' : 'por el destino';
      const key = `${kind} · ${cause} · ${okB ? 'bien' : 'mal'} → ${okA ? 'bien' : 'mal'}`;
      changes.set(key, (changes.get(key) || 0) + 1);
      if (!examples.has(key)) examples.set(key, `${ph.id}: ${spellName(was)} → ${spellName(now)} (partitura ${[...want].join('/') || '?'}; acorde ${r ? r.label : '—'}; tonalidad ${An.key.tonic} ${An.key.mode})`);
    };
    Hm.chords.forEach((c, i) => c.adds.forEach(x => score('agregados', x.m, x.s, (p.notes.find(n => n.m === x.m && n.s === x.s) || { l: 0 }).l, An.rs[i])));
    Hm.mel.forEach(x => { const k = Hm.chords.indexOf(Hm.chordAt(x.s)); x.notes.forEach(m => score('melodía', m, x.s, x.l, An.rs[k])); });
  }
  units.before.push(B); units.after.push(A);
}
const sum = (us, cat) => us.reduce((o, u) => { const c = u.cats.get(cat); if (c) { o.n += c.n; o.ok += c.ok; } return o; }, { n: 0, ok: 0 });
const ciB = bootstrapCI(units.before), ciA = bootstrapCI(units.after), d = bootstrapDiff(units.before, units.after);
console.log(`desarrollo: ${pieces} obras; nota a nota contra la partitura`);
for (const cat of ['agregados', 'melodía', 'todas']) {
  const b = sum(units.before, cat), a = sum(units.after, cat);
  console.log(`${cat}: ${(100 * b.ok / b.n).toFixed(2)} % (${b.ok}/${b.n}; ${ciB[cat]}) → ${(100 * a.ok / a.n).toFixed(2)} % (${a.ok}/${a.n}; ${ciA[cat]})   Δ ${(100 * (a.ok / a.n - b.ok / b.n)).toFixed(2)} (${d[cat][0]} a ${d[cat][1]})`);
}
console.log('\nnotas que cambian de letra:');
[...changes].sort((x, y) => y[1] - x[1]).forEach(([k, n]) => console.log(`  ${n}  ${k}   p. ej. ${examples.get(k)}`));
