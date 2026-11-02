// The key changes the Rock Corpus annotates, on the development songs only (F11): how many there are, of what kind, how long the
// new region lasts, whether a chord of both keys stands at the change (pivot) or not (direct), and what confirms the new key
// (an authentic cadence V → I in it, or starting on its tonic). The corpus gives the tonic of each region, not its mode; the mode
// of a region is read from the quality of its tonic chord (I or i) where it has one, and is major otherwise. Not part of the suite:
//   node tools/modulation-census.mjs [--list]
import { isTest, listJson } from '../src/test/corpus-eval.js';

const list = process.argv.includes('--list');
const PC = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];
const KIND = { 1: 'semitono arriba', 2: 'tono arriba', 3: 'tercera menor arriba', 4: 'tercera mayor arriba', 5: 'cuarta arriba (subdominante)', 6: 'tritono', 7: 'quinta arriba (dominante)', 8: 'sexta menor arriba', 9: 'sexta mayor arriba (tercera menor abajo)', 10: 'tono abajo', 11: 'semitono abajo' };
const count = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);
const show = (title, m, total) => { console.log(`\n${title}`); [...m].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${(100 * n / total).toFixed(1).padStart(5)} %  ${k}`)); };
const median = xs => { const a = [...xs].sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null; };
const pctl = (xs, q) => { const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };

const modeOf = (chords, r) => {
  const t = chords.slice(r.from, r.to + 1).find(c => /^[Ii](?![iIvV])/.test(c.token) && c.notes.length >= 3 && c.notes[0] % 12 === r.tonic);
  if (!t) return 'major';
  const third = t.notes.map(m => (m - r.tonic + 12) % 12);
  return third.includes(3) && !third.includes(4) ? 'minor' : 'major';
};
const scale = (tonic, mode) => (mode === 'minor' ? MIN : MAJ).map(x => (x + tonic) % 12);
const fits = (c, sc) => c.notes.every(m => sc.includes(m % 12));
// V (major triad or dominant seventh on the 5th) followed by the tonic triad, inside the region
const cadence = (chords, r) => {
  for (let i = r.from; i < r.to; i++) {
    const a = chords[i], b = chords[i + 1], ra = (a.notes[0] - r.tonic + 120) % 12, rb = (b.notes[0] - r.tonic + 120) % 12;
    const maj = a.notes.some(m => (m - a.notes[0] + 120) % 12 === 4);
    if (ra === 7 && maj && rb === 0) return true;
  }
  return false;
};

const songs = listJson('rock').filter(s => !isTest(s.song));
let analyses = 0, withChange = 0, changes = 0, agreeSongs = 0, songsWithChange = 0;
const kinds = new Map(), junction = new Map(), confirm = new Map(), shape = new Map(), lenChords = [], lenBeats = [], share = [], byCount = new Map();
const rows = [], perAnalysis = [];
for (const song of songs) {
  const an = Object.entries(song.analyses);
  const mods = an.map(([, a]) => a.regions.length > 1);
  if (mods.some(Boolean)) songsWithChange++;
  if (mods.length === 2 && mods[0] === mods[1]) agreeSongs++;
  for (const [who, a] of an) {
    analyses++;
    if (a.regions.length < 2) continue;
    withChange++;
    count(byCount, `${a.regions.length - 1} cambio${a.regions.length > 2 ? 's' : ''}`);
    const total = a.chords.reduce((s, c) => s + c.dur, 0);
    const modes = a.regions.map(r => modeOf(a.chords, r));
    const tonics = a.regions.map(r => r.tonic);
    const back = a.regions.slice(2).some((r, i) => r.tonic === tonics[i]);
    const mine = []; perAnalysis.push(mine);
    count(shape, a.regions.length === 2 ? 'A → B (no vuelve)' : back ? 'A → B → A… (vuelve a una tonalidad anterior)' : 'A → B → C… (sin volver)');
    for (let k = 1; k < a.regions.length; k++) {
      changes++;
      const p = a.regions[k - 1], r = a.regions[k], d = (r.tonic - p.tonic + 12) % 12;
      const rel = (modes[k - 1] === 'major' && modes[k] === 'minor' && d === 9) || (modes[k - 1] === 'minor' && modes[k] === 'major' && d === 3);
      const par = d === 0;
      count(kinds, par ? 'misma tónica, otro modo (homónima)' : rel ? 'relativa' : KIND[d]);
      const n = r.to - r.from + 1, beats = a.chords.slice(r.from, r.to + 1).reduce((s, c) => s + c.dur, 0);
      lenChords.push(n); lenBeats.push(beats); share.push(100 * beats / total);
      const scOld = scale(p.tonic, modes[k - 1]), scNew = scale(r.tonic, modes[k]);
      const last = a.chords[r.from - 1], first = a.chords[r.from];
      const pivot = fits(last, scOld) && fits(last, scNew);
      const firstOld = fits(first, scOld);
      count(junction, pivot ? 'pivote: el último acorde de la región anterior es de las dos tonalidades' : firstOld ? 'sin pivote, pero el primer acorde nuevo es de la tonalidad anterior' : 'directa: ni el último acorde viejo es de la nueva ni el primero nuevo de la vieja');
      const cad = cadence(a.chords, r), startT = (first.notes[0] - r.tonic + 120) % 12 === 0;
      mine.push({ n, beats, cad, startT });
      count(confirm, cad && startT ? 'cadencia V → I y empieza en su tónica' : cad ? 'cadencia V → I (no empieza en su tónica)' : startT ? 'empieza en su tónica, sin V → I' : 'ni cadencia V → I ni empieza en su tónica');
      rows.push(`${song.song} (${who}) región ${k + 1}: ${PC[p.tonic]}${modes[k - 1] === 'minor' ? 'm' : ''} → ${PC[r.tonic]}${modes[k] === 'minor' ? 'm' : ''}, ${n} acordes, ${beats} tiempos (${(100 * beats / total).toFixed(0)} % de la canción), ${pivot ? 'pivote ' + last.token : 'sin pivote'}, ${cad ? 'V → I' : 'sin V → I'}; ${a.chords.slice(Math.max(0, r.from - 3), r.from).map(c => c.token).join(' ')} | ${a.chords.slice(r.from, r.from + 5).map(c => c.token).join(' ')}`);
    }
  }
}
console.log(`desarrollo del Rock Corpus: ${songs.length} canciones, ${analyses} análisis`);
console.log(`análisis con cambio de tonalidad: ${withChange} de ${analyses} (${(100 * withChange / analyses).toFixed(1)} %); sin cambio: ${analyses - withChange}`);
console.log(`canciones con cambio en al menos un análisis: ${songsWithChange} de ${songs.length}; canciones donde los dos analistas coinciden en si hay cambio: ${agreeSongs}`);
console.log(`cambios: ${changes}`);
show('cambios por análisis', byCount, withChange);
show('forma', shape, withChange);
show('tipo de cambio (intervalo de la tónica nueva sobre la anterior)', kinds, changes);
show('el cambio', junction, changes);
show('qué confirma la región nueva', confirm, changes);
console.log(`\nduración de la región nueva: acordes mediana ${median(lenChords)} (p10 ${pctl(lenChords, .1)}, p90 ${pctl(lenChords, .9)}; mín ${Math.min(...lenChords)}, máx ${Math.max(...lenChords)}); tiempos mediana ${median(lenBeats)} (p10 ${pctl(lenBeats, .1)}, p90 ${pctl(lenBeats, .9)}); parte de la canción mediana ${median(share).toFixed(0)} %`);
const under = t => lenChords.filter(x => x < t).length;
console.log(`regiones nuevas de menos de 4 acordes: ${under(4)}; de menos de 8: ${under(8)}; de menos de 16 tiempos: ${lenBeats.filter(x => x < 16).length}`);
// the goal counts analyses, not changes: how many of the analyses with a change keep at least one under each requirement
console.log(`\nanálisis con al menos un cambio que cumple (de ${withChange}; la meta es la mitad, ${Math.ceil(withChange / 2)}):`);
for (const [name, ok] of [
  ['cualquiera', () => true],
  ['región nueva de ≥ 4 acordes', x => x.n >= 4], ['≥ 8 acordes', x => x.n >= 8], ['≥ 16 tiempos', x => x.beats >= 16], ['≥ 32 tiempos', x => x.beats >= 32],
  ['con V → I en la región nueva', x => x.cad], ['≥ 16 tiempos y (V → I o empieza en su tónica)', x => x.beats >= 16 && (x.cad || x.startT)],
  ['≥ 16 tiempos y V → I', x => x.beats >= 16 && x.cad], ['≥ 8 acordes y V → I', x => x.n >= 8 && x.cad],
]) console.log(`  ${String(perAnalysis.filter(rs => rs.some(ok)).length).padStart(3)}  ${name}`);
if (list) { console.log(''); rows.forEach(r => console.log(r)); }
