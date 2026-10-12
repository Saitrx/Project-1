#!/bin/bash
# Encode the rendered 1080x1920 lossless PNG frames + soundtrack into the final MP4.
set -euo pipefail
cd "$(dirname "$0")"
ffmpeg -v error -y -framerate 30 -i out/frames/%05d.png -i out/audio.wav \
  -map 0:v -map 1:a \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -crf 14 -preset slow -tune film -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 192k -ar 48000 \
  -t 70 -movflags +faststart out/what_if_ai_decided_we_were_the_problem.mp4
ls -la out/what_if_ai_decided_we_were_the_problem.mp4
