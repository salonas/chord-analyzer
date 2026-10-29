"""Builds the preview samples in public/samples/ from the FL template: for each sforzando channel,
the program it loads (an .sfz path or an ARIA bank program) is read from the .flp, and only
libraries that ship a CC0 license are used. Channels that load an .sf2 are left to the oscillators.

    python tools/samples.py "<template .flp>" "<Soundfonts folder>"

- drums/: one mono .mp3 per note of DRUMS_ES and velocity layer (40, 80, 120), from the channel
  named in its `ch`, with one shared gain so the pieces keep their balance.
- <channel>/: for pitched channels, one note every PITCH_STEP semitones at velocity 100; for
  unpitched ones (pitch_keytrack=0), one file per key range. Each channel is normalized on its own.
- manifest.json: the files, plus which channel each instrument profile falls back to.

Microphones and layers are mixed at the levels the .sfz sets by default, so the preview sounds like
sforzando with the exported MIDI and untouched controllers. Needs ffmpeg with libmp3lame on PATH
(or in the FFMPEG environment variable).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import zlib

sys.path.insert(0, os.path.dirname(__file__))
from sfzregions import cc_defaults, program  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'samples')
ARIA_ROOT = ''
SF2_RATE = 48000   # sample rate of the converted sf2_smpl.wav files
DRUM_LAYERS = [40, 80, 120]
PITCH_VEL = 100
PITCH_STEP = 4           # semitones between rendered notes; the browser retunes the ones between
MAX_SECONDS = 3          # longer notes fade out here (cymbals and gongs get DRUM_SECONDS)
DRUM_SECONDS = 4
PEAK_DB = -1.0
FFMPEG = os.environ.get('FFMPEG') or shutil.which('ffmpeg')

# Instrument profile (src/data.js) → template channel used when a pattern's name matches no channel
PROFILE_CHANNEL = {
    'piano': 'Piano', 'organo': 'Órgano', 'clavecin': 'Clavecín', 'pianofm': 'Piano FM', 'pad': 'Pad',
    'cuerdas': 'Violines', 'spiccato': 'Violines Spic', 'gravescuerda': 'Cellos', 'cuerdasolista': 'Violín Solista',
    'arpa': 'Arpa', 'pulsado': 'Guitarra Limpia', 'bajo': 'Bajo', 'octobajo': 'Octobajo', 'flauta': 'Flauta',
    'maderas': 'Clarinete', 'saxos': 'Saxo Tenor', 'metales': 'Trompetas', 'cornos': 'Cornos',
    'metalesgraves': 'Trombones', 'percorq': 'Timbales', 'mallets': 'Glockenspiel', 'voces': 'Coro Aahs', 'lead': 'Lead',
    'chiptune': 'Chiptune',
}
# Template channels the page does not use (Voz solista is screamo chops: no instrument for it)
EXCLUDED_CHANNELS = {'Voz solista'}
# ARIA conversions of .sf2 banks (sforzando bank 4000): free to use with credit, license text not shipped with the files (see CREDITS.md)
SF2_BANKS = {'Musyng_Kite_sf2', 'just_t4_fixed_sf2', 'The_Normalized_Famicom_Multichip_Bank_V2G_sf2'}
# Channels the browser plays with a synth preset (SYNTHS in src/audio.js) instead of samples: the
# template's Pad is Cowsynth, a medieval bagpipe that does not work as a pad
SYNTH_CHANNELS = {'Pad': 'warm'}


# ---------- template ----------
def template_channels(flp):
    """[(channel name, slot)] for every channel whose plugin state is a sforzando save."""
    b = open(flp, 'rb').read()
    names = [(m.start(), m.group().decode('utf-16le')) for m in re.finditer(rb'(?:[\x20-\x7e\xa0-\xff]\x00){3,}', b)]
    names = [(o, s) for o, s in names if s != 'Fruity Wrapper' and len(s) < 40]
    found, seen = [], set()
    for m in re.finditer(rb'\x78[\x01\x5e\x9c\xda]', b):
        try:
            xml = zlib.decompressobj().decompress(b[m.start():m.start() + 200000]).decode('latin-1')
        except zlib.error:
            continue
        slot = re.search(r'<Slot ([^>]*)>', xml) if '<AriaSave' in xml else None
        if not slot:
            continue
        name = [s for o, s in names if o < m.start()][-1]
        if name in seen:
            continue
        seen.add(name)
        found.append((name, dict(re.findall(r'(\w+)="([^"]*)"', slot.group(1)))))
    return found


def bank_programs(fonts):
    """ARIA bank id → {program name: .sfz path}."""
    banks = {}
    for d, _, files in os.walk(fonts):
        for f in files:
            if f.endswith('.bank.xml'):
                xml = open(os.path.join(d, f), encoding='latin-1').read()
                m = re.search(r'<AriaBank[^>]*\bid="(\d+)"', xml)
                if m:
                    banks[m.group(1)] = {n: os.path.normpath(os.path.join(d, p)) for n, p in
                                         re.findall(r'<AriaProgram\s+name="([^"]+)"[^>]*>\s*<AriaElement\s+path="([^"]+)"', xml)}
    return banks


def sfz_of(slot, banks):
    if slot.get('bankId') == '-1' and slot['name'].endswith('.sfz'):
        return os.path.normpath(slot['name'])
    if slot.get('bankId') == '4000' and slot['name'].startswith('sf2/'):
        return os.path.normpath(os.path.join(ARIA_ROOT, slot['name'] + '.sfz'))
    return banks.get(slot.get('bankId'), {}).get(slot['name'])


def cc0(path, fonts):
    """True when the nearest license or readme above the .sfz is CC0, or it comes from one of SF2_BANKS."""
    if any(f'{os.sep}{b}{os.sep}' in path for b in SF2_BANKS):
        return True
    d = os.path.dirname(path)
    while len(d) >= len(fonts):
        for f in os.listdir(d):
            if re.match(r'(?i)(license|readme)', f) and os.path.isfile(os.path.join(d, f)):
                return 'CC0' in open(os.path.join(d, f), encoding='utf-8', errors='replace').read()
        d = os.path.dirname(d)
    return False


def slug(name):
    s = unicodedata.normalize('NFD', name).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


# ---------- regions ----------
def num(r, k, d=0.0):
    return float(r.get(k, d))


def xfade(r, cc, vel):
    """Gain of the velocity and CC crossfades of a region at the default controllers."""
    g = 1.0
    for kind in ('in', 'out'):
        lo, hi = r.get(f'xf{kind}_lovel'), r.get(f'xf{kind}_hivel')
        if lo is not None and hi is not None:
            lo, hi = float(lo), float(hi)
            x = 1.0 if hi <= lo else min(1, max(0, (vel - lo) / (hi - lo)))
            g *= x if kind == 'in' else 1 - x
        for k in r:
            m = re.match(rf'xf{kind}_locc(\d+)$', k)
            if m and f'xf{kind}_hicc{m.group(1)}' in r:
                lo, hi = num(r, k), num(r, f'xf{kind}_hicc{m.group(1)}')
                v = cc.get(int(m.group(1)), 0)
                x = 1.0 if hi <= lo else min(1, max(0, (v - lo) / (hi - lo)))
                g *= x if kind == 'in' else 1 - x
    return g


def gain(r, cc, vel):
    g = 10 ** (num(r, 'volume') / 20) * num(r, 'amplitude', 100) / 100 * xfade(r, cc, vel)
    for k, v in r.items():
        m = re.match(r'amplitude_(?:on)?cc(\d+)$', k)
        if m:
            g *= float(v) / 100 * cc.get(int(m.group(1)), 0) / 127
    return g


def plays(r, key, vel, cc, sw):
    """True when the region sounds for this key and velocity, on the first round robin, with the
    default controllers and keyswitch."""
    if r['sample'].startswith('*') or r.get('trigger', 'attack') not in ('attack', 'first'):
        return False
    if not (r['lokey'] <= key <= r['hikey'] and r['lovel'] <= vel <= r['hivel']):
        return False
    if int(num(r, 'seq_position', 1)) != 1:
        return False
    if 'sw_last' in r and sw is not None and int(num(r, 'sw_last')) != sw:
        return False
    for k, v in r.items():
        m = re.match(r'(lo|hi)cc(\d+)$', k)
        if m:
            val = cc.get(int(m.group(2)), 0)
            if (m.group(1) == 'lo' and val < float(v)) or (m.group(1) == 'hi' and val > float(v)):
                return False
    return True


def keycenter(r):
    kc = r.get('pitch_keycenter', r.get('key', r['lokey']))
    from sfzregions import note_number
    return note_number(str(kc))


def shift(r, key):
    """Semitones the region's sample is moved to sound at this key."""
    return (key - keycenter(r)) * num(r, 'pitch_keytrack', 100) / 100 + num(r, 'transpose') + num(r, 'tune') / 100


