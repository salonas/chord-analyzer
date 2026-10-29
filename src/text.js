// Text export and import (reimportable plain text).
import { HIGH, LATIN, LETTERS, LOW, NAT, OCT_CONV, T, fmtB, numB, uid } from './data.js';
import { isDrum, isPure, normProg, progEnd, segStep, segs } from './model.js';
import { FN_NAME, analyze, analyzeProgression, candSymbol, keyName, noteText, octOff, plainSpell, resolveStep, spellCandidate } from './analysis.js';
import { exprSummary, instText } from './expression.js';
import { drumText } from './drums.js';
import { tr } from './i18n.js';
import { hasGlide, rangeOf } from './glide.js';

// ---------- text export / import ----------
function projHeader(pr,prefs){
  const np=`${pr.patterns.length} pattern${pr.patterns.length===1?'':'s'}`;
  return tr([`# Proyecto: ${pr.name||'Sin nombre'}`,`# ${pr.bpm} BPM · compás 4/4 · semilla de humanizar ${pr.seed} · ${np}`,`# Octavas: ${OCT_CONV[prefs.octConv].name}`],
    [`# Project: ${pr.name||'Untitled'}`,`# ${pr.bpm} BPM · 4/4 time · humanize seed ${pr.seed} · ${np}`,`# Octaves: ${OCT_CONV[prefs.octConv].name}`]).join('\n');
}
function progText(p,prefs){
  p=normProg(p); if(isDrum(p)) return drumText(p,prefs);
  const S=segs(p);
  const A=analyzeProgression(S.map(s=>segStep(p,s)),prefs);
  const L=[`# Pattern: ${p.name||tr('Sin nombre','Untitled')}`];
  if(S.length) L.push(tr(`# Tonalidad estimada: ${keyName(A.key,prefs)} · total ${fmtB(progEnd(p))} tiempos`,`# Estimated key: ${keyName(A.key,prefs)} · total ${fmtB(progEnd(p))} beats`));
  if(A.found&&A.found.length) L.push(`${tr('# Patrones','# Patterns')}: ${A.found.map(f=>f.name).join('; ')}`);
  if(A.cad) L.push(`${tr('# Final','# Ending')}: ${A.cad}`);
  L.push(`${tr('# Instrumento','# Instrument')}: ${instText(p.inst,prefs)}`);
  if(p.expr) L.push(`${tr('# Expresión','# Expression')}: ${exprSummary(p.expr)}`);
  if(hasGlide(p)) L.push(tr(`# Deslizamiento: bend ±${rangeOf(p)} st · ${p.glideNative?'nativo (CC65 y CC84)':'automatización de pitch'}`,`# Glide: bend ±${rangeOf(p)} st · ${p.glideNative?'native (CC65 and CC84)':'pitch automation'}`));
  L.push(tr('# Formato: n. acorde | grado (función · tensión 0–1) | notas | MIDI | duración','# Format: n. chord | degree (function · tension 0–1) | notes | MIDI | length'));
  const ten=x=>tr(String(x).replace('.',','),String(x)), beats=t=>`${fmtB(t)} ${t===T?tr('tiempo','beat'):tr('tiempos','beats')}`;
  A.rs.forEach((r,i)=>L.push(`${i+1}. ${r.label} | ${A.romans[i]?A.romans[i].text:'?'} (${FN_NAME[A.fn[i]]} · ${ten(A.ten[i])}) | ${r.spelled.map(n=>noteText(n,prefs)).join(' ')} | ${r.notes.join(' ')} | ${beats(S[i].b-S[i].a)}`));
  if(p.notes.length&&!isPure(p,S)){
    L.push(tr('# Notas (exactas): nota | MIDI | inicio | duración | velocity — inicio y duración en tiempos de negra desde el compás 1','# Notes (exact): note | MIDI | start | length | velocity — start and length in quarter-note beats from bar 1'));
    [...p.notes].sort((a,b)=>a.s-b.s||a.m-b.m).forEach(n=>L.push(`${noteText(plainSpell(n.m,prefs),prefs)} | ${n.m} | ${numB(n.s)} | ${numB(n.l)} | ${n.v||100}${n.g?` | ${GLIDE_WORD[n.g]}`:''}`));
  }
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
  const v=parts[4]?Math.min(127,Math.max(1,Math.round(+parts[4])||100)):100, g=glideOf(parts[5]);
  return g?{id:uid(),m,s,l,v,g}:{id:uid(),m,s,l,v};
}
function parseText(txt,prefs){
  const out={projects:[],chords:[]}; let proj=null, pat=null, inChords=false, m;
  let parseOff=null;
  const startProj=name=>{ proj={name,bpm:null,seed:null,patterns:[]}; out.projects.push(proj); pat=null; inChords=false; };
  const startPat=name=>{ if(!proj) startProj(tr('Importado','Imported')); pat={name,steps:[],notes:[],noteMode:false}; proj.patterns.push(pat); inChords=false; };
  for(const raw of txt.split(/\r?\n/)){
    const line=raw.trim(); if(!line) continue;
    if((m=line.match(/^#\s*(?:Proyecto|Project)\s*:\s*(.*)$/i))){ startProj(m[1].trim()); continue; }
    if((m=line.match(/^#\s*(?:Pattern|Progresi[oó]n|Progression)\s*:\s*(.*)$/i))){ startPat(m[1].trim()); continue; }
    if((m=line.match(/^#\s*(?:Octavas|Octaves):.*?C(\d)\s*=\s*MIDI\s*60/i))){ parseOff=+m[1]-4; continue; }
    if(/^#\s*(?:Acordes guardados|Saved chords)/i.test(line)){ inChords=true; pat=null; continue; }
    if(/^#\s*(?:Notas|Notes)/i.test(line)){ if(!pat) startPat(tr('Importado','Imported')); pat.noteMode=true; continue; }
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
