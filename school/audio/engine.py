"""Tiny numpy mixer for the soundtrack (shared with the cars video): clips are placed on buses with gain/fade/pan/filter/pitch
automation, then summed. Everything runs at 48 kHz stereo float64."""
import os
import subprocess

import numpy as np

SR = 48000
CLIPS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'sfx')
_cache = {}


def db(x):
    return 10 ** (x / 20)


def load(name):
    if name not in _cache:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(CLIPS, name + '.mp3'), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                             capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
        # Normalise every clip so its active part (frames within 30 dB of its loudest) sits at
        # -20 dBFS RMS; cue gains are then relative to that.
        w = SR // 20
        n = len(x) // w
        e = (x[: n * w].reshape(n, w, 2) ** 2).mean((1, 2))
        active = e[e > e.max() * 1e-3]
        x *= db(-20) / np.sqrt(active.mean())
        _cache[name] = x
    return _cache[name]


def _shelf(x, hz, high):
    # Smooth 2nd-order (Butterworth magnitude) low/high-pass in the frequency domain; zero phase.
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    r = (f / hz) ** 4
    X *= (np.sqrt(r / (1 + r)) if high else 1 / np.sqrt(1 + r))[:, None]
    return np.fft.irfft(X, n=len(x), axis=0)


def lowpass(x, hz):
    return _shelf(x, hz, False)


def highpass(x, hz):
    return _shelf(x, hz, True)


def repitch(x, ratio):
    # ratio < 1 plays slower and lower (bigger), like a tape slowed down.
    n = int(len(x) / ratio)
    idx = np.arange(n) * ratio
    src = np.arange(len(x))
    return np.stack([np.interp(idx, src, x[:, c]) for c in range(2)], 1)


def curve(n, t0, points):
    """Per-sample dB curve for a clip starting at absolute time t0, from [(t_abs, dB), ...]."""
    t = t0 + np.arange(n) / SR
    pt = [p[0] for p in points]
    return db(np.interp(t, pt, [p[1] for p in points]))


class Bus:
    def __init__(self, length):
        self.x = np.zeros((int(length * SR), 2))

    def add(self, sig, t):
        i = int(round(t * SR))
        if i < 0:
            sig, i = sig[-i:], 0
        n = min(len(sig), len(self.x) - i)
        if n > 0:
            self.x[i:i + n] += sig[:n]


def excite(x, drive=4.0, wet=0.0, lo=35, hi=320, out_hp=170, out_lp=3800):
    """Make deep sounds audible on phone speakers: saturate the bass band to create harmonics in the
    200 Hz - 2 kHz range (where small speakers work), then mix them in, level-matched to the bass."""
    b = lowpass(highpass(x, lo), hi)
    pk = np.abs(b).max() + 1e-9
    z = np.tanh(drive * b / pk)
    z = z + 0.35 * z ** 2  # a little even-order too
    z = lowpass(highpass(z, out_hp), out_lp)
    z *= np.sqrt((b ** 2).mean()) / (np.sqrt((z ** 2).mean()) + 1e-12) * db(wet)
    return x + z


def shape(x, t, gain=0.0, fin=0.01, fout=0.08, pan=0.0, lp=None, hp=None, auto=None, width=1.0, enhance=None, pan_auto=None):
    x = x.copy()
    if enhance:
        x = excite(x, **enhance)
    if hp:
        x = highpass(x, hp)
    if lp:
        x = lowpass(x, lp)
    if width != 1.0:
        mid = x.mean(1, keepdims=True)
        x = mid + (x - mid) * width
    n = len(x)
    g = np.full(n, db(gain))
    if fin > 0:
        k = min(n, int(fin * SR))
        g[:k] *= np.sin(np.linspace(0, np.pi / 2, k)) ** 2
    if fout > 0:
        k = min(n, int(fout * SR))
        g[n - k:] *= np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    if auto:
        g *= curve(n, t, auto)
    x *= g[:, None]
    if pan:
        x[:, 0] *= min(1.0, 1 - pan)
        x[:, 1] *= min(1.0, 1 + pan)
    if pan_auto:
        tt = t + np.arange(n) / SR
        pa = np.interp(tt, [p[0] for p in pan_auto], [p[1] for p in pan_auto])
        x[:, 0] *= np.minimum(1.0, 1 - pa)
        x[:, 1] *= np.minimum(1.0, 1 + pa)
    return x


def put(bus, name, t, start=0.0, dur=None, pitch=1.0, **kw):
    """Place clip `name` at time t (seconds), optionally trimmed from `start` for `dur` seconds."""
    x = load(name)
    if pitch != 1.0:
        x = repitch(x, pitch)
    x = x[int(start * SR):]
    if dur is not None:
        x = x[:int(dur * SR)]
    bus.add(shape(x, t, **kw), t)


def loop(bus, name, t0, t1, xfade=1.5, start=0.0, pitch=1.0, **kw):
    """Fill t0..t1 with `name`, repeating it with equal-power crossfades."""
    x = load(name)
    if pitch != 1.0:
        x = repitch(x, pitch)
    x = x[int(start * SR):]
    need = int((t1 - t0) * SR)
    k = int(xfade * SR)
    out = x.copy()
    a = np.sin(np.linspace(0, np.pi / 2, k))[:, None]
    while len(out) < need:
        out = np.concatenate([out[:-k], out[-k:] * a[::-1] + x[:k] * a, x[k:]])
    bus.add(shape(out[:need], t0, **kw), t0)


def reverb(x, rt=0.9, wet=-14.0, pre=0.012, seed=5):
    """Short outdoor-street style reverb: decaying stereo noise IR with a few early slaps."""
    rng = np.random.default_rng(seed)
    n = int(rt * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)) * np.exp(-6.9 * t / rt)[:, None]
    for d, a in ((0.031, 0.5), (0.047, 0.35), (0.083, 0.25)):
        j = int(d * SR)
        ir[j] += a * rng.choice([-1, 1], 2)
    ir = lowpass(ir, 4500)
    ir /= np.sqrt((ir ** 2).sum(0))
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir])
    m = len(x) + len(ir)
    L = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, L, axis=0) * np.fft.rfft(ir, L, axis=0), L, axis=0)[:len(x)]
    return x + y * db(wet)


def muffle(x, points, stages=(260, 700, 1800, 5000)):
    """Time-varying 'underwater / half-asleep' filter. points: [(t, m)] with m in 0..1
    (1 = fully muffled through stages[0], 0 = dry). Crossfades between pre-filtered copies."""
    t = np.arange(len(x)) / SR
    m = np.clip(np.interp(t, [p[0] for p in points], [p[1] for p in points]), 0, 1)
    layers = [x] + [lowpass(x, hz) for hz in reversed(stages)]  # dry, 5k, 1.8k, 700, 260
    pos = m * (len(layers) - 1)
    out = np.zeros_like(x)
    for i, layer in enumerate(layers):
        w = np.clip(1 - np.abs(pos - i), 0, 1)
        if w.any():
            out += layer * w[:, None]
    return out
