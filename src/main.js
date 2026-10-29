// Interface: inspector, keyboard, staff, library, panels and boot.
import { BLACK, HIGH, INSTRUMENTS, IN_KEYS, LOW, T, TYPES, fmtB, freq, guessInst, instDefaults, intervalName, sigOf, uid } from './data.js';
import { $, esc, fillRange, saveFile, toast } from './dom.js';
import { EXAMPLE_NAME, activePat, isBlock, isDrum, newPattern, newSeed, normProg, normProject, progEnd, segStep, segs } from './model.js';
import { fut, hist, lib, persistLib, saveDraft, savePrefs, st } from './state.js';
import { FN_NAME, PATTERNS, analyze, analyzeProgression, candSymbol, defaultSpell, inversionText, keyName, letterName, noteText, octOff, plainSpell, resolveStep, spellCandidate } from './analysis.js';
import { EX_KEYS, FEELINGS, exDefaults, exprSummary, expressPattern, instLabel } from './expression.js';
import { DRUMS, GROOVES, expressDrums, genGroove } from './drums.js';
import { libText, parseText, pickInterp, projectText } from './text.js';
import { buildPack, fileBase, midiFile, zipFiles } from './midi.js';
import { FL_SCRIPT_DIR, flScript } from './flscript.js';
import { PITCH_RANGE, pitchClip } from './flpitch.js';
import { parseMidi, separatePatterns, separateVoices } from './importer.js';
import { BEND_RANGE, glidePlan, hasGlide, rangeOf } from './glide.js';
import { audio, loadManifest, mixOf, playNotes, setMix } from './audio.js';
import { P, R, addAtEnd, centerRoll, commit, curSeg, deleteSel, drawRoll, liveNotes, playProg, pxDisc, readColors, redo, rollSize, selChanged, setPlayBtn, setZoom, stopProg, syncGlideBtns, toggleKey, undo, velTargets } from './roll.js';
import { LANG_KEY, getLang, setLang, shareLang, sharedLang, tr, translateStatic } from './i18n.js';

// the static texts of index.html are read in Spanish before any code below rewrites one
translateStatic(); document.documentElement.lang=st.lang;

function renderStoreStatus(){$('storeStatus').textContent=tr('Guardado solo en este navegador.','Saved in this browser only.');}
function fmtFreq(f){return f.toLocaleString(getLang(),{maximumFractionDigits:f<100?2:1,minimumFractionDigits:f<100?2:1})}
// ---------- horizontal keyboard ----------
const kb=$('kb'), scroller=$('scroller');
const keyEl={}; const whiteIdx={}; let WHITES=0;
(function build(){
  let html='';
  for(let m=LOW;m<=HIGH;m++){
    const pc=m%12, black=BLACK.has(pc), oct=Math.floor(m/12)-1;
    const cls=['key',black?'b':'w']; if(m<21||m>108) cls.push('out'); if(m>127) cls.push('nomidi');
    const left=black?`calc(var(--kw) * ${WHITES} - var(--bw) / 2)`:`calc(var(--kw) * ${WHITES})`;
    html+=`<button class="${cls.join(' ')}" data-m="${m}" style="left:${left}" aria-pressed="false"><span class="nm"></span><span class="mk"></span></button>`;
    if(!black){ whiteIdx[m]=WHITES; if(pc===0) html+=`<span class="oct${m===60?' c4':''}" data-o="${oct}" style="left:calc(var(--kw) * ${WHITES})">C${oct}</span>`; WHITES++; }
    else whiteIdx[m]=WHITES-.5;
  }
  kb.innerHTML=html;
  kb.querySelectorAll('.key').forEach(k=>keyEl[k.dataset.m]=k);
  kb.style.width=`calc(var(--kw) * ${WHITES})`;
})();
kb.addEventListener('click',e=>{ const k=e.target.closest('.key'); if(k) toggleKey(+k.dataset.m); });
const mini=$('mini'), vp=$('vp'), mm=$('minimap');
function drawMini(){
  const r=mini.getBoundingClientRect(); if(!r.width) return;
  const dpr=window.devicePixelRatio||1; mini.width=r.width*dpr; mini.height=r.height*dpr;
  const g=mini.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  const W=r.width,H=r.height,ww=W/WHITES, C=R.C;
  g.fillStyle=C.ivory; g.fillRect(0,0,W,H);
  g.fillStyle=C.hatch; g.fillRect(0,0,whiteIdx[21]*ww,H); g.fillRect((whiteIdx[108]+1)*ww,0,W,H); g.fillRect((whiteIdx[127]+1)*ww,0,W,H);
  g.fillStyle=C.ivoryEdge; for(let i=7;i<WHITES;i+=7) g.fillRect(i*ww,0,1,H);
  for(let m=LOW;m<=HIGH;m++){
    const black=BLACK.has(m%12), on=st.notes.has(m);
    if(black){ g.fillStyle=on?C.selB:C.ebony; g.fillRect((whiteIdx[m]+.5)*ww-ww*.3,0,ww*.6,H*.6); }
    else if(on){ g.fillStyle=C.selW; g.fillRect(whiteIdx[m]*ww,0,ww,H); }
  }
  g.fillStyle=C.marker; st.notes.forEach(m=>pxDisc(g,(whiteIdx[m]+.5)*ww,H-6,6));
  syncVp();
}
function syncVp(){ const sw=scroller.scrollWidth||1; vp.style.left=(scroller.scrollLeft/sw*100)+'%'; vp.style.width=(scroller.clientWidth/sw*100)+'%'; }
function jumpTo(clientX){ const r=mm.getBoundingClientRect(); scroller.scrollLeft=(clientX-r.left)/r.width*scroller.scrollWidth-scroller.clientWidth/2; }
let mmDrag=false;
mm.addEventListener('pointerdown',e=>{mmDrag=true;mm.setPointerCapture(e.pointerId);jumpTo(e.clientX)});
mm.addEventListener('pointermove',e=>{if(mmDrag)jumpTo(e.clientX)});
mm.addEventListener('pointerup',()=>mmDrag=false);
scroller.addEventListener('scroll',syncVp,{passive:true});
new ResizeObserver(drawMini).observe(mm);
function centerKeyboard(){ const n=[...st.notes].sort((a,b)=>a-b), m=n.length?Math.round((n[0]+n[n.length-1])/2):60; const kw=parseFloat(getComputedStyle(kb).getPropertyValue('--kw'))||24; scroller.scrollLeft=(whiteIdx[m]+.5)*kw-scroller.clientWidth/2; }

// ---------- staff ----------
// pixel whole note, 2 units per pixel: '#' ink, 'o' the hole, painted with the surface so staff lines do not show through it
const HEAD=['.#####.','##oo###','###oo##','.#####.'];
const headPath=c=>HEAD.flatMap((r,y)=>[...r].map((ch,x)=>ch===c?`M${x*2} ${y*2}h2v2h-2z`:'')).join('');
const HEAD_INK=headPath('#'), HEAD_HOLE=headPath('o');
function renderStaff(spelled){
  const svg=$('staff');
  // 55 units above and below the grand staff (viewBox height 260): room for two ledger lines and an 8va/8vb label
  const TT=55, BT=TT+40+70, NX=190, left=14, right=290;
  const yT=d=>TT+(38-d)*5, yB=d=>BT+(26-d)*5;
  let s='', note='';
  for(let i=0;i<5;i++){ s+=`<line class="ln" x1="${left}" x2="${right}" y1="${TT+i*10}" y2="${TT+i*10}"/><line class="ln" x1="${left}" x2="${right}" y1="${BT+i*10}" y2="${BT+i*10}"/>`; }
  s+=`<line class="ln" x1="${left}" x2="${left}" y1="${TT}" y2="${BT+40}" stroke-width="1.5"/><line class="ln" x1="${right}" x2="${right}" y1="${TT}" y2="${BT+40}"/>`;
  // Unifont clefs (64 units per em): the G clef inks -8..56 and the F clef 0..48 above the baseline
  s+=`<text class="mus" x="${left+6}" y="${TT+42}" font-size="64">𝄞</text><text class="mus" x="${left+6}" y="${BT+35}" font-size="48">𝄢</text>`;
  const notes=spelled.map(n=>({...n,d:n.oct*7+n.l}));
  const drawGroup=(grp,isT)=>{
    if(!grp.length) return;
    let k=0;
    if(isT){ const mx=Math.max(...grp.map(n=>n.d)); while(mx-7*k>42 && k<3) k++; }
    else { const mn=Math.min(...grp.map(n=>n.d)); while(mn+7*k<14 && k<3) k++; }
    const items=grp.map(n=>({...n,dd:isT?n.d-7*k:n.d+7*k})).sort((a,b)=>a.dd-b.dd);
    const y=isT?yT:yB;
    let prevDisp=false;
    items.forEach((n,i)=>{ n.disp=i>0 && n.dd-items[i-1].dd<=1 && !prevDisp; prevDisp=n.disp; });
    const anyDisp=items.some(n=>n.disp);
    const ledg=new Set();
    items.forEach(n=>{
      if(isT){ for(let d=28; d>=n.dd; d-=2) ledg.add(d); for(let d=40; d<=n.dd; d+=2) ledg.add(d); }
      else   { for(let d=16; d>=n.dd; d-=2) ledg.add(d); for(let d=28; d<=n.dd; d+=2) ledg.add(d); }
    });
    ledg.forEach(d=>{ s+=`<line class="ln" x1="${NX-11}" x2="${NX+(anyDisp?25:11)}" y1="${y(d)}" y2="${y(d)}" stroke-width="1.3"/>`; });
    items.forEach(n=>{
      const cx=NX+(n.disp?14:0), cy=y(n.dd);
      s+=`<g transform="translate(${cx-7} ${cy-4})" shape-rendering="crispEdges"><path d="${HEAD_INK}" fill="currentColor"/><path d="${HEAD_HOLE}" fill="var(--surface)"/></g>`;
    });
    const cols=[];
    [...items].sort((a,b)=>b.dd-a.dd).forEach(n=>{
      if(!n.a) return;
      let c=0; while(cols[c]&&cols[c].some(e=>Math.abs(e-n.dd)<6)) c++;
      (cols[c]=cols[c]||[]).push(n.dd);
      // baseline offsets put the centre of a sharp and the bowl of a flat on the note
      const glyph={'-2':'𝄫','-1':'♭','1':'♯','2':'𝄪'}[n.a], dy={'-2':4,'-1':8,'1':15,'2':11}[n.a];
      s+=`<text class="mus" x="${NX-15-c*13}" y="${y(n.dd)+dy}" font-size="32" text-anchor="end">${glyph}</text>`;
    });
    if(k){
      const lab=isT?['','8va','15ma','22ma'][k]:['','8vb','15mb','22mb'][k];
      const ys=items.map(n=>y(n.dd));
      const ty=isT?Math.min(TT-12,Math.min(...ys)-14):Math.max(BT+56,Math.max(...ys)+20);
      s+=`<text class="mus" x="${NX-30}" y="${ty}" font-size="16">${lab}</text><line class="ln" x1="${NX-2}" x2="${NX+40}" y1="${ty-4}" y2="${ty-4}" stroke-dasharray="3 3"/>`;
      note+=(note?' · ':'')+(isT?tr('clave de sol ','treble clef '):tr('clave de fa ','bass clef '))+lab;
    }
  };
  drawGroup(notes.filter(n=>n.d>=28),true); drawGroup(notes.filter(n=>n.d<28),false);
  svg.innerHTML=s;
  $('staffNote').textContent=note||(notes.length?'':tr('sin notas','no notes'));
}

