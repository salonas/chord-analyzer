import fs from 'node:fs';
import { caseKey, results, texts } from './test/theory-cases.js';

const FIXTURE = new URL('./test/fixtures/theory/passing.json', import.meta.url);
const passing = () => results.filter(r => r.pass).map(caseKey).sort();

// Ratchet: every check that passed when the list was last regenerated must keep passing.
// Regenerate on purpose, after reviewing each difference: UPDATE_THEORY=1 npx vitest run src/theory.test.js
describe('theory probe', () => {
  if (process.env.UPDATE_THEORY) {
    it('writes the baseline', () => {
      fs.writeFileSync(FIXTURE, JSON.stringify(passing(), null, 1) + '\n');
      fs.writeFileSync(new URL('./test/fixtures/theory/texts.json', import.meta.url), JSON.stringify(texts, null, 1) + '\n');
    });
    return;
  }
  const must = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const byKey = new Map(results.map(r => [caseKey(r), r]));
  it.each(must)('%s', k => {
    const r = byKey.get(k);
    expect(r, 'case no longer exists').toBeTruthy();
    expect(r.actual, r.desc).toSatisfy(() => r.pass);
  });
  it('does not drop below the recorded count', () => {
    expect(passing().length).toBeGreaterThanOrEqual(must.length);
  });
});
