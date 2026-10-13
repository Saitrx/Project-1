"""Sound mix for both versions (no music anywhere):
  out/sfx_mix.wav        ambience beds + spot effects (the sound-effects-only version)
  out/vo_mix.wav         the same effects ducked under the narration, plus the narrator
Beds crossfade about 0.5 s between scenes; spot effects sit on the on-screen events. Both mixes
are normalised to about -12 LUFS with true peak below -1 dBTP, 48 kHz stereo, and fade to silence
over the last half second.
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import SR, Bus, put, loop, load, shape, db, lowpass, highpass  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEN = 60.0
GLOW = [50.95, 51.4, 51.85, 52.25, 52.65, 53.05]  # matching bones light up (s09_skeleton.js)
TARGET = -12.0  # integrated loudness (LUFS) of both mixes
LINE_LUFS = -31.5  # each narration line is levelled to this before the voice processing


# Deep sounds get extra harmonics so phone speakers (which can't play sub-bass) still carry them.
DEEP = {
    'space_rumble': dict(drive=2.5, wet=-10, out_hp=150),  # only a faint trace, so it stays clean
    'farm_amb': dict(drive=6, wet=-2),
    'dino_footstep_b': dict(drive=8, wet=12, lo=20, out_hp=250),
    'dino_call_b': dict(drive=10, wet=4),
    'wing_flaps_a': dict(drive=10, wet=5),
    'big_snort': dict(drive=10, wet=4),
    'trex_growl_b': dict(drive=10, wet=4),
}
HAVE = {f[:-4] for f in os.listdir(os.path.join(ROOT, 'sfx'))}


def P(bus, name, t, **kw):
    if name not in HAVE:
        print('missing sound, skipped:', name)
        return
    if name in DEEP and 'enhance' not in kw:
        kw['enhance'] = DEEP[name]
    put(bus, name, t, **kw)


def L(bus, name, t0, t1, **kw):
    if name in DEEP and 'enhance' not in kw:
        kw['enhance'] = DEEP[name]
    loop(bus, name, t0, t1, **kw)


def stretch(x, factor):
    """Time-stretch a stereo clip by `factor` with the pitch unchanged (ffmpeg rubberband)."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-af', f'rubberband=tempo={1 / factor:.4f}', '-f', 'f32le', '-'],
                         input=x.astype(np.float32).tobytes(), capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)


def meteor():
    """The single meteor sound: the meteor2_b fly-by with its 1.2 s build stretched 3x, so it is
    heard coming from far away and peaks 3.6 s in. The sub-bass below 45 Hz is cut and the 150-700 Hz
    body lifted about 5 dB (a clean, linear EQ, no saturation) so phone speakers carry it."""
    x = load('meteor2_b')
    k, f = int(1.2 * SR), int(0.1 * SR)
    head = stretch(x[:k + f], 3.0)[: int(3.0 * k) + f]
    a = np.sin(np.linspace(0, np.pi / 2, f))[:, None]
    x = np.concatenate([head[:-f], head[-f:] * a[::-1] + x[k:k + f] * a, x[k + f:]])
    x = highpass(x, 45)
    return x + highpass(lowpass(x, 700), 150) * (db(5) - 1)


