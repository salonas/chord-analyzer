// Project and pattern model: notes in ticks; chords are derived from what sounds together.
import { INSTRUMENTS, T, guessInst, instDefaults, sigOf, uid } from './data.js';
import { tr } from './i18n.js';

// ---------- progression model: notes in ticks; chords are derived ----------
function blocksToNotes(blocks){ // [{notes, beats, root, sym}]
  const notes=[], names={}; let t=0;
  blocks.forEach(b=>{ const L=Math.max(1,Math.round((b.beats||4)*T)); [...new Set(b.notes)].forEach(m=>notes.push({id:uid(),m,s:t,l:L,v:100})); if(b.root!=null) names[sigOf(b.notes)]={root:b.root,sym:b.sym}; t+=L; });
  return {notes,names};
}
function normProg(p){
  if(!p) return p;
  if(!Array.isArray(p.notes)){ const r=blocksToNotes((p.steps||[]).map(s=>({...s,beats:s.beats||p.beats||4}))); p.notes=r.notes; p.names={...r.names,...(p.names||{})}; delete p.steps; }
  p.notes.forEach(n=>{ n.v=Math.min(127,Math.max(1,Math.round(n.v||100))); });
  p.names=p.names||{}; p.beats=p.beats||4; p.v=2;
  if(!p.inst||!(p.inst.preset in INSTRUMENTS||p.inst.preset==='custom')) p.inst=instDefaults(guessInst(p.name)||'generico');
  return p;
}
// A project holds the tempo, the humanize seed and its patterns (each pattern is a note list)
const newSeed=()=>(Math.random()*4294967296)>>>0;
function hashStr(s){let h=2166136261; for(const ch of String(s)){h^=ch.charCodeAt(0); h=Math.imul(h,16777619);} return h>>>0;}
const newPattern=(name,beats)=>normProg({id:uid(),name,beats:beats||4,notes:[],names:{}});
function normProject(pr){
  if(!pr) return pr;
  if(!Array.isArray(pr.patterns)){
    const pat=normProg(JSON.parse(JSON.stringify({...pr,id:uid(),name:'Pattern 1'})));
    pr={id:pr.id||uid(),name:pr.name||'',bpm:pr.bpm||90,seed:hashStr(pr.id||uid()),patterns:[pat],active:pat.id};
  }
  pr.patterns=pr.patterns.map(normProg);
  if(!pr.patterns.length) pr.patterns.push(newPattern('Pattern 1'));
  pr.bpm=pr.bpm||90; pr.seed=(pr.seed>>>0)||newSeed(); pr.v=3;
  if(!pr.patterns.some(p=>p.id===pr.active)) pr.active=pr.patterns[0].id;
  return pr;
}
const activePat=pr=>pr.patterns.find(p=>p.id===pr.active)||pr.patterns[0];
// Deterministic 0..1 value from the project seed and a note's pitch and position
function hash01(...xs){ let h=2166136261>>>0; for(const x of xs){ h^=x>>>0; h=Math.imul(h,16777619)>>>0; h^=h>>>13; h=Math.imul(h,0x5bd1e995)>>>0; h^=h>>>15; } return (h>>>0)/4294967296; }
const progEnd=p=>p.notes.reduce((a,n)=>Math.max(a,n.s+n.l),0);
function segs(p){
  const ns=p.notes; if(!ns.length) return [];
  const pts=[...new Set(ns.flatMap(n=>[n.s,n.s+n.l]))].sort((a,b)=>a-b);
  const out=[];
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i], b=pts[i+1];
    const on=ns.filter(n=>n.s<b&&n.s+n.l>a); if(!on.length) continue;
    const ms=[...new Set(on.map(n=>n.m))].sort((x,y)=>x-y), sig=ms.join(',');
    const prev=out[out.length-1];
    if(prev&&prev.b===a&&prev.sig===sig&&!on.some(n=>n.s===a)){ prev.b=b; on.forEach(n=>prev.ids.add(n.id)); continue; }
    out.push({a,b,notes:ms,sig,ids:new Set(on.map(n=>n.id))});
  }
  return out;
}
function isBlock(p,S){ return [...S.ids].every(id=>{const n=p.notes.find(x=>x.id===id); return n&&n.s===S.a&&n.s+n.l===S.b;}); }
const segStep=(p,S)=>({notes:S.notes,...(p.names[S.sig]||{})});
function isPure(p,S){ return S.length&&S[0].a===0&&p.notes.every(n=>n.v===100&&!n.g)&&S.every((s,i)=>isBlock(p,s)&&(i===0||S[i-1].b===s.a)); }

const EXAMPLE_NAME=['Ejemplo: turnaround en Do','Example: turnaround in C'];
const EXAMPLE=()=>{
  const pat=normProg({id:uid(),name:'Turnaround',beats:4,steps:[
    {notes:[48,59,64,67],root:0,sym:'maj7',beats:4},{notes:[45,55,60,64],root:9,sym:'m7',beats:4},
    {notes:[50,60,65,69],root:2,sym:'m7',beats:2},{notes:[43,53,59,62],root:7,sym:'7',beats:2}]});
  return normProject({id:uid(),name:tr(...EXAMPLE_NAME),bpm:90,seed:20261027,patterns:[pat],active:pat.id});
};
function isDrum(p){ return !!(p&&p.inst&&p.inst.preset==='bateria'); }

export { EXAMPLE, EXAMPLE_NAME, activePat, hash01, isBlock, isDrum, isPure, newPattern, newSeed, normProg, normProject, progEnd, segStep, segs };
