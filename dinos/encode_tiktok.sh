#!/bin/bash
# TikTok upload versions of both videos, kept under 50 MB so phone uploads aren't squeezed again by
# the app (the Android app is reported to cap uploads around 72 MB):
#   final/dinosaurs_sfx_tiktok.mp4        sound effects only (out/sfx_mix.wav)
#   final/dinosaurs_voiceover_tiktok.mp4  sound effects + narrator (out/vo_mix.wav)
# Frames come from a render without the fine paper speckle, which TikTok's own low-bitrate re-encode
# would otherwise spend its bits on (the soft paper tone stays):
#   node render.mjs --from 0 --to 1800 --query nospeckle --out <dir>
#   FRAMES=<dir> ./encode_tiktok.sh
# Video: two-pass H.264 High 4.1, preset slow, ~5.8 Mbps (max 8 Mbps), 1080x1920, 30 fps, 2 s GOP.
# Audio: AAC 192 kbps, 48 kHz stereo. faststart.
set -euo pipefail
cd "$(dirname "$0")"
FRAMES=${FRAMES:-out/frames_tiktok}
COLOR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
LIMIT=$((50 * 1000 * 1000))
common=(-framerate 30 -i "$FRAMES/%05d.png" -vf "$VF" -c:v libx264 -profile:v high -level 4.1 -preset slow -tune animation
  -b:v 5800k -maxrate 8000k -bufsize 12000k -pix_fmt yuv420p "${COLOR[@]}" -g 60 -t 60 -passlogfile out/x264tiktok)
ffmpeg -v error -y "${common[@]}" -pass 1 -an -f mp4 /dev/null
ffmpeg -v error -y "${common[@]}" -pass 2 -an out/video_tiktok.mp4
for v in sfx voiceover; do
  a=out/sfx_mix.wav
  [ "$v" = voiceover ] && a=out/vo_mix.wav
  ffmpeg -v error -y -i out/video_tiktok.mp4 -i "$a" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
    -t 60 -movflags +faststart "final/dinosaurs_${v}_tiktok.mp4"
  size=$(stat -c %s "final/dinosaurs_${v}_tiktok.mp4")
  echo "dinosaurs_${v}_tiktok.mp4: $size bytes"
  [ "$size" -lt "$LIMIT" ] || { echo "over 50 MB"; exit 1; }
done
