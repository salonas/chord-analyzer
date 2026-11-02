import { analyzeProgression, degreeText, pivotTitle, regionTexts } from './analysis.js';
import { setLang } from './i18n.js';
import { PREFS } from './test/helpers.js';

const inEnglish = f => { setLang('en'); try { return f(); } finally { setLang('es'); } };
const run = chords => analyzeProgression(chords.map(notes => ({ notes })), PREFS);
// F11: C F G7 C | Am D7 G D7 G, the pivot Am is vi in C and ii in G
const F11 = [[48, 52, 55], [53, 57, 60], [43, 47, 50, 53], [48, 52, 55], [45, 48, 52], [50, 54, 57, 60], [43, 47, 50], [50, 54, 57, 60], [43, 47, 50]];
// F34: C F G7 C | D G A7 D G A7 D, with no chord in common at the change
const F34 = [[48, 52, 55], [53, 57, 60], [43, 47, 50, 53], [48, 52, 55], [50, 54, 57], [43, 47, 50], [45, 49, 52, 55], [50, 54, 57], [43, 47, 50], [45, 49, 52, 55], [50, 54, 57]];

// F11, modulation: regions confirmed by a cadence, with their pivot (texts approved on 2 Nov 2026)
describe('regions', () => {
  it('reads C then G from the pivot Am, and keeps the key of the whole progression as the main one', () => {
    const A = run(F11);
    expect(A.regions.map(g => [g.from, g.to, g.key.tonic, g.key.mode, g.pivot])).toEqual([[0, 3, 0, 'major', null], [4, 8, 7, 'major', 4]]);
    expect(A.alt).toBeNull();
    expect(degreeText(A.romans[4])).toBe('vi = ii');
    expect(A.romans[5].text).toBe('V7');
    expect(pivotTitle(A.romans[4], PREFS)).toBe('Acorde pivote: vi en C mayor = ii en G mayor');
  });
  it('writes the plaque, the regions and one sentence per change, in both languages', () => {
    const T = regionTexts(run(F11), PREFS);
    expect(T.key).toBe('C mayor → G mayor');
    expect(T.at).toBe('modula en el acorde 5');
    expect(T.line).toBe('acordes 1–4 en C mayor · acordes 5–9 en G mayor (pivote Am: vi en C mayor = ii en G mayor; la confirma D7 → G, V7 → I)');
    expect(T.sheet).toEqual(['Modula en el acorde 5 (Am: vi en C mayor = ii en G mayor); la confirma D7 → G (V7 → I).']);
    expect(T.whys[1].text).toMatch(/^G mayor \(acordes 5–9\): /);
    const E = inEnglish(() => regionTexts(run(F11), PREFS));
    expect(E.line).toBe('chords 1–4 in C major · chords 5–9 in G major (pivot Am: vi in C major = ii in G major; confirmed by D7 → G, V7 → I)');
    expect(E.sheet).toEqual(['Modulates at chord 5 (Am: vi in C major = ii in G major); confirmed by D7 → G (V7 → I).']);
  });
  it('says a direct change has no pivot', () => {
    const T = regionTexts(run(F34), PREFS);
    expect(T.sheet).toEqual(['Modula en el acorde 5, sin acorde pivote (modulación directa); la confirma A7 → D (V7 → I).']);
    expect(T.line).toContain('acordes 5–11 en D mayor (directa; la confirma A7 → D, V7 → I)');
  });
  it('looks for the patterns region by region, and measures the arrival in the key of its region', () => {
    const A = run(F11);
    expect(A.found.map(f => f.name)).toContain('ii–V–I (en G mayor)');
    expect(A.tenCtx[6]).toEqual({ rule: 'arrival', val: -0.15 });
    expect(A.fn[4]).toBe('S');
  });
  it('leaves a brief tonicization and a progression with no cadence elsewhere in one key', () => {
    expect(run([[48, 52, 55], [50, 54, 57, 60], [43, 47, 50], [48, 52, 55]]).regions).toBeUndefined();
    expect(run([[48, 52, 55], [45, 49, 52, 55], [50, 53, 57], [43, 47, 50, 53], [48, 52, 55]]).regions).toBeUndefined();
    expect(regionTexts(run([[48, 52, 55], [43, 47, 50]]), PREFS)).toBeNull();
  });
});
