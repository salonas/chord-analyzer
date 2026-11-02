import { analyze, analyzeProgression, candSymbol, spellCandidate } from './analysis.js';
import { setLang } from './i18n.js';
import { parseText } from './text.js';
import { PREFS } from './test/helpers.js';

const inEnglish = f => { setLang('en'); try { return f(); } finally { setLang('es'); } };
const run = chords => analyzeProgression(chords.map(notes => ({ notes })), PREFS);
const name = notes => { const c = analyze(notes, null)[0], sy = candSymbol(c, spellCandidate(c, notes, PREFS), PREFS); return sy.main + sy.slash; };
const first = txt => parseText(txt, PREFS).projects[0].patterns[0].steps[0].notes;

// F18: the patterns are also looked for in the other tonality
describe('patterns in the other tonality', () => {
  const royal = [[41, 45, 48], [43, 47, 50], [52, 55, 59], [45, 48, 52]];
  it('finds the royal road in C when A minor was chosen, and says in which key', () => {
    const A = run(royal);
    expect(A.key).toMatchObject({ tonic: 9, mode: 'minor' });
    expect(A.found.map(f => f.name)).toContain('Royal road (J-pop) (en C mayor)');
    expect(inEnglish(() => run(royal).found.map(f => f.name))).toContain('Royal road (J-pop) (in C major)');
  });
  it('reads the loop of G D Em C also from E minor', () => {
    expect(run([[43, 47, 50], [50, 54, 57], [52, 55, 59], [48, 52, 55]]).found.map(f => f.name)).toContain('Épica i–♭VI–♭III–♭VII (en E menor)');
  });
  it('does not repeat a pattern the main key already found', () => {
    const names = run([[48, 52, 55], [53, 57, 60], [43, 47, 50], [48, 52, 55]]).found.map(f => f.name);
    expect(names.filter(n => n.startsWith('Cadencia completa')).length).toBe(1);
    expect(names.some(n => /Cadencia completa.*\(en /.test(n))).toBe(false);
  });
});

// C12: double accidentals, lowercase, the German H and what could not be read
describe('reading note names', () => {
  it('reads 𝄪 and 𝄫', () => {
    expect(first('F𝄪4')).toEqual([67]);
    expect(first('B𝄫3')).toEqual([57]);
  });
  it('reads lowercase letters, flats and solfège', () => {
    expect(first('c4 e4 g4')).toEqual([60, 64, 67]);
    expect(first('ab4 bb3 fx4')).toEqual([68, 58, 67]);
    expect(first('sol4 do4')).toEqual([67, 60]);
  });
  it('reads the German H as B natural', () => expect(first('H3 D4 F#4')).toEqual([59, 62, 66]));
  it('does not read the d9 of Cadd9 as a note', () => expect(first('Cadd9 C3 E3 G3 D4')).toEqual([48, 52, 55, 62]));
  it('reports the tokens that look like notes and were not read', () => {
    const r = parseText('H3 D4 F#4 J4 C-1 Es3', PREFS);
    expect(r.projects[0].patterns[0].steps[0].notes).toEqual([59, 62, 66]);
    expect(r.unread).toEqual(['J4', 'C-1', 'Es3']);
  });
  it('reports nothing when everything was read', () => {
    expect(parseText('C4 E4 G4', PREFS).unread).toEqual([]);
    expect(parseText('Cadd9 C3 E3 G3 D4', PREFS).unread).toEqual([]);
  });
  it('keeps the unread tokens of every line, once each', () => expect(parseText('C4 E4 J4\nG4 B4 J4 K2', PREFS).unread).toEqual(['J4', 'K2']));
});

// C9: the lydian major ninth and the altered dominants
describe('chord dictionary', () => {
  it('names the lydian major ninth', () => expect(name([48, 52, 55, 59, 62, 66])).toBe('Cmaj9♯11'));
  it.each([
    ['7♯5♯9', [48, 52, 58, 63, 68], 'C7♯5♯9'],
    ['7♭5♭9', [48, 52, 54, 58, 61], 'C7♭5♭9'],
    ['7♯5♭9', [48, 52, 56, 58, 61], 'C7♯5♭9'],
    ['7♭9♯11', [48, 52, 55, 58, 61, 66], 'C7♭9♯11'],
    ['13♭9', [48, 52, 55, 58, 61, 69], 'C13♭9'],
  ])('names %s', (_, notes, want) => expect(name(notes)).toBe(want));
  it('does not take a plain chord for an altered one', () => {
    expect(name([48, 52, 55, 58])).toBe('C7');
    expect(name([48, 52, 55, 58, 62])).toBe('C9');
    expect(name([48, 52, 55, 59, 62])).toBe('Cmaj9');
  });
});

// The ♭VII → i cadence in minor
describe('cadence ♭VII → i', () => {
  const dm = [[50, 53, 57], [43, 47, 50], [48, 52, 55], [50, 53, 57]];
  it('says ♭VII → i in minor, without backdoor or Mixolydian', () => {
    expect(run(dm).cad).toBe('Cadencia ♭VII → i');
    expect(inEnglish(() => run(dm).cad)).toBe('♭VII → i cadence');
  });
  it('keeps the backdoor cadence in major', () => {
    expect(run([[48, 52, 55], [53, 57, 60], [46, 50, 53], [48, 52, 55]]).cad).toContain('backdoor');
  });
});
