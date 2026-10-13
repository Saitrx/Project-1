#!/bin/bash
# Encode the rendered 1080x1920 lossless PNG frames (out/frames) into
#   final/dinosaurs_sfx.mp4         sound effects only (out/sfx_mix.wav)
# The voiceover version (final/dinosaurs_voiceover.mp4) is made for TikTok upload by
# encode_tiktok.sh instead: under 72 MB, from frames rendered without the fine paper speckle.
# Video: two-pass H.264 High, veryslow, tune animation, yuv420p, ~11,500 kbps (maxrate 13.5M,
# bufsize 27M). Audio: AAC 256 kbps, 48 kHz stereo. faststart. The file must stay under 99 MB;
# the video bitrate steps down until it fits.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p final
COLOR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
LIMIT=$((99 * 1000 * 1000))
rate=${RATE:-11500}
while :; do
  common=(-framerate 30 -i out/frames/%05d.png -vf "$VF" -c:v libx264 -profile:v high -preset veryslow -tune animation
    -b:v ${rate}k -maxrate 13500k -bufsize 27000k -pix_fmt yuv420p "${COLOR[@]}" -g 60 -t 60 -passlogfile out/x264pass)
  ffmpeg -v error -y "${common[@]}" -pass 1 -an -f mp4 /dev/null
  ffmpeg -v error -y "${common[@]}" -pass 2 -an out/video.mp4
  ok=1
  for v in sfx; do
    a=out/sfx_mix.wav
    ffmpeg -v error -y -i out/video.mp4 -i "$a" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -ac 2 \
      -t 60 -movflags +faststart "final/dinosaurs_$v.mp4"
    size=$(stat -c %s "final/dinosaurs_$v.mp4")
    echo "dinosaurs_$v.mp4: $size bytes at ${rate}k"
    [ "$size" -lt "$LIMIT" ] || ok=0
  done
  [ "$ok" = 1 ] && break
  rate=$((rate - 700))
  echo "over 99 MB, re-encoding the video at ${rate}k"
done
ls -la final
