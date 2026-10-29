// MIDI import and voice separation.
import { T, instDefaults, uid } from './data.js';
import { EXAMPLE_NAME, normProg, normProject } from './model.js';
import DEFAULT_MID from './default_in_c.mid?inline';
import { tr } from './i18n.js';

// ---------- MIDI import (.mid from FL) ----------
function parseMidi(buf){
  const d=new Uint8Array(buf), dv=new DataView(buf), str=(o,n)=>String.fromCharCode(...d.slice(o,o+n));
  if(d.length<14||str(0,4)!=='MThd') throw new Error(tr('no es un archivo MIDI (falta la cabecera MThd)','not a MIDI file (the MThd header is missing)'));
  const hl=dv.getUint32(4), ntr=dv.getUint16(10), div=dv.getUint16(12);
  if(div&0x8000) throw new Error(tr('usa tiempo SMPTE, que no está soportado','uses SMPTE time, which is not supported'));
  let p=8+hl, tempo=null; const tracks=[];
  for(let k=0;k<ntr&&p+8<=d.length;k++){
    if(str(p,4)!=='MTrk') break;
    const len=dv.getUint32(p+4); let i=p+8; const end=Math.min(d.length,i+len); p=i+len;
    let t=0, run=0, name=''; const notes=[], on=new Map();
    const vlq=()=>{ let v=0,b; do{ b=d[i++]; v=(v<<7)|(b&0x7f); }while(b&0x80&&i<end); return v; };
    while(i<end){
      t+=vlq(); let s=d[i];
      // running status: a data byte here reuses the previous status byte
      if(s<0x80) s=run; else i++;
      if(s===0xFF){ const ty=d[i++], n=vlq(); if(ty===3&&!name) name=new TextDecoder('latin1').decode(d.slice(i,i+n)).trim(); if(ty===0x51&&tempo==null&&n>=3) tempo=60e6/((d[i]<<16)|(d[i+1]<<8)|d[i+2]); i+=n; continue; }
      if(s===0xF0||s===0xF7){ i+=vlq(); continue; }
      run=s; const hi=s&0xF0, ch=s&15;
      if(hi===0x90||hi===0x80){
        const m=d[i++], v=d[i++], key=ch*128+m;
        if(hi===0x90&&v>0){ if(!on.has(key)) on.set(key,[]); on.get(key).push({t,v}); }
        else { const q=on.get(key); if(q&&q.length){ const o=q.shift(); notes.push({m,s:o.t,l:Math.max(1,t-o.t),v:o.v,ch}); } }
      } else if(hi===0xC0||hi===0xD0) i+=1; else i+=2;
    }
    // notes still held when the track ends last until its final event
    on.forEach((q,key)=>q.forEach(o=>notes.push({m:key%128,s:o.t,l:Math.max(1,t-o.t),v:o.v,ch:Math.floor(key/128)})));
    if(notes.length) tracks.push({name,notes});
  }
  const sc=T/div;
  tracks.forEach(tr=>tr.notes=tr.notes.map(n=>({id:uid(),m:n.m,s:Math.round(n.s*sc),l:Math.max(1,Math.round(n.l*sc)),v:n.v||100,ch:n.ch})));
  return {tracks,tempo};
}
// the project of a first visit: default_in_c.mid (FL pattern «Turnaround») on the Piano profile
function defaultProject(){
  const bin=atob(DEFAULT_MID.slice(DEFAULT_MID.indexOf(',')+1)), u8=Uint8Array.from(bin,c=>c.charCodeAt(0));
  const {tracks,tempo}=parseMidi(u8.buffer), trk=tracks[0];
  const p=normProg({id:uid(),name:trk.name||'Pattern 1',beats:4,notes:trk.notes.map(({ch,...n})=>n),names:{}});
  p.inst=instDefaults('piano');
  return normProject({id:uid(),name:tr(...EXAMPLE_NAME),bpm:Math.round(tempo||90),seed:20261027,patterns:[p],active:p.id});
}
// ---------- voice separation ----------
// Bass: the lowest sounding note at an onset, if low enough or well below the rest.
// Melody: "cont" finds the cheapest line through the onsets (prefers high notes and small leaps, may hold);
// "top" takes the highest sounding note; "dur" takes short notes moving over longer ones.
function separateVoices(p,opt){
  const notes=p.notes.slice(), byId=new Map(notes.map(n=>[n.id,n]));
  const onsets=[...new Set(notes.map(n=>n.s))].sort((a,b)=>a-b);
  const byOn=new Map(); notes.forEach(n=>{ if(!byOn.has(n.s)) byOn.set(n.s,[]); byOn.get(n.s).push(n); });
  const sounding=t=>notes.filter(n=>n.s<=t&&n.s+n.l>t);
  const bass=new Set();
  if(opt.bass) onsets.forEach(t=>{
    const low=byOn.get(t).slice().sort((a,b)=>a.m-b.m)[0], others=sounding(t).filter(n=>n!==low);
    if(others.some(n=>n.m<low.m)) return;
    const next=others.length?Math.min(...others.map(n=>n.m)):Infinity;
    if(low.m<=opt.bassMax||(others.length&&next-low.m>=7)) bass.add(low.id);
  });
  const cand=t=>byOn.get(t).filter(n=>!bass.has(n.id)).sort((a,b)=>b.m-a.m);
  let mel=new Set();
  if(opt.method==='top'){
    onsets.forEach(t=>{ const c=cand(t); if(c.length&&!sounding(t).some(n=>n.m>c[0].m&&!bass.has(n.id))) mel.add(c[0].id); });
  } else if(opt.method==='dur'){
    onsets.forEach(t=>{
      const c=cand(t); if(!c.length) return;
      const snd=sounding(t).filter(n=>!bass.has(n.id)), maxL=Math.max(...snd.map(n=>n.l));
      const longTop=Math.max(-1,...snd.filter(n=>n.l>maxL*.75).map(n=>n.m));
      const pick=c.find(n=>(n.l<=maxL*.75||byOn.get(t).length===1)&&n.m>=longTop);
      if(pick) mel.add(pick.id);
    });
  } else {
    // cheapest line through the onsets, keeping the 40 best partial lines at each step
    const w=opt.balance/100, leap=d=>d<=2?0:d<=4?.6:d<=7?1.5:d<=12?3:5;
    let states=new Map([[null,{c:0,path:[]}]]);
    onsets.forEach(t=>{
      const c=cand(t), snd=sounding(t), solo=byOn.get(t).length===1, next=new Map();
      const put=(key,cost,path)=>{ const o=next.get(key); if(!o||cost<o.c) next.set(key,{c:cost,path}); };
      states.forEach((s,key)=>{
        const prev=key?byId.get(key):null, held=prev&&prev.s+prev.l>t;
        // resting costs 1.2 (holding .3): at .9 the line went quiet instead of leaping a third and back (2 × .6)
        put(key,s.c+(held?.3:1.2)+(solo&&c.length?1.5:0),s.path);
        c.forEach((n,rank)=>{
          const above=snd.filter(k=>k.m>n.m&&!bass.has(k.id)).length;
          let cost=(rank+above*.8)*(1.5-w);
          if(prev) cost+=leap(Math.abs(n.m-prev.m))*(.5+w);
          // below G3 the tune is rare; long inner notes of a full chord are usually pads
          if(n.m<55) cost+=2;
          if(c.length>=3&&n.l>=2*T&&rank>0) cost+=.8;
          put(n.id,s.c+cost,s.path.concat(n.id));
        });
      });
      states=new Map([...next.entries()].sort((x,y)=>x[1].c-y[1].c).slice(0,40));
    });
    const best=[...states.values()].sort((x,y)=>x.c-y.c)[0];
    mel=new Set(best?best.path:[]);
  }
  return {mel:notes.filter(n=>mel.has(n.id)),bass:notes.filter(n=>bass.has(n.id)),chords:notes.filter(n=>!mel.has(n.id)&&!bass.has(n.id))};
}
// The patterns that «Separar voces» adds: melody, chords and bass, each with its instrument
function separatePatterns(p,r,opt){
  const copy=(ns,mono)=>{
    let out=ns.map(n=>({...n,id:uid()})).sort((a,b)=>a.s-b.s||b.m-a.m);
    if(mono){ out=out.filter((n,i,arr)=>!(i>0&&arr[i-1].s===n.s)); for(let i=0;i<out.length-1;i++) if(out[i].s+out[i].l>out[i+1].s){ out[i].l=Math.max(1,out[i+1].s-out[i].s); delete out[i].l0; } }
    return out;
  };
  const base=p.name||'Pattern', made=[];
  const mk=(suffix,ns,inst,names)=>{ if(!ns.length) return; const q=normProg({id:uid(),name:`${base} · ${suffix}`,beats:p.beats,notes:ns,names}); q.inst=inst; made.push(q); };
  mk(tr('Melodía','Melody'),copy(r.mel,opt.mono),instDefaults('lead'),{});
  mk(tr('Acordes','Chords'),copy(r.chords,false),JSON.parse(JSON.stringify(p.inst)),{...p.names});
  mk(tr('Bajo','Bass'),copy(r.bass,true),instDefaults('bajo'),{});
  return made;
}

export { defaultProject, parseMidi, separatePatterns, separateVoices };
