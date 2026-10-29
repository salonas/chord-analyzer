// FL Studio piano roll script (.pyscript). FL's own slide and portamento flags cannot travel in a .mid, so
// this script, run from the piano roll's Scripts menu, draws the pattern with them (flpianoroll API).
// FL calls apply() again on every dialog change to preview it, so apply() clears before drawing.
import { isDrum } from './model.js';

const FL_SCRIPT_DIR='Documents\\Image-Line\\FL Studio\\Settings\\Piano roll scripts';
const REPLACE='Replace the notes in this piano roll';

// p: the pattern; prefs.midiShift moves every note as in the .mid. Returns {text, skipped}: notes out of
// MIDI range are left out, as in the .mid
function flScript(p,prefs){
  const sh=prefs.midiShift||0, py=b=>b?'True':'False', drum=isDrum(p);
  let skipped=0;
  const rows=[...p.notes].sort((a,b)=>a.s-b.s||a.m-b.m).flatMap(n=>{
    const m=n.m+sh, g=drum?'':n.g||'';
    if(m<0||m>127){ skipped++; return []; }
    return [`    (${m}, ${n.s}, ${n.l}, ${n.v||100}, ${py(g==='s')}, ${py(g==='p')}),`];
  });
  const text=[
    `# Salonas Chord Analyzer: ${String(p.name||'Pattern').replace(/[\r\n]+/g,' ')}`,
    '# Run it from the piano roll\'s Scripts menu: it draws the pattern with FL\'s own slide and portamento notes.',
    '# FL slides only sound with FL\'s native instruments, not with VST plugins such as sforzando.',
    'import flpianoroll as flp',
    '',
    `NAME = ${JSON.stringify(p.name||'Pattern')}`,
    'TPB = 96  # ticks per beat in NOTES',
    '# (key, start, length, velocity 1-127, slide, portamento)',
    'NOTES = [',
    ...rows,
    ']',
    '',
    '',
    'def createDialog():',
    '    form = flp.ScriptDialog(NAME, \'Draws the pattern with its slide and portamento notes.\')',
    `    form.addInputCheckbox('${REPLACE}', True)`,
    '    return form',
    '',
    '',
    'def apply(form):',
    `    if form.getInputValue('${REPLACE}'):`,
    '        flp.score.clearNotes(True)',
    '    k = flp.score.PPQ / TPB',
    '    for key, start, length, vel, slide, porta in NOTES:',
    '        note = flp.Note()',
    '        note.number = key',
    '        note.time = round(start * k)',
    '        note.length = max(1, round(length * k))',
    '        note.velocity = vel / 127',
    '        note.slide = slide',
    '        note.porta = porta',
    '        flp.score.addNote(note)',
    '',
  ].join('\n');
  return {text,skipped};
}

export { FL_SCRIPT_DIR, flScript };
