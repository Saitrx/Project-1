#!/bin/bash
# Final encodes for "What if all the schools disappeared?" (85.5 s, 5130 frames at 60 fps).
#   node render.mjs --from 0 --to 5130 --out out/frames --workers 3   (frames: 2160x3840 drawn, 1080x1920 PNG)
#   python3 audio/mix.py                                               (output/school_sfx.wav, output/school_sfx_vo.wav)
#   ./encode.sh                                                        (or FRAMES=<dir> ./encode.sh)
#
# FHD only: one video encode, shared by all three files, so there is no second (lower) version.
#   H.264 High, level 4.2, tagged avc1; 1080x1920; true 60 fps CFR (every frame rendered, no frame
#   doubling); two-pass 20 Mbps (maxrate 28 Mbps); yuv420p, BT.709 tags; closed 2 s GOP (-g 120).
# output/school_voiceover.mp4         + AAC 320 kbps 48 kHz stereo (narrated mix), faststart
# output/school_sfx.mp4               + AAC 320 kbps 48 kHz stereo (effects only), faststart
# output/school_master_for_adobe.mp4  the same video, no audio (edit it with the WAVs)
# Each is about 215 MB, over GitHub's 100 MB file limit, so output/*.mp4 is stored with Git LFS
# (see ../.gitattributes).
set -euo pipefail
cd "$(dirname "$0")"
FRAMES=${FRAMES:-out/frames}
DUR=85.5
FPS=60
VK=20000
MAX=28000
COLOR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
VF="scale=out_color_matrix=bt709:out_range=tv:flags=lanczos,format=yuv420p"
mkdir -p output

common=(-framerate "$FPS" -i "$FRAMES/%05d.png" -vf "$VF" -fps_mode cfr -r "$FPS" -c:v libx264 -preset slow -tune animation
  -profile:v high -level:v 4.2 -b:v "${VK}k" -maxrate "${MAX}k" -bufsize "$((MAX * 2))k" -pix_fmt yuv420p "${COLOR[@]}"
  -g $((FPS * 2)) -keyint_min "$FPS" -sc_threshold 0 -x264-params open-gop=0 -t "$DUR" -passlogfile out/x264fhd)
ffmpeg -v error -y "${common[@]}" -pass 1 -an -f mp4 /dev/null
ffmpeg -v error -y "${common[@]}" -pass 2 -an -tag:v avc1 -movflags +faststart out/video_fhd60.mp4
echo "video: $(stat -c %s out/video_fhd60.mp4) bytes"

ffmpeg -v error -y -i out/video_fhd60.mp4 -map 0:v -c:v copy -movflags +faststart output/school_master_for_adobe.mp4
for pair in "school_sfx:school_sfx.wav" "school_voiceover:school_sfx_vo.wav"; do
  name=${pair%%:*}
  wav=${pair##*:}
  ffmpeg -v error -y -i out/video_fhd60.mp4 -i "output/$wav" -map 0:v -map 1:a -c:v copy \
    -c:a aac -b:a 320k -ar 48000 -ac 2 -t "$DUR" -movflags +faststart "output/$name.mp4"
done
stat -c '%n: %s bytes' output/school_master_for_adobe.mp4 output/school_sfx.mp4 output/school_voiceover.mp4
