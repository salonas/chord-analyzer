// Piano roll, transport, history and chord (segment) operations.
import { BLACK, HIGH, LOW, T, sigOf, uid } from './data.js';
import { $, fillRange, toast } from './dom.js';
import { isBlock, isDrum, progEnd } from './model.js';
import { fut, hist, savePrefs, st } from './state.js';
import { noteText, octOff, plainSpell } from './analysis.js';
import { DRUMS } from './drums.js';
import { bendAt, glidePlan } from './glide.js';
import { tr } from './i18n.js';
import { audio, ensureSounds, master, mixOf, patVoice, preview, releasePreview, soundsReady } from './audio.js';
// main.js imports this module too: these four are only called from inside functions, never at load
import { drawMini, lastCur, render, renderActive } from './main.js';

// ---------- history (active chord + roll) ----------
function snapshot(){return {notes:[...st.notes],lockedRoot:st.lockedRoot,pat:st.prog.id,roll:JSON.stringify({n:st.prog.notes,m:st.prog.names,x:st.prog.expr||null})}}
// every edit pushes a snapshot first; up to 300 steps of undo
function commit(){hist.push(snapshot()); if(hist.length>300) hist.shift(); fut.length=0;}
function restore(s){st.notes=new Set(s.notes); st.lockedRoot=s.lockedRoot; const r=JSON.parse(s.roll);
  const p=st.proj.patterns.find(x=>x.id===s.pat);
  if(p){ if(p!==st.prog){ st.prog=p; st.proj.active=p.id; st.segA=null; } p.notes=r.n; p.names=r.m; if(r.x) p.expr=r.x; else delete p.expr; }
  st.pick=0; R.sel=new Set([...R.sel].filter(id=>st.prog.notes.some(n=>n.id===id)));}
function undo(){ if(!hist.length) return; fut.push(snapshot()); restore(hist.pop()); render(); }
function redo(){ if(!fut.length) return; hist.push(snapshot()); restore(fut.pop()); render(); }

// ---------- transport ----------
const P={bus:null,raf:0,t0:0,from:0,end:0,spt:0,next:null,playing:false};
// notes are scheduled ahead on the audio clock; tick() follows with the playhead and queues the next loop pass one beat early
function scheduleFrom(from,t0){
  const drum=isDrum(st.prog);
  // drums go in time order, so a closing hi-hat can cut the open one scheduled before it
  // melodic notes go as voices, so slides and portamento (glide.js) bend them
  const notes=drum?[...st.prog.notes].sort((a,b)=>a.s-b.s).map(n=>({m:n.m,s:n.s,e:n.s+n.l,v:n.v||100,bend:[]})):glidePlan(st.prog,Infinity).voices;
  const sec=x=>t0+(x-from)*P.spt;
  notes.forEach(n=>{
    if(n.e<=from||n.s>=P.end) return;
    const s0=Math.max(n.s,from), e0=Math.min(n.e,P.end), t=sec(s0), vel=.2*Math.pow(n.v/127,1.6), hold=(e0-s0)*P.spt;
    const bend=n.bend.length?[{t,d:bendAt(n.bend,s0)},...n.bend.filter(b=>b.t>s0&&b.t<e0).map(b=>({t:sec(b.t),d:b.d})),{t:sec(e0),d:bendAt(n.bend,e0)}]:null;
    patVoice(st.prog,n.m,t,n.v,P.bus,vel,hold,bend);
  });
}
function playProg(){
  stopProg();
  if(!st.prog.notes.length) return;
  // the first playback of an instrument waits for its samples; stopping meanwhile cancels it
  if(!soundsReady(st.prog)){ const ask=P.ask=Symbol(); ensureSounds(st.prog).then(()=>{ if(P.ask===ask) playProg(); }); return; }
  const c=audio(); P.bus=c.createGain(); P.bus.gain.value=mixOf(st.prog); P.bus.connect(master);
  P.spt=60/(st.proj.bpm||90)/T;
  P.end=Math.max(4*T,Math.ceil(progEnd(st.prog)/(4*T))*4*T);
  P.from=R.start<P.end?R.start:0; P.t0=c.currentTime+.06; P.next=null; P.playing=true;
  scheduleFrom(P.from,P.t0);
  P.raf=requestAnimationFrame(tick);
  setPlayBtn(true);
}
function setPlayBtn(on){ const b=$('bProgPlay'); b.querySelector('.ico').className='ico i-'+(on?'stop':'play'); b.querySelector('span').textContent=on?tr('Detener','Stop'):tr('Tocar','Play'); }
function stopProg(){
  cancelAnimationFrame(P.raf); P.ask=null;
  if(P.bus){ const c=audio(); P.bus.gain.setTargetAtTime(0,c.currentTime,.03); P.bus=null; }
  P.playing=false; R.pos=null; setPlayBtn(false);
  showPos(R.start); drawRoll();
}
function tick(){
  if(!P.playing) return;
  const c=audio();
  let pos=P.from+(c.currentTime-P.t0)/P.spt;
  if(st.loop&&!P.next&&pos>=P.end-T){ const t0n=P.t0+(P.end-P.from)*P.spt; scheduleFrom(0,t0n); P.next={t0:t0n}; }
  if(pos>=P.end){
    if(P.next){ P.from=0; P.t0=P.next.t0; P.next=null; pos=P.from+(c.currentTime-P.t0)/P.spt; R.el.scrollLeft=0; }
    else { stopProg(); return; }
  }
  R.pos=pos; showPos(pos);
  const x=pos/T*st.beatW, vw=R.el.clientWidth-R.K;
  if(x<R.el.scrollLeft||x>R.el.scrollLeft+vw*.9) R.el.scrollLeft=Math.max(0,x-vw*.1);
  drawRoll();
  P.raf=requestAnimationFrame(tick);
}
function showPos(t){ const bar=Math.floor(t/(4*T))+1, beat=Math.floor(t/T)%4+1, tk=Math.floor(t%T); $('pos').textContent=`${bar}.${beat}.${String(tk).padStart(2,'0')}`; }