def beds(b, room=True):
    # room=False leaves out the room tone under the two diagram scenes (globe, skeletons): nothing on
    # screen makes it, so the voiceover version keeps those scenes quiet apart from their own sounds
    L(b, 'space_rumble', 0.0, 5.3, gain=-5, fin=0.4, fout=0.6, auto=[(0.0, -6), (3.6, 0)])
    if room:
        L(b, 'room_tone', 4.8, 11.3, gain=-4, fin=0.5, fout=0.5)
    L(b, 'forest_amb', 10.6, 17.3, gain=1, fin=0.7, fout=0.3)
    L(b, 'forest_amb', 17.0, 23.3, gain=-5, fin=0.3, fout=0.6, start=2.0)
    L(b, 'city_traffic', 22.8, 30.3, gain=0, fin=0.6, fout=0.5)
    L(b, 'airport_amb', 29.8, 36.3, gain=-2, fin=0.5, fout=0.5)
    L(b, 'farm_amb', 35.8, 42.3, gain=-3, fin=0.5, fout=0.5)
    L(b, 'farm_amb', 41.8, 48.4, gain=-7, fin=0.5, fout=0.6, start=3.0)
    if room:
        L(b, 'room_tone', 47.9, 54.3, gain=-3, fin=0.6, fout=0.5)
    L(b, 'sidewalk_amb', 53.8, 60.0, gain=-2, fin=0.6, fout=0.05)


