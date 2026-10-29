import { expect, it, vi } from 'vitest';

// The interface language comes from navigator.languages when state.js loads: pin it so the test does not depend on the machine
vi.stubGlobal('navigator', { languages: ['es'] });
const { st } = await import('./state.js');

it('a first visit opens default_in_c.mid on piano and no chord', () => {
  expect(st.proj.name).toBe('Ejemplo: turnaround en Do');
  expect(st.proj.bpm).toBe(90);
  expect(st.proj.patterns.map(p => [p.name, p.notes.length, p.inst.preset])).toEqual([['Turnaround', 37, 'piano']]);
  const p = st.proj.patterns[0];
  expect([...p.notes].sort((x, y) => x.s - y.s || x.m - y.m).slice(0, 4).map(n => [n.m, n.s, n.l, n.v])).toEqual([[48, 0, 96, 100], [59, 0, 192, 100], [64, 0, 192, 100], [67, 0, 192, 100]]);
  expect(Math.max(...p.notes.map(n => n.s + n.l))).toBe(1152);
  expect(st.prog).toBe(p);
  expect(st.notes.size).toBe(0);
});
