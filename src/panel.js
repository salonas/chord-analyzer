// What the inspector says about the active chord, as pure functions so that each label has a rule and a test.
import { freq } from './data.js';
import { analyze, aug6Iv, inversionText, letterName, melodyText, noteText, ornamentText, plainSpell, spellCandidate } from './analysis.js';
import { tr } from './i18n.js';

// The notes of the active chord and their spelling: a chord taken from the progression is spelled in the key the lane
// reads it in (G♯7, not A♭7, in C♯ minor), and, while the reading in use is the lane's (lane: that chord of the analysis),
// with the lane's letters, as the text writes them («Escritura de notas»): an augmented sixth with D♯ over F, each chip named
// by its interval from the bass; a dim7 read by its resolution (vii°⁶₅/V) or as a ♯ii°7 with the letters of that reading, a
// respelled chip named by its interval from the root by letters (F♯ over A is a 6). 4 Nov 2026
function spellActive(notes,cur,prefs,key,lane){
  const sp=cur?spellCandidate(cur,notes,prefs,key):null;
  const spelled=sp?sp.notes:notes.map(m=>plainSpell(m,prefs,key));
  const own=lane&&cur&&lane.c&&cur.root===lane.c.root&&cur.type.sym===lane.c.type.sym?lane:null;
  if(!own) return {sp,spelled};
  const root={l:sp.byPc[cur.root].l,midi:cur.root};
  return {sp,spelled:spelled.map(n=>{
    const x=own.spelled.find(y=>y.midi===n.midi); if(!x) return n;
    if(own.aug6) return {...x,deg:x.deg&&{...x.deg,label:aug6Iv(x,own.aug6.lo)}};
    return x.l===n.l&&x.a===n.a?n:{...x,deg:n.deg&&{...n.deg,label:aug6Iv(x,root)}};
  })};
}

// An interval is named by letters, not by semitones alone: the number is the distance between the letters and the quality
// the semitones left over. C–D♯ is an augmented 2nd, C–E♭ a minor 3rd, F–B an augmented 4th and B–F a diminished 5th.
const MAJOR_SCALE=[0,2,4,5,7,9,11];
const QUALITY={
  perfect:{0:['justa','perfect'],1:['aumentada','augmented'],'-1':['disminuida','diminished'],2:['doblemente aumentada','doubly augmented'],'-2':['doblemente disminuida','doubly diminished']},
  major:{0:['mayor','major'],'-1':['menor','minor'],1:['aumentada','augmented'],'-2':['disminuida','diminished'],2:['doblemente aumentada','doubly augmented'],'-3':['doblemente disminuida','doubly diminished']},
};
const ORDINAL_EN=['unison','2nd','3rd','4th','5th','6th','7th'];
// lo and hi are MIDI numbers, a and b their spelled notes ({l: letter, 0 = C … 6 = B})
function intervalText(lo,hi,a,b){
  const semi=hi-lo, n=((b.l-a.l)%7+7)%7, d=((semi%12-MAJOR_SCALE[n])+18)%12-6;
  const q=((n===0||n===3||n===4)?QUALITY.perfect:QUALITY.major)[d];
  if(semi===12&&n===0&&d===0) return tr('Intervalo de octava · 12 semitonos','Octave interval · 12 semitones');
  let name;
  if(!q) name=tr(`${n+1}ª (${semi%12} semitonos)`,`${ORDINAL_EN[n]} (${semi%12} semitones)`);
  else if(n===0) name=d===0?tr('unísono','unison'):tr(`unísono ${q[0].replace(/a$/,'o')}`,`${q[1]} unison`);
  else name=tr(`${n+1}ª ${q[0]}`,`${q[1]} ${ORDINAL_EN[n]}`);
  const k=Math.floor(semi/12);
  return tr(`Intervalo de ${name}${semi>12?` + ${k} octava${semi>=24?'s':''} (compuesto)`:''} · ${semi} semitonos`,
    `${name.charAt(0).toUpperCase()+name.slice(1)} interval${semi>12?` + ${k} octave${semi>=24?'s':''} (compound)`:''} · ${semi} semitones`);
}

