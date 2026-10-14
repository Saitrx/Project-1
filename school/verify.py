"""ffprobe verification report for the deliverables: writes output/VERIFY.md and exits non-zero if
any check fails."""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'output')
DUR = 85.5
rows = []
ok_all = True


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', path], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def loudness(path):
    err = subprocess.run(['ffmpeg', '-v', 'info', '-nostats', '-i', path, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    lines = err.splitlines()
    I = float([l for l in lines if l.strip().startswith('I:')][-1].split()[1])
    TP = float([l for l in lines if l.strip().startswith('Peak:')][-1].split()[1])
    return I, TP


def keyframe_gaps(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-skip_frame', 'nokey', '-show_entries', 'frame=pts_time', '-of', 'csv=p=0', path],
                       capture_output=True, text=True, check=True)
    ts = [float(x.strip(',')) for x in r.stdout.split() if x.strip(',').strip()]
    gaps = [round(b - a, 3) for a, b in zip(ts, ts[1:])]
    return len(ts), (max(gaps) if gaps else 0)


def check(name, cond, detail):
    global ok_all
    ok_all &= bool(cond)
    rows.append(f"| {name} | {'PASS' if cond else 'FAIL'} | {detail} |")


def video_checks(f, d, v, limit_mb, want_audio, target_kbps=None):
    size = int(d['format']['size'])
    check(f'{f}: size', size < limit_mb * 1e6, f"{size / 1e6:.2f} MB (limit {limit_mb} MB)")
    check(f'{f}: duration', abs(float(d['format']['duration']) - DUR) < 0.05, f"{float(d['format']['duration']):.3f} s")
    # HEVC levels are reported x30 (level 4.1 -> 123); hvc1 is the tag Apple devices and TikTok expect
    check(f'{f}: codec/profile/level', v['codec_name'] == 'hevc' and v['profile'] == 'Main' and v['level'] == 123 and v.get('codec_tag_string') == 'hvc1',
          f"{v['codec_name']} {v['profile']} level {v['level'] / 30:.1f}, tag {v.get('codec_tag_string')}")
    check(f'{f}: frame size', (v['width'], v['height']) == (1080, 1920), f"{v['width']}x{v['height']}")
    check(f'{f}: frame rate (CFR)', v['r_frame_rate'] == '30/1' and v['avg_frame_rate'] == '30/1' and int(v.get('nb_frames', 0)) == 2565,
          f"r {v['r_frame_rate']}, avg {v['avg_frame_rate']}, {v.get('nb_frames')} frames")
    check(f'{f}: pixel format', v['pix_fmt'] == 'yuv420p', v['pix_fmt'])
    tags = (v.get('color_space'), v.get('color_primaries'), v.get('color_transfer'), v.get('color_range'))
    check(f'{f}: colour tags', tags == ('bt709', 'bt709', 'bt709', 'tv'), '/'.join(str(t) for t in tags))
    n, gap = keyframe_gaps(os.path.join(OUT, f))
    check(f'{f}: GOP', gap <= 2.0 + 1e-6, f"{n} keyframes, longest gap {gap:.2f} s (-g 60)")
    vk = int(v.get('bit_rate', 0)) / 1000
    if target_kbps:
        check(f'{f}: video bitrate', abs(vk - target_kbps) / target_kbps < 0.05, f"{vk:.0f} kbps (target {target_kbps} kbps)")
    else:
        rows.append(f"| {f}: video bitrate | info | {vk:.0f} kbps |")
    a = [s for s in d['streams'] if s['codec_type'] == 'audio']
    if not want_audio:
        check(f'{f}: no audio', not a, 'video only')
        return
    a = a[0]
    check(f'{f}: audio', a['codec_name'] == 'aac' and int(a['sample_rate']) == 48000 and a['channels'] == 2,
          f"{a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch, {int(a.get('bit_rate', 0)) / 1000:.0f} kbps")
    I, TP = loudness(os.path.join(OUT, f))
    check(f'{f}: loudness', abs(I + 14) <= 1.0 and TP < -1.0, f"{I:.1f} LUFS, true peak {TP:.1f} dBTP")
    with open(os.path.join(OUT, f), 'rb') as fh:
        head = fh.read(4096)
    check(f'{f}: faststart', head.find(b'moov') != -1 and (head.find(b'mdat') == -1 or head.find(b'moov') < head.find(b'mdat')), 'moov atom before mdat')


def main():
    delivery_kbps = int(68 * 8000 / DUR - 320)
    for f, limit, audio, tk in (('school_master_for_adobe.mp4', 95, False, None), ('school_sfx.mp4', 68, True, None), ('school_voiceover.mp4', 68, True, None)):
        d = probe(os.path.join(OUT, f))
        v = [s for s in d['streams'] if s['codec_type'] == 'video'][0]
        video_checks(f, d, v, limit, audio, tk)
    for f in ('school_sfx.wav', 'school_sfx_vo.wav'):
        d = probe(os.path.join(OUT, f))
        a = d['streams'][0]
        check(f'{f}: format', a['codec_name'] == 'pcm_s24le' and int(a['sample_rate']) == 48000 and a['channels'] == 2,
              f"{a['codec_name']} {a['sample_rate']} Hz {a['channels']} ch")
        check(f'{f}: duration', abs(float(d['format']['duration']) - DUR) < 0.01, f"{float(d['format']['duration']):.3f} s")
        I, TP = loudness(os.path.join(OUT, f))
        check(f'{f}: loudness', abs(I + 14) <= 0.5 and TP < -1.0, f"{I:.1f} LUFS, true peak {TP:.1f} dBTP")
    with open(os.path.join(OUT, 'VERIFY.md'), 'w') as fh:
        fh.write('# Verification report (ffprobe / ffmpeg ebur128)\n\n')
        fh.write(f'Generated by `verify.py`. Delivery video bitrate from the spec: 68 x 8000 / {DUR} - 320 = {delivery_kbps} kbps.\n\n')
        fh.write('| Check | Result | Measured |\n| --- | --- | --- |\n')
        fh.write('\n'.join(rows) + '\n')
        fh.write(f"\n**Overall: {'all checks pass' if ok_all else 'SOME CHECKS FAIL'}**\n")
    print('\n'.join(rows))
    print('ALL PASS' if ok_all else 'FAILURES')
    sys.exit(0 if ok_all else 1)


if __name__ == '__main__':
    main()
