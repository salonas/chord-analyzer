// Harmony and melody for the text export: which notes make the chords, which are the tune.
// Heuristics from the rules the user wrote down (session 14), not measurements.
import { T, sigOf } from './data.js';
import { isBlock, isMulti, progEnd, segs } from './model.js';
import { analyze, resolveStep } from './analysis.js';

const TOL=Math.round(.05*T); // notes that start within ±0.05 beats start together
const SHORT=T/2;             // a passing bass lasts half a beat or less
const isHarm=r=>r==='harm'||r==='inner';

// Each note gets a role: harm (chord), inner (moving inner voice), pass (passing bass) or mel (tune)
function noteRoles(ns){
  const groups=[];
  for(const n of ns){ const g=groups[groups.length-1]; if(g&&n.s-g.s<=TOL) g.notes.push(n); else groups.push({s:n.s,notes:[n]}); }
  const role=new Map();
  for(const g of groups){
    const k=g.notes.length, pcs=new Set(g.notes.map(n=>n.m%12));
    // a chord starts with two more notes; two notes count when one holds a beat or they are the same note in octaves
    g.notes.forEach(n=>{ if(k>=3||(k===2&&(n.l>=T||pcs.size===1))) role.set(n.id,'harm'); });
    // the top of a chord that moves on while the rest holds is the tune,
    // unless the rest is one note in octaves and the top its fifth: that is a power chord
    if(k>=3){
      const top=g.notes[k-1], rest=g.notes.slice(0,-1), restEnd=Math.min(...rest.map(n=>n.s+n.l)), end=top.s+top.l;
      const power=new Set(rest.map(n=>n.m%12)).size===1&&(top.m-rest[0].m)%12===7;
      if(!power&&end<restEnd-TOL&&ns.some(n=>n.s>=end-TOL&&n.s<restEnd&&n.m>rest[rest.length-1].m)) role.set(top.id,'mel');
    }
  }
  for(const n of ns){
    if(role.has(n.id)) continue;
    const under=ns.filter(o=>o!==n&&isHarm(role.get(o.id))&&o.s<=n.s&&o.s+o.l>n.s);
    if(under.length&&under.every(o=>o.m>n.m)&&n.l<=SHORT) role.set(n.id,'pass');
    else if(under.some(o=>o.m<n.m)&&under.some(o=>o.m>n.m)) role.set(n.id,'inner');
    else role.set(n.id,'mel');
  }
  return role;
}

const subset=(a,b)=>[...a].every(x=>b.has(x));

// The highest voice: each note that starts above everything still sounding, chord tops included
function topVoice(ns){
  const top=[];
  for(let i=0;i<ns.length;){
    let j=i; while(j<ns.length&&ns[j].s-ns[i].s<=TOL) j++;
    const h=ns.slice(i,j).reduce((a,n)=>n.m>=a.m?n:a);
    if(!ns.some(o=>o.s<ns[i].s-TOL&&o.s+o.l>h.s+TOL&&o.m>=h.m)) top.push({notes:[h.m],s:h.s,l:h.l});
    i=j;
  }
  return top;
}

// The tune inside plain blocks (decision 2 in THEORY.md): the top note of a block is melody only when it is more than an
// octave above the next voice, the notes under it are a chord of three or more pitch classes, and at least two such
// blocks have different tops. Open pads (C2 G2 E4) and wide voicings (C2 E5 G6) stay chords. Returns the melody note ids.
const OCTAVE=12;
function blockMelody(p,S){
  const tops=S.map(s=>{
    if(s.notes.length<4||s.notes[s.notes.length-1]-s.notes[s.notes.length-2]<=OCTAVE) return null;
    const under=s.notes.slice(0,-1);
    if(new Set(under.map(m=>m%12)).size<3||!analyze(under,null).length) return null;
    return s.notes[s.notes.length-1];
  });
  const found=S.filter((s,i)=>tops[i]!=null);
  if(found.length<2||new Set(tops.filter(m=>m!=null)).size<2) return new Set();
  return new Set(p.notes.filter(n=>S.some((s,i)=>tops[i]===n.m&&s.ids.has(n.id))).map(n=>n.id));
}

