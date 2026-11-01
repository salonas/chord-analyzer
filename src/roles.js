// What each melody note is against the chord under it. text.js writes it as words; expression.js shapes the velocity by it,
// so the export and the expression call the same note by the same name.
import { T, sigOf } from './data.js';
import { analyzeProgression } from './analysis.js';
import { splitHarmony } from './harmony.js';

// a note that is not in its chord but is in the next one, within two beats of the change, and is the last
// melody note before the change, announces it; an earlier one in that window is just a tension
const ANTICIPATION=2*T;
const TOL=Math.round(.05*T); // notes that start within ±0.05 beats start together, as in harmony.js
const step=x=>x!==null&&x!==0&&Math.abs(x)<=2;
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
// a chord tone, a step to one side, a third leap to the other side and a step back to the same tone:
// the two notes in the middle are one ornament (double neighbor, cambiata)
function doubleNeighbor(mel,i,toneAt){
  const at=j=>mel[j]&&mel[j].notes[0];
  for(const a of [i-1,i-2]){
    if(a<0||!mel[a+3]||!toneAt(a)||!toneAt(a+3)||toneAt(a+1)||toneAt(a+2)||at(a)!==at(a+3)) continue;
    const u=at(a+1)-at(a), w=at(a+2)-at(a);
    if(step(u)&&step(w)&&Math.sign(u)!==Math.sign(w)) return true;
  }
  return false;
}
// The role of melody note i, in this order: none (no chord under it), tone, double, passing, neighbor, appoggiatura,
// anticipation, escape, tension, free. next is {r, a}: the chord that follows and where it starts
function melodyKind(mel,i,info,toneAt,next){
  const k=info[i]; if(!k) return 'none';
  if(k.tone) return 'tone';
  const m=mel[i].notes[0], pv=mel[i-1], nx=mel[i+1], d1=pv?m-pv.notes[0]:null, d2=nx?nx.notes[0]-m:null;
  const toward=next&&next.r&&next.r.c&&mel[i].s<next.a&&mel[i].s>=next.a-ANTICIPATION&&against(m,next.r).tone;
  const ahead=toward&&(!nx||nx.s>=next.a);
  if(doubleNeighbor(mel,i,toneAt)) return 'double';
  if(step(d1)&&step(d2)) return Math.sign(d1)===Math.sign(d2)?'passing':'neighbor';
  if(step(d2)&&toneAt(i+1)) return 'appoggiatura';
  // the last note before the change that belongs to the next chord announces it, even when it came by step
  if(ahead) return 'anticipation';
  if(step(d1)) return 'escape';
  return k.ten==='mid'||toward?'tension':'free';
}
// The role of every melody note of a pattern by note id: {kind, to} where to are the ids of the next melody note
function melodyKinds(p,prefs){
  const Hm=splitHarmony(p), out=new Map();
  if(!Hm.mel.length||!Hm.chords.length) return out;
  const A=analyzeProgression(Hm.chords.map(c=>({notes:c.notes,dur:c.b-c.a,...(p.names[sigOf(c.notes)]||{})})),prefs);
  const ci=x=>Hm.chords.indexOf(Hm.chordAt(x.s)), info=Hm.mel.map(x=>against(x.notes[0],A.rs[ci(x)]));
  const toneAt=j=>info[j]&&info[j].tone;
  const ids=x=>p.notes.filter(n=>Math.abs(n.s-x.s)<=TOL&&x.notes.includes(n.m)).map(n=>n.id);
  Hm.mel.forEach((x,i)=>{
    const k=ci(x), nr=A.rs[k+1], next=k>=0&&nr?{r:nr,a:Hm.chords[k+1].a}:null;
    const kind=melodyKind(Hm.mel,i,info,toneAt,next), to=Hm.mel[i+1]?ids(Hm.mel[i+1]):[];
    ids(x).forEach(id=>out.set(id,{kind,to}));
  });
  return out;
}

export { ANTICIPATION, TOL, against, doubleNeighbor, melodyKind, melodyKinds, step };
