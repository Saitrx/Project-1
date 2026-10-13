"""Fit the ElevenLabs narration (vo/*.mp3) to the scenes.

Each caption line is one or two takes (lines 6, 8 and 11 were generated as two requests). For every
line: trim the silence around each part, join the parts with a natural pause, shorten over-long
pauses inside a part, and if the line would still run past its scene, speed it up slightly
(ffmpeg atempo, pitch unchanged, at most 1.12x). The line starts 0.3 s into its scene.
Writes:
  out/vo/lineNN.wav     the fitted line, 48 kHz mono
  src/vo_timing.js      when each line and each caption chunk starts (used by the renderer)
  out/vo/timing.json    the same, for the mixer
"""
import json
import os
import subprocess
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
sys.path.insert(0, os.path.join(ROOT, 'src'))
LEAD = 0.3


def scene_starts():
    # Read the scene boundaries from src/timeline.js (SCENES = [...]).
    src = open(os.path.join(ROOT, 'src/timeline.js')).read()
    a = src.index('export const SCENES = [') + len('export const SCENES = [')
    b = src.index(']', a)
    return [float(v) for v in src[a:b].split(',') if v.strip()]


# (caption chunks with their source part files). A chunk starts when its part starts.
LINES = [
    [('What if all the schools|disappeared?', 'line01')],
    [("One second it's there...", 'line02')],
    [('...the next, every school|on Earth is gone.', 'line03')],
    [("For kids, it's|the best day ever.", 'line04', 0), ("The teachers|aren't smiling.", 'line04', 1)],
    [('No homework.', 'line05', 0), ('No homework. No tests.', 'line05', 1), ('No homework. No tests.|No alarms.', 'line05', 2)],
    [("We've had a preview.", 'line06a'), ('In 2020, schools closed for over|1.5 billion students.', 'line06b')],
    [('Within weeks,|the fun runs out.', 'line07')],
    [('In 1820, only 12% of people|could read.', 'line08a'), ('Without schools,|we slowly slide back.', 'line08b')],
    [('No new doctors.', 'line09', 0), ('No new doctors.|No engineers.', 'line09', 1), ('No new doctors.|No engineers. No pilots.', 'line09', 2)],
    [('And kids lose the place|where they made friends.', 'line10')],
    [("He's bored again.", 'line11a', 0), ("This time, there's|nothing to learn.", 'line11a', 1), ('Would you still|wish for it?', 'line11b')],
]
# chosen takes
TAKES = {
    'line01': 'line01_UuQi', 'line02': 'line02_yJVm', 'line03': 'line03_PGYq', 'line04': 'line04_9uMA',
    'line05': 'line05_oI6L', 'line06a': 'line06a_6rRR', 'line06b': 'line06b_MVHc', 'line07': 'line07_oVJ6',
    'line08a': 'line08a_QhSI', 'line08b': 'line08b_LP4y', 'line09': 'line09_bTNv', 'line10': 'line10_EDUC',
    'line11a': 'line11a_PLYN', 'line11b': 'line11b_qzgv',
}
# pause between two parts of one line, and max kept length of pauses inside a part
PART_GAP = {'line06b': 0.42, 'line08b': 0.5, 'line11b': 0.75}
MAX_PAUSE = 0.42


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def activity(x):
    w = SR // 100
    n = len(x) // w
    e = 10 * np.log10((x[: n * w].reshape(n, w) ** 2).mean(1) + 1e-12)
    return e > e.max() - 38, w


def pauses(act):
    idx = np.where(act)[0]
    out, run = [], 0
    for i in range(idx[0], idx[-1] + 1):
        if not act[i]:
            run += 1
        else:
            if run >= 14:
                out.append((i - run, i))
            run = 0
    return idx[0], idx[-1] + 1, out


def tempo(x, f):
    if abs(f - 1) < 1e-3:
        return x
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-af', f'atempo={f:.4f}', '-f', 'f64le', '-'], input=x.tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float64)


