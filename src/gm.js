// General MIDI mode: a track whose .mid sets a program (0xC0) plays the FluidR3 GM soundfont (Frank Wen, MIT),
// as rendered note by note by gleitz/midi-js-soundfonts (MIT; its README: CC BY 3.0 for the renders). The 128 × 88
// notes weigh about 280 MB, so they are not in the repository: each program loads from the CDN the first time it
// sounds, every GM_STEP semitones, and the browser retunes the notes in between. The commit is pinned so files never change.
const GM_BASE='https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@044fab8e1456bfafc5776e86dfd6bb8697149aef/FluidR3_GM/';
// program number → file name, in GM order
const GM_NAMES=[
  'acoustic_grand_piano','bright_acoustic_piano','electric_grand_piano','honkytonk_piano','electric_piano_1','electric_piano_2','harpsichord','clavinet',
  'celesta','glockenspiel','music_box','vibraphone','marimba','xylophone','tubular_bells','dulcimer',
  'drawbar_organ','percussive_organ','rock_organ','church_organ','reed_organ','accordion','harmonica','tango_accordion',
  'acoustic_guitar_nylon','acoustic_guitar_steel','electric_guitar_jazz','electric_guitar_clean','electric_guitar_muted','overdriven_guitar','distortion_guitar','guitar_harmonics',
  'acoustic_bass','electric_bass_finger','electric_bass_pick','fretless_bass','slap_bass_1','slap_bass_2','synth_bass_1','synth_bass_2',
  'violin','viola','cello','contrabass','tremolo_strings','pizzicato_strings','orchestral_harp','timpani',
  'string_ensemble_1','string_ensemble_2','synth_strings_1','synth_strings_2','choir_aahs','voice_oohs','synth_choir','orchestra_hit',
  'trumpet','trombone','tuba','muted_trumpet','french_horn','brass_section','synth_brass_1','synth_brass_2',
  'soprano_sax','alto_sax','tenor_sax','baritone_sax','oboe','english_horn','bassoon','clarinet',
  'piccolo','flute','recorder','pan_flute','blown_bottle','shakuhachi','whistle','ocarina',
  'lead_1_square','lead_2_sawtooth','lead_3_calliope','lead_4_chiff','lead_5_charang','lead_6_voice','lead_7_fifths','lead_8_bass__lead',
  'pad_1_new_age','pad_2_warm','pad_3_polysynth','pad_4_choir','pad_5_bowed','pad_6_metallic','pad_7_halo','pad_8_sweep',
  'fx_1_rain','fx_2_soundtrack','fx_3_crystal','fx_4_atmosphere','fx_5_brightness','fx_6_goblins','fx_7_echoes','fx_8_scifi',
  'sitar','banjo','shamisen','koto','kalimba','bagpipe','fiddle','shanai',
  'tinkle_bell','agogo','steel_drums','woodblock','taiko_drum','melodic_tom','synth_drum','reverse_cymbal',
  'guitar_fret_noise','breath_noise','seashore','bird_tweet','telephone_ring','helicopter','applause','gunshot'
];
const GM_LO=21, GM_HI=108, GM_STEP=4; // the renders go from A0 to C8
const FLATS=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const gmNote=m=>FLATS[m%12]+(Math.floor(m/12)-1);
// the notes a program loads: k is the rendered note, lo-hi the notes it plays retuned
function gmSamples(prog){
  const xs=[];
  for(let k=GM_LO;k<=GM_HI;k+=GM_STEP) xs.push({k,lo:k===GM_LO?0:k-2,hi:k+GM_STEP>GM_HI?127:k+1,url:`${GM_BASE}${GM_NAMES[prog]}-mp3/${gmNote(k)}.mp3`});
  return xs;
}
// «acoustic_grand_piano» → «Acoustic Grand Piano»
const gmName=prog=>GM_NAMES[prog].split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');

export { GM_NAMES, gmName, gmNote, gmSamples };
