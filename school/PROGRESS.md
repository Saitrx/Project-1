# PROGRESS — "What if all the schools disappeared?"

Project folder: `school/` (Canvas 2D, same pipeline as `dinos/`). Branch: `claude/adoring-thompson-x0mjor`.

## Status
**v2 done** (after the feedback on v1, see below). Outputs are rebuilt and every `verify.py` check
passes (`output/VERIFY.md`). The PNG frames were deleted after verification. A 720p H.265 preview
with the narrated mix is in `preview/school_v2_preview_720p.mp4` (25 MB).

| Output | Result |
| --- | --- |
| `output/school_voiceover.mp4` | 67.8 MB. H.265 / HEVC Main 4.1 (hvc1), 6.0 Mbps two-pass, -g 60, Rec.709, 30 fps CFR. AAC 320k 48 kHz. -14.2 LUFS, true peak -1.7 dBTP. |
| `output/school_sfx.mp4` | 67.7 MB. Same video. -14.2 LUFS, true peak -1.7 dBTP. |
| `output/school_master_for_adobe.mp4` | 85.3 MB. Video only, H.265 / HEVC Main 4.1 (hvc1), 8 Mbps two-pass. |
| `output/school_sfx.wav`, `output/school_sfx_vo.wav` | 48 kHz, 24-bit, -14.1 / -14.2 LUFS, true peak -2.0 dBTP (-1.7 dBFS after an AAC 320k round trip). |

## v2: what changed after the feedback on v1
Your feedback on v1:
- the sound effects were bad overall;
- no paper or typing sounds;
- better environment sounds, and more of them;
- the kids' voices didn't feel right;
- papers kept multiplying out of nothing from 13 to 19 s;
- the school turning into papers was bad;
- the jumping looked unrealistic;
- you wanted H.265 instead of H.264.

What changed:
- **Sounds:**
  - 57 new ElevenLabs sounds, two takes each (`sfx2/`), with the better take picked by measurement
    (`audio/pick_takes.py`); kids' takes are checked for a child's pitch;
  - one more (`ball_roll`) because the curb ball rolls and doesn't bounce;
  - no paper, pencil or ticking-diagram sounds anywhere;
  - a new mix: every place has its own ambience, and the voices and hits are panned and distanced
    to where each person is on screen, on the physics times of landings, jumps and the high five
    (`notes.md` has the full list).
- **The vanish:** wherever the ring passes, the school crumbles into fine dust in its own colours.
  A gust carries the dust away and it fades in the air; nothing lands, and no paper.
- **Papers:** none appear from nothing.
  - One girl holds her homework sheets from the moment the school vanishes.
  - At 19.05 s she throws them up once: they fan out above the grown-ups' heads, drift down like
    leaves and stay on the grass.
  - The paper plane, the homework sheets in the montage, and the scraps in the ending are gone.
- **Jumps:** `jumpMotion` gives each jump:
  - a crouch, an arm swing back, a push-off;
  - a real ballistic flight (heights vary);
  - a landing that absorbs the impact in the knees, then recovers, with short pauses between
    jumps.
  - The high-five pair run in, jump, and slap at the top of the jump.
- **Small timing moves so sounds are heard:**
  - the bored boy's sigh is now just after the opening question (3.4 s);
  - the curb girl sighs after the ball has rolled past her (47.6 s).
- **Export:** all three MP4s are now H.265 / HEVC (Main 4.1, `hvc1`), with the same bitrates and
  size limits.

**v2.1 (second round of feedback):**
- Your feedback: "the ahhh sound sucks, kinda loud, used too much", and the first 5 seconds must
  be perfect.
- All yawns, sighs and the kids' gasp are removed.
- The opening is now:
  - the clock's tick on the first frame, then the narrator;
  - a quiet room with birds behind the window;
  - after the question, the ticking clock alone (with one soft chair creak).
- Every effect is now levelled by loudness against the narrator. Before, short clips like the
  gasp, the sniffle and "what?" came out 5-8 LU louder than the voice; now none is louder than
  6.7 LU under it.
- The video stream is unchanged; the new soundtracks were muxed onto it and `verify.py` passes
  again.

**QA pass 3 (v2):**
- low-res frames of the whole film, with 0.1 s sheets of the pop, the celebration, the toss and
  the montage;
- then the full-quality frames every 0.5 s.

| Scene | a | b | c | d | e | f | Notes and fixes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 classroom | 9 | 9 | 9 | 9 | 9 | 9 | Ticks on the second hand; the sigh lands after the question. |
| 2 pop | 9 | 9 | 9 | 9 | 9 | 9 | Dust vanish: the building crumbles where the ring passes and blows away; nothing lands. The kids hang, drop and land, each with its own thump. |
| 3 confusion | 9 | 9 | 9 | 9 | 9 | 9 | Murmurs grow with the push-in; "what?" and "huh?" on two shrugs, after the line. |
| 4 celebrate | 9 | 9 | 8→9 | 9 | 9 | 9 | The tossed sheets first hung in front of the teacher's face for about a second. Now they fan out and rise above the grown-ups, then drift down. The jumps and the high five read as real. |
| 5 montage | 9 | 9 | 9 | 9 | 9 | 9 | The snore returns right after "No alarms"; the swing creaks at the bottom; the backpack lands on its thud. |
| 6 globe | 9 | 10 | 9 | 9 | 9 | 9 | No ticking; three soft puffs as the waves of dots go out. |
| 7 curb | 9 | 9 | 9 | 9 | 9 | 9 | The ball rolls (rolling sound, panned along it) and leaves frame at about 48.8 s; the sighs come after it passes. |
| 8 literacy | 9 | 9 | 9 | 9 | 9 | 9 | The bars fill and drain like sand. |
| 9 future | 9 | 9 | 9 | 9 | 9 | 9 | The light's buzz follows its flicker; a door down the corridor; the crane creak; the windsock. |
| 10 sad | 9 | 9 | 9 | 9 | 9 | 9 | Footsteps walking away and fading, a sniffle, a sigh. |
| 11 ending | 9 | 9 | 9 | 9 | 9 | 9 | No scraps. The ticks return, the board blows away as dust, the last ring, then silence. |

## Done (v1; the v2 changes are above)
- **References and notes**
  - References saved as `reference_{bee,film,dino}.mp4` (gitignored), with frames in `ref/`.
  - Style breakdown in `notes.md`.
- **Narration**
  - 11 lines with ElevenLabs `eleven_v4`, voice Alec – Nature Documentary Narrator
    (`Ovio1nb5Thj5cZeW3MPS`), saved in `vo/`.
  - `audio/vo_prep.py` fits every line inside its scene at speed 1.0, starting about 0.3 s in. It
    writes `out/vo/lineNN.wav` and `src/vo_timing.js`.
- **Sound effects**: v1 had 33 ElevenLabs `eleven_text_to_sound_v2` clips (prompt influence 0.5, loop
  for beds); v2 replaced them (see above).
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