def at_default(r, cc, op, base):
    """An envelope or filter opcode plus its CC modulations (op_onccN, op_ccN) at the default controllers."""
    v = num(r, op, base)
    for k, x in r.items():
        m = re.match(rf'{op}_(?:on)?cc(\d+)$', k)
        if m:
            v += float(x) * cc.get(int(m.group(1)), 0) / 127
    return v


def envelope(r, cc):
    """Attack, hold, decay (seconds) and sustain (0 to 1) of the amplitude envelope."""
    return (max(0, at_default(r, cc, 'ampeg_attack', 0)), max(0, at_default(r, cc, 'ampeg_hold', 0)),
            max(0, at_default(r, cc, 'ampeg_decay', 0)), min(1, max(0, at_default(r, cc, 'ampeg_sustain', 100) / 100)))


def release(r, cc):
    return max(0, at_default(r, cc, 'ampeg_release', 0.001))


def lowpass(r, cc, key, vel):
    """Cutoff in Hz of a low-pass region filter, or None when the region has no filter that cuts."""
    if 'cutoff' not in r or not r.get('fil_type', 'lpf_2p').startswith('lpf'):
        return None
    cents = at_default(r, cc, 'cutoff', 0) - num(r, 'cutoff') \
        + num(r, 'fil_keytrack') * (key - num(r, 'fil_keycenter', 60)) + num(r, 'fil_veltrack') * vel / 127
    hz = num(r, 'cutoff') * 2 ** (cents / 1200)
    return None if hz >= 18000 else max(20.0, hz)