// ---------- render: active chord (inspector) ----------
let lastCur=null;
function renderActive(){
  const notes=[...st.notes].sort((a,b)=>a-b);
  const cands=analyze(notes,st.lockedRoot);
  if(st.prefer){ const i=cands.findIndex(c=>c.root===st.prefer.root&&c.type.sym===st.prefer.sym); st.pick=i>=0?i:0; st.prefer=null; }
  if(st.pick>=cands.length) st.pick=0;
  const cur=cands[st.pick]; lastCur=cur;
  const sp=cur?spellCandidate(cur,notes,st):null;
  const spelled=sp?sp.notes:notes.map(m=>plainSpell(m,st));
  const rootPc=cur?cur.root:(st.lockedRoot!==null?st.lockedRoot:null); R.rootPc=rootPc;
  const S=curSeg(), modified=sigOf(notes)!==st.srcSig;
  let src=tr('Acorde activo · armado a mano','Active chord · built by hand');
  const mod=modified?tr(' · modificado',' · edited'):'';
  if(st.src==='seg'&&S){ const i=R.segs.indexOf(S), bar=Math.floor(S.a/(4*T))+1, beat=Math.floor(S.a/T)%4+1; src=tr(`Acorde ${i+1} de ${R.segs.length} · compás ${bar}, tiempo ${beat}${mod}`,`Chord ${i+1} of ${R.segs.length} · bar ${bar}, beat ${beat}${mod}`); }
  else if(st.src==='sel'&&R.sel.size){ const n=R.sel.size; src=tr(`Selección del piano roll · ${n} nota${n>1?'s':''}${mod}`,`Piano roll selection · ${n} note${n>1?'s':''}${mod}`); }
  if(!st.notes.size&&st.src==='builder') src=tr('Haz clic en las teclas para armar un acorde','Click the keys to build a chord');
  $('srcLabel').textContent=src;

  const nameEl=$('chordName'), descEl=$('chordDesc');
  if(cur){
    const sy=candSymbol(cur,sp,st);
    nameEl.innerHTML=esc(sy.main)+(sy.slash?`<span class="slash">${esc(sy.slash)}</span>`:'');
    const inv=inversionText(cur);
    descEl.textContent=`${sp.rootName} ${cur.type.name}${inv?' · '+inv:''}${cur.missing.length?tr(' · sin ',' · no ')+cur.missing.map(d=>d.label).join(', '):''}`;
  } else if(notes.length===1){
    nameEl.textContent=noteText(spelled[0],st); descEl.textContent=tr('Una sola nota.','A single note.');
  } else if(notes.length===2){
    const a=spelled[0], b=spelled[1], semi=notes[1]-notes[0];
    nameEl.textContent=letterName(a.l,a.a,st)+' – '+letterName(b.l,b.a,st);
    const k=Math.floor(semi/12);
    descEl.textContent=tr(`Intervalo de ${intervalName(semi%12)}${semi>12?` + ${k} octava${semi>=24?'s':''} (compuesto)`:semi===12?' (octava)':''} · ${semi} semitonos`,
      `${intervalName(semi%12)} interval${semi>12?` + ${k} octave${semi>=24?'s':''} (compound)`:semi===12?' (octave)':''} · ${semi} semitones`);
  } else if(notes.length){
    nameEl.textContent='?'; descEl.textContent=tr('Ningún acorde del diccionario calza con estas notas.','No chord in the dictionary fits these notes.');
  } else { nameEl.textContent='—'; descEl.textContent=tr('Haz clic en las teclas del piano roll o del teclado, o elige un acorde en la franja.','Click the keys of the piano roll or the keyboard, or pick a chord in the lane.'); }

  $('noteChips').innerHTML=spelled.map(n=>{
    const isR=rootPc!==null&&n.midi%12===rootPc;
    return `<button class="chip${isR?' isroot':''}" data-m="${n.midi}" title="${tr(`Quitar ${esc(noteText(n,st))} del acorde activo`,`Remove ${esc(noteText(n,st))} from the active chord`)}">${n.deg?`<span class="deg">${esc(n.deg.label)}</span>`:''}<b>${esc(noteText(n,st))}</b><span>${fmtFreq(freq(n.midi))} Hz</span><span>${n.midi<=127?'MIDI '+n.midi:tr('sin MIDI','no MIDI')}</span></button>`;
  }).join('')||`<div class="chip none"><span>${tr('Sin notas','No notes')}</span></div>`;

  for(let m=LOW;m<=HIGH;m++){
    const k=keyEl[m], on=st.notes.has(m), pc=m%12;
    const s=on?spelled.find(n=>n.midi===m):plainSpell(m,st);
    k.classList.toggle('on',on); k.classList.toggle('root',on&&rootPc===pc);
    k.setAttribute('aria-pressed',on);
    k.setAttribute('aria-label',noteText(s,st)+(on?(rootPc===pc?tr(', fundamental',', root'):tr(', en el acorde',', in the chord')):''));
    k.querySelector('.mk').textContent=on?letterName(s.l,s.a,st):'';
    k.querySelector('.nm').textContent=(st.showNames&&!on)?letterName(s.l,s.a,st):'';
  }

  $('candCount').textContent=cands.length?tr(`${cands.length} coincidencia${cands.length>1?'s':''}`,`${cands.length} match${cands.length>1?'es':''}`):'';
  $('cands').innerHTML=cands.length?cands.map((c,i)=>{
    const csp=spellCandidate(c,notes,st), sy=candSymbol(c,csp,st);
    const form=c.type.degs.map(d=>{ const s=csp.byPc[(d.pc+c.root)%12], nm=letterName(s.l,s.a,st); return c.missing.includes(d)?`<s>${esc(d.label)} ${esc(nm)}</s>`:`<span>${esc(d.label)} <i>${esc(nm)}</i></span>`; }).join('');
    const tags=[];
    if(!c.missing.length && !c.slash) tags.push(`<span class="tag exact">${tr('coincidencia exacta','exact match')}</span>`);
    if(c.missing.length) tags.push(`<span class="tag">${tr('sin','no')} ${c.missing.map(d=>esc(d.label)).join(', ')}</span>`);
    if(c.slash) tags.push(`<span class="tag">${esc(inversionText(c))}</span>`);
    if(st.lockedRoot===c.root) tags.push(`<span class="tag exact">${tr('raíz elegida','chosen root')}</span>`);
    if(c.type.alt) tags.push(`<span class="tag">${tr('también','also')} ${esc(csp.rootName+c.type.alt)}</span>`);
    return `<li><button class="cand" data-i="${i}" aria-pressed="${i===st.pick}"><span class="sym">${esc(sy.main+sy.slash)}</span><span class="desc">${esc(csp.rootName+' '+c.type.name)}${i===st.pick?`<span class="pick">${tr('en uso','in use')}</span>`:''}</span><span class="form">${form}</span><span class="tags">${tags.join('')}</span></button></li>`;
  }).join(''):`<li class="empty">${notes.length<2?tr('Elige al menos dos notas distintas para ver nombres de acorde.','Pick at least two different notes to see chord names.'):tr('Sin coincidencias en los '+TYPES.length+' tipos de acorde del diccionario.','No matches among the '+TYPES.length+' chord types in the dictionary.')}</li>`;

  const w=[], nm=a=>a.map(m=>noteText(spelled.find(n=>n.midi===m),st)).join(', ');
  const below=notes.filter(m=>m<21), above=notes.filter(m=>m>108), noMidi=notes.filter(m=>m>127);
  const ref=m=>noteText(plainSpell(m,st),st);
  if(below.length) w.push(tr(`${nm(below)}: por debajo de ${ref(21)} (MIDI 21), la tecla más grave de un piano de 88 teclas.`,`${nm(below)}: below ${ref(21)} (MIDI 21), the lowest key of an 88-key piano.`));
  if(above.length) w.push(tr(`${nm(above)}: por encima de ${ref(108)} (MIDI 108), la tecla más aguda de un piano de 88 teclas.`,`${nm(above)}: above ${ref(108)} (MIDI 108), the highest key of an 88-key piano.`));
  if(noMidi.length) w.push(tr(`${nm(noMidi)}: por encima de ${ref(127)} (MIDI 127). No existen como nota MIDI estándar.`,`${nm(noMidi)}: above ${ref(127)} (MIDI 127). They do not exist as standard MIDI notes.`));
  const infra=notes.filter(m=>freq(m)<20); if(infra.length) w.push(tr(`${nm(infra)}: bajo 20 Hz, el límite inferior habitual del oído. En parlantes comunes casi no se escucha.`,`${nm(infra)}: below 20 Hz, the usual lower limit of hearing. Common speakers barely play it.`));
  const ultra=notes.filter(m=>freq(m)>15000); if(ultra.length) w.push(tr(`${nm(ultra)}: sobre 15 kHz. Muchos adultos oyen poco o nada en esa zona; depende de la edad.`,`${nm(ultra)}: above 15 kHz. Many adults hear little or nothing there; it depends on age.`));
  for(let i=1;i<notes.length;i++) if(notes[i]<48 && notes[i]-notes[i-1]<=4){ w.push(tr(`${nm([notes[i-1],notes[i]])}: intervalo de 3ª o menor bajo ${ref(48)}. En el registro grave suele sonar turbio.`,`${nm([notes[i-1],notes[i]])}: a 3rd or smaller below ${ref(48)}. In the low register it tends to sound muddy.`)); break; }
  if(notes.length>=3 && !cands.length) w.push(tr('No se reconoce el acorde. Puede ser un cluster o un tipo fuera del diccionario.','The chord is not recognized. It may be a cluster or a type outside the dictionary.'));
  if(notes.length>10) w.push(tr(`${notes.length} notas: más de las que caben en dos manos (10 dedos).`,`${notes.length} notes: more than two hands can hold (10 fingers).`));
  $('warns').innerHTML=w.length?w.map(t=>`<li>${esc(t)}</li>`).join(''):`<li class="ok">${tr('Sin avisos para este acorde.','No warnings for this chord.')}</li>`;

  const has=notes.length>0;
  $('bRoot').setAttribute('aria-pressed',st.rootMode);
  $('bDown').disabled=!has||notes[0]-1<LOW; $('bUp').disabled=!has||notes[notes.length-1]+1>HIGH;
  $('bOctDown').disabled=!has||notes[0]-12<LOW; $('bOctUp').disabled=!has||notes[notes.length-1]+12>HIGH;
  ['bInvDown','bInvUp','bPlay','bArp','bClear','bSave','bAdd','bInsertHead'].forEach(id=>$(id).disabled=!has);
  $('bUndo').disabled=!hist.length; $('bRedo').disabled=!fut.length;
  $('hint').textContent=st.rootMode?tr('Haz clic en la tecla que quieres como fundamental.','Click the key you want as the root.'):(st.lockedRoot!==null?tr(`Fundamental fijada en ${letterName(...defaultSpell(st.lockedRoot,st),st)}. Vuelve a elegirla para soltarla.`,`Root locked on ${letterName(...defaultSpell(st.lockedRoot,st),st)}. Pick it again to release it.`):'');
  $('hint').classList.toggle('on',st.rootMode);
  // replace + segment tools
  const block=S&&isBlock(st.prog,S);
  const canRep=has&&((st.src==='sel'&&R.sel.size>0)||(st.src==='seg'&&block));
  $('bReplace').disabled=!canRep;
  $('bReplace').textContent=st.src==='sel'?tr('Reemplazar selección','Replace selection'):S?tr(`Reemplazar acorde ${R.segs.indexOf(S)+1}`,`Replace chord ${R.segs.indexOf(S)+1}`):tr('Reemplazar','Replace');
  $('segTools').hidden=!(st.src==='seg'&&S);
  if(S){
    const i=R.segs.indexOf(S), A=R.segs[i-1], B=R.segs[i+1];
    if(document.activeElement!==$('segBeats')) $('segBeats').value=+((S.b-S.a)/T).toFixed(3);
    ['bSegShorter','bSegLonger','segBeats'].forEach(id=>$(id).disabled=!block);
    $('bSegLeft').disabled=!(block&&A&&A.b===S.a&&isBlock(st.prog,A));
    $('bSegRight').disabled=!(block&&B&&B.a===S.b&&isBlock(st.prog,B));
    $('segHint').textContent=block?(modified?tr('Notas cambiadas: pulsa «Reemplazar» para aplicarlas al acorde.','Notes changed: press “Replace” to apply them to the chord.'):tr('Cambiar la duración desplaza lo que viene después.','Changing the length shifts what comes after.')):tr('Este acorde tiene notas sueltas o que se superponen: edítalo en el piano roll.','This chord has loose or overlapping notes: edit it in the piano roll.');
  } else $('segHint').textContent=st.src==='sel'?tr('«Reemplazar selección» pone el acorde activo como bloque en el lugar de las notas seleccionadas.','“Replace selection” puts the active chord as a block where the selected notes are.'):'';
  const vt=velTargets().length;
  $('velTarget').textContent=R.sel.size?tr(`Se aplica a ${vt} nota${vt===1?'':'s'} seleccionada${vt===1?'':'s'}.`,`Applies to ${vt} selected note${vt===1?'':'s'}.`):tr(`Se aplica a todas las notas (${vt}).`,`Applies to every note (${vt}).`);
  renderStaff(spelled);
  segSync();
}

