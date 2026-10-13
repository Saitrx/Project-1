# What if dinosaurs still existed today?

A 60-second vertical (1080x1920, 30 fps) "What if?" video. Every frame is drawn with the Canvas 2D
API in JavaScript: no image files, no 3D engine. Style notes from the reference (a code-drawn honey
bee animation) are in [notes.md](notes.md).

## Output

- `final/dinosaurs_sfx.mp4`: ambience and sound effects only.
- `final/dinosaurs_voiceover.mp4`: the same sound effects plus the narrator.
- `final/cover.png` / `final/cover.jpg`: the TikTok cover (1080x1920). It's the city shot at 25.3 s,
  zoomed 1.25x, with the title "What if dinosaurs never died?". The suggested caption is in
  `final/caption.txt`.

Both files have:
- **Video:** two-pass H.264 High, `veryslow`, `tune animation`, about 11.5 Mbps.
- **Audio:** AAC 256 kbps, 48 kHz, -12 LUFS, true peak below -1 dBTP.

There is no music in either version.

## Build

```bash
npm install                                        # fonts, world-atlas, topojson, d3-geo, ws
python3 audio/vo_prep.py                           # fit the narration (vo/) to the scenes
node render.mjs --from 0 --to 1800 --workers 3     # 2160x3840 -> 1080x1920 lossless PNGs in out/frames
python3 audio/mix.py                               # out/sfx_mix.wav and out/vo_mix.wav
./encode.sh                                        # both MP4s, each kept under 99 MB
node render.mjs --frames 760 --query "notext&cover" --out out/cover   # the cover (src/cover.js)
node render.mjs --from 0 --to 300 --scale 0.25 --out out/preview   # quick low-res check
```

Needs Playwright (Chromium) and ffmpeg.
- `renderFrame(n)` draws exactly frame `n`: there is no clock, and all randomness is seeded.
- Every textured element is drawn once into an offscreen layer at the resolution it is shown at.
  Animation then moves and bends those drawings (cut-out joints), so textures never flicker.
- Captions are drawn last on their own full-resolution layer.

## Layout

- **`src/film.js`:** scene timeline, transitions, paper grain and captions.
- **`src/scenes/`:** the ten scenes.
  1. Space and asteroid.
  2. Line-art globe.
  3. Forest.
  4. Fossil inset.
  5. Walled city.
  6. Airport.
  7. Farm.
  8. T. rex.
  9. Skeletons.
  10. Sidewalk.
- **`src/kit/`:** the drawing kit (hatching, stipple, fur, scales, paper), the plants, and the
  creatures. Creatures are cut-out rigs: mammal, T. rex, Triceratops, pigeon, and line-art skeletons.
- **`sfx/`, `vo/`:** ElevenLabs sound effects and narration, reused on re-renders.
- **`audio/`:** narration fitting and the mixer.
