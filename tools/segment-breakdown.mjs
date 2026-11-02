// Dev-only breakdown of the end-to-end chord failures on the TAVERN development works (session of 2026-11-02, run
// against main 52a2eea): uncovered stretches, cuts in another place, wrong root with the right cut, with examples and the
// per-stretch reading of each group. It measures, changes nothing, and is not part of the suite:
//   node tools/segment-breakdown.mjs
const R = new URL('../src/', import.meta.url).href;
const { isTest, listJson } = await import(R + 'test/corpus-eval.js');
const { analyzeProgression } = await import(R + 'analysis.js');
const { harmonySegs, splitHarmony } = await import(R + 'harmony.js');
const { normProg, segStep } = await import(R + 'model.js');

const P = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const pc = x => NAMES[((x % 12) + 12) % 12];
const isSeventh = sym => sym.includes('7') || /^(m|maj)?(9|11|13)/.test(sym);
const expSym = e => (e.seventh ? ({ maj: 'maj7', min: 'm7', dom: '7', hdim: 'm7b5', dim: 'dim7' })[e.quality] : ({ maj: '', min: 'm', dim: 'dim', aug: 'aug' })[e.quality]);
const ov = (x, y) => Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));
const best = (s, os) => { let b = null, bo = 0; for (const o of os) { const v = ov(s, o); if (v > bo) { bo = v; b = o; } } return b; };
const appChord = r => { const c = r && r.c; return c ? { root: c.root, q: c.type.q, sym: c.type.sym, seventh: isSeventh(c.type.sym) } : null; };
const hitOf = (ch, exps) => !!ch && exps.some(x => ch.root === x.root && ch.q === x.quality && ch.seventh === x.seventh);
const rootOf = (ch, exps) => !!ch && exps.some(x => ch.root === x.root);

