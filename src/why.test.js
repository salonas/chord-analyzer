import { TYPES } from './data.js';
import { analyze, analyzeProgression, aug6Iv, aug6Text, bookends, melodyText, ornamentText, rankHelp, resolveStep, scoreDetail } from './analysis.js';
import { setLang } from './i18n.js';
import { PREFS } from './test/helpers.js';

const inEnglish = f => { setLang('en'); try { return f(); } finally { setLang('es'); } };
const C = [48, 52, 55], F = [53, 57, 60], G7 = [43, 47, 50, 53], G = [43, 47, 50], Am = [45, 48, 52], Ab = [44, 48, 51];
const run = (chords, durs = []) => analyzeProgression(chords.map((notes, i) => ({ notes, ...(durs[i] ? { dur: durs[i] } : {}) })), PREFS);
const why = (chords, durs) => run(chords, durs).why;

// Row 5 of the audit: why a name of a chord goes first
describe('row 5: the points of a candidate name', () => {
  const cand = (notes, root, sym, locked = null) => analyze(notes, locked).find(c => c.root === root && c.type.sym === sym);
  it('writes the rule of the order from the constants', () => {
    expect(rankHelp()).toBe('Gana el nombre con menos puntos. Suman puntos un bajo que no es la raíz (3 si es la 3ª o la 5ª, 5 si es la 7ª y 7 si es otra nota), cada nota que falta (2) y un tipo de acorde poco común (hasta 0,9). Si eliges tú la raíz, ese nombre resta 10. En la franja también pesa lo que viene antes y después. Resta 1 si el acorde resuelve en el siguiente como un V que va a I y 0,5 si llega desde su dominante. Suma 1 si queda fuera de la tonalidad.');
    expect(inEnglish(rankHelp)).toBe('The name with the fewest points wins. Points are added for a bass that is not the root (3 for the 3rd or 5th, 5 for the 7th and 7 for any other note), for each missing note (2) and for an uncommon chord type (up to 0.9). If you choose the root yourself, that name subtracts 10. In the lane, what comes before and after counts too. It subtracts 1 if the chord resolves into the next one as a V going to I and 0.5 if it arrives from its dominant. It adds 1 if it falls outside the key.');
  });
  it('gives the type its rank and nothing else for a chord with its bass and all its notes', () => {
    expect(scoreDetail(cand([48, 52, 55, 58], 0, '7'))).toBe('0,2 tipo = 0,2');
    expect(scoreDetail(cand(C, 0, ''))).toBe('0 tipo = 0');
  });
  it('adds 3 for an inversion: G7/B is 3 inversión + 0,2 tipo = 3,2', () => {
    expect(scoreDetail(cand([47, 50, 53, 55], 7, '7'))).toBe('3 inversión + 0,2 tipo = 3,2');
    expect(inEnglish(() => scoreDetail(cand([47, 50, 53, 55], 7, '7')))).toBe('3 inversion + 0.2 type = 3.2');
  });
  // decision 12: a bass on the 7th or on another degree than the 3rd or the perfect 5th costs more, and the tooltip names it
  it('adds 5 for a bass on the 7th and 7 for one on another degree, and names the degree', () => {
    expect(scoreDetail(cand([41, 43, 47, 50], 7, '7'))).toBe('5 bajo en la 7ª + 0,2 tipo = 5,2');
    expect(inEnglish(() => scoreDetail(cand([41, 43, 47, 50], 7, '7')))).toBe('5 bass on the 7th + 0.2 type = 5.2');
    expect(scoreDetail(cand([50, 52, 55, 60], 0, 'add9'))).toMatch(/^7 bajo en la 9ª \+ /);
    expect(inEnglish(() => scoreDetail(cand([50, 52, 55, 60], 0, 'add9')))).toMatch(/^7 bass on the 9th \+ /);
    expect(scoreDetail(cand([44, 48, 52], 0, 'aug'))).toMatch(/^7 bajo en la 5ª alterada \+ /);
    expect(scoreDetail(cand([43, 48, 52], 0, ''))).toBe('3 inversión = 3');
  });
  it('adds 2 for each omitted note', () => expect(scoreDetail(cand([48, 52, 58, 62], 0, '9'))).toBe('2 omisión + 0,4 tipo = 2,4'));
  it('adds 1.5 for a sixth chord without its 5th', () => expect(scoreDetail(cand([48, 52, 57], 0, '6'))).toBe('2 omisión + 1,5 6ª sin 5 + 0,45 tipo = 3,95'));
  it('subtracts 10 for the root you choose', () => {
    expect(scoreDetail(cand(C, 0, '', 0))).toBe('0 tipo − 10 raíz elegida = −10');
    expect(scoreDetail(cand([47, 50, 53, 55], 7, '7', 7))).toBe('3 inversión + 0,2 tipo − 10 raíz elegida = −6,8');
  });
  it('shows the highest rank the table has in the rule', () => expect(Math.max(...TYPES.map(t => t.rank))).toBe(0.9));
  it('adds up to the score of every candidate', () => {
    for (const notes of [C, [47, 50, 53, 55], [48, 52, 58, 62], [48, 52, 57], [48, 51, 54, 57], [60, 61, 62]])
      for (const locked of [null, 0, 7]) for (const c of analyze(notes, locked)) {
        expect(Object.values(c.parts).reduce((a, b) => a + b, 0)).toBeCloseTo(c.score, 9);
      }
  });
});

