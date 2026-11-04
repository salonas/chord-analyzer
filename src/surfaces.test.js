// The same spelling on every surface (THEORY.md, «Escritura de notas» and «La tonalidad manda sobre la preferencia ♯/♭»; BRIMSTONE,
// 4 Nov 2026): for every chord of the lane, its name in the lane, in the exported text, in the .mid marker and in the inspector, and
// the letter of every chip of the inspector against the note the text writes, with Auto, ♯ and ♭. The inspector is read through the
// pure functions renderActive draws with (activeCands, spellActive, candSymbol), with the chord picked in the lane.
import fs from 'node:fs';
import { analyzeProgression, candSymbol } from './analysis.js';
import { harmonySegs } from './harmony.js';
import { ascii, midiFile } from './midi.js';
import { EXAMPLE, normProg, segStep } from './model.js';
import { activeCands, spellActive } from './panel.js';
import { progText } from './text.js';

const T = 96;
const PREFS = ['auto', 'sharp', 'flat'].map(accPref => ({ naming: 'letters', accPref, octConv: 'sci', midiShift: 0 }));
const LET = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiOf = s => { const m = s.match(/^([A-G])((?:♯|♭)*)(-?\d+)$/); return m ? 12 * (+m[3] + 1) + LET[m[1]] + [...m[2]].reduce((x, c) => x + (c === '♯' ? 1 : -1), 0) : null; };
const name = n => 'CDEFGAB'[n.l] + ['♭♭', '♭', '', '♯', '♯♯'][n.a + 2] + (n.oct ?? '');
const pattern = (id, notes) => normProg({ id, name: id, beats: 4, notes: notes.map(([m, s, l, v], i) => ({ id: id + i, m, s: s * T, l: l * T, v: v || 100 })), names: {} });
const B = JSON.parse(fs.readFileSync(new URL('./test/fixtures/brimstone.json', import.meta.url), 'utf8'));
const blocks = (chords, tune = []) => { let t = 0; const out = []; chords.forEach(([ns, b]) => { ns.forEach(m => out.push([m, t, b])); t += b; }); return [...out, ...tune]; };
const PATTERNS = {
  ...Object.fromEntries(Object.entries(B).filter(([k]) => k !== '_meta').map(([k, v]) => [k, pattern(k, v)])),
  // vii°⁶₅/V named Adim7, with F♯ in the tune: the reading respells its notes from F♯ (V06 of the probe)
  'Adim7 = vii°⁶₅/V con melodía': pattern('v06', blocks([[[48, 52, 55], 4], [[45, 48, 51, 54], 4], [[43, 47, 50], 4], [[48, 52, 55], 4]], [[78, 4, 4], [79, 8, 4], [84, 12, 4]])),
  // the common-tone dim7, C D♯ F♯ A between two C chords (C25)
  '♯ii°7': pattern('c25', blocks([[[48, 52, 55], 4], [[48, 51, 54, 57], 4], [[48, 52, 55], 4]])),
  // a German sixth under a C of the tune (J46)
  'Ger⁺⁶ con melodía': pattern('j46', blocks([[[33, 45, 48, 52], 4], [[29, 41, 45, 51], 4], [[28, 40, 44, 47], 4], [[33, 45, 48, 52], 4]], [[72, 0, 4], [72, 4, 2], [75, 6, 2], [76, 8, 4], [69, 12, 4]])),
  'turnaround del ejemplo': EXAMPLE().patterns[0],
};
const markersOf = bytes => { const out = []; for (let i = 0; i < bytes.length - 3; i++) if (bytes[i] === 0xFF && bytes[i + 1] === 0x06) { const n = bytes[i + 2]; out.push(String.fromCharCode(...bytes.slice(i + 3, i + 3 + n))); i += 2 + n; } return out; };

