// One part of the exhaustive spelling test (src/spelling.test.js), run in a worker thread: the jobs i, i + n, i + 2n… of the list
// of [type, key, preference] (key -1: no key, the library), each over the twelve roots, on the exported text and the .mid markers.
import { parentPort, workerData } from 'node:worker_threads';
import { TYPES } from '../data.js';
import { Fails, KEYS, PREFS, libraryChord, textAndMarkers } from './spelling-check.js';

const { i, n } = workerData;
const F = new Fails(), roots = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const jobs = [];
TYPES.forEach((t, ti) => KEYS.forEach((key, ki) => PREFS.forEach((p, pi) => jobs.push([ti, ki, pi]))));
// the patterns read in another key than the one they were built for, and the key names they were given
const otherKey = [], keyNames = {};
jobs.filter((_, j) => j % n === i).forEach(([ti, ki, pi]) => {
  const t = TYPES[ti], key = KEYS[ki], prefs = PREFS[pi];
  if (!key) { roots.forEach(r => libraryChord(F, t, r, r % t.degs.length, prefs)); return; }
  const k = textAndMarkers(F, t, key, prefs, roots);
  if (!k.sameKey) otherKey.push(`${t.sym || 'mayor'} · ${prefs.accPref} · construido en ${KEYS[ki].tonic}/${KEYS[ki].mode}, leído en ${k.keyLine}`);
  (keyNames[`${KEYS[ki].tonic} ${KEYS[ki].mode} ${prefs.accPref}`] ||= new Set()).add(k.keyLine);
});
parentPort.postMessage({ list: F.list, kept: F.kept, checked: F.checked, jobs: jobs.filter((_, j) => j % n === i).length, otherKey, keyNames: Object.fromEntries(Object.entries(keyNames).map(([k, v]) => [k, [...v]])) });
