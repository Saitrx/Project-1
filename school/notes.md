# What if all the schools disappeared? Style notes

Three references were studied: frames at 2 per second, 4-per-second strips across transitions, and
full-size close-ups of single frames. The frames are kept locally in `ref/`; the PNGs are not
committed.

| File | What it is | Format |
| --- | --- | --- |
| `reference_bee.mp4` | Code-drawn illustrated life of a honey bee | 720x720, 24 fps, 53 s |
| `reference_film.mp4` | Cream-paper film with thin expanding rings and cinematic illustrated scenes | 1280x720, 24 fps, 28 s |
| `reference_dino.mp4` | The previous video in this series ("What if dinosaurs never died?"), Canvas 2D | 1080x1920, 30 fps, 60 s |

Logos, titles, wordmarks and brand names in the references are not used anywhere.

## 1. Drawing style and textures

**Bee reference (code-drawn storybook)**
- Flat colour shapes with soft two-tone shading.
- Thin warm dark-brown outlines (about `#2e2219`), never pure black; line weight about 1/400 of
  the frame.
- Shading is drawn, not airbrushed:
  - groups of parallel hatch lines in a darker tone of the base at 20-40% opacity;
  - cross-hatching on the darkest side;
  - loose scribble clusters on large surfaces.
- Fur and grass are thousands of single thin strokes, dark at the root and light at the tip, with
  ragged silhouette edges.
- Glossy round things (eyes, honey, dew) get a thin white arc plus a small white dot.
- Stipple dots for pollen, wax and soil.
- Paper grain over everything: fine speckle plus faint, larger blotches of tone.

**Film reference (soft cinematic illustration)**
- Large, soft gradients with atmospheric depth:
  - layered hills that fade into haze toward the horizon;
  - volumetric light shafts and glows;
  - silhouettes against bright skies.
- Very visible film grain on dark scenes. The paper scenes are a warm off-white `#e9e4da` with a
  fine grain and a soft vignette.
- Simple, readable silhouettes. Detail is in the light, not in outlines; many shapes have no
  outline at all.

**Dino reference (this series)**
- The bee recipe adapted to 9:16:
  - outlined flat shapes with hatch shading;
  - stroke-grass meadows;
  - layered cloud skies;
  - hatch-shaded coats on simple people.
- Big environment shots with the subject in the middle third and captions in the lower-middle area.

**What this video takes from them**
- From the bee and dino videos: the outlined, hatch-shaded storybook figures and props, stroke
  grass, stipple and paper grain.
- From the film: the soft gradient skies, haze layers between depth planes, glows and the
  cream-paper interstitials.
- Everything is seeded and drawn once into offscreen layers, so textures never boil.

## 2. Colour palettes

| Use | Colours |
| --- | --- |
| Classroom (warm, sleepy) | wall ochre `#e7cf9f`, wainscot `#b98a57`, chalkboard green `#3f5a4a` with chalk white `#efe9da`, wood desks `#a87445`, window sky `#bcd8e3` |
| Outdoors (bee and dino meadow) | sky `#a9cfe0` fading to near-white `#f1ead6` at the horizon, meadow `#bccd9a`/`#9fbb6a`, leaf green `#628d46`, warm path `#d9c39a` |
| Film-style skies (dusk, sad and future scenes) | peach `#f2c9a6` to lilac `#b9a3c9` to dusk violet `#5d4f86`; haze layers in lavender `#cbbfd9` |
| Cream paper (film interstitials, ring motif) | paper `#ebe5d8`, ring blue `#2f6fc4`, highlight pink `#e0508f` (used sparingly) |
| Diagrams (bee) | dark brown `#180f0b`, cream line `#f1e3c2`, lavender construction lines `#8e8fd6`, gold dots `#e8b04a`, red measure `#d8463d` |
| People | skin tones from light peach to deep brown (`#f1c7a5` `#d9a07a` `#b07651` `#7a4a2e`); clothes in muted mustard, teal, brick, sage, denim, plum |

## 3. Diagrams and circular insets

**Bee**
- Technical drawings: cream outlines on dark brown, with hex grids and dot fills inside a form.
- Lines draw on progressively, like a compass, followed by construction lines and sparkle nodes.
- Circular insets: a cream disc with a thin dark rim, holding a line-art cross-section. It sits in
  the upper part of the frame, joined to its subject by two thin lines, while the scene moves
  underneath.

**Film**
- Circular insets are windows into another illustrated scene: a disc with a thin blue rim on cream
  paper.
