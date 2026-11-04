// The spelling property (THEORY.md, «Escritura de notas»; decided 4 Nov 2026 from BRIMSTONE pattern 3): every chord tone the app
// writes takes the letter of its interval number above the letter of the root it names, with at most a double accidental. Checked
// for every type of the dictionary on the twelve roots, with the three accidental preferences, without a key and in every major
// and minor key, on the inspector (chips and «Posibles nombres», every inversion), the exported text and the .mid markers.
// The text and the markers go through the whole export, so they run in worker threads (src/test/spelling-shard.js).
// In a key, a chord tone that is a note of the key's scale may keep the key's letter (the class kept as it was, pending: THEORY.md,
// «Escritura de notas»); those notes are counted apart, not as failures. SPELLING_OUT=<file.json> writes the failures and the
// notes kept by the key, counted by interval and surface, for a report.
import fs from 'node:fs';
import os from 'node:os';
import { Worker } from 'node:worker_threads';
import { TYPES } from './data.js';
import { Fails, KEYS, PREFS, inspector, readVoicing } from './test/spelling-check.js';

const THREADS = Math.min(8, os.availableParallelism());
const count = (list, by) => list.reduce((o, f) => { const k = by(f); o[k] = (o[k] || 0) + 1; return o; }, {});
const sample = (list, n) => { const seen = new Map(); list.forEach(f => { const k = `${f.surface}|${f.interval}`; if (!seen.has(k)) seen.set(k, []); if (seen.get(k).length < n) seen.get(k).push(f); }); return [...seen.values()].flat(); };

describe('spelling: the letter of every chord tone comes from the root and the number of its interval', () => {
  const all = [], kept = [];
  let checked = 0;
  it('the inspector, every type on every root, every inversion, preference and key', () => {
    const F = new Fails();
    for (const t of TYPES) for (let r = 0; r < 12; r++) for (let k = 0; k < t.degs.length; k++) {
      const V = readVoicing(t, r, k);
      for (const prefs of PREFS) for (const key of KEYS) inspector(F, V, prefs, key);
    }
    F.list.forEach(f => all.push(f)); F.kept.forEach(f => kept.push(f)); checked += F.checked;
    expect(F.list.length, `${F.list.length} notas mal escritas de ${F.checked}; por intervalo: ${JSON.stringify(count(F.list, f => f.interval))}`).toBe(0);
  });
  it('the exported text and the .mid markers, every type on every root, preference and key', async () => {
    const run = i => new Promise((resolve, reject) => {
      const w = new Worker(new URL('./test/spelling-shard.js', import.meta.url), { workerData: { i, n: THREADS } });
      w.once('message', resolve);
      w.once('error', reject);
    });
    const parts = await Promise.all(Array.from({ length: THREADS }, (_, i) => run(i)));
    const list = parts.flatMap(p => p.list), otherKey = parts.flatMap(p => p.otherKey);
    list.forEach(f => all.push(f)); parts.forEach(p => p.kept.forEach(f => kept.push(f))); checked += parts.reduce((s, p) => s + p.checked, 0);
    expect(parts.reduce((s, p) => s + p.jobs, 0)).toBe(TYPES.length * KEYS.length * PREFS.length);
    if (process.env.SPELLING_OUT) {
      const keyNames = Object.assign({}, ...parts.map(p => p.keyNames));
      fs.writeFileSync(process.env.SPELLING_OUT, JSON.stringify({
        checked, failures: all.length, kept: kept.length, keptByInterval: count(kept, f => f.interval), keptBySurface: count(kept, f => f.surface),
        keptBySurfaceInterval: count(kept, f => `${f.surface} | ${f.interval}`), keptExamples: sample(kept, 3),
        byInterval: count(all, f => f.interval), bySurface: count(all, f => f.surface), byPref: count(all, f => f.pref),
        bySurfaceInterval: count(all, f => `${f.surface} | ${f.interval}`), byPrefInterval: count(all, f => `${f.pref} | ${f.interval}`),
        byKey: count(all, f => f.key), otherKey, keyNames, examples: sample(all, 3),
      }, null, 1));
    }
    expect(list.length, `${list.length} notas mal escritas; por intervalo: ${JSON.stringify(count(list, f => f.interval))}`).toBe(0);
  }, 300000);
});
