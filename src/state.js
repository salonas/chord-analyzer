// Interface state, history stacks and what this browser keeps in localStorage.
import { activePat, normProject } from './model.js';
import { defaultProject } from './importer.js';
import { browserLanguages, detectLanguage, setLang, sharedLang } from './i18n.js';

const st={notes:new Set(),lockedRoot:null,rootMode:false,showNames:false,
  naming:'letters',accPref:'auto',sound:true,pick:0,prefer:null,mix:{},
  proj:null,prog:null,octConv:'sci',midiShift:0,src:'builder',srcSig:'',segA:null,exportMode:'pat',snap:.25,beatW:56,loop:true,liveAll:false,tab:'kb',ex:null,lang:detectLanguage(browserLanguages())};
let lib={chords:[],projects:[]};
const hist=[], fut=[];

// ---------- local storage ----------
function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
Object.assign(st,load('pca.prefs',{}));
st.lang=sharedLang()??st.lang; // a language picked on the site wins over the one saved here
setLang(st.lang);
(function(){
  const d=load('pca.draft',null);
  if(d&&(d.proj||d.prog)){ st.notes=new Set(d.notes||[]); st.lockedRoot=d.lockedRoot??null; st.proj=normProject(d.proj||d.prog); }
  else st.proj=defaultProject(); // a first visit opens the turnaround in C on piano; «Nuevo proyecto» still starts empty
  st.prog=activePat(st.proj);
  if(st.ex&&!st.ex.preset) st.ex=null;
  const l=load('pca.lib',null); if(l) lib={chords:l.chords||[],projects:(l.projects||l.progressions||[]).map(normProject)};
})();
let draftTimer;
function saveDraft(){clearTimeout(draftTimer); draftTimer=setTimeout(()=>save('pca.draft',{notes:[...st.notes],lockedRoot:st.lockedRoot,proj:st.proj}),250);}
function savePrefs(){save('pca.prefs',{ex:st.ex,exportMode:st.exportMode,octConv:st.octConv,midiShift:st.midiShift,naming:st.naming,accPref:st.accPref,sound:st.sound,showNames:st.showNames,snap:st.snap,beatW:st.beatW,loop:st.loop,liveAll:st.liveAll,tab:st.tab,lang:st.lang,mix:st.mix});}

// ---------- library storage (this browser only) ----------
function persistLib(){save('pca.lib',lib);}

export { fut, hist, lib, persistLib, saveDraft, savePrefs, st };
