"""Pick the better of the two ElevenLabs takes of every sound in sfx2/ (name_a.mp3 / name_b.mp3) and
copy it to sfx/<name>.mp3. I can't listen, so each take is measured:
  - every take: clipping, how much of it is silence, and tonality (music-like steady pitches are
    penalised: the brief is organic sound only, no tones or pads);
  - kids' voices: the pitch of the voiced parts (children speak around 250-450 Hz; a take that comes
    out adult-sounding is rejected);
  - beds: steadiness (no sudden loud events that would distract under the narration);
  - single hits (thuds, slaps, puffs): one clear hit, cleanly decaying.
Writes audio/takes_report.txt with the numbers behind each choice."""
import os
import shutil
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'sfx2')
DST = os.path.join(ROOT, 'sfx')
SR = 48000

KIDS = {'kids_gasp', 'kid_oof', 'kids_murmur', 'girl_huh', 'boy_what', 'kids_cheer', 'kids_laugh', 'boy_yawn', 'boy_sigh',
        'girl_sigh', 'boy_sniffle', 'boy_hmm', 'kid_wheee', 'girl_yay', 'snore'}
ADULT = {'woman_tsk', 'man_groan', 'woman_sigh'}
BEDS = {'classroom_tone', 'field_morning', 'park_far_kids', 'garden_birds', 'street_evening', 'hospital_corridor', 'bridge_wind',
        'river', 'runway_wind', 'flag_flap', 'dusk_crickets', 'tree_leaves', 'swing_chains', 'breeze', 'hall_air'}
HITS = {'clock_tick', 'grass_thud', 'hop_thump', 'high_five', 'backpack_land', 'candle_puff', 'chair_creak', 'door_far'}


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def frames(x, w=1024, hop=512):
    n = max(1, (len(x) - w) // hop)
    return np.stack([x[i * hop: i * hop + w] for i in range(n)])


def pitch(x):
    """Median F0 (Hz) of the voiced frames (autocorrelation), and the voiced fraction."""
    f = frames(x, 2048, 512) * np.hanning(2048)
    e = np.sqrt((f ** 2).mean(1))
    loud = e > e.max() * 0.15
    f0s = []
    for fr in f[loud]:
        ac = np.fft.irfft(np.abs(np.fft.rfft(fr, 4096)) ** 2)[:2048]
        lo, hi = SR // 800, SR // 90  # 90-800 Hz
        k = lo + np.argmax(ac[lo:hi])
        if ac[k] > 0.35 * ac[0]:
            f0s.append(SR / k)
    return (float(np.median(f0s)) if f0s else 0.0), len(f0s) / max(1, loud.sum())


def tonality(x):
    """How music-like: the share of energy in narrow steady spectral peaks (0 = noise-like)."""
    f = frames(x, 4096, 2048) * np.hanning(4096)
    S = np.abs(np.fft.rfft(f, axis=1)).mean(0)
    freqs = np.fft.rfftfreq(4096, 1 / SR)
    band = (freqs > 80) & (freqs < 4000)
    s = S[band]
    med = np.convolve(s, np.ones(31) / 31, 'same') + 1e-12
    peaks = s > 4 * med
    return float((s[peaks] ** 2).sum() / ((s ** 2).sum() + 1e-12))


def measures(x):
    e = np.sqrt((frames(x) ** 2).mean(1)) + 1e-9
    db = 20 * np.log10(e)
    clip = float((np.abs(x) > 0.985).mean())
    silent = float((db < db.max() - 40).mean())
    steady = float(np.std(np.diff(db)))  # frame-to-frame loudness jumps
    spikes = float(np.percentile(db, 99) - np.median(db))
    return dict(clip=clip, silent=silent, steady=steady, spikes=spikes, tonal=tonality(x), peak_t=float(np.argmax(e) * 512 / SR))


def score(name, m, f0, voiced):
    s = 0.0
    s -= 400 * m['clip'] + 3 * max(0, m['silent'] - 0.35) + 25 * max(0, m['tonal'] - 0.05)
    if name in KIDS and name != 'snore':
        s += 0.012 * min(f0, 420) - (2.5 if 0 < f0 < 200 else 0) + 0.5 * voiced
    if name in ADULT:
        s += 0.5 * voiced - (1.0 if f0 > 330 else 0)
    if name in BEDS:
        s -= 0.6 * m['steady'] + 0.08 * m['spikes']
    if name in HITS:
        s += 0.05 * m['spikes'] - 2 * max(0, m['silent'] - 0.75)
    return s


def main():
    names = sorted({f.rsplit('_', 1)[0] for f in os.listdir(SRC) if f.endswith('.mp3')})
    lines = []
    for name in names:
        best = None
        for tk in ('a', 'b'):
            p = os.path.join(SRC, f'{name}_{tk}.mp3')
            if not os.path.exists(p):
                continue
            x = load(p)
            m = measures(x)
            f0, voiced = pitch(x) if (name in KIDS or name in ADULT) else (0.0, 0.0)
            sc = score(name, m, f0, voiced)
            lines.append(f"{name}_{tk}: score {sc:6.2f}  len {len(x) / SR:4.1f}s  f0 {f0:5.0f}Hz voiced {voiced:.2f}  tonal {m['tonal']:.3f}  steady {m['steady']:.2f}  spikes {m['spikes']:.1f}  silent {m['silent']:.2f}  clip {m['clip']:.4f}")
            if best is None or sc > best[0]:
                best = (sc, p, tk)
        if best:
            shutil.copy(best[1], os.path.join(DST, f'{name}.mp3'))
            lines.append(f'  -> {name}: take {best[2]}')
    open(os.path.join(ROOT, 'audio', 'takes_report.txt'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    sys.exit(main())
