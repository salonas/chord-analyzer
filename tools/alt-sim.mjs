// Simulates the margin of the alternate key (analyzeProgression shows the runner-up when it is within 2 points of the key chosen) on
// the development set: the key chosen stays the app's, only which progressions show an alternate changes. For each margin, by row:
// how many progressions show one, how many of those have the key chosen right (the alternate is noise) and how many have it wrong
// with the alternate right (the alternate is the answer). The app's margin (< 3 with only two chords, < 2 otherwise) must give
// the app's own alternate (it checks).
// The test works and songs are left out. Not part of the suite:
//   node tools/alt-sim.mjs
import { analyzeProgression, detectKey, resolveStep } from '../src/analysis.js';
import { harmonySegs } from '../src/harmony.js';
import { normProg, segStep } from '../src/model.js';
import { isTest, listJson } from '../src/test/corpus-eval.js';

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const itemsOf = steps => { const first = steps.map(s => resolveStep(s, P)); return first.map((r, i) => ({ root: r.c ? r.c.root : r.notes.length ? r.notes[0] % 12 : 0, q: r.c ? r.c.type.q : null, pcs: [...new Set(r.notes.map(m => m % 12))], dur: steps[i].dur || 1 })); };
const stepOf = (notes, a, b) => {
  const on = notes.filter(n => n[1] < b && n[1] + n[2] > a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y);
  return ms.length ? { notes: ms, dur: b - a, a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) } : null;
};
const ROW_T = 'TAVERN, por tramo', ROW_E = 'TAVERN, de punta a punta', ROW_R = 'Rock, tónica';
const cases = [];
const add = (id, row, steps, ok) => {
  const a = analyzeProgression(steps, P), items = itemsOf(steps);
  cases.push({ id, row, items, ok, key: a.key, alt: a.alt, keys: detectKey(items) });
};
for (const p of listJson('tavern').filter(p => !isTest(p.piece))) {
  for (const ph of p.phrases) {
    const ok = k => k.tonic === ph.key.tonic && k.mode === ph.key.mode;
    for (const who of ['A', 'B']) {
      const steps = ph.segs[who].map(s => stepOf(ph.notes, s.a, s.b)).filter(Boolean);
      if (steps.length) add(`${ph.id} (${who})`, ROW_T, steps, ok);
    }
    const pat = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
    const segs = harmonySegs(pat);
    if (segs.length) add(ph.id, ROW_E, segs.map(S => segStep(pat, S)), ok);
  }
}
for (const song of listJson('rock').filter(s => !isTest(s.song))) {
  const accepted = new Set(Object.values(song.analyses).map(x => x.mainTonic));
  for (const [who, a] of Object.entries(song.analyses)) add(`${song.song} (${who})`, ROW_R, a.chords.map(c => ({ notes: c.notes, dur: Math.round(c.dur * 96) })), k => accepted.has(k.tonic));
}

const same = (a, b) => !!a && !!b && a.tonic === b.tonic && a.mode === b.mode;
const distinct = items => new Set(items.map(it => it.root + (it.q || '?'))).size;
// a variant: which progressions take the wider margin, and the margin
const VARIANTS = [
  ['antes (< 2 en todas)', () => false, 2],
  ['2 acordes, ≤ 2', c => c.items.length === 2, 2.001],
  ['2 acordes, < 2,5', c => c.items.length === 2, 2.5],
  ['2 acordes, < 3', c => c.items.length === 2, 3],
  ['2 acordes distintos, ≤ 2', c => distinct(c.items) === 2, 2.001],
  ['2 acordes distintos, < 3', c => distinct(c.items) === 2, 3],
  ['hasta 3 acordes, < 3', c => c.items.length <= 3, 3],
];
const altOf = (c, wide, m) => c.keys.find(k => !same(k, c.key) && c.key.score - k.score < (wide(c) ? m : 2));
let bad = 0;
const app = c => altOf(c, x => x.items.length === 2, 3);
for (const c of cases) if (!same(app(c), c.alt) && (app(c) || c.alt)) bad++;
if (bad) { console.log(`la copia con el margen de la app no da su alternativa en ${bad} progresiones`); process.exit(1); }
const N = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'], kn = k => N[k.tonic] + (k.mode === 'major' ? '' : 'm');
console.log(`progresiones de desarrollo: ${[ROW_T, ROW_E, ROW_R].map(r => `${r} ${cases.filter(c => c.row === r).length}`).join(' · ')}`);
console.log(`con 2 acordes: ${[ROW_T, ROW_E, ROW_R].map(r => `${r} ${cases.filter(c => c.row === r && c.items.length === 2).length}`).join(' · ')}`);
for (const [name, wide, m] of VARIANTS) {
  console.log(`\n${name}`);
  for (const row of [ROW_T, ROW_E, ROW_R]) {
    const cs = cases.filter(c => c.row === row);
    let shown = 0, noise = 0, answer = 0, neither = 0, gained = 0, lost = 0;
    const ex = [];
    for (const c of cs) {
      const a = altOf(c, wide, m), a0 = altOf(c, () => false, 2);
      if (a && !a0) { gained++; if (ex.length < 3) ex.push(`${c.id}: ${c.items.map(it => N[it.root] + (it.q || '?')).join(' ')} → ${kn(c.key)} o ${kn(a)} (${(c.key.score - a.score).toFixed(2)})`); }
      if (!a && a0) lost++;
      if (!a) continue;
      shown++;
      if (c.ok(c.key)) noise++; else if (c.ok(a)) answer++; else neither++;
    }
    console.log(`  ${row}: con alternativa ${shown} de ${cs.length} (elegida bien ${noise}; elegida mal y alternativa bien ${answer}; ninguna ${neither}); nuevas ${gained}, perdidas ${lost}`);
    for (const e of ex) console.log('    ' + e);
  }
}
