// Shared by the tests. The fixtures in fixtures/ are outputs recorded from the earlier single-file version.
import crypto from 'node:crypto';

export const PREFS = { naming: 'letters', accPref: 'auto', octConv: 'sci', midiShift: 0 };
export const ALT = { naming: 'latin', accPref: 'flat', octConv: 'fl', midiShift: -12 };
export const PREFS_BY = { default: PREFS, alt: ALT };

export const clone = o => JSON.parse(JSON.stringify(o));
export const noId = ns => ns.map(({ id, ...n }) => n);
export const hex = u8 => Buffer.from(u8).toString('hex');
export const fromHex = h => Uint8Array.from(Buffer.from(h, 'hex'));
export const sha256 = u8 => crypto.createHash('sha256').update(Buffer.from(u8)).digest('hex');

// zip entries carry the local time; the fixtures were made at 2026-10-27 12:00:00
export function fixDate() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 27, 12, 0, 0));
}
