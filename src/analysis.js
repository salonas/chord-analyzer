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
      let score=t.rank+missing.length*2+(bass!==r?3:0)+(missing.some(d=>d.n===5)&&/^m?6$/.test(t.sym)?1.5:0);
      if(locked!=null && locked===r) score-=10;
      out.push({root:r,type:t,missing,score,slash:bass!==r,bass});
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
    notes:notes.map(m=>{const s=byPc[m%12];return {...spellMidi(m,s.l,s.a),deg:s.deg}})};
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
function resolveStep(step,prefs,key){
  const notes=[...step.notes].sort((a,b)=>a-b);
  const cands=analyze(notes,null);
  const c=cands.find(x=>x.root===step.root&&x.type.sym===step.sym)||cands[0]||null;
  const sp=c?spellCandidate(c,notes,prefs,key):null;
  const spelled=sp?sp.notes:notes.map(m=>plainSpell(m,prefs,key));
  let label;
  if(c){const sy=candSymbol(c,sp,prefs); label=sy.main+sy.slash;}
  else if(notes.length===1) label=noteText(spelled[0],prefs);
  else if(notes.length===2) label=letterName(spelled[0].l,spelled[0].a,prefs)+'–'+letterName(spelled[1].l,spelled[1].a,prefs);
  else label=notes.length?'?':'—';
  return {notes,c,sp,spelled,label};
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
    const tq=mode==='major'?['maj','dom']:['min'];
    const f=items[0], l=items[items.length-1];
    if(f.root===t&&tq.includes(f.q)) s+=2;
    // V7–vi of the relative major is a deceptive cadence: it ends off the tonic on purpose, so it is no evidence for the minor
    const pv=items[items.length-2], deceptive=mode==='minor'&&pv&&pv.q==='dom'&&pv.root===(t+10)%12;
    if(l.root===t&&tq.includes(l.q)&&!deceptive) s+=3;
    // a progression that starts and ends on the same tonic chord is closed on it, even when the chords between borrow
    if(items.length>2&&f.root===t&&l.root===t&&f.q===l.q&&tq.includes(f.q)) s+=1.5;
    items.forEach((it,i)=>{
      if(it.root===t&&tq.includes(it.q)) s+=.5;
      const nx=items[i+1];
      if(nx&&nx.root===t&&(it.q==='dom'||it.q==='aug'||(it.q==='maj'&&mode==='minor'))&&(it.root-t+12)%12===7) s+=3;
    });
    if(mode==='major') s+=.01;
    res.push({tonic:t,mode,score:s});
  }
  return res.sort((a,b)=>b.score-a.score);
}
const modeName=k=>k&&k.modal?tr(...MODE_NAME[k.modal]):'';
const keyName=(k,prefs)=>{const [l,a]=keyTonicSpell(k,prefs)||rootSpell(k.tonic,k.mode==='minor'?'min':'maj',prefs); return letterName(l,a,prefs)+(k.mode==='major'?tr(' mayor',' major'):tr(' menor',' minor'));};
// «D menor (dórico)», and with an alternate key «D menor (dórico; o C mayor)»
function keyText(k,alt,prefs){
  const inner=[modeName(k),alt?tr('o ','or ')+keyName(alt,prefs):''].filter(Boolean).join('; ');
  return keyName(k,prefs)+(inner?` (${inner})`:'');
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
  let fig='';
  if(c.slash){
    const d=bassDeg(c);
    if(c.type.degs.length===3&&q!=='sus'&&d.n===3) fig='⁶';
    else if(c.type.degs.length===3&&q!=='sus'&&d.n===5) fig='⁶₄';
    else if(SEVENTHS.has(c.type.sym)&&[3,5,7].includes(d.n)){ fig={3:'⁶₅',5:'⁴₃',7:'⁴₂'}[d.n]; ext=ext.replace(/7$/,''); }
    else fig='/'+d.label;
  }
  const token=base+(q==='dim'||q==='hdim'?'°':q==='aug'?'+':'');
  return {deg,base,token,text:base+mark+ext+fig,diatonic:(expFor(key)[deg]||[]).includes(q)||(q==='sus'&&!!expFor(key)[deg])};
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
    if((q==='dom'||q==='maj')&&up===5&&nx.deg!==0){
      ro.text='V'+(q==='dom'?(c.type.sym.match(/^\d+/)||[''])[0]:'')+'/'+targetBase(nx,key); ro.secondary=true;
    } else if((q==='dim'||q==='hdim')&&up===1&&nx.deg!==0){
      ro.text='vii'+(q==='hdim'?'ø':'°')+(q==='hdim'||c.type.sym==='dim7'?'7':'')+'/'+targetBase(nx,key); ro.secondary=true;
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
      ro.text=g+{Ger:'⁶₅',Fr:'⁴₃',It:'⁶'}[g]; ro.aug6=g;
      respell(rs[i],key,prefs,{8:5,0:0,6:3,3:2,2:1});
    } else if(c.type.sym==='dim7'&&has(0)&&pv&&nc&&pv.root===key.tonic&&nc.root===key.tonic){
      ro.text='♯ii°7'; ro.ct=true;
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
  const rs=steps.map(s=>resolveStep(s,prefs,key));
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
    else if(bd===0&&ad===10) cad=tr('Cadencia ♭VII → I (backdoor / mixolidia)','♭VII → I cadence (backdoor / Mixolydian)');
    else if(bd===0&&ad===11) cad=tr('Cadencia con sensible ','Leading-tone cadence ')+pair;
    else if(bd===0&&ad===1&&rs[N-2].c.type.q==='dom') cad=tr('Cadencia con sustituto tritonal (♭II7 → I)','Tritone substitution cadence (♭II7 → I)');
    else if(ad===7&&(bd===9||bd===8)) cad=tr('Cadencia rota (V → ','Deceptive cadence (V → ')+romans[N-1].base+')';
    else if(bd===7) cad=tr('Semicadencia (termina en V)','Half cadence (ends on V)');
  }
  const fn=romans.map((ro,i)=>harmonicFunction(ro,rs[i].c,key));
  const ten=rs.map((r,i)=>+(.5*FN_TENSION[fn[i]]+.5*dissonance(r)).toFixed(2));
  return {rs,romans,key,alt,found,cad,fn,ten};
}
// Harmonic function in the detected key: T tonic, S subdominant, D dominant, C color (borrowed or chromatic)
const FN_TENSION={T:.1,S:.4,D:.8,C:.5,'?':.5};
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
function dissonance(r){
  const c=r.c; if(!c) return r.notes.length>=3?.9:.2;
  let v={maj:.1,min:.15,sus:.35,dom:.55,hdim:.65,dim:.75,aug:.7}[c.type.q]??.5;
  if(/[♭♯](5|9|11|13)/.test(c.type.sym)) v+=.2;
  else if(/9|11|13|6/.test(c.type.sym)) v+=.05;
  if(c.slash) v+=.05;
  return Math.min(1,v);
}

export { FN_NAME, PATTERNS, analyze, analyzeProgression, candSymbol, defaultSpell, detectKey, inversionText, keyName, keyText, letterName, modeName, noteText, octOff, plainSpell, resolveStep, spellCandidate };
