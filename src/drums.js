// Drum kit of the FL template, drum expression rules and grooves.
import { T, fmtB, numB, uid } from './data.js';
import { hash01, progEnd } from './model.js';
import { noteText, plainSpell } from './analysis.js';
import { exprSummary, instText } from './expression.js';
import { tr } from './i18n.js';

// ---------- drums: the template's kit (read from Plantilla Suprema Mk.IX and its .sfz files) ----------
// s: short label for the roll · n: piece · p: role used by the drum expression rules · ch: FL channel
const DRUMS_ES={
  34:{s:'Bombo+',n:'Bombo (más sucio)',p:'kick',ch:'Bombo'},35:{s:'Bombo s',n:'Bombo (sucio)',p:'kick',ch:'Bombo'},36:{s:'Bombo',n:'Bombo (limpio)',p:'kick',ch:'Bombo'},
  37:{s:'Aro',n:'Caja: golpe de aro',p:'side',ch:'Caja'},38:{s:'Caja',n:'Caja',p:'snare',ch:'Caja'},39:{s:'Caja 2',n:'Caja (variante)',p:'snare',ch:'Caja'},40:{s:'Caja 3',n:'Caja (variante)',p:'snare',ch:'Caja'},
  41:{s:'Tom gr',n:'Tom grave',p:'tom',ch:'Toms'},43:{s:'Tom gr b',n:'Tom grave (borde)',p:'tom',ch:'Toms'},45:{s:'Tom med',n:'Tom medio',p:'tom',ch:'Toms'},47:{s:'Tom ag',n:'Tom agudo',p:'tom',ch:'Toms'},
  42:{s:'HH cerr',n:'Hi-hat cerrado',p:'hh',ch:'Hi-Hat'},44:{s:'HH pie',n:'Hi-hat con el pie',p:'hhp',ch:'Hi-Hat'},46:{s:'HH CC4',n:'Hi-hat (apertura según CC4)',p:'hho',ch:'Hi-Hat'},
  54:{s:'HH canto',n:'Hi-hat cerrado de canto',p:'hh',ch:'Hi-Hat'},56:{s:'HH splsh',n:'Hi-hat splash con el pie',p:'hhp',ch:'Hi-Hat'},58:{s:'HHc CC4',n:'Hi-hat de canto (apertura según CC4)',p:'hho',ch:'Hi-Hat'},80:{s:'HH ret',n:'Hi-hat: retorno del pedal',p:'hhp',ch:'Hi-Hat'},
  49:{s:'Crash',n:'Crash',p:'crash',ch:'Platillos'},50:{s:'Crash x',n:'Crash apagado',p:'choke',ch:'Platillos'},51:{s:'Ride',n:'Ride',p:'ride',ch:'Platillos'},52:{s:'Ride x',n:'Ride apagado',p:'choke',ch:'Platillos'},
  53:{s:'Campana',n:'Ride: campana',p:'bell',ch:'Platillos'},55:{s:'Ride b',n:'Ride: borde',p:'ride',ch:'Platillos'},57:{s:'Crash 2',n:'Crash (arco)',p:'crash',ch:'Platillos'},
  65:{s:'Djembe',n:'Djembe',p:'perc',ch:'Perc. Swirly'},66:{s:'Cencerro',n:'Cencerro',p:'perc',ch:'Perc. Swirly'},69:{s:'Bongó g',n:'Bongó grave',p:'perc',ch:'Perc. Swirly'},
  70:{s:'Darbuka',n:'Darbuka',p:'perc',ch:'Perc. Swirly'},71:{s:'Bongó a',n:'Bongó agudo',p:'perc',ch:'Perc. Swirly'},
};
// English short label and piece, by key; channels keep their template name unless listed
const DRUMS_EN={34:['Kick+','Kick (dirtier)'],35:['Kick d','Kick (dirty)'],36:['Kick','Kick (clean)'],37:['Side','Snare: side stick'],38:['Snare','Snare'],39:['Snare 2','Snare (variant)'],40:['Snare 3','Snare (variant)'],
  41:['Tom lo','Low tom'],43:['Tom lo e','Low tom (edge)'],45:['Tom mid','Mid tom'],47:['Tom hi','High tom'],
  42:['HH clsd','Closed hi-hat'],44:['HH foot','Pedal hi-hat'],46:['HH CC4','Hi-hat (opening by CC4)'],54:['HH edge','Closed hi-hat, edge'],56:['HH splsh','Pedal splash hi-hat'],58:['HHe CC4','Hi-hat edge (opening by CC4)'],80:['HH ret','Hi-hat: pedal release'],
  49:['Crash','Crash'],50:['Crash x','Crash choke'],51:['Ride','Ride'],52:['Ride x','Ride choke'],53:['Bell','Ride: bell'],55:['Ride e','Ride: edge'],57:['Crash 2','Crash (bow)'],
  65:['Djembe','Djembe'],66:['Cowbell','Cowbell'],69:['Bongo lo','Low bongo'],70:['Darbuka','Darbuka'],71:['Bongo hi','High bongo']};
