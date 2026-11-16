// Checks that every pitched sample in public/samples/ sounds at the key it is filed under (its k in manifest.json),
// so a render from tools/samples.py that read the wrong audio is caught before it ships. Run it after every render:
//   node tools/sample-tuning.mjs [samples folder] [channel,channel,...]
// Needs ffmpeg on PATH (or in the FFMPEG environment variable), as tools/samples.py does.
//
// Each file is decoded to mono, and a stretch after the attack is analyzed with an FFT. The pitch is the candidate
// fundamental whose first harmonics gather the most spectral energy (harmonic sum, weaker weight for higher harmonics),
// searched from 13 semitones below k (an organ's 16' stop) to 30 above, among candidates whose own fundamental is
// audible (so a lone partial or low noise is not read as a harmonic of a pitch that is not there), and then refined
// from the interpolated peaks of its first harmonics. Only its pitch class counts: the offset is folded to ±6 semitones
// from k. A sample read from the wrong place in its source sits whole semitones off; vibrato and chorus stay well under
// the tolerance, and so does the stretch tuning of a piano's top octave (+0.52 on the Piano's 103).
// Bells, glockenspiel and timpani have partials that are not harmonic, so they are reported but never fail; so are the
// samples in KNOWN, whose offset comes from the library itself (sforzando plays them the same) and not from the render.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = process.argv[2] || fileURLToPath(new URL('../public/samples/', import.meta.url));
const ONLY = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const SR = 44100, START = 0.15, N = 16384, PAD = 65536;
const TOLERANCE = 0.6;         // semitones
const AUDIBLE = 0.1;           // a candidate's fundamental needs this share of the strongest bin (square-root magnitude, about -40 dB)
const SHORTEST = 0.2;          // seconds: a shorter file (a pluck noise) has no stretch after its attack to read
const LOWEST = 40;             // Hz: below this the window holds too few periods to read a pitch
const INHARMONIC = new Set(['Campanas', 'Campana (Iglesia)', 'Glockenspiel', 'Timbales', 'Gong y platillo susp.']);
// channel → k → why its offset is not a render error (measured on 2026-11-16)
const KNOWN = {
  'Guitarra Limpia': { 59: 'the Emilyguitar .sfz plays c4_mf_rr*.wav (C4) on B3 without retuning: +1.00' },
  'Cornos': { 43: 'the VSCO recording MOHorn_sus_G1_v3_1.wav is flat in the source: -0.86' },
  'Piano FM': { 30: 'FM sidebands outweigh the fundamental this low, so no pitch is read: about -4.9' },
};

const hz = m => 440 * 2 ** ((m - 69) / 12);

function decode(file) {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
  if (r.error || r.status !== 0) throw new Error(`${file}: ffmpeg failed${r.error ? ` (${r.error.message})` : ''}`);
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, b.length >> 2);
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const p = i + j, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

// magnitude spectrum of the window after the attack, square-root compressed so one loud formant does not decide alone
function spectrum(x) {
  const re = new Float64Array(PAD), im = new Float64Array(PAD), i0 = Math.min(Math.round(START * SR), Math.max(0, x.length - N));
  for (let i = 0; i < N; i++) re[i] = (x[i0 + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  fft(re, im);
  const m = new Float64Array(PAD / 2);
  for (let i = 0; i < PAD / 2; i++) m[i] = Math.sqrt(Math.hypot(re[i], im[i]));
  return m;
}

// the strongest bin within a quarter semitone of f
function near(m, f) {
  const lo = Math.floor(f * 2 ** (-0.25 / 12) * PAD / SR), hi = Math.ceil(f * 2 ** (0.25 / 12) * PAD / SR);
  let v = 0;
  for (let i = Math.max(1, lo); i <= hi && i < m.length; i++) v = Math.max(v, m[i]);
  return v;
}

// MIDI pitch of the best candidate fundamental around k, or null when the window is silent
function pitch(m, k) {
  let best = null, top = 0, peak = 0;
  for (const v of m) peak = Math.max(peak, v);
  for (let c = k - 13; c <= k + 30; c += 0.02) {
    const f = hz(c);
    if (f < 25 || f > SR * 0.4 || near(m, f) < AUDIBLE * peak) continue;
    let s = 0;
    for (let h = 1; h <= 12 && h * f < SR * 0.45; h++) s += 0.9 ** (h - 1) * near(m, h * f);
    if (s > top) { top = s; best = c; }
  }
  return top > 1e-3 ? refine(m, hz(best)) : null;
}
// the search above is coarse (each harmonic matches anywhere within a quarter semitone): the fundamental is then read
// from the interpolated peaks of the first harmonics, each weighted by its magnitude
function refine(m, f) {
  let sw = 0, sf = 0;
  for (let h = 1; h <= 6 && h * f < SR * 0.45; h++) {
    const lo = Math.max(1, Math.floor(h * f * 2 ** (-0.3 / 12) * PAD / SR)), hi = Math.ceil(h * f * 2 ** (0.3 / 12) * PAD / SR);
    let i = lo;
    for (let j = lo; j <= hi && j < m.length - 1; j++) if (m[j] > m[i]) i = j;
    if (i <= lo || i >= hi) continue;  // no peak inside the window, only its slope
    const a = m[i - 1], b = m[i], c = m[i + 1], d = (a - c) / (2 * (a - 2 * b + c) || 1);
    sf += b * (i + d) * SR / PAD / h; sw += b;
  }
  return 69 + 12 * Math.log2((sw ? sf / sw : f) / 440);
}

const man = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));
let checked = 0, failed = 0, skipped = 0, knownAll = 0;
for (const [ch, set] of Object.entries(man.channels)) {
  if (!set.pitched || (ONLY && !ONLY.has(ch))) continue;
  const soft = INHARMONIC.has(ch), cells = [];
  let bad = 0, known = 0;
  for (const s of set.samples) {
    if (KNOWN[ch] && KNOWN[ch][s.k]) { cells.push(`${s.k}:known`); known++; continue; }
    if (hz(s.k) < LOWEST) { cells.push(`${s.k}:low`); skipped++; continue; }
    const x = decode(join(DIR, s.file));
    if (x.length < SHORTEST * SR) { cells.push(`${s.k}:short`); skipped++; continue; }
    const p = pitch(spectrum(x), s.k);
    if (p == null) { cells.push(`${s.k}:silent`); bad++; continue; }
    const off = ((p - s.k) % 12 + 18) % 12 - 6;
    const ok = Math.abs(off) <= TOLERANCE;
    if (!ok) bad++;
    cells.push(`${s.k}:${off >= 0 ? '+' : ''}${off.toFixed(2)}${ok ? '' : '!'}`);
    checked++;
  }
  if (!soft) failed += bad;
  console.log(`${bad && !soft ? 'FAIL' : soft ? 'info' : 'ok  '} ${ch}: ${bad}/${set.samples.length} off by more than ${TOLERANCE} st${soft ? ' (inharmonic, not judged)' : ''}${known ? `, ${known} known` : ''}`);
  console.log('     ' + cells.join(' '));
  for (const [k, why] of Object.entries(KNOWN[ch] || {})) console.log(`     known ${k}: ${why}`);
  knownAll += known;
}
console.log(`${checked} samples measured, ${skipped} skipped (below ${LOWEST} Hz or shorter than ${SHORTEST} s), ${knownAll} known, ${failed} out of tune`);
process.exit(failed ? 1 : 0);