def fit_part(name):
    """Trim one take, cap its inner pauses. Returns audio and the sample offsets where each
    sentence (after a pause) starts, including 0 for the first."""
    x = decode(os.path.join(ROOT, 'vo', name + '.mp3'))
    act, w = activity(x)
    s0, s1, ps = pauses(act)
    pad = 3
    a, b = max(0, s0 - pad), min(len(act), s1 + pad)
    pieces, cursor, starts, out_len = [], a, [0], 0
    for p0, p1 in ps:
        keep = min((p1 - p0) / 100, MAX_PAUSE)
        half = int(round(keep * 100 / 2))
        seg = x[cursor * w: (p0 + half) * w]
        pieces.append(seg)
        out_len += len(seg)
        nxt = p1 - half
        starts.append(out_len + (p1 - nxt) * w)
        cursor = nxt
    pieces.append(x[cursor * w: b * w])
    y = pieces[0]
    f = int(0.008 * SR)
    for p in pieces[1:]:
        ramp = np.linspace(0, 1, f)
        y = np.concatenate([y[:-f], y[-f:] * (1 - ramp) + p[:f] * ramp, p[f:]])
    # level each part to the same speech loudness (RMS of the active frames)
    act2, w2 = activity(y)
    n = len(y) // w2
    e = (y[: n * w2].reshape(n, w2) ** 2).mean(1)
    rms = np.sqrt(e[act2[:n]].mean())
    y = y * (0.1 / rms)
    return y, starts


def main():
    scenes = scene_starts()
    os.makedirs(os.path.join(ROOT, 'out/vo'), exist_ok=True)
    timing = []
    for i, chunks in enumerate(LINES):
        parts = []
        for c in chunks:
            if c[1] not in parts:
                parts.append(c[1])
        audio = []
        part_start = {}
        sentence_starts = {}
        pos = 0
        for k, name in enumerate(parts):
            y, starts = fit_part(TAKES[name])
            if k:
                gap = np.zeros(int(PART_GAP.get(name, 0.45) * SR))
                audio.append(gap)
                pos += len(gap)
            part_start[name] = pos
            sentence_starts[name] = [pos + s for s in starts]
            audio.append(y)
            pos += len(y)
        y = np.concatenate(audio)
        t0 = scenes[i] + (0.2 if i == 0 else LEAD)
        t_end = scenes[i + 1] - 0.2
        speed = max(1.0, (len(y) / SR) / (t_end - t0))
        if speed > 1.12:
            raise SystemExit(f'line {i + 1}: needs {speed:.3f}x, too fast')
        y = tempo(y, speed)
        dur = len(y) / SR
        out_chunks = []
        for c in chunks:
            name = c[1]
            idx = c[2] if len(c) > 2 else 0
            ss = sentence_starts[name]
            if idx >= len(ss):
                raise SystemExit(f'line {i + 1}: {name} has {len(ss)} sentences, chunk wants #{idx}')
            out_chunks.append({'text': c[0], 't': round(t0 + ss[idx] / SR / speed, 3)})
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        os.path.join(ROOT, 'out/vo', f'line{i + 1:02d}.wav')], input=y.tobytes(), check=True)
        timing.append({'line': i + 1, 'start': round(t0, 3), 'dur': round(dur, 3), 'speed': round(speed, 3),
                       'sceneEnd': scenes[i + 1], 'chunks': out_chunks})
        print(f'line {i + 1:2d} start {t0:6.2f} dur {dur:5.2f} end {t0 + dur:6.2f} (scene ends {scenes[i + 1]:6.2f}) '
              f'speed {speed:.3f} chunks {[c["t"] for c in out_chunks]}')
    with open(os.path.join(ROOT, 'out/vo/timing.json'), 'w') as fh:
        json.dump(timing, fh, indent=1)
    with open(os.path.join(ROOT, 'src/vo_timing.js'), 'w') as fh:
        fh.write('// Generated by audio/vo_prep.py: when each narration line and caption chunk starts (seconds).\n')
        fh.write('export const VO = ' + json.dumps(timing, indent=1) + ';\n')


if __name__ == '__main__':
    main()
