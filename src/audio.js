// Web Audio voices.
import { freq } from './data.js';
import { DRUMS } from './drums.js';
import { isDrum } from './model.js';
import { st } from './state.js';

// ---------- audio ----------
let ac,master;
// glides (glide.js): bend is [{t,d}] in audio seconds and semitones, starting at the voice's start;
// the parameter follows it in linear ramps, with to(d) giving the parameter value for d semitones
function glideParam(param,bend,to){
  if(!bend||!bend.length) return;
  param.setValueAtTime(to(bend[0].d),bend[0].t);
  for(let i=1;i<bend.length;i++) param.linearRampToValueAtTime(to(bend[i].d),bend[i].t);
}
function audio(){
  if(!ac){
    ac=new (window.AudioContext||window.webkitAudioContext)();
    master=ac.createGain(); master.gain.value=.6;
    const comp=ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
  }
  if(ac.state==='suspended') ac.resume();
  return ac;
}
function voice(m,t,vel,dest,hold,bend){
  const c=audio(), f=freq(m), nyq=c.sampleRate/2;
  let dur=Math.max(.6,Math.min(4.5,3.4-(m-60)/28));
  if(hold!=null) dur=Math.min(dur,hold+.35);
  const g=c.createGain(), rel=c.createGain();
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vel,t+.006); g.gain.exponentialRampToValueAtTime(.0005,t+Math.max(dur,.05));
  if(hold!=null){ rel.gain.setValueAtTime(1,t+hold); rel.gain.setTargetAtTime(0,t+hold,.06); }
  const lp=c.createBiquadFilter(); lp.type='lowpass';
  lp.frequency.setValueAtTime(Math.min(nyq*.9,Math.max(f*7,900)),t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(nyq*.9,Math.max(f*1.6,250)),t+Math.max(dur,.05));
  lp.connect(g); g.connect(rel); rel.connect(dest||master);
  const partials=f<130?[[1,1,'sawtooth']]:[[1,1,'triangle'],[2,.3,'sine'],[3,.12,'sine'],[4,.06,'sine']];
  for(const [h,a,type] of partials){
    if(f*h>nyq*.95) continue;
    const o=c.createOscillator(), og=c.createGain();
    o.type=type; o.frequency.value=f*h; og.gain.value=a; glideParam(o.detune,bend,d=>100*d);
    o.connect(og); og.connect(lp); o.start(t); o.stop(t+dur+.05);
  }
}
// Synth pads for channels whose samples do not work as a pad (the template's Pad is a medieval
// bagpipe; «warm» was chosen by ear from three): oscillators detuned in cents and a low-pass at a
// multiple of the note's frequency (clamped), with a release after hold or a short preview without it.
// Levels match the rendered samples (about -33.5 dB RMS on a four-note chord).
const SYNTHS={
  warm:{osc:[['sawtooth',1,-7,.5],['sawtooth',1,7,.5],['sine',.5,0,.35]],cut:3,lo:400,hi:2500,q:.5,a:.35,r:.9,level:.027},
};
function synthVoice(kind,m,t,v,dest,hold,mix=1,bend){
  const P=SYNTHS[kind], c=audio(), f=freq(m), nyq=c.sampleRate/2, len=hold!=null?hold:.8;
  const g=c.createGain(), lp=c.createBiquadFilter(), peak=mix*P.level*Math.min(1.3,v/100);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+P.a);
  g.gain.setValueAtTime(peak,t+Math.max(len,P.a)); g.gain.setTargetAtTime(0,t+Math.max(len,P.a),P.r/4);
  const cut=Math.min(nyq*.9,Math.max(P.lo,Math.min(P.hi,f*P.cut)));
  lp.type='lowpass'; lp.Q.value=P.q; lp.frequency.value=cut;
  lp.connect(g); g.connect(dest||master);
  const end=t+Math.max(len,P.a)+P.r+.1;
  for(const [type,ratio,cents,a] of P.osc){
    if(f*ratio>nyq*.95) continue;
    const o=c.createOscillator(), og=c.createGain();
    o.type=type; o.frequency.value=f*ratio; o.detune.value=cents; og.gain.value=a; glideParam(o.detune,bend,d=>cents+100*d);
    o.connect(og); og.connect(lp); o.start(t); o.stop(end);
  }
}
function playNotes(list,spread){
  if(!list.length) return;
  const c=audio(), t0=c.currentTime+.02, vel=.32/Math.sqrt(list.length), p=isDrum(st.prog)?null:st.prog;
  list.forEach((m,i)=>patVoice(p,m,t0+i*spread,Math.round(90/Math.sqrt(list.length)),null,vel));
}

