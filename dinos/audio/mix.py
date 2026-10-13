"""Sound mix for both versions (no music anywhere):
  out/sfx_mix.wav        ambience beds + spot effects (the sound-effects-only version)
  out/vo_mix.wav         the same effects ducked under the narration, plus the narrator
Beds crossfade about 0.5 s between scenes; spot effects sit on the on-screen events. Both mixes
are normalised to about -14 LUFS with true peak below -1 dBTP, 48 kHz stereo, and fade to silence
over the last half second.
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import SR, Bus, put, loop, db, lowpass, highpass  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEN = 60.0
GLOW = [50.95, 51.4, 51.85, 52.25, 52.65, 53.05]  # matching bones light up (s09_skeleton.js)


def beds(b):
    loop(b, 'space_rumble', 0.0, 5.3, gain=-5, fin=0.6, fout=0.5)
    loop(b, 'room_tone', 4.8, 11.3, gain=-13, fin=0.5, fout=0.5)
    loop(b, 'forest_amb', 10.6, 17.3, gain=0, fin=0.7, fout=0.3)
    loop(b, 'forest_amb', 17.0, 23.3, gain=-7, fin=0.3, fout=0.6, start=2.0)
    loop(b, 'city_traffic', 22.8, 30.3, gain=-3, fin=0.6, fout=0.5)
    loop(b, 'airport_amb', 29.8, 36.3, gain=-6, fin=0.5, fout=0.5)
    loop(b, 'farm_amb', 35.8, 42.3, gain=-6, fin=0.5, fout=0.5)
    loop(b, 'farm_amb', 41.8, 48.4, gain=-10, fin=0.5, fout=0.6, start=3.0)
    loop(b, 'room_tone', 47.9, 54.3, gain=-11, fin=0.6, fout=0.5)
    loop(b, 'sidewalk_amb', 53.8, 60.0, gain=-6, fin=0.6, fout=0.05)


def spots(b, big):
    # 0:00 asteroid fly-by (peak as it skims past the limb)
    put(b, 'asteroid_whoosh_a', 2.35, gain=-1, fout=0.4, pan=0.0)
    # 0:05 paper rustle as the line-art takes over, ticks as the life dots light up
    put(b, 'paper_rustle', 4.9, gain=-8)
    rng = np.random.default_rng(11)
    for k, t in enumerate(np.linspace(5.85, 7.35, 16)):
        put(b, 'soft_tick', t + rng.uniform(-0.04, 0.04), gain=-13 - rng.uniform(0, 5), pitch=rng.uniform(0.9, 1.15), pan=rng.uniform(-0.4, 0.4))
    for t in np.linspace(8.3, 8.75, 5):
        put(b, 'soft_tick', t, gain=-18, pitch=1.25, pan=rng.uniform(-0.3, 0.3))
    # 0:11 the footstep (big) and the mammal's squeak
    put(big, 'dino_footstep_b', 13.48, gain=3, fout=0.6)
    put(b, 'tiny_squeak', 13.62, gain=-5, pan=-0.25)
    # 0:17 fossil: brush sweeps and a stone scrape
    put(b, 'brush_dust', 17.85, gain=-6, fout=0.4)
    put(b, 'stone_scrape', 17.8, gain=-11)
    put(b, 'brush_dust', 19.0, start=1.2, dur=0.9, gain=-9, fin=0.05, fout=0.3)
    put(b, 'stone_scrape', 19.6, gain=-13, pitch=0.9)
    # 0:23 city: brakes and horns, then the deep call echoing off the walls
    put(b, 'brakes_horns', 25.05, gain=-4)
    put(big, 'dino_call_b', 26.55, gain=-1, fout=0.8)
    # 0:30 airport: huge wingbeats overhead
    put(b, 'wing_flaps_a', 30.75, gain=0)
    put(b, 'wing_flaps_a', 34.12, start=0.7, gain=-4, pitch=0.92)
    # 0:36 farm: snort and a creaking rail
    put(b, 'big_snort', 37.2, gain=-3, pan=0.15)
    put(b, 'fence_creak', 38.1, gain=-6)
    # 0:42 T. rex: low growl and breath (big), the fence rattle
    put(big, 'trex_growl_b', 42.75, gain=2, fout=0.8)
    put(b, 'metal_rattle', 43.98, gain=-3)
    # 0:48 skeletons: soft bone clicks as the bones light up
    for i, t in enumerate(GLOW):
        put(b, 'bone_click', t, gain=-7, pitch=1.0 + 0.04 * i, pan=(-0.2 if i % 2 else 0.2))
    # 0:54 sidewalk: passers-by, a flutter, the pigeon's coo
    put(b, 'footsteps', 54.0, gain=-10, pan=-0.3, fout=0.6)
    put(b, 'footsteps', 55.6, gain=-12, pan=0.35, pitch=1.06, fout=0.6)
    put(b, 'wing_flutter', 56.2, gain=-9, pan=0.2)
    put(b, 'pigeon_coo_a', 57.95, gain=-2, fout=0.4)


def lufs(path):
    out = subprocess.run(['ffmpeg', '-v', 'info', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float([l for l in out.splitlines() if l.strip().startswith('I:')][-1].split()[1])
    TP = float([l for l in out.splitlines() if l.strip().startswith('Peak:')][-1].split()[1])
    return I, TP


def write(path, x):
    x = np.clip(x, -1, 1).astype(np.float32)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', path], input=x.tobytes(), check=True)


def master(x, path):
    """Fade the tail, then normalise to -14 LUFS with a true-peak limiter at -1.2 dBTP."""
    n = len(x)
    k = int(0.5 * SR)
    x[n - k:] *= (np.cos(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
    tmp = path.replace('.wav', '_pre.wav')
    write(tmp, x)
    for _ in range(3):
        I, TP = lufs(tmp)
        gain = -14.0 - I
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-af', f'volume={gain:.3f}dB,alimiter=limit=0.72:attack=1.5:release=60:level=disabled,aresample=48000', '-c:a', 'pcm_f32le', path], check=True)
        I2, TP2 = lufs(path)
        if abs(I2 + 14) < 0.4 and TP2 < -1.8:
            break
        # the limiter shaved some loudness off; push the pre-gain a little and retry
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', tmp, '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        y = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64) * db(-14.0 - I2)
        write(tmp, y)
    os.remove(tmp)
    I2, TP2 = lufs(path)
    print(f'{os.path.basename(path)}: {I2:.1f} LUFS, true peak {TP2:.1f} dBTP')


def voice_track():
    timing = json.load(open(os.path.join(ROOT, 'out/vo/timing.json')))
    v = np.zeros(int(LEN * SR))
    for line in timing:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(ROOT, 'out/vo', f"line{line['line']:02d}.wav"), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        y = np.frombuffer(raw, np.float32).astype(np.float64)
        i = int(line['start'] * SR)
        v[i:i + len(y)] += y[: len(v) - i]
    # light high-pass around 80 Hz and gentle compression; no reverb
    path_in = os.path.join(ROOT, 'out/vo_raw.wav')
    path_out = os.path.join(ROOT, 'out/vo_proc.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-', path_in], input=v.tobytes(), check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path_in, '-af', 'highpass=f=80:poles=2,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=140:makeup=1.5', '-ar', str(SR), path_out], check=True)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path_out, '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    v = np.frombuffer(raw, np.float32).astype(np.float64)[: int(LEN * SR)]
    return v, timing


def duck_curve(v, depth_db):
    """Gain curve (linear) that dips by depth_db while the voice speaks, with smooth fades."""
    w = SR // 100
    n = len(v) // w
    e = np.sqrt((v[: n * w].reshape(n, w) ** 2).mean(1))
    active = (e > e.max() * db(-38)).astype(float)
    # bridge short gaps inside a line, then smooth: ~120 ms attack, ~350 ms release
    act = np.convolve(active, np.ones(25), 'same') > 0
    sm = np.zeros(n)
    a_up = 1 - np.exp(-1 / 12)
    a_dn = 1 - np.exp(-1 / 35)
    s = 0.0
    for i in range(n):
        target = 1.0 if act[i] else 0.0
        s += (target - s) * (a_up if target > s else a_dn)
        sm[i] = s
    g = db(-depth_db * sm)
    return np.interp(np.arange(len(v)), np.arange(n) * w + w / 2, g)


def main():
    os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
    bed = Bus(LEN)
    fx = Bus(LEN)
    big = Bus(LEN)
    beds(bed)
    spots(fx, big)
    sfx = bed.x + fx.x + big.x
    master(sfx.copy(), os.path.join(ROOT, 'out/sfx_mix.wav'))

    v, timing = voice_track()
    duck_beds = duck_curve(v, 8.0)
    duck_fx = duck_curve(v, 6.0)
    duck_big = duck_curve(v, 3.0)
    under = bed.x * duck_beds[:, None] + fx.x * duck_fx[:, None] + big.x * duck_big[:, None]
    # voice level: sit the narration clearly on top (about 9 dB above the ducked effects)
    vi = v / (np.sqrt((v[np.abs(v) > 1e-4] ** 2).mean()) + 1e-9) * db(-17)
    mix = under + np.stack([vi, vi], 1)
    master(mix, os.path.join(ROOT, 'out/vo_mix.wav'))


if __name__ == '__main__':
    main()
