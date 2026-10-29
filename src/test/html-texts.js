// Lists the user-facing texts of index.html (text nodes and the title, aria-label and placeholder
// attributes), normalized the way src/i18n.js looks them up. Run it with node to print them.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ATTRS = ['title', 'aria-label', 'placeholder'];
const norm = s => s.replace(/\s+/g, ' ').trim();
const decode = s => s.replace(/&#10;/g, '\n').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

function htmlTexts(html) {
  const out = new Set();
  let skip = 0;
  for (const part of html.slice(html.indexOf('<body')).split(/(<[^>]+>)/)) {
    if (part.startsWith('<')) {
      const tag = /^<\/?([a-z0-9]+)/i.exec(part)?.[1]?.toLowerCase();
      if (tag === 'script' || tag === 'svg') skip += part.startsWith('</') ? -1 : part.endsWith('/>') ? 0 : 1;
      for (const a of ATTRS) {
        const m = new RegExp(`\\s${a}="([^"]*)"`).exec(part);
        if (m && /\p{L}/u.test(m[1])) out.add(a === 'placeholder' ? decode(m[1]) : norm(decode(m[1])));
      }
    } else if (!skip) {
      const t = norm(decode(part));
      if (/\p{L}/u.test(t)) out.add(t);
    }
  }
  return [...out];
}
const indexTexts = () => htmlTexts(readFileSync(new URL('../../index.html', import.meta.url), 'utf8'));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) indexTexts().forEach(t => console.log(JSON.stringify(t)));

export { htmlTexts, indexTexts };
