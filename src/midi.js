// MIDI export (format 0, 96 PPQ), stored zip and the full pack.
import { T, uid } from './data.js';
import { isDrum, segStep, segs } from './model.js';
import { bendAt, glidePlan, hasGlide, rangeOf } from './glide.js';
import { analyzeProgression, resolveStep } from './analysis.js';
import { projectText } from './text.js';
import { tr } from './i18n.js';
import { flScript } from './flscript.js';
import { pitchClip } from './flpitch.js';

// ---------- MIDI export (format 0, 96 PPQ) wrapped in a stored zip ----------
const SUPSUB={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','𝄫':'bb'};
const ascii=s=>String(s).replace(/[\u2070\u00B9\u00B2\u00B3\u2074-\u2079\u2080-\u2089]|\u{1D12B}/gu,c=>SUPSUB[c]||'').replace(/♯/g,'#').replace(/♭/g,'b').replace(/Δ/g,'maj').replace(/ø/g,'m7b5').replace(/°/g,'dim').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^\x20-\x7e]/g,'?');
function vlq(n){ const b=[n&0x7f]; while((n>>>=7)) b.unshift((n&0x7f)|0x80); return b; }
function midiFile(p,bpm,prefs){
  const enc=s=>[...new TextEncoder().encode(ascii(s))];
  const meta=(type,data)=>[0xFF,type,...vlq(data.length),...data];
  const ev=[]; let skipped=0;
  const sh=prefs.midiShift||0;
  const note=(m,s,e,v)=>{ m+=sh; if(m>127||m<0){skipped++;return false;} ev.push({t:s,o:2,d:[0x90,m,v]}); ev.push({t:e,o:1,d:[0x80,m,64]}); return true; };
  if(isDrum(p)||!hasGlide(p)) p.notes.forEach(n=>note(n.m,n.s,n.s+n.l,n.v||100));
  else if(p.glideNative){
    // the instrument glides by itself: portamento control (CC84, the note to glide from) and portamento on (CC65).
    // A portamento is its own note; a voice with slides becomes a legato chain, one note per pitch, each one
    // entering a tick before the previous ends; slides with nothing to bend are left out, as they are silent
    const plan=glidePlan(p,Infinity), cc=(t,o,c,v)=>ev.push({t,o,d:[0xB0,c,v]}), slid=new Map();
    const porta=(t,from)=>{ const f=from+sh; if(f<0||f>127) return false; cc(t,1.5,84,f); cc(t,1.5,65,127); return true; };
    plan.glides.forEach(x=>{ if(x.n.g==='s') slid.set(x.V,[...(slid.get(x.V)||[]),x]); });
    plan.voices.forEach(V=>{
      let m=V.m, s=V.s, split=false;
      (slid.get(V)||[]).forEach(({n})=>{ if(n.m===m) return; note(m,s,n.s+1,V.v); porta(n.s,m); m=n.m; s=n.s; split=true; });
      note(m,s,V.e,V.v); if(split) cc(V.e,1,65,0);
    });
    plan.glides.forEach(({n,from})=>{ if(n.g==='p'&&porta(n.s,from)) cc(n.s+n.l,1,65,0); });
  } else {
    // pitch automation: a pitch bend every 64th along each voice's curve, scaled to the bend range, then back to the centre
    const range=rangeOf(p), pb=d=>{ const v=Math.max(0,Math.min(16383,8192+Math.round(d/range*8192))); return [0xE0,v&127,v>>7]; };
    glidePlan(p).voices.forEach(V=>{
      if(!note(V.m,V.s,V.e,V.v)||!V.bend.length) return;
      let last=null; const put=t=>{ const d=pb(bendAt(V.bend,t)); if(last&&d[1]===last[1]&&d[2]===last[2]) return; ev.push({t,o:1.5,d}); last=d; };
      for(let i=0;i<V.bend.length;i++){ const a=V.bend[i], b=V.bend[i+1]; put(a.t); if(b) for(let t=a.t+T/16;t<b.t;t+=T/16) put(t); }
      ev.push({t:V.e,o:1.5,d:pb(0)});
    });
  }
  const S=segs(p), A=analyzeProgression(S.map(s=>segStep(p,s)),prefs);
  if(!isDrum(p)) S.forEach((s,i)=>ev.push({t:s.a,o:0,d:meta(0x06,enc(A.rs[i].label))}));
  // same tick: chord marker, then note-offs, then pitch bends and controllers, then note-ons, so a repeated note is not cut short
  ev.sort((a,b)=>a.t-b.t||a.o-b.o);
  const us=Math.round(60000000/(bpm||90));
  const tr=[0,...meta(0x03,enc(p.name||'Pattern')),0,...meta(0x51,[(us>>16)&255,(us>>8)&255,us&255]),0,...meta(0x58,[4,2,24,8])];
  let last=0; ev.forEach(e=>{ tr.push(...vlq(e.t-last),...e.d); last=e.t; });
  tr.push(0,0xFF,0x2F,0);
  const L=tr.length;
  const bytes=[0x4D,0x54,0x68,0x64,0,0,0,6,0,0,0,1,(T>>8)&255,T&255,0x4D,0x54,0x72,0x6B,(L>>>24)&255,(L>>>16)&255,(L>>>8)&255,L&255].concat(tr);
  return {bytes:new Uint8Array(bytes),skipped};
}
// CRC-32 table for the zip entries
const CRC=(()=>{const t=new Uint32Array(256); for(let n=0;n<256;n++){let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0;} return t;})();
function crc32(u8){ let c=0xFFFFFFFF; for(const b of u8) c=CRC[(c^b)&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function zipFiles(files){
  const le=(n,b)=>{const a=[];for(let i=0;i<b;i++)a.push((n>>>(8*i))&255);return a;};
  // stored zip (no compression); entries carry the local time in DOS format, so the tests fix the clock
  const d=new Date(), dt=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1), dd=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  const parts=[], cen=[]; let off=0;
  files.forEach(({name,data})=>{
    const nm=new TextEncoder().encode(name), crc=crc32(data), sz=data.length;
    const local=[...le(0x04034b50,4),...le(20,2),...le(0,2),...le(0,2),...le(dt,2),...le(dd,2),...le(crc,4),...le(sz,4),...le(sz,4),...le(nm.length,2),...le(0,2),...nm];
    cen.push(...le(0x02014b50,4),...le(20,2),...le(20,2),...le(0,2),...le(0,2),...le(dt,2),...le(dd,2),...le(crc,4),...le(sz,4),...le(sz,4),...le(nm.length,2),...le(0,2),...le(0,2),...le(0,2),...le(0,2),...le(0,4),...le(off,4),...nm);
    parts.push(new Uint8Array(local),data); off+=local.length+sz;
  });
  const end=[...le(0x06054b50,4),...le(0,2),...le(0,2),...le(files.length,2),...le(files.length,2),...le(cen.length,4),...le(off,4),...le(0,2)];
  return new Blob([...parts,new Uint8Array(cen),new Uint8Array(end)],{type:'application/zip'});
}
const fileBase=s=>ascii(s||tr('proyecto','project')).replace(/[^\w-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()||tr('proyecto','project');
// Chord file names: ASCII, slash chords as "C sobre E" / "C over E" (a slash would start a folder)
const fileSafe=s=>ascii(s).replace(/\//g,tr(' sobre ',' over ')).replace(/[\\:*?"<>|]/g,'').replace(/\s+/g,' ').trim()||tr('acorde','chord');
function buildPack(pr,chords,prefs){
  const base=fileBase(pr.name), files=[], pad=n=>String(n).padStart(2,'0');
  const [dProg,dChords,dLib,dFl,dClip]=tr(['1 Progresiones','2 Acordes sueltos','3 Biblioteca de acordes','4 Scripts de FL','5 Clips de pitch (VST)'],['1 Progressions','2 Single chords','3 Chord library','4 FL scripts','5 Pitch clips (VST)']);
  let nprog=0, nchord=0, skipped=0;
  pr.patterns.forEach((p,i)=>{
    if(!p.notes.length) return;
    const pn=`${pad(i+1)} ${fileSafe(p.name||'Pattern')}`;
    const r=midiFile(p,pr.bpm,prefs); skipped+=r.skipped;
    files.push({name:`${base}/${dProg}/${pn}.mid`,data:r.bytes}); nprog++;
    // FL's own slides and portamentos only travel in a piano roll script
    if(!isDrum(p)&&hasGlide(p)) files.push({name:`${base}/${dFl}/${pn}.pyscript`,data:new TextEncoder().encode(flScript(p,prefs).text)});
    // and for VST instruments, an automation clip of Channel pitch (flpitch.js)
    const clip=hasGlide(p)?pitchClip(p):null;
    if(clip) files.push({name:`${base}/${dClip}/${pn}.fst`,data:clip.bytes});
    const S=isDrum(p)?[]:segs(p), A=analyzeProgression(S.map(s=>segStep(p,s)),prefs);
    S.forEach((s,j)=>{
      // each chord on its own: the notes that sound inside it, clipped to it and moved to the start
      const notes=p.notes.filter(n=>n.s<s.b&&n.s+n.l>s.a).map(n=>({id:n.id,m:n.m,s:Math.max(n.s,s.a)-s.a,l:Math.min(n.s+n.l,s.b)-Math.max(n.s,s.a),v:n.v}));
      const label=A.rs[j].label, deg=A.romans[j]?A.romans[j].text:'';
      const one=midiFile({name:label,notes,names:{[s.sig]:p.names[s.sig]}},pr.bpm,prefs);
      files.push({name:`${base}/${dChords}/${pn}/${pad(j+1)} - ${fileSafe(label)}${deg?` (${fileSafe(deg)})`:''}.mid`,data:one.bytes}); nchord++;
    });
  });
  chords.forEach((c,i)=>{
    const r=resolveStep(c,prefs), sub={name:r.label,notes:r.notes.map(m=>({id:uid(),m,s:0,l:4*T,v:100})),names:{}};
    files.push({name:`${base}/${dLib}/${pad(i+1)} - ${fileSafe(r.label)}.mid`,data:midiFile(sub,pr.bpm,prefs).bytes}); nchord++;
  });
  files.push({name:`${base}/${base}.txt`,data:new TextEncoder().encode(projectText(pr,prefs).replace(/\n/g,'\r\n'))});
  return {files,nprog,nchord,skipped,base};
}

export { buildPack, fileBase, midiFile, zipFiles };
