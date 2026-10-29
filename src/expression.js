// Expression by feeling and instrument; the figures are heuristics.
import { INSTRUMENTS, T } from './data.js';
import { hash01, progEnd, segStep, segs } from './model.js';
import { analyze, analyzeProgression, noteText, plainSpell } from './analysis.js';
import { tr } from './i18n.js';

// ---------- expression ----------
// Starting points per feeling; heuristics, not measurements. Fields: base, range %, voice, accent, arc, phrase (bars, 0 = whole pattern), arcAmt, contour, tension, apoy, cad, human, art %
const FEELINGS={
  neutro:  {get label(){return tr('Neutro','Neutral');},                        p:{base:90, range:100,voice:14,accent:10,arc:'flat', phrase:4,arcAmt:0, contour:0,tension:0,  apoy:0, cad:0,  human:4,art:100}},
  tierno:  {get label(){return tr('Tierno','Tender');},                         p:{base:62, range:70, voice:16,accent:4, arc:'arch', phrase:4,arcAmt:12,contour:6,tension:-6, apoy:8, cad:-8, human:3,art:100}},
  triste:  {get label(){return tr('Triste / melancólico','Sad / melancholic');},p:{base:56, range:60, voice:12,accent:3, arc:'dim',  phrase:4,arcAmt:14,contour:5,tension:6,  apoy:12,cad:-12,human:3,art:100}},
  alegre:  {get label(){return tr('Alegre','Happy');},                          p:{base:96, range:120,voice:12,accent:16,arc:'flat', phrase:2,arcAmt:0, contour:6,tension:0,  apoy:4, cad:6,  human:5,art:75}},
  epico:   {get label(){return tr('Épico / triunfal','Epic / triumphant');},    p:{base:100,range:130,voice:18,accent:14,arc:'cresc',phrase:8,arcAmt:22,contour:6,tension:10, apoy:6, cad:16, human:3,art:100}},
  tenso:   {get label(){return tr('Tenso / inquietante','Tense / unsettling');},p:{base:72, range:140,voice:6, accent:6, arc:'cresc',phrase:4,arcAmt:16,contour:0,tension:16, apoy:10,cad:-4, human:9,art:85}},
  agresivo:{get label(){return tr('Agresivo','Aggressive');},                   p:{base:112,range:110,voice:8, accent:18,arc:'flat', phrase:4,arcAmt:0, contour:0,tension:8,  apoy:2, cad:8,  human:6,art:60}},
  sereno:  {get label(){return tr('Sereno','Serene');},                         p:{base:68, range:50, voice:10,accent:2, arc:'arch', phrase:8,arcAmt:6, contour:3,tension:-4, apoy:4, cad:-4, human:2,art:100}},
};
const EX_KEYS=['base','range','voice','accent','arc','phrase','arcAmt','contour','tension','apoy','cad','human','art'];
const exDefaults=key=>({preset:key,...FEELINGS[key].p,artOn:FEELINGS[key].p.art<100});
const instLabel=i=>i&&INSTRUMENTS[i.preset]?INSTRUMENTS[i.preset].label:tr('Personalizado','Custom');
function instText(i,prefs){
  const lo=noteText(plainSpell(i.lowPivot,prefs),prefs), hi=noteText(plainSpell(i.highPivot,prefs),prefs);
  return tr(`${instLabel(i)} · velocity ${i.min}–${i.max} · sensibilidad ${i.sens} % · acentos ${i.accent} % · humanizar ${i.human} % · recorte de graves ${i.lowTrim}/octava bajo ${lo} · recorte de agudos ${i.highTrim}/octava sobre ${hi}`,
    `${instLabel(i)} · velocity ${i.min}–${i.max} · sensitivity ${i.sens} % · accents ${i.accent} % · humanize ${i.human} % · low trim ${i.lowTrim}/octave below ${lo} · high trim ${i.highTrim}/octave above ${hi}`);
}
// p.expr.scope is stored in Spanish («todas» or «N seleccionadas») and translated when shown
const scopeText=sc=>tr(sc,sc==='todas'?'all':String(sc).replace(/^(\d+) seleccionadas$/,'$1 selected'));
function exprSummary(e){
  const il=e.inst?tr(` en ${instLabel(e.inst)}`,` on ${instLabel(e.inst)}`):'';
  if(e.flat) return tr(`todo a la base (${e.base})${il}`,`all at the base (${e.base})${il}`);
  const lab=(e.preset==='custom'?tr('Personalizado','Custom'):(FEELINGS[e.preset]||{label:e.preset}).label)+il+(e.drums?tr(' · reglas de batería',' · drum rules'):'');
  const arc=tr({flat:'plano',cresc:'crescendo',dim:'diminuendo',arch:'arco'},{flat:'flat',cresc:'crescendo',dim:'diminuendo',arch:'arch'})[e.arc];
  const ph=e.phrase?tr(`${e.phrase} ${e.phrase>1?'compases':'compás'}`,`${e.phrase} bar${e.phrase>1?'s':''}`):tr('todo el pattern','the whole pattern');
  const arcT=e.arc!=='flat'?tr(` ${e.arcAmt} en ${ph}`,` ${e.arcAmt} over ${ph}`):'', sc=scopeText(e.scope);
  if(e.drums) return tr(`${lab} · base ${e.base} · contraste ${e.range} % · acento ${e.accent} · ${arc}${arcT} · humanizar ±${e.human} (semilla ${e.seed}) · golpes: ${sc}`,
    `${lab} · base ${e.base} · contrast ${e.range} % · accent ${e.accent} · ${arc}${arcT} · humanize ±${e.human} (seed ${e.seed}) · hits: ${sc}`);
  return tr(`${lab} · base ${e.base} · contraste ${e.range} % · voces ${e.voice} · acento ${e.accent} · ${arc}${arcT} · contorno ${e.contour} · tensión armónica ${e.tension} · apoyaturas ${e.apoy} · cadencia ${e.cad} · humanizar ±${e.human} (semilla ${e.seed})${e.artOn?` · articulación ${e.art} %`:''} · notas: ${sc}`,
    `${lab} · base ${e.base} · contrast ${e.range} % · voices ${e.voice} · accent ${e.accent} · ${arc}${arcT} · contour ${e.contour} · harmonic tension ${e.tension} · appoggiaturas ${e.apoy} · cadence ${e.cad} · humanize ±${e.human} (seed ${e.seed})${e.artOn?` · articulation ${e.art} %`:''} · notes: ${sc}`);
}
// Sets velocity (and articulation) on the notes ns of pattern p; returns how many were shaped as appoggiatura or passing tone
function expressPattern(p,ns,E,seed,flat,prefs){
  const I=p.inst;
  const S=segs(p), A=analyzeProgression(S.map(x=>segStep(p,x)),prefs);
  const onset=new Map(); p.notes.forEach(n=>{ if(!onset.has(n.s)) onset.set(n.s,[]); onset.get(n.s).push(n); });
  onset.forEach(g=>g.sort((a,b)=>a.m-b.m));
  const melody=[...onset.keys()].sort((a,b)=>a-b).map(s=>{const g=onset.get(s); return g[g.length-1];});
  const melSet=new Set(melody.map(n=>n.id));
  const mels=melody.map(n=>n.m).sort((a,b)=>a-b), med=mels.length?mels[Math.floor(mels.length/2)]:60;
  // Melody notes outside the chord sounding under them: appoggiatura (strong beat, resolves by step) or passing tone (off the beat)
  const nct=new Map();
  melody.forEach((n,i)=>{
    const acc=[...new Set(p.notes.filter(k=>k!==n&&k.s<=n.s&&k.s+k.l>n.s).map(k=>k.m))].sort((a,b)=>a-b);
    if(new Set(acc.map(m=>m%12)).size<2) return;
    const c=analyze(acc,null)[0]; if(!c) return;
    if(new Set(c.type.degs.map(d=>(d.pc+c.root)%12)).has(n.m%12)) return;
    const nx=melody[i+1], strong=n.s%T===0;
    if(strong&&nx&&nx.m!==n.m&&Math.abs(nx.m-n.m)<=2){ nct.set(n.id,(nct.get(n.id)||0)+1); nct.set(nx.id,(nct.get(nx.id)||0)-.5); }
    else if(!strong) nct.set(n.id,(nct.get(n.id)||0)-.3);
  });
  const phraseLen=E.phrase?E.phrase*4*T:Math.max(1,progEnd(p));
  const lastSeg=S.length-1, cadOK=!!(A&&A.cad)&&S.length>=2;
  const segIdx=t=>S.findIndex(x=>t>=x.a&&t<x.b);
  let napp=0;
  ns.forEach(n=>{
    let v=E.base;
    if(!flat){
      let dev=0;
      const g=onset.get(n.s), i=g.indexOf(n);
      if(g.length>=2){ if(i===g.length-1) dev+=E.voice; else if(i===0) dev+=E.voice*.35; else dev-=E.voice*.5; }
      const pos=n.s%(4*T), ia=I.accent/100; if(pos===0) dev+=E.accent*ia; else if(pos===2*T) dev+=E.accent*.5*ia; else if(pos%T!==0) dev-=E.accent*.6*ia;
      const x=(n.s%phraseLen)/phraseLen;
      if(E.arc==='cresc') dev+=E.arcAmt*(x-.5); else if(E.arc==='dim') dev+=E.arcAmt*(.5-x); else if(E.arc==='arch') dev+=E.arcAmt*(Math.sin(Math.PI*x)-.5);
      if(melSet.has(n.id)) dev+=E.contour*(n.m-med)/12;
      const si=segIdx(n.s);
      if(si>=0&&A&&A.ten) dev+=E.tension*(A.ten[si]-.4)*2;
      if(cadOK&&si===lastSeg) dev+=E.cad;
      if(nct.has(n.id)){ dev+=E.apoy*nct.get(n.id); napp++; }
      const reg=(n.m<I.lowPivot?I.lowTrim*(I.lowPivot-n.m)/12:0)+(n.m>I.highPivot?I.highTrim*(n.m-I.highPivot)/12:0);
      v=E.base+(E.range/100)*(I.sens/100)*dev+Math.round((hash01(seed,n.m,n.s)*2-1)*E.human*I.human/100)-reg;
    }
    // scale the 1–127 result into the instrument's window instead of clipping it, so nothing flattens at the edges
    const raw=Math.min(127,Math.max(1,v));
    n.v=Math.round(I.min+(raw-1)*(I.max-I.min)/126);
    // articulation keeps the drawn length in l0 so applying again does not shorten twice
    if(!flat&&E.artOn){ const b=n.l0??n.l; n.l0=b; n.l=Math.max(Math.round(T/16),Math.round(b*E.art/100)); }
    else if(n.l0!=null){ n.l=n.l0; delete n.l0; }
  });
  p.expr={...E,flat:!!flat,seed,inst:{...I},scope:ns.length===p.notes.length?'todas':`${ns.length} seleccionadas`};
  return napp;
}

export { EX_KEYS, FEELINGS, exDefaults, exprSummary, expressPattern, instLabel, instText };
