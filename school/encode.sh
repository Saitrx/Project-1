#!/bin/bash
# Final encodes for "What if all the schools disappeared?" (85.5 s, 2565 frames at 30 fps).
#   node render.mjs --from 0 --to 2565 --out out/frames --workers 3   (frames: 2160x3840 drawn, 1080x1920 PNG)
#   python3 audio/mix.py                                               (output/school_sfx.wav, output/school_sfx_vo.wav)
#   ./encode.sh                                                        (or FRAMES=<dir> ./encode.sh)
#
# All three are H.265 / HEVC (Main profile, level 4.1, 8-bit 4:2:0, tagged hvc1 so iPhone, QuickTime
# and TikTok play them natively), two-pass, 30 fps CFR, BT.709 tags, closed 2 s GOP (-g 60):
# output/school_master_for_adobe.mp4  video only, 8 Mbps (under 95 MB)
# output/school_sfx.mp4               + AAC 320 kbps 48 kHz stereo, faststart; each under 68 MB:
# output/school_voiceover.mp4         video kbps = 68 x 8000 / seconds - 320, maxrate 1.4x
set -euo pipefail
cd "$(dirname "$0")"
FRAMES=${FRAMES:-out/frames}
DUR=85.5
COLOR=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)
VF="scale=out_color_matrix=bt709:out_range=tv:flags=lanczos,format=yuv420p"
mkdir -p output

# two-pass H.265: venc <out> <kbps> <maxrate kbps> <stats name>
venc() {
  local x265="keyint=60:min-keyint=30:scenecut=0:no-open-gop=1:vbv-maxrate=$3:vbv-bufsize=$(($3 * 2)):level-idc=4.1"
  x265+=":colorprim=bt709:transfer=bt709:colormatrix=bt709:range=limited:log-level=error:stats=out/$4.log"
  local common=(-framerate 30 -i "$FRAMES/%05d.png" -vf "$VF" -fps_mode cfr -r 30 -c:v libx265 -preset slow -tune animation
    -profile:v main -b:v "${2}k" -pix_fmt yuv420p "${COLOR[@]}" -tag:v hvc1 -t "$DUR")
  ffmpeg -v error -y "${common[@]}" -x265-params "$x265:pass=1" -an -f mp4 /dev/null
  ffmpeg -v error -y "${common[@]}" -x265-params "$x265:pass=2" -an -movflags +faststart "$1"
}

# 1) the Adobe master (video only)
venc output/school_master_for_adobe.mp4 8000 11200 x265master
echo "master: $(stat -c %s output/school_master_for_adobe.mp4) bytes"

# 2) the two delivery files share one two-pass video stream; only the soundtrack differs
VK=$(python3 -c "print(int(68 * 8000 / $DUR - 320))")
MAX=$(python3 -c "print(int(round(1.4 * $VK)))")
LIMIT=$((68 * 1000 * 1000))
while :; do
  venc out/video_delivery.mp4 "$VK" "$MAX" x265delivery
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