def spots(b, big):
    # 0:00 the meteor: one clean fly-by that grows as it approaches, peaks as it skims past Earth
    # (~4.2 s) and travels right to left with it; under it only the soft space rumble
    b.add(shape(meteor(), 0.6, gain=0, fin=0.3, fout=0.8, pan_auto=[(2.4, 0.45), (3.85, 0.05), (4.95, -0.5)]), 0.6)
    # 0:05 line-art: a soft zoom as Earth turns into its drawing; then, with the narration, an airy
    # shimmer as the life dots light up (sweeping left to right), a smooth sweep as the donut fills to
    # 75% ("seventy-five percent"), and a warmer, lower shimmer as the dots flare back ("survived")
    P(b, 'zoom_b', 4.58, gain=-3, hp=70)
    P(b, 'dots_shimmer_a', 5.2, gain=-7, hp=900, lp=9000, fin=0.2, fout=0.7, pan_auto=[(5.3, -0.35), (6.5, 0.35)])
    P(b, 'ring_sweep_a', 5.85, gain=-5, hp=120, lp=6000, pan=-0.35)
    P(b, 'dots_shimmer_b', 8.45, gain=-8, pitch=0.85, hp=600, lp=8000, fin=0.15, fout=0.8)
    P(b, 'zoom_b', 10.2, gain=-3, hp=70, pitch=0.92)  # push into the dot; the circle opens into the forest
    # 0:11 forest: the foot comes down (air), smashes the ground (thud + crunch + leaves), lifts away
    P(b, 'swoosh', 12.75, gain=-3, pitch=0.62)
    P(big, 'dino_footstep_b', 13.48, gain=3, fout=0.6, hp=45)
    P(big, 'ground_smash', 13.46, gain=1)
    P(b, 'leaves_shake', 13.52, gain=-1)
    P(b, 'tiny_squeak', 13.62, gain=0, pan=-0.3)
    P(b, 'leaves_shake', 14.95, start=0.4, gain=-6, pitch=1.05)
    P(b, 'swoosh', 15.0, gain=-5, pitch=0.7)
    P(b, 'tiny_squeak', 16.25, gain=-6, pitch=1.1, pan=-0.3)
    # 0:17 fossil inset: it grows, a brush sweeps, stone scrapes, the outline ticks on, the ring
    P(b, 'swoosh', 16.95, gain=-4, pitch=1.15)
    P(b, 'brush_dust', 17.85, gain=-1, fout=0.4)
    P(b, 'stone_scrape', 17.8, gain=-5)
    P(b, 'brush_dust', 19.0, start=1.2, dur=0.9, gain=-4, fin=0.05, fout=0.3)
    P(b, 'stone_scrape', 19.6, gain=-7, pitch=0.9)
    for t in (18.65, 18.95, 19.25):
        P(b, 'soft_tick', t, gain=-11, pitch=1.1)
    P(b, 'soft_tick', 20.45, gain=-8, pitch=0.9)
    P(b, 'swoosh', 22.55, gain=-5, pitch=1.3)  # inset shrinks into the sun
    # 0:23 city: a huge exhale as the neck rises, brakes and horns, then the deep call
    P(big, 'big_snort', 24.3, gain=-2, pitch=0.72)
    P(b, 'brakes_horns', 25.05, gain=0)
    P(big, 'dino_call_b', 26.55, gain=2, fout=0.8)
    # 0:30 airport: huge wingbeats overhead, a second flap, the measuring lines tick on
    P(big, 'wing_flaps_a', 30.75, gain=3, pan_auto=[(31.0, 0.5), (34.0, -0.5)])
    P(b, 'wing_flaps_a', 34.12, start=0.7, gain=-1, pitch=0.92, pan=-0.4)
    P(b, 'soft_tick', 32.35, gain=-9)
    P(b, 'soft_tick', 33.05, gain=-9, pitch=1.1)
    # 0:36 farm: snort, creaking rail; the balance opens on "weighs", the Triceratops then the
    # elephant land on their pans (soft ticks) and the beam settles
    P(big, 'big_snort', 37.2, gain=1, pan=0.15)
    P(b, 'swoosh', 37.3, gain=-9, pitch=1.2)
    P(b, 'fence_creak', 38.1, gain=-1)
    P(b, 'soft_tick', 37.9, gain=-9, pitch=0.85, pan=-0.3)
    P(b, 'soft_tick', 38.77, gain=-9, pitch=0.8, pan=0.3)
    P(b, 'soft_tick', 39.47, gain=-11, pitch=1.05)
    P(big, 'big_snort', 40.75, gain=-4, pitch=1.05, pan=0.15)
    # 0:42 T. rex: growl and snarl (big), the fence rattles, the chart slides in, bars grow
    for t in (41.75, 45.9, 47.0):
        P(big, 'big_snort', t, dur=1.6, gain=-3, pitch=0.62, fout=0.4)
    P(big, 'trex_growl_b', 42.75, gain=4, fout=0.8)
    P(big, 'trex_snarl', 43.15, gain=0)
    P(b, 'metal_rattle', 43.98, gain=1)
    # the bite chart opens on "bites"; the lion's bar is set down, the T. rex bar sweeps out to 8x
    P(b, 'swoosh', 43.1, gain=-9, pitch=1.2)
    P(b, 'soft_tick', 43.62, gain=-9, pitch=0.95)
    P(b, 'ring_sweep_a', 43.72, gain=-12, hp=150, lp=6000, pitch=1.1)
    P(b, 'soft_tick', 44.5, gain=-9, pitch=0.85)
    # 0:48 skeletons: the dissolve, the morph, bone clicks as the bones light up
    P(b, 'swoosh', 47.55, gain=-3, pitch=0.85)
    rng = np.random.default_rng(11)
    for k, t in enumerate(np.arange(47.8, 49.6, 0.16)):
        P(b, 'bone_click', t, gain=-9 - (k % 3) * 2, pitch=1.1 + (k % 4) * 0.06, pan=rng.uniform(-0.5, 0.5))
    P(b, 'swoosh', 49.65, gain=-5, pitch=1.0)
    for i, t in enumerate(GLOW):
        P(b, 'bone_click', t, gain=-2, pitch=1.0 + 0.04 * i, pan=(-0.25 if i % 2 else 0.25))
    # 0:54 sidewalk: passers-by, little pigeon steps, a flutter, the coo
    P(b, 'swoosh', 53.6, gain=-7, pitch=0.9)
    P(b, 'footsteps', 54.0, gain=-5, pan=-0.3, fout=0.6)
    P(b, 'footsteps', 55.6, gain=-7, pan=0.35, pitch=1.06, fout=0.6)
    for k, t in enumerate(np.arange(54.7, 57.2, 0.21)):
        P(b, 'soft_tick', t, gain=-13 - (k % 2) * 2, pitch=1.6 + (k % 3) * 0.08, pan=0.3)
    P(b, 'wing_flutter', 56.2, gain=-4, pan=0.2)
    P(b, 'pigeon_coo_a', 57.95, gain=2, fout=0.4)


