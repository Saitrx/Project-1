# What if all the schools disappeared?

An 85.5-second vertical (1080x1920 FHD, 60 fps) storybook animation for TikTok. It is drawn entirely in
JavaScript Canvas 2D and rendered deterministically in headless Chromium.

## Deliverables (`output/`)

| File | What |
| --- | --- |
| `school_voiceover.mp4` | Picture, sound effects and narrator. FHD 1080x1920, 60 fps, H.264, 20 Mbps, AAC 320 kbps (about 215 MB, stored with Git LFS). |
| `school_sfx.mp4` | Picture and sound effects only. Same video. |
| `school_master_for_adobe.mp4` | Picture only, for editing (see `ADOBE_EXPORT.md`). |
| `school_sfx.wav`, `school_sfx_vo.wav` | The two soundtracks: 48 kHz, 24-bit, about -14 LUFS. |
| `school_cover.png` | TikTok cover with the title, 1080x1920 (`node cover.mjs`). |
| `VERIFY.md` | ffprobe / loudness verification report. |

Other docs:
- `POSTING.md`: the TikTok posting checklist.
- `notes.md`: the style breakdown, narrator, sounds and mix.
- `PROGRESS.md`: progress and the quality-loop scores.

## How it is made
- **Picture**
  - `index.html` + `src/film.js` (timeline and transitions) + `src/scenes/*.js` (one module per
    scene) + `src/kit/*` (rig, motion, rings, scenery, the school and its vanish).
  - Every frame comes from `renderFrame(n)` with seeded randomness, so re-renders are identical.
- **Narration and sounds**
  - ElevenLabs (`eleven_v4` voice Alec; `eleven_text_to_sound_v2` effects), saved in `vo/` and
    `sfx/` and reused. Both takes of every v2 sound are in `sfx2/`; `audio/pick_takes.py` copies
    the better one to `sfx/` (report in `audio/takes_report.txt`).
  - `audio/vo_prep.py` fits the lines to the scenes.
  - `audio/mix.py` mixes both soundtracks: per-place ambience, effects placed and distanced on the
    on-screen events. There is no music, and no paper or typing sounds.

## Rebuild

```bash
npm install                                   # once (also needs ffmpeg and a global playwright)
python3 audio/vo_prep.py                      # fit the narration -> out/vo/, src/vo_timing.js
python3 audio/mix.py                          # -> output/school_sfx.wav, output/school_sfx_vo.wav
node render.mjs --from 0 --to 5130 --out out/frames --workers 3    # PNG frames, 60 fps (2160x3840 -> 1080x1920)
./encode.sh                                   # -> the three MP4s
python3 verify.py                             # -> output/VERIFY.md
```

Quick looks:
- `node render.mjs --frames 90,232 --scale 0.5 --out out/stills`
- Add `--query "only=curb&notext"` to render one scene without captions.