// Row 10: why this key, one case per rule
describe('row 10: the reasons of the key', () => {
  it('says that a V resolves to the tonic, that it starts and ends there, and that every chord is in the scale', () => {
    expect(why([C, F, G7, C]).reasons).toEqual(['un V resuelve a la tónica', 'empieza y termina en la tónica', 'todos los acordes son de la escala']);
    expect(why([C, F, G7, C]).text).toBe('C mayor: un V resuelve a la tónica · empieza y termina en la tónica · todos los acordes son de la escala');
  });
  it('does not list "empieza" or "termina" when "empieza y termina" applies', () => {
    const r = why([C, F, G7, C]).reasons;
    expect(r).not.toContain('empieza en la tónica');
    expect(r).not.toContain('termina en la tónica');
  });
  it('says only that it ends on the tonic when it does not start there', () => {
    const r = why([F, G7, C]).reasons;
    expect(r).toContain('termina en la tónica');
    expect(r.join(' ')).not.toContain('empieza');
  });
  it('says only that it starts on the tonic when it does not end there', () => {
    const r = why([C, G7, Am, F]).reasons;
    expect(r).toContain('empieza en la tónica');
    expect(r.join(' ')).not.toContain('termina');
  });
  it('says that a single chord is the tonic', () => expect(why([C]).reasons).toEqual(['el único acorde es la tónica']));
  it('says that the longest chord is the tonic only when it lasts longer than the others (F28)', () => {
    const f28 = [[41, 45, 48], G, [45, 48, 52], G];
    expect(why(f28, [1, 1, 3, 1]).reasons).toContain('el acorde que más dura es la tónica');
    expect(why([[41, 45, 48], G, [45, 48, 52], [52, 55, 59]], [1, 1, 1, 1]).reasons).not.toContain('el acorde que más dura es la tónica');
  });
  it('says "todos los acordes son de la escala" only when it is literally true', () => {
    expect(why([C, F, G]).reasons).toContain('todos los acordes son de la escala');
    expect(why([C, Ab, F, C]).reasons.join(' ')).not.toContain('de la escala');
    expect(why([C, [50, 54, 57, 60], G, C]).reasons.join(' ')).not.toContain('de la escala');
  });
  it('says "todas las notas" when what it reads are lone notes', () => {
    expect(why([[60], [62], [64], [65], [67]]).reasons).toEqual(['todas las notas son de la escala']);
  });
  it('adds the reason of the mode: dorian, phrygian, lydian and mixolydian', () => {
    const D = [50, 53, 57], Gm = [43, 47, 50], E = [52, 55, 59], Fm = [53, 57, 60], Dl = [50, 54, 57], El = [52, 56, 59], Gx = [43, 47, 50], Fx = [41, 45, 48], Cx = [48, 52, 55];
    expect(why([D, Gm, D, Gm, D]).reasons.at(-1)).toBe('dórico: aparece B natural (6ª mayor) y todas las notas están en la escala');
    expect(why([E, Fm, E, Fm, E]).reasons.at(-1)).toBe('frigio: aparece F natural (2ª menor) y todas las notas están en la escala');
    expect(why([Dl, El, Dl]).reasons.at(-1)).toBe('lidio: aparece G♯ (4ª aumentada) y todas las notas están en la escala');
    expect(why([Gx, Fx, Cx, Gx]).reasons.at(-1)).toBe('mixolidio: aparece F natural (7ª menor) y todas las notas están en la escala');
    expect(inEnglish(() => why([D, Gm, D, Gm, D]).reasons.at(-1))).toBe('Dorian: B natural (major 6th) appears and every note is in the scale');
  });
  // decision 13: more than two chords, starting on the tonic and ending on the major chord a fifth above
  it('says that it starts on the tonic and ends on its V (half cadence), worth 4 points', () => {
    expect(why([C, F, G]).reasons).toContain('empieza en la tónica y termina en su V (semicadencia)');
    expect(why([C, F, G]).title).toContain('empieza en la tónica y termina en su V (semicadencia) +4');
    expect(inEnglish(() => why([C, F, G]).reasons)).toContain('starts on the tonic and ends on its V (half cadence)');
  });
  it('names the alternative key when it almost ties, and not otherwise', () => {
    expect(why([C, G]).text).toBe('C mayor, casi empatada con G mayor: empieza en la tónica · todos los acordes son de la escala');
    expect(inEnglish(() => why([C, G]).text)).toBe('C major, nearly tied with G major: starts on the tonic · every chord is in the scale');
    expect(why([C, F, G7, C]).text).not.toContain('empatada');
  });
  // decision 5: C – D – G stays ambiguous; with D7, its own V7 leads to G and there is no half cadence (decision 13)
  it('shows the other key for C – D – G and none for C – D7 – G', () => {
    const D = [50, 54, 57], D7 = [50, 54, 57, 60];
    expect(why([C, D, G]).text).toMatch(/^C mayor, casi empatada con G mayor: /);
    expect(run([C, D7, G]).key.tonic).toBe(7);
    expect(run([C, D7, G]).alt).toBeFalsy();
    expect(why([C, D7, G]).text).not.toContain('empatada');
  });
  it('keeps the points out of the visible text and in the title', () => {
    const w = why([C, F, G7, C]);
    expect(w.text).not.toMatch(/\d/);
    expect(w.title).toContain('un V resuelve a la tónica +3');
    expect(w.title).toContain('empieza y termina en la tónica +6,5');
    expect(w.title).toMatch(/Puntos: C mayor \d/);
  });
  it('does not count the last chord of a deceptive cadence as the end on the minor tonic', () => {
    const items = [C, F, G7, Am].map(notes => ({ root: analyze(notes, null)[0].root, q: analyze(notes, null)[0].type.q }));
    expect(bookends(items, 9, 'minor').last).toBe(false);
    expect(bookends(items, 9, 'minor').first).toBe(false);
  });
});