def lufs(path):
    out = subprocess.run(['ffmpeg', '-v', 'info', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float([l for l in out.splitlines() if l.strip().startswith('I:')][-1].split()[1])
    TP = float([l for l in out.splitlines() if l.strip().startswith('Peak:')][-1].split()[1])
    return I, TP


def write(path, x):
    x = np.clip(x, -1, 1).astype(np.float32)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', path], input=x.tobytes(), check=True)


def limit(src, dst, gain):
    # volume, then a limiter on a 4x oversampled signal (so true peaks are held too)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f'volume={gain:.3f}dB,aresample=192000,alimiter=limit=0.8:attack=1:release=60:level=disabled,aresample=48000', '-c:a', 'pcm_f32le', dst], check=True)


def aac_overs(path):
    """Per-10 ms peak (dBFS, 4x oversampled) of the file after an AAC 256k round trip."""
    enc = path.replace('.wav', '_test.m4a')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-c:a', 'aac', '-b:a', '256k', '-ar', str(SR), enc], check=True)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', enc, '-ac', '2', '-ar', str(SR * 4), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    os.remove(enc)
    y = np.abs(np.frombuffer(raw, np.float32).reshape(-1, 2)).max(1)
    w = SR * 4 // 100
    nb = len(y) // w
    return 20 * np.log10(y[: nb * w].reshape(nb, w).max(1) + 1e-9)


def master(x, path):
    """Fade the tail, cut sub-bass below 38 Hz, normalise to TARGET LUFS with an oversampled limiter,
    then make sure the AAC-encoded result also keeps its true peak below -1 dBTP."""
    n = len(x)
    k = int(0.5 * SR)
    x[n - k:] *= (np.cos(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
    x = highpass(x, 38)
    tmp = path.replace('.wav', '_pre.wav')
    write(tmp, x)

    def settle(gain):
        for _ in range(4):
            limit(tmp, path, gain)
            I2, _ = lufs(path)
            if abs(I2 - TARGET) < 0.25:
                break
            gain += TARGET - I2
        return gain

    gain = settle(TARGET - lufs(tmp)[0])
    # AAC can overshoot heavy low-frequency hits: find those spots after an encode and turn just
    # them down a little before the limiter; repeat until the encoded file stays below -1 dBTP.
    for _ in range(6):
        pk = aac_overs(path)
        over = np.maximum(0, pk + 1.5)
        if over.max() <= 0:
            break
        nb = len(pk)
        red = np.array([over[max(0, i - 20): i + 21].max() for i in range(nb)])
        red = np.convolve(red, np.hanning(15) / np.hanning(15).sum(), 'same') * 1.4 + (red > 0) * 0.3
        x = x * db(-np.interp(np.arange(len(x)), np.arange(nb) * (SR // 100) + SR // 200, red))[:, None]
        write(tmp, x)
        gain = settle(gain)
    os.remove(tmp)
    I2, TP2 = lufs(path)
    print(f'{os.path.basename(path)}: {I2:.1f} LUFS, true peak {TP2:.1f} dBTP, after AAC {aac_overs(path).max():.1f} dBFS')


def voice_track():
    timing = json.load(open(os.path.join(ROOT, 'out/vo/timing.json')))
    v = np.zeros(int(LEN * SR))
    for line in timing:
        path = os.path.join(ROOT, 'out/vo', f"line{line['line']:02d}.wav")
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        y = np.frombuffer(raw, np.float32).astype(np.float64)
        y = y * db(LINE_LUFS - lufs(path)[0])  # every line equally loud (they came from separate requests)
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


# Voiceover version: the narration leads. Under it, beds and effects are ducked hard above XOVER
# but only gently in the deep lows, so impacts keep their weight without covering the words. Two
# riders follow: one keeps the speech band clear while he speaks, one keeps every effect below the
# voice, also between lines.
XOVER = 150            # Hz
VOICE_LEVEL = db(-17)  # RMS of the narration while speaking
VO_BED_GAIN = -4.0     # ambience beds sit lower in the voiceover version
DUCK = {'bed': (6.0, 18.0), 'fx': (6.0, 15.0), 'big': (6.0, 15.0)}  # dB: (below XOVER, above)
CEILING = -3.0         # effects stay this far under the voice level (400 ms RMS, above 120 Hz)
CLEAR = -17.0          # while he speaks, effects in the speech band stay this far under the voice


def ceiling(x, ref):
    """Turn x down wherever its 400 ms loudness (lows ignored) would rise above ref (linear RMS)."""
    e, w = rms400(highpass(x, 120).mean(1))
    want = np.minimum(1.0, ref / (e + 1e-12))
    g = np.empty(len(want))
    s, a_dn, a_up = 1.0, 1 - np.exp(-1 / 3), 1 - np.exp(-1 / 40)  # ~30 ms down, ~400 ms back up
    for i in range(len(want)):
        s += (want[i] - s) * (a_dn if want[i] < s else a_up)
        g[i] = s
    return x * np.interp(np.arange(len(x)), np.arange(len(g)) * w + w / 2, g)[:, None]


def rms400(x):
    """400 ms RMS of a mono signal every 10 ms (centred windows)."""
    w = SR // 100
    n = len(x) // w
    return np.sqrt(np.convolve((x[: n * w].reshape(n, w) ** 2).mean(1), np.ones(40) / 40, 'same')), w


def vo_under(bed, fx, big, v):
    """Beds and effects for the voiceover version, ducked under the narration v (mono)."""
    lo_sum, hi_sum = 0, 0
    for x, (lo_db, hi_db), gain in ((bed, DUCK['bed'], VO_BED_GAIN), (fx, DUCK['fx'], 0.0), (big, DUCK['big'], 0.0)):
        lo = lowpass(x, XOVER)
        lo_sum = lo_sum + lo * duck_curve(v, lo_db)[:, None] * db(gain)
        hi_sum = hi_sum + (x - lo) * duck_curve(v, hi_db)[:, None] * db(gain)
    # keep the words clear: in the speech band the effects stay CLEAR dB under the voice while he speaks
    speech = lambda y: lowpass(highpass(y[:, None], 200), 5000)[:, 0]
    ev, w = rms400(speech(v / (np.sqrt((v[np.abs(v) > 1e-4] ** 2).mean()) + 1e-9) * VOICE_LEVEL))
    eu, _ = rms400(speech((lo_sum + hi_sum).mean(1)))
    want = np.where(ev > VOICE_LEVEL * db(-20), np.minimum(1.0, ev * db(CLEAR) / (eu + 1e-12)), 1.0)
    g = np.empty(len(want))
    s, a_dn, a_up = 1.0, 1 - np.exp(-1 / 3), 1 - np.exp(-1 / 30)
    for i in range(len(want)):
        s += (want[i] - s) * (a_dn if want[i] < s else a_up)
        g[i] = s
    # (the deep lows get half the reduction in dB, so impacts like the stomp keep their weight)
    gs = np.interp(np.arange(len(hi_sum)), np.arange(len(g)) * w + w / 2, g)[:, None]
    under = lo_sum * np.sqrt(gs) + hi_sum * gs
    return ceiling(under, VOICE_LEVEL * db(CEILING))


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
    vi = v / (np.sqrt((v[np.abs(v) > 1e-4] ** 2).mean()) + 1e-9) * VOICE_LEVEL
    bed_vo = Bus(LEN)
    beds(bed_vo, room=False)
    mix = vo_under(bed_vo.x, fx.x, big.x, v) + np.stack([vi, vi], 1)
    master(mix, os.path.join(ROOT, 'out/vo_mix.wav'))


if __name__ == '__main__':
    main()
