import { libText, parseText, pickInterp, progText, projectText } from './text.js';
import fx from './test/fixtures/text.json';
import turnaround from './test/fixtures/turnaround.json';
import { PREFS, PREFS_BY, clone, noId } from './test/helpers.js';
import { splitHarmony } from './harmony.js';
import { normProg } from './model.js';

const parsedNoId = r => { const o = clone(r); o.projects.forEach(pr => pr.patterns.forEach(pt => { pt.notes = noId(pt.notes); })); return o; };

describe('projectText and parseText', () => {
  for (const [name, prefs] of Object.entries(PREFS_BY)) {
    it(`turnaround with ${name} preferences`, () => {
      const t = projectText(clone(turnaround), prefs);
      expect(t).toBe(fx[name].projectText);
      expect(parsedNoId(parseText(t, prefs))).toEqual(fx[name].parsed);
    });
    it(`round trip keeps the chords, their length and the project with ${name} preferences`, () => {
      const back = parseText(projectText(clone(turnaround), prefs), prefs).projects[0];
      expect([back.name, back.bpm, back.seed]).toEqual([turnaround.name, turnaround.bpm, turnaround.seed]);
      expect(back.patterns[0].steps.map(s => [s.notes, s.beats])).toEqual([[[48, 59, 64, 67], 4], [[45, 55, 60, 64], 4], [[50, 60, 65, 69], 2], [[43, 53, 59, 62], 2]]);
    });
  }
  it('a pattern that is not plain blocks exports and reads back its exact notes', () => {
    const t = projectText(clone(fx.loose.project), PREFS);
    expect(t).toBe(fx.loose.projectText);
    const back = parsedNoId(parseText(t, PREFS));
    expect(back).toEqual(fx.loose.parsed);
    expect(back.projects[0].patterns[0].notes).toEqual(noId(fx.loose.project.patterns[0].notes));
  });
  it('one pattern of a project', () => {
    const pr = clone(fx.onlyPattern.project);
    expect(projectText(pr, PREFS, pr.patterns.find(p => p.id === fx.onlyPattern.only))).toBe(fx.onlyPattern.projectText);
  });
  it('drum pattern', () => {
    expect(progText(clone(fx.drums.project.patterns[0]), PREFS)).toBe(fx.drums.progText);
  });
  it('hand-written text in every accepted format', () => {
    expect(parsedNoId(parseText(fx.hand.text, PREFS))).toEqual(fx.hand.parsed);
  });
});

describe('voices and tune in the text export', () => {
  // P2 of the manual test of 2 Nov 2026: an Alberti bass in eighths under a tune in half notes
  const alberti = [48, 55, 52, 55, 48, 55, 52, 55, 48, 57, 53, 57, 48, 57, 53, 57, 47, 55, 50, 55, 47, 55, 50, 55, 48, 55, 52, 55, 48, 55, 52, 55];
  const tune = [[76, 0, 2], [79, 2, 2], [77, 4, 2], [81, 6, 2], [74, 8, 1], [77, 9, 1], [79, 10, 2], [72, 12, 4]];
  const p = normProg({ id: 'p', name: 'P2', beats: 4, names: {},
    notes: [...alberti.map((m, i) => ({ id: 'a' + i, m, s: i * 48, l: 48, v: 100 })), ...tune.map(([m, s, l], i) => ({ id: 't' + i, m, s: s * 96, l: l * 96, v: 100 }))] });
  it('a note of the tune leaves the voices of its chord only to be written under «# Melodía»', () => {
    const lines = progText(p, PREFS).split('\n'), H = splitHarmony(p);
    const harm = lines.filter(l => /^\d+\. /.test(l));
    const from = lines.findIndex(l => l.startsWith('# Melodía')), to = lines.findIndex((l, i) => i > from && l.startsWith('#'));
    const mel = lines.slice(from + 1, to).map(l => l.split(' | '));
    expect(harm[0].split(' | ')[3]).toBe('E3 G3');
    expect(H.chords.length).toBe(harm.length);
    let moved = 0;
    H.chords.forEach((c, i) => {
      const voices = harm[i].split(' | ')[3].split(' ');
      c.notes.slice(1).forEach(m => {
        const line = mel.find(x => x[0].includes(`(${m}`) && +x[1] * 96 < c.b && (+x[1] + +x[2]) * 96 > c.a);
        if (line) { moved++; expect(voices).not.toContain(line[0].split(' (')[0]); }
        else expect(voices.length).toBeGreaterThan(0);
      });
    });
    expect(moved).toBeGreaterThan(0);
    expect(mel.map(x => x[0].split(' (')[0])).toEqual(['E5', 'G5', 'F5', 'A5', 'D5', 'F5', 'G5', 'C5']);
  });
});

describe('pickInterp', () => {
  const steps = fx.hand.parsed.chords.concat(fx.hand.parsed.projects.flatMap(p => p.patterns.flatMap(s => s.steps)));
  for (const [name, prefs] of Object.entries(PREFS_BY)) {
    it(`${name} preferences`, () => {
      expect(clone(steps.map(p => pickInterp(clone(p), prefs)))).toEqual(fx.pickInterp[name]);
    });
  }
});

describe('libText', () => {
  it('one chord and one project', () => {
    expect(libText({ chords: clone(fx.lib.chords), projects: clone(fx.lib.projects) }, PREFS)).toBe(fx.lib.libText);
  });
  it('two projects: each one after the chords (the single-file version threw here)', () => {
    const lib = { chords: clone(fx.lib.chords), projects: [clone(fx.lib.projects[0]), clone(fx.loose.project)] };
    expect(libText(lib, PREFS)).toBe([fx.lib.libText, projectText(clone(fx.loose.project), PREFS)].join('\n\n'));
  });
});