// An augmented sixth goes by its kind (It⁺⁶), keeps its figure as a degree and spells its notes from the bass (manual test, P4)
describe('augmented sixths by name', () => {
  const Am = [45, 48, 52], E = [40, 44, 47], It = [41, 45, 51], Fr = [41, 45, 47, 51], Ger = [41, 45, 48, 51];
  const at1 = x => { const A = run([Am, x, E, Am]); return { r: A.rs[1], ro: A.romans[1] }; };
  it('names It⁺⁶, Fr⁺⁶ and Ger⁺⁶ and keeps the figure of the degree', () => {
    expect([It, Fr, Ger].map(x => at1(x).r.label)).toEqual(['It⁺⁶', 'Fr⁺⁶', 'Ger⁺⁶']);
    expect([It, Fr, Ger].map(x => at1(x).ro.short)).toEqual(['It⁶', 'Fr⁴₃', 'Ger⁶₅']);
  });
  it('spells the sixth from the bass, D♯ over F, for the chord and for the melody', () => {
    const { r } = at1(It);
    expect(r.spelled.map(n => n.l + ':' + n.a)).toEqual(['3:0', '5:0', '1:1']);
    expect(r.sp.byPc[3]).toMatchObject({ l: 1, a: 1 });
    expect(r.spelled.map(n => aug6Iv(n, r.aug6.lo))).toEqual(['1', '3', '♯6']);
    expect(at1(Fr).r.spelled.map(n => aug6Iv(n, at1(Fr).r.aug6.lo))).toEqual(['1', '3', '♯4', '♯6']);
  });
  it('says in the inspector what the sixth is and where its notes go, in both languages', () => {
    expect(aug6Text(at1(It).r.aug6, PREFS)).toBe('Sexta aumentada italiana: F–D♯ es una 6ª aumentada; las dos notas van a E');
    expect(inEnglish(() => aug6Text(at1(It).r.aug6, PREFS))).toBe('Italian augmented sixth: F–D♯ is an augmented sixth; both notes go to E');
    expect(aug6Text(at1(Fr).r.aug6, PREFS)).toBe('Sexta aumentada francesa: F–D♯ es una 6ª aumentada; las dos notas van a E');
    expect(inEnglish(() => aug6Text(at1(Ger).r.aug6, PREFS))).toBe('German augmented sixth: F–D♯ is an augmented sixth; both notes go to E');
  });
});

