#!/bin/bash
# Final encodes for "What if all the schools disappeared?" (85.5 s, 2565 frames at 30 fps).
#   node render.mjs --from 0 --to 2565 --out out/frames --workers 3   (frames: 2160x3840 drawn, 1080x1920 PNG)
#   python3 audio/mix.py                                               (output/school_sfx.wav, output/school_sfx_vo.wav)
#   ./encode.sh                                                        (or FRAMES=<dir> ./encode.sh)
#
# output/school_master_for_adobe.mp4  video only: H.264 High L4.2, two-pass 8 Mbps, 1080x1920,
#                                     30 fps CFR, yuv420p, BT.709 tags, 2 s GOP (under 95 MB)
# output/school_sfx.mp4               H.264 High L4.2 two-pass, -g 60, + AAC 320 kbps 48 kHz stereo,
# output/school_voiceover.mp4         faststart; each under 68 MB:
#                                     video kbps = 68 x 8000 / seconds - 320, maxrate 1.4x
set -euo pipefail
cd "$(dirname "$0")"
FRAMES=${FRAMES:-out/frames}
DUR=85.5
COLOR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
VF="scale=out_color_matrix=bt709:out_range=tv:flags=lanczos,format=yuv420p"
mkdir -p output

# two-pass H.264: venc <out> <kbps> <maxrate kbps> <passlog name>
venc() {
  local common=(-framerate 30 -i "$FRAMES/%05d.png" -vf "$VF" -fps_mode cfr -r 30 -c:v libx264 -preset slow -tune animation
    -profile:v high -level:v 4.2 -b:v "${2}k" -maxrate "${3}k" -bufsize "$(($3 * 2))k" -pix_fmt yuv420p "${COLOR[@]}"
    -g 60 -keyint_min 30 -sc_threshold 0 -t "$DUR" -passlogfile "out/$4")
  ffmpeg -v error -y "${common[@]}" -pass 1 -an -f mp4 /dev/null
  ffmpeg -v error -y "${common[@]}" -pass 2 -an -movflags +faststart "$1"
}

# 1) the Adobe master (video only)
venc output/school_master_for_adobe.mp4 8000 11200 x264master
echo "master: $(stat -c %s output/school_master_for_adobe.mp4) bytes"

# 2) the two delivery files share one two-pass video stream; only the soundtrack differs
VK=$(python3 -c "print(int(68 * 8000 / $DUR - 320))")
MAX=$(python3 -c "print(int(round(1.4 * $VK)))")
LIMIT=$((68 * 1000 * 1000))
while :; do
  venc out/video_delivery.mp4 "$VK" "$MAX" x264delivery
  for pair in "school_sfx:school_sfx.wav" "school_voiceover:school_sfx_vo.wav"; do
    name=${pair%%:*}
    wav=${pair##*:}
    ffmpeg -v error -y -i out/video_delivery.mp4 -i "output/$wav" -map 0:v -map 1:a -c:v copy \
      -c:a aac -b:a 320k -ar 48000 -ac 2 -t "$DUR" -movflags +faststart "output/$name.mp4"
  done
  big=$(stat -c %s output/school_sfx.mp4 output/school_voiceover.mp4 | sort -n | tail -1)
  echo "delivery: video ${VK}k (maxrate ${MAX}k), largest file $big bytes"
  [ "$big" -lt "$LIMIT" ] && break
  VK=$((VK - 60))
  MAX=$(python3 -c "print(int(round(1.4 * $VK)))")
  echo "over 68 MB, re-encoding the video at ${VK}k"
done
