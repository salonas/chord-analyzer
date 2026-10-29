// Slides and portamento, written as pitch automation: a flag per note (n.g: 's' slide, 'p' portamento)
// turns the pattern into voices that carry a pitch curve. Playback retunes the voice along the curve
// and the .mid writes it as pitch bend, scaled to the bend range of the receiving instrument.
import { T } from './data.js';

const PORTA=T/4;          // portamento glides into the note over a sixteenth
const BEND_RANGE=2;       // semitones; the .sfz default (±200 cents), used by 33 of the 43 template channels
const rangeOf=p=>p.bend||BEND_RANGE;

// As in FL's piano roll. Slide: a note that makes no sound of its own; the voice still sounding when it
// starts glides to its pitch over its length, and the glide stops where that voice ends. Portamento: this
// note starts with its own attack at the previous note's pitch and glides to its own over PORTA.
// A flag only counts when it starts after the previous note, no other voice sounds while it bends, and
// the jump fits range (the pattern's bend range for the pitch-bend .mid; playback and native glides pass
// Infinity). Otherwise a portamento plays plain, a slide out of range plays plain (FL would still glide)
// and a slide with no voice to bend stays silent, as in FL.
// Returns {voices:[{m,s,e,v,bend:[{t,d}]}], glides:[{n,from,V}], skipped}: times in ticks, d in semitones
// from the voice's m, and each flag that counts with the pitch it glides from and the voice it bends.
function glidePlan(p,range=rangeOf(p)){
  const ns=[...p.notes].sort((a,b)=>a.s-b.s||a.m-b.m), voices=[], glides=[], of=new Map();
  let skipped=0;
  ns.forEach((n,i)=>{
    const plain=()=>{ const V={m:n.m,s:n.s,e:n.s+n.l,v:n.v||100,bend:[]}; voices.push(V); of.set(n,V); };
    if(!n.g) return plain();
    // notes already in the voice that slides do not count as other notes, nor later slide notes, which
    // sit on top of the note they bend and are checked in their turn
    const prev=i>0?ns[i-1]:null, PV=prev&&n.g==='s'?of.get(prev):null;
    const alone=prev&&prev.s<n.s&&(n.g!=='s'||(PV&&PV.e>n.s))&&ns.every(x=>x===n||x===prev||(PV&&of.get(x)===PV)||(x.g==='s'&&x.s>n.s)||x.s+x.l<=n.s||x.s>=n.s+n.l);
    if(!alone){ skipped++; return n.g==='s'?undefined:plain(); }
    if(n.g==='p'){
      if(Math.abs(prev.m-n.m)>range){ skipped++; return plain(); }
      const V={m:n.m,s:n.s,e:n.s+n.l,v:n.v||100,bend:[{t:n.s,d:prev.m-n.m},{t:n.s+Math.min(PORTA,n.l),d:0}]};
      voices.push(V); of.set(n,V); glides.push({n,from:prev.m,V}); return;
    }
    const V=PV;
    if(Math.abs(n.m-V.m)>range){ skipped++; return plain(); }
    // from wherever the voice is (an earlier slide may still be gliding) to this pitch, cut where the voice ends
    const d0=bendAt(V.bend,n.s), d1=n.m-V.m, end=Math.min(n.s+n.l,V.e);
    V.bend.push({t:n.s,d:d0},{t:end,d:d0+(d1-d0)*(end-n.s)/n.l});
    of.set(n,V); glides.push({n,from:V.m+d0,V});
  });
  return {voices,glides,skipped};
}
// semitones from the voice's pitch at tick t (0 before the first point, linear between points)
function bendAt(bend,t){
  if(!bend.length||t<bend[0].t) return 0;
  for(let i=1;i<bend.length;i++){
    const a=bend[i-1], b=bend[i];
    if(t<=b.t) return b.t===a.t?b.d:a.d+(b.d-a.d)*(t-a.t)/(b.t-a.t);
  }
  return bend[bend.length-1].d;
}
const hasGlide=p=>p.notes.some(n=>n.g);

export { BEND_RANGE, PORTA, bendAt, glidePlan, hasGlide, rangeOf };