// ---------- render: progression ----------
function renderProgression(){
  const p=st.prog, pr=st.proj;
  if(document.activeElement!==$('projName')) $('projName').value=pr.name||'';
  if(document.activeElement!==$('patName')) $('patName').value=p.name||'';
  $('patTabs').innerHTML=pr.patterns.map((x,i)=>`<button class="ptab" role="tab" data-id="${x.id}" aria-selected="${x.id===p.id}" title="${tr('Doble clic para renombrar','Double-click to rename')}"><span class="pn">${i+1}. ${esc(x.name||tr('Sin nombre','Untitled'))}</span><span class="pi">${esc(instLabel(x.inst))} · ${isDrum(x)?tr(`${x.notes.length} golpe${x.notes.length===1?'':'s'}`,`${x.notes.length} hit${x.notes.length===1?'':'s'}`):tr(`${segs(x).length} acorde${segs(x).length===1?'':'s'}`,`${segs(x).length} chord${segs(x).length===1?'':'s'}`)}</span></button>`).join('');
  showPatTab(p.id);
  if(document.activeElement!==$('topInst')) $('topInst').value=p.inst.preset;
  syncVol(); syncGlide();
  if(!$('instControls').contains(document.activeElement)&&document.activeElement!==$('inPreset')) fillInst();
  { const I=p.inst, low=p.notes.filter(n=>n.m<I.lowPivot).length, hi=p.notes.filter(n=>n.m>I.highPivot).length;
    const maxLow=segs(p).reduce((a,S)=>Math.max(a,S.notes.filter(m=>m<I.lowPivot).length),0);
    const lo=noteText(plainSpell(I.lowPivot,st),st), up=noteText(plainSpell(I.highPivot,st),st);
    $('regInfo').textContent=tr(`Registro de este pattern: ${low} nota${low===1?'':'s'} bajo ${lo} (máx. ${maxLow} a la vez) · ${hi} sobre ${up}.${maxLow>=3?' Hay 3 o más graves sonando juntos: pueden embarrar la mezcla.':''}`,
      `This pattern’s register: ${low} note${low===1?'':'s'} below ${lo} (max. ${maxLow} at once) · ${hi} above ${up}.${maxLow>=3?' 3 or more low notes sound together: they can muddy the mix.':''}`); }
  $('bPatDel').textContent=delArm?tr('¿Borrar? Clic otra vez','Delete? Click again'):tr('Borrar','Delete');
  if(document.activeElement!==$('bpm')) $('bpm').value=pr.bpm||90;
  if(document.activeElement!==$('beats')) $('beats').value=p.beats||4;
  $('seedInfo').textContent=tr(`Semilla del proyecto: ${pr.seed}`,`Project seed: ${pr.seed}`);
  R.segs=isDrum(p)?[]:segs(p);
  $('bSep').disabled=isDrum(p)||!p.notes.length;
  const A=analyzeProgression(R.segs.map(S=>segStep(p,S)),st); R.A=A;
  R.lane=R.segs.map((S,i)=>({a:S.a,b:S.b,label:A.rs[i].label,roman:A.romans[i]?`${A.romans[i].text} · ${A.fn[i]}`:'—'}));
  const end=progEnd(p), saved=lib.projects.find(x=>x.id===pr.id);
  $('progStatus').textContent=saved?(JSON.stringify(saved)===JSON.stringify(pr)?tr('guardado en la biblioteca','saved in the library'):tr('cambios sin guardar','unsaved changes')):tr('sin guardar','not saved');
  const nseg=R.segs.length, nn=p.notes.length, secs=(end/T*60/(pr.bpm||90)).toLocaleString(getLang(),{maximumFractionDigits:1}), ns=R.sel.size;
  $('progSummary').textContent=tr(`${p.name||'Pattern'} · ${isDrum(p)?'batería':`${nseg} acorde${nseg===1?'':'s'}`} ·${nn} nota${nn===1?'':'s'} · ${fmtB(end)} tiempos · ${secs} s`,
    `${p.name||'Pattern'} · ${isDrum(p)?'drums':`${nseg} chord${nseg===1?'':'s'}`} · ${nn} note${nn===1?'':'s'} · ${fmtB(end)} beats · ${secs} s`);
  // glides play at any interval; only the pitch-bend .mid is held to the bend range
  const gs=isDrum(p)?0:glidePlan(p,Infinity).skipped, gw=isDrum(p)||p.glideNative?0:glidePlan(p).skipped-gs;
  $('rollInfo').textContent=[ns?tr(`${ns} nota${ns>1?'s':''} seleccionada${ns>1?'s':''}`,`${ns} note${ns>1?'s':''} selected`):'',
    gs?tr(`${gs} slide${gs>1?'s':''} o portamento${gs>1?'s':''} sin efecto (otra nota suena a la vez o la anterior ya terminó; un slide así no suena, como en FL)`,`${gs} slide${gs>1?'s':''} or portamento${gs>1?'s':''} without effect (another note sounds at once or the previous one has ended; such a slide stays silent, as in FL)`):'',
    gw?tr(`${gw} pasa${gw>1?'n':''} de ±${rangeOf(p)} st: en el .mid ${gw>1?'van':'va'} sin deslizar (sube «Rango de bend» o usa «Slide nativo»)`,`${gw} exceed${gw>1?'':'s'} ±${rangeOf(p)} st: the .mid plays ${gw>1?'them':'it'} without gliding (raise «Bend range» or use «Native slide»)`):''].filter(Boolean).join(' · ');
  syncGlideBtns();
  let h='';
  if(R.segs.length) h=analysisSheet(A,p);
  else h=isDrum(p)?drumSummaryHtml(p):`<div class="empty">${tr('Dibuja notas en el piano roll o arma un acorde y pulsa «+ Al final» (Enter). La tonalidad, los grados y los patrones aparecen aquí.','Draw notes in the piano roll or build a chord and press “+ At the end” (Enter). The key, the degrees and the patterns show up here.')}</div>`;
  $('progAnalysis').innerHTML=h;
}

// full redraw after any change to the project, the pattern or the preferences
function render(){
  renderProgression();
  if(st.segA!=null&&!curSeg()) { st.segA=null; if(st.src==='seg') st.src='builder'; }
  renderActive();
  rollSize(); drawRoll(); drawMini();
  renderLibrary(); renderExport(); renderDrumMap(); saveDraft();
  $('bLoop').setAttribute('aria-pressed',st.loop);
}

// ---------- library ----------
function renderLibrary(){
  $('savedChords').innerHTML=lib.chords.length?lib.chords.map((s,i)=>{
    const r=resolveStep(s,st);
    return `<li><div style="min-width:0"><span class="n">${esc(r.label)}</span><span class="v">${r.spelled.map(x=>esc(noteText(x,st))).join(' ')}</span></div><div class="acts"><button class="sbtn" data-load="${i}">${tr('Cargar','Load')}</button><button class="sbtn" data-add="${i}" title="${tr('Agregar al final de la progresión','Add at the end of the progression')}">${tr('+ Al final','+ At the end')}</button><button class="sbtn" data-del="${i}" aria-label="${tr('Quitar','Remove')} ${esc(r.label)}">${tr('Quitar','Remove')}</button></div></li>`;
  }).join(''):`<li class="empty">${tr('Aún no hay acordes guardados.','No saved chords yet.')}</li>`;
  $('savedProgs').innerHTML=lib.projects.length?lib.projects.map((pr,i)=>{
    const pats=pr.patterns.map(p=>`${p.name||tr('Sin nombre','Untitled')} (${segs(p).length} ${tr('acordes','chords')})`).join(' · ');
    return `<li><div style="min-width:0"><span class="n">${esc(pr.name||tr('Sin nombre','Untitled'))}</span><span class="v">${pr.bpm} BPM · ${pr.patterns.length} pattern${pr.patterns.length===1?'':'s'}: ${esc(pats)}</span></div><div class="acts"><button class="sbtn" data-pload="${i}">${tr('Abrir','Open')}</button><button class="sbtn" data-pdel="${i}" aria-label="${tr('Quitar','Remove')} ${esc(pr.name)}">${tr('Quitar','Remove')}</button></div></li>`;
  }).join(''):`<li class="empty">${tr('Aún no hay proyectos guardados. «Guardar» en la barra superior guarda el proyecto con todos sus patterns.','No saved projects yet. “Save project” in the top bar saves the project with all its patterns.')}</li>`;
}
function openProject(pr){
  stopProg(); commit(); hist.length=0; fut.length=0;
  st.proj=normProject(JSON.parse(JSON.stringify(pr))); st.prog=activePat(st.proj);
  R.sel.clear(); st.segA=null; st.src='builder'; R.start=0; render(); R.el.scrollLeft=0; centerRoll();
}
function setPattern(id){
  const p=st.proj.patterns.find(x=>x.id===id); if(!p) return;
  stopProg(); st.proj.active=id; st.prog=p; R.sel.clear(); st.segA=null; if(st.src!=='builder') st.src='builder'; R.start=0; delArm=false;
  render(); R.el.scrollLeft=0; centerRoll();
}
let delArm=false, delTimer;
// The sign hangs still and swings once per click (restarting the swing if it is still moving)
{ const sign=document.querySelector('.sign');
  sign.addEventListener('click',()=>{ sign.classList.remove('swing'); void sign.offsetWidth; sign.classList.add('swing'); });
  sign.addEventListener('animationend',()=>sign.classList.remove('swing')); }