const pieces = listJson('tavern').filter(p => !isTest(p.piece));
const PH = {}; const C = {}, EX = {}, add = (k, ex) => { C[k] = (C[k] || 0) + 1; if (ex && 'pt' in ex) { PH[k]=(PH[k]||0)+(ex.pt?1:0); } (EX[k] = EX[k] || []).length < 400 && EX[k].push(ex); };
let total = 0, mode = { arp: 0, block: 0, general: 0 };
const segMode = {};
for (const piece of pieces) for (const ph of piece.phrases) {
  const pat = normProg({ id: 'x', name: ph.id, beats: Math.max(1, Math.ceil(ph.end / 96)), notes: ph.notes.map((n, i) => ({ id: 'n' + i, m: n[0], s: n[1], l: n[2], v: 100 })), names: {} });
  const H = splitHarmony(pat), app = harmonySegs(pat);
  const md = H.mel.length === 0 && H.top.length === 0 ? (H.role && [...H.role.values()].every(r => r === 'harm') ? 'arp/block' : 'block') : 'general';
  const stepOf=(a,b)=>{const on=ph.notes.filter(n=>n[1]<b&&n[1]+n[2]>a),ms=[...new Set(on.map(n=>n[0]))].sort((x,y)=>x-y);return ms.length?{notes:ms,dur:b-a,a,evs:on.map(n=>({m:n[0],s:n[1],l:n[2]}))}:null;};
  const PT={};
  for(const who of ['A','B']){const mine=ph.segs[who],idx=[],st=[];mine.forEach((s,i)=>{const x=stepOf(s.a,s.b);if(x){idx.push(i);st.push(x);}});if(st.length){const AA=analyzeProgression(st,P);idx.forEach((si,j)=>{PT[who+si]=AA.rs[j];});}}
  const firstA = app.length ? app[0].a : null;
  const A = app.length ? analyzeProgression(app.map(S => segStep(pat, S)), P) : null;
  for (const who of ['A', 'B']) {
    const mine = ph.segs[who], theirs = ph.segs[who === 'A' ? 'B' : 'A'];
    for (const s of mine.filter(x => x.exp)) {
      total++;
      const o = best(s, theirs), exps = [s.exp, ...(o && o.exp ? [o.exp] : [])];
      const len = s.b - s.a;
      const overl = app.map((c, i) => ({ i, v: ov(s, c) })).filter(x => x.v > 0);
      const k = overl.reduce((b, x) => (!b || x.v > b.v ? x : b), null);
      const ptHit = hitOf(appChord(PT[who+mine.indexOf(s)]), exps);
      const base = { pt: ptHit, ph: ph.id, who, label: s.label, key: ph.key.token, exp: pc(s.exp.root) + expSym(s.exp), span: [s.a, s.b], md };
      segMode[md] = (segMode[md] || 0) + 1;
      if (!A) { add('U0a frase sin ningún acorde de la app (fuera del reporte)', { ...base, app: [] }); continue; }
      if (!k) { add(s.b <= firstA + 48 ? 'U0b antes del primer acorde de la app' : 'U0c hueco entre acordes de la app', { ...base, app: [], first: firstA }); continue; }
      const show = i => { const ch = appChord(A.rs[i]); return `${app[i].a}-${app[i].b}:${ch ? pc(ch.root) + ch.sym : '-'}`; };
      if (k.v * 2 < len) {
        // uncovered: classify why
        const chs = overl.map(x => appChord(A.rs[x.i]));
        const anyHit = chs.some(ch => hitOf(ch, exps));
        // would merging the overlapping app segs that read the expected chord cover half?
        const hitCover = overl.filter(x => hitOf(appChord(A.rs[x.i]), exps)).reduce((s2, x) => s2 + x.v, 0);
        const sub = overl.length >= 2 ? 'U1 partido en varios acordes de la app' : 'U2 un acorde de la app lo cubre a medias (corte corrido)';
        add(sub, { ...base, n: overl.length, maxFrac: +(k.v / len).toFixed(2), anyHit, hitCover: +(hitCover / len).toFixed(2), app: overl.map(x => show(x.i)) });
        add(sub + (anyHit ? ' | algún trozo tiene el acorde esperado' : ' | ningún trozo tiene el acorde'), null);
        if (hitCover * 2 >= len) add('U* juntar trozos con el acorde esperado cubriría ≥ la mitad', null);
        continue;
      }
      const c = app[k.i], ch = appChord(A.rs[k.i]);
      const aligned = Math.abs(c.a - s.a) <= 48 && Math.abs(c.b - s.b) <= 48;
      const ex = { ...base, app: show(k.i), aligned, notes: c.notes.map(pc).join(' ') };
      if (!ch) { add('N cubierto pero la app no da acorde', ex); continue; }
      if (hitOf(ch, exps)) { add('OK', {pt:ptHit}); add(aligned ? 'OK alineado' : 'OK corte en otro lugar', null); continue; }
      if (!aligned) add('X corte en otro lugar (cubierto, acorde mal)', ex);
      else if (rootOf(ch, exps)) add('Q corte bien, raíz bien, calidad mal', ex);
      else add('R corte bien, raíz mal', ex);
      if (!aligned) add('X | ' + (rootOf(ch, exps) ? 'raíz bien' : 'raíz mal') + (c.b - c.a > len + 48 ? ', app más larga' : c.b - c.a < len - 48 ? ', app más corta' : ', mismo largo corrido'), null);
    }
  }
}
console.log('dev works', pieces.length, 'analyst segs', total, 'modes', segMode);
for (const k of Object.keys(C).sort()) console.log(String(C[k]).padStart(6), (100 * C[k] / total).toFixed(1).padStart(5) + '%', k, k in PH ? ' | por tramo acierta ' + PH[k] + ' (' + (100*PH[k]/C[k]).toFixed(0) + '%)' : '');
const pick = (k, n = 3) => { const xs = EX[k] || []; const step = Math.max(1, Math.floor(xs.length / n)); return [0, 1, 2].map(i => xs[i * step]).filter(Boolean); };
for (const k of Object.keys(EX)) if (EX[k][0]) { console.log('\n##', k); pick(k).forEach(e => console.log(JSON.stringify(e))); }