// The ornament rule: a note that sounds little in its step is left out of the name, and the panel says so
describe('ornaments in words', () => {
  const step = { notes: [48, 52, 55, 59], dur: 384, a: 0, evs: [{ m: 48, s: 0, l: 384 }, { m: 52, s: 0, l: 384 }, { m: 55, s: 0, l: 384 }, { m: 59, s: 336, l: 48 }] };
  it('names the note a step leaves out', () => {
    const r = resolveStep(step, PREFS);
    expect(r.label).toBe('C');
    expect(ornamentText(r.orn, r.spelled, PREFS)).toBe('Adorno: B3 (dura poco; no cambia el nombre del acorde)');
    expect(inEnglish(() => ornamentText(r.orn, r.spelled, PREFS))).toBe("Ornament: B3 (short; it does not change the chord's name)");
  });
  it('says nothing for the same notes without their timing', () => {
    const r = resolveStep({ notes: step.notes }, PREFS);
    expect(r.label).toBe('Cmaj7');
    expect(ornamentText(r.orn, r.spelled, PREFS)).toBe('');
  });
});

// Root by context (readWithMelody): a lane chord under a tune may take notes of the tune, and its neighbours weigh on it
describe('row 5: a lane chord read with the tune and its neighbours', () => {
  const step = (harm, tune, a = 0, dur = 384) => ({ notes: harm, dur, a, evs: harm.map(m => ({ m, s: a, l: dur })), all: [...harm, ...tune].map(m => ({ m, s: a, l: dur })) });
  it('a note of the tune completes the chord, and the step still spells its own notes', () => {
    const r = resolveStep(step([48, 64], [67]), PREFS);
    expect([r.label, r.mel, r.spelled.map(n => n.midi)]).toEqual(['C', [67], [48, 64]]);
    expect(melodyText(r.mel, r.sp, PREFS)).toBe('G (en la melodía) completa el acorde');
    expect(inEnglish(() => melodyText(r.mel, r.sp, PREFS))).toBe('G (in the melody) completes the chord');
  });
  it('names two notes of the tune in the plural', () => {
    expect(melodyText([47, 50], { byPc: { 11: { l: 6, a: 0 }, 2: { l: 1, a: 0 } } }, PREFS)).toBe('B y D (en la melodía) completan el acorde');
    expect(inEnglish(() => melodyText([47, 50], { byPc: { 11: { l: 6, a: 0 }, 2: { l: 1, a: 0 } } }, PREFS))).toBe('B and D (in the melody) complete the chord');
  });
  it('a tune that would make another chord with more notes stays out of the name', () => {
    expect(resolveStep(step([48, 52, 55], [53, 57, 62, 59]), PREFS).label).toBe('C');
  });
  it('the context terms go in the tooltip of the points', () => {
    const A = analyzeProgression([step([43, 47, 50], []), step([48, 52, 55], [], 384)], PREFS);
    expect(scoreDetail(A.rs[0].c)).toBe('0 tipo = 0 · contexto: −1 va al acorde siguiente (V → I)');
    expect(inEnglish(() => scoreDetail(A.rs[0].c))).toBe('0 type = 0 · context: −1 goes to the next chord (V → I)');
    expect(scoreDetail(A.rs[1].c)).toBe('0 tipo = 0 · contexto: −0,5 llega desde su dominante');
    expect(inEnglish(() => scoreDetail(A.rs[1].c))).toBe('0 type = 0 · context: −0.5 arrives from its dominant');
  });
  it('a reading off the key costs one more', () => {
    const A = analyzeProgression([step([48, 52, 55], []), step([53, 57, 60], [], 384), step([51, 55, 58], [], 768), step([43, 47, 50], [], 1152), step([48, 52, 55], [], 1536)], PREFS);
    expect(scoreDetail(A.rs[2].c)).toBe('0 tipo = 0 · contexto: +1 fuera de la tonalidad');
    expect(inEnglish(() => scoreDetail(A.rs[2].c))).toBe('0 type = 0 · context: +1 outside the key');
  });
});