function differences(p, prefs) {
  const out = [], S = harmonySegs(p), A = analyzeProgression(S.map(s => segStep(p, s)), prefs);
  const txt = progText(p, prefs), L = txt.split('\n'), marks = markersOf(midiFile(p, 90, prefs).bytes);
  const lines = L.filter(l => /^\d+\. /.test(l)).map(l => l.split(' | '));
  const h = L.findIndex(l => /^# (Melodía|Voz superior):/.test(l)), tune = [];
  if (h >= 0) for (let j = h + 1; j < L.length && !L[j].startsWith('#'); j++) tune.push(L[j].split(' | '));
  if (lines.length !== S.length) out.push(`${lines.length} acordes en el texto y ${S.length} en la franja`);
  S.forEach((seg, i) => {
    const r = A.rs[i], lane = r.label, c = lines[i] || [''];
    const text = c[0].replace(/^\d+\. /, ''), plain = text.replace(/\(5\)/, '5').replace(/^nota: .*/, lane);
    if (plain !== lane) out.push(`acorde ${i + 1}: franja «${lane}», texto «${text}»`);
    if (marks[i] !== ascii(lane)) out.push(`acorde ${i + 1}: franja «${lane}», marca «${marks[i]}»`);
    // the inspector as renderActive shows a chord picked in the lane (st.src = 'seg', notes unchanged)
    const notes = seg.notes, orn = r.orn || [];
    const cands = activeCands(notes, null, orn.length ? orn : r.ornAlt || [], !orn.length, r.c);
    const pick = (nm => { const k = nm ? cands.findIndex(x => x.root === nm.root && x.type.sym === nm.sym) : 0; return k < 0 ? 0 : k; })(p.names[seg.sig]);
    const cur = cands[pick];
    if (!cur) return;
    const { sp, spelled } = spellActive(notes, cur, prefs, A.key, r), sy = candSymbol(cur, sp, prefs);
    const aug = r.aug6 && r.c && cur.root === r.c.root && cur.type.sym === r.c.type.sym;
    const insp = aug ? r.label : sy.main + sy.slash;
    if (insp !== lane) out.push(`acorde ${i + 1}: franja «${lane}», inspector «${insp}»`);
    // the notes the text writes for this chord: a block lists its notes; otherwise its voices, added notes, bass line and the tune over it
    const names = new Map(), put = s => { const m = midiOf(s); if (m != null) names.set(m, s); };
    let a = 0, b = 0;
    if (/^[\d ]+$/.test(c[3] || '')) c[2].split(' ').forEach(put);
    else if (c[3]) {
      [a, b] = c[2].split('–').map(Number);
      c[3].replace(/\(\+(.*)\)$/, (_, x) => { x.split(' · ').forEach(t => put(t.split(' ')[0].replace('+', ''))); return ''; }).split(' ').forEach(put);
      c[4].split(' → ').forEach(t => put(t.replace(/ \(.*\)$/, '')));
    }
    tune.forEach(t => { const s = +t[1], l = +t[2]; if (s < b && s + l > a) t[0].split(' (')[0].split('+').forEach(put); });
    spelled.forEach(n => {
      const w = names.get(n.midi);
      if (w && w !== name(n)) out.push(`acorde ${i + 1} (${lane}): inspector ${name(n)}, texto ${w}`);
    });
  });
  return out;
}

describe('the same spelling in the lane, the text, the .mid markers and the inspector', () => {
  for (const [id, p] of Object.entries(PATTERNS)) for (const prefs of PREFS) {
    it(`${id}, ${prefs.accPref}`, () => { expect(differences(p, prefs)).toEqual([]); });
  }
  it('writes the same with Auto, ♯ and ♭ in a key: the text and the markers of BRIMSTONE', () => {
    for (const k of Object.keys(B).filter(k => k !== '_meta')) {
      const p = PATTERNS[k], [auto, sharp, flat] = PREFS.map(prefs => [progText(p, prefs), markersOf(midiFile(p, 90, prefs).bytes).join(' | ')]);
      expect(sharp).toEqual(auto);
      expect(flat).toEqual(auto);
    }
  });
});
