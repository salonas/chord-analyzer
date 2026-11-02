// Breaks down the stretches of the development set with some note spelled wrong (the spelling goal row: TAVERN, by annotated
// stretch, every note of the stretch against the Humdrum spelling) by cause, with counts, examples and the ceiling of each group
// (the row if every stretch of the group were right). Each stretch goes to the first cause that applies, in this order:
//   key       the key the app read is not the phrase's (tonic and mode)
//   chord     the app's chord is neither annotator's reading (root and quality), or it read none
//   aug6      the annotator labels an augmented sixth (Gn, Lt, Fr)
//   secondary the annotator labels a secondary dominant or leading-tone chord (V…/x, viio…/x)
//   chromatic some wrong note is outside the annotator's chord and outside the key's scale (a chromatic passing or neighbour note)
//   other     the rest, by label
// It also says, for every group, how many of its stretches the later causes would also take, and for the key group how many
// the app would spell right with the phrase's key. The test works are left out. Not part of the suite:
//   node tools/spelling-breakdown.mjs [--examples n]
import { analyzeProgression, resolveStep } from '../src/analysis.js';
import { isTest, listJson } from '../src/test/corpus-eval.js';

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10, 11];
const spellName = s => 'CDEFGAB'[s.l] + ({ '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' })[s.a];
const spellOf = r => { const m = new Map(); (r.spelled || []).forEach(s => m.set(s.midi, spellName(s))); return m; };
const stepOf = (notes, a, b) => {
  const on = notes.filter(n => n[1] < b && n[1] + n[2] > a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y);
  return ms.length ? { notes: ms, dur: b - a, a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) } : null;
};
const overlap = (x, y) => Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));
const bestOverlap = (seg, others) => { let best = null, bo = 0; for (const o of others) { const v = overlap(seg, o); if (v > bo) { bo = v; best = o; } } return best; };
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const ei = process.argv.indexOf('--examples'), EX = ei > 0 ? +process.argv[ei + 1] : 3;

const GROUPS = ['key', 'chord', 'aug6', 'secondary', 'chromatic', 'other'];
const NAME = { key: 'tonalidad mal detectada', chord: 'acorde mal leído', aug6: 'sexta aumentada', secondary: 'dominante secundaria', chromatic: 'nota cromática fuera del acorde (de paso o bordadura)', other: 'otra' };
let n = 0, ok = 0;
const bad = [];
for (const p of listJson('tavern').filter(p => !isTest(p.piece))) for (const ph of p.phrases) {
  const kern = new Map(); ph.notes.forEach(x => { if (!kern.has(x[0])) kern.set(x[0], new Set()); kern.get(x[0]).add(x[3]); });
  const expKey = { tonic: ph.key.tonic, mode: ph.key.mode };
  for (const who of ['A', 'B']) {
    const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'];
    const steps = [], idx = [];
    mine.forEach((s, i) => { const st = stepOf(ph.notes, s.a, s.b); if (st) { idx.push(i); steps.push(st); } });
    if (!steps.length) continue;
    const A = analyzeProgression(steps, P), keyOk = A.key.tonic === expKey.tonic && A.key.mode === expKey.mode;
    idx.forEach((si, j) => {
      const s = mine[si]; if (!s.exp) return;
      const r = A.rs[j], got = spellOf(r), wrong = [];
      for (const m of r.notes) { const set = kern.get(m) || new Set(); if (!(got.has(m) && set.has(got.get(m)))) wrong.push({ m, want: [...set][0] || '?', got: got.get(m) || '?' }); }
      n++;
      if (!wrong.length) { ok++; return; }
      const o = bestOverlap(s, theirs), exps = [s.exp, ...(o && o.exp ? [o.exp] : [])], c = r.c;
      const chordOk = !!c && exps.some(x => c.root === x.root && c.type.q === x.quality && isSeventh(c.type.sym) === x.seventh);
      const sc = (expKey.mode === 'major' ? MAJ : MIN).map(x => (x + expKey.tonic) % 12);
      const flags = {
        key: !keyOk, chord: !chordOk, aug6: /^(Gn|Lt|Fr)/.test(s.label), secondary: /^(V|viio)[^/]*\/./.test(s.label),
        chromatic: wrong.some(w => !s.exp.pcs.includes(w.m % 12) && !sc.includes(w.m % 12)), other: true,
      };
      const group = GROUPS.find(g => flags[g]);
      // the key group: would the phrase's key spell the stretch right (the step read again with it and the same neighbours)?
      let keyFix = null;
      if (group === 'key') {
        const r2 = resolveStep(steps[j], P, expKey, { prev: A.rs[j - 1] && A.rs[j - 1].c, next: A.rs[j + 1] && A.rs[j + 1].c }), g2 = spellOf(r2);
        keyFix = r2.notes.every(m => g2.has(m) && (kern.get(m) || new Set()).has(g2.get(m)));
      }
      bad.push({ group, flags, keyFix, label: s.label, id: `${ph.id} (${who})`, key: ph.key.token, appKey: NAMES[A.key.tonic] + (A.key.mode === 'major' ? '' : 'm'),
        appChord: c ? NAMES[c.root] + c.type.sym : '(sin acorde)', wrong });
    });
  }
}
const pct = x => (100 * x / n).toFixed(1).replace('.', ',');
console.log(`TAVERN, desarrollo, por tramo anotado: ${n} tramos, ${ok} con todas las notas bien (${pct(ok)} %); ${bad.length} con alguna mal`);
for (const g of GROUPS) {
  const bs = bad.filter(b => b.group === g);
  if (!bs.length) continue;
  console.log(`\n${NAME[g]}: ${bs.length} (${(100 * bs.length / bad.length).toFixed(0)} % de los tramos mal); techo ${pct(ok + bs.length)} % (+${pct(bs.length)})`);
  const later = GROUPS.slice(GROUPS.indexOf(g) + 1, -1).map(h => `${NAME[h]} ${bs.filter(b => b.flags[h]).length}`).join(' · ');
  if (later) console.log(`  también cumplen: ${later}`);
  if (g === 'key') console.log(`  con la tonalidad de la frase quedarían bien ${bs.filter(b => b.keyFix).length}`);
  const sig = new Map(); bs.forEach(b => b.wrong.forEach(w => { const k = `${w.want} escrito ${w.got}`; sig.set(k, (sig.get(k) || 0) + 1); }));
  console.log(`  notas mal más frecuentes: ${[...sig].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  const lab = new Map(); bs.forEach(b => lab.set(b.label, (lab.get(b.label) || 0) + 1));
  console.log(`  rótulos más frecuentes: ${[...lab].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  // examples spread over the group, not the first phrases of one work
  for (let i = 0; i < Math.min(EX, bs.length); i++) {
    const b = bs[Math.floor(i * bs.length / Math.min(EX, bs.length))];
    console.log(`  ${b.id} · ${b.key} (app ${b.appKey}) · ${b.label} · app ${b.appChord} · ${b.wrong.map(w => `${w.want} escrito ${w.got}`).join(', ')}`);
  }
}
