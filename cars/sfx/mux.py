"""Add out/sfx_mix.wav to every HQ part it fully covers (or only the part numbers given).
Part offsets come from the parts' own durations, in order. The video stream is copied untouched.
usage: python3 sfx/mux.py [part numbers...]
"""
import glob
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIX = os.path.join(ROOT, 'out', 'sfx_mix.wav')


def duration(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))


parts = sorted(glob.glob(os.path.join(ROOT, 'final', 'what_if_cars_HQ_part*.mp4')), key=lambda f: int(re.search(r'part(\d+)', f).group(1)))
mix_len = duration(MIX)
start = 0.0
only = {int(a) for a in sys.argv[1:]}
for f in parts:
    d = round(duration(f))
    num = int(re.search(r'part(\d+)', f).group(1))
    if start + d <= mix_len + 0.05 and (not only or num in only):
        tmp = f + '.tmp.mp4'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-ss', f'{start:.3f}', '-t', f'{d:.3f}', '-i', MIX,
                        '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                        '-af', f'afade=t=in:d=0.01,afade=t=out:st={d - 0.01:.3f}:d=0.01',
                        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', f'{d:.3f}', '-movflags', '+faststart', tmp], check=True)
        os.replace(tmp, f)
        print(f'{os.path.basename(f)}: sound {start:.0f}-{start + d:.0f}s, {os.path.getsize(f)} bytes')
    start += d
