#!/bin/bash
# Split the full-length videos into 3 parts, each under GitHub's 100 MB file limit, with no quality
# loss: the video is cut on keyframes (every 2 s) and copied as is (no re-encode, still FHD 60 fps
# H.264 20 Mbps); each part's sound is cut from the original WAV and encoded at AAC 320 kbps.
# The cuts fall between narration lines, so the parts also work as a 3-part series:
#   part 1  0-34 s     classroom, the vanish, the celebration, "No homework. No tests. No alarms."
#   part 2  34-58 s    the globe, the curb, the literacy bars
#   part 3  58-85.5 s  no doctors / engineers / pilots, the sad scene, the ending
# To get the one full video back, put the 3 parts one after another (TikTok's upload screen and
# CapCut both join clips you select in order).
#   ./encode.sh && ./split.sh     -> output/parts/school_{voiceover,sfx}_part{1,2,3}.mp4
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p output/parts
CUTS=(0 34 58 85.5)
for pair in "school_voiceover:school_sfx_vo.wav" "school_sfx:school_sfx.wav"; do
  name=${pair%%:*}
  wav=${pair##*:}
  for i in 1 2 3; do
    a=${CUTS[$((i - 1))]}
    b=${CUTS[$i]}
    d=$(python3 -c "print($b - $a)")
    n=$(python3 -c "print(round(($b - $a) * 60))")  # exact frame count, so no frame repeats at a join
    ffmpeg -v error -y -ss "$a" -i "output/$name.mp4" -ss "$a" -t "$d" -i "output/$wav" \
      -map 0:v -map 1:a -c:v copy -frames:v "$n" -c:a aac -b:a 320k -ar 48000 -ac 2 -movflags +faststart \
      "output/parts/${name}_part$i.mp4"
  done
done
stat -c '%n: %s bytes' output/parts/*.mp4
