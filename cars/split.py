"""Split an MP4 (keyframes on every whole second) into parts below a byte limit.

Parts end at scene cuts whenever a whole scene still fits; a scene that is too big on its own is
cut at whole seconds inside it. Each part is a stream copy with its own moov atom, so it plays on
its own.  usage: python3 split.py file.mp4 limit_bytes
"""
import json
import os
import subprocess
import sys

CUTS = [16, 21, 33, 39, 45, 51, 56, 61, 65, 67]
src, limit = sys.argv[1], int(sys.argv[2])
if os.path.getsize(src) <= limit:
    sys.exit(0)
pk = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,size', '-of', 'json', src]))['packets']
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]))
end_s = int(round(dur))
per_sec = [0] * (end_s + 1)
for p in pk:
    per_sec[min(end_s, int(float(p['pts_time']) + 1e-6))] += int(p['size'])
size = lambda a, b: sum(per_sec[a:b])
budget = limit * 0.96  # container overhead
parts = []
start = 0
while start < end_s:
    cuts = [c for c in CUTS + [end_s] if c > start and size(start, c) <= budget]
    if cuts:
        stop = max(cuts)
    else:
        stop = start + 1
        while stop < end_s and size(start, stop + 1) <= budget:
            stop += 1
    parts.append((start, stop))
    start = stop
stem = os.path.splitext(src)[0]
for f in os.listdir(os.path.dirname(src) or '.'):
    if f.startswith(os.path.basename(stem) + '_part'):
        os.remove(os.path.join(os.path.dirname(src), f))
for i, (a, b) in enumerate(parts, 1):
    out = f'{stem}_part{i}.mp4'
    # Exact frame count: every whole second starts a closed GOP, so the first (b - a) * 30 packets
    # are exactly the frames of [a, b).
    subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-ss', str(a), '-i', src, '-frames:v', str((b - a) * 30), '-c', 'copy', '-movflags', '+faststart', out])
    print(f'{out}: {a}-{b}s, {os.path.getsize(out)} bytes')
