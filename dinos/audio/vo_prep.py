"""Fit the ElevenLabs narration lines (vo/*.mp3) to their scenes.

For every line: trim the silence around it, shorten over-long pauses between sentences, and, if it
still runs past its scene, speed it up slightly (ffmpeg atempo, pitch unchanged, at most 1.15x).
The line starts 0.3 s after its scene begins. Writes:
  out/vo/lineNN.wav     the fitted line, 48 kHz mono
  src/vo_timing.js      when each line and each caption chunk starts (used by the renderer)
  out/vo/timing.json    the same, for the mixer
"""
import json
import os
import subprocess

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
SCENES = [0, 5, 11, 17, 23, 30, 36, 42, 48, 54, 60]
LEAD = 0.3
END_FADE = 59.45  # the last half second fades to silence, so the final line must end before it

# file, caption chunks, which detected pauses are sentence breaks (index into the pause list),
# and pauses to shorten: {pause index: target seconds}.
LINES = [
    ('line01_asteroid', ['66 million years ago,|an asteroid hit Earth.', 'What if it missed?'], [1], {0: 0.16, 1: 0.32}),
    ('line02_species', ['About 75% of all species|would have survived.'], [], {}),
    ('line03_mammals', ['Mammals stay small and hidden,|like they had for millions of years.'], [], {}),
    ('line04_fossil', ['The biggest mammal back then|was badger-sized.', 'One was found with a baby|dinosaur in its stomach.'], [2], {2: 0.3}),
    ('line05_walls', ['If humans made it anyway,|our cities would need walls.'], [], {}),
    ('line06_pterosaur', ['Flying reptiles|with 10-meter wings.', 'Every airport becomes|a danger zone.'], [0], {0: 0.36}),
    ('line07_triceratops_a', ['A Triceratops weighs|as much as an elephant.'], [], {}),
    ('line08_trex', ['A T. rex bites about 8 times|harder than a lion.'], [], {}),
    ('line09_never_died', ["But here's the thing:|dinosaurs never fully died."], [], {}),
    ('line10_birds', ['Birds are dinosaurs.|Over 10,000 species.', 'You saw one this morning.'], [1], {0: 0.3, 1: 0.32}),
]


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def activity(x):
    w = SR // 100
    n = len(x) // w
    e = 10 * np.log10((x[: n * w].reshape(n, w) ** 2).mean(1) + 1e-12)
    return e > e.max() - 40, w


def pauses(act):
    idx = np.where(act)[0]
    out, run = [], 0
    for i in range(idx[0], idx[-1] + 1):
        if not act[i]:
            run += 1
        else:
            if run >= 12:
                out.append((i - run, i))
            run = 0
    return idx[0], idx[-1] + 1, out


def tempo(x, f):
    if abs(f - 1) < 1e-3:
        return x
    p = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-af', f'atempo={f:.4f}', '-f', 'f64le', '-'], input=x.tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float64)


def main():
    os.makedirs(os.path.join(ROOT, 'out/vo'), exist_ok=True)
    timing = []
    for i, (name, chunks, breaks, shorten) in enumerate(LINES):
        x = decode(os.path.join(ROOT, 'vo', name + '.mp3'))
        act, w = activity(x)
        s0, s1, ps = pauses(act)
        pad = 3  # keep 30 ms around the speech
        a, b = max(0, s0 - pad), min(len(act), s1 + pad)
        # Rebuild the line piece by piece so pauses can be shortened; remember where each sentence
        # break ends (the next caption chunk starts there).
        pieces, cursor, break_at, out_len = [], a, [], 0
        for k, (p0, p1) in enumerate(ps):
            keep = shorten.get(k)
            seg_end = p0 + (p1 - p0) // 2 if keep is None else p0 + int(round(keep * 100 / 2))
            seg = x[cursor * w: seg_end * w]
            pieces.append(seg)
            out_len += len(seg)
            nxt = p1 - (p1 - p0) // 2 if keep is None else p1 - int(round(keep * 100 / 2))
            if k in breaks:
                break_at.append(out_len + (p1 - nxt) * w)  # sample where speech resumes
            cursor = nxt
        pieces.append(x[cursor * w: b * w])
        # Short crossfades at the joins (all joins sit inside near-silent pauses).
        y = pieces[0]
        f = int(0.008 * SR)
        for p in pieces[1:]:
            ramp = np.linspace(0, 1, f)
            y = np.concatenate([y[:-f], y[-f:] * (1 - ramp) + p[:f] * ramp, p[f:]])
        t0 = SCENES[i] + (0.2 if i == 0 else LEAD)
        t_end = min(SCENES[i + 1] - (0.06 if i == 0 else 0.12), END_FADE)
        speed = max(1.0, (len(y) / SR) / (t_end - t0))
        if speed > 1.15:
            raise SystemExit(f'{name}: needs {speed:.3f}x, too fast')
        y = tempo(y, speed)
        dur = len(y) / SR
        chunk_t = [t0] + [t0 + s / SR / speed for s in break_at]
        assert len(chunk_t) == len(chunks), (name, chunk_t, chunks)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        os.path.join(ROOT, 'out/vo', f'line{i + 1:02d}.wav')], input=y.tobytes(), check=True)
        timing.append({'line': i + 1, 'file': name, 'start': round(t0, 3), 'dur': round(dur, 3), 'speed': round(speed, 3),
                       'chunks': [{'text': c, 't': round(t, 3)} for c, t in zip(chunks, chunk_t)]})
        print(f'{name:22s} start {t0:6.2f} dur {dur:5.2f} end {t0 + dur:6.2f} (scene ends {SCENES[i + 1]}) speed {speed:.3f} chunks {[round(t, 2) for t in chunk_t]}')
    with open(os.path.join(ROOT, 'out/vo/timing.json'), 'w') as fh:
        json.dump(timing, fh, indent=1)
    with open(os.path.join(ROOT, 'src/vo_timing.js'), 'w') as fh:
        fh.write('// Generated by audio/vo_prep.py: when each narration line and caption chunk starts (seconds).\n')
        fh.write('export const VO = ' + json.dumps(timing, indent=1) + ';\n')


if __name__ == '__main__':
    main()