// ---------- piano roll ----------
const R={el:$('roll'),inner:$('rollInner'),cv:$('rollCv'),K:64,TOP:84,RUL:18,LN:42,rh:14,VEL:68,lastVel:100,glide:'',sel:new Set(),lastLen:T,drag:null,start:0,pos:null,C:{},segs:[],lane:[],queued:false};
function readColors(){
  const cs=getComputedStyle(document.documentElement), v=n=>cs.getPropertyValue(n).trim();
  R.C={w:v('--roll-w'),b:v('--roll-b'),line:v('--roll-line'),beat:v('--roll-beat'),bar:v('--roll-bar'),note:v('--note'),edge:v('--note-edge'),ink:v('--note-ink'),
    sel:v('--note-sel'),selInk:v('--note-sel-ink'),play:v('--play'),band:v('--band'),surface:v('--surface'),text:v('--ink'),muted:v('--muted'),accent:v('--accent'),
    ivory:v('--ivory'),ivoryEdge:v('--ivory-edge'),ebony:v('--ebony'),hatch:v('--hatch'),marker:v('--marker'),markerInk:v('--marker-ink'),root:v('--root'),rootInk:v('--root-ink'),
    selW:v('--sel-white'),selB:v('--sel-black'),line2:v('--line')};
  // Unifont is crisp only at 16 px, so the chord lane uses it at 16; MGPixel has no pixel grid and fits the 14 px rows
  R.F={small:'12px '+v('--display'),lane:'16px '+v('--mono')};
}
const snapT=()=>Math.round(st.snap*T);
const snapRound=(t,free)=>{const s=snapT(); return free||!s?Math.round(t):Math.round(t/s)*s;};
const snapFloor=(t,free)=>{const s=snapT(); return free||!s?Math.floor(t):Math.floor(t/s)*s;};
const minLen=()=>snapT()||Math.round(T/16);
function rollSize(){
  const endB=progEnd(st.prog)/T, bars=Math.max(8,Math.ceil(endB/4)+4);
  R.inner.style.width=Math.max(R.el.clientWidth,R.K+bars*4*st.beatW)+'px';
  R.inner.style.height=(R.TOP+(HIGH-LOW+1)*R.rh+R.VEL)+'px';
}
// pixel disc of even diameter d centred on (cx,cy): chord notes get one, the root gets a square
function pxDisc(g,cx,cy,d){
  const x0=Math.round(cx-d/2), y0=Math.round(cy-d/2), r=d/2;
  for(let i=0;i<d;i++){ const h=Math.round(Math.sqrt(r*r-(i+.5-r)**2)); g.fillRect(x0+r-h,y0+i,2*h,1); }
}
function requestDraw(){ if(R.queued) return; R.queued=true; requestAnimationFrame(()=>{R.queued=false; drawRoll();}); }
function drawRoll(){
  const cv=R.cv, W=R.el.clientWidth, H=R.el.clientHeight; if(!W||!H) return;
  const dpr=window.devicePixelRatio||1;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.width=W+'px';cv.style.height=H+'px';}
  const g=cv.getContext('2d'); g.setTransform(dpr,0,0,dpr,0,0);
  const C=R.C, K=R.K, TOP=R.TOP, rh=R.rh, bw=st.beatW, sx=R.el.scrollLeft, sy=R.el.scrollTop;
  const rowY=m=>TOP+(HIGH-m)*rh-sy, tX=t=>K+t/T*bw-sx;
  g.fillStyle=C.w; g.fillRect(0,0,W,H);
  const mTop=Math.min(HIGH,HIGH-Math.floor(sy/rh)), mBot=Math.max(LOW,HIGH-Math.ceil((sy+H-TOP)/rh));
  for(let m=mTop;m>=mBot;m--){
    const y=rowY(m);
    if(BLACK.has(m%12)){ g.fillStyle=C.b; g.fillRect(K,y,W-K,rh); }
    if(m<21||m>108){ g.fillStyle=C.hatch; g.fillRect(K,y,W-K,rh); }
    g.fillStyle=m%12===0?C.bar:C.line; g.fillRect(K,y+rh-1,W-K,1);
  }
  // selected chord band
  const cur=curSeg();
  if(cur){ g.fillStyle=C.band; g.fillRect(tX(cur.a),TOP,(cur.b-cur.a)/T*bw,H-TOP); }
  // grid
  const b0=Math.max(0,Math.floor(sx/bw)), b1=Math.ceil((sx+W-K)/bw), sub=snapT();
  for(let b=b0;b<=b1;b++){
    const x=K+b*bw-sx;
    if(sub&&sub<T&&bw*sub/T>=7){ g.fillStyle=C.line; for(let k=sub;k<T;k+=sub) g.fillRect(x+k/T*bw,TOP,1,H-TOP); }
    g.fillStyle=b%4===0?C.bar:C.beat; g.fillRect(x,TOP,b%4===0?1.5:1,H-TOP);
  }
  // notes: pixel boxes with clipped corners; the selected one is dark, with a 2 px edge and a light triangle top left
  g.font=R.F.small; g.textBaseline='middle';
  for(const n of st.prog.notes){
    const x=Math.round(tX(n.s)), y=Math.round(rowY(n.m)), w=Math.max(4,Math.round(n.l/T*bw));
    if(x>W||x+w<K||y>H||y+rh<TOP) continue;
    const sel=R.sel.has(n.id), t=sel?2:1, x0=x+1, y0=y+1, w0=w-2, h0=rh-2;
    // softer notes fade, down to 40% at velocity 0, so quiet ones stay visible
    g.globalAlpha=sel?1:.4+.6*(n.v||100)/127;
    g.fillStyle=sel?C.sel:C.note; g.fillRect(x0+t,y0+t,Math.max(0,w0-2*t),h0-2*t);
    g.globalAlpha=1;
    g.fillStyle=sel?C.note:C.edge;
    g.fillRect(x0+1,y0,Math.max(0,w0-2),t); g.fillRect(x0+1,y0+h0-t,Math.max(0,w0-2),t); g.fillRect(x0,y0+1,t,h0-2); g.fillRect(x0+w0-t,y0+1,t,h0-2);
    g.fillStyle=sel?C.selInk:C.ink;
    if(sel&&w0>=10) for(let i=0;i<4;i++) g.fillRect(x0+t,y0+t+i,4-i,1);
    g.fillRect(x+w-5,y+4,1,rh-8);
    if(w>34){ g.save(); g.beginPath(); g.rect(x,y,w-6,rh); g.clip(); g.fillText(noteText(plainSpell(n.m,st),st),x+(sel?8:5),y+rh/2); g.restore(); }
  }
  // glides that count: a 2 px trace of the pitch that sounds, along the whole voice when slides bend it
  // and over the glide alone for a portamento; columns join so steep glides stay continuous
  if(!isDrum(st.prog)){
    const plan=glidePlan(st.prog,Infinity), slid=new Set(plan.glides.filter(x=>x.n.g==='s').map(x=>x.V));
    g.fillStyle=C.text;
    for(const V of plan.voices){
      if(!V.bend.length) continue;
      const t0=slid.has(V)?V.s:V.bend[0].t, t1=slid.has(V)?V.e:V.bend[V.bend.length-1].t;
      const x0=Math.max(K,Math.round(tX(t0))), x1=Math.min(W,Math.round(tX(t1)));
      const yAt=x=>Math.round(rowY(V.m+bendAt(V.bend,t0+(x-tX(t0))/bw*T))+rh/2-1);
      let py=yAt(x0);
      for(let x=x0;x<=x1;x++){ const y=yAt(x); g.fillRect(x,Math.min(py,y),2,Math.abs(y-py)+2); py=y; }
    }
  }
  // band selection
  if(R.drag&&R.drag.type==='band'){ const d=R.drag; g.strokeStyle=C.text; g.setLineDash([4,3]); g.lineWidth=1; g.strokeRect(Math.min(d.x0,d.x1)-sx+.5,Math.min(d.y0,d.y1)-sy+.5,Math.abs(d.x1-d.x0),Math.abs(d.y1-d.y0)); g.setLineDash([]); }
  // velocity lane (fixed at the bottom of the viewport)
  const VY=H-R.VEL, VH=R.VEL-12;
  g.fillStyle=C.surface; g.fillRect(K,VY,W-K,R.VEL); g.fillStyle=C.bar; g.fillRect(K,VY,W-K,1);
  // dashed guide at the default velocity (100), so solid note lines at 100 still show
  g.fillStyle=C.line; for(let gx=K,gy=Math.round(VY+6+VH*(1-100/127));gx<W;gx+=4) g.fillRect(gx,gy,2,1);
  for(let b=b0;b<=b1;b++){ g.fillStyle=b%4===0?C.beat:C.line; g.fillRect(K+b*bw-sx,VY+1,1,R.VEL-1); }
  // like FL's event editor: a stem at the start, then a line at the velocity height for the note's length
  for(const n of st.prog.notes){
    const x=Math.round(tX(n.s)), w=Math.max(4,Math.round(n.l/T*bw)); if(x+w<K||x>W) continue;
    const sel=R.sel.has(n.id), hgt=Math.max(2,Math.round((n.v||100)/127*VH)), top=VY+6+VH-hgt;
    g.fillStyle=sel?C.text:C.bar; g.fillRect(x+1,top,sel?3:2,hgt); g.fillRect(x+2,top,w-3,sel?2:1);
    pxDisc(g,x+2,top,sel?8:6);
  }
  // ruler + chord lane
  g.fillStyle=C.surface; g.fillRect(K,0,W-K,TOP);
  g.fillStyle=C.line2; g.fillRect(K,R.RUL,W-K,1); g.fillRect(K,R.LN,W-K,1); g.fillStyle=C.bar; g.fillRect(K,TOP-1,W-K,1);
  g.font=R.F.small; g.fillStyle=C.muted;
  for(let b=b0-(b0%4);b<=b1;b+=4){ const x=Math.round(K+b*bw-sx); if(x<K-40) continue; g.fillStyle=C.bar; g.fillRect(x,0,1,R.RUL); g.fillStyle=C.muted; g.fillText(String(b/4+1),x+4,R.RUL/2+1); }
  R.lane.forEach((L,i)=>{
    const x=Math.round(tX(L.a)), w=Math.round((L.b-L.a)/T*bw); if(x>W||x+w<K) return;
    const on=cur&&cur.a===L.a, playing=R.pos!=null&&R.pos>=L.a&&R.pos<L.b, t=on?2:1;
    g.fillStyle=playing?C.band:C.surface; g.fillRect(x+1,R.LN+3,w-2,TOP-R.LN-7);
    g.lineWidth=t; g.strokeStyle=on?C.text:C.line2; g.strokeRect(x+1+t/2,R.LN+3+t/2,w-2-t,TOP-R.LN-7-t);
    g.save(); g.beginPath(); g.rect(x+2,R.LN,w-4,TOP-R.LN); g.clip();
    g.font=R.F.lane; g.textBaseline='alphabetic';
    g.fillStyle=C.text; g.fillText(L.label,x+6,R.LN+18);
    g.fillStyle=C.accent; g.fillText(L.roman,x+6,R.LN+34);
    g.restore();
  });
  // playhead / start marker
  const ph=R.pos!=null?R.pos:R.start, px=Math.round(tX(ph));
  if(px>=K&&px<=W){
    g.fillStyle=C.play; g.fillRect(px-(R.pos!=null?1:0),TOP,R.pos!=null?2:1,H-TOP);
    for(let i=0;i<9;i++){ const h=Math.round(6*(1-i/9)); g.fillRect(px-h,i,2*h||1,1); }
  }
  // keys column
  for(let m=mTop;m>=mBot;m--){
    const y=rowY(m), black=BLACK.has(m%12), on=st.notes.has(m);
    if(!black){ g.fillStyle=on?C.selW:C.ivory; g.fillRect(0,y,K,rh); g.fillStyle=C.ivoryEdge; g.fillRect(0,y+rh-1,K,1); }
  }
  for(let m=mTop;m>=mBot;m--){
    if(!BLACK.has(m%12)) continue;
    const y=rowY(m), on=st.notes.has(m);
    g.fillStyle=on?C.selB:C.ebony; g.fillRect(0,y,K*.6,rh);
  }
  for(let m=mTop;m>=mBot;m--){
    const y=rowY(m);
    if(m<21||m>108){ g.fillStyle=C.hatch; g.fillRect(K-6,y,6,rh); }
    if(m%12===0){
      // middle C is underlined, not only darker
      const s='C'+(m/12-1+octOff(st)), c4=m===60, yy=Math.round(y+rh/2);
      g.font=R.F.small; g.fillStyle=c4?C.text:C.muted; g.fillText(s,6,yy);
      if(c4) g.fillRect(6,yy+5,Math.round(g.measureText(s).width),1);
    }
    if(st.notes.has(m)){
      const isR=R.rootPc===m%12, black=BLACK.has(m%12), cx=Math.round(black?K*.3:K*.78), cy=Math.round(y+rh/2);
      g.fillStyle=isR?C.root:(black?C.ivory:C.marker);
      if(isR) g.fillRect(cx-5,cy-5,10,10); else pxDisc(g,cx,cy,10);
    }
  }
  // drum patterns: the key column lists the template's pieces instead of a keyboard
  if(isDrum(st.prog)){
    g.fillStyle=C.surface; g.fillRect(0,TOP,K-1,H-TOP);
    g.font=R.F.small;
    for(let m=mTop;m>=mBot;m--){
      const d=DRUMS[m]; if(!d) continue;
      const y=rowY(m); g.fillStyle=st.notes.has(m)?C.selW:C.w; g.fillRect(0,y,K-1,rh-1);
      g.fillStyle=C.text; g.fillText(d.s,4,y+rh/2+.5);
    }
  }
  g.fillStyle=C.ivoryEdge; g.fillRect(K-1,TOP,1,H-TOP);
  g.fillStyle=C.surface; g.fillRect(0,0,K,TOP); g.fillRect(0,H-R.VEL,K,R.VEL);
  g.fillStyle=C.bar; g.fillRect(0,H-R.VEL,K,1);
  g.fillStyle=C.muted; g.font=R.F.small; g.fillText(tr('compás','bar'),6,R.RUL/2+1); g.fillText(tr('modo','mode'),6,Math.round((R.RUL+R.LN)/2)+1); g.fillText(tr('acordes','chords'),6,Math.round((R.LN+TOP)/2));
  g.fillText('velocity',6,H-R.VEL+14); g.fillText('127',6,H-R.VEL+28); g.fillText('1',6,H-10);
}
function velFromY(y){ const VH=R.VEL-12, top=R.el.clientHeight-R.VEL+6; return Math.min(127,Math.max(1,Math.round((1-(y-top)/VH)*127))); }
function velAt(x,y,d){
  // notes whose start is under the pointer column; restricted to the selection when there is one
  const v=velFromY(y), sx=R.el.scrollLeft;
  let hit=st.prog.notes.filter(n=>Math.abs(R.K+n.s/T*st.beatW-sx+2-x)<=Math.max(4,st.beatW*snapT()/T/2));
  if(R.sel.size) hit=hit.filter(n=>R.sel.has(n.id));
  hit.forEach(n=>{ if(n.v!==v){ n.v=v; d.changed=true; } });
  if(hit.length) R.lastVel=v;
  drawRoll();
}
function hitInfo(e){
  const r=R.cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
  const t=(x-R.K+R.el.scrollLeft)/st.beatW*T, m=HIGH-Math.floor((y-R.TOP+R.el.scrollTop)/R.rh);
  return {x,y,t,m,cx:x+R.el.scrollLeft,cy:y+R.el.scrollTop};
}
function noteAt(t,m){ for(let i=st.prog.notes.length-1;i>=0;i--){const n=st.prog.notes[i]; if(n.m===m&&t>=n.s&&t<n.s+n.l) return n;} return null; }
const byId=id=>st.prog.notes.find(n=>n.id===id);
let tap=null;
R.cv.addEventListener('contextmenu',e=>e.preventDefault());
R.cv.addEventListener('pointerdown',e=>{
  const h=hitInfo(e);
  if(e.pointerType==='touch'){ tap={h,id:e.pointerId,moved:false}; return; }
  R.cv.focus({preventScroll:true});
  pointerDown(h,e);
});
function pointerDown(h,e){
  const {x,y,t,m}=h, btn=e.button||0, ctrl=e.ctrlKey||e.metaKey;
  if(y>=R.el.clientHeight-R.VEL){
    if(x<R.K||btn!==0) return;
    commit(); R.drag={type:'vel',changed:false}; velAt(x,y,R.drag);
    if(e.pointerId!=null&&!e.synthetic) R.cv.setPointerCapture(e.pointerId);
    return;
  }
  if(x<R.K&&y>=R.TOP){ if(m>=LOW&&m<=HIGH) toggleKey(m); return; }
  if(y<R.TOP&&x>=R.K){
    if(y<R.RUL){ R.start=Math.max(0,snapFloor(t,e.altKey)); showPos(R.start); if(P.playing) playProg(); else drawRoll(); return; }
    if(y<R.LN) return;
    const i=R.segs.findIndex(s=>t>=s.a&&t<s.b); if(i>=0) selectSeg(i,e.detail>=2); return;
  }
  if(x<R.K||y<R.TOP||m<LOW||m>HIGH) return;
  const n=noteAt(t,m);
  if(btn===2){ commit(); R.drag={type:'erase',changed:false}; eraseAt(t,m); if(e.pointerId!=null&&!e.synthetic) R.cv.setPointerCapture(e.pointerId); return; }
  if(btn!==0) return;
  if(n){
    if(ctrl||e.shiftKey){ R.sel.has(n.id)?R.sel.delete(n.id):R.sel.add(n.id); selChanged(); return; }
    if(!R.sel.has(n.id)) R.sel=new Set([n.id]);
    R.lastLen=n.l;
    const edge=(R.K+(n.s+n.l)/T*st.beatW-R.el.scrollLeft)-x<8;
    commit();
    R.drag={type:edge?'resize':'move',t0:t,m0:m,anchor:n,orig:new Map([...R.sel].map(id=>{const k=byId(id);return [id,{s:k.s,l:k.l,m:k.m}];})),changed:false};
    if(!edge) preview(n.m);
  } else {
    if(ctrl){ R.drag={type:'band',x0:h.cx,y0:h.cy,x1:h.cx,y1:h.cy,add:e.shiftKey,base:new Set(R.sel)}; if(!e.shiftKey) R.sel.clear(); }
    else {
      if(isDrum(st.prog)&&!DRUMS[m]) return; // only the keys the kit has samples for
      commit();
      const nn={id:uid(),m,s:Math.max(0,snapFloor(t,e.altKey)),l:R.lastLen,v:R.lastVel,...(R.glide&&!isDrum(st.prog)?{g:R.glide}:{})};
      st.prog.notes.push(nn); R.sel=new Set([nn.id]);
      R.drag={type:'move',t0:t,m0:m,anchor:nn,orig:new Map([[nn.id,{s:nn.s,l:nn.l,m:nn.m}]]),changed:true,created:true};
      preview(m);
    }
  }
  if(e.pointerId!=null&&!e.synthetic) R.cv.setPointerCapture(e.pointerId);
  rollSize(); drawRoll();
}
function eraseAt(t,m){
  const n=noteAt(t,m); if(!n) return;
  const ids=R.sel.has(n.id)?new Set(R.sel):new Set([n.id]);
  st.prog.notes=st.prog.notes.filter(k=>!ids.has(k.id)); ids.forEach(id=>R.sel.delete(id)); R.drag.changed=true; drawRoll();
}
R.cv.addEventListener('pointermove',e=>{
  const h=hitInfo(e);
  if(tap&&e.pointerId===tap.id){ if(Math.abs(h.x-tap.h.x)+Math.abs(h.y-tap.h.y)>8) tap.moved=true; return; }
  const d=R.drag;
  if(!d){
    // pixel cursors set in style.css by data-cur (in the stylesheet so their relative URLs resolve there)
    let cur='cross';
    if(h.y>=R.el.clientHeight-R.VEL) cur='ns';
    else if(h.x<R.K||h.y<R.TOP) cur='link';
    else { const n=noteAt(h.t,h.m); if(n) cur=(R.K+(n.s+n.l)/T*st.beatW-R.el.scrollLeft)-h.x<8?'ew':'move'; }
    R.cv.dataset.cur=cur; return;
  }
  if(d.type==='erase'){ eraseAt(h.t,h.m); return; }
  if(d.type==='vel'){ velAt(h.x,h.y,d); return; }
  if(d.type==='band'){
    d.x1=h.cx; d.y1=h.cy;
    const t0=(Math.min(d.x0,d.x1)-R.K)/st.beatW*T, t1=(Math.max(d.x0,d.x1)-R.K)/st.beatW*T;
    const mA=HIGH-Math.floor((Math.min(d.y0,d.y1)-R.TOP)/R.rh), mB=HIGH-Math.floor((Math.max(d.y0,d.y1)-R.TOP)/R.rh);
    R.sel=new Set(d.add?d.base:[]);
    st.prog.notes.forEach(n=>{ if(n.m<=mA&&n.m>=mB&&n.s<t1&&n.s+n.l>t0) R.sel.add(n.id); });
    drawRoll(); return;
  }
  const raw=h.t-d.t0, A=d.orig.get(d.anchor.id);
  if(d.type==='move'){
    let dt=snapRound(A.s+raw,e.altKey)-A.s, dm=h.m-d.m0;
    const os=[...d.orig.values()];
    dt=Math.max(dt,-Math.min(...os.map(o=>o.s)));
    dm=Math.min(Math.max(dm,LOW-Math.min(...os.map(o=>o.m))),HIGH-Math.max(...os.map(o=>o.m)));
    let moved=false;
    d.orig.forEach((o,id)=>{ const n=byId(id); if(!n) return; if(n.s!==o.s+dt||n.m!==o.m+dm) moved=true; n.s=o.s+dt; n.m=o.m+dm; });
    if(moved){ d.changed=true; if(dm!==d.lastDm){ d.lastDm=dm; preview(d.anchor.m); } }
  } else {
    d.orig.forEach((o,id)=>{ const n=byId(id); if(!n) return; const L=Math.max(minLen(),snapRound(o.s+o.l+raw,e.altKey)-o.s); if(L!==n.l){n.l=L; delete n.l0; d.changed=true;} });
    R.lastLen=d.anchor.l;
  }
  rollSize(); drawRoll();
});
function endDrag(){
  const d=R.drag; R.drag=null; if(!d) return;
  if(d.type==='band'){ selChanged(); return; }
  if(!d.changed) hist.pop();
  if(d.type==='vel'){ render(); return; }
  if(d.type==='move'||d.type==='resize') R.lastLen=d.anchor.l;
  st.segA=null; selChanged(true);
}
R.cv.addEventListener('pointerup',e=>{
  if(tap&&e.pointerId===tap.id){
    const tp=tap; tap=null; if(tp.moved) return;
    // tap: toggle-select an existing note (tap again to delete it), or create one
    const n=noteAt(tp.h.t,tp.h.m);
    if(n&&tp.h.x>=R.K&&tp.h.y>=R.TOP){ if(R.sel.size===1&&R.sel.has(n.id)){ commit(); st.prog.notes=st.prog.notes.filter(k=>k.id!==n.id); R.sel.clear(); selChanged(true); } else { R.sel=new Set([n.id]); selChanged(); } return; }
    pointerDown(tp.h,{button:0,detail:1,synthetic:true}); endDrag(); return;
  }
  endDrag();
});
R.cv.addEventListener('pointercancel',()=>{ tap=null; if(R.drag) endDrag(); });
// note previews (roll, keys, transposing) stop when the button or key that started them is let go
['pointerup','pointercancel','keyup','blur'].forEach(ev=>addEventListener(ev,releasePreview));
R.el.addEventListener('scroll',requestDraw,{passive:true});
// The canvas is sticky inside the scroller and drawn from scrollLeft/scrollTop. A native wheel scroll moves the content
// first and the scroll event redraws a frame later, so the drawing lags behind (thin slide lines show it most):
// the wheel scrolls by hand and draws in the same event instead, and the zoom draws once the scroll is set.
R.el.addEventListener('wheel',e=>{
  e.preventDefault();
  if(e.ctrlKey||e.metaKey){
    const r=R.el.getBoundingClientRect(), x=e.clientX-r.left-R.K, t=(x+R.el.scrollLeft)/st.beatW;
    setZoom(st.beatW*(e.deltaY<0?1.15:1/1.15));
    R.el.scrollLeft=t*st.beatW-x;
    drawRoll();
    return;
  }
  const unit=e.deltaMode===1?R.rh*3:e.deltaMode===2?R.el.clientHeight:1;
  let dx=e.deltaX*unit, dy=e.deltaY*unit;
  if(e.shiftKey&&!dx){ dx=dy; dy=0; }
  R.el.scrollLeft+=dx; R.el.scrollTop+=dy;
  drawRoll();
},{passive:false});
function setZoom(v){ st.beatW=Math.min(200,Math.max(12,v)); $('rollZoom').value=Math.round(st.beatW); fillRange($('rollZoom')); rollSize(); drawRoll(); savePrefs(); }
new ResizeObserver(()=>{rollSize();drawRoll();}).observe(R.el);
function selChanged(edited){
  if(R.sel.size){
    const ms=[...new Set([...R.sel].map(id=>byId(id)).filter(Boolean).map(n=>n.m))];
    st.notes=new Set(ms); st.src='sel'; st.srcSig=sigOf(ms); st.segA=null; st.lockedRoot=null; st.pick=0;
  } else if(st.src==='sel'){ st.src='builder'; }
  if(edited) render(); else { renderActive(); drawRoll(); drawMini(); syncGlideBtns(); }
}
function toggleKey(m){
  commit();
  if(st.rootMode){ st.notes.add(m); st.lockedRoot=st.lockedRoot===m%12?null:m%12; st.rootMode=false; }
  else if(st.notes.has(m)){ st.notes.delete(m); if(st.lockedRoot!==null&&![...st.notes].some(n=>n%12===st.lockedRoot)) st.lockedRoot=null; }
  else { st.notes.add(m); preview(m); }
  st.pick=0; render();
}
// roll keyboard
R.cv.addEventListener('keydown',e=>{
  const k=e.key, ctrl=e.ctrlKey||e.metaKey;
  const handled=()=>{e.preventDefault();e.stopPropagation();};
  if(ctrl&&(k==='z'||k==='Z')){ handled(); e.shiftKey?redo():undo(); return; }
  if(ctrl&&(k==='y'||k==='Y')){ handled(); redo(); return; }
  if(ctrl&&(k==='a'||k==='A')){ handled(); selectAll(); return; }
  if(ctrl&&(k==='b'||k==='B')){ handled(); duplicateSel(); return; }
  if(ctrl&&(k==='q'||k==='Q')){ handled(); quantize(); return; }
  if(k==='Delete'||k==='Backspace'){ handled(); deleteSel(); return; }
  if(k==='Escape'){ handled(); R.sel.clear(); selChanged(); return; }
  if(k===' '){ handled(); P.playing?stopProg():playProg(); return; }
  if(k==='Enter'){ handled(); addAtEnd(); return; }
  if(!R.sel.size) return;
  if(k==='ArrowUp'||k==='ArrowDown'){ handled(); transposeSel((k==='ArrowUp'?1:-1)*(e.shiftKey?12:1)); return; }
  if(k==='ArrowLeft'||k==='ArrowRight'){ handled(); moveSel((k==='ArrowRight'?1:-1)*(snapT()||T)); return; }
});
function selNotes(){return st.prog.notes.filter(n=>R.sel.has(n.id));}
function selectAll(){ R.sel=new Set(st.prog.notes.map(n=>n.id)); selChanged(); }
function deleteSel(){ if(!R.sel.size) return; commit(); st.prog.notes=st.prog.notes.filter(n=>!R.sel.has(n.id)); R.sel.clear(); st.segA=null; selChanged(true); }
function duplicateSel(){
  const ns=selNotes(); if(!ns.length) return;
  commit();
  const a=Math.min(...ns.map(n=>n.s)), b=Math.max(...ns.map(n=>n.s+n.l)), len=b-a;
  const copies=ns.map(n=>({id:uid(),m:n.m,s:n.s+len,l:n.l,v:n.v,...(n.g?{g:n.g}:{})}));
  st.prog.notes.push(...copies); R.sel=new Set(copies.map(n=>n.id)); selChanged(true); toast(tr('Selección duplicada','Selection duplicated'));
}
function quantize(){
  const s=snapT(); if(!s){ toast(tr('Elige un ajuste distinto de «Sin ajuste» para cuantizar.','Pick a snap other than “No snap” to quantize.')); return; }
  const ns=R.sel.size?selNotes():st.prog.notes; if(!ns.length) return;
  commit();
  ns.forEach(n=>{ const e=Math.round((n.s+n.l)/s)*s; n.s=Math.round(n.s/s)*s; n.l=Math.max(s,e-n.s); delete n.l0; });
  selChanged(true); toast(tr(`Cuantizado a ${$('snap').selectedOptions[0].textContent}`,`Quantized to ${$('snap').selectedOptions[0].textContent}`));
}
function transposeSel(d){
  const ns=selNotes(); if(!ns.length||ns.some(n=>n.m+d<LOW||n.m+d>HIGH)) return;
  commit(); ns.forEach(n=>n.m+=d); preview(ns[0].m); selChanged(true);
}
function moveSel(d){
  const ns=selNotes(); if(!ns.length||ns.some(n=>n.s+d<0)) return;
  commit(); ns.forEach(n=>n.s+=d); selChanged(true);
}
// slide / portamento as in FL's piano roll: a drawing mode for new notes only (one or none); notes already drawn keep theirs
function toggleGlide(g){
  if(isDrum(st.prog)) return;
  R.glide=R.glide===g?'':g; syncGlideBtns();
}
function syncGlideBtns(){
  const drum=isDrum(st.prog);
  [['bSlide','s'],['bPorta','p']].forEach(([id,g])=>{ const b=$(id); b.disabled=drum; b.setAttribute('aria-pressed',!drum&&R.glide===g); });
}
$('bSelAll').onclick=selectAll; $('bDup').onclick=duplicateSel; $('bQuant').onclick=quantize; $('bDelSel').onclick=deleteSel;
$('bSlide').onclick=()=>toggleGlide('s'); $('bPorta').onclick=()=>toggleGlide('p');

