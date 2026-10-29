// Chord and progression analysis. Display preferences (naming, accPref, octConv) come in `prefs`.
import { AUTO, FLAT, LATIN, LETTERS, NAT, OCT_CONV, ROMAN, SEVENTHS, SHARP, TYPES } from './data.js';
import { tr } from './i18n.js';

// ---------- naming ----------
const accStr=a=>({'-2':'♭♭','-1':'♭','0':'','1':'♯','2':'♯♯'})[a];
const letterName=(l,a,prefs)=>(prefs.naming==='latin'?LATIN:LETTERS)[l]+accStr(a);
function defaultSpell(pc,prefs){return (prefs.accPref==='flat'?FLAT:prefs.accPref==='sharp'?SHARP:AUTO)[pc]}
function rootSpell(pc,q,prefs){
  if(prefs.accPref==='sharp') return SHARP[pc];
  if(prefs.accPref==='flat') return FLAT[pc];
  if((q==='min'||q==='dim'||q==='hdim')&&(pc===1||pc===8)) return SHARP[pc];
  return AUTO[pc];
}
function spellMidi(m,l,a){return {midi:m,l,a,oct:Math.round((m-a-NAT[l])/12)-1}}
function plainSpell(m,prefs){const [l,a]=defaultSpell(m%12,prefs);return spellMidi(m,l,a)}
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
      let score=t.rank+missing.length*2+(bass!==r?3:0);
      if(locked!=null && locked===r) score-=10;
      out.push({root:r,type:t,missing,score,slash:bass!==r,bass});
    }
  }
  out.sort((a,b)=>a.score-b.score);
  return out.slice(0,10);
}
function spellCandidate(c,notes,prefs){
  const [rl,ra]=rootSpell(c.root,c.type.q,prefs);
  const byPc={};
  for(const d of c.type.degs){
    const pc=(d.pc+c.root)%12, l=(rl+d.step)%7;
    let a=((pc-NAT[l])%12+12)%12; if(a>6)a-=12;
    if(Math.abs(a)<=2) byPc[pc]={l,a,deg:d};
    else { const [L,A]=defaultSpell(pc,prefs); byPc[pc]={l:L,a:A,deg:d}; }
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
function resolveStep(step,prefs){
  const notes=[...step.notes].sort((a,b)=>a-b);
  const cands=analyze(notes,null);
  const c=cands.find(x=>x.root===step.root&&x.type.sym===step.sym)||cands[0]||null;
  const sp=c?spellCandidate(c,notes,prefs):null;
  const spelled=sp?sp.notes:notes.map(m=>plainSpell(m,prefs));
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
function detectKey(items){
  const res=[];
  for(let t=0;t<12;t++) for(const mode of ['major','minor']){
    const sc=mode==='major'?MAJ:MIN; let s=0;
    items.forEach(it=>{
      const own7=it.q==='dom'?(it.root+10)%12:-1;
      it.pcs.forEach(p=>{const r=(p-t+12)%12; s+=sc.includes(r)?1:p===own7?0:(mode==='minor'&&r===11?.3:-1.2);});
      if(it.q){ const e=EXPK[mode][(it.root-t+12)%12]; if(e&&e.includes(it.q)) s+=1.5; else if(e&&it.q==='sus') s+=.5; }
    });
    const tq=mode==='major'?['maj','dom']:['min'];
    const f=items[0], l=items[items.length-1];
    if(f.root===t&&tq.includes(f.q)) s+=2;
    if(l.root===t&&tq.includes(l.q)) s+=3;
    items.forEach((it,i)=>{
      if(it.root===t&&tq.includes(it.q)) s+=.5;
      const nx=items[i+1];
      if(nx&&nx.root===t&&(it.q==='dom'||(it.q==='maj'&&mode==='minor'))&&(it.root-t+12)%12===7) s+=3;
    });
    if(mode==='major') s+=.01;
    res.push({tonic:t,mode,score:s});
  }
  return res.sort((a,b)=>b.score-a.score);
}
const keyName=(k,prefs)=>{const [l,a]=rootSpell(k.tonic,k.mode==='minor'?'min':'maj',prefs); return letterName(l,a,prefs)+(k.mode==='major'?tr(' mayor',' major'):tr(' menor',' minor'));};
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
  return {deg,base,token,text:base+mark+ext+fig,diatonic:(EXP[key.mode][deg]||[]).includes(q)||(q==='sus'&&!!EXP[key.mode][deg])};
}
const PATTERNS=[
 ['Pop I–V–vi–IV','Pop I–V–vi–IV','I V vi IV'],['Pop vi–IV–I–V','Pop vi–IV–I–V','vi IV I V'],['Años 50 (doo-wop)','50s progression (doo-wop)','I vi IV V'],
 ['Turnaround I–vi–ii–V','Turnaround I–vi–ii–V','I vi ii V'],['iii–vi–ii–V','iii–vi–ii–V','iii vi ii V'],['ii–V–I','ii–V–I','ii V I'],['ii–V–i menor','Minor ii–V–i','ii° V i'],
 ['Royal road (J-pop)','Royal road (J-pop)','IV V iii vi'],['Canon de Pachelbel','Pachelbel’s Canon','I V vi iii IV I IV V'],['I–IV–V','I–IV–V','I IV V'],
 ['Cadencia completa I–IV–V–I','Full cadence I–IV–V–I','I IV V I'],['Cadencia andaluza','Andalusian cadence','i ♭VII ♭VI V'],['Épica i–♭VI–♭III–♭VII','Epic i–♭VI–♭III–♭VII','i ♭VI ♭III ♭VII'],
 ['Menor i–♭VI–♭VII','Minor i–♭VI–♭VII','i ♭VI ♭VII'],['Menor i–iv–v','Minor i–iv–v','i iv v'],['Menor i–iv–V','Minor i–iv–V','i iv V'],['Mixolidia I–♭VII–IV','Mixolydian I–♭VII–IV','I ♭VII IV'],
 ['Blues de 12 compases','12-bar blues','I I I I IV IV I I V IV I I'],['Blues de 12 (quick change)','12-bar blues (quick change)','I IV I I IV IV I I V IV I V'],
].map(([es,en,p])=>({get name(){return tr(es,en);},seq:p.split(' ')}));
function analyzeProgression(steps,prefs){
  const rs=steps.map(s=>resolveStep(s,prefs));
  const items=rs.map(r=>r.c?{root:r.c.root,q:r.c.type.q,pcs:[...new Set(r.notes.map(m=>m%12))]}:{root:r.notes.length?r.notes[0]%12:0,q:null,pcs:[...new Set(r.notes.map(m=>m%12))]});
  if(!items.length) return {rs,romans:[],found:[]};
  const keys=detectKey(items), key=keys[0], alt=keys.find(k=>k!==key&&key.score-k.score<2);
  const romans=rs.map(r=>r.c?romanFor(r.c,key):null);
  romans.forEach((ro,i)=>{
    const c=rs[i].c, nx=romans[i+1], nc=rs[i+1]&&rs[i+1].c;
    if(!ro||!nc||!nx||ro.diatonic) return;
    if((c.type.q==='dom'||c.type.q==='maj')&&(nc.root-c.root+12)%12===5&&nx.deg!==0){
      ro.text='V'+(c.type.q==='dom'?(c.type.sym.match(/^\d+/)||[''])[0]:'')+'/'+nx.base; ro.secondary=true;
    }
  });
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
    if(bd===0&&ad===7) cad=tr('Cadencia auténtica (V → I)','Authentic cadence (V → I)');
    else if(bd===0&&ad===5) cad=tr('Cadencia plagal (IV → I)','Plagal cadence (IV → I)');
    else if(bd===0&&ad===10) cad=tr('Cadencia ♭VII → I (backdoor / mixolidia)','♭VII → I cadence (backdoor / Mixolydian)');
    else if(bd===0&&ad===11) cad=tr('Cadencia con sensible (vii° → I)','Leading-tone cadence (vii° → I)');
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
  if(ro.secondary) return 'D';
  const d=ro.deg, minor=key.mode==='minor';
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

export { FN_NAME, PATTERNS, analyze, analyzeProgression, candSymbol, defaultSpell, detectKey, inversionText, keyName, letterName, noteText, octOff, plainSpell, resolveStep, spellCandidate };