- The disc grows from the central dot and later opens to fill the frame.

**Dino**
- Dark rounded-rectangle chart panels (balance, bars) and a line-art globe with gold dots and a
  donut chart.

**In this video**
- Line-art globe (scene 6): cream lines on dark brown, school dots in gold that blink off, a
  lavender graticule, and a counter.
- Literacy bars (scene 8): the same palette. The 1820 bar fills to 12% and the today bar to 87%; on
  "slide back" the today bar slowly drains, leaving a dashed ghost line at 87%.
- Circular insets with a thin blue rim (film style), each popping in with a ripple ring:
  - the montage: sleeping in, the park, the backpack thrown away;
  - the calendar crossing off the days on the curb;
  - the boy squinting at the LIBRARY sign as its letters scramble;
  - the empty cockpit, joined to the plane by a dashed callout line.

## 4. The ring / ripple motif (film)
- A small glossy blue sphere sits at the centre: a white specular dot and a soft offset shadow.
- Thin rings expand from it:
  - one solid ring, plus a dashed outer ring;
  - line width about 0.25% of the frame width;
  - the rings ease out as they grow and thin and fade at the end.
- Short tapered arc strokes (like `)))`) flick outward beside the rings. They look like sound waves
  and give motion.
- Rings also pass over illustrated scenes as thin glowing circles (blue with a lighter inner line).
- **For the pop (scene 2):**
  - a thin ring ripples out from the school, with a second dashed ring and arc flicks;
  - the building breaks into drifting paper scraps and chalk dust;
  - the rings thin and fade away.
- **Echoes:**
  - a faint ring pulse when the globe's dots blink off;
  - a final ring at the very end, where the clock tick returns.

## 5. Camera moves, transitions and pacing

**Camera**
- Bee: locked or very slow push-ins and pans, a little parallax, ease-in-out zooms, nothing
  handheld.
- Film: a fixed centre point with cuts or circular wipes from scene to scene every 0.5-1.5 s in its
  montage. Its slower shots drift gently.
- Dino: slow pushes, a one-second dissolve or shape-match between scenes, and a new idea every
  4-6 s.

**Transitions in this video**

| From → to | Transition |
| --- | --- |
| 1 → 2 | The classroom shrinks into its window on the school building (one continuous move out) |
| 2 → 3 → 4 | One continuous shot: the pop, the landing, then the camera eases closer for the confusion and the celebration and pans to the teachers |
| 4 → 5 | A thrown paper flies at the camera and fills the frame with cream paper |
| Inside 5 | Circular-inset montage on cream paper (film style), the insets popping in script order |
| 5 → 6 | A dark circle opens from the centre with a blue ring, revealing the globe on dark brown |
| 6 → 7, 7 → 8, 8 → 9, 9 → 10 | 0.8 s dissolves |
| 10 → 11 | A 1 s dissolve to the same framing as the first shot. The clock ticks return; a final ring and a fade to cream paper end it. |

**Pacing**
- A new beat every 2-4 s, and each held long enough to read.
- Characters always move: breathing, weight shifts, blinks of the head (no faces), wind in hair and
  grass.

## 6. People (this video)
- Simple illustrated kids and teachers with no facial features. Head shapes carry hair, ears and a
  soft cheek shade, and emotion comes from posture only.
- Women and girls wear long skirts or loose dresses, with their hair visible and no head covering.
- Rigs are cut-out puppets with joints at the neck, shoulders, elbows, hips and knees, and a spine
  bend. Poses are blended keyframes with breathing and secondary motion, so nothing pops or slides.
  Walk cycles plant their feet.

## 7. Captions
- EB Garamond Medium, 58 px on the final 1080x1920 frame (116 px at the 2160x3840 render size).
- Cream `#faf3e2` with a soft dark shadow (wide glow plus a tight drop shadow).
- On their own full-resolution layer, drawn after `document.fonts.ready`.
- The last baseline is at y 1470, so the bottom 20% stays clear.
  - Lines are centred at x 530, inside x 170-910, clear of the right 15%.
  - The opening and closing lines are centred at x 300, beside the boy instead of over him.
- They fade in over 0.25 s (with a small rise) and out over 0.3 s.
- Timing comes from the narration: each chunk appears as its words start.
- List lines build up in place: "No homework. No tests. No alarms." and "No new doctors. No
  engineers. No pilots."

