# PROGRESS — "What if all the schools disappeared?"

Project folder: `school/` (Canvas 2D, same pipeline as `dinos/`). Branch: `claude/adoring-thompson-x0mjor`.

## Status
Being rendered and encoded; see the end of this file for the final state.

## Done
- **References and notes**
  - References saved as `reference_{bee,film,dino}.mp4` (gitignored), with frames in `ref/`.
  - Style breakdown in `notes.md`.
- **Narration**
  - 11 lines with ElevenLabs `eleven_v4`, voice Alec – Nature Documentary Narrator
    (`Ovio1nb5Thj5cZeW3MPS`), saved in `vo/`.
  - `audio/vo_prep.py` fits every line inside its scene at speed 1.0, starting about 0.3 s in. It
    writes `out/vo/lineNN.wav` and `src/vo_timing.js`.
- **Sound effects**: 33 ElevenLabs `eleven_text_to_sound_v2` clips (prompt influence 0.5, loop for
  beds) in `sfx/`.
- **Renderer**: `render.mjs` + `index.html` + `src/film.js` draw at 2160x3840 and downscale with
  Lanczos to 1080x1920 PNG.
  - Paper grain and a moving seeded dither tile prevent banding.
  - Captions are a separate full-resolution layer.
- **Kit**
  - `src/kit/person.js`: faceless puppet rig with hatch shading, stroke hair, skirts and IK.
  - `src/kit/motion.js`: poses, walk, jump and dance cycles.
  - `src/kit/rings.js`: the film's dot, rings and flicks.
  - `src/kit/building.js`: the school and the vanish.
  - `src/kit/scenery.js`: sky, hills, meadow, trees, grass, beams.
- **Scenes**: `s01_classroom`, `s02_field` (scenes 2-4), `s05_montage`, `s06_globe`, `s07_curb`,
  `s08_literacy`, `s09_future`, `s10_sad`, `s11_ending`.
- **Mix**: `audio/mix.py` writes `output/school_sfx.wav` and `output/school_sfx_vo.wav`.
  - 48 kHz, 24-bit, -14.2 LUFS, true peak -1.9 dBTP.
  - In the narrated mix the effects are ducked 7 dB, and the voice sits about 10.6 dB above them on
    median.
- **Checks so far**
  - Four full-quality stills compared with the references: bored boy (3.0 s), pop (8.3 s),
    celebration (20.0 s), ending (80.0 s).
  - 10 s low-res preview of the pop and celebration with the narrated mix:
    `preview/school_preview_10s.mp4`.

## Timeline (seconds)
| # | Scene | Time |
| --- | --- | --- |
| 1 | classroom | 0-5.5 |
| 2 | pop | 5.5-11.5 (pop at 7.62) |
| 3 | confused | 11.5-18.5 |
| 4 | celebrate | 18.5-27.5 |
| 5 | montage | 27.5-34.5 |
| 6 | globe | 34.5-42.5 |
| 7 | curb | 42.5-50 |
| 8 | literacy | 50-58.5 |
| 9 | future | 58.5-66 |
| 10 | sad | 66-75 |
| 11 | ending | 75-85.5 |

Total 85.5 s = 2565 frames at 30 fps.

## Quality loop scores
Criteria: (a) script, (b) style, (c) animation, (d) emotion, (e) text, (f) sync. Anything under 9
gets fixed.

**Pass 1**: low-res frames every 0.5 s (`out/qa1`, contact sheets `out/qa1_sNN.png`), compared with
the reference contact sheets.

