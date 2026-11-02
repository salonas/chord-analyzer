// One part of the development evaluation of the ratchet (src/corpus.ratchet.test.js), run in a worker thread: with i >= 0, the
// TAVERN works i, i + n, i + 2n… of the development set; with i = -1, the development songs of the Rock Corpus. Never the test set.
import { parentPort, workerData } from 'node:worker_threads';
import { evalRock, evalTavern, isTest, listJson } from './corpus-eval.js';

const { i, n } = workerData;
const rock = i < 0;
const units = rock ? listJson('rock').filter(s => !isTest(s.song)) : listJson('tavern').filter(p => !isTest(p.piece)).filter((p, k) => k % n === i);
const { T } = rock ? evalRock(units) : evalTavern(units);
parentPort.postMessage({ set: rock ? 'rock' : 'tavern', names: units.map(u => (rock ? u.song : u.piece)), cats: [...T.cats] });