## Narrator
- **Chosen voice:** Alec – Nature Documentary Narrator, `voice_id` `Ovio1nb5Thj5cZeW3MPS`. It is the
  same library voice as the dinosaur video, so the series sounds consistent.
  - The search for "documentary narrator" and "deep storyteller" (male, English) also turned up
    Cedric M, Atlas, Oliver, North and Chris. Alec is the calm, warm, deep documentary candidate.
  - It is not a clone of any real person.
- **Model:** `eleven_v4`, the newest TTS model on the account (the account also offers v3,
  multilingual v2, turbo v2.5 and flash v2.5).

## How the sounds and narration were made
- **No API key was used or stored.** The session had no `ELEVENLABS_API_KEY`. Everything was
  generated through the ElevenLabs connector (MCP), which runs the same models as the API:
  - `eleven_text_to_sound_v2` for sound effects, prompt influence 0.5, with loop on for the beds;
  - `eleven_v4` for the narration.
- The REST-only extras were therefore not available, such as timestamps and
  previous_text/next_text.
  - Line timings came from audio analysis instead (`audio/vo_prep.py`).
  - Lines 6, 8 and 11 were each generated as two requests (sentence by sentence), because the
    account intermittently rejected longer requests. The parts are joined with natural pauses.
- Numbers are spelled out for speech:
  - "twenty-twenty";
  - "one and a half billion";
  - "eighteen twenty";
  - "twelve percent".
- All files are saved and reused:
  - sound effects in `sfx/` (33 clips);
  - narration takes in `vo/`;
  - fitted lines in `out/vo/` (regenerated by `audio/vo_prep.py`).

## Sound design (organic only: no music, melodies, stingers, risers or tonal pads)

| Scene | Sounds (`sfx/*.mp3`) |
| --- | --- |
| 1 classroom | `classroom_tone` bed. `clock_tick`, one tick on each second, synced to the second hand. `pencil_scratch`, `kid_yawn` (twice), `chair_creak`, `bored_sigh`. |
| 2 the pop | Distant ticks from the school's clock, then `pop_whoosh` (peak on the pop) and `ring_whoosh`. `paper_flutter` as the building breaks into paper. `soft_thumps`: one soft thump per kid, timed from the fall maths. |
| 3 confusion | `field_amb`, `murmurs`, three `huh` moments, short grass rustles from `footsteps_grass` as kids get up. |
| 4 celebration | `kids_cheer`, `kids_laugh`, `clap_stomp`, `high_five` on the high five, `papers_toss` on each paper throw. |
| 5 montage | `park_amb`, `birds_morning`, `wind_soft`, `snore` (sleeping in), `swing_creak`, `paper_rustle` (paper plane), `backpack_thud` on the landing. |
| 6 globe | `paper_rustle` and `soft_ticks` while the dots go out. |
| 7 curb | `wind_soft`, `distant_traffic`, `leaves_rustle`. `ball_bounce`, panned left to right as the ball rolls away. Two `bored_sigh`s. |
| 8 literacy | `paper_rustle` and `soft_ticks` as the bars draw and fill. A breath of wind under the inset; paper rustles as the letters tumble. |
| 9 future | `hallway_echo`, then `bridge_wind`, then `airfield_wind`, each arriving with its panel. `paper_rustle` per panel; `ring_whoosh` for the cockpit inset. |
| 10 sad | `wind_soft`, `leaves_rustle`, distant `footsteps_grass` walking away, one sigh. |
| 11 ending | `field_amb` and wind. The same `clock_tick` as scene 1 returns on each second (77-81 s), chalk dust (`paper_flutter`), and a last `ring_whoosh` on the final ring (81.5 s). Then silence to the end. |

**Mix (`audio/mix.py`, numpy engine `audio/engine.py`)**
- Clips are normalised, placed on beds and spot buses, and looped with equal-power crossfades.
- Sound-effects version: mastered to about -14 LUFS, true peak below -1 dBTP (oversampled limiter),
  48 kHz, 24-bit.
  - Each mix is also round-tripped through AAC 320k, the delivery codec. Any spot the encoder
    would push over is turned down locally and re-limited, so the MP4s stay below -1 dBTP too.
- Voiceover version:
  - The effects dip 7 dB while the narrator speaks (150 ms attack, 450 ms release), so the pop, the
    cheer and the ball come back up between lines.
  - A ceiling also keeps the effects at least 6.5 dB under the voice during speech, even at the
    loudest moments.
  - Measured: the voice sits about 10.6 dB above the effects (median of 0.5 s windows while
    speaking).