| Scene | a | b | c | d | e | f | Notes and fixes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 classroom | 9 | 9 | 9 | 9 | 8→9 | 9 | Caption covered the boy's arm and desk; captions for lines 1 and 11 moved left of him (x 300). |
| 2 pop | 9 | 9 | 9 | 9 | 9 | 9 | The ring ripples from the school; it bursts into paper scraps and chalk dust; kids hang, then drop softly. |
| 3 confused | 9 | 9 | 8→9 | 8→9 | 9 | 9 | Kids too small to read their head turns and shrugs; the camera now pushes in from 8.95 s (z 1.03 → 1.62 → 1.95). |
| 4 celebrate | 9 | 9 | 9 | 9 | 9 | 9 | Jump, dance, spin, high five, paper throws. Teachers crossed arms / hands on head, with the pan to them at 21.7 s. |
| 5 montage | 9 | 9 | 9 | 9 | 8→9 | 9 | Caption overlapped the backpack inset; the insets were raised (park y 975, bag y 1066). |
| 6 globe | 9 | 10 | 9 | 9 | 9 | 9 | Dots blink off in waves; 2020 and the 1.5 billion count. |
| 7 curb | 9 | 9 | 9 | 9 | 9 | 9 | Re-staged so faces aren't hidden. The ball rolls across past every kid and nobody chases it. The row was re-spaced so no head sits in the right 15%. |
| 8 literacy | 9 | 9 | 9 | 9 | 9 | 9 | 1820 12% vs today 87%, the today bar drains. The kid looks up, shades his eyes, shrugs as the LIBRARY letters scramble. |
| 9 future | 9 | 9 | 9 | 9 | 9 | 9 | Empty hallway (white coat on a hook, flickering light), half-built bridge (crane hook sways), parked plane plus an empty-cockpit inset. |
| 10 sad | 9 | 9 | 9 | 9 | 9 | 9 | Kid under the tree hugging his knees; the four friends turn away one by one and walk off; leaves fall. |
| 11 ending | 9 | 9 | 9 | 9 | 9 | 9 | Same boy, same framing and pose as scene 1. The chalk-ghost classroom with the ticking clock, the board blows away, a final ring, silence, fade to cream. |

**Pass 2**: the full-quality render (`out/frames`), every 0.5 s (contact sheets `out/qa2_sNN.png`),
plus 100% crops of the captions, insets and line art.

| Scene | a | b | c | d | e | f | Notes and fixes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 classroom | 9 | 9 | 9 | 9 | 9 | 9 | Caption beside the boy; clock ticks on the second hand. |
| 2 pop | 9 | 9 | 9 | 9 | 9 | 9 | The pop lands just after "One second it's there..." (7.62 s); paper scraps and chalk dust; soft landings. |
| 3 confused | 9 | 9 | 9 | 9 | 9 | 9 | The closer camera reads the head turns, stand-ups and shrugs; teachers frozen with chalk and books. |
| 4 celebrate | 9 | 9 | 9 | 9 | 9 | 9 | The pan to the teachers lands on "The teachers aren't smiling." |
| 5 montage | 9 | 9 | 9 | 9 | 8→9 | 9 | The montage camera shifted down 40 px and zoomed, so the caption still touched the backpack inset. The push is now anchored at y 700 and the bag inset sits at y 1040; frames 807-1049 were re-rendered. |
| 6 globe | 9 | 10 | 9 | 9 | 9 | 9 | Crisp caption; the 2020 / 1.5 billion count is in sync. |
| 7 curb | 9 | 9 | 9 | 9 | 9 | 9 | The ball rolls past all four kids; nobody chases it. |
| 8 literacy | 9 | 9 | 9 | 9 | 9 | 9 | Bars, drain and sign scramble are all on their words. |
| 9 future | 9 | 9 | 9 | 9 | 9 | 9 | Each panel arrives on its word (doctors / engineers / pilots). |
| 10 sad | 9 | 9 | 9 | 9 | 9 | 9 | Head down, the lift to watch the friends go, the friends drift apart. |
| 11 ending | 9 | 9 | 9 | 9 | 9 | 9 | Same pose as the opening, the clock ticks return, a last ring, then silence and a fade to cream. |

Every scene scores 9 or more on every criterion after pass 2.

## SFX nodes (flow kSenice3CXT0OF5IiamY)
All 33 are generated and downloaded to `sfx/<name>.mp3` (see `notes.md` for what each one is
used for). With a concurrency limit of about 2, they were run one or two at a time with
`generations_count` 1.
