#!/bin/bash
# Encode the rendered 1080x1920 lossless PNG frames into the two deliverables (no audio):
#   final/what_if_cars_HQ.mp4  H.264 High, CRF 12, veryslow, tune film, yuv420p, faststart
#   final/what_if_cars.mp4     two-pass ~5,500 kbps, kept under 50 MB
# Keyframes are forced on every whole second (which includes every scene cut), so the files can be
# split without re-encoding. Files larger than PART_LIMIT bytes are also split into parts that
# each play on their own, ending at scene cuts wherever a whole scene fits (see split.py).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p final
KEYS="expr:gte(t,n_forced*1)"
PART_LIMIT=${PART_LIMIT:-31000000}
COLOR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"

ffmpeg -v error -y -framerate 30 -i out/frames/%05d.png -vf "$VF" \
  -c:v libx264 -profile:v high -preset veryslow -tune film -crf 12 -pix_fmt yuv420p "${COLOR[@]}" \
  -force_key_frames "$KEYS" -t 70 -movflags +faststart final/what_if_cars_HQ.mp4

rate=5500
while :; do
  ffmpeg -v error -y -framerate 30 -i out/frames/%05d.png -vf "$VF" \
    -c:v libx264 -profile:v high -preset slow -b:v ${rate}k -pass 1 -passlogfile out/x264pass \
    -pix_fmt yuv420p "${COLOR[@]}" -force_key_frames "$KEYS" -t 70 -an -f mp4 /dev/null
  ffmpeg -v error -y -framerate 30 -i out/frames/%05d.png -vf "$VF" \
    -c:v libx264 -profile:v high -preset slow -b:v ${rate}k -maxrate $((rate * 2))k -bufsize $((rate * 4))k \
    -pass 2 -passlogfile out/x264pass -pix_fmt yuv420p "${COLOR[@]}" -force_key_frames "$KEYS" -t 70 \
    -movflags +faststart final/what_if_cars.mp4
  size=$(stat -c %s final/what_if_cars.mp4)
  if [ "$size" -lt 50000000 ]; then break; fi
  rate=$((rate - 300))
  echo "normal file ${size} bytes, re-encoding at ${rate}k"
done

python3 split.py final/what_if_cars_HQ.mp4 "$PART_LIMIT"
python3 split.py final/what_if_cars.mp4 "$PART_LIMIT"
ls -la final