def cut_of(r):
    """(offset, end, loop start, loop end) in samples for regions that point into one big .wav (ARIA conversions of
    .sf2 banks: every instrument shares sf2_smpl.wav); None for ordinary one-file-per-sample libraries."""
    if not any(f'{os.sep}{b}{os.sep}' in os.path.normpath(r['sample']) for b in SF2_BANKS):
        return None
    off, end = int(num(r, 'offset')), int(num(r, 'end'))
    if end <= off:
        return None
    loop = (int(num(r, 'loop_start')), int(num(r, 'loop_end'))) if r.get('loop_mode') == 'loop_continuous' else None
    return (off, end, loop)


def layer(regions, key, vel, cc, sw):
    """[(sample, gain, semitones, envelope, low-pass Hz)] that sound together for this key and velocity."""
    mix = [(r['sample'], gain(r, cc, vel), shift(r, key), envelope(r, cc), lowpass(r, cc, key, vel), cut_of(r))
           for r in regions if plays(r, key, vel, cc, sw)]
    # ffmpeg refuses a resampling rate beyond about 8 MHz, so a single-cycle wave is not stretched more than 6.5 octaves
    return [m for m in mix if m[1] > 0 and abs(m[2]) <= 78 and os.path.exists(m[0])]


# ---------- audio ----------
def ffmpeg(*args):
    return subprocess.run([FFMPEG, '-hide_banner', '-nostdin', '-y', *args], capture_output=True, text=True, check=True)


def render(mix, wav, seconds):
    inputs, chains = [], []
    for i, (path, g, semis, (a, h, d, sus), hz, cut) in enumerate(mix):
        if cut:
            off, end, loop = cut
            inputs += ['-ss', f'{off / SF2_RATE:.6f}', '-t', f'{(end - off + 1) / SF2_RATE:.6f}']
        inputs += ['-i', path]
        pitch = f',asetrate={44100 * 2 ** (semis / 12):.3f},aresample=44100' if abs(semis) > 1e-3 else ''
        filt = f',lowpass=f={hz:.1f}:p=2' if hz else ''
        # attack ramp, hold, decay to the sustain level, sample by sample (volume with eval=frame would
        # mute the first ~23 ms of every hit); quoted so the commas stay inside the expression
        a, d = max(a, 1e-3), max(d, 1e-3)
        env = f",aeval='val(0)*if(lt(t,{a:.4f}),t/{a:.4f},if(lt(t,{a + h:.4f}),1,if(lt(t,{a + h + d:.4f})," \
              f"1-{1 - sus:.4f}*(t-{a + h:.4f})/{d:.4f},{sus:.4f})))'"
        src = f'[{i}]'
        if cut and loop and off <= loop[0] < loop[1] <= end:
            # intro, then the loop body repeated for as long as the note needs
            ls, le = loop[0] - off, loop[1] - off + 1
            if ls == 0:   # single-cycle waveform: the loop is the whole sample
                chains.append(f'[{i}]atrim=end_sample={le},asetpts=N/SR/TB,aloop=loop=-1:size={le}[s{i}]')
            else:
                chains.append(f'[{i}]asplit[i{i}a][i{i}b];[i{i}a]atrim=end_sample={ls}[i{i}c];'
                              f'[i{i}b]atrim=start_sample={ls}:end_sample={le},asetpts=N/SR/TB,aloop=loop=-1:size={le - ls}[i{i}d];'
                              f'[i{i}c][i{i}d]concat=n=2:v=0:a=1[s{i}]')
            src = f'[s{i}]'
        chains.append(f'{src}aresample=44100,aformat=channel_layouts=mono{pitch}{filt}{env},volume={g:.6f}[m{i}]')
    ins = ''.join(f'[m{i}]' for i in range(len(mix)))
    graph = ';'.join(chains) + f';{ins}amix=inputs={len(mix)}:normalize=0,' \
        f'atrim=end={seconds + 1},areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse,' \
        f'atrim=end={seconds},afade=t=out:st={seconds - 0.4}:d=0.4'
    ffmpeg(*inputs, '-filter_complex', graph, '-ar', '44100', '-c:a', 'pcm_f32le', wav)


