# What if AI decided we were the problem? (70 s vertical video)

Deterministic Three.js renderer for a 1080x1920, 30 fps, 70-second "What if?" video.
See `STYLE_GUIDE.md` for the style breakdown taken from the reference video.

## Render

```bash
npm install
node audio.mjs                                   # out/audio.wav (ambience + sound effects, no music)
node render.mjs --scale 1 --out out/frames       # 4K internal -> Lanczos -> 1080x1920 PNG
./encode.sh                                      # H.264 CRF 14, slow, film, yuv420p, faststart
```

Useful options: `--from/--to` (frame range), `--frames 10,500` (stills), `--keep4k`
(also save the 4K frame), `--scale 0.25` (fast low-res preview), `--skip-existing` (resume),
`--query scenes=highway,airport` (build only some scenes while iterating).

## How it works

- `window.renderFrame(n)` draws exactly frame `n`; every animation is a pure function of
  `n / 30` (seeded RNG, GSAP eases evaluated by time, character motion pre-baked per frame).
- `src/engine.js`: 4x MSAA half-float scene target, soft bloom on bright lights only,
  ACES filmic tone mapping, grade, soft-focus, dither, and the 4K text overlay.
- `src/scenes/*`: one module per script beat; `src/program.js` handles timing, dissolves,
  fades to black, the HUD counter and captions (`src/timeline.js` holds the script).
- `render.mjs`: serves the page, drives headless Chromium with Playwright, receives raw
  frames over a WebSocket and pipes them to ffmpeg for the Lanczos downscale.
