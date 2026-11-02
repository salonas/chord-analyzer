// Dev-only look at the row «inversión (dado el acorde correcto)» between two checkouts (session of 2026-11-02): the row is
// conditional, so a drop can come from stretches that kept their chord and lost the inversion (a regression) or from
// stretches that gained the chord with the inversion wrong (the denominator grew). This pairs the stretches one by one,
// by annotated stretch and end to end, work by work, with examples. It measures, changes nothing, and is not part of the
// suite:
//   node tools/inversion-diff.mjs <checkout of the before> [examples]
const [dir, ex] = process.argv.slice(2);
if (!dir) { console.error('usage: node tools/inversion-diff.mjs <checkout of the before> [examples]'); process.exit(1); }
const { pathToFileURL } = await import('node:url');
const path = await import('node:path');
const here = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const load = async root => {
  const u = rel => import(pathToFileURL(path.resolve(root, 'src', rel)).href);
  const [E, An, Hm, M] = await Promise.all([u('test/corpus-eval.js'), u('analysis.js'), u('harmony.js'), u('model.js')]);
  return { E, An, Hm, M };
};
const B = await load(dir), A = await load(here);
const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const INV = ['fund', '1ª', '2ª', '3ª', 'otra'];
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const ov = (x, y) => Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));
const best = (s, os) => { let b = null, bo = 0; for (const o of os) { const v = ov(s, o); if (v > bo) { bo = v; b = o; } } return b; };
const chordOf = r => {
  const c = r && r.c; if (!c) return null;
  const d = c.type.degs.find(x => x.pc === (c.bass - c.root + 12) % 12);
  const inv = !c.slash ? 0 : d && d.n === 3 ? 1 : d && d.n === 5 ? 2 : d && d.n === 7 ? 3 : 4;
  return { root: c.root, q: c.type.q, sym: c.type.sym, seventh: isSeventh(c.type.sym), inv };
};
const stepOf = (notes, a, b) => { const on = notes.filter(n => n[1] < b && n[1] + n[2] > a), ms = [...new Set(on.map(n => n[0]))].sort((x, y) => x - y); return ms.length ? { notes: ms, dur: b - a, a, evs: on.map(n => ({ m: n[0], s: n[1], l: n[2] })) } : null; };

// {key: {hit, inv, show}} for every converted stretch of a phrase, by stretch and end to end, as corpus-eval scores them
function readPhrase(L, ph) {
  const out = new Map();
  const pat = L.M.normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
  const app = L.Hm.harmonySegs(pat), appA = app.length ? L.An.analyzeProgression(app.map(S => L.M.segStep(pat, S)), P) : null;
  for (const who of ['A', 'B']) {
    const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'], idx = [], st = [];
    mine.forEach((s, i) => { const x = stepOf(ph.notes, s.a, s.b); if (x) { idx.push(i); st.push(x); } });
    const PT = new Map(); if (st.length) { const R = L.An.analyzeProgression(st, P); idx.forEach((si, j) => PT.set(si, R.rs[j])); }
    mine.forEach((s, si) => {
      if (!s.exp) return;
      const o = best(s, theirs), exps = [s.exp, ...(o && o.exp ? [o.exp] : [])];
      const score = ch => ({ hit: !!ch && exps.some(x => ch.root === x.root && ch.q === x.quality && ch.seventh === x.seventh), inv: !!ch && exps.some(x => x.inv === ch.inv), show: ch ? NAMES[ch.root] + ch.sym + '/' + INV[ch.inv] : '-', exp: NAMES[s.exp.root] + '/' + INV[s.exp.inv] });
      const k = app.reduce((b, c, i) => (ov(s, c) > (b < 0 ? 0 : ov(s, app[b])) ? i : b), -1);
      const covered = !!appA && k >= 0 && ov(s, app[k]) * 2 >= s.b - s.a;
      out.set(`por tramo|${who}|${si}`, score(chordOf(PT.get(si))));
      out.set(`de punta a punta|${who}|${si}`, score(covered ? chordOf(appA.rs[k]) : null));
    });
  }
  return out;
}

const pieces = A.E.listJson('tavern').filter(p => !A.E.isTest(p.piece));
const tot = {}, EX = [];
const bump = (mode, piece, k) => { const t = (tot[mode] = tot[mode] || {}); (t[piece] = t[piece] || {})[k] = (t[piece][k] || 0) + 1; (t.total = t.total || {})[k] = (t.total[k] || 0) + 1; };
for (const piece of pieces) for (const ph of piece.phrases) {
  const rb = readPhrase(B, ph), ra = readPhrase(A, ph);
  for (const [key, a] of ra) {
    const b = rb.get(key), mode = key.split('|')[0];
    if (!b) continue;
    if (b.hit && a.hit) {
      bump(mode, piece.piece, 'acorde bien en los dos');
      if (b.inv && !a.inv) { bump(mode, piece.piece, 'inversión bien → mal'); if (ex && EX.length < 30 && mode === ex) EX.push({ ph: ph.id, key, exp: a.exp, antes: b.show, despues: a.show }); }
      if (!b.inv && a.inv) bump(mode, piece.piece, 'inversión mal → bien');
    } else if (!b.hit && a.hit) { bump(mode, piece.piece, 'acorde ganado'); if (!a.inv) bump(mode, piece.piece, 'acorde ganado, inversión mal'); }
    else if (b.hit && !a.hit) { bump(mode, piece.piece, 'acorde perdido'); if (!b.inv) bump(mode, piece.piece, 'acorde perdido, inversión mal'); }
  }
}
const K = ['acorde bien en los dos', 'inversión bien → mal', 'inversión mal → bien', 'acorde ganado', 'acorde ganado, inversión mal', 'acorde perdido', 'acorde perdido, inversión mal'];
for (const [mode, t] of Object.entries(tot)) {
  console.log(`\n== ${mode} (desarrollo)\n   obra: ${K.join(' | ')}`);
  for (const [piece, c] of Object.entries(t)) console.log(`   ${piece}: ${K.map(k => c[k] || 0).join(' | ')}`);
}
if (EX.length) console.log(JSON.stringify(EX, null, 0).replace(/\},\{/g, '},\n{'));