// ---------- samples ----------
// Cut down by tools/samples.py from the CC0 libraries the FL template loads: the drum kit note by
// note, and a few notes per channel that the browser retunes. Each set loads the first time a
// pattern that uses it sounds; until then, or if it cannot load, the oscillators above play.
const BASE='./samples/', LEVEL=.5;
let man=null, manLoad=null;      // man: the manifest, false if it could not load
const sets=new Map();            // 'drums' or a channel name → {ready, data}
const ringing=[];                // open hi-hats and cymbals still sounding, so a later hit can cut them
const CUTS={hh:['hho'],hhp:['hho'],choke:['crash','ride','bell']};
const loadManifest=()=>manLoad||(manLoad=fetch(BASE+'manifest.json').then(r=>r.json()).then(m=>{ man=m; },()=>{ man=false; }));
const plain=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s*-\s*\d+\s*$/,'').trim();
// the template channel a pattern stands for: same name, then the longest channel its name starts
// with, then the shortest channel that starts with its name, then the default of its instrument
function channelFor(p,m){
  if(!m||!p) return null;
  if(isDrum(p)) return 'drums';
  const n=plain(p.name), names=[...Object.keys(m.channels),...Object.keys(m.synths||{}),...(m.oscillators||[])], by=k=>names.filter(c=>k(plain(c)));
  const pick=by(c=>c===n)[0]||by(c=>n.startsWith(c)).sort((a,b)=>b.length-a.length)[0]||(n&&by(c=>c.startsWith(n)).sort((a,b)=>a.length-b.length)[0])||m.profiles[p.inst&&p.inst.preset];
  return pick&&(m.channels[pick]||synthOf(pick,m))?pick:null;
}
const synthOf=(k,m=man)=>!!m&&!!m.synths&&m.synths[k]||null;
const setOf=p=>channelFor(p,man);
function loadSet(key){
  if(!sets.has(key)){
    const s={ready:false,data:null}; sets.set(key,s);
    const c=audio(), get=f=>fetch(BASE+f).then(r=>r.arrayBuffer()).then(b=>c.decodeAudioData(b));
    s.load=(key==='drums'
      ?Promise.all(Object.entries(man.drums).map(async([m,ls])=>[+m,await Promise.all(ls.map(async l=>({v:l.v,buf:await get(l.file)})))])).then(e=>new Map(e))
      :Promise.all(man.channels[key].samples.map(async x=>({...x,buf:await get(x.file)}))).then(xs=>({pitched:man.channels[key].pitched,release:man.channels[key].release,xs}))
    ).then(d=>{ s.data=d; },()=>{ s.data=false; }).then(()=>{ s.ready=true; });
  }
  return sets.get(key).load;
}
// resolves once the pattern's samples are loaded, or known to be missing
async function ensureSounds(p){ await loadManifest(); const k=setOf(p); if(k&&!synthOf(k)) await loadSet(k); }
function soundsReady(p){ if(man===null) return false; const k=setOf(p); return !k||!!synthOf(k)||(sets.has(k)&&sets.get(k).ready); }
// after hold seconds the note fades over the channel's release (as its .sfz sets it), then stops
function start(buf,t,gain,rate,dest,hold,rel=.25,bend){
  const c=audio(), src=c.createBufferSource(), g=c.createGain();
  src.buffer=buf; src.playbackRate.value=rate; g.gain.value=gain; glideParam(src.playbackRate,bend,d=>rate*Math.pow(2,d/12));
  src.connect(g); g.connect(dest||master); src.start(t);
  if(hold!=null){ g.gain.setValueAtTime(gain,t+hold); g.gain.setTargetAtTime(0,t+hold,Math.max(.02,rel/5)); src.stop(t+hold+rel+.1); }
  return g;
}
// drums: the layer recorded closest below the velocity, scaled by how far the velocity goes past it
function drumHit(kit,m,t,v,dest,f=1){
  const layers=kit.get(m); if(!layers) return false;
  const l=[...layers].reverse().find(x=>x.v<=v)||layers[0], g=start(l.buf,t,f*LEVEL*Math.min(1.5,v/l.v),1,dest);
  const role=DRUMS[m]&&DRUMS[m].p;
  (CUTS[role]||[]).forEach(r=>ringing.forEach(x=>{ if(x.role===r&&x.t<t) x.g.gain.setTargetAtTime(0,t,.02); }));
  if(['hho','crash','ride','bell'].includes(role)){ ringing.push({role,t,g}); if(ringing.length>64) ringing.shift(); }
  return true;
}
// other channels: the rendered note whose span holds this one, retuned; outside the instrument's
// range nothing sounds, as in sforzando
function noteHit(set,m,t,v,dest,hold,f=1,bend){
  const x=set.xs.find(s=>m>=s.lo&&m<=s.hi);
  if(x) start(x.buf,t,f*LEVEL*Math.min(1.3,v/100),set.pitched?Math.pow(2,(m-x.k)/12):1,dest,hold,set.release,set.pitched?bend:null);
  return true;
}
// Playback volume per instrument (st.mix, 0 to 1): only what this page plays; the exported MIDI and text keep their velocities.
// Keyed by the template channel, or by the instrument profile when the pattern has no samples.
const mixKey=p=>setOf(p)||'osc:'+(p&&p.inst?p.inst.preset:'generico');
const MIX_DEFAULT=.3; // a channel nobody has moved starts at 30 %
const mixOf=p=>{ const v=st.mix&&st.mix[mixKey(p)]; return v==null?MIX_DEFAULT:v; };
function setMix(p,v){ st.mix={...st.mix,[mixKey(p)]:v}; }
// one note of pattern p (null: no pattern) with its samples when they are loaded, else the oscillators;
// without a destination it goes to the master at the pattern's volume (playback sets it on its own bus);
// bend (optional) is the voice's pitch curve, see glideParam
function patVoice(p,m,t,vel127,dest,vel,hold,bend){
  const k=setOf(p), s=k&&sets.get(k), d=s&&s.ready&&s.data, f=dest?1:mixOf(p);
  if(synthOf(k)){ synthVoice(synthOf(k),m,t,vel127,dest,hold,f,bend); return; }
  // a drum key the kit has no sample for stays silent: the oscillators would play it as a keyboard note
  if(k==='drums'){ if(d) drumHit(d,m,t,vel127,dest,f); return; }
  if(d&&noteHit(d,m,t,vel127,dest,hold,f,bend)) return;
  voice(m,t,vel*f,dest,hold,bend);
}

