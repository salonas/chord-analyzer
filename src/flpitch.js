// FL automation clip of Channel pitch (.fst), for VST instruments such as sforzando, which do not take FL's
// own slides. The template is a clip FL saved; only its point list (event 234) changes, and the rest, with the
// clip's own min/max in event 219 (4800/8000), stays as FL wrote it. It assumes PITCH RANGE 12 on the channel
// and PB RANGE 12 in sforzando, so value = 0.5 + semitones / 24. The link to the PITCH knob does not travel in
// the file: the user sets it in Target links.
import { T } from './data.js';
import { bendAt, glidePlan } from './glide.js';
import { isDrum } from './model.js';

const RANGE=12;   // semitones at value 1.0
const JUMP=1;     // ticks a vertical jump takes (two points almost at the same time)
const TEMPLATE='RkxoZAYAAAAgADUAYABGTGR0XwQAAMcMMjYuMS42LjU2MzkAnwcWAACpDwAAABwBrAEBAMA2RgBMACAAUwB0AHUAZABpAG8AIAAyADYALgAxAC4ANgAuADUANgAzADkALgA1ADYAMwA5AAAAJQFANAAVBckCAADUNAAAAAAAAAAA/////wAAAABRAAAABQAAAAAAAAAAAAAAAAAAAHQAAACUAAAAAAAAAAAAAADLMEIAYQBqAG8AIAAtACAAQwBoAGEAbgBuAGUAbAAgAHAAaQB0AGMAaAAgACMAMgAAAJsAAAAAgI5giAApAQAB0RQAAAAAABkAAAAAAAAEAAAAkAAAAIqAAIAAiwAAAQBZAABhgAAwAEWAAFYAAUcABFMAAEoAAEsAAEwAAFUACIMAAIAARgAAaAAA2xjAEgAAQB8AAAAAAAAAAQAAAAAAAAAAAADlFAAAAAAAMgAAAAAAAAAAAAAAAAAA3QkBAAAA9AEAAADXqAH/////AAAAAAEAAAD/////PAAAAAAAgD8AAIA/AACAPwAAgD8AAIA/AAAAAAEAAAD/////AAQAADAAAAAAAAEApwUAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAP7/////////AAAAAAAAAAAAAAAAAAAAAAAA8D8AAAAAAAAAAP////8BAQAAAAAAAAAA4D+EAAAAAJAAAAAAkQAAAADqtQEBAAAAQAAAAAEEAAAAAwAAAAIAAAAAAAAAAAAAAAAAAAAAAOA/AAAAAAAAAAAAAADg//8PQAAAAAAAAPA/AAAAAAAAAAIBAAAA/////////////////////4AAAACAAAAAAAAAAIAAAAAFAAAAAwAAAAEAAAAAAAAAAAAAAAAAAAAAAPA/AAAAAAAAAAABAAAAAAAAAP////////////////uyAAAAAAAAAAAAAAAAAAAAAAAA5BBkAAAAAAAAAAAAAAAAAAAA5BA8AAAAAAAAAAAAAAAAAAAA2kQAAAAAAAAAAGQAAAAgTgAAIE4AADB1AAAyAAAAIE4AAAAAAABkAAAAIE4AAAAAAAC2gAAAAAAAAAAAAAAAAAAAAAAAANpEBAAAAAAAAABkAAAAIE4AACBOAAAwdQAAMgAAACBOAAAAAAAAZAAAACBOAAAAAAAAtoAAAAAAAAAAAAAAAAAAAJv////aRAAAAAAAAAAAZAAAACBOAAAgTgAAMHUAADIAAAAgTgAAAAAAAGQAAAAgTgAAAAAAALaAAAAAAAAAAAAAAAAAAAAAAAAA2kQAAAAAAAAAAGQAAAAgTgAAIE4AADB1AAAyAAAAIE4AAAAAAABkAAAAIE4AAAAAAAC2gAAAAAAAAAAAAAAAAAAAAAAAANpEAAAAAAAAAABkAAAAIE4AACBOAAAwdQAAMgAAACBOAAAAAAAAZAAAACBOAAAAAAAAtoAAAAAAAAAAAAAAAAAAAAAAAACPAwAAABQAqv////8zAA==';
const template=()=>Uint8Array.from(atob(TEMPLATE),c=>c.charCodeAt(0));