const CH_EN={Bombo:'Kick',Caja:'Snare',Platillos:'Cymbals'};
const DRUMS=Object.fromEntries(Object.entries(DRUMS_ES).map(([m,d])=>[m,{get s(){return tr(d.s,DRUMS_EN[m][0]);},get n(){return tr(d.n,DRUMS_EN[m][1]);},p:d.p,get ch(){return tr(d.ch,CH_EN[d.ch]||d.ch);}}]));
function drumText(p,prefs){
  const L=[`# Pattern: ${p.name||tr('Sin nombre','Untitled')}`,tr(`# Batería · ${p.notes.length} golpes · total ${fmtB(progEnd(p))} tiempos`,`# Drums · ${p.notes.length} hit${p.notes.length===1?'':'s'} · total ${fmtB(progEnd(p))} beats`),`${tr('# Instrumento','# Instrument')}: ${instText(p.inst,prefs)}`];
  if(p.expr) L.push(`${tr('# Expresión','# Expression')}: ${exprSummary(p.expr)}`);
  L.push(tr('# Notas (exactas): nota | MIDI | inicio | duración | velocity | pieza — inicio y duración en tiempos de negra desde el compás 1','# Notes (exact): note | MIDI | start | length | velocity | piece — start and length in quarter-note beats from bar 1'));
  [...p.notes].sort((a,b)=>a.s-b.s||a.m-b.m).forEach(n=>L.push(`${noteText(plainSpell(n.m,prefs),prefs)} | ${n.m} | ${numB(n.s)} | ${numB(n.l)} | ${n.v||100}${DRUMS[n.m]?' | '+DRUMS[n.m].n:''}`));
  return L.join('\n');
}
// Drum expression: per-piece metric rules + the feeling's base, contrast, arc and seeded humanize
function expressDrums(p,ns,E,seed,flat){
  const I=p.inst, bar=4*T, a=E.accent*I.accent/100;
  const snares=p.notes.filter(n=>(DRUMS[n.m]||{}).p==='snare').length, beats=Math.max(4,Math.ceil(progEnd(p)/T));
  const dense=snares/beats>=2.5; // blast beats and rolls: no ghost notes
  const fillBars=new Set(p.notes.filter(n=>(DRUMS[n.m]||{}).p==='tom').map(n=>Math.floor(n.s/bar))); // snare in the back half of these bars is part of a fill
  const phraseLen=E.phrase?E.phrase*bar:Math.max(1,progEnd(p));
  let ghosts=0;
  ns.forEach(n=>{
    const role=(DRUMS[n.m]||{p:'other'}).p, inBar=n.s%bar, beat=Math.floor(inBar/T), sub=inBar%T, onBeat=sub===0;
    let dev=0, ghost=false;
    if(!flat){
      if(role==='kick') dev+=onBeat?(beat===0?a:beat===2?.6*a:.2*a):(sub===T/2?-.2*a:-.4*a);
      else if(role==='snare'&&beat>=2&&fillBars.has(Math.floor(n.s/bar))) dev+=a*.8*(inBar/bar-.5);
      else if(role==='snare'){ if(onBeat&&(beat===1||beat===3)) dev+=a; else if(onBeat) dev+=.3*a; else if(dense) dev-=.2*a; else if(sub===T/2) dev-=.3*a; else ghost=true; }
      else if(role==='side') dev+=onBeat?.2*a:-.2*a;
      else if(role==='hh'||role==='ride'||role==='perc'){ const k=role==='perc'?.6:1; if(onBeat) dev+=(beat===0?.7:.5)*a*k; else if(sub===T/2) dev+=0; else if(sub%32===0) dev-=.6*a*k; else dev-=.5*a*k; }
      else if(role==='hho') dev+=(onBeat?.6:.3)*a;
      else if(role==='hhp') dev-=.3*a;
      else if(role==='crash') dev+=inBar===0?a:.4*a;
      else if(role==='bell') dev+=.4*a;
      else if(role==='tom') dev+=a*.8*(inBar/bar-.5);
      else if(role!=='choke') dev+=onBeat?.5*a:-.3*a;
      const x=(n.s%phraseLen)/phraseLen;
      if(E.arc==='cresc') dev+=E.arcAmt*(x-.5); else if(E.arc==='dim') dev+=E.arcAmt*(.5-x); else if(E.arc==='arch') dev+=E.arcAmt*(Math.sin(Math.PI*x)-.5);
    }
    const hum=flat?0:Math.round((hash01(seed,n.m,n.s)*2-1)*E.human*I.human/100);
    const v=flat?E.base:ghost?Math.max(4,E.base*.15)+hum:E.base+(E.range/100)*(I.sens/100)*dev+hum;
    if(ghost) ghosts++;
    const raw=Math.min(127,Math.max(1,v)); n.v=Math.round(I.min+(raw-1)*(I.max-I.min)/126);
  });
  p.expr={...E,flat:!!flat,seed,inst:{...I},drums:true,scope:ns.length===p.notes.length?'todas':`${ns.length} seleccionadas`};
  return ghosts;
}
// Groove generator on the template's map. Positions in beats within a 4/4 bar.
const eighths=()=>[0,.5,1,1.5,2,2.5,3,3.5], quarters=()=>[0,1,2,3], sixteenths=()=>Array.from({length:16},(_,i)=>i/4);
const GROOVES={
  rock:    {label:'Rock 4/4',                                                              map:()=>({36:[0,2,2.5],38:[1,3],42:eighths()})},
  halftime:{get label(){return tr('Medio tiempo','Half-time');},                           map:()=>({36:[0,1.75,2.5],38:[2],42:eighths()})},
  balada:  {get label(){return tr('Balada (aro y ride)','Ballad (side stick and ride)');}, map:()=>({36:[0,2.5],37:[1,3],51:eighths()})},
  shuffle: {get label(){return tr('Shuffle (tresillos)','Shuffle (triplets)');},           map:()=>({36:[0,2],38:[1,3],42:[0,2/3,1,5/3,2,8/3,3,11/3]})},
  metal:   {get label(){return tr('Metal (doble bombo)','Metal (double kick)');},          map:()=>({36:sixteenths(),38:[1,3],51:quarters()})},
  blast:   {label:'Blast beat',                                                            map:()=>({36:sixteenths().filter((x,i)=>i%2===0),38:sixteenths().filter((x,i)=>i%2===1),49:quarters()})},
  marcha:  {get label(){return tr('Marcha (caja)','March (snare)');},                      map:()=>({36:[0,2],38:[0,.5,1,1.5,2,2.5,3,3.25,3.5,3.75]})},
  tribal:  {get label(){return tr('Épica tribal (toms)','Tribal epic (toms)');},           map:()=>({36:[0,1.5,2],41:[0,.75,1.5,2,2.75],45:[3,3.5],47:[3.25,3.75]})},
};
function genGroove(style,bars,fill,crash){
  const L=Math.round(T/4), out=[], add=(m,s)=>out.push({id:uid(),m,s:Math.round(s),l:L,v:100});
  for(let b=0;b<bars;b++){
    const base=b*4*T, isFill=fill&&(b+1)%fill===0;
    Object.entries(GROOVES[style].map()).forEach(([m,xs])=>xs.forEach(x=>{ if(!(isFill&&x>=2)) add(+m,base+x*T); }));
    if(isFill) [[38,[2,2.25,2.5,2.75]],[47,[3,3.25]],[45,[3.5]],[41,[3.75]],[36,[2,3]]].forEach(([m,xs])=>xs.forEach(x=>add(m,base+x*T)));
    if(crash&&(b===0||(fill&&b%fill===0))){ add(49,base); add(36,base); }
  }
  const seen=new Set(); return out.filter(n=>{ const k=n.m+'@'+n.s; if(seen.has(k)) return false; seen.add(k); return true; });
}

export { DRUMS, GROOVES, drumText, expressDrums, genGroove };