// A broken chord (Alberti bass, arpeggio): one voice, no two notes sounding together, read as chords by half bar, or by
// bar when the halves do not work; equal neighbours merge. Each group must move only by leaps (a minor third or more)
// and hold three or more pitch classes that make a chord; one group that fails voids the reading, so a scale or a
// tune stays notes.
const BAR=4*T, LEAP=3;
function arpeggioChords(p){
  const ns=[...p.notes].sort((a,b)=>a.s-b.s||a.m-b.m);
  if(isMulti(p)||ns.length<3||ns.some((n,i)=>i&&n.s<ns[i-1].s+ns[i-1].l)) return null;
  for(const len of [BAR/2,BAR]){
    const groups=new Map();
    ns.forEach(n=>{ const k=Math.floor(n.s/len); if(!groups.has(k)) groups.set(k,[]); groups.get(k).push(n); });
    const chords=[];
    for(const [k,g] of groups){
      const ms=[...new Set(g.map(n=>n.m))].sort((a,b)=>a-b);
      if(g.length<3||new Set(ms.map(m=>m%12)).size<3||g.some((n,i)=>i&&Math.abs(n.m-g[i-1].m)<LEAP)||!analyze(ms,null).length) break;
      chords.push({a:k*len,b:Math.max(...g.map(n=>n.s+n.l)),notes:ms,ids:g.map(n=>n.id)});
    }
    if(chords.length===groups.size){
      const pcsOf=c=>[...new Set(c.notes.map(m=>m%12))].sort((a,b)=>a-b).join();
      const out=[];
      for(const c of chords){
        const prev=out[out.length-1];
        if(prev&&pcsOf(prev)===pcsOf(c)){ prev.b=c.b; prev.notes=[...new Set([...prev.notes,...c.notes])].sort((a,b)=>a-b); prev.ids.push(...c.ids); }
        else out.push(c);
      }
      // each chord lasts until the next one starts
      out.forEach((c,i)=>{ if(out[i+1]) c.b=out[i+1].a; });
      return out;
    }
  }
  return null;
}

// A broken accompaniment under a tune (an Alberti bass, a bass in octaves): where no chord has started, the stretch is read
// beat by beat with every note that sounds, and the timing of the notes tells ornaments from chord tones (decision 8).
// A stretch makes a chord only when it holds three or more pitch classes and one note sounds within another of a different
// pitch class (one voice holds while another moves, or both start and end together), so a tune or a scale on its own,
// legato too, and two short notes stay notes. A beat short of that joins the chord before it when its
// notes belong to that chord (the other half of an Alberti figure), or else gathers the next beats, up to a bar, until it
// makes one. Neighbours with the same reading merge. The notes keep their roles; own holds the ones under the top voice,
// so that deleting the chord leaves the tune.
const NAMING={naming:'letters',accPref:'auto',octConv:'sci',midiShift:0};
function gridChords(ns,a,b){
  const sounding=(x,y)=>ns.filter(n=>n.s<y&&n.s+n.l>x), pcsOf=on=>new Set(on.map(n=>n.m%12));
  const makes=on=>pcsOf(on).size>=3&&on.some(n=>on.some(o=>o!==n&&o.m%12!==n.m%12&&o.s>=n.s-TOL&&o.s+o.l<=n.s+n.l+TOL));
  const read=(x,y)=>{
    const on=sounding(x,y), notes=[...new Set(on.map(n=>n.m))].sort((u,v)=>u-v);
    const c=resolveStep({notes,dur:y-x,a:x,evs:on.map(n=>({m:n.m,s:n.s,l:n.l}))},NAMING).c;
    return c?{k:c.root+c.type.sym,pcs:new Set(c.type.degs.map(d=>(d.pc+c.root)%12))}:{k:null,pcs:new Set()};
  };
  const out=[]; let w=null;
  for(let t=Math.floor(a/T)*T;t<b;t+=T){
    const x=Math.max(a,t), y=Math.min(b,t+T), on=sounding(x,y), prev=out[out.length-1];
    if(!on.length){ w=null; continue; }
    if(!w&&!makes(on)&&prev&&prev.b===x&&[...pcsOf(on)].every(pc=>prev.pcs.has(pc))){ prev.b=y; continue; }
    w=w||{a:x}; w.b=y;
    if(makes(sounding(w.a,w.b))){
      const r=read(w.a,w.b);
      if(prev&&prev.b===w.a&&prev.k===r.k) prev.b=w.b; else out.push({a:w.a,b:w.b,...r});
      w=null;
    } else if(w.b-w.a>=4*T) w=null;
  }
  return out.map(g=>{
    const notes=[...new Set(sounding(g.a,g.b).map(n=>n.m))].sort((u,v)=>u-v);
    const own=new Set(ns.filter(n=>n.s>=g.a&&n.s<g.b&&ns.some(o=>o!==n&&o.s<=n.s+TOL&&o.s+o.l>n.s&&o.m>n.m)).map(n=>n.id));
    return {a:g.a,b:g.b,notes,pcs:new Set(notes.map(m=>m%12)),bass:[{m:notes[0],s:g.a}],adds:[],own};
  });
}

