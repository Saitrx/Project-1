# What if cars kept getting bigger?

A 70-second vertical (1080x1920, 30 fps) "What if?" video, rendered from JavaScript:
Three.js for the scenes, cannon-es for everything that breaks, and a separate 4K 2D canvas for
all text. Style notes taken from the reference are in [notes.md](notes.md).

## Render

```bash
npm install                                   # three, gsap, cannon-es, fonts, world-atlas, ws
node render.mjs --from 0 --to 2100 --out out/frames      # full quality: 2160x3840 -> 1080x1920 PNG
node render.mjs --from 0 --to 300 --scale 0.25 --out out/preview   # quick low-res check
./encode.sh                                   # final/what_if_cars_HQ.mp4 and final/what_if_cars.mp4
```

Needs Playwright with Chromium and ffmpeg. Every frame is a pure function of its frame number
(`renderFrame(n)`): no clock, seeded random numbers, and physics baked once at a fixed 120 Hz step.

## Image pipeline

- Each frame renders at 2160x3840 into a half-float HDR target with 4x MSAA; textures are
  mipmapped with anisotropic filtering.
- Post: soft bloom (headlights, bright sky), ACES filmic tone mapping, eyelids/focus pull for the
  wake-up, grain and a tiny dither.
- Text is drawn on its own 4K canvas, snapped to whole pixels and composited last (after bloom,
  tone mapping, eyelids, grain and camera shake).
- ffmpeg downsamples with Lanczos to 1080x1920 and writes lossless PNGs.

## Layout

- `src/timeline.js` script beats, counter values, facts, captions and the car scale curve.
- `src/overlay.js` HUD, captions, title and end card.
- `src/street/` the shared New York street world and the street shots (wake-up, manhole, lights,
  avenue, plow, giant).
- `src/shots/` aerial, space and the screen-crack ending.
- `src/kit/` engine pieces: city, vehicles, first-person arms, characters, physics bake, effects.

## Output

- `final/what_if_cars.mp4` 1080x1920, 30 fps, H.264 High, two-pass ~5,500 kbps (47.9 MB).
- `final/what_if_cars_HQ_part1..7.mp4` the CRF 12 / veryslow / film master (161 MB) split at whole
  seconds, ending at scene cuts where a whole scene fits under 30 MB; each part plays on its own.
  The full master is too big for GitHub; rebuild it with `./encode.sh`, or join the parts:
  `for i in 1 2 3 4 5 6 7; do echo "file what_if_cars_HQ_part$i.mp4"; done > parts.txt &&
  ffmpeg -f concat -i parts.txt -c copy what_if_cars_HQ.mp4`
- `final/stills/` five full-quality stills, a sheet comparing them with the reference, and a 2x
  crop comparing the lossless source with the HQ and normal encodes.
- `final/preview_opening_10s.mp4` low-res preview of the wake-up.
- `final/cover.png` / `cover.jpg` 1080x1920 cover: a clean frame (0:56.3) with the title, rendered
  with `node render.mjs --frames 1690 --query "shots=aerial&cover" --out out/cover`.