// Arrows only while the tabs overflow; the active tab is brought into view by scrolling the strip alone
// (scrollIntoView also scrolled the page sideways)
function syncPatScroll(){
  const t=$('patTabs'), over=t.scrollWidth>t.clientWidth+1;
  $('bPatPrev').hidden=$('bPatNext').hidden=!over;
  $('bPatPrev').disabled=t.scrollLeft<=0; $('bPatNext').disabled=t.scrollLeft+t.clientWidth>=t.scrollWidth-1;
}
function showPatTab(id){
  const t=$('patTabs'), b=t.querySelector(`[data-id="${id}"]`);
  syncPatScroll(); if(!b) return;
  const r=b.getBoundingClientRect(), c=t.getBoundingClientRect();
  if(r.left<c.left) t.scrollLeft-=c.left-r.left; else if(r.right>c.right) t.scrollLeft+=r.right-c.right;
}
$('patTabs').addEventListener('scroll',syncPatScroll,{passive:true});
$('patTabs').addEventListener('wheel',e=>{ const t=$('patTabs'); if(t.scrollWidth<=t.clientWidth||Math.abs(e.deltaX)>=Math.abs(e.deltaY)) return; t.scrollLeft+=e.deltaY; e.preventDefault(); },{passive:false});
$('bPatPrev').onclick=()=>{ $('patTabs').scrollLeft-=$('patTabs').clientWidth*.8; };
$('bPatNext').onclick=()=>{ $('patTabs').scrollLeft+=$('patTabs').clientWidth*.8; };
window.addEventListener('resize',()=>showPatTab(st.prog.id));
$('patTabs').addEventListener('click',e=>{ const b=e.target.closest('.ptab'); if(b&&b.dataset.id!==st.prog.id) setPattern(b.dataset.id); });
$('patTabs').addEventListener('dblclick',e=>{ if(e.target.closest('.ptab')){ $('patName').focus(); $('patName').select(); } });
$('patTabs').addEventListener('keydown',e=>{
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight') return;
  e.preventDefault(); e.stopPropagation();
  const i=st.proj.patterns.indexOf(st.prog)+(e.key==='ArrowRight'?1:-1), p=st.proj.patterns[i];
  if(p){ setPattern(p.id); requestAnimationFrame(()=>{ const t=$('patTabs').querySelector(`[data-id="${p.id}"]`); if(t) t.focus(); }); }
});
$('patName').oninput=e=>{ st.prog.name=e.target.value; saveDraft(); const t=$('patTabs').querySelector(`[data-id="${st.prog.id}"] .pn`); if(t) t.textContent=`${st.proj.patterns.indexOf(st.prog)+1}. ${e.target.value||tr('Sin nombre','Untitled')}`; };
$('patName').onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); e.target.blur(); } };
$('patName').onchange=()=>{
  const g=guessInst(st.prog.name);
  if(g&&st.prog.inst.preset==='generico'){ st.prog.inst=instDefaults(g); toast(tr(`Instrumento detectado por el nombre: ${INSTRUMENTS[g].label}`,`Instrument detected from the name: ${INSTRUMENTS[g].label}`)); }
  render();
};
$('projName').oninput=e=>{st.proj.name=e.target.value; saveDraft();};
$('projName').onchange=()=>render();
// New-pattern form: name, instrument (suggested from the name until the user picks one) and empty or copied notes
let npTouched=false;
const NP_HINT=()=>tr('El instrumento se sugiere según el nombre (por ejemplo «Violas - 1»).','The instrument is suggested from the name (for example “Violas - 1”).');
function openNewPat(show){
  $('newPat').hidden=!show; $('patEdit').hidden=show; $('bPatAdd').setAttribute('aria-expanded',show);
  if(!show) return;
  npTouched=false; $('npName').value=''; $('npName').placeholder=`Pattern ${st.proj.patterns.length+1}`; $('npInst').value='generico'; $('npFrom').value='empty';
  $('npHint').textContent=NP_HINT();
  $('npName').focus();
}
$('bPatAdd').onclick=()=>openNewPat($('newPat').hidden);
$('npCancel').onclick=()=>openNewPat(false);
$('npName').oninput=()=>{
  if(npTouched) return;
  const g=guessInst($('npName').value); $('npInst').value=g||'generico';
  $('npHint').textContent=g?tr(`Instrumento sugerido por el nombre: ${INSTRUMENTS[g].label}. Puedes cambiarlo.`,`Instrument suggested from the name: ${INSTRUMENTS[g].label}. You can change it.`):tr('Sin sugerencia para ese nombre; elige el instrumento a mano.','No suggestion for that name; pick the instrument by hand.');
};
$('npInst').onchange=()=>{ npTouched=true; };
$('newPat').addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); openNewPat(false); } });
$('newPat').onsubmit=e=>{
  e.preventDefault();
  const name=$('npName').value.trim()||$('npName').placeholder;
  let p;
  if($('npFrom').value==='dup'){ p=JSON.parse(JSON.stringify(st.prog)); p.id=uid(); p.notes.forEach(n=>n.id=uid()); delete p.expr; }
  else p=newPattern(name,st.prog.beats);
  p.name=name; p.inst=instDefaults($('npInst').value);
  st.proj.patterns.push(p); openNewPat(false); setPattern(p.id);
  requestAnimationFrame(()=>showPatTab(p.id));
  toast(tr(`Pattern «${name}» creado · ${INSTRUMENTS[p.inst.preset].label}`,`Pattern “${name}” created · ${INSTRUMENTS[p.inst.preset].label}`));
};
// bend range and native glide belong to the pattern (the channel it goes to); hidden for drums
function syncGlide(){
  const p=st.prog, drum=isDrum(p);
  $('patBend').closest('.fld').hidden=$('patGlideNative').closest('.fld').hidden=drum;
  if(document.activeElement!==$('patBend')) $('patBend').value=rangeOf(p);
  $('patGlideNative').checked=!!p.glideNative;
}
$('patBend').onchange=e=>{ const v=Math.round(+e.target.value); if(v>=1&&v<=24){ if(v===BEND_RANGE) delete st.prog.bend; else st.prog.bend=v; } render(); };
$('patGlideNative').onchange=e=>{ if(e.target.checked) st.prog.glideNative=true; else delete st.prog.glideNative; render(); };
function syncVol(){ const v=Math.round(mixOf(st.prog)*100); if(document.activeElement!==$('patVol')){ $('patVol').value=v; fillRange($('patVol')); } $('patVolOut').textContent=v+' %'; }
$('patVol').oninput=e=>{ const v=+e.target.value/100; setMix(st.prog,v); savePrefs(); $('patVolOut').textContent=e.target.value+' %'; if(P.bus) P.bus.gain.setTargetAtTime(v,audio().currentTime,.03); };
$('topInst').onchange=e=>{ if(e.target.value==='custom') return; st.prog.inst=instDefaults(e.target.value); render(); toast(tr(`Instrumento de «${st.prog.name||'este pattern'}»: ${INSTRUMENTS[e.target.value].label}`,`Instrument of “${st.prog.name||'this pattern'}”: ${INSTRUMENTS[e.target.value].label}`)); };
$('bPatDup').onclick=()=>{
  const c=JSON.parse(JSON.stringify(st.prog)); c.id=uid(); c.name=(st.prog.name||'Pattern')+tr(' (copia)',' (copy)'); c.notes.forEach(n=>n.id=uid());
  st.proj.patterns.splice(st.proj.patterns.indexOf(st.prog)+1,0,c); setPattern(c.id); toast(tr('Pattern duplicado','Pattern duplicated'));
};
$('bPatDel').onclick=()=>{
  if(st.proj.patterns.length<2){ toast(tr('El proyecto necesita al menos un pattern.','The project needs at least one pattern.')); return; }
  if(!delArm){ delArm=true; renderProgression(); clearTimeout(delTimer); delTimer=setTimeout(()=>{delArm=false; renderProgression();},3000); return; }
  delArm=false; const i=st.proj.patterns.indexOf(st.prog); const name=st.prog.name;
  st.proj.patterns.splice(i,1); hist.length=0; fut.length=0; setPattern(st.proj.patterns[Math.max(0,i-1)].id); toast(tr(`Pattern «${name||'sin nombre'}» borrado`,`Pattern “${name||'untitled'}” deleted`));
};
$('bSave').onclick=()=>{ if(!st.notes.size) return; lib.chords.unshift({id:uid(),notes:[...st.notes].sort((a,b)=>a-b),root:lastCur?lastCur.root:null,sym:lastCur?lastCur.type.sym:null}); persistLib(); renderLibrary(); toast(tr('Acorde guardado en la biblioteca','Chord saved to the library')); };
$('savedChords').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.load!=null){const s=lib.chords[+b.dataset.load]; commit(); st.notes=new Set(s.notes); st.lockedRoot=null; st.prefer={root:s.root,sym:s.sym}; st.src='builder'; st.segA=null; render(); centerKeyboard();}
  if(b.dataset.add!=null){const s=lib.chords[+b.dataset.add]; st.notes=new Set(s.notes); st.prefer={root:s.root,sym:s.sym}; renderActive(); addAtEnd();}
  if(b.dataset.del!=null){lib.chords.splice(+b.dataset.del,1); persistLib(); renderLibrary();}
});
$('savedProgs').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.pload!=null){ openProject(lib.projects[+b.dataset.pload]); toast(tr('Proyecto abierto','Project opened')); }
  if(b.dataset.pdel!=null){ lib.projects.splice(+b.dataset.pdel,1); persistLib(); render(); }
});
$('bProgSave').onclick=()=>{
  if(!st.proj.name) st.proj.name=tr('Proyecto sin nombre','Untitled project');
  const p=JSON.parse(JSON.stringify(st.proj));
  const i=lib.projects.findIndex(x=>x.id===p.id);
  if(i>=0) lib.projects[i]=p; else lib.projects.unshift(p);
  persistLib(); render(); toast(i>=0?tr('Proyecto actualizado en la biblioteca','Project updated in the library'):tr('Proyecto guardado en la biblioteca','Project saved to the library'));
};
$('bProgNew').onclick=()=>{
  openProject({id:uid(),name:'',bpm:st.proj.bpm,seed:newSeed(),patterns:[newPattern('Pattern 1',st.prog.beats)]});
  $('projName').focus();
};

