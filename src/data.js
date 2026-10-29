// Constants and tables: pitch spelling, the chord dictionary and the instrument profiles.
import { tr } from './i18n.js';

const LOW=12, HIGH=132;            // C0 .. C10 (MIDI numbers; C4 = 60)
const T=96;                        // ticks per beat
const NAT=[0,2,4,5,7,9,11];
const LETTERS=['C','D','E','F','G','A','B'];
const LATIN=['Do','Re','Mi','Fa','Sol','La','Si'];
const SHARP=[[0,0],[0,1],[1,0],[1,1],[2,0],[3,0],[3,1],[4,0],[4,1],[5,0],[5,1],[6,0]];
const FLAT=[[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[4,-1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];
const AUTO=[[0,0],[1,-1],[1,0],[2,-1],[2,0],[3,0],[3,1],[4,0],[5,-1],[5,0],[6,-1],[6,0]];
const BLACK=new Set([1,3,6,8,10]);
const INTERVALS=['unísono','2ª menor','2ª mayor','3ª menor','3ª mayor','4ª justa','tritono','5ª justa','6ª menor','6ª mayor','7ª menor','7ª mayor'];
const INTERVALS_EN=['unison','minor 2nd','major 2nd','minor 3rd','major 3rd','perfect 4th','tritone','perfect 5th','minor 6th','major 6th','minor 7th','major 7th'];
const intervalName=i=>tr(INTERVALS[i],INTERVALS_EN[i]);
const ROMAN=['I','♭II','II','♭III','III','IV','♯IV','V','♭VI','VI','♭VII','VII'];
const SEVENTHS=new Set(['7','maj7','m7','m(maj7)','m7♭5','dim7','7♯5','maj7♯5','7♭5']);

// [symbol, alternative, Spanish name, English name, formula, rarity]
const TYPES=[
 ['', '', 'mayor', 'major', '1 3 5', 0],
 ['m', '-', 'menor', 'minor', '1 b3 5', 0],
 ['dim', '°', 'disminuido', 'diminished', '1 b3 b5', .3],
 ['aug', '+', 'aumentado', 'augmented', '1 3 #5', .35],
 ['sus2', '', 'suspendido de 2ª', 'suspended 2nd', '1 2 5', .45],
 ['sus4', 'sus', 'suspendido de 4ª', 'suspended 4th', '1 4 5', .4],
 ['5', '', 'quinta (power chord)', 'fifth (power chord)', '1 5', .5],
 ['6', '', 'sexta', 'sixth', '1 3 5 6', .45],
 ['m6', '', 'menor sexta', 'minor sixth', '1 b3 5 6', .5],
 ['6/9', '', 'seis nueve', 'six nine', '1 3 5 6 9', .6],
 ['m6/9', '', 'menor seis nueve', 'minor six nine', '1 b3 5 6 9', .7],
 ['7', '', 'séptima de dominante', 'dominant seventh', '1 3 5 b7', .2],
 ['maj7', 'Δ7', 'séptima mayor', 'major seventh', '1 3 5 7', .2],
 ['m7', '-7', 'menor séptima', 'minor seventh', '1 b3 5 b7', .2],
 ['m(maj7)', 'mΔ7', 'menor con séptima mayor', 'minor major seventh', '1 b3 5 7', .6],
 ['m7♭5', 'ø', 'semidisminuido', 'half-diminished', '1 b3 b5 b7', .35],
 ['dim7', '°7', 'disminuido séptima', 'diminished seventh', '1 b3 b5 bb7', .4],
 ['7♯5', 'aug7', 'séptima aumentada', 'augmented seventh', '1 3 #5 b7', .6],
 ['maj7♯5', '+Δ7', 'séptima mayor aumentada', 'augmented major seventh', '1 3 #5 7', .7],
 ['7♭5', '', 'séptima con 5ª disminuida', 'seventh flat five', '1 3 b5 b7', .7],
 ['7sus4', '', 'séptima suspendida de 4ª', 'seventh suspended 4th', '1 4 5 b7', .5],
 ['7sus2', '', 'séptima suspendida de 2ª', 'seventh suspended 2nd', '1 2 5 b7', .8],
 ['add9', '', 'con 9ª añadida', 'added 9th', '1 3 5 9', .45],
 ['m(add9)', '', 'menor con 9ª añadida', 'minor added 9th', '1 b3 5 9', .55],
 ['add11', '', 'con 11ª añadida', 'added 11th', '1 3 5 11', .7],
 ['9', '', 'novena de dominante', 'dominant ninth', '1 3 5 b7 9', .4],
 ['maj9', 'Δ9', 'novena mayor', 'major ninth', '1 3 5 7 9', .45],
 ['m9', '-9', 'menor novena', 'minor ninth', '1 b3 5 b7 9', .45],
 ['m(maj9)', '', 'menor con 9ª y 7ª mayor', 'minor major ninth', '1 b3 5 7 9', .8],
 ['7♭9', '', 'séptima con 9ª menor', 'seventh flat nine', '1 3 5 b7 b9', .6],
 ['7♯9', '', 'séptima con 9ª aumentada', 'seventh sharp nine', '1 3 5 b7 #9', .6],
 ['9sus4', '', 'novena suspendida de 4ª', 'ninth suspended 4th', '1 4 5 b7 9', .7],
 ['11', '', 'oncena', 'eleventh', '1 3 5 b7 9 11', .8],
 ['m11', '-11', 'menor oncena', 'minor eleventh', '1 b3 5 b7 9 11', .6],
 ['maj11', '', 'oncena mayor', 'major eleventh', '1 3 5 7 9 11', .9],
 ['7♯11', '', 'séptima con 11ª aumentada', 'seventh sharp eleven', '1 3 5 b7 #11', .7],
 ['9♯11', '', 'novena con 11ª aumentada', 'ninth sharp eleven', '1 3 5 b7 9 #11', .8],
 ['maj7♯11', 'Δ7♯11', 'séptima mayor con 11ª aumentada', 'major seventh sharp eleven', '1 3 5 7 #11', .7],
 ['13', '', 'trecena', 'thirteenth', '1 3 5 b7 9 13', .6],
 ['m13', '', 'menor trecena', 'minor thirteenth', '1 b3 5 b7 9 13', .7],
 ['maj13', 'Δ13', 'trecena mayor', 'major thirteenth', '1 3 5 7 9 13', .75],
 ['7♭13', '', 'séptima con 13ª menor', 'seventh flat thirteen', '1 3 5 b7 b13', .8],
 ['13♯11', '', 'trecena con 11ª aumentada', 'thirteenth sharp eleven', '1 3 5 b7 9 #11 13', .85],
 ['7(no3)', '', 'séptima sin 3ª', 'seventh no third', '1 5 b7', .9],
].map(([sym,alt,es,en,f,rank])=>{
  const degs=f.split(' ').map(parseDeg);
  const big=degs.length>=4, hasExt=degs.some(d=>d.n>=11);
  degs.forEach(d=>{
    if(d.label==='5' && (big || f==='1 3 5' || f==='1 b3 5')) d.opt=true;
    if(d.label==='9' && hasExt) d.opt=true;
  });
  // names are getters, so the tables follow the interface language without being rebuilt
  return {sym,alt,get name(){return tr(es,en);},f,rank,degs,q:quality(sym)};
});
function parseDeg(s){
  const m=s.match(/^(bb|b|#)?(\d+)$/);
  const acc={bb:-2,b:-1,'#':1}[m[1]]||0, n=+m[2];
  const base={1:0,2:2,3:4,4:5,5:7,6:9,7:11,9:14,11:17,13:21}[n];
  return {label:s.replace('bb','𝄫').replace('b','♭').replace('#','♯'),n,acc,pc:((base+acc)%12+12)%12,step:(n>7?n-7:n)-1,opt:false};
}
function quality(sym){
  if(sym==='dim'||sym==='dim7') return 'dim';
  if(sym==='m7♭5') return 'hdim';
  if(sym==='aug'||sym==='7♯5'||sym==='maj7♯5') return 'aug';
  if(/^m(?!aj)/.test(sym)) return 'min';
  if(/sus|^5$/.test(sym)) return 'sus';
  if(/^(7|9|11|13)/.test(sym)) return 'dom';
  return 'maj';
}

const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const fmtB=t=>{const x=(+(t/T).toFixed(3)).toString(); return tr(x.replace('.',','),x);};
const numB=t=>(+(t/T).toFixed(4)).toString();
const sigOf=a=>[...a].sort((x,y)=>x-y).join(',');
// Per-instrument shaping applied on top of a feeling. Heuristic starting points.
// min/max: velocity window · sens: share of the feeling's contrast · accent/human: share of those parts (%)
// lowTrim/highTrim: velocity removed per octave below lowPivot / above highPivot (MIDI numbers)
const INST_ROWS=[
 // key, group, label, min, max, sens, accent, human, lowTrim, lowPivot, highTrim, highPivot
 ['generico','General','Genérico (sin ajuste)',        1,127,100,100,100,0,36,0,96],
 ['piano','Teclados','Piano',                          20,120,100,100,100,3,40,2,96],
 ['organo','Teclados','Órgano',                        70,112,100,40,50,8,48,4,84],
 ['clavecin','Teclados','Clavecín',                    80,110,100,40,40,4,41,4,89],
 ['pianofm','Teclados','Piano FM / eléctrico',         30,118,100,90,90,3,40,4,91],
 ['pad','Teclados','Synth y pad',                      60,105,100,20,40,8,48,5,84],
 ['cuerdas','Cuerdas','Cuerdas en sección (legato)',   35,118,100,60,80,4,43,5,88],
 ['spiccato','Cuerdas','Cuerdas spiccato / staccato',  40,122,110,120,90,3,43,5,88],
 ['gravescuerda','Cuerdas','Cellos y contrabajos',     40,118,100,70,80,3,31,6,67],
 ['cuerdasolista','Cuerdas','Cuerda solista',          30,120,100,70,90,2,55,4,93],
 ['arpa','Cuerdas','Arpa',                             30,120,110,100,110,3,36,3,91],
 ['pulsado','Guitarras y graves','Guitarra',           30,120,110,100,120,3,40,3,88],
 ['bajo','Guitarras y graves','Bajo',                  60,120,100,100,80,2,28,6,60],
 ['octobajo','Guitarras y graves','Octobajo / sub',    70,115,100,80,60,0,24,8,55],
 ['flauta','Maderas','Flauta y ocarina',               40,115,100,70,80,6,60,5,93],
 ['maderas','Maderas','Oboe, clarinete y fagot',       40,115,100,70,80,4,46,5,84],
 ['saxos','Maderas','Saxos',                           45,120,100,90,90,4,44,5,80],
 ['metales','Metales','Trompetas',                     40,122,110,110,80,4,52,6,84],
 ['cornos','Metales','Cornos',                         35,115,100,70,70,4,41,6,77],
 ['metalesgraves','Metales','Trombones y tuba',        45,122,100,100,70,3,28,6,65],
 ['bateria','Percusión','Batería y percusión',         30,127,110,130,100,0,24,0,120],
 ['percorq','Percusión','Timbales, gran casa y gong',  20,127,120,100,80,0,24,0,120],
 ['mallets','Percusión','Campanas y mallets',          30,115,100,90,80,0,60,8,96],
 ['voces','Voces','Coro',                              40,115,100,50,70,5,48,5,84],
 ['lead','Lead y color','Lead',                        70,120,100,80,60,4,48,4,96],
 ['chiptune','Lead y color','Chiptune',                95,110,100,20,10,0,24,0,120],
 ['fx','Lead y color','FX e impactos',                 1,127,100,50,50,0,24,0,120],
];
const INST_GROUP_EN={'General':'General','Teclados':'Keyboards','Cuerdas':'Strings','Guitarras y graves':'Guitars and low end','Maderas':'Woodwinds','Metales':'Brass','Percusión':'Percussion','Voces':'Voices','Lead y color':'Lead and color'};
const INST_EN={generico:'Generic (no adjustment)',piano:'Piano',organo:'Organ',clavecin:'Harpsichord',pianofm:'FM / electric piano',pad:'Synth and pad',
  cuerdas:'Section strings (legato)',spiccato:'Spiccato / staccato strings',gravescuerda:'Cellos and double basses',cuerdasolista:'Solo string',arpa:'Harp',
  pulsado:'Guitar',bajo:'Bass',octobajo:'Octobass / sub',flauta:'Flute and ocarina',maderas:'Oboe, clarinet and bassoon',saxos:'Saxophones',
  metales:'Trumpets',cornos:'Horns',metalesgraves:'Trombones and tuba',bateria:'Drums and percussion',percorq:'Timpani, bass drum and gong',mallets:'Bells and mallets',
  voces:'Choir',lead:'Lead',chiptune:'Chiptune',fx:'FX and impacts'};
const INSTRUMENTS=Object.fromEntries(INST_ROWS.map(([k,group,label,min,max,sens,accent,human,lowTrim,lowPivot,highTrim,highPivot])=>[k,{get group(){return tr(group,INST_GROUP_EN[group]);},get label(){return tr(label,INST_EN[k]);},p:{min,max,sens,accent,human,lowTrim,lowPivot,highTrim,highPivot}}]));
// Pattern-name keywords (template channel names) → instrument; first match wins, so specific names go first
const INST_MATCH=[['percorq',/timbal|gran casa|gong|perc\.? orq/],['bateria',/bater|drum|bombo|caja|hi.?hat|platill|\btoms?\b|pandereta|maraca|conga|caj[oó]n|percusi[oó]n/],
  ['mallets',/campana|glock|xil[oó]f|mallet|celesta|marimba|vibraf/],['octobajo',/octobajo|\bsub\b/],['gravescuerda',/cello|contrabaj/],['bajo',/bajo|bass/],['pulsado',/guitarra|guitar/],['arpa',/arpa|harp/],
  ['organo',/[oó]rgano|organ/],['clavecin',/clavec|harpsi/],['pianofm',/\bfm\b|el[eé]ctrico|rhodes|wurli/],['piano',/piano/],['pad',/\bpad|colch[oó]n|synth/],
  ['spiccato',/spic|stacc|pizz/],['cuerdasolista',/viol[ií]n solista|cuerda solista/],['cuerdas',/viol|cuerda|string/],
  ['flauta',/flaut|ocarin|piccolo/],['saxos',/saxo/],['maderas',/oboe|clarinet|fagot|bassoon|corno ingl/],
  ['cornos',/corno|horn/],['metalesgraves',/trombon|tuba/],['metales',/trompet|metal|brass/],
  ['voces',/coro|choir|aahs?|oohs?/],['chiptune',/chip|8.?bit/],['lead',/\blead/],['fx',/\bfx\b|impact|efecto/]];
function guessInst(name){ const s=String(name||'').toLowerCase(); for(const [k,re] of INST_MATCH) if(re.test(s)) return k; return null; }
const IN_KEYS=['min','max','sens','accent','human','lowTrim','lowPivot','highTrim','highPivot'];
const instDefaults=key=>({preset:key,...INSTRUMENTS[key].p});
const freq=m=>440*Math.pow(2,(m-69)/12);
// Octave label conventions for the same MIDI number: scientific C4 = 60, FL Studio C5 = 60, Yamaha/Ableton C3 = 60
const OCT_CONV={sci:{off:0,get name(){return tr('científica (C4 = MIDI 60)','scientific (C4 = MIDI 60)');}},fl:{off:1,name:'FL Studio (C5 = MIDI 60)'},yam:{off:-1,name:'Yamaha / Ableton (C3 = MIDI 60)'}};

export { AUTO, BLACK, FLAT, HIGH, INSTRUMENTS, INST_ROWS, INTERVALS, IN_KEYS, LATIN, LETTERS, LOW, NAT, OCT_CONV, ROMAN, SEVENTHS, SHARP, T, TYPES, fmtB, freq, guessInst, instDefaults, intervalName, numB, sigOf, uid };
