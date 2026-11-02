// Times the development evaluation in one thread (no test works or songs) and prints the rows of the corpus ratchet
// (RATCHET_ROWS), to compare with src/test/fixtures/theory/corpus/ratchet.json. Not part of the suite:
//   node tools/dev-time.mjs
import { evalRock, evalTavern, isTest, listJson, ratchetCounts, RATCHET_ROWS } from '../src/test/corpus-eval.js';

const t0 = performance.now();
const pieces = listJson('tavern').filter(p => !isTest(p.piece));
const songs = listJson('rock').filter(s => !isTest(s.song));
const t1 = performance.now();
const tav = evalTavern(pieces).T;
const t2 = performance.now();
const rock = evalRock(songs).T;
const t3 = performance.now();
const counts = ratchetCounts(tav.cats, rock.cats);
for (const r of RATCHET_ROWS) {
  const c = counts[r.row];
  console.log(c ? `${c.ok}/${c.n} = ${(100 * c.ok / c.n).toFixed(1)} %  ${r.row}` : `sin datos  ${r.row}`);
}
console.log(`lectura ${(t1 - t0).toFixed(0)} ms · TAVERN ${(t2 - t1).toFixed(0)} ms (${pieces.length} obras) · rock ${(t3 - t2).toFixed(0)} ms (${songs.length} canciones)`);