// The tags of a candidate name: why it is, or is not, an exact reading of the notes
// The names of the active chord. A lane chord that leaves notes out as ornaments puts that reading first (orn: the notes it
// leaves out); the readings with every note stay below as alternatives: the rule orders the names, it does not take any away.
// When the user named the chord with all its notes (after), the reading without the ornaments goes last instead.
// A root you choose is your reading, so the list is then the plain one
function activeCands(notes,lockedRoot,orn,after,lane){
  const all=analyze(notes,lockedRoot);
  // a lane chord whose name takes notes of the tune or weighed its neighbours (readWithMelody) goes first as the lane reads it;
  // the readings of the chord's own notes stay below, C(no5) under the C the tune completes too
  if(lane&&(lane.mel||lane.ctx)&&lockedRoot==null) return [{...lane,...(orn&&orn.length&&{orn})},...all.filter(c=>c.root!==lane.root||c.type.sym!==lane.type.sym||c.missing.length!==lane.missing.length)];
  if(!orn||!orn.length||lockedRoot!=null) return all;
  const top=analyze(notes.filter(m=>!orn.includes(m)),null)[0];
  if(!top) return all;
  const rest=all.filter(c=>c.root!==top.root||c.type.sym!==top.type.sym);
  return after?[...rest,{...top,orn}]:[{...top,orn},...rest];
}

function candTags(c,csp,lockedRoot,prefs){
  const t=[];
  if(c.orn) t.push({text:(c.orn.length>1?tr('Adornos','Ornaments'):tr('Adorno','Ornament'))+': '+c.orn.map(m=>noteText(csp.notes.find(n=>n.midi===m),prefs)).join(', ')});
  if(c.mel) t.push({text:tr('Con la melodía','With the melody')+': '+[...new Set(c.mel.map(m=>m%12))].map(pc=>letterName(csp.byPc[pc].l,csp.byPc[pc].a,prefs)).join(', ')});
  if(!c.missing.length&&!c.slash&&!c.orn&&!c.mel) t.push({exact:true,text:tr('coincidencia exacta','exact match')});
  if(!c.slash) t.push({text:tr('bajo = fundamental','bass is the root')});
  if(c.missing.length) t.push({text:`${tr('sin','no')} ${c.missing.map(d=>d.label).join(', ')}`});
  if(c.slash) t.push({text:inversionText(c)});
  if(lockedRoot===c.root) t.push({exact:true,text:tr('raíz elegida','chosen root')});
  if(c.type.alt) t.push({text:`${tr('también','also')} ${csp.rootName+c.type.alt}`});
  return t;
}

// Physical limits, not theory: the 88 keys, MIDI, the usual range of hearing and two hands
const LIMITS={pianoLow:21,pianoHigh:108,midiHigh:127,lowHz:20,highHz:15000,fingers:10};
// A rule of thumb, not a table by interval: a 3rd or a smaller interval whose upper note is below C3 tends to sound muddy
const MUDDY={below:48,maxSemitones:4};
// The warnings for the notes of the chord: [{kind, notes}] in the order they are shown
function chordWarnings(notes,hasCands){
  const w=[], pick=(kind,f)=>{ const x=notes.filter(f); if(x.length) w.push({kind,notes:x}); };
  pick('below',m=>m<LIMITS.pianoLow); pick('above',m=>m>LIMITS.pianoHigh); pick('noMidi',m=>m>LIMITS.midiHigh);
  pick('infra',m=>freq(m)<LIMITS.lowHz); pick('ultra',m=>freq(m)>LIMITS.highHz);
  for(let i=1;i<notes.length;i++) if(notes[i]<MUDDY.below&&notes[i]-notes[i-1]<=MUDDY.maxSemitones){ w.push({kind:'muddy',notes:[notes[i-1],notes[i]]}); break; }
  if(notes.length>=3&&!hasCands) w.push({kind:'unknown',notes:[]});
  if(notes.length>LIMITS.fingers) w.push({kind:'hands',notes});
  return w;
}
// nm names a list of notes, ref one note
function warningText(w,nm,ref){
  const n=nm(w.notes), L=LIMITS;
  switch(w.kind){
    case 'below': return tr(`${n}: por debajo de ${ref(L.pianoLow)} (MIDI ${L.pianoLow}), la tecla más grave de un piano de 88 teclas.`,`${n}: below ${ref(L.pianoLow)} (MIDI ${L.pianoLow}), the lowest key of an 88-key piano.`);
    case 'above': return tr(`${n}: por encima de ${ref(L.pianoHigh)} (MIDI ${L.pianoHigh}), la tecla más aguda de un piano de 88 teclas.`,`${n}: above ${ref(L.pianoHigh)} (MIDI ${L.pianoHigh}), the highest key of an 88-key piano.`);
    case 'noMidi': return tr(`${n}: por encima de ${ref(L.midiHigh)} (MIDI ${L.midiHigh}). No existen como nota MIDI estándar.`,`${n}: above ${ref(L.midiHigh)} (MIDI ${L.midiHigh}). They do not exist as standard MIDI notes.`);
    case 'infra': return tr(`${n}: bajo ${L.lowHz} Hz, el límite inferior habitual del oído. En parlantes comunes casi no se escucha.`,`${n}: below ${L.lowHz} Hz, the usual lower limit of hearing. Common speakers barely play it.`);
    case 'ultra': return tr(`${n}: sobre ${L.highHz/1000} kHz. Muchos adultos oyen poco o nada en esa zona; depende de la edad.`,`${n}: above ${L.highHz/1000} kHz. Many adults hear little or nothing there; it depends on age.`);
    case 'muddy': return tr(`${n}: intervalo de 3ª o menor bajo ${ref(MUDDY.below)}. Regla práctica: en el registro grave suele sonar turbio, y el límite exacto depende del intervalo.`,`${n}: a 3rd or smaller below ${ref(MUDDY.below)}. Rule of thumb: in the low register it tends to sound muddy, and the exact limit depends on the interval.`);
    case 'unknown': return tr('No se reconoce el acorde. Puede ser un cluster o un tipo fuera del diccionario.','The chord is not recognized. It may be a cluster or a type outside the dictionary.');
    default: return tr(`${w.notes.length} notas: más de las que caben en dos manos (${L.fingers} dedos).`,`${w.notes.length} notes: more than two hands can hold (${L.fingers} fingers).`);
  }
}