// The current pattern's text can be edited by hand; while it has edits for this pattern, renders leave it alone
let textEdit=null; // id of the pattern whose text has unapplied edits
function renderExport(){
  if(st.tab!=='io') return;
  const pat=st.exportMode==='pat';
  if(!(pat&&textEdit===st.prog.id)){ textEdit=null; $('exportText').value=st.exportMode==='lib'?libText(lib,st):st.exportMode==='proj'?projectText(st.proj,st):projectText(st.proj,st,st.prog); }
  $('exportText').readOnly=!pat; $('bApplyText').hidden=!pat; $('bResetText').hidden=!textEdit;
  if(!pat) $('applyWarn').hidden=true;
  $('segExport').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===st.exportMode));
}
$('segExport').onclick=e=>{const b=e.target.closest('button'); if(!b) return; st.exportMode=b.dataset.v; savePrefs(); renderExport();};
$('exportText').addEventListener('input',()=>{ if(st.exportMode!=='pat') return; textEdit=st.prog.id; $('bResetText').hidden=false; });
$('bResetText').onclick=()=>{ textEdit=null; $('applyWarn').hidden=true; renderExport(); };
// one parsed pattern (from parseText) as a pattern of this app
function patFromText(ps){
  const glide=ps.bend?{bend:ps.bend,...(ps.glideNative?{glideNative:true}:{})}:{};
  const blocks=ps.steps.map(p=>({...pickInterp(p,st),beats:p.beats||4}));
  if(ps.notes.length){ const pt=normProg({id:uid(),name:ps.name||'Pattern',beats:4,notes:ps.notes,names:{},...glide}); blocks.forEach(b=>{ if(b.root!=null) pt.names[sigOf(b.notes)]={root:b.root,sym:b.sym}; }); return pt; }
  return normProg({id:uid(),name:ps.name||'Pattern',beats:4,steps:blocks,...glide});
}
let textApply=null; // the pattern read from the text, waiting for the warning to be confirmed
$('bApplyText').onclick=()=>{
  const pats=parseText($('exportText').value,st).projects.flatMap(pr=>pr.patterns);
  if(!pats.length){ $('applyWarn').hidden=true; toast(tr('No encontré notas con octava (por ejemplo C4 o 60).','No notes with octave found (for example C4 or 60).')); return; }
  const ps=pats.find(x=>x.name===st.prog.name)||pats[0];
  textApply=patFromText(ps);
  const was=st.prog.notes.length, now=textApply.notes.length, name=st.prog.name||tr('Sin nombre','Untitled');
  $('applyWarnMsg').innerHTML=tr(
    `<b>Atención:</b> las ${was} nota${was===1?'':'s'} del pattern «${esc(name)}» se reemplazan por las ${now} del texto${pats.length>1?` (el texto trae ${pats.length} patterns; se usa «${esc(ps.name||'Pattern')}»)`:''}${st.prog.expr?'. La expresión aplicada se quita':''}. Ctrl+Z lo deshace.`,
    `<b>Warning:</b> the ${was} note${was===1?'':'s'} of pattern “${esc(name)}” are replaced by the ${now} in the text${pats.length>1?` (the text has ${pats.length} patterns; “${esc(ps.name||'Pattern')}” is used)`:''}${st.prog.expr?'. The applied expression is removed':''}. Ctrl+Z undoes it.`);
  $('applyWarn').hidden=false; $('bApplyOk').focus();
};
$('bApplyCancel').onclick=()=>{ textApply=null; $('applyWarn').hidden=true; $('bApplyText').focus(); };
$('bApplyOk').onclick=()=>{
  if(!textApply) return;
  commit();
  const p=st.prog; p.notes=textApply.notes; p.names=textApply.names; delete p.expr;
  textApply=null; textEdit=null; $('applyWarn').hidden=true; R.sel=new Set(); st.segA=null;
  render(); $('bApplyText').focus();
  toast(tr(`Texto aplicado: ${p.notes.length} nota${p.notes.length===1?'':'s'} · Ctrl+Z lo deshace`,`Text applied: ${p.notes.length} note${p.notes.length===1?'':'s'} · Ctrl+Z undoes it`));
};
$('bCopy').onclick=()=>{
  const t=$('exportText');
  try{ navigator.clipboard.writeText(t.value).then(()=>toast(tr('Texto copiado','Text copied')),()=>{t.focus();t.select();toast(tr('Selecciona y copia con Ctrl+C','Select it and copy with Ctrl+C'));}); }
  catch(e){ t.focus(); t.select(); toast(tr('Selecciona y copia con Ctrl+C','Select it and copy with Ctrl+C')); }
};
$('bDownload').onclick=()=>{
  try{
    const base=st.exportMode==='lib'?tr('biblioteca-acordes','chord-library'):st.exportMode==='proj'?fileBase(st.proj.name):fileBase((st.proj.name||tr('proyecto','project'))+'-'+(st.prog.name||'pattern'));
    saveFile(base+'.txt',$('exportText').value,'text/plain;charset=utf-8');
    toast(tr('Archivo descargado','File downloaded'));
  }catch(e){ toast(tr('No se pudo descargar. Usa «Copiar».','Could not download. Use “Copy”.')); }
};
$('bImport').onclick=()=>{
  const res=parseText($('importText').value,st);
  if(!res.projects.length&&!res.chords.length){ toast(tr('No encontré notas con octava (por ejemplo C4 o 60).','No notes with octave found (for example C4 or 60).')); return; }
  let np=0, nc=0, dup=0, first=null;
  const nsig=pr=>pr.patterns.map(p=>p.notes.map(n=>`${n.m}@${n.s}:${n.l}:${n.v}`).sort().join(',')).join('|');
  res.chords.forEach(p=>{const c=pickInterp(p,st); if(lib.chords.some(x=>sigOf(x.notes)===sigOf(c.notes))){dup++;return;} lib.chords.push({id:uid(),...c}); nc++;});
  res.projects.forEach(s=>{
    const pats=s.patterns.map(patFromText);
    const pr=normProject({id:uid(),name:s.name||tr('Importado','Imported'),bpm:s.bpm||90,seed:s.seed||newSeed(),patterns:pats});
    const same=lib.projects.find(x=>x.name===pr.name&&nsig(x)===nsig(pr));
    if(same){ dup++; if(!first) first=same; return; }
    lib.projects.unshift(pr); np++; if(!first) first=pr;
  });
  persistLib();
  if(first) openProject(first); else render();
  toast(tr(`Importado: ${np} proyecto${np===1?'':'s'}, ${nc} acorde${nc===1?'':'s'}${dup?` · ${dup} repetido${dup===1?'':'s'} omitido${dup===1?'':'s'}`:''}`,
    `Imported: ${np} project${np===1?'':'s'}, ${nc} chord${nc===1?'':'s'}${dup?` · ${dup} duplicate${dup===1?'':'s'} skipped`:''}`));
};

const exId=k=>'ex'+k[0].toUpperCase()+k.slice(1);
function syncExOut(){ document.querySelectorAll('#exControls output').forEach(o=>{ o.textContent=$(o.dataset.for).value+(o.dataset.unit||''); fillRange($(o.dataset.for)); }); $('exArt').disabled=!$('exArtOn').checked; }
function fillEx(){ const e=st.ex; $('exPreset').value=e.preset; EX_KEYS.forEach(k=>{ $(exId(k)).value=e[k]; }); $('exArtOn').checked=!!e.artOn; syncExOut(); }
function readEx(){ const e={preset:'custom'}; EX_KEYS.forEach(k=>{ const v=$(exId(k)).value; e[k]=k==='arc'?v:+v; }); e.artOn=$('exArtOn').checked; return e; }
$('exPreset').onchange=e=>{ if(e.target.value==='custom') return; st.ex=exDefaults(e.target.value); fillEx(); savePrefs(); };
$('exControls').addEventListener('input',()=>{ st.ex=readEx(); $('exPreset').value='custom'; syncExOut(); savePrefs(); });
// selects whose options come from the data tables; refilled when the language changes
function fillSelects(){
  const keep=['npInst','grStyle'].map(id=>[id,$(id).value]);
  $('exPreset').innerHTML=Object.entries(FEELINGS).map(([k,f])=>`<option value="${k}">${f.label}</option>`).join('')+`<option value="custom">${tr('Personalizado','Custom')}</option>`;
  const I=Object.entries(INSTRUMENTS), opts=[...new Set(I.map(([,x])=>x.group))].map(g=>`<optgroup label="${g}">`+I.filter(([,x])=>x.group===g).map(([k,x])=>`<option value="${k}">${x.label}</option>`).join('')+'</optgroup>').join('');
  $('inPreset').innerHTML=opts+`<option value="custom">${tr('Personalizado','Custom')}</option>`;
  $('topInst').innerHTML=opts+`<option value="custom" disabled>${tr('Personalizado (ajústalo en Expresión)','Custom (adjust it in Expression)')}</option>`;
  $('npInst').innerHTML=opts;
  $('grStyle').innerHTML=Object.entries(GROOVES).map(([k,g])=>`<option value="${k}">${g.label}</option>`).join('');
  keep.forEach(([id,v])=>{ if(v) $(id).value=v; });
}
fillSelects();
const inId=k=>'in'+k[0].toUpperCase()+k.slice(1);
function syncInOut(){ $('instControls').querySelectorAll('output').forEach(o=>{ const v=+$(o.dataset.for).value; o.textContent=o.dataset.note?noteText(plainSpell(v,st),st):v+(o.dataset.unit==='/8ª'?tr('/8ª','/8ve'):o.dataset.unit||''); fillRange($(o.dataset.for)); }); }
function fillInst(){ const e=st.prog.inst; $('inPreset').value=e.preset; IN_KEYS.forEach(k=>$(inId(k)).value=e[k]); syncInOut(); }
function readInst(){ const e={preset:'custom'}; IN_KEYS.forEach(k=>e[k]=+$(inId(k)).value); if(e.min>e.max) [e.min,e.max]=[e.max,e.min]; return e; }
$('inPreset').onchange=e=>{ if(e.target.value==='custom') return; st.prog.inst=instDefaults(e.target.value); fillInst(); render(); };
$('instControls').addEventListener('input',()=>{ st.prog.inst=readInst(); $('inPreset').value='custom'; syncInOut(); saveDraft(); });
$('instControls').addEventListener('change',()=>render());
function applyExpression(flat){
  if(isDrum(st.prog)) return applyDrumExpression(flat);
  const ns=velTargets(); if(!ns.length) return;
  commit();
  const E=st.ex, napp=expressPattern(st.prog,ns,E,st.proj.seed,flat,st);
  const vs=ns.map(n=>n.v);
  st.segA=null; render();
  const n=ns.length, s=n===1?'':'s';
  toast(flat?tr(`Velocity ${E.base} en ${n} nota${s}`,`Velocity ${E.base} on ${n} note${s}`):tr(`Expresión aplicada a ${n} nota${s}: velocity de ${Math.min(...vs)} a ${Math.max(...vs)}${napp?` · ${napp} con apoyatura o nota de paso`:''}`,
    `Expression applied to ${n} note${s}: velocity ${Math.min(...vs)} to ${Math.max(...vs)}${napp?` · ${napp} with appoggiatura or passing note`:''}`));
}
$('bVelApply').onclick=()=>applyExpression(false); $('bVelFlat').onclick=()=>applyExpression(true);
$('bAutoVel').onclick=()=>applyExpression(false);
$('bSeed').onclick=()=>{ st.proj.seed=newSeed(); render(); toast(tr(`Semilla nueva: ${st.proj.seed}. Aplica la expresión otra vez para usarla.`,`New seed: ${st.proj.seed}. Apply the expression again to use it.`)); };

