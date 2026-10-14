"""Sound mix for both versions of the school video (organic sounds only: no music, melodies,
stingers, risers or tonal pads).
  output/school_sfx.wav      ambience beds + spot effects
  output/school_sfx_vo.wav   the same effects, ducked 7 dB while the narrator speaks, plus the voice
Every sound is an ElevenLabs sound-effects clip from sfx/ (see notes.md). Spot effects sit on the
on-screen events (times come from the scene code). Both mixes: 48 kHz, 24-bit stereo, about -14 LUFS
integrated, true peak below -1 dBTP.
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import SR, Bus, put, loop, db, highpass, lowpass  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEN = 85.5
TARGET = -14.0
LINE_LUFS = -30.0
DUCK_DB = 7.0  # effects dip this much while the narrator speaks (spec: 6-8 dB)
VO_FX_GAIN = 14.0  # effects level in the voiceover version, relative to the voice (see the report)

# event times taken from the scene code
POP = 7.62
DROP = 8.45
KIDS = [((306, 1213), (292, 1312)), ((423, 1213), (402, 1304)), ((423, 948), (452, 1262)), ((306, 948), (338, 1274)),
        ((540, 948), (548, 1268)), ((657, 948), (642, 1300)), ((774, 948), (738, 1290))]
THROWS = [19.05, 22.9, 26.25]
BAG_THROW = 28.45 + 0.35
BALL_T = 45.35


def land_times():
    out = []
    for k, (seat, land) in enumerate(KIDS):
        land_y = land[1] - 6 * 1.3
        out.append(DROP + (k % 3) * 0.07 + np.sqrt(2 * max(1, land_y - seat[1]) / 2600))
    return out


def vo_times():
    return json.load(open(os.path.join(ROOT, 'out/vo/timing.json')))


def tick(b, t, gain=-3.0, **kw):
    # one tick of the classroom clock (the clip ticks once a second, first tick at 0.16 s)
    start = 1.05 if int(round(t)) % 2 else 2.05
    put(b, 'clock_tick', t - 0.11, start=start, dur=0.7, gain=gain, fin=0.005, fout=0.2, **kw)


def beds(b):
    # 1 classroom
    loop(b, 'classroom_tone', 0.0, 6.1, gain=-9, fin=0.05, fout=0.9)
    # 2-4 the field where the school stands / stood
    loop(b, 'field_amb', 5.2, 27.4, gain=-10, fin=0.9, fout=0.7)
    loop(b, 'murmurs', 11.6, 18.7, gain=-12, fin=0.7, fout=0.9)
    # 5 montage: park, birds, a little wind
    loop(b, 'park_amb', 27.4, 34.4, gain=-12, fin=0.4, fout=0.6)
    loop(b, 'birds_morning', 27.4, 34.4, gain=-14, fin=0.4, fout=0.6, pan=0.15)
    loop(b, 'wind_soft', 27.4, 34.4, gain=-19, fin=0.6, fout=0.6)
    # 7 curb: wind, distant traffic, a few leaves
    loop(b, 'wind_soft', 42.0, 50.3, gain=-12, fin=0.7, fout=0.8)
    loop(b, 'distant_traffic', 42.0, 50.3, gain=-14, fin=0.7, fout=0.8, lp=5000)
    loop(b, 'leaves_rustle', 42.0, 50.3, gain=-20, fin=0.7, fout=0.8)
    # 8 literacy inset is outdoors: a breath of wind under the diagram
    loop(b, 'wind_soft', 53.9, 58.5, gain=-21, fin=0.5, fout=0.6)
    # 9 future: hallway echo, then wind over the half-built bridge, then the empty airfield
    loop(b, 'hallway_echo', 58.1, 66.2, gain=-11, fin=0.5, fout=0.8, auto=[(58.1, 0), (60.2, 0), (61.0, -6), (66.2, -7)])
    loop(b, 'bridge_wind', 60.1, 66.2, gain=-11, fin=0.4, fout=0.8, auto=[(60.1, 0), (61.6, 0), (62.4, -6), (66.2, -6)])
    loop(b, 'airfield_wind', 61.5, 66.4, gain=-10, fin=0.4, fout=0.8)
    # 10 sad: quiet wind and leaves
    loop(b, 'wind_soft', 65.5, 75.2, gain=-11, fin=0.8, fout=0.9)
    loop(b, 'leaves_rustle', 65.5, 75.2, gain=-13, fin=0.8, fout=0.9)
    # 11 ending: the field again, quieter; everything is gone after the last ring (then silence)
    loop(b, 'field_amb', 74.6, 82.4, gain=-15, fin=0.9, fout=0.9)
    loop(b, 'wind_soft', 74.6, 82.4, gain=-16, fin=0.9, fout=0.9)


def spots(b, big):
    # ---- 1 classroom: the ticking clock, a pencil, a chair, a yawn, a bored sigh
    for s in range(1, 6):
        tick(b, s)
    for s in (6, 7):  # outside now: the school's own clock, distant
        tick(b, s, gain=-13, lp=1800)
    put(b, 'pencil_scratch', 0.25, dur=4.6, gain=-15, fout=0.6, pan=-0.2)
    put(b, 'kid_yawn', 0.7, gain=-8, pan=0.35, fout=0.4)
    put(b, 'chair_creak', 1.0, dur=0.9, gain=-11, pan=0.35, fout=0.2)
    put(b, 'kid_yawn', 1.45, gain=-11, pan=-0.45, pitch=1.1, fout=0.4)
    put(b, 'bored_sigh', 1.5, gain=-5, pan=0.25, fout=0.5)
    # ---- 2 the pop: a soft airy whoosh-pop (peak on POP), the ring, then paper fluttering
    put(big, 'pop_whoosh', POP - 0.47, gain=1, fout=0.4)
    put(b, 'ring_whoosh', POP - 0.2, gain=-9, fout=0.5)
    put(b, 'paper_flutter', POP + 0.1, gain=-4, fin=0.1, fout=1.6, width=1.3)
    # soft cartoon landings on the grass, one thump per kid
    segs = [0.24, 0.42, 0.60, 0.77, 0.93, 1.09, 1.25]
    for k, tl in enumerate(sorted(land_times())):
        put(b, 'soft_thumps', tl - 0.03, start=segs[k], dur=0.2, gain=-5, fout=0.08, pan=(k - 3) * 0.12)
    # ---- 3 confusion: a few "huh?"s and someone getting up off the grass
    put(b, 'huh', 12.3, start=0.25, dur=1.0, gain=-8, pan=-0.3, fout=0.2)
    put(b, 'huh', 14.05, start=3.15, dur=0.85, gain=-9, pan=0.35, fout=0.2)
    put(b, 'huh', 15.7, start=0.25, dur=1.0, gain=-11, pan=0.1, pitch=1.08, fout=0.2)
    for t0, pan in ((13.0, -0.1), (13.5, 0.05), (14.4, 0.3), (15.4, -0.25)):
        put(b, 'footsteps_grass', t0, start=0.3, dur=0.6, gain=-15, pan=pan, fout=0.2)
    # ---- 4 celebration: cheering, laughing, clapping and stomping, a high five, papers thrown
    put(b, 'kids_cheer', 18.55, gain=-4, fin=0.15, fout=1.2, width=1.2)
    put(b, 'kids_laugh', 20.6, gain=-10, fout=1.0, pan=0.2)
    loop(b, 'clap_stomp', 19.2, 27.0, gain=-9, fin=0.3, fout=0.9)
    put(b, 'high_five', 19.6 - 0.05, gain=-4)
    for k, x in enumerate(THROWS):
        put(b, 'papers_toss', x - 0.3, start=1.2, dur=1.6, gain=-8, fout=0.5, pan=0.25 - k * 0.1)
    # a paper flies at the camera (into the montage)
    put(b, 'paper_flutter', 26.8, start=0.3, dur=1.0, gain=-8, fin=0.1, fout=0.4)
    put(b, 'ring_whoosh', 26.95, gain=-13, fout=0.4)
    # ---- 5 montage: sleeping in (a snore), the park (swing creak, paper plane), the backpack
    put(b, 'snore', 27.75, dur=3.2, gain=-10, fin=0.2, fout=0.8)
    put(b, 'swing_creak', 28.05, gain=-12, pan=-0.3, fin=0.3, fout=0.8)
    loop(b, 'swing_creak', 28.05, 34.0, gain=-14, pan=-0.3, fin=0.3, fout=0.8)
    put(b, 'paper_rustle', 29.0, gain=-13, pan=-0.3)
    put(b, 'ring_whoosh', BAG_THROW - 0.3, gain=-16, pitch=1.3, pan=0.35, fout=0.3)
    put(b, 'paper_flutter', BAG_THROW + 0.05, dur=1.3, gain=-13, pan=0.35, fout=0.5)
    put(b, 'backpack_thud', 29.86 - 0.25, gain=-6, pan=0.45)
    put(b, 'ring_whoosh', 34.05, gain=-14, fout=0.4)
    # ---- 6 globe: paper rustle and soft ticks as the school dots go out
    put(b, 'paper_rustle', 34.25, gain=-9)
    put(b, 'soft_ticks', 35.15, dur=1.1, gain=-12, fout=0.3)
    loop(b, 'soft_ticks', 37.3, 40.5, xfade=0.3, gain=-10, fin=0.2, fout=0.5)
    put(b, 'paper_rustle', 36.3, gain=-15, pitch=0.92)
    put(b, 'paper_rustle', 40.6, gain=-15, pitch=1.06)
    put(b, 'paper_rustle', 41.9, gain=-11)
    # ---- 7 curb: calendar ticks, sighs, a single ball bouncing away (nobody chases it)
    put(b, 'soft_ticks', 43.0, dur=3.0, gain=-18, fout=0.4)
    put(b, 'bored_sigh', 44.35, gain=-11, pitch=1.12, pan=0.05)
    put(b, 'ball_bounce', BALL_T - 0.16, dur=2.4, gain=-5, fout=0.9, pan_auto=[(BALL_T, -0.45), (BALL_T + 2.4, 0.75)])
    put(b, 'bored_sigh', 46.2, gain=-11, pan=-0.15)
    # ---- 8 literacy: paper rustle and ticks while the bars draw and fill; letters tumble
    put(b, 'paper_rustle', 50.35, gain=-9)
    put(b, 'soft_ticks', 51.5, dur=1.0, gain=-11, fout=0.3)
    put(b, 'soft_ticks', 52.7, start=1.0, dur=1.2, gain=-11, fout=0.3)
    put(b, 'ring_whoosh', 53.75, gain=-15, fout=0.4)
    put(b, 'paper_rustle', 55.35, gain=-12, pan=-0.1)
    put(b, 'paper_rustle', 56.15, gain=-13, pan=0.1, pitch=0.9)
    loop(b, 'soft_ticks', 54.95, 58.2, xfade=0.3, gain=-19, fin=0.3, fout=0.6)
    # ---- 9 future: each panel lands with a paper rustle; the cockpit inset
    for t0 in (58.3, 60.25, 61.6):
        put(b, 'paper_rustle', t0, gain=-11)
    put(b, 'ring_whoosh', 62.25, gain=-15, fout=0.4)
    # ---- 10 sad: friends' footsteps fading away, one sigh
    put(b, 'footsteps_grass', 68.4, gain=-17, fin=0.5, fout=1.5, pan=0.25, lp=4000)
    put(b, 'bored_sigh', 72.95, gain=-10, pitch=0.96)
    # ---- 11 ending: the same clock tick returns, chalk dust blows away, a last ring, silence
    for s in range(77, 82):
        tick(b, s)
    put(b, 'paper_flutter', 78.4, dur=1.5, gain=-17, fin=0.3, fout=0.6, lp=6000)
    t_ring = max(79.772 + 1.75, 81.4)
    put(big, 'ring_whoosh', t_ring - 0.49, gain=-4, fout=0.6)


def lufs(path):
    out = subprocess.run(['ffmpeg', '-v', 'info', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float([l for l in out.splitlines() if l.strip().startswith('I:')][-1].split()[1])
    TP = float([l for l in out.splitlines() if l.strip().startswith('Peak:')][-1].split()[1])
    return I, TP


def write(path, x, codec='pcm_f32le'):
    x = np.clip(x, -1, 1).astype(np.float32)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', codec, path], input=x.tobytes(), check=True)


def limit(src, dst, gain):
    # gain, then a limiter on a 4x oversampled signal (so true peaks are held too), 24-bit out
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f'volume={gain:.3f}dB,aresample=192000,alimiter=limit=0.79:attack=1:release=60:level=disabled,aresample=48000',
                    '-c:a', 'pcm_s24le', dst], check=True)


def aac_overs(path):
    """Per-10 ms peak (dBFS, 4x oversampled) of the file after an AAC 320 kbps round trip (the
    delivery codec), so peaks the encoder adds can be found and tamed before delivery."""
    enc = path.replace('.wav', '_test.m4a')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-c:a', 'aac', '-b:a', '320k', '-ar', str(SR), enc], check=True)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', enc, '-ac', '2', '-ar', str(SR * 4), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    os.remove(enc)
    y = np.abs(np.frombuffer(raw, np.float32).reshape(-1, 2)).max(1)
    w = SR * 4 // 100
    nb = len(y) // w
    return 20 * np.log10(y[: nb * w].reshape(nb, w).max(1) + 1e-9)


def master(x, path):
    """Fade the tail, cut sub-bass below 35 Hz, normalise to TARGET LUFS with an oversampled limiter,
    then make sure the AAC-encoded result also keeps its true peak below -1 dBTP: find the spots the
    encoder pushes over, turn just those down a little before the limiter, and repeat."""
    n = len(x)
    k = int(0.5 * SR)
    x[n - k:] *= (np.cos(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
    x = highpass(x, 35)
    tmp = path.replace('.wav', '_pre.wav')
    write(tmp, x)

    def settle(gain):
        for _ in range(5):
            limit(tmp, path, gain)
            I2, TP2 = lufs(path)
            if abs(I2 - TARGET) < 0.2:
                break
            gain += TARGET - I2
        return gain

    gain = settle(TARGET - lufs(tmp)[0])
    for _ in range(8):
        pk = aac_overs(path)
        over = np.maximum(0, pk + 1.6)
        if over.max() <= 0:
            break
        nb = len(pk)
        red = np.array([over[max(0, i - 20): i + 21].max() for i in range(nb)])
        red = np.convolve(red, np.hanning(15) / np.hanning(15).sum(), 'same') * 1.4 + (red > 0) * 0.4
        x = x * db(-np.interp(np.arange(len(x)), np.arange(nb) * (SR // 100) + SR // 200, red))[:, None]
        write(tmp, x)
        gain = settle(gain)
    os.remove(tmp)
    I2, TP2 = lufs(path)
    print(f'{os.path.basename(path)}: {I2:.1f} LUFS, true peak {TP2:.1f} dBTP, after AAC 320k {aac_overs(path).max():.1f} dBFS')
    return I2, TP2


def voice_track(timing):
    v = np.zeros(int(LEN * SR))
    for line in timing:
        path = os.path.join(ROOT, 'out/vo', f"line{line['line']:02d}.wav")
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        y = np.frombuffer(raw, np.float32).astype(np.float64)
        y = y * db(LINE_LUFS - lufs(path)[0])  # every line equally loud (separate requests)
        i = int(round(line['start'] * SR))
        v[i:i + len(y)] += y[: len(v) - i]
    # light high-pass and gentle compression; no reverb
    p_in = os.path.join(ROOT, 'out/vo_raw.wav')
    p_out = os.path.join(ROOT, 'out/vo_proc.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-', p_in], input=v.tobytes(), check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p_in, '-af', 'highpass=f=75:poles=2,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=150:makeup=1.5',
                    '-ar', str(SR), p_out], check=True)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p_out, '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)[: int(LEN * SR)]


def speech_activity(timing):
    """0..1 per sample: 1 while a narration line plays (from its start to its end), smoothed with
    ~150 ms attack (starting just before the line) and ~450 ms release."""
    n = int(LEN * SR)
    w = SR // 100
    nb = n // w + 1
    act = np.zeros(nb)
    for line in timing:
        a = int((line['start'] - 0.12) * 100)
        b2 = int((line['start'] + line['dur'] + 0.05) * 100)
        act[max(0, a):b2] = 1
    sm = np.zeros(nb)
    s = 0.0
    up, dn = 1 - np.exp(-1 / 15), 1 - np.exp(-1 / 45)
    for i in range(nb):
        s += (act[i] - s) * (up if act[i] > s else dn)
        sm[i] = s
    return np.interp(np.arange(n), np.arange(nb) * w, sm)


def env400(x):
    """400 ms RMS (speech band) of a mono signal every 10 ms, centred windows."""
    y = lowpass(highpass(x[:, None], 150), 6000)[:, 0]
    w = SR // 100
    n = len(y) // w
    return np.sqrt(np.convolve((y[: n * w].reshape(n, w) ** 2).mean(1), np.ones(40) / 40, 'same')), w


def ceiling(under, v, act, margin=-6.5):
    """While he speaks, the effects never come closer than `margin` dB to the voice (so the words
    stay clear even under the loudest moments); between lines they are left alone."""
    ev, w = env400(v)
    eu, _ = env400(under.mean(1))
    vref = np.maximum(ev, np.percentile(ev[ev > ev.max() * db(-30)], 30))
    a = act[::w][: len(eu)]
    want = np.where(a > 0.5, np.minimum(1.0, vref * db(margin) / (eu + 1e-12)), 1.0)
    g = np.empty(len(want))
    s, dn, up = 1.0, 1 - np.exp(-1 / 4), 1 - np.exp(-1 / 40)
    for i in range(len(want)):
        s += (want[i] - s) * (dn if want[i] < s else up)
        g[i] = s
    return under * np.interp(np.arange(len(under)), np.arange(len(g)) * w + w / 2, g)[:, None]


def main():
    os.makedirs(os.path.join(ROOT, 'output'), exist_ok=True)
    timing = vo_times()
    bed = Bus(LEN)
    fx = Bus(LEN)
    big = Bus(LEN)
    beds(bed)
    spots(fx, big)
    sfx = bed.x + fx.x + big.x
    master(sfx.copy(), os.path.join(ROOT, 'output/school_sfx.wav'))

    v = voice_track(timing)
    act = speech_activity(timing)
    duck = db(-DUCK_DB * act)[:, None]
    under = (bed.x + fx.x + big.x) * db(VO_FX_GAIN) * duck
    vr = np.sqrt((v[np.abs(v) > 1e-4] ** 2).mean())
    v = v / (vr + 1e-12) * db(-16)
    under = ceiling(under, v, act)
    mix = under + np.stack([v, v], 1)
    master(mix, os.path.join(ROOT, 'output/school_sfx_vo.wav'))
    # report how far under the voice the effects sit while he speaks (short-term RMS, speech band)
    band = lambda y: lowpass(highpass(y, 150), 6000)
    vb = band(np.stack([v, v], 1)).mean(1)
    ub = band(under).mean(1)
    w = SR // 2
    rel = []
    vmax = np.sqrt((vb ** 2).mean()) * 3
    for i in range(0, len(v) - w, w):
        if act[i:i + w].min() > 0.95 and np.sqrt((vb[i:i + w] ** 2).mean()) > vmax * db(-20):
            rel.append(20 * np.log10(np.sqrt((vb[i:i + w] ** 2).mean()) / (np.sqrt((ub[i:i + w] ** 2).mean()) + 1e-12)))
    rel = np.array(rel)
    print(f'voice over effects while speaking: median {np.median(rel):.1f} dB, 10th pct {np.percentile(rel, 10):.1f} dB, min {rel.min():.1f} dB (0.5 s windows)')
    # per-scene level of the effects-only mix (RMS dBFS before mastering) so no scene is lost
    from_t = [0, 5.5, 11.5, 18.5, 27.5, 34.5, 42.5, 50, 58.5, 66, 75, 85.5]
    for k in range(11):
        a, b2 = int(from_t[k] * SR), int(from_t[k + 1] * SR)
        print(f'  scene {k + 1:2d}: effects {20 * np.log10(np.sqrt((sfx[a:b2] ** 2).mean()) + 1e-12):6.1f} dBFS')


if __name__ == '__main__':
    main()
