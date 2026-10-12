#!/bin/bash
# 2K (1440x2560) upload file with sound, from frames rendered at 4K and Lanczos-downscaled to 2K:
#   node render.mjs --from 0 --to 2100 --out out/frames2k --out-size 1440x2560
# Two-pass H.264 High ~10.5 Mbps (~93 MB, under GitHub's 100 MB file limit).
set -euo pipefail
cd "$(dirname "$0")"
COLOR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
ffmpeg -v error -y -framerate 30 -i out/frames2k/%05d.png -vf "$VF" -c:v libx264 -profile:v high -level 5.1 -preset slow \
  -b:v 10500k -pass 1 -passlogfile out/k2pass -g 60 -pix_fmt yuv420p "${COLOR[@]}" -t 70 -an -f mp4 /dev/null
ffmpeg -v error -y -framerate 30 -i out/frames2k/%05d.png -i out/sfx_mix.wav -map 0:v -map 1:a -vf "$VF" \
  -c:v libx264 -profile:v high -level 5.1 -preset slow -b:v 10500k -maxrate 16000k -bufsize 24000k -pass 2 -passlogfile out/k2pass \
  -g 60 -pix_fmt yuv420p "${COLOR[@]}" -c:a aac -b:a 192k -ar 48000 -t 70 -movflags +faststart final/what_if_cars_2K.mp4
ls -la final/what_if_cars_2K.mp4