// one pattern downloads as .mid; several go together in a .zip
function downloadMidi(pats){
  pats=pats.filter(p=>p.notes.length);
  if(!pats.length){ toast(tr('No hay notas para exportar.','There are no notes to export.')); return; }
  let skipped=0;
  const proj=fileBase(st.proj.name);
  const files=pats.map(p=>{ const r=midiFile(p,st.proj.bpm,st); skipped+=r.skipped; const i=st.proj.patterns.indexOf(p)+1; return {name:`${proj}-${String(i).padStart(2,'0')}-${fileBase(p.name||'pattern')}.mid`,data:r.bytes}; });
  try{
    if(files.length>1) saveFile(proj+'-patterns-midi.zip',zipFiles(files));
    else saveFile(files[0].name,files[0].data,'audio/midi');
    const flat=pats.every(p=>p.notes.every(n=>n.v===pats[0].notes[0].v));
    const nf=files.length, sh=st.midiShift?`${st.midiShift>0?'+':''}${st.midiShift/12} oct`:'';
    // FL drops pitch bend and controllers from a .mid (tested on import and through the Event Editor)
    const gl=pats.some(p=>!isDrum(p)&&hasGlide(p));
    toast(tr(`MIDI descargado (${nf} archivo${nf>1?'s':''}): ${nf>1?'descomprime el .zip y arrastra cada .mid a FL':'arrástralo a FL'}${sh?` · transpuesto ${sh}`:''}${skipped?` · ${skipped} nota${skipped>1?'s':''} sobre MIDI 127 omitida${skipped>1?'s':''}`:''}${flat?` · todas las notas van con la misma velocity; usa «Aplicar expresión» si quieres dinámica`:''}${gl?` · FL no importa los slides ni el pitch bend de un .mid: para FL usa «Script de FL»`:''}`,
      `MIDI downloaded (${nf} file${nf>1?'s':''}): ${nf>1?'unzip it and drag each .mid into FL':'drag it into FL'}${sh?` · transposed ${sh}`:''}${skipped?` · ${skipped} note${skipped>1?'s':''} above MIDI 127 skipped`:''}${flat?` · every note has the same velocity; use “Apply expression” if you want dynamics`:''}${gl?` · FL does not import slides or pitch bend from a .mid: for FL use “FL script”`:''}`));
  }catch(e){ toast(tr('No se pudo descargar el MIDI.','Could not download the MIDI.')); }
}
$('bMidi').onclick=()=>downloadMidi([st.prog]);
// the pattern as an FL piano roll script, the only way FL's own slide and portamento notes get into FL
$('bFlScript').onclick=()=>{
  const p=st.prog;
  if(!p.notes.length){ toast(tr('No hay notas para exportar.','There are no notes to export.')); return; }
  const r=flScript(p,st), i=st.proj.patterns.indexOf(p)+1, k=r.skipped;
  try{
    saveFile(`${fileBase(st.proj.name)}-${String(i).padStart(2,'0')}-${fileBase(p.name||'pattern')}.pyscript`,r.text,'text/x-python;charset=utf-8');
    toast(tr(`Script de FL descargado: cópialo en ${FL_SCRIPT_DIR} y ejecútalo desde el menú Scripts del piano roll. Los slides de FL solo suenan con instrumentos nativos de FL.${k?` · ${k} nota${k>1?'s':''} fuera de MIDI omitida${k>1?'s':''}`:''}`,
      `FL script downloaded: copy it to ${FL_SCRIPT_DIR} and run it from the piano roll's Scripts menu. FL slides only sound with FL's native instruments.${k?` · ${k} note${k>1?'s':''} out of MIDI range skipped`:''}`));
  }catch(e){ toast(tr('No se pudo descargar el script.','Could not download the script.')); }
};
// the pattern's slides and portamentos as an automation clip of Channel pitch, for VST instruments (flpitch.js)
function pitchHelp(p,r){
  const R=PITCH_RANGE, k=r.skipped, c=r.clashes, li=x=>`<li>${x}</li>`;
  $('pitchTitle').textContent=tr('Slides con un VST','Slides with a VST');
  $('pitchSub').textContent=tr('ejemplo: sforzando','example: sforzando');
  $('pitchBody').innerHTML=[
    `<p>${tr(`El .fst es un clip de automatización de Channel pitch con los slides y portamentos de «${esc(p.name||'Pattern')}». Las notas van en el .mid del pattern. En FL Studio:`,`The .fst is a Channel pitch automation clip with the slides and portamentos of “${esc(p.name||'Pattern')}”. The notes go in the pattern’s .mid. In FL Studio:`)}</p>`,
    '<ol>',
    li(tr(`En la ventana del canal, pon <b>PITCH RANGE</b> en ${R}.`,`In the channel window, set <b>PITCH RANGE</b> to ${R}.`)),
    li(tr(`En el instrumento, pon el rango de pitch bend en ${R} (en sforzando, <b>PB RANGE</b>).`,`In the instrument, set the pitch bend range to ${R} (in sforzando, <b>PB RANGE</b>).`)),
    li(tr('Arrastra el .fst al Channel rack.','Drag the .fst into the Channel rack.')),
    li(tr('En el clip, <b>Target links</b> → <b>+</b> → <b>OK</b> → mueve la perilla <b>PITCH</b> del canal → <b>+</b> otra vez.','In the clip, <b>Target links</b> → <b>+</b> → <b>OK</b> → move the channel’s <b>PITCH</b> knob → <b>+</b> again.')),
    li(tr('Clic derecho en la perilla <b>PITCH</b> → <b>Reset</b>.','Right-click the <b>PITCH</b> knob → <b>Reset</b>.')),
    li(tr('Un solo clip de pitch por canal: borra los otros clips de pitch de ese canal.','One pitch clip per channel: delete the other pitch clips of that channel.')),
    '</ol>',
    `<p>${tr('Channel pitch mueve todo el canal: las voces con acordes van separadas, cada una en su propio canal.','Channel pitch moves the whole channel: voices with chords go apart, each on its own channel.')}</p>`,
    c?`<p><b>${tr(`Atención: ${c} nota${c>1?'s':''} suena${c>1?'n':''} mientras otra voz está desplazada y también se desafina${c>1?'n':''}. Sepáralas en otro canal.`,`Warning: ${c} note${c>1?'s':''} sound${c>1?'':'s'} while another voice is bent and get${c>1?'':'s'} detuned too. Move ${c>1?'them':'it'} to another channel.`)}</b></p>`:'',
    k?`<p><b>${tr(`${k} slide${k>1?'s':''} o portamento${k>1?'s':''} no entra${k>1?'n':''} en el clip: salto${k>1?'s':''} de más de ${R} semitonos o con otras notas sonando.`,`${k} slide${k>1?'s':''} or portamento${k>1?'s':''} left out of the clip: a jump over ${R} semitones or other notes sounding.`)}</b></p>`:'',
    p.glideNative?`<p><b>${tr('Este pattern usa deslizamiento nativo: su .mid ya parte las notas en cada slide. Para el clip, desactívalo y vuelve a bajar el .mid.','This pattern uses native glide: its .mid already splits the notes at each slide. For the clip, turn it off and download the .mid again.')}</b></p>`:'',
  ].join('');
  $('pitchDlg').showModal();
}
$('bPitchOk').onclick=()=>$('pitchDlg').close();
$('bPitchClip').onclick=()=>{
  const p=st.prog;
  if(!p.notes.length){ toast(tr('No hay notas para exportar.','There are no notes to export.')); return; }
  const r=pitchClip(p);
  if(!r){ toast(tr('Este pattern no tiene slides ni portamentos que muevan la altura.','This pattern has no slides or portamentos that move the pitch.')); return; }
  const i=st.proj.patterns.indexOf(p)+1;
  try{ saveFile(`${fileBase(st.proj.name)}-${String(i).padStart(2,'0')}-${fileBase(p.name||'pattern')}-pitch.fst`,r.bytes,'application/octet-stream'); }
  catch(e){ toast(tr('No se pudo descargar el clip.','Could not download the clip.')); return; }
  pitchHelp(p,r);
};
$('bPack').onclick=()=>{
  const pk=buildPack(st.proj,lib.chords,st);
  if(!pk.nprog&&!pk.nchord){ toast(tr('El proyecto no tiene notas ni acordes guardados.','The project has no notes and no saved chords.')); return; }
  try{
    saveFile(`${pk.base}-pack.zip`,zipFiles(pk.files));
    const sh=st.midiShift?`${st.midiShift>0?'+':''}${st.midiShift/12} oct`:'', k=pk.skipped;
    toast(tr(`Pack descargado: ${pk.nprog} progresión${pk.nprog===1?'':'es'}, ${pk.nchord} acorde${pk.nchord===1?'':'s'} en .mid y el texto del proyecto${sh?` · transpuesto ${sh}`:''}${k?` · ${k} nota${k>1?'s':''} sobre MIDI 127 omitida${k>1?'s':''}`:''}`,
      `Pack downloaded: ${pk.nprog} progression${pk.nprog===1?'':'s'}, ${pk.nchord} chord${pk.nchord===1?'':'s'} as .mid and the project text${sh?` · transposed ${sh}`:''}${k?` · ${k} note${k>1?'s':''} above MIDI 127 skipped`:''}`));
  }catch(e){ toast(tr('No se pudo descargar el pack.','Could not download the pack.')); }
};
$('bMidiAll').onclick=()=>downloadMidi(st.proj.patterns);
// one export button: a menu with the automatic choice first and every format after it
function exportKind(p){
  if(isDrum(p)||!hasGlide(p)) return 'mid';
  return p.glideNative?'script':'clip';
}
function openExport(show){
  $('exportList').hidden=!show; $('bExport').setAttribute('aria-expanded',show);
  if(!show) return;
  const p=st.prog;
  $('exportAutoHint').textContent=!p.notes.length?'':{mid:'→ .mid',script:tr('→ script de FL','→ FL script'),clip:tr('→ .zip con .mid y clip de pitch','→ .zip with .mid and pitch clip')}[exportKind(p)];
}
$('bExport').onclick=()=>openExport($('exportList').hidden);
$('exportList').addEventListener('click',e=>{ if(e.target.closest('button')) openExport(false); });
document.addEventListener('pointerdown',e=>{ if(!$('exportList').hidden&&!e.target.closest('.xmenu')) openExport(false); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!$('exportList').hidden){ openExport(false); $('bExport').focus(); } });
// .mid without slides, the FL script with native glide, and otherwise the .mid with its pitch clip in one .zip
$('bExportAuto').onclick=()=>{
  const p=st.prog, kind=exportKind(p);
  if(!p.notes.length){ toast(tr('No hay notas para exportar.','There are no notes to export.')); return; }
  if(kind==='mid'){ downloadMidi([p]); return; }
  if(kind==='script'){ $('bFlScript').click(); return; }
  const r=pitchClip(p);
  if(!r){ downloadMidi([p]); return; }
  const i=st.proj.patterns.indexOf(p)+1, base=`${fileBase(st.proj.name)}-${String(i).padStart(2,'0')}-${fileBase(p.name||'pattern')}`;
  try{ saveFile(base+'.zip',zipFiles([{name:base+'.mid',data:midiFile(p,st.proj.bpm,st).bytes},{name:base+'-pitch.fst',data:r.bytes}])); }
  catch(e){ toast(tr('No se pudo descargar el .zip.','Could not download the .zip.')); return; }
  pitchHelp(p,r);
};

