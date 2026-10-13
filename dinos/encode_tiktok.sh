#!/bin/bash
# The voiceover video, encoded for TikTok upload: final/dinosaurs_voiceover.mp4 (sound effects +
# narrator, out/vo_mix.wav), kept under 72 MB, which the Android TikTok app is reported to accept
# without squeezing the file again.
# Frames come from a render without the fine paper speckle, which TikTok's own low-bitrate re-encode
# would otherwise spend its bits on (the soft paper tone stays):
#   node render.mjs --from 0 --to 1800 --query nospeckle --out out/frames_tiktok
#   ./encode_tiktok.sh                      (or FRAMES=<dir> ./encode_tiktok.sh)
# Video: two-pass H.264 High 4.1, veryslow, tune animation, 1080x1920, 30 fps, 2 s GOP, about 9 Mbps:
# as close to the 10-12 Mbps TikTok guides suggest as the 72 MB cap allows for 60 s.
# Audio: AAC 256 kbps, 48 kHz stereo. faststart.
set -euo pipefail
cd "$(dirname "$0")"
FRAMES=${FRAMES:-out/frames_tiktok}
COLOR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
LIMIT=$((71 * 1000 * 1000))  # a little headroom under 72 MB
OUT=final/dinosaurs_voiceover.mp4
rate=${RATE:-9000}
while :; do
  common=(-framerate 30 -i "$FRAMES/%05d.png" -vf "$VF" -c:v libx264 -profile:v high -level 4.1 -preset veryslow -tune animation
    -b:v ${rate}k -maxrate 12000k -bufsize 18000k -pix_fmt yuv420p "${COLOR[@]}" -g 60 -t 60 -passlogfile out/x264tiktok)
  ffmpeg -v error -y "${common[@]}" -pass 1 -an -f mp4 /dev/null
  ffmpeg -v error -y "${common[@]}" -pass 2 -an out/video_tiktok.mp4
  ffmpeg -v error -y -i out/video_tiktok.mp4 -i out/vo_mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -ac 2 \
    -t 60 -movflags +faststart "$OUT"
  size=$(stat -c %s "$OUT")
  echo "$OUT: $size bytes at ${rate}k"
  [ "$size" -lt "$LIMIT" ] && break
  rate=$((rate - 300))
  echo "over 71 MB, re-encoding at ${rate}k"
done