def peak_db(wav):
    # astats reads the float samples as they are; volumedetect converts to 16 bits and stops at 0 dB
    err = ffmpeg('-i', wav, '-af', 'astats=measure_perchannel=none:measure_overall=Peak_level', '-f', 'null', '-').stderr
    found = re.findall(r'Peak level dB: (-?[\d.]+)', err)
    return float(found[-1]) if found else None   # None: nothing left after the silence trim


def encode(jobs, folder, tmp):
    """jobs: [(file name, mix, seconds)] rendered and normalized together.
    Returns (bytes written, gain in dB, names of the files that came out silent and were left out)."""
    os.makedirs(folder, exist_ok=True)
    wavs, silent = [], []
    for name, mix, seconds in jobs:
        wav = os.path.join(tmp, f'{len(os.listdir(tmp))}.wav')
        render(mix, wav, seconds)
        peak = peak_db(wav)
        if peak is None:
            silent.append(name)
        else:
            wavs.append((name, wav, peak))
    if not wavs:
        return 0, 0.0, silent
    boost = PEAK_DB - max(pk for _, _, pk in wavs)
    total = 0
    for name, wav, _ in wavs:
        out = os.path.join(folder, name)
        ffmpeg('-i', wav, '-af', f'volume={boost:.2f}dB', '-ac', '1', '-c:a', 'libmp3lame', '-q:a', '5', out)
        total += os.path.getsize(out)
    return total, boost, silent


# ---------- build ----------
def drum_notes():
    src = open(os.path.join(ROOT, 'src', 'drums.js'), encoding='utf-8').read()
    block = re.search(r'const DRUMS_ES=\{(.*?)\n\};', src, re.S).group(1)
    return {int(k): ch for k, ch in re.findall(r"(\d+):\{s:'[^']*',n:'[^']*',p:'\w+',ch:'([^']+)'", block)}