// a preview sounds while the button or key is held, as in FL: releasePreview fades it out, a new
// preview cuts the previous one, and each lasts between PREVIEW_MIN and PREVIEW_MAX seconds
const PREVIEW_MIN=.15, PREVIEW_MAX=8;
let held=null;
function releasePreview(){
  if(!held) return;
  const {c,bus,t}=held, now=c.currentTime, at=Math.max(now,t+PREVIEW_MIN); held=null;
  bus.gain.cancelScheduledValues(now); bus.gain.setValueAtTime(bus.gain.value,at); bus.gain.setTargetAtTime(0,at,.04);
  setTimeout(()=>bus.disconnect(),(at-now)*1000+400);
}
const preview=m=>{
  releasePreview();
  if(!st.sound) return;
  if(!soundsReady(st.prog)) ensureSounds(st.prog);
  const c=audio(), t=c.currentTime+.02, bus=c.createGain(); bus.gain.value=mixOf(st.prog); bus.connect(master);
  patVoice(st.prog,m,t,100,bus,.32,PREVIEW_MAX);
  held={c,bus,t};
};

export { SYNTHS, audio, channelFor, synthVoice, ensureSounds, loadManifest, master, mixOf, patVoice, playNotes, preview, releasePreview, setMix, soundsReady, voice };