// ---------- chord (segment) operations ----------
function curSeg(){ return st.segA==null?null:R.segs.find(s=>s.a===st.segA)||null; }
function selectSeg(i,selectNotes){
  const S=R.segs[i]; if(!S) return;
  st.segA=S.a; st.notes=new Set(S.notes); st.src='seg'; st.srcSig=S.sig; st.lockedRoot=null;
  const nm=st.prog.names[S.sig]; st.prefer=nm?{...nm}:null; st.pick=0;
  R.sel=selectNotes?new Set(S.ids):new Set();
  if(selectNotes){ st.src='seg'; }
  render();
}
function ripple(from,delta,except){ st.prog.notes.forEach(n=>{ if(n.s>=from&&!(except&&except.has(n.id))) n.s+=delta; }); }
function activeStep(){ const L=Math.max(1,Math.round((+st.prog.beats||4)*T)); return {notes:[...st.notes].sort((a,b)=>a-b),L}; }
function nameActive(){ if(lastCur) st.prog.names[sigOf(st.notes)]={root:lastCur.root,sym:lastCur.type.sym}; }
function placeBlock(notes,a,L){ const ids=notes.map(m=>{const id=uid(); st.prog.notes.push({id,m,s:a,l:L,v:100}); return id;}); return ids; }
function addAtEnd(){
  if(!st.notes.size) return;
  commit(); const {notes,L}=activeStep(), a=progEnd(st.prog);
  placeBlock(notes,a,L); nameActive(); st.segA=a; st.src='seg'; st.srcSig=sigOf(notes); R.sel.clear();
  render(); const x=(a+L)/T*st.beatW; if(x>R.el.scrollLeft+R.el.clientWidth-R.K) R.el.scrollLeft=x-(R.el.clientWidth-R.K)*.7;
  toast(tr('Acorde agregado al final','Chord added at the end'));
}
function insertAtHead(){
  if(!st.notes.size) return;
  commit(); const {notes,L}=activeStep(), a=R.start;
  ripple(a,L); placeBlock(notes,a,L); nameActive(); st.segA=a; st.src='seg'; st.srcSig=sigOf(notes); R.sel.clear(); render(); toast(tr('Acorde insertado en el cabezal','Chord inserted at the playhead'));
}
function replaceActive(){
  const S=curSeg();
  if(st.src==='sel'&&R.sel.size){
    const ns=selNotes(); const a=Math.min(...ns.map(n=>n.s)), b=Math.max(...ns.map(n=>n.s+n.l));
    commit(); st.prog.notes=st.prog.notes.filter(n=>!R.sel.has(n.id));
    R.sel=new Set(placeBlock([...st.notes].sort((x,y)=>x-y),a,b-a)); nameActive(); st.srcSig=sigOf(st.notes); render(); toast(tr('Selección reemplazada','Selection replaced')); return;
  }
  if(S&&isBlock(st.prog,S)){
    commit(); st.prog.notes=st.prog.notes.filter(n=>!S.ids.has(n.id)); placeBlock([...st.notes].sort((x,y)=>x-y),S.a,S.b-S.a); nameActive(); st.srcSig=sigOf(st.notes); render(); toast(tr('Acorde reemplazado','Chord replaced'));
  }
}
function setSegLen(L){
  const S=curSeg(); if(!S||!isBlock(st.prog,S)) return;
  L=Math.max(minLen(),Math.min(64*T,Math.round(L))); const delta=L-(S.b-S.a); if(!delta) return;
  commit(); ripple(S.b,delta,S.ids); S.ids.forEach(id=>{const n=byId(id); if(n) n.l=L;}); render();
}
function swapSeg(dir){
  const i=R.segs.indexOf(curSeg()); const A=dir<0?R.segs[i-1]:R.segs[i], B=dir<0?R.segs[i]:R.segs[i+1];
  if(!A||!B||A.b!==B.a||!isBlock(st.prog,A)||!isBlock(st.prog,B)) return;
  commit(); const la=A.b-A.a, lb=B.b-B.a;
  B.ids.forEach(id=>byId(id).s=A.a); A.ids.forEach(id=>byId(id).s=A.a+lb);
  st.segA=dir<0?A.a:A.a+lb; render();
}
function deleteSeg(){
  const S=curSeg(); if(!S) return;
  commit();
  if(isBlock(st.prog,S)){ st.prog.notes=st.prog.notes.filter(n=>!S.ids.has(n.id)); ripple(S.b,-(S.b-S.a)); }
  else st.prog.notes=st.prog.notes.filter(n=>!(S.ids.has(n.id)&&n.s>=S.a));
  st.segA=null; st.src='builder'; render(); toast(tr('Acorde quitado','Chord removed'));
}
$('bAdd').onclick=addAtEnd; $('bInsertHead').onclick=insertAtHead; $('bReplace').onclick=replaceActive;
$('bSegShorter').onclick=()=>{const S=curSeg(); if(S) setSegLen(S.b-S.a-(snapT()>=T/2?snapT():T/2));};
$('bSegLonger').onclick=()=>{const S=curSeg(); if(S) setSegLen(S.b-S.a+(snapT()>=T/2?snapT():T/2));};
$('segBeats').onchange=e=>setSegLen((+String(e.target.value).replace(',','.')||1)*T);
$('bSegLeft').onclick=()=>swapSeg(-1); $('bSegRight').onclick=()=>swapSeg(1); $('bSegDel').onclick=deleteSeg;

function centerRoll(){ const ns=st.prog.notes.length?st.prog.notes.map(n=>n.m):[...st.notes]; const m=ns.length?Math.round((Math.min(...ns)+Math.max(...ns))/2):60; R.el.scrollTop=R.TOP+(HIGH-m)*R.rh-R.el.clientHeight/2; }
function velTargets(){ return R.sel.size?selNotes():st.prog.notes; }

export { P, R, addAtEnd, centerRoll, commit, curSeg, drawRoll, playProg, pxDisc, readColors, redo, rollSize, selChanged, setPlayBtn, setZoom, stopProg, syncGlideBtns, toggleKey, undo, velTargets };
