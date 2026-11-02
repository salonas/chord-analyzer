// The regions of F11 (keyRegions in src/analysis.js) under each candidate rule, on the development set: the Rock Corpus key changes
// the app finds (strict: a new region of the app has the tonic of an annotated new region and covers at least half of it; loose:
// any change), the false ones (a change in an analysis with none annotated), the tonic row with the main key (the region that
// lasts longest), and on TAVERN, which annotates one key per phrase, the key rows by stretch and end to end and the phrases the
// app splits. «sin regiones» is the app before F11. The test songs and works are left out unless --test is given (looked at
// once, at the end of the stage). Not part of the suite:
//   node tools/modulation-sim.mjs [--test]
import { progressionKeys } from '../src/analysis.js';
import { harmonySegs } from '../src/harmony.js';
import { normProg, segStep } from '../src/model.js';
import { Tally, bootstrapCI, isTest, listJson } from '../src/test/corpus-eval.js';

const test = process.argv.includes('--test');
const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const VARIANTS = [['sin regiones', null], ['A: cadencia V → I, ≥ 4 acordes y ≥ 8 tiempos', {}], ['B: A y además tramo de ≥ 16 tiempos que empieza y termina en su tónica', { tonicSpan: true }],
  ['A con V7', { v7: true }], ['A con dos cadencias', { cads: 2 }], ['A con V7 y dos cadencias', { v7: true, cads: 2 }], ['A con ≥ 8 acordes y ≥ 32 tiempos', { chords: 8, beats: 32 }],
  ['A con V7, ≥ 8 acordes y ≥ 32 tiempos', { v7: true, chords: 8, beats: 32 }], ['A con dos cadencias, ≥ 8 acordes y ≥ 32 tiempos', { cads: 2, chords: 8, beats: 32 }],
  ['A con V7, dos cadencias, ≥ 8 acordes y ≥ 32 tiempos', { v7: true, cads: 2, chords: 8, beats: 32 }], ['A con V7 y ≥ 16 acordes', { v7: true, chords: 16, beats: 32 }],
  ['A sin la tónica anterior', { noOldTonic: true }], ['A sin la tónica anterior y dos cadencias', { noOldTonic: true, cads: 2 }], ['A sin la tónica anterior, ≥ 8 acordes y ≥ 32 tiempos', { noOldTonic: true, chords: 8, beats: 32 }],
  ['A sin la tónica anterior, dos cadencias, ≥ 8 acordes y ≥ 32 tiempos', { noOldTonic: true, cads: 2, chords: 8, beats: 32 }], ['B sin la tónica anterior', { tonicSpan: true, noOldTonic: true }], ['B sin la tónica anterior y dos cadencias', { tonicSpan: true, noOldTonic: true, cads: 2 }]];
const stepOf = (notes, a, b) => {
  const on = notes.filter(n => n[1] < b && n[1] + n[2] > a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y);
  return ms.length ? { notes: ms, dur: b - a, a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) } : null;
};
const read = (steps, opts) => {
  const K = progressionKeys(steps, P, opts || {});
  if (!K.items.length) return null;
  const regions = opts ? K.regions : [{ from: 0, to: K.items.length - 1, key: K.top }];
  return { key: opts && K.main && !process.argv.includes('--top-key') ? K.main.key : K.top, regions };
};
const overlap = (a, r) => Math.max(0, Math.min(a.to, r.to) - Math.max(a.from, r.from) + 1);