// whether voice V is off its own pitch anywhere in [a,b)
const displaced=(V,a,b)=>bendAt(V.bend,a)!==0||bendAt(V.bend,b)!==0||V.bend.some(x=>x.t>a&&x.t<b&&x.d!==0);
// The pitch curve of the whole channel, in ticks and semitones, from glidePlan(p, 12): the curve of each voice
// with a bend, held after its last point (as bendAt does) until a voice with its own attack starts, where it
// jumps to that voice's pitch. A voice that starts while a bent voice is still off its pitch gets that bend
// too, since Channel pitch moves the whole channel: it is counted in clashes and does not move the curve.
// Returns {points:[{t,d}], clashes, skipped}; points is empty when nothing bends.
function pitchCurve(p){
  const {voices,skipped}=glidePlan(p,RANGE), pts=[{t:0,d:0}];
  let clashes=0, bent=null;
  if(isDrum(p)||!voices.some(V=>V.bend.length)) return {points:[],clashes,skipped};
  const last=()=>pts[pts.length-1];
  const put=(t,d)=>{ const L=last(); if(t<L.t) t=L.t; if(t!==L.t||d!==L.d) pts.push({t,d}); };
  const jump=(t,d)=>{
    const L=last(); if(d===L.d) return;
    // the jump ends at t, so the new attack already sounds at its own pitch
    if(L.t>t-JUMP&&pts.length>1&&pts[pts.length-2].t<=t-JUMP) L.t=t-JUMP;
    put(Math.max(L.t,t-JUMP),L.d); put(t,d);
  };
  voices.forEach(V=>{
    if(bent&&V.s<bent.e){
      if(displaced(bent,V.s,Math.min(V.e,bent.e))){ clashes++; return; }
    }
    jump(V.s,bendAt(V.bend,V.s));
    V.bend.forEach(b=>put(b.t,b.d));
    if(V.bend.length) bent=V;
  });
  return {points:pts,clashes,skipped};
}

function varint(n){ const out=[]; do{ const b=n&0x7f; n=Math.floor(n/128); out.push(b|(n?0x80:0)); }while(n); return out; }
// the event 234 that holds the automation points: its payload starts with 01 00 00 00 40 00 00 00
function pointsEvent(d){
  for(let k=d.indexOf(0xea);k>=0;k=d.indexOf(0xea,k+1)){
    let j=k+1, n=0, sh=0, b;
    do{ b=d[j++]; n+=(b&0x7f)*2**sh; sh+=7; }while(b&0x80);
    if([1,0,0,0,0x40,0,0,0].every((x,i)=>d[j+i]===x)) return {k,start:j,end:j+n};
  }
  throw new Error('no automation points event');
}
// points: [{t,d}] in ticks and semitones, absolute. FL stores each position in beats, relative to the previous
// point; the first point's flags are 0 and the others' 0x02000000, as FL writes them; tension 0 (linear)
function fstClip(points){
  const d=template(), {k,start,end}=pointsEvent(d), old=d.subarray(start,end);
  const count=new DataView(old.buffer,old.byteOffset+17,4).getUint32(0,true), tail=old.subarray(21+24*count);
  const body=new Uint8Array(21+24*points.length+tail.length), dv=new DataView(body.buffer);
  body.set(old.subarray(0,17)); dv.setUint32(17,points.length,true);
  let prev=0;
  points.forEach(({t,d:st},n)=>{
    const o=21+24*n;
    dv.setFloat64(o,(t-prev)/T,true);
    dv.setFloat64(o+8,Math.min(1,Math.max(0,0.5+st/(2*RANGE))),true);
    dv.setFloat32(o+16,0,true);
    dv.setUint32(o+20,n?0x02000000:0,true);
    prev=t;
  });
  body.set(tail,21+24*points.length);
  const events=[...d.subarray(22,k),0xea,...varint(body.length),...body,...d.subarray(end)];
  const out=new Uint8Array(22+events.length);
  out.set(d.subarray(0,18)); new DataView(out.buffer).setUint32(18,events.length,true); out.set(events,22);
  return out;
}
// p: the pattern. Returns {bytes, clashes, skipped}, or null when no voice bends
function pitchClip(p){
  const c=pitchCurve(p);
  return c.points.length?{bytes:fstClip(c.points),clashes:c.clashes,skipped:c.skipped}:null;
}

export { RANGE as PITCH_RANGE, fstClip, pitchClip, pitchCurve };