def main():
    if not FFMPEG:
        sys.exit('ffmpeg not found: add it to PATH or set FFMPEG')
    flp, fonts = sys.argv[1], os.path.normpath(sys.argv[2])
    global ARIA_ROOT
    ARIA_ROOT = os.path.join(fonts, 'ARIAConverted')
    banks = bank_programs(fonts)
    channels, skipped, oscillators = {}, [], []
    for name, slot in template_channels(flp):
        if name in EXCLUDED_CHANNELS:
            continue
        path = sfz_of(slot, banks)
        if not path or not os.path.exists(path):
            skipped.append(f'{name} ({slot["name"]}: no .sfz)')
            oscillators.append(name)
        elif not cc0(path, fonts):
            skipped.append(f'{name} (no CC0 license)')
            oscillators.append(name)
        else:
            channels[name] = (path, int(slot['sw_last']) if slot.get('sw_last') else None)

    # ONLY="Coro Aahs,Lead": render just those channels and merge them into the manifest already on disk
    only = {n for n in os.environ.get('ONLY', '').split(',') if n}
    if only:
        manifest = json.load(open(os.path.join(OUT, 'manifest.json'), encoding='utf-8'))
        for name in EXCLUDED_CHANNELS:
            manifest['channels'].pop(name, None)
            shutil.rmtree(os.path.join(OUT, slug(name)), ignore_errors=True)
    else:
        if os.path.isdir(OUT):
            shutil.rmtree(OUT)
        manifest = {'drums': {}, 'channels': {}, 'synths': {}, 'profiles': {}}
    report = []
    with tempfile.TemporaryDirectory() as tmp:
        # drums: every note from its own channel, normalized together
        jobs, loaded = [], {}
        for note, ch in ([] if only else sorted(drum_notes().items())):
            if ch not in channels:
                continue
            if ch not in loaded:
                control, regions = program(channels[ch][0])
                loaded[ch] = (regions, cc_defaults(control, regions))
            regions, cc = loaded[ch]
            last = None
            for vel in DRUM_LAYERS:
                mix = layer(regions, note, vel, cc, channels[ch][1])
                if mix and mix != last:
                    jobs.append((f'{note}-{vel}.mp3', mix, DRUM_SECONDS))
                    manifest['drums'].setdefault(str(note), []).append({'v': vel, 'file': f'drums/{note}-{vel}.mp3'})
                    last = mix
        size, boost, silent = encode(jobs, os.path.join(OUT, 'drums'), tmp) if jobs else (0, 0.0, set())
        for note, layers in list(manifest['drums'].items()):
            manifest['drums'][note] = [x for x in layers if x['file'].split('/')[-1] not in silent]
        report.append(f'drums: {len(jobs) - len(silent)} files, {size} bytes, {boost:+.2f} dB' + (f', silent: {silent}' if silent else ''))

        # pitched and unpitched channels, each on its own
        drum_channels = set(drum_notes().values())
        for name, (path, sw) in channels.items():
            if name in drum_channels or (only and name not in only):
                continue
            if name in SYNTH_CHANNELS:
                manifest['synths'][name] = SYNTH_CHANNELS[name]
                report.append(f'{name}: synth {SYNTH_CHANNELS[name]}')
                continue
            control, regions = program(path)
            cc = cc_defaults(control, regions)
            live = [r for r in regions if plays(r, r['lokey'], PITCH_VEL, cc, sw) or any(
                plays(r, k, PITCH_VEL, cc, sw) for k in range(r['lokey'], r['hikey'] + 1))]
            if not live:
                skipped.append(f'{name} (no region at velocity {PITCH_VEL})')
                continue
            # percussion maps one sample per key, often without pitch_keytrack=0
            single = {r['lokey'] for r in live if r['lokey'] == r['hikey']}
            pitched = any(num(r, 'pitch_keytrack', 100) != 0 for r in live) and not (
                len(single) <= 8 and all(r['lokey'] == r['hikey'] for r in live))
            lo, hi = min(r['lokey'] for r in live), max(r['hikey'] for r in live)
            if pitched:
                keys = list(range(lo + PITCH_STEP // 2, hi + 1, PITCH_STEP)) or [lo]
                spans = [(k, max(lo, k - PITCH_STEP // 2), min(hi, k + PITCH_STEP - PITCH_STEP // 2 - 1)) for k in keys]
            else:
                spans = sorted({(r['lokey'], r['lokey'], r['hikey']) for r in live})
            jobs, entries = [], []
            for k, a, b in spans:
                mix = layer(regions, k, PITCH_VEL, cc, sw)
                if not mix:
                    continue
                file = f'{slug(name)}/{k}.mp3'
                jobs.append((f'{k}.mp3', mix, MAX_SECONDS))
                entries.append({'k': k, 'lo': a, 'hi': b, 'file': file})
            if not jobs:
                skipped.append(f'{name} (nothing rendered)')
                continue
            size, boost, silent = encode(jobs, os.path.join(OUT, slug(name)), tmp)
            entries = [e for e in entries if e['file'].split('/')[-1] not in silent]
            if not entries:
                skipped.append(f'{name} (silent)')
                oscillators.append(name)
                continue
            rel = max(release(r, cc) for r in live)
            manifest['channels'][name] = {'pitched': pitched, 'release': round(rel, 3), 'samples': entries}
            report.append(f'{name}: {len(entries)} files, {size} bytes, keys {lo}-{hi}{"" if pitched else ", unpitched"}'
                          + (f', silent: {silent}' if silent else ''))

    # channels without samples still claim their patterns, so they do not fall to another instrument
    manifest['oscillators'] = oscillators
    manifest['profiles'] = {p: c for p, c in PROFILE_CHANNEL.items() if c in manifest['channels'] or c in manifest['synths']}
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))
    total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
    print('\n'.join(report))
    print('left to the oscillators:', '; '.join(skipped) or 'none')
    print(f'total {total} bytes')


if __name__ == '__main__':
    main()