const songs = listJson('rock').filter(s => isTest(s.song) === test);
const pieces = listJson('tavern').filter(p => isTest(p.piece) === test);
console.log(`${test ? 'PRUEBA' : 'desarrollo'}: ${songs.length} canciones del Rock Corpus, ${pieces.length} obras de TAVERN`);
for (const [name, opts] of VARIANTS) {
  const rockUnits = [], tavUnits = [];
  let withChange = 0, strict = 0, loose = 0, none = 0, falseCh = 0, an = 0, tonicOk = 0;
  const hits = [], falses = [];
  for (const song of songs) {
    const T = new Tally(), by = song.analyses;
    for (const who of Object.keys(by)) {
      const a = by[who], accepted = new Set(Object.values(by).map(x => x.mainTonic));
      const A = read(a.chords.map(c => ({ notes: c.notes, dur: Math.round(c.dur * 96) })), opts);
      an++;
      const ok = accepted.has(A.key.tonic); if (ok) tonicOk++;
      T.add('tónica (acepta ambos analistas), con la tonalidad principal', ok);
      const mod = a.regions.length > 1, rep = A.regions.length > 1;
      if (mod) {
        withChange++;
        const s = rep && A.regions.slice(1).some(x => a.regions.slice(1).some(r => r.tonic === x.key.tonic && 2 * overlap(x, r) >= r.to - r.from + 1));
        if (s) { strict++; hits.push(`${song.song} (${who})`); }
        if (rep) loose++;
        T.add('modulación, estricta: una región nueva de la app tiene la tónica de una región nueva anotada y cubre su mitad', s);
        T.add('modulación, suplementaria: la app informa algún cambio', rep);
      } else {
        none++;
        if (rep) { falseCh++; falses.push(`${song.song} (${who}): ${A.regions.map(r => `${r.key.tonic}${r.key.mode[1]}@${r.from}`).join(' → ')}`); }
        T.add('modulación falsa: análisis sin cambio anotado en los que la app informa un cambio', rep);
      }
    }
    rockUnits.push(T);
  }
  let byOk = 0, byN = 0, e2eOk = 0, e2eN = 0, splitBy = 0, splitE2e = 0, phrases = 0;
  for (const piece of pieces) {
    const T = new Tally();
    for (const ph of piece.phrases) {
      phrases++;
      const exp = ph.key, same = k => k.tonic === exp.tonic && k.mode === exp.mode;
      for (const who of ['A', 'B']) {
        const steps = ph.segs[who].map(s => stepOf(ph.notes, s.a, s.b)).filter(Boolean);
        if (!steps.length) continue;
        const A = read(steps, opts); byN++; if (same(A.key)) byOk++;
        T.add('por tramo | tonalidad (tónica y modo)', same(A.key));
        if (A.regions.length > 1) splitBy++;
        T.add('por tramo | frases partidas en regiones', A.regions.length > 1);
      }
      const pat = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
      const S = harmonySegs(pat);
      if (S.length) {
        const A = read(S.map(x => segStep(pat, x)), opts);
        for (const who of ['A', 'B']) { e2eN++; if (same(A.key)) e2eOk++; T.add('de punta a punta | tonalidad (tónica y modo)', same(A.key)); }
        if (A.regions.length > 1) splitE2e++;
        T.add('de punta a punta | frases partidas en regiones', A.regions.length > 1);
      }
    }
    tavUnits.push(T);
  }
  const ci = { ...bootstrapCI(rockUnits), ...bootstrapCI(tavUnits) };
  const row = (label, ok, n, cat) => console.log(`  ${label}: ${ok} de ${n} (${n ? (100 * ok / n).toFixed(1) : '-'} %${cat && ci[cat] ? `; ${ci[cat][0]}–${ci[cat][1]}` : ''})`);
  console.log(`\n${name}`);
  row('modulación estricta (meta: la mitad)', strict, withChange, 'modulación, estricta: una región nueva de la app tiene la tónica de una región nueva anotada y cubre su mitad');
  row('modulación suplementaria (algún cambio)', loose, withChange);
  row('modulaciones falsas (freno: ≤ 5 %)', falseCh, none);
  row('tónica del rock con la tonalidad principal', tonicOk, an, 'tónica (acepta ambos analistas), con la tonalidad principal');
  row('TAVERN por tramo, tonalidad', byOk, byN, 'por tramo | tonalidad (tónica y modo)');
  row('TAVERN de punta a punta, tonalidad', e2eOk, e2eN, 'de punta a punta | tonalidad (tónica y modo)');
  row('TAVERN frases partidas, por tramo', splitBy, byN);
  row('TAVERN frases partidas, de punta a punta', splitE2e, phrases);
  if (opts && process.argv.includes('--list')) { console.log('  aciertos: ' + hits.join(', ')); falses.forEach(f => console.log('  falsa: ' + f)); }
}
