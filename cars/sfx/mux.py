"""Add out/sfx_mix.wav to every HQ part it fully covers (parts 1-5 for the 0:00-0:51 mix).
Part offsets come from the parts' own durations, in order. The video stream is copied untouched.
usage: python3 sfx/mux.py
"""
import glob
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIX = os.path.join(ROOT, 'out', 'sfx_mix.wav')


def duration(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))


parts = sorted(glob.glob(os.path.join(ROOT, 'final', 'what_if_cars_HQ_part*.mp4')), key=lambda f: int(re.search(r'part(\d+)', f).group(1)))
mix_len = duration(MIX)
start = 0.0
for f in parts:
    d = round(duration(f))
    if start + d <= mix_len + 0.05:
        tmp = f + '.tmp.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-ss', f'{start:.3f}', '-t', f'{d:.3f}', '-i', MIX,
                        '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                        '-af', f'afade=t=in:d=0.01,afade=t=out:st={d - 0.01:.3f}:d=0.01',
                        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', f'{d:.3f}', '-movflags', '+faststart', tmp], check=True)
        os.replace(tmp, f)
        print(f'{os.path.basename(f)}: sound {start:.0f}-{start + d:.0f}s, {os.path.getsize(f)} bytes')
    start += d
