import { afterEach, describe, expect, it } from 'vitest';
import { HTML_EN, HTML_SAME, LANG_KEY, detectLanguage, setLang, shareLang, sharedLang, tr } from './i18n.js';
import { indexTexts } from './test/html-texts.js';

describe('detectLanguage', () => {
  it('picks Spanish only when the first browser language is Spanish', () => {
    expect(detectLanguage(['es-CL', 'en'])).toBe('es');
    expect(detectLanguage(['ES'])).toBe('es');
    expect(detectLanguage(['en-US', 'es'])).toBe('en');
    expect(detectLanguage(['pt-BR'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
  });
});

describe('shared language', () => {
  afterEach(() => { delete globalThis.localStorage; });
  const store = (init) => {
    const m = new Map(Object.entries(init));
    globalThis.localStorage = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
    return m;
  };
  it('reads only es or en from the key the site uses', () => {
    expect(LANG_KEY).toBe('salonas.lang');
    store({ 'salonas.lang': 'en' }); expect(sharedLang()).toBe('en');
    store({ 'salonas.lang': 'fr' }); expect(sharedLang()).toBe(null);
    store({}); expect(sharedLang()).toBe(null);
  });
  it('writes the plain value, not JSON', () => {
    const m = store({}); shareLang('es');
    expect(m.get('salonas.lang')).toBe('es');
  });
  it('does nothing without localStorage', () => {
    expect(sharedLang()).toBe(null);
    expect(() => shareLang('en')).not.toThrow();
  });
});

describe('tr', () => {
  it('returns the Spanish string unchanged unless the language is English', () => {
    setLang('es'); expect(tr('Tocar', 'Play')).toBe('Tocar');
    setLang('en'); expect(tr('Tocar', 'Play')).toBe('Play');
    setLang('fr'); expect(tr('Tocar', 'Play')).toBe('Tocar');
    setLang('es');
  });
});

describe('static texts of index.html', () => {
  const texts = indexTexts();
  it('every text has an English version or reads the same in English', () => {
    expect(texts.filter(t => !(t in HTML_EN) && !HTML_SAME.has(t))).toEqual([]);
  });
  it('no English entry is left over from a text that no longer exists', () => {
    expect(Object.keys(HTML_EN).filter(k => !texts.includes(k))).toEqual([]);
  });
  it('the English versions differ from the Spanish ones and are not empty', () => {
    expect(Object.entries(HTML_EN).filter(([es, en]) => !en.trim() || en === es)).toEqual([]);
  });
});