// What the empty sheet says when a pattern has notes but no chord: a head and one item per rule of harmony.js
// (splitHarmony, arpeggioChords, gridChords)
const emptySheetText=()=>({
  head:tr('Solo melodía: no hay acordes. La app arma un acorde cuando hay:','Melody only: no chords. The app builds a chord when there are:'),
  items:[tr('tres notas a la vez','three notes at once'),
    tr('dos notas a la vez que duran un tiempo o más','two notes at once that last a beat or more'),
    tr('un arpegio: una sola voz que salta entre tres o más notas de un acorde','an arpeggio: a single voice leaping between three or more notes of a chord'),
    tr('un acompañamiento: tres o más notas distintas en un tiempo mientras otra voz se sostiene','an accompaniment: three or more different notes in a beat while another voice holds')]});

// The line under the name of the active chord: root and type, then its inversion, the degrees it leaves out («sin 5»), the
// ornaments (decision 8) and the notes of the tune that complete it (decision 11)
function chordDesc(cur,sp,spelled,prefs){
  const inv=inversionText(cur);
  return `${sp.rootName} ${cur.type.name}${inv?' · '+inv:''}${cur.missing.length?tr(' · sin ',' · no ')+cur.missing.map(d=>d.label).join(', '):''}${cur.orn?' · '+ornamentText(cur.orn,spelled,prefs):''}${cur.mel?' · '+melodyText(cur.mel,sp,prefs):''}`;
}

// What the sheet says under «Final»: the cadence of the last two chords, or that there is none
const endingText=cad=>cad||tr('sin cadencia final','no final cadence');
// the cadence from the last chord back to the first, shown under «sin cadencia final» (THEORY.md, «Cadencia al repetir»)
const loopText=cad=>`${tr('Al repetir','On repeat')}: ${cad}`;
// The help under the sheet: what each row shows (the tension is an estimate, decision 7) and what the brackets join
const sheetHint=()=>tr('Cada acorde ocupa dos renglones. Arriba va el grado y abajo el acorde, su función y su tensión estimada (0 a 1). Las llaves numeradas del margen unen los grados de cada patrón reconocido. Si una llave queda abierta, el patrón sigue en el otro extremo porque da la vuelta en bucle.','Each chord takes two lines. The degree goes on top and the chord, its function and its estimated tension (0 to 1) go below. The numbered brackets in the margin join the degrees of each recognized pattern. If a bracket is left open, the pattern continues at the other end because it loops around.');

export { LIMITS, MUDDY, activeCands, candTags, chordDesc, chordWarnings, emptySheetText, endingText, intervalText, loopText, sheetHint, spellActive, warningText };
