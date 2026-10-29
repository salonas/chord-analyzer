// Text export and import (reimportable plain text).
import { HIGH, LATIN, LETTERS, LOW, NAT, OCT_CONV, T, barsText, fmtB, numB, sigOf, uid } from './data.js';
import { isDrum, isPure, normProg, progEnd, segStep, segs } from './model.js';
import { FN_NAME, PATTERNS, analyze, analyzeProgression, candSymbol, keyName, noteText, octOff, plainSpell, resolveStep, spellCandidate } from './analysis.js';
import { exprSummary, instLabel, instText } from './expression.js';
import { splitHarmony } from './harmony.js';
import { drumText } from './drums.js';
import { tr } from './i18n.js';
import { hasGlide, rangeOf } from './glide.js';

// ---------- text export / import ----------
function projHeader(pr,prefs){
  const np=`${pr.patterns.length} pattern${pr.patterns.length===1?'':'s'}`;
  return tr([`# Proyecto: ${pr.name||'Sin nombre'}`,`# ${pr.bpm} BPM · compás 4/4 · semilla de humanizar ${pr.seed} · ${np}`,`# Octavas: ${OCT_CONV[prefs.octConv].name}`],
    [`# Project: ${pr.name||'Untitled'}`,`# ${pr.bpm} BPM · 4/4 time · humanize seed ${pr.seed} · ${np}`,`# Octaves: ${OCT_CONV[prefs.octConv].name}`]).join('\n');
}
// "total 12 beats (3 bars)", in 4/4
const totalText=p=>{ const t=progEnd(p); return tr(`total ${fmtB(t)} tiempos`,`total ${fmtB(t)} beats`)+barsText(t); };
const velUsed=p=>{ const v=p.notes.map(n=>n.v||100); return v.length?[Math.min(...v),Math.max(...v)]:null; };
// chord names never carry an octave: a power chord is E(5), a lone note is "note: E4"
function chordLabel(r,prefs){
  if(r.c){ const sy=candSymbol(r.c,r.sp,prefs); return (r.c.type.sym==='5'?sy.main.replace(/5$/,'(5)'):sy.main)+sy.slash; }
  if(r.notes.length&&new Set(r.notes.map(m=>m%12)).size===1) return `${tr('nota','note')}: ${r.spelled.map(n=>noteText(n,prefs)).join('+')}${r.notes.length>1?tr(' (doblada)',' (doubled)'):''}`;
  return r.label;
}
const tenText=(r,x)=>r.c?numText(x):'—';
const numText=x=>tr(String(x).replace('.',','),String(x));
// a pattern that only closes when the pattern repeats says so: "ii–V (continúa en I al repetir)"
function foundText(f,N){
  const seq=f.wrap&&(PATTERNS.find(p=>p.name===f.name)||{}).seq;
  if(!seq) return f.name;
  const inside=N-f.from;
  return `${seq.slice(0,inside).join('–')} (${tr('continúa en','continues to')} ${seq.slice(inside).join('–')} ${tr('al repetir','when it repeats')})`;
}
const octTail=prefs=>tr(` — octavas: ${OCT_CONV[prefs.octConv].name}`,` — octaves: ${OCT_CONV[prefs.octConv].name}`);
// a melody note against the chord under it: interval from the root, tension and role
const OUT_DEG={0:'1',1:'♭9',2:'9',3:'♯9',4:'3',5:'4',6:'♯11',7:'5',8:'♭6',9:'13',10:'♭7',11:'7'};
function against(m,r){
  if(!r||!r.c) return null;
  // a degree the voicing leaves out (the 5 of C(no5)) still counts as a chord tone
  const degs=r.c.type.degs, rel=((m-r.c.root)%12+12)%12, d=degs.find(x=>x.pc===rel);
  if(d) return {iv:d.label,ten:d.n<=7?'low':'mid',tone:d.n<=7};
  // half a step above a chord tone clashes (♭9 over the root, 4 over a major 3rd)
  return {iv:OUT_DEG[rel],ten:degs.some(x=>x.pc===(rel+11)%12)?'high':'mid',tone:false};
}
const TEN_WORD={get low(){return tr('baja','low');},get mid(){return tr('media','mid');},get high(){return tr('alta','high');}};
// the melody tension in the same 0–1 scale as the chords, with its word: "alta (0,85)"
const TEN_VAL={low:.15,mid:.5,high:.85};
const melTen=f=>f?`${TEN_WORD[f.ten]} (${numText(TEN_VAL[f.ten])})`:'—';
// a note that is not in its chord but is in the next one, within two beats of the change, announces it
const ANTICIPATION=2*T;
function melodyRole(mel,i,info,toneAt,prefs,next){
  const k=info[i]; if(!k) return '—';
  if(k.tone) return tr('nota del acorde','chord tone');
  const m=mel[i].notes[0], pv=mel[i-1], nx=mel[i+1], d1=pv?m-pv.notes[0]:null, d2=nx?nx.notes[0]-m:null;
  const ahead=next&&next.r&&next.r.c&&mel[i].s<next.a&&mel[i].s>=next.a-ANTICIPATION&&against(m,next.r).tone;
  const step=x=>x!==null&&x!==0&&Math.abs(x)<=2;
  if(step(d1)&&step(d2)) return Math.sign(d1)===Math.sign(d2)?tr('paso','passing'):tr('bordadura','neighbor');
  if(step(d2)&&toneAt(i+1)) return `${tr('apoyatura','appoggiatura')} → ${noteText(plainSpell(nx.notes[0],prefs),prefs)}`;
  if(step(d1)) return tr('escapada','escape tone');
  if(ahead) return `${tr('anticipación','anticipation')} → ${next.label}`;
  return k.ten==='mid'?tr('tensión','tension'):tr('libre','free');
}
function harmonyLines(p,prefs,L){
  const Hm=splitHarmony(p);
  const A=analyzeProgression(Hm.chords.map(c=>({notes:c.notes,...(p.names[sigOf(c.notes)]||{})})),prefs);
  return {Hm,A,write(){
    const nt=m=>noteText(plainSpell(m,prefs),prefs);
    L.push(tr('# Armonía: n. acorde | grado (función · tensión 0–1) | inicio–fin (tiempos) | voces | bajo','# Harmony: n. chord | degree (function · tension 0–1) | start–end (beats) | voices | bass')+octTail(prefs));
    if(!Hm.chords.length) L.push(tr('— sin acordes','— no chords'));
    Hm.chords.forEach((c,i)=>{
      const r=A.rs[i], adds=c.adds.map(x=>`+${nt(x.m)} ${tr('en','at')} ${fmtB(x.s)}`).join(' · ');
      const bass=c.bass.map((x,j)=>(j===0?noteText(r.spelled[0],prefs):nt(x.m))+(x.pass?tr(' (paso)',' (passing)'):'')).join(' → ');
      L.push(`${i+1}. ${chordLabel(r,prefs)} | ${A.romans[i]?A.romans[i].text:'?'} (${FN_NAME[A.fn[i]]} · ${tenText(r,A.ten[i])}) | ${numB(c.a)}–${numB(c.b)} | ${r.spelled.slice(1).map(n=>noteText(n,prefs)).join(' ')||'—'}${adds?` (${adds})`:''} | ${bass}`);
    });
    if(!Hm.mel.length) return;
    L.push(tr('# Melodía: nota (MIDI) | inicio | duración | sobre | intervalo | tensión 0–1 | rol','# Melody: note (MIDI) | start | length | over | interval | tension 0–1 | role')+octTail(prefs));
    const ci=x=>Hm.chords.indexOf(Hm.chordAt(x.s)), info=Hm.mel.map(x=>against(x.notes[0],A.rs[ci(x)]));
    const toneAt=j=>info[j]&&info[j].tone;
    Hm.mel.forEach((x,i)=>{
      const k=ci(x), name=x.notes.map(nt).join('+'), r=A.rs[k], f=info[i];
      const nr=A.rs[k+1], next=k>=0&&nr?{r:nr,a:Hm.chords[k+1].a,label:chordLabel(nr,prefs)}:null;
      L.push(`${name} (${x.notes.join(' ')}${x.notes.length>1?tr(', doblada',', doubled'):''}) | ${numB(x.s)} | ${numB(x.l)} | ${r?chordLabel(r,prefs):'—'} | ${f?f.iv:'—'} | ${melTen(f)} | ${melodyRole(Hm.mel,i,info,toneAt,prefs,next)}`);
    });
  }};
}
function progText(p,prefs){
  p=normProg(p); if(isDrum(p)) return drumText(p,prefs);
  const S=segs(p), pure=!p.notes.length||isPure(p,S), L=[`# Pattern: ${p.name||tr('Sin nombre','Untitled')}`];
  // plain block chords keep one line per chord (the text reads back from them); anything else splits harmony and melody
  const H=pure?null:harmonyLines(p,prefs,L);
  const A=pure?analyzeProgression(S.map(s=>segStep(p,s)),prefs):H.A;
  if(pure?S.length:H.Hm.chords.length) L.push(tr(`# Tonalidad estimada: ${keyName(A.key,prefs)} · ${totalText(p)}`,`# Estimated key: ${keyName(A.key,prefs)} · ${totalText(p)}`));
  else if(p.notes.length) L.push(`# ${totalText(p)}`);
  if(A.found&&A.found.length) L.push(`${tr('# Patrones','# Patterns')}: ${A.found.map(f=>foundText(f,A.rs.length)).join('; ')}`);
  if(A.cad) L.push(`${tr('# Final','# Ending')}: ${A.cad}`);
  L.push(`${tr('# Instrumento','# Instrument')}: ${instText(p.inst,prefs,velUsed(p))}`);
  if(p.expr) L.push(`${tr('# Expresión','# Expression')}: ${exprSummary(p.expr)}`);
  if(hasGlide(p)) L.push(tr(`# Deslizamiento: bend ±${rangeOf(p)} st · ${p.glideNative?'nativo (CC65 y CC84)':'automatización de pitch'}`,`# Glide: bend ±${rangeOf(p)} st · ${p.glideNative?'native (CC65 and CC84)':'pitch automation'}`));
  if(pure){
    L.push(tr('# Formato: n. acorde | grado (función · tensión 0–1) | notas | MIDI | duración','# Format: n. chord | degree (function · tension 0–1) | notes | MIDI | length')+octTail(prefs));
    const beats=t=>`${fmtB(t)} ${t===T?tr('tiempo','beat'):tr('tiempos','beats')}`;
    A.rs.forEach((r,i)=>L.push(`${i+1}. ${chordLabel(r,prefs)} | ${A.romans[i]?A.romans[i].text:'?'} (${FN_NAME[A.fn[i]]} · ${tenText(r,A.ten[i])}) | ${r.spelled.map(n=>noteText(n,prefs)).join(' ')} | ${r.notes.join(' ')} | ${beats(S[i].b-S[i].a)}`));
    return L.join('\n');
  }
  H.write();
  const ch=instLabel(p.inst);
  L.push(tr('# Notas (exactas): nota | MIDI | inicio | duración | velocity | canal — inicio y duración en tiempos de negra desde el compás 1; octavas: '+OCT_CONV[prefs.octConv].name,'# Notes (exact): note | MIDI | start | length | velocity | channel — start and length in quarter-note beats from bar 1; octaves: '+OCT_CONV[prefs.octConv].name));
  [...p.notes].sort((a,b)=>a.s-b.s||a.m-b.m).forEach(n=>L.push(`${noteText(plainSpell(n.m,prefs),prefs)} | ${n.m} | ${numB(n.s)} | ${numB(n.l)} | ${n.v||100} | ${ch}${n.g?` | ${GLIDE_WORD[n.g]}`:''}`));
  return L.join('\n');
}
function libText(lib,prefs){
  const L=tr(['# Acordes guardados',`# Octavas: ${OCT_CONV[prefs.octConv].name}`,'# Formato: acorde | notas | MIDI'],['# Saved chords',`# Octaves: ${OCT_CONV[prefs.octConv].name}`,'# Format: chord | notes | MIDI']);
  lib.chords.forEach(s=>{const r=resolveStep(s,prefs); L.push(`${r.label} | ${r.spelled.map(n=>noteText(n,prefs)).join(' ')} | ${r.notes.join(' ')}`);});
  return [L.join('\n'),...lib.projects.map(pr=>projectText(pr,prefs))].join('\n\n');
}
const projectText=(pr,prefs,only)=>[projHeader(pr,prefs),...(only?[only]:pr.patterns).map(p=>progText(p,prefs))].join('\n\n');
const NOTE_RE=/(Sol|Do|Re|Mi|Fa|La|Si|[A-G])(♯♯|♭♭|##|bb|x|♯|♭|#|b)?(-?\d{1,2})(?!\d)/g;
function parseNotes(s,off){
  const out=[];
  for(const m of s.matchAll(NOTE_RE)){
    const li=LETTERS.indexOf(m[1])>=0?LETTERS.indexOf(m[1]):LATIN.indexOf(m[1]);
    const acc={'♯♯':2,'##':2,x:2,'♭♭':-2,bb:-2,'♯':1,'#':1,'♭':-1,b:-1}[m[2]]||0;
    const midi=12*(+m[3]-off+1)+NAT[li]+acc;
    if(midi>=LOW&&midi<=HIGH) out.push(midi);
  }
  return out;
}
function parseLine(line,off){
  let t=line.replace(/^\s*\d+[.)]\s*/,''), beats;
  const dm=t.match(/(?:\||\()\s*(\d+(?:[.,]\d+)?)\s*(?:t|tiempos?|beats?)\s*\)?\s*$/i);
  if(dm){ beats=+dm[1].replace(',','.'); t=t.slice(0,dm.index).trim(); }
  const parts=t.split('|').map(x=>x.trim());
  if(parts.length>=2){
    const last=parts[parts.length-1];
    if(/^[\d\s,]+$/.test(last)){ const nums=last.split(/[\s,]+/).filter(Boolean).map(Number).filter(n=>n>=LOW&&n<=HIGH); if(nums.length) return {name:parts[0],notes:nums,beats}; }
    for(const p of parts.slice(1)){ const n=parseNotes(p,off); if(n.length) return {name:parts[0],notes:n,beats}; }
  }
  const ci=t.indexOf(':');
  if(ci>=0){ const n=parseNotes(t.slice(ci+1),off); if(n.length) return {name:t.slice(0,ci).trim(),notes:n,beats}; }
  // "Name notes…": the first token is a name unless it is a lone note close to the rest (G7 B2 F3 → name G7)
  const sp=t.split(/\s+/);
  if(sp.length>1){
    const first=parseNotes(sp[0],off), rest=parseNotes(sp.slice(1).join(' '),off);
    const pureNote=first.length===1&&sp[0].replace(NOTE_RE,'')==='';
    const far=pureNote&&rest.length&&Math.min(...rest.map(m=>Math.abs(m-first[0])))>24;
    if(rest.length&&(!pureNote||far)) return {name:sp[0],notes:rest,beats};
  }
  const n=parseNotes(t,off);
  return n.length?{name:'',notes:n,beats}:null;
}
// a glide flag in the sixth column of a note line: slide or portamento (any language)
const GLIDE_WORD={s:'slide',p:'porta'};
const glideOf=w=>/^(slide|glis)/i.test(w||'')?'s':/^porta/i.test(w||'')?'p':null;
function parseNoteLine(line,off){
  const parts=line.split('|').map(x=>x.trim()); if(parts.length<4) return null;
  let m=+parts[1]; if(!(m>=LOW&&m<=HIGH)) m=parseNotes(parts[0],off)[0];
  const s=Math.round(parseFloat(parts[2].replace(',','.'))*T), l=Math.round(parseFloat(parts[3].replace(',','.'))*T);
  if(!(m>=LOW&&m<=HIGH)||!(s>=0)||!(l>0)) return null;
  // the glide flag follows the channel column, or comes sixth in texts from before it
  const v=parts[4]?Math.min(127,Math.max(1,Math.round(+parts[4])||100)):100, g=glideOf(parts[6])||glideOf(parts[5]);
  return g?{id:uid(),m,s,l,v,g}:{id:uid(),m,s,l,v};
}
// "1. Cmaj7 | Imaj7 (…) | 0–4 | B4 E5 G5 (+A5 at 2.5) | C4 → D4 (passing)": the chord as it starts, for its name
function parseHarmonyLine(line,off){
  const parts=line.replace(/^\s*\d+[.)]\s*/,'').split('|').map(x=>x.trim()); if(parts.length<5) return null;
  const bass=parseNotes(parts[4],off)[0], voices=parseNotes(parts[3].split('(')[0],off);
  return bass==null?null:{name:parts[0],notes:[bass,...voices]};
}
function parseText(txt,prefs){
  const out={projects:[],chords:[]}; let proj=null, pat=null, inChords=false, m;
  let parseOff=null;
  const startProj=name=>{ proj={name,bpm:null,seed:null,patterns:[]}; out.projects.push(proj); pat=null; inChords=false; };
  const startPat=name=>{ if(!proj) startProj(tr('Importado','Imported')); pat={name,steps:[],notes:[],noteMode:false}; proj.patterns.push(pat); inChords=false; };
  let sect=null; // 'harm' or 'mel' between their heading and the exact notes
  for(const raw of txt.split(/\r?\n/)){
    const line=raw.trim(); if(!line) continue;
    if((m=line.match(/^#\s*(?:Proyecto|Project)\s*:\s*(.*)$/i))){ startProj(m[1].trim()); sect=null; continue; }
    if((m=line.match(/^#\s*(?:Pattern|Progresi[oó]n|Progression)\s*:\s*(.*)$/i))){ startPat(m[1].trim()); sect=null; continue; }
    if((m=line.match(/^#\s*(?:Octavas|Octaves):.*?C(\d)\s*=\s*MIDI\s*60/i))){ parseOff=+m[1]-4; continue; }
    if(/^#\s*(?:Acordes guardados|Saved chords)/i.test(line)){ inChords=true; pat=null; sect=null; continue; }
    if(/^#\s*(?:Armon[ií]a|Harmony)\s*:/i.test(line)){ if(!pat) startPat(tr('Importado','Imported')); sect='harm'; continue; }
    if(/^#\s*(?:Melod[ií]a|Melody)\s*:/i.test(line)){ sect='mel'; continue; }
    if(/^#\s*(?:Notas|Notes)/i.test(line)){ if(!pat) startPat(tr('Importado','Imported')); pat.noteMode=true; sect=null; continue; }
    if(sect&&!line.startsWith('#')){ if(sect==='harm'){ const h=parseHarmonyLine(line,parseOff??octOff(prefs)); if(h) pat.steps.push(h); } continue; }
    if(pat&&(m=line.match(/^#\s*(?:Deslizamiento|Glide)\s*:\s*bend\s*±?\s*(\d+)/i))){ pat.bend=+m[1]; pat.glideNative=/nativ/i.test(line); continue; }
    if(line.startsWith('#')){
      if(proj&&(m=line.match(/(\d{2,3})\s*BPM/i))) proj.bpm=+m[1];
      if(proj&&(m=line.match(/(?:semilla de humanizar|humanize seed)\s*(\d+)/i))) proj.seed=+m[1];
      continue;
    }
    if(inChords){ const p=parseLine(line,parseOff??octOff(prefs)); if(p) out.chords.push(p); continue; }
    if(pat&&pat.noteMode){ const n=parseNoteLine(line,parseOff??octOff(prefs)); if(n) pat.notes.push(n); continue; }
    const p=parseLine(line,parseOff??octOff(prefs)); if(!p) continue;
    if(!pat) startPat(tr('Importado','Imported'));
    pat.steps.push(p);
  }
  out.projects.forEach(pr=>pr.patterns=pr.patterns.filter(s=>s.steps.length||s.notes.length));
  out.projects=out.projects.filter(pr=>pr.patterns.length);
  return out;
}
function pickInterp(p,prefs){
  const notes=[...new Set(p.notes)].sort((a,b)=>a-b);
  const cands=analyze(notes,null), want=(p.name||'').replace(/\s+/g,'');
  const c=cands.find(x=>{const sy=candSymbol(x,spellCandidate(x,notes,prefs),prefs); return want&&(sy.main+sy.slash).replace(/\s+/g,'')===want;})||cands[0];
  return {notes,root:c?c.root:null,sym:c?c.type.sym:null};
}

export { libText, parseText, pickInterp, progText, projectText };
