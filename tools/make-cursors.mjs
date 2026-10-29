// Draws the piano roll cursors in the style of public/cursors/arrow.png: a #fff6e0 fill with a
// #1a1a1a outline, each logical pixel drawn as 2x2. Run: node tools/make-cursors.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const FILL = [0xff, 0xf6, 0xe0], EDGE = [0x1a, 0x1a, 0x1a], SCALE = 2;

// fill pixels for a w x h grid; the outline is every other pixel touching the fill (8 neighbours)
function shape(w, h, fill, edge = []) {
  const g = Array.from({ length: h }, () => Array(w).fill(0));
  fill.forEach(([x, y]) => { g[y][x] = 1; });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy]?.[x + dx] === 1) g[y][x] = 2;
  }
  edge.forEach(([x, y]) => { g[y][x] = 2; });
  return g;
}
const line = (x0, y0, x1, y1) => {
  const out = [];
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, y]);
  return out;
};
// an arrowhead whose tip is at (x, y), pointing along (dx, dy), three rows deep
const head = (x, y, dx, dy) => [0, 1, 2].flatMap(k => line(x + dx * k - dy * k, y + dy * k - dx * k, x + dx * k + dy * k, y + dy * k + dx * k));

function cross() {
  const c = 6;
  return shape(13, 13, [...line(c, 1, c, 4), ...line(c, 8, c, 11), ...line(1, c, 4, c), ...line(8, c, 11, c)], [[c, c]]);
}
function move() {
  const c = 7;
  return shape(15, 15, [...line(c, 1, c, 13), ...line(1, c, 13, c), ...head(c, 1, 0, 1), ...head(c, 13, 0, -1), ...head(1, c, 1, 0), ...head(13, c, -1, 0)]);
}
function ns() {
  const c = 3;
  return shape(7, 15, [...line(c, 1, c, 13), ...head(c, 1, 0, 1), ...head(c, 13, 0, -1)]);
}
const ew = () => { const g = ns(); return g[0].map((_, x) => g.map(r => r[x])); };

function png(g) {
  const w = g[0].length * SCALE, h = g.length * SCALE;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = g[Math.floor(y / SCALE)][Math.floor(x / SCALE)], o = y * (w * 4 + 1) + 1 + x * 4;
    if (v) { const c = v === 1 ? FILL : EDGE; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = 255; }
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const dir = new URL('../public/cursors/', import.meta.url);
for (const [name, g] of Object.entries({ cross: cross(), move: move(), ns: ns(), ew: ew() })) {
  writeFileSync(new URL(name + '.png', dir), png(g));
  console.log(name, g[0].length * SCALE + 'x' + g.length * SCALE, '\n' + g.map(r => r.map(v => '.o#'[v]).join('')).join('\n'));
}