function renderDrumMap(){
  if(st.tab!=='drum') return;
  $('drumMap').innerHTML=tr('<tr><th>Pieza</th><th>Tecla</th><th>MIDI</th><th>Canal en FL</th></tr>','<tr><th>Piece</th><th>Key</th><th>MIDI</th><th>FL channel</th></tr>')+Object.keys(DRUMS).map(Number).sort((a,b)=>a-b).map(m=>{const d=DRUMS[m]; return `<tr><td>${esc(d.n)}</td><td class="mono">${esc(noteText(plainSpell(m,st),st))}</td><td class="mono">${m}</td><td>${esc(d.ch)}</td></tr>`;}).join('');
}
// degree runs (I–vi–ii–V, vii° → I) stay in Unifont inside MGPixel labels, which draw lowercase as uppercase
const DEG='[♭♯]?(?:VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)[°ø+]?[0-9]*';
const DEG_RUN=new RegExp(`(^|[^A-Za-zÀ-ÿ])(${DEG}(?: ?[–→] ?${DEG})*)(?=$|[^A-Za-zÀ-ÿ])`,'g');
const degText=s=>esc(s).replace(DEG_RUN,(m,a,d)=>`${a}<span class="dg">${d}</span>`);
// the progression on the notebook sheet: key, ending and patterns, then one ruled row per chord;
// numbered brackets in the margin join the degrees of each recognized pattern
function analysisSheet(A,p){
  const ten=t=>tr(String(t).replace('.',','),String(t));
  const pats=A.found.map((f,k)=>({...f,k:k+1}));
  const head=`<div class="an-head"><div><p class="plaque">${esc(keyName(A.key,st))}</p>${A.alt?`<span class="lab">${tr('o','or')} ${esc(keyName(A.alt,st))}</span>`:''}</div>
    <div><span class="lab">${tr('Final','Ending')}</span><span class="stamp"><span>${A.cad?degText(A.cad):tr('sin cadencia final','no final cadence')}</span></span></div>
    ${p.expr?`<div><span class="lab">${tr('Expresión aplicada','Applied expression')}</span><span class="expr">${esc(exprSummary(p.expr))}</span></div>`:''}<div class="an-pats"><span class="lab">${tr('Patrones reconocidos','Recognized patterns')}</span><div>${pats.length?pats.map(f=>`<span class="tag"><b>${f.k}</b>${degText(f.name)}${f.wrap?tr(' (en bucle)',' (looping)'):''}</span>`).join(''):`<span class="none">${tr('Ninguno de los '+PATTERNS.length+' patrones conocidos.','None of the '+PATTERNS.length+' known patterns.')}</span>`}</div></div></div>`;
  const row=i=>{ const r=A.romans[i], lab=esc(A.rs[i].label), fn=FN_NAME[A.fn[i]];
    return `<div class="an-row"><span class="n">${i+1}</span><span class="main">${r?esc(r.text):lab}</span><span class="sub" title="${r?`${lab} · `:''}${fn} ${ten(A.ten[i])}"><span class="fn">${r?`<span class="sym">${lab}</span> · `:''}${fn}</span> <span class="ten">${ten(A.ten[i])}</span></span></div>`; };
  // a looping pattern gets two open brackets, one at each end of the sheet
  const N=A.rs.length, B=pats.filter(f=>!f.cycle).flatMap(f=>f.wrap?[{k:f.k,a:f.from,b:N-1,open:'b'},{k:f.k,a:0,b:f.to,open:'t'}]:[{k:f.k,a:f.from,b:f.to}]).sort((x,y)=>x.a-y.a||x.k-y.k);
  let rows='';
  for(let i=0;i<N;){
    if(!B.some(r=>r.a<=i&&i<=r.b)){ rows+=row(i++); continue; }
    // rows joined by overlapping brackets stay in one block, so no bracket splits across columns
    const a=i; let b=Math.max(...B.filter(r=>r.a<=i&&i<=r.b).map(r=>r.b)), grow=true;
    while(grow){ grow=false; for(const r of B) if(r.a<=b&&r.b>b){ b=r.b; grow=true; } }
    const G=B.filter(r=>r.a>=a&&r.a<=b), ks=[...new Set(G.map(r=>r.k))];
    rows+=`<div class="an-grp" style="padding-left:${ks.length*20+16}px">${G.map(r=>`<span class="br${r.open?' open-'+r.open:''}" style="left:${ks.indexOf(r.k)*20+14}px;top:calc(${r.a-a} * var(--rh) + ${r.open==='t'?6:4}px);height:calc(${r.b-r.a+1} * var(--rh) - ${r.open?12:8}px)" aria-hidden="true"><b>${r.k}</b>${r.open?'<i></i>':''}</span>`).join('')}`;
    for(let j=a;j<=b;j++) rows+=row(j);
    rows+='</div>'; i=b+1;
  }
  return `<div class="an">${head}<div class="an-rows"><span class="lines" aria-hidden="true">${'<b></b>'.repeat(N+2)}</span>${rows}</div>
    <div class="hint">${tr('Grado; al lado, el acorde, su función y su tensión (0 a 1). Las llaves numeradas del margen unen los grados de cada patrón reconocido; una llave abierta sigue en el otro extremo (patrón en bucle).','Degree; next to it, the chord, its function and its tension (0 to 1). The numbered brackets in the margin join the degrees of each recognized pattern; an open bracket continues at the other end (looping pattern).')}</div></div>`;
}
function drumSummaryHtml(p){
  const c={}; p.notes.forEach(n=>{ const k=DRUMS[n.m]?DRUMS[n.m].ch:tr('Otras teclas','Other keys'); c[k]=(c[k]||0)+1; });
  const n=p.notes.length;
  return `<div><div class="eyebrow">${tr('Pattern de batería','Drum pattern')}</div><div>${n} ${tr('golpe','hit')}${n===1?'':'s'}${n?' · '+Object.entries(c).map(([k,v])=>`${esc(k)} ${v}`).join(' · '):''}</div><div class="hint">${tr('Sin análisis armónico. La expresión usa reglas por pieza (pestaña Batería).','No harmonic analysis. Expression uses per-piece rules (Drums tab).')}</div></div>`;
}
function applyDrumExpression(flat){
  const ns=velTargets(); if(!ns.length) return;
  commit();
  const ghosts=expressDrums(st.prog,ns,st.ex,st.proj.seed,flat);
  const vs=ns.map(n=>n.v);
  st.segA=null; render();
  toast(flat?tr(`Velocity base en ${ns.length} golpes`,`Base velocity on ${ns.length} hits`):tr(`Expresión de batería en ${ns.length} golpes: velocity de ${Math.min(...vs)} a ${Math.max(...vs)}${ghosts?` · ${ghosts} notas fantasma`:''}`,
    `Drum expression on ${ns.length} hits: velocity ${Math.min(...vs)} to ${Math.max(...vs)}${ghosts?` · ${ghosts} ghost notes`:''}`));
}
$('bGroove').onclick=()=>{
  const style=$('grStyle').value, bars=Math.min(32,Math.max(1,Math.round(+$('grBars').value)||4)), fill=+$('grFill').value, crash=$('grCrash').checked;
  const p=normProg({id:uid(),name:tr(`Batería - ${GROOVES[style].label}`,`Drums - ${GROOVES[style].label}`),beats:4,notes:genGroove(style,bars,fill,crash),names:{}});
  p.inst=instDefaults('bateria'); st.proj.patterns.push(p); setPattern(p.id); applyExpression(false);
  $('grInfo').textContent=tr(`Creado «${p.name}»: ${p.notes.length} golpes en ${bars} compás${bars===1?'':'es'}.`,`Created “${p.name}”: ${p.notes.length} hits in ${bars} bar${bars===1?'':'s'}.`);
};

// each track of each file becomes a pattern of the open project
async function importMidiFiles(files){
  const added=[]; let dropped=0, tempo=null;
  for(const f of files){
    let res; try{ res=parseMidi(await f.arrayBuffer()); }catch(e){ toast(`${f.name}: ${e.message}.`); continue; }
    if(res.tempo&&!tempo) tempo=res.tempo;
    const base=f.name.replace(/\.midi?$/i,'');
    res.tracks.forEach((trk,i)=>{
      const keep=trk.notes.filter(n=>n.m>=LOW&&n.m<=HIGH); dropped+=trk.notes.length-keep.length; if(!keep.length) return;
      const name=res.tracks.length>1?`${base} · ${trk.name||tr('pista ','track ')+(i+1)}`:base;
      const p=normProg({id:uid(),name,beats:4,notes:keep.map(({ch,...n})=>n),names:{}});
      if(trk.notes.every(n=>n.ch===9)) p.inst=instDefaults('bateria');
      st.proj.patterns.push(p); added.push(p);
    });
  }
  if(!added.length){ if(files.length) toast(tr('No encontré notas para importar en ese archivo.','No notes to import found in that file.')); return; }
  const onlyNew=st.proj.patterns.every(p=>!p.notes.length||added.includes(p));
  if(tempo&&onlyNew) st.proj.bpm=Math.round(tempo);
  setPattern(added[0].id);
  const nn=added.reduce((a,p)=>a+p.notes.length,0);
  toast(tr(`Importado: ${added.length} pattern${added.length===1?'':'s'}, ${nn} notas${tempo?` · tempo del archivo ${Math.round(tempo)} BPM${onlyNew?'':' (el del proyecto no cambió)'}`:''}${dropped?` · ${dropped} notas fuera de MIDI 12–132 omitidas`:''}`,
    `Imported: ${added.length} pattern${added.length===1?'':'s'}, ${nn} notes${tempo?` · file tempo ${Math.round(tempo)} BPM${onlyNew?'':' (the project’s did not change)'}`:''}${dropped?` · ${dropped} notes outside MIDI 12–132 skipped`:''}`));
}
$('bMidiIn').onclick=()=>$('midiFile').click();
$('midiFile').onchange=e=>{ importMidiFiles([...e.target.files]); e.target.value=''; };
R.el.addEventListener('dragover',e=>{ if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){ e.preventDefault(); R.el.classList.add('drop'); } });
R.el.addEventListener('dragleave',()=>R.el.classList.remove('drop'));
R.el.addEventListener('drop',e=>{ e.preventDefault(); R.el.classList.remove('drop'); const fs=[...e.dataTransfer.files].filter(f=>/\.midi?$/i.test(f.name)); if(fs.length) importMidiFiles(fs); else toast(tr('Suelta un archivo .mid o .midi.','Drop a .mid or .midi file.')); });

function sepOpts(){ return {method:$('sepMethod').value,balance:+$('sepBalance').value,bass:$('sepBass').checked,bassMax:+$('sepBassMax').value,mono:$('sepMono').checked}; }
function fillBassSelect(){
  const s=$('sepBassMax'), v=s.value||'55';
  s.innerHTML=Array.from({length:25},(_,i)=>36+i).map(m=>`<option value="${m}">${noteText(plainSpell(m,st),st)}</option>`).join(''); s.value=v;
}
function openSep(show){ $('sepForm').hidden=!show; $('bSep').setAttribute('aria-expanded',show); if(show){ fillBassSelect(); $('sepMethod').focus(); } }
$('bSep').onclick=()=>openSep($('sepForm').hidden);
$('sepCancel').onclick=()=>openSep(false);
$('sepForm').addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); openSep(false); } });
function sepCount(r){ return tr(`Melodía: ${r.mel.length} notas · Bajo: ${r.bass.length} · Acordes y voces internas: ${r.chords.length}.`,`Melody: ${r.mel.length} notes · Bass: ${r.bass.length} · Chords and inner voices: ${r.chords.length}.`); }
$('sepPreview').onclick=()=>{
  const r=separateVoices(st.prog,sepOpts());
  R.sel=new Set(r.mel.map(n=>n.id)); selChanged(true);
  $('sepInfo').textContent=sepCount(r)+tr(' La melodía quedó seleccionada (relleno invertido) en el piano roll.',' The melody is now selected (inverted fill) in the piano roll.');
};
$('sepForm').onsubmit=e=>{
  e.preventDefault();
  const p=st.prog, opt=sepOpts(), r=separateVoices(p,opt);
  if(!r.mel.length&&!r.bass.length){ $('sepInfo').textContent=tr('No encontré una melodía ni un bajo separables con estos ajustes.','No separable melody or bass found with these settings.'); return; }
  const base=p.name||'Pattern', made=separatePatterns(p,r,opt);
  st.proj.patterns.splice(st.proj.patterns.indexOf(p)+1,0,...made);
  openSep(false); setPattern(made[0].id);
  toast(tr(`${sepCount(r)} Creé ${made.length} pattern${made.length===1?'':'s'}; «${base}» queda igual.`,`${sepCount(r)} Created ${made.length} pattern${made.length===1?'':'s'}; “${base}” stays the same.`));
};

