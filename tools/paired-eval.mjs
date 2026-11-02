// Before and after on TAVERN, paired by work: runs evalTavern from another checkout (the «before», e.g. a git worktree of an
// earlier commit) and from this one, work by work, and prints each row with its 95 % interval and the paired Δ. Only the
// development works unless --test is given: the test works are looked at once, at the end of a stage. Not part of the suite:
//   git worktree add <dir> <commit>
//   node tools/paired-eval.mjs <dir> [--test] [filter]
const [dir, ...rest] = process.argv.slice(2);
if (!dir) { console.error('usage: node tools/paired-eval.mjs <checkout of the before> [--test] [filter]'); process.exit(1); }
const test = rest.includes('--test'), filter = rest.find(x => x !== '--test') || '';
const { pathToFileURL } = await import('node:url');
const path = await import('node:path');
const load = root => import(pathToFileURL(path.resolve(root, 'src/test/corpus-eval.js')).href);
const B = await load(dir), A = await load(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const pieces = A.listJson('tavern').filter(p => A.isTest(p.piece) === test);
const before = pieces.map(p => B.evalTavern([p]).T), after = pieces.map(p => A.evalTavern([p]).T);
const sum = (us, cat) => us.reduce((o, u) => { const c = u.cats.get(cat); if (c) { o.n += c.n; o.ok += c.ok; } return o; }, { n: 0, ok: 0 });
const ciB = A.bootstrapCI(before), ciA = A.bootstrapCI(after), d = A.bootstrapDiff(before, after);
const pct = c => (c.n ? (100 * c.ok / c.n).toFixed(1) : '-');
console.log(`${test ? 'PRUEBA' : 'desarrollo'}: ${pieces.length} obras`);
for (const cat of Object.keys(d).filter(c => c.includes(filter))) {
  const b = sum(before, cat), a = sum(after, cat), delta = b.n && a.n ? (100 * (a.ok / a.n - b.ok / b.n)).toFixed(1) : '-';
  console.log(`${cat}\n   ${pct(b)} % (${b.ok}/${b.n}; ${ciB[cat]}) → ${pct(a)} % (${a.ok}/${a.n}; ${ciA[cat]})   Δ ${delta} (${d[cat][0]} a ${d[cat][1]})`);
}
