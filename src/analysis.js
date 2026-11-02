// Chord and progression analysis. Display preferences (naming, accPref, octConv) come in `prefs`.
import { AUTO, FLAT, LATIN, LETTERS, NAT, OCT_CONV, ROMAN, SEVENTHS, SHARP, TYPES } from './data.js';
import { tr } from './i18n.js';

// ---------- naming ----------
const accStr=a=>({'-2':'♭♭','-1':'♭','0':'','1':'♯','2':'♯♯'})[a];
const letterName=(l,a,prefs)=>(prefs.naming==='latin'?LATIN:LETTERS)[l]+accStr(a);
// With auto accidentals and a known key, the notes of its scale take its spelling (B♭ in D minor, C♯ as its leading tone)
// The tonic is spelled once, with the fewest accidentals in the key signature; ties (F♯/G♭ major, E♭/D♯ minor) take F♯ and E♭.
// Every scale degree then takes the next letter from the tonic, so F♯ major has E♯ and C♯ minor has B♯ as its leading tone.
const KEY_TONIC={major:[[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[3,1],[4,0],[5,-1],[5,0],[6,-1],[6,0]],
                 minor:[[0,0],[0,1],[1,0],[2,-1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[6,-1],[6,0]]};
// minor takes the raised 7th (harmonic) and the raised 6th (melodic) too; they share the letters of the 7th and the 6th
const SCALE_STEPS={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10,11,9]};
const keyTonicSpell=(key,prefs)=>prefs.accPref==='sharp'||prefs.accPref==='flat'?null:KEY_TONIC[key.mode][key.tonic];
// the altered degree that names a mode: pitch class above the tonic -> letters above the tonic's (the dorian 6th is in the minor steps)
const MODE_STEP={phrygian:[1,1],lydian:[6,3],mixolydian:[10,6]};
function keySpell(pc,key,prefs){
  if(!key||prefs.accPref==='sharp'||prefs.accPref==='flat') return null;
  const [tl]=KEY_TONIC[key.mode][key.tonic], steps=SCALE_STEPS[key.mode], ms=MODE_STEP[key.modal];
  const k=steps.findIndex(s=>(key.tonic+s)%12===pc);
  if(k<0&&!(ms&&(key.tonic+ms[0])%12===pc)) return null;
  const l=(tl+(k<0?ms[1]:k===7?6:k===8?5:k))%7;
  let a=((pc-NAT[l])%12+12)%12; if(a>6) a-=12;
  return [l,a];
}
function defaultSpell(pc,prefs,key){
  if(prefs.accPref==='flat') return FLAT[pc];
  if(prefs.accPref==='sharp') return SHARP[pc];
  return keySpell(pc,key,prefs)||AUTO[pc];
}
function rootSpell(pc,q,prefs,key){
  if(prefs.accPref==='sharp') return SHARP[pc];
  if(prefs.accPref==='flat') return FLAT[pc];
  const k=keySpell(pc,key,prefs); if(k) return k;
  if((q==='min'||q==='dim'||q==='hdim')&&(pc===1||pc===8)) return SHARP[pc];
  return AUTO[pc];
}
function spellMidi(m,l,a){return {midi:m,l,a,oct:Math.round((m-a-NAT[l])/12)-1}}
function plainSpell(m,prefs,key){const [l,a]=defaultSpell(m%12,prefs,key);return spellMidi(m,l,a)}
const octOff=prefs=>(OCT_CONV[prefs.octConv]||OCT_CONV.sci).off;
const noteText=(n,prefs)=>letterName(n.l,n.a,prefs)+(n.oct+octOff(prefs));

// ---------- chord analysis ----------
// The points of a candidate name; the lowest wins. The type adds its rank (TYPES: 0 to RANK.maxType, the rarer the more), the other
// terms are these. A bass that is not the root costs more on the 7th (a 4/2 chord) and more again on any other degree than the 3rd
// or the 5th (a 9th, 11th or 13th, an altered 5th, the 6th, the 2nd or 4th of a sus chord), where the same notes have a likelier
// root: B D G with E♭ as an ornament is G/B, not E♭maj7♯5/B (fixed on the development set of TAVERN, 2 Nov 2026)
const RANK={bass:3,bass7:2,bassFar:4,missing:2,locked:10,sixthNo5:1.5};
const bassCost=(t,r,bass)=>{
  if(bass===r) return 0;
  const d=t.degs.find(x=>x.pc===(bass-r+12)%12);
  return RANK.bass+(d.n===7?RANK.bass7:d.n===3||(d.n===5&&d.pc===7)?0:RANK.bassFar);
};
function analyze(notes,locked){
  const pcs=[...new Set(notes.map(m=>m%12))];
  if(pcs.length<2) return [];
  const bass=notes[0]%12, out=[];
  for(const r of pcs){
    const rel=new Set(pcs.map(p=>(p-r+12)%12));
    for(const t of TYPES){
      const full=new Set(t.degs.map(d=>d.pc));
      if(![...rel].every(x=>full.has(x))) continue;
      const missing=t.degs.filter(d=>!rel.has(d.pc));
      if(missing.some(d=>!d.opt)) continue;
      const parts={type:t.rank,missing:missing.length*RANK.missing,bass:bassCost(t,r,bass),sixth:missing.some(d=>d.n===5)&&/^m?6$/.test(t.sym)?RANK.sixthNo5:0};
      let score=parts.type+parts.missing+parts.bass+parts.sixth;
      if(locked!=null && locked===r){ score-=RANK.locked; parts.locked=-RANK.locked; }
      out.push({root:r,type:t,missing,score,parts,slash:bass!==r,bass});
    }
  }
  out.sort((a,b)=>a.score-b.score);
  return out.slice(0,10);
}
function spellCandidate(c,notes,prefs,key){
  const [rl,ra]=rootSpell(c.root,c.type.q,prefs,key);
  const byPc={};
  for(const d of c.type.degs){
    const pc=(d.pc+c.root)%12, l=(rl+d.step)%7;
    let a=((pc-NAT[l])%12+12)%12; if(a>6)a-=12;
    // notes of the key take its names; otherwise the chord's, except for a double accidental (only the 𝄫7 of a
    // diminished seventh has one) or a sharp or flat on a white key (E♯, B♯, F♭, C♭), which take the plain name
    const ks=keySpell(pc,key,prefs), odd=(a===1&&(l===2||l===6))||(a===-1&&(l===0||l===3));
    if(ks) byPc[pc]={l:ks[0],a:ks[1],deg:d};
    else if(!odd&&(Math.abs(a)<=1||(a===-2&&d.acc===-2))) byPc[pc]={l,a,deg:d};
    else { const [L,A]=defaultSpell(pc,prefs,key); byPc[pc]={l:L,a:A,deg:d}; }
  }
  return {rootName:letterName(rl,ra,prefs),byPc,
    // a note the chord leaves out as an ornament has no degree in it and takes the name of the key
    notes:notes.map(m=>{const s=byPc[m%12];return s?{...spellMidi(m,s.l,s.a),deg:s.deg}:{...plainSpell(m,prefs,key),orn:true}})};
}
// ---------- ornaments (non-chord tones) ----------
// A step that says when its notes sound (evs: [{m,s,l}] in ticks; a: where the step starts) may leave out up to five pitch classes
// as ornaments, never the bass, when the chord of the rest explains the stretch better. A pitch class weighs its share of the time
// the notes sound in the step; the reading costs its type's points, 3 per tenth of the weight left out and 2 per extension (7th and
// up) that weighs under 15 %: a seventh that passes does not make the chord a seventh chord. Fixed on the development set of
// TAVERN (1 and 2 Nov 2026: extra weight for the beat and the bass gave the same total and more false drops on exact chords,
// so it went); without evs a step reads as before.
const ORN={drop:3,ext:2,extUnder:.15,maxDrop:5};
function ornWeights(evs,a,dur){
  const W=new Map(), b=a+dur;
  for(const x of evs){
    const w=(Math.min(x.s+x.l,b)-Math.max(x.s,a))/dur;
    W.set(x.m%12,(W.get(x.m%12)||0)+w);
  }
  const tot=[...W.values()].reduce((s,v)=>s+v,0);
  W.forEach((v,k)=>W.set(k,v/tot));
  return W;
}
// Once the key is known (the second reading of analyzeProgression), the four best names of each set weigh the context terms of
// readWithMelody too (ctxOf): the key, and the neighbours of the first reading (2 Nov 2026, development set of TAVERN)
function readOrnaments(notes,evs,a,dur,key,nb){
  const ev=evs.filter(x=>x.s<a+dur&&x.s+x.l>a&&notes.includes(x.m)); if(!ev.length||!(dur>0)) return null;
  const W=ornWeights(ev,a,dur), bassPc=notes[0]%12, free=[...W.keys()].filter(pc=>pc!==bassPc);
  const sets=[[]]; for(const x of free) for(const s of [...sets]) if(s.length<ORN.maxDrop) sets.push([...s,x]);
  let best=null;
  for(const D of sets){
    const keep=notes.filter(m=>!D.includes(m%12)); if(new Set(keep.map(m=>m%12)).size<2) continue;
    for(const c of analyze(keep,null).slice(0,key?4:1)){
      const ext=c.type.degs.filter(d=>d.n>=7).map(d=>(d.pc+c.root)%12).filter(pc=>W.has(pc)&&!D.includes(pc)&&W.get(pc)<ORN.extUnder).length;
      const ctx=ctxOf(c,key,nb||{});
      const cost=c.score+ORN.drop*10*D.reduce((s,pc)=>s+W.get(pc),0)+ORN.ext*ext+Object.values(ctx).reduce((s,v)=>s+v,0);
      if(!best||cost<best.cost-1e-9) best={c:Object.keys(ctx).length?{...c,ctx}:c,cost,D};
    }
  }
  return best;
}
// Root by context: a chord of the app's own lane (a step with all, every note that sounds in it, the tune too) is named from
// every note above its bass, with the costs of the ornament rule for its own notes and the four best readings of each set of
// notes left out. Leaving out a note that only the tune plays costs nothing, so the tune completes the chord (a missing third or
// fifth) but does not change it into another with more notes. Once the key is known, a reading off the key costs 1 more, one that goes to the next
// chord as V → I (or vii° → I) in the key costs 1 less, and one that the previous chord goes to that way, half a point less.
// The notes the step shows and spells are still its own; mel holds the notes of the tune the name takes, and the reading
// keeps the context terms it got (ctx) for its tooltip. Fixed on the development set of TAVERN (2 Nov 2026).
const NB={key:1,next:1,prev:.5};
const ctxOf=(c,key,nb)=>{
  const ctx={}; if(!key) return ctx;
  const it=x=>x&&{root:x.root,q:x.type.q}, ek=expFor(key), inKey=x=>{const e=ek[(x.root-key.tonic+12)%12]; return !!e&&e.includes(x.type.q);};
  if(nb.next&&inKey(nb.next)&&leads(it(c),it(nb.next))) ctx.next=-NB.next;
  if(!inKey(c)) ctx.key=NB.key;
  if(nb.prev&&inKey(c)&&leads(it(nb.prev),it(c))) ctx.prev=-NB.prev;
  return ctx;
};
function readWithMelody(step,key,nb){
  const harm=[...step.notes].sort((a,b)=>a-b), bass=harm[0], a=step.a||0, dur=step.dur;
  const ev=step.all.filter(x=>x.s<a+dur&&x.s+x.l>a&&x.m>=bass); if(!ev.length||!(dur>0)) return null;
  const own=new Set(harm.map(m=>m%12)), notes=[...new Set([...harm,...ev.map(x=>x.m)])].sort((x,y)=>x-y);
  const W=ornWeights(ev.filter(x=>own.has(x.m%12)),a,dur), tune=[...new Set(ev.map(x=>x.m%12))].filter(pc=>!own.has(pc));
  const free=[...W.keys(),...tune].filter(pc=>pc!==bass%12), sets=[[]];
  for(const x of free) for(const s of [...sets]) if(s.length<ORN.maxDrop) sets.push([...s,x]);
  let best=null;
  for(const D of sets){
    const keep=notes.filter(m=>!D.includes(m%12)); if(new Set(keep.map(m=>m%12)).size<2) continue;
    for(const c of analyze(keep,null).slice(0,4)){
      const ext=c.type.degs.filter(d=>d.n>=7).map(d=>(d.pc+c.root)%12).filter(pc=>W.has(pc)&&!D.includes(pc)&&W.get(pc)<ORN.extUnder).length;
      const ctx=ctxOf(c,key,nb);
      const cost=c.score+ORN.drop*10*D.reduce((s,pc)=>s+(W.get(pc)||0),0)+ORN.ext*ext+Object.values(ctx).reduce((s,v)=>s+v,0);
      if(!best||cost<best.cost-1e-9) best={c:Object.keys(ctx).length?{...c,ctx}:c,cost,D};
    }
  }
  if(!best) return null;
  const pcs=new Set(best.c.type.degs.map(d=>(d.pc+best.c.root)%12));
  best.mel=[...new Set(ev.map(x=>x.m))].filter(m=>!own.has(m%12)&&pcs.has(m%12)).sort((x,y)=>x-y);
  if(best.mel.length) best.c={...best.c,mel:best.mel};
  return best;
}
// The notes of the tune a name takes, in words: «G (en la melodía) completa el acorde», «G y B (en la melodía) completan el acorde»
function melodyText(mel,sp,prefs){
  if(!mel||!mel.length) return '';
  const ns=[...new Set(mel.map(m=>m%12))].map(pc=>{const s=sp.byPc[pc]; return s?letterName(s.l,s.a,prefs):letterName(...defaultSpell(pc,prefs),prefs);});
  const list=(and)=>ns.length>1?ns.slice(0,-1).join(', ')+` ${and} `+ns[ns.length-1]:ns[0];
  return ns.length>1?tr(`${list('y')} (en la melodía) completan el acorde`,`${list('and')} (in the melody) complete the chord`)
    :tr(`${ns[0]} (en la melodía) completa el acorde`,`${ns[0]} (in the melody) completes the chord`);
}
// The ornaments a step left out, in words: «Adorno: B3 (dura poco; no cambia el nombre del acorde)»
function ornamentText(orn,spelled,prefs){
  if(!orn||!orn.length) return '';
  const ns=orn.map(m=>noteText(spelled.find(n=>n.midi===m)||plainSpell(m,prefs),prefs)).join(', ');
  return orn.length>1?tr(`Adornos: ${ns} (duran poco; no cambian el nombre del acorde)`,`Ornaments: ${ns} (short; they do not change the chord's name)`)
    :tr(`Adorno: ${ns} (dura poco; no cambia el nombre del acorde)`,`Ornament: ${ns} (short; it does not change the chord's name)`);
}
function bassDeg(c){return c.type.degs.find(d=>d.pc===(c.bass-c.root+12)%12)}
function inversionText(c){
  if(!c.slash) return '';
  const d=bassDeg(c);
  if(d.n===3) return tr('1ª inversión','1st inversion');
  if(d.n===5) return tr('2ª inversión','2nd inversion');
  if(d.n===7) return tr('3ª inversión','3rd inversion');
  return tr('bajo en la ','bass on the ')+d.label;
}
function candSymbol(c,sp,prefs){
  let s=sp.rootName+c.type.sym;
  if(c.missing.length && c.type.degs.length===3) s+='(no5)';
  const b=sp.byPc[c.bass];
  return {main:s,slash:c.slash?'/'+letterName(b.l,b.a,prefs):''};
}
function resolveStep(step,prefs,key,nb){
  const notes=[...step.notes].sort((a,b)=>a-b);
  const cands=analyze(notes,null);
  // a chord the user named keeps its name; otherwise the timing of the notes, when the step has it, may leave some out.
  // The reading without the ornaments is kept either way (orn when it names the step, ornAlt when the user named another)
  const named=cands.find(x=>x.root===step.root&&x.type.sym===step.sym);
  const o=step.all?readWithMelody(step,key,nb||{}):step.evs?readOrnaments(notes,step.evs,step.a||0,step.dur,key,nb):null;
  const c=named||(o&&o.c)||cands[0]||null;
  const sp=c?spellCandidate(c,notes,prefs,key):null;
  const spelled=sp?sp.notes:notes.map(m=>plainSpell(m,prefs,key));
  let label;
  if(c){const sy=candSymbol(c,sp,prefs); label=sy.main+sy.slash;}
  else if(notes.length===1) label=noteText(spelled[0],prefs);
  else if(notes.length===2) label=letterName(spelled[0].l,spelled[0].a,prefs)+'–'+letterName(spelled[1].l,spelled[1].a,prefs);
  else label=notes.length?'?':'—';
  const drop=o?notes.filter(m=>o.D.includes(m%12)):[];
  return {notes,c,sp,spelled,label,...(drop.length&&(o.c===c?{orn:drop}:{ornAlt:drop})),...(o&&o.c===c&&o.mel&&o.mel.length&&{mel:o.mel})};
}

// ---------- progression analysis ----------
const MAJ=[0,2,4,5,7,9,11], MIN=[0,2,3,5,7,8,10];
const EXP={major:{0:['maj'],2:['min'],4:['min'],5:['maj'],7:['maj','dom'],9:['min'],11:['dim','hdim']},
           minor:{0:['min'],2:['dim','hdim'],3:['maj','aug'],5:['min'],7:['min','maj','dom'],8:['maj'],10:['maj','dom'],11:['dim']}};
// Key scoring is looser than labeling: dominant 7ths on I and IV count as in-key (blues)
const EXPK={major:{...EXP.major,0:['maj','dom'],5:['maj','dom']},minor:EXP.minor};
// A mode is a label on major or minor, not a key of its own. It is named by its characteristic note, as long as the note
// that contradicts it is absent and every note is on the mode's scale: [mode, characteristic, contradicting, scale] in semitones above the tonic.
const MODES={minor:[['dorian',9,8,[0,2,3,5,7,9,10]],['phrygian',1,2,[0,1,3,5,7,8,10]]],major:[['lydian',6,5,[0,2,4,6,7,9,11]],['mixolydian',10,11,[0,2,4,5,7,9,10]]]};
const MODE_NAME={dorian:['dórico','Dorian'],phrygian:['frigio','Phrygian'],lydian:['lidio','Lydian'],mixolydian:['mixolidio','Mixolydian']};
// Chords on the degrees of the mode count as in the key; the degrees of the plain scale the mode changes do not
const EXP_MODE={dorian:{2:['min'],5:['maj','dom'],8:[],9:['dim','hdim']},
                phrygian:{1:['maj','dom'],2:[],7:['min','dim','hdim'],10:['min','maj','dom']},
                lydian:{2:['maj','dom'],5:[],6:['dim','hdim'],11:['min']},
                mixolydian:{4:['dim','hdim'],7:['min'],10:['maj','dom'],11:[]}};
const expFor=key=>key.modal?{...EXP[key.mode],...EXP_MODE[key.modal]}:EXP[key.mode];
// Only where the tonic has no dominant of its own: before one, the raised 4th or lowered 7th is a secondary dominant's, not a mode's
function modeOf(key,items){
  if(items.some((it,i)=>i+1<items.length&&items[i+1].root===key.tonic&&leads(it,items[i+1]))) return null;
  const rel=new Set(items.flatMap(it=>it.pcs).map(p=>(p-key.tonic+12)%12));
  const hit=MODES[key.mode].filter(([,mark,against,scale])=>rel.has(mark)&&!rel.has(against)&&[...rel].every(r=>scale.includes(r)));
  return hit.length===1?hit[0][0]:null;
}
// A V (or a vii°) of the next chord, followed by it
const leads=(it,nx)=>!!(it.q&&nx.q)&&(((it.q==='dom'||it.q==='maj')&&(nx.root-it.root+12)%12===5)||((it.q==='dim'||it.q==='hdim')&&(nx.root-it.root+12)%12===1));
// With no V or vii° resolving to its target anywhere, nothing marks a tonic: the chord that opens and closes, else the one that
// lasts longest, else the first, weighs on the key. It is a tiebreak, not a verdict: a loop such as V–vi–IV–I still ends on its I.
const PLAIN_TONIC=3;
function plainTonic(items){
  if(items.some((it,i)=>i+1<items.length&&leads(it,items[i+1]))) return -1;
  const f=items[0], l=items[items.length-1];
  if(f.q&&l.q&&f.root===l.root) return f.root;
  const dur=new Map(); items.forEach(it=>{ if(it.q) dur.set(it.root,(dur.get(it.root)||0)+(it.dur||1)); });
  let best=-1, most=0; dur.forEach((d,r)=>{ if(d>most){most=d;best=r;} });
  return best;
}
// What the key evidence is made of, shared by detectKey and by the reasons it is explained with (keyWhy)
const tonicQ=mode=>mode==='major'?['maj','dom']:['min'];
// the first chord is the tonic, the last one is (V7–vi of the relative major is a deceptive cadence: it ends off the tonic on purpose),
// and one that starts and ends on the same tonic chord is closed
function bookends(items,t,mode){
  const tq=tonicQ(mode), f=items[0], l=items[items.length-1], pv=items[items.length-2];
  const deceptive=mode==='minor'&&pv&&pv.q==='dom'&&pv.root===(t+10)%12;
  return {first:f.root===t&&tq.includes(f.q), last:l.root===t&&tq.includes(l.q)&&!deceptive,
    closed:items.length>2&&f.root===t&&l.root===t&&f.q===l.q&&tq.includes(f.q)};
}
// a chord a fifth above the tonic (V, V7, or v in minor when it is major) that goes to it
const resolvesToTonic=(it,nx,t,mode)=>!!nx&&nx.root===t&&(it.q==='dom'||it.q==='aug'||(it.q==='maj'&&mode==='minor'))&&(it.root-t+12)%12===7;
function detectKey(items){
  const res=[];
  for(let t=0;t<12;t++) for(const mode of ['major','minor']){
    const sc=mode==='major'?MAJ:MIN; let s=0;
    items.forEach((it,i)=>{
      const own7=it.q==='dom'?(it.root+10)%12:-1;
      // the chromatic notes of a secondary dominant (V or vii° of a chord in the scale) do not count against the key
      const nx=items[i+1], lead=!!nx&&nx.q&&sc.includes((nx.root-t+12)%12)&&
        (((it.q==='dom'||it.q==='maj')&&(nx.root-it.root+12)%12===5)||((it.q==='dim'||it.q==='hdim')&&(nx.root-it.root+12)%12===1));
      // major tolerates the notes it borrows from its parallel minor (♭3, ♭6, ♭7), as minor tolerates its raised 7th
      it.pcs.forEach(p=>{const r=(p-t+12)%12; s+=sc.includes(r)?1:p===own7||lead?0:(mode==='minor'&&(r===11||r===1)?.3:mode==='major'&&(r===3||r===8||r===10)?-.5:-1.2);});
      if(it.q){ const e=EXPK[mode][(it.root-t+12)%12]; if(e&&e.includes(it.q)) s+=1.5; else if(e&&it.q==='sus') s+=.5; }
    });
    const tq=tonicQ(mode), be=bookends(items,t,mode);
    if(be.first) s+=2;
    if(be.last) s+=3;
    // a progression that starts and ends on the same tonic chord is closed on it, even when the chords between borrow
    if(be.closed) s+=1.5;
    items.forEach((it,i)=>{
      if(it.root===t&&tq.includes(it.q)) s+=.5;
      if(resolvesToTonic(it,items[i+1],t,mode)) s+=3;
    });
    if(mode==='major') s+=.01;
    res.push({tonic:t,mode,score:s});
  }
  return res.sort((a,b)=>b.score-a.score);
}
// Why this key: the evidence of detectKey that applies to the one chosen, in order of weight, at most three, with no reason that another
// one already says; the points go in the title. The mode adds its own reason
const MODE_CHAR={dorian:[9,'6ª mayor','major 6th'],phrygian:[1,'2ª menor','minor 2nd'],lydian:[6,'4ª aumentada','augmented 4th'],mixolydian:[10,'7ª menor','minor 7th']};
function keyWhy(items,key,alt,plain,prefs){
  const t=key.tonic, mode=key.mode, sc=mode==='major'?MAJ:MIN, be=bookends(items,t,mode), R=[];
  const push=(es,en,pts)=>R.push({text:tr(es,en),pts});
  let res=0; items.forEach((it,i)=>{ if(resolvesToTonic(it,items[i+1],t,mode)) res+=3; });
  if(items.length===1){ if(be.first) push('el único acorde es la tónica','the only chord is the tonic',5); }
  else {
    if(res) push('un V resuelve a la tónica','a V resolves to the tonic',res);
    if(be.first&&be.last) push('empieza y termina en la tónica','starts and ends on the tonic',5+(be.closed?1.5:0));
    else if(be.last) push('termina en la tónica','ends on the tonic',3);
    else if(be.first) push('empieza en la tónica','starts on the tonic',2);
    // with no V or vii° resolving, the chord that lasts longest weighs (plainTonic); said only when it lasts longer than every other
    const dur=new Map(); items.forEach(it=>{ if(it.q) dur.set(it.root,(dur.get(it.root)||0)+(it.dur||1)); });
    const longest=dur.get(t)>Math.max(0,...[...dur].filter(([r])=>r!==t).map(([,d])=>d));
    if(plain===t&&items[0].root!==items[items.length-1].root&&longest) push('el acorde que más dura es la tónica','the longest chord is the tonic',PLAIN_TONIC);
    // only when it is literally true: no borrowed chord, no chromatic note
    if(items.every(it=>it.pcs.every(p=>sc.includes((p-t+12)%12)))){
      const chords=items.every(it=>it.q), pts=items.reduce((n,it)=>n+it.pcs.length,0);
      if(chords) push('todos los acordes son de la escala','every chord is in the scale',pts); else push('todas las notas son de la escala','every note is in the scale',pts);
    }
  }
  R.splice(3);
  if(key.modal){
    const [rel,es,en]=MODE_CHAR[key.modal], n=plainSpell(60+(t+rel)%12,prefs,key), nm=letterName(n.l,n.a,prefs)+(n.a?'':' natural');
    R.push({text:tr(`${modeName(key)}: aparece ${nm} (${es}) y todas las notas están en la escala`,`${modeName(key)}: ${nm} (${en}) appears and every note is in the scale`),pts:0});
  }
  if(!R.length) return null;
  const kn=keyName(key,prefs), body=R.map(r=>r.text).join(' · ');
  const text=alt?tr(`${kn}, casi empatada con ${keyName(alt,prefs)}: ${body}`,`${kn}, nearly tied with ${keyName(alt,prefs)}: ${body}`):`${kn}: ${body}`;
  const pts=R.filter(r=>r.pts).map(r=>`${r.text} +${tenNum(r.pts)}`).join(' · ');
  const title=`${pts}${pts?'. ':''}${tr('Puntos','Points')}: ${kn} ${tenNum(+key.score.toFixed(2))}${alt?` · ${keyName(alt,prefs)} ${tenNum(+alt.score.toFixed(2))}`:''}`;
  return {text,title,reasons:R.map(r=>r.text)};
}
const modeName=k=>k&&k.modal?tr(...MODE_NAME[k.modal]):'';
const keyName=(k,prefs)=>{const [l,a]=keyTonicSpell(k,prefs)||rootSpell(k.tonic,k.mode==='minor'?'min':'maj',prefs); return letterName(l,a,prefs)+(k.mode==='major'?tr(' mayor',' major'):tr(' menor',' minor'));};
// «D menor (dórico)», and with an alternate key «D menor (dórico; o C mayor)»
function keyText(k,alt,prefs){
  const inner=[modeName(k),alt?tr('o ','or ')+keyName(alt,prefs):''].filter(Boolean).join('; ');
  return keyName(k,prefs)+(inner?` (${inner})`:'');
}
// A triad or a seventh in inversion takes a figured bass (⁶, ⁶₅…); anything with extensions, add, sus, 6 or a power chord takes words,
// so that "/" stays for secondary functions: V9 in 1st inversion, Iadd9 with the bass on the 9
function invWords(c,d){
  return [3,5,7].includes(d.n)?tr('en ','in ')+inversionText(c):tr('con bajo en la ','with the bass on the ')+d.label;
}
function romanFor(c,key){
  const deg=(c.root-key.tonic+12)%12, q=c.type.q;
  let base=ROMAN[deg];
  if(q==='min'||q==='dim'||q==='hdim') base=base.toLowerCase();
  const mark=q==='dim'?'°':q==='hdim'?'ø':q==='aug'?'+':'';
  let ext=c.type.sym;
  if(q==='dim') ext=ext==='dim7'?'7':'';
  else if(q==='hdim') ext='7';
  else if(q==='aug') ext=ext==='aug'?'':ext.replace('maj7♯5','maj7').replace('7♯5','7');
  else if(q==='min') ext=ext.replace(/^m/,'');
  let fig='', kind='', words='';
  if(c.slash){
    const d=bassDeg(c);
    if(c.type.degs.length===3&&q!=='sus'&&d.n===3){ fig='⁶'; kind='triad'; }
    else if(c.type.degs.length===3&&q!=='sus'&&d.n===5){ fig='⁶₄'; kind='triad'; }
    else if(SEVENTHS.has(c.type.sym)&&[3,5,7].includes(d.n)){ fig={3:'⁶₅',5:'⁴₃',7:'⁴₂'}[d.n]; kind='seventh'; ext=ext.replace(/7$/,''); }
    else words=invWords(c,d);
  }
  const token=base+(q==='dim'||q==='hdim'?'°':q==='aug'?'+':'');
  // short is the degree alone, for the chord strip; text adds the words of an inversion with extensions
  const short=base+mark+ext+fig;
  return {deg,base,token,fig,kind,words,short,text:short+(words?' '+words:''),diatonic:(expFor(key)[deg]||[]).includes(q)||(q==='sus'&&!!expFor(key)[deg])};
}
const PATTERNS=[
 ['Pop I–V–vi–IV','Pop I–V–vi–IV','I V vi IV'],['Pop vi–IV–I–V','Pop vi–IV–I–V','vi IV I V'],['Años 50 (doo-wop)','50s progression (doo-wop)','I vi IV V'],
 ['Turnaround I–vi–ii–V','Turnaround I–vi–ii–V','I vi ii V'],['iii–vi–ii–V','iii–vi–ii–V','iii vi ii V'],['ii–V–I','ii–V–I','ii V I'],['ii–V–i menor','Minor ii–V–i','ii° V i'],
 ['Royal road (J-pop)','Royal road (J-pop)','IV V iii vi'],['Canon de Pachelbel','Pachelbel’s Canon','I V vi iii IV I IV V'],['I–IV–V','I–IV–V','I IV V'],
 ['Cadencia completa I–IV–V–I','Full cadence I–IV–V–I','I IV V I'],['Cadencia andaluza','Andalusian cadence','i ♭VII ♭VI V'],['Épica i–♭VI–♭III–♭VII','Epic i–♭VI–♭III–♭VII','i ♭VI ♭III ♭VII'],
 ['Menor i–♭VI–♭VII','Minor i–♭VI–♭VII','i ♭VI ♭VII'],['Menor i–iv–v','Minor i–iv–v','i iv v'],['Menor i–iv–V','Minor i–iv–V','i iv V'],['Mixolidia I–♭VII–IV','Mixolydian I–♭VII–IV','I ♭VII IV'],
 ['Blues de 12 compases','12-bar blues','I I I I IV IV I I V IV I I'],['Blues de 12 (quick change)','12-bar blues (quick change)','I IV I I IV IV I I V IV I V'],
].map(([es,en,p])=>({get name(){return tr(es,en);},seq:p.split(' ')}));
// A chord's target in a secondary function is written as the diatonic degree it points at: E7 → A7 in C is V7/vi, though A7 is major
function targetBase(nx,key){
  const e=expFor(key)[nx.deg];
  if(nx.diatonic||!e) return nx.base;
  const b=ROMAN[nx.deg]; return ['min','dim','hdim'].includes(e[0])?b.toLowerCase():b;
}
// Spells the notes at the given scale steps from the tonic by letter: rel pitch class -> steps above the tonic's letter
function respell(r,key,prefs,steps){
  const [tl]=keyTonicSpell(key,prefs)||rootSpell(key.tonic,key.mode==='minor'?'min':'maj',prefs);
  r.spelled=r.spelled.map(n=>{
    const k=steps[((n.midi-key.tonic)%12+12)%12]; if(k==null) return n;
    const l=(tl+k)%7; let a=((n.midi-NAT[l])%12+12)%12; if(a>6) a-=12;
    return {...spellMidi(n.midi,l,a),deg:n.deg};
  });
}
// Chords the scale does not explain, read by what they do (in this order): the cadential 6/4, the tonic seventh of the blues,
// secondary dominants and leading-tone chords, augmented sixths and the dim7 that embellishes the tonic
function chromaticReading(rs,romans,key,prefs){
  const tonicTriad=rs.some(r=>r.c&&r.c.root===key.tonic&&r.c.type.q==='maj');
  romans.forEach((ro,i)=>{
    const c=rs[i].c, nx=romans[i+1], nc=rs[i+1]&&rs[i+1].c;
    if(!ro||!c) return;
    if(ro.deg===0&&c.slash&&bassDeg(c).n===5&&nx&&nx.deg===7) ro.cad64=true;
    if(!nc||!nx||ro.diatonic) return;
    const up=(nc.root-c.root+12)%12, q=c.type.q;
    // I7 is the tonic when no tonic triad shows up or the IV that follows is a seventh too (blues), else it points at IV
    if(ro.deg===0&&q==='dom'&&(!tonicTriad||(nx.deg===5&&nc.type.q==='dom'))) return;
    // a dim7 is symmetrical, so the bass is not its root: the root is the note a semitone under the chord it resolves to
    const lt=c.type.sym==='dim7'&&nx.deg!==0&&up!==1?rs[i].notes.map(m=>m%12).find(p=>(p+1)%12===nc.root%12):undefined;
    if((q==='dom'||q==='maj')&&up===5&&nx.deg!==0){
      // the figure replaces the 7 of a dominant seventh; extensions and the like keep their number and take the inversion in words
      const dom=q==='dom', num=dom?(c.type.sym.match(/^\d+/)||[''])[0]:'', fig=ro.kind==='triad'||(ro.kind==='seventh'&&dom&&num==='7');
      const g='V'+(fig?ro.fig:num), words=fig||!c.slash?'':invWords(c,bassDeg(c)), to='/'+targetBase(nx,key);
      ro.short=g+to; ro.text=ro.short+(words?' '+words:''); ro.secondary=true;
    } else if((q==='dim'||q==='hdim')&&up===1&&nx.deg!==0){
      const g='vii'+(q==='hdim'?'ø':'°'), sev=q==='hdim'||c.type.sym==='dim7', to='/'+targetBase(nx,key);
      ro.short=g+(ro.fig||(sev?'7':''))+to; ro.text=ro.short+(ro.words?' '+ro.words:''); ro.secondary=true;
    } else if(lt!==undefined){
      const fig={0:'7',3:'⁶₅',6:'⁴₃',9:'⁴₂'}[(c.bass-lt+12)%12];
      ro.short='vii°'+fig+'/'+targetBase(nx,key); ro.text=ro.short; ro.secondary=true; ro.rootPc=lt;
      // F♯ A C E♭ before G: the root takes the letter under the target's, then thirds
      const rel=(nc.root-key.tonic+12)%12, sc=key.mode==='major'?MAJ:MIN;
      let ts=sc.indexOf(rel); if(ts<0&&key.mode==='minor'&&rel===11) ts=6;
      if(ts>=0) respell(rs[i],key,prefs,Object.fromEntries([6,1,3,5].map((k,j)=>[(lt+3*j-key.tonic+12)%12,(ts+k)%7])));
    }
  });
  romans.forEach((ro,i)=>{
    const c=rs[i].c, nx=romans[i+1], nc=rs[i+1]&&rs[i+1].c, pv=rs[i-1]&&rs[i-1].c;
    if(!ro||!c||ro.diatonic||ro.secondary) return;
    const rel=new Set(rs[i].notes.map(m=>(m-key.tonic+12)%12)), has=x=>rel.has(x);
    const toV=nc&&(nx.deg===7||(nx.deg===0&&nc.slash&&bassDeg(nc).n===5));
    // ♭6̂ in the bass with ♯4̂ above it and 1̂, resolving to V: Italian, French (adds 2̂) or German (adds ♭3̂) sixth
    if(toV&&(rs[i].notes[0]-key.tonic+12)%12===8&&has(8)&&has(0)&&has(6)&&[...rel].every(x=>[8,0,6,3,2].includes(x))&&!(has(3)&&has(2))){
      const g=has(3)?'Ger':has(2)?'Fr':'It';
      ro.text=ro.short=g+{Ger:'⁶₅',Fr:'⁴₃',It:'⁶'}[g]; ro.aug6=g;
      respell(rs[i],key,prefs,{8:5,0:0,6:3,3:2,2:1});
    } else if(c.type.sym==='dim7'&&has(0)&&pv&&nc&&pv.root===key.tonic&&nc.root===key.tonic){
      ro.text=ro.short='♯ii°7'; ro.ct=true;
      respell(rs[i],key,prefs,{0:0,3:1,6:3,9:5});
    }
  });
}
function analyzeProgression(steps,prefs){
  // the key comes from the chords' roots and notes, which do not depend on how they are spelled; the spelling then follows the key
  const first=steps.map(s=>resolveStep(s,prefs));
  const items=first.map((r,i)=>({root:r.c?r.c.root:r.notes.length?r.notes[0]%12:0,q:r.c?r.c.type.q:null,pcs:[...new Set(r.notes.map(m=>m%12))],dur:steps[i].dur||1}));
  if(!items.length) return {rs:first,romans:[],found:[]};
  const keys=detectKey(items), plain=plainTonic(items), rank=k=>k.score+(k.tonic===plain?PLAIN_TONIC:0);
  // the weight of the plain tonic only picks the key; the alternate one still goes by the scores as measured
  const top=keys.reduce((b,k)=>rank(k)>rank(b)?k:b), alt=keys.find(k=>k!==top&&top.score-k.score<2), modal=modeOf(top,items), key=modal?{...top,modal}:top;
  // the lane's chords read again with the key and their neighbours (readWithMelody); the neighbours are the first reading
  const rs=steps.map((s,i)=>resolveStep(s,prefs,key,{prev:first[i-1]&&first[i-1].c,next:first[i+1]&&first[i+1].c}));
  const romans=rs.map(r=>r.c?romanFor(r.c,key):null);
  chromaticReading(rs,romans,key,prefs);
  const toks=romans.map(r=>r?r.token:'?'), N=toks.length, found=[];
  for(const p of PATTERNS){
    const L=p.seq.length; if(L>N) continue;
    for(let i=0;i<N;i++){
      if(i+L>N&&N<3) break;
      let ok=true; for(let j=0;j<L;j++){ if(toks[(i+j)%N]!==p.seq[j]){ok=false;break;} }
      if(ok){ found.push({name:p.name,from:i,to:(i+L-1)%N,wrap:i+L>N}); break; }
    }
  }
  // the patterns are read in the other tonality too, as they would be in the main one: a progression that fits one in the key it
  // was not read in (IV–V–iii–vi in C when A minor was chosen) is still found, and says in which key. The other tonality is the
  // alternate key when there is one, and always the relative key, the usual ambiguity (the alternate shows only within 2 points).
  // It is shown only when it spans more chords than the longest pattern of the main key: a loop that is the same in both keys
  // (G D Em C is also i–♭VI–♭III–♭VII in E minor) adds nothing
  const longest=Math.max(0,...found.map(f=>((PATTERNS.find(p=>p.name===f.name)||{}).seq||[]).length));
  const rel={tonic:(key.tonic+(key.mode==='major'?9:3))%12,mode:key.mode==='major'?'minor':'major'};
  for(const other of [alt,rel].filter((k,i,a)=>k&&a.findIndex(x=>x&&x.tonic===k.tonic&&x.mode===k.mode)===i)){
    if(other.tonic===key.tonic&&other.mode===key.mode) continue;
    const ar=rs.map(r=>r.c?romanFor(r.c,other):null), at=ar.map(r=>r?r.token:'?');
    for(const p of PATTERNS){
      const L=p.seq.length; if(L>N||L<=longest||found.some(f=>f.name===p.name||f.name.startsWith(p.name+' ('))) continue;
      for(let i=0;i<N;i++){
        if(i+L>N&&N<3) break;
        let ok=true; for(let j=0;j<L;j++){ if(at[(i+j)%N]!==p.seq[j]){ok=false;break;} }
        if(ok){ found.push({name:`${p.name} (${tr('en','in')} ${keyName(other,prefs)})`,from:i,to:(i+L-1)%N,wrap:i+L>N}); break; }
      }
    }
  }
  let run=1, best=1;
  for(let i=1;i<N;i++){ if(items[i-1].q&&items[i].q&&(items[i].root-items[i-1].root+12)%12===5){run++;best=Math.max(best,run);} else run=1; }
  if(best>=3) found.push({name:tr(`Ciclo de quintas (${best} acordes seguidos)`,`Circle of fifths (${best} chords in a row)`),cycle:true});
  let cad='';
  if(N>=2&&romans[N-1]&&romans[N-2]){
    const ad=romans[N-2].deg, bd=romans[N-1].deg;
    // the degrees are written as the chords are: V → i in minor, vii° → I in major, v → i for the minor dominant
    const pair=`(${romans[N-2].token} → ${romans[N-1].token})`, domQ=['maj','dom'].includes(rs[N-2].c.type.q);
    if(bd===0&&ad===7&&domQ) cad=tr('Cadencia auténtica ','Authentic cadence ')+pair;
    else if(bd===0&&ad===7) cad=tr('Cadencia modal (sin sensible) ','Modal cadence (no leading tone) ')+pair;
    else if(bd===0&&ad===5) cad=tr('Cadencia plagal ','Plagal cadence ')+pair;
    // in major it is the backdoor (Mixolydian) cadence; in minor the ♭VII is the natural seventh, a plain ♭VII → i
    else if(bd===0&&ad===10) cad=key.mode==='minor'?tr('Cadencia ♭VII → i','♭VII → i cadence'):tr('Cadencia ♭VII → I (backdoor / mixolidia)','♭VII → I cadence (backdoor / Mixolydian)');
    else if(bd===0&&ad===11) cad=tr('Cadencia con sensible ','Leading-tone cadence ')+pair;
    else if(bd===0&&ad===1&&rs[N-2].c.type.q==='dom') cad=tr('Cadencia con sustituto tritonal (♭II7 → I)','Tritone substitution cadence (♭II7 → I)');
    else if(ad===7&&(bd===9||bd===8)) cad=tr('Cadencia rota (V → ','Deceptive cadence (V → ')+romans[N-1].base+')';
    else if(bd===7) cad=tr('Semicadencia (termina en V)','Half cadence (ends on V)');
  }
  const fn=romans.map((ro,i)=>harmonicFunction(ro,rs[i].c,key));
  // tension: what the chord is (function and dissonance) plus what came before it (Meyer's expectation)
  const tenBase=rs.map((r,i)=>+(.5*FN_TENSION[fn[i]]+.5*dissonance(r)).toFixed(2));
  const lead=rs.map((r,i)=>fn[i]==='D'&&leadingD(r.c,romans[i],key));
  const tenCtx=rs.map((r,i)=>contextTension(rs,romans,fn,lead,i));
  const ten=tenBase.map((b,i)=>Math.min(1,Math.max(0,+(b+(tenCtx[i]?tenCtx[i].val:0)).toFixed(2))));
  return {rs,romans,key,alt,found,cad,fn,ten,tenBase,tenCtx,why:keyWhy(items,key,alt,plain,prefs)};
}
// Harmonic function in the detected key: T tonic, S subdominant, D dominant, C color (borrowed or chromatic)
const FN_TENSION={T:.1,S:.4,D:.8,C:.5,'?':.5};
// Context (Meyer, Emotion and Meaning in Music, 1956): tension is expectation. A dominant leaves a tendency waiting; the chord it
// resolves to releases it (arrival), any other chord frustrates it (surprise), and a dominant after a dominant keeps it
// waiting (wait, per dominant in a row up to a maximum). The weights are chosen, not measured: the tension stays an estimate
const CTX={arrival:-.15,surprise:.15,wait:.05,waitMax:.1};
const CTX_NAME={get arrival(){return tr('llegada','arrival');},get surprise(){return tr('sorpresa','surprise');},get wait(){return tr('espera','wait');}};
// Where a dominant-function chord is expected to go, in semitones above its root: V and V/x a fourth up, vii° a semitone up,
// the cadential 6/4 to V, the tritone substitute a semitone down
function expectedStep(c,ro){
  if(ro.cad64) return 7;
  if(c.type.q==='dim'||c.type.q==='hdim') return 1;
  if(ro.deg===1&&c.type.q==='dom'&&!ro.secondary) return 11;
  return 5;
}
// Only a dominant with a leading tone leaves a tendency waiting: V, V7, vii°, V/x, vii°/x, the cadential 6/4 and the tritone
// substitute. The ♭VII of natural minor and the minor v keep the function D but carry no expectation
function leadingD(c,ro,key){
  if(!c||!ro) return false;
  if(ro.cad64||ro.secondary) return true;
  if(c.type.q==='dim'||c.type.q==='hdim') return ro.deg===11;
  if(ro.deg===1) return c.type.q==='dom';
  return ro.deg===7&&c.type.q!=='min';
}
function contextTension(rs,romans,fn,lead,i){
  const c=rs[i].c, pc=i&&rs[i-1].c, pro=i&&romans[i-1];
  if(!i||!c||!pc||!pro) return null;
  if(lead[i-1]&&fn[i]!=='D'){
    const dest=((pro.rootPc!==undefined?pro.rootPc:pc.root)+expectedStep(pc,pro))%12;
    return c.root===dest?{rule:'arrival',val:CTX.arrival}:{rule:'surprise',val:CTX.surprise};
  }
  if(lead[i]&&lead[i-1]){
    let run=0; while(i-1-run>=0&&lead[i-1-run]) run++;
    return {rule:'wait',val:Math.min(CTX.waitMax,+(CTX.wait*run).toFixed(2))};
  }
  return null;
}
// «3 inversión + 0,2 tipo = 3,2»: what a candidate name scored, for its tooltip
function scoreDetail(c){
  const P=c.parts, rows=[['bass',tr('inversión','inversion')],['missing',tr('omisión','omission')],['sixth',tr('6ª sin 5','6th without 5th')],['type',tr('tipo','type')]].filter(([k])=>P[k]);
  const f=x=>tenNum(+x.toFixed(2)).replace('-','−');
  let s=rows.length?rows.map(([k,l],i)=>`${i?'+ ':''}${f(P[k])} ${l}`).join(' '):`0 ${tr('tipo','type')}`;
  if(P.locked) s+=` − ${f(-P.locked)} ${tr('raíz elegida','chosen root')}`;
  s=`${s} = ${f(c.score)}`;
  // a lane chord read with its neighbours (readWithMelody): the context terms that weighed on it
  const X=c.ctx||{}, sg=x=>(x>0?'+':'')+f(x);
  const ctx=[X.next&&`${sg(X.next)} ${tr('va al acorde siguiente (V → I)','goes to the next chord (V → I)')}`,
    X.key&&`${sg(X.key)} ${tr('fuera de la tonalidad','outside the key')}`,
    X.prev&&`${sg(X.prev)} ${tr('llega desde su dominante','arrives from its dominant')}`].filter(Boolean);
  return ctx.length?`${s} · ${tr('contexto','context')}: ${ctx.join(', ')}`:s;
}
// The rule of the order, written from the constants of analyze
function rankHelp(){
  const n=tenNum, top=Math.max(...TYPES.map(t=>t.rank));
  return tr(`Se ordenan por puntos y gana el menor: +${n(RANK.bass)} si el bajo no es la fundamental, +${n(RANK.missing)} por nota omitida, de 0 a ${n(top)} según el tipo (más raro, más puntos); la raíz que eliges resta ${n(RANK.locked)}. En la franja también cuentan la melodía y el contexto: −${n(NB.next)} si va a su acorde siguiente como V → I, +${n(NB.key)} si queda fuera de la tonalidad, −${n(NB.prev)} si llega desde su dominante.`,
    `They are ordered by points and the lowest wins: +${n(RANK.bass)} if the bass is not the root, +${n(RANK.missing)} per omitted note, ${n(0)} to ${n(top)} by type (the rarer, the more points); the root you choose subtracts ${n(RANK.locked)}. In the lane, the melody and the context count too: −${n(NB.next)} if it goes to the next chord as V → I, +${n(NB.key)} if it falls outside the key, −${n(NB.prev)} if it arrives from its dominant.`);
}
const tenNum=x=>tr(String(x).replace('.',','),String(x));
// «base 0,13 + sorpresa 0,15 = 0,28», for the tooltip of the sheet
function tenDetail(A,i){
  const c=A.tenCtx[i];
  if(!c) return `${tr('base','base')} ${tenNum(A.tenBase[i])}`;
  return `${tr('base','base')} ${tenNum(A.tenBase[i])} ${c.val<0?'−':'+'} ${CTX_NAME[c.rule]} ${tenNum(Math.abs(c.val))} = ${tenNum(A.ten[i])}`;
}
// The help of the Expression tab, written from the constants above so that it cannot drift from them
function tensionHelp(){
  const n=tenNum, F=FN_TENSION;
  return tr(`cada acorde recibe una tensión estimada de 0 a 1. Base: la mitad de su función en la tonalidad (tónica ${n(F.T)} · subdominante ${n(F.S)} · dominante ${n(F.D)} · color ${n(F.C)}) y la mitad de su disonancia (tríada mayor ${n(DISS.maj)} … disminuido ${n(DISS.dim)}, más extensiones alteradas). Contexto, según Meyer: tras una dominante, el acorde de destino baja ${n(Math.abs(CTX.arrival))} (llegada) y cualquier otro sube ${n(CTX.surprise)} (sorpresa, como en la cadencia rota); una dominante tras otra sube ${n(CTX.wait)} por cada una seguida, hasta ${n(CTX.waitMax)} (espera). El total se recorta a 0–1. Positivo: lo tenso suena más fuerte. Negativo: lo tenso se suaviza.`,
    `each chord gets an estimated tension from 0 to 1. Base: half its function in the key (tonic ${n(F.T)} · subdominant ${n(F.S)} · dominant ${n(F.D)} · color ${n(F.C)}) and half its dissonance (major triad ${n(DISS.maj)} … diminished ${n(DISS.dim)}, plus altered extensions). Context, after Meyer: after a dominant, the chord it resolves to drops ${n(Math.abs(CTX.arrival))} (arrival) and any other rises ${n(CTX.surprise)} (surprise, as in the deceptive cadence); a dominant after a dominant rises ${n(CTX.wait)} for each one in a row, up to ${n(CTX.waitMax)} (wait). The total is clipped to 0–1. Positive: tense chords sound louder. Negative: tense chords soften.`);
}
const FN_NAME={get T(){return tr('tónica','tonic');},get S(){return tr('subdominante','subdominant');},get D(){return tr('dominante','dominant');},C:'color',get '?'(){return tr('sin función','no function');}};
function harmonicFunction(ro,c,key){
  if(!ro||!c) return '?';
  if(ro.secondary||ro.cad64) return 'D';
  if(ro.aug6) return 'S';
  const d=ro.deg, minor=key.mode==='minor';
  if(d===1&&c.type.q==='dom') return 'D';
  if(d===0||(!minor&&(d===9||d===4))||(minor&&d===3)) return 'T';
  if(d===5||d===2||d===1||(minor&&d===8)) return 'S';
  if(d===7||d===11||(minor&&d===10)) return 'D';
  return 'C';
}
const DISS={maj:.1,min:.15,sus:.35,dom:.55,hdim:.65,dim:.75,aug:.7};
function dissonance(r){
  const c=r.c; if(!c) return r.notes.length>=3?.9:.2;
  let v=DISS[c.type.q]??.5;
  if(/[♭♯](5|9|11|13)/.test(c.type.sym)) v+=.2;
  else if(/9|11|13|6/.test(c.type.sym)) v+=.05;
  if(c.slash) v+=.05;
  return Math.min(1,v);
}

export { CTX, DISS, FN_NAME, FN_TENSION, PATTERNS, RANK, analyze, analyzeProgression, candSymbol, defaultSpell, detectKey, inversionText, keyName, keyText, letterName, melodyText, modeName, noteText, octOff, ornamentText, plainSpell, resolveStep, spellCandidate, tenDetail, tensionHelp, rankHelp, scoreDetail, keyWhy, bookends, resolvesToTonic };