// ---------- controls ----------
$('noteChips').addEventListener('click',e=>{const b=e.target.closest('.chip[data-m]'); if(!b) return; toggleKey(+b.dataset.m);});
$('cands').addEventListener('click',e=>{
  const b=e.target.closest('.cand'); if(!b) return; st.pick=+b.dataset.i; renderActive();
  if(lastCur&&st.src==='seg'&&curSeg()&&sigOf(st.notes)===st.srcSig){ st.prog.names[st.srcSig]={root:lastCur.root,sym:lastCur.type.sym}; render(); }
});
$('bRoot').onclick=()=>{st.rootMode=!st.rootMode; renderActive();};
$('bUndo').onclick=undo; $('bRedo').onclick=redo;
// with a roll selection or a block chord picked, the buttons below edit those notes; otherwise the armed copy
function settleLive(live){ st.pick=0; if(st.src==='sel') selChanged(true); else render(); if(st.sound) playNotes([...new Set(live.map(n=>n.m))].sort((a,b)=>a-b),0); }
function shift(d){
  const live=liveNotes();
  if(live){ if(!live.length||live.some(n=>n.m+d<LOW||n.m+d>HIGH)) return; commit(); live.forEach(n=>{n.m+=d;}); settleLive(live); return; }
  const n=[...st.notes].map(m=>m+d); if(!n.length||n.some(m=>m<LOW||m>HIGH)) return;
  commit(); st.notes=new Set(n); if(st.lockedRoot!==null) st.lockedRoot=((st.lockedRoot+d)%12+12)%12;
  render(); if(st.sound) playNotes(n.sort((a,b)=>a-b),0);
}
$('bDown').onclick=()=>shift(-1); $('bUp').onclick=()=>shift(1);
$('bOctDown').onclick=()=>shift(-12); $('bOctUp').onclick=()=>shift(12);
function invert(up){
  const live=liveNotes();
  if(live){
    const ps=new Set(live.map(n=>n.m)); if(!ps.size) return;
    const p=up?Math.min(...ps):Math.max(...ps); let m=p+(up?12:-12); while(ps.has(m)) m+=up?12:-12; if(m>HIGH||m<LOW) return;
    commit(); live.filter(n=>n.m===p).forEach(n=>{n.m=m;}); settleLive(live); return;
  }
  const n=[...st.notes].sort((a,b)=>up?a-b:b-a); if(!n.length) return;
  let m=n[0]+(up?12:-12); while(st.notes.has(m)) m+=up?12:-12; if(m>HIGH||m<LOW) return;
  commit(); st.notes.delete(n[0]); st.notes.add(m); st.pick=0; render();
  if(st.sound) playNotes([...st.notes].sort((a,b)=>a-b),0);
}
$('bInvUp').onclick=()=>invert(true); $('bInvDown').onclick=()=>invert(false);
$('bPlay').onclick=()=>playNotes([...st.notes].sort((a,b)=>a-b),0.012);
$('bArp').onclick=()=>playNotes([...st.notes].sort((a,b)=>a-b),0.18);
$('bClear').onclick=()=>{ if(st.src==='sel'&&R.sel.size){ deleteSel(); return; } if(!st.notes.size) return; commit(); st.notes.clear(); st.lockedRoot=null; st.rootMode=false; st.pick=0; render(); };
$('zoom').oninput=e=>{const frac=(scroller.scrollLeft+scroller.clientWidth/2)/scroller.scrollWidth; kb.style.setProperty('--kw',e.target.value+'px'); scroller.scrollLeft=frac*scroller.scrollWidth-scroller.clientWidth/2; syncVp();};
$('rollZoom').oninput=e=>{ const vw=R.el.clientWidth-R.K, t=(R.el.scrollLeft+vw/2)/st.beatW; setZoom(+e.target.value); R.el.scrollLeft=t*st.beatW-vw/2; };
$('snap').onchange=e=>{ st.snap=+e.target.value; savePrefs(); drawRoll(); };
$('bpm').onchange=e=>{st.proj.bpm=Math.min(300,Math.max(30,Math.round(+e.target.value)||90)); if(P.playing) playProg(); render();};
$('beats').onchange=e=>{st.prog.beats=Math.min(64,Math.max(.25,Math.round((+String(e.target.value).replace(',','.')||4)*4)/4)); render();};
$('bProgPlay').onclick=()=>P.playing?stopProg():playProg();
$('bLoop').onclick=()=>{ st.loop=!st.loop; savePrefs(); $('bLoop').setAttribute('aria-pressed',st.loop); };
function segSync(){
  const set=(id,v)=>$(id).querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));
  set('segNames',st.naming); set('segAcc',st.accPref); set('segSound',st.sound?'on':'off'); set('segKeyNames',st.showNames?'on':'off');
  set('segOct',st.octConv); set('segShift',String(st.midiShift||0)); set('segLang',st.lang);
  document.querySelectorAll('.oct').forEach(o=>{ o.textContent='C'+(+o.dataset.o+octOff(st)); });
  const c4=noteText(plainSpell(60,st),st);
  $('octNote').textContent=tr(`Do central (MIDI 60, 261,63 Hz) = ${c4}. Solo cambia los nombres; el MIDI exportado no se mueve. Para mover las notas usa «Transponer».`,`Middle C (MIDI 60, 261.63 Hz) = ${c4}. It only changes the names; the exported MIDI does not move. To move the notes use “Transpose”.`);
}
$('segNames').onclick=e=>{const b=e.target.closest('button'); if(!b)return; st.naming=b.dataset.v; savePrefs(); render();};
$('segAcc').onclick=e=>{const b=e.target.closest('button'); if(!b)return; st.accPref=b.dataset.v; savePrefs(); render();};
$('segSound').onclick=e=>{const b=e.target.closest('button'); if(!b)return; st.sound=b.dataset.v==='on'; savePrefs(); segSync();};
$('segOct').onclick=e=>{const b=e.target.closest('button'); if(!b)return; st.octConv=b.dataset.v; savePrefs(); render();};
$('segShift').onclick=e=>{const b=e.target.closest('button'); if(!b)return; st.midiShift=+b.dataset.v; savePrefs(); segSync(); toast(st.midiShift?tr(`El MIDI exportado sube o baja ${st.midiShift/12} octava${Math.abs(st.midiShift)>12?'s':''}; la página no cambia.`,`The exported MIDI moves ${st.midiShift/12} octave${Math.abs(st.midiShift)>12?'s':''}; the page does not change.`):tr('El MIDI se exporta sin transponer.','The MIDI is exported without transposing.'));};
$('segKeyNames').onclick=e=>{const b=e.target.closest('button'); if(!b)return; st.showNames=b.dataset.v==='on'; savePrefs(); renderActive();};
$('segLang').onclick=e=>{const b=e.target.closest('button'); if(!b||b.dataset.v===st.lang)return; st.lang=b.dataset.v; setLang(st.lang); shareLang(st.lang); savePrefs(); applyLanguage();};
// another tab, or the site before coming back with the browser's back button, may have changed it
function followSharedLang(){ const l=sharedLang(); if(!l||l===st.lang) return; st.lang=l; setLang(l); savePrefs(); applyLanguage(); }
window.addEventListener('storage',e=>{ if(e.key===LANG_KEY) followSharedLang(); });
window.addEventListener('pageshow',e=>{ if(e.persisted) followSharedLang(); });
// texts written by code keep the language they were written in, so they are written again
function applyLanguage(){
  document.documentElement.lang=st.lang; translateStatic(); fillSelects(); fillEx(); setPlayBtn(P.playing); renderStoreStatus();
  $('npHint').textContent=NP_HINT(); $('grInfo').textContent='';
  if(EXAMPLE_NAME.includes(st.proj.name)){ st.proj.name=tr(...EXAMPLE_NAME); saveDraft(); }
  $('sepInfo').textContent=tr('La vista previa selecciona en el piano roll las notas que irían a la melodía. El pattern original no se toca.','The preview selects in the piano roll the notes that would go to the melody. The original pattern stays as it is.');
  render();
}
function showTab(t){
  st.tab=t; savePrefs();
  document.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===t));
  document.querySelectorAll('.dockpanel').forEach(p=>p.hidden=p.dataset.panel!==t);
  if(t==='kb') requestAnimationFrame(()=>{drawMini(); centerKeyboard();});
  renderDrumMap();
  renderExport();
}
$('tabs').onclick=e=>{const b=e.target.closest('.tab'); if(b) showTab(b.dataset.tab);};

document.addEventListener('keydown',e=>{
  const el=e.target instanceof Element?e.target:document.body, tag=el.tagName;
  if(el===R.cv||tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||el.isContentEditable) return;
  const onBtn=tag==='BUTTON';
  const k=e.key, mod=e.ctrlKey||e.metaKey;
  if(mod&&(k==='z'||k==='Z')){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if(mod&&(k==='y'||k==='Y')){ e.preventDefault(); redo(); return; }
  if(mod||e.altKey) return;
  if(k===' '&&!onBtn){ e.preventDefault(); P.playing?stopProg():playProg(); }
  else if(k==='Enter'&&!onBtn){ e.preventDefault(); addAtEnd(); }
  else if(k==='p'||k==='P'){ $('bPlay').click(); }
  else if(k==='ArrowLeft'){ e.preventDefault(); shift(e.shiftKey?-12:-1); }
  else if(k==='ArrowRight'){ e.preventDefault(); shift(e.shiftKey?12:1); }
  else if(k==='ArrowUp'){ e.preventDefault(); invert(true); }
  else if(k==='ArrowDown'){ e.preventDefault(); invert(false); }
  else if(k==='Escape'){ st.rootMode=false; renderActive(); }
});


// ---------- boot ----------
loadManifest().then(syncVol); // a pattern's volume belongs to its template channel, known once the manifest is in
readColors();
$('snap').value=String(st.snap); if($('snap').value==='') { st.snap=.25; $('snap').value='0.25'; }
$('rollZoom').value=Math.round(st.beatW);
document.addEventListener('input',e=>{ if(e.target.type==='range') fillRange(e.target); });
// pixel steppers of the number fields: step within min/max/step, then fire change as typing would
document.querySelectorAll('.step .sb').forEach(b=>b.onclick=()=>{ const i=b.closest('.step').querySelector('input'); b.classList.contains('up')?i.stepUp():i.stepDown(); i.dispatchEvent(new Event('change',{bubbles:true})); });
document.querySelectorAll('input[type=range]').forEach(fillRange);
if(!st.ex||!(st.ex.preset in FEELINGS||st.ex.preset==='custom')) st.ex=exDefaults('neutro');
fillEx();
render(); renderStoreStatus(); showTab(st.tab||'kb');
requestAnimationFrame(()=>{ rollSize(); centerRoll(); centerKeyboard(); drawRoll(); drawMini(); });
// the canvas does not trigger font loading by itself
if(document.fonts) Promise.all([R.F.small,R.F.lane].map(f=>document.fonts.load(f))).then(()=>drawRoll());

export { drawMini, lastCur, render, renderActive };
