// Ratchet of the development figures on the external corpora: the rows of the goals and the brakes of the modulation
// (RATCHET_ROWS in src/test/corpus-eval.js) must not get worse. It reads the development set only; the test figures are kept in
// the same file as a floor and are written only by the report, at the one look at the test set that closes a stage.
// Regenerate on purpose, with the reason, and copy what it prints to the commit and to THEORY.md:
//   UPDATE_CORPUS="decisión 16: …" npx vitest run src/corpus.ratchet.test.js
import fs from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { isTest, RATCHET_ROWS, ratchetCounts } from './test/corpus-eval.js';

const FIXTURE = new URL('./test/fixtures/theory/corpus/ratchet.json', import.meta.url);
const THREADS = Math.min(8, os.availableParallelism());

// The Rock Corpus in one thread, the TAVERN works split among the others
function evalDev() {
  const n = Math.max(1, THREADS - 1);
  const run = i => new Promise((resolve, reject) => {
    const w = new Worker(new URL('./test/corpus-shard.js', import.meta.url), { workerData: { i, n } });
    w.once('message', resolve);
    w.once('error', reject);
  });
  return Promise.all([-1, ...Array.from({ length: n }, (_, i) => i)].map(run));
}
const sum = parts => {
  const m = new Map();
  for (const p of parts) for (const [k, c] of p.cats) { const o = m.get(k) || { n: 0, ok: 0 }; o.n += c.n; o.ok += c.ok; m.set(k, o); }
  return m;
};
const frac = c => (c ? `${c.ok}/${c.n} (${(100 * c.ok / c.n).toFixed(1)} %)` : '—');
// > 0 if now is better than was in the row's direction, < 0 if worse; exact, without rounding
const cmp = (r, was, now) => (r.better === 'up' ? 1 : -1) * (now.ok * was.n - was.ok * now.n);

describe('corpus ratchet (development set)', () => {
  it('keeps the development figures of the goals and the brakes', async () => {
    const parts = await evalDev();
    const names = parts.flatMap(p => p.names);
    expect(names.filter(isTest), 'a test work or song was evaluated').toEqual([]);
    const units = { tavern: parts.filter(p => p.set === 'tavern').reduce((s, p) => s + p.names.length, 0), rock: parts.find(p => p.set === 'rock').names.length };
    const now = ratchetCounts(sum(parts.filter(p => p.set === 'tavern')), sum(parts.filter(p => p.set === 'rock')));
    const old = fs.existsSync(FIXTURE) ? JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) : null;
    if (process.env.UPDATE_CORPUS) {
      const why = process.env.UPDATE_CORPUS.trim();
      if (why.length < 10 || /^(1|true|yes|sí)$/i.test(why)) throw new Error('UPDATE_CORPUS takes the reason of the change, e.g. UPDATE_CORPUS="decisión 16: …"');
      console.log(`Ratchet del corpus (desarrollo), antes → después:\n${RATCHET_ROWS.map(r => `- ${r.row}: ${frac(old && old.dev[r.row])} → ${frac(now[r.row])}`).join('\n')}`);
      const out = { updated: new Date().toISOString().slice(0, 10), why, units, dev: now, testFloor: old ? old.testFloor : null };
      fs.writeFileSync(FIXTURE, JSON.stringify(out, null, 1) + '\n');
      return;
    }
    expect(old, 'no ratchet.json: create it with UPDATE_CORPUS="<reason>"').toBeTruthy();
    expect(units, 'the development set changed').toEqual(old.units);
    const worse = [];
    for (const r of RATCHET_ROWS) {
      const was = old.dev[r.row], is = now[r.row];
      expect(is, `row ${r.row} not measured`).toBeTruthy();
      const d = cmp(r, was, is);
      if (d > 0) console.log(`mejoró ${r.row} de ${was.ok}/${was.n} a ${is.ok}/${is.n}; fíjalo con UPDATE_CORPUS`);
      if (d < 0) worse.push(`empeoró ${r.row} de ${frac(was)} a ${frac(is)}`);
    }
    expect(worse, 'a development figure got worse; if it is on purpose, regenerate with UPDATE_CORPUS="<reason>"').toEqual([]);
  }, 60000);
});