// Chords change when the pitch classes above the bass change, the bass changes, or the whole chord is struck again.
// Returns {chords:[{a,b,notes,bass:[{m,s,pass}],adds:[{m,s}]}], mel:[{notes:[...],s,l}]} in ticks.
function splitHarmony(p){
  // plain blocks (each note starts and ends with its chord) are chords as drawn, even a lone note
  const arp=arpeggioChords(p);
  if(arp){
    const chords=arp.map(c=>({a:c.a,b:c.b,notes:c.notes,pcs:new Set(c.notes.map(m=>m%12)),bass:[{m:c.notes[0],s:c.a}],adds:[]}));
    return {chords,mel:[],top:[],role:new Map(p.notes.map(n=>[n.id,'harm'])),chordAt:t=>chords.find(c=>c.a<=t&&t<c.b)};
  }
  const S=segs(p);
  if(S.length&&S.every(s=>isBlock(p,s))){
    const tune=blockMelody(p,S);
    const role=new Map(p.notes.map(n=>[n.id,tune.has(n.id)?'mel':'harm']));
    const chords=S.map(s=>{ const notes=s.notes.filter(m=>!p.notes.some(n=>tune.has(n.id)&&s.ids.has(n.id)&&n.m===m));
      return {a:s.a,b:s.b,notes,pcs:new Set(notes.map(m=>m%12)),bass:[{m:notes[0],s:s.a}],adds:[]}; });
    const mel=p.notes.filter(n=>tune.has(n.id)).sort((a,b)=>a.s-b.s).map(n=>({notes:[n.m],s:n.s,l:n.l}));
    return {chords,mel,top:[],role,chordAt:t=>chords.find(c=>c.a<=t&&t<c.b)};
  }
  const ns=[...p.notes].sort((a,b)=>a.s-b.s||a.m-b.m), role=noteRoles(ns);
  const H=ns.filter(n=>isHarm(role.get(n.id)));
  const chords=[]; let cur=null;
  const starts=[];
  for(const n of H) if(role.get(n.id)==='harm'&&!(starts.length&&n.s-starts[starts.length-1]<=TOL)) starts.push(n.s);
  for(const t of starts){
    const snd=H.filter(o=>o.s<=t+TOL&&o.s+o.l>t).sort((a,b)=>a.m-b.m);
    if(!snd.length) continue;
    const all=new Set(snd.map(o=>o.m%12)), bass=snd[0], up=new Set(snd.slice(1).map(o=>o.m%12));
    if(all.size<2){
      // one pitch class (a note or its octaves) cannot open a chord: it belongs to the current one or to the tune
      if(cur&&subset(all,cur.pcs)){
        if(bass.s>=t-TOL) cur.bass.push({m:bass.m,s:t});
        snd.slice(1).forEach(o=>{ if(o.s>=t-TOL&&!cur.notes.includes(o.m)&&!cur.adds.some(x=>x.m===o.m)) cur.adds.push({m:o.m,s:o.s}); });
        continue;
      }
      snd.filter(o=>o.s>=t-TOL).forEach(o=>role.set(o.id,'mel'));
      continue;
    }
    const full=snd.every(o=>o.s>=t-TOL);
    const fresh=!cur||full||bass.m%12!==cur.bassPc||(!subset(up,cur.up)&&!subset(cur.up,up));
    if(fresh){
      if(cur) cur.b=t;
      cur={a:t,b:null,notes:snd.map(o=>o.m),bassPc:bass.m%12,up,pcs:all,bass:[{m:bass.m,s:t}],adds:[]};
      chords.push(cur);
    } else {
      if(bass.s>=t-TOL) cur.bass.push({m:bass.m,s:t});
      snd.slice(1).forEach(o=>{ if(o.s>=t-TOL&&!cur.notes.includes(o.m)&&!cur.adds.some(x=>x.m===o.m)) cur.adds.push({m:o.m,s:o.s}); });
      all.forEach(x=>cur.pcs.add(x));
    }
  }
  if(cur) cur.b=Math.max(progEnd(p),cur.a);
  const inChord=t=>chords.find(c=>c.a<=t+TOL&&t<c.b-TOL);
  // inner voices and passing basses go into their chord
  ns.forEach(n=>{
    const r=role.get(n.id), c=inChord(n.s);
    if(r==='inner'){ if(c&&!c.notes.includes(n.m)&&!c.adds.some(x=>x.m===n.m)) c.adds.push({m:n.m,s:n.s}); else if(!c) role.set(n.id,'mel'); }
    if(r==='pass'){ if(c) c.bass.push({m:n.m,s:n.s,pass:true}); else role.set(n.id,'mel'); }
  });
  // after the one-voice arpeggio (arpeggioChords, above) and the struck chords: the stretch before the first chord, or the
  // whole pattern when none started, may be a broken accompaniment
  const first=chords.length?chords[0].a:progEnd(p);
  if(ns.length&&first>ns[0].s) chords.unshift(...gridChords(ns,ns[0].s,first));
  chords.forEach(c=>{
    c.bass.sort((x,y)=>x.s-y.s);
    c.bass=c.bass.filter((x,i,a)=>i===0||x.pass||a[i-1].pass||x.m!==a[i-1].m);
    c.adds.sort((x,y)=>x.s-y.s||x.m-y.m);
    delete c.up; delete c.bassPc;
  });
  // the tune: notes that start together and share a pitch class are one doubled note
  const mel=[];
  ns.filter(n=>role.get(n.id)==='mel').forEach(n=>{
    const g=mel.find(x=>Math.abs(x.s-n.s)<=TOL&&x.notes[0]%12===n.m%12);
    if(g){ g.notes.push(n.m); g.l=Math.max(g.l,n.l); } else mel.push({notes:[n.m],s:n.s,l:n.l});
  });
  return {chords,mel,top:topVoice(ns),role,chordAt:inChord};
}
// The chords in the shape of segs() for the chord lane, the analysis sheet and the chord tools:
// ids are the chord's own notes (not the tune), so deleting a chord leaves the melody
function harmonySegs(p){
  const H=splitHarmony(p);
  return H.chords.map(c=>({a:c.a,b:c.b,notes:c.notes,sig:sigOf(c.notes),
    ids:c.own||new Set(p.notes.filter(n=>H.role.get(n.id)!=='mel'&&n.s>=c.a-TOL&&n.s<c.b-TOL).map(n=>n.id))}));
}

export { arpeggioChords, blockMelody, gridChords, harmonySegs, noteRoles, splitHarmony };
