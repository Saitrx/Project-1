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
  - wherever the ring passes, the building crumbles into fine dust in its own brick, cream and roof
    colours; a gust carries it off and it fades in the air (nothing lands, no paper);
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
| 4 → 5 | The film's blue dot pops at the centre and a circle opens onto the cream-paper montage |
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
  - sound effects in `sfx/` (v1 used 33 clips; v2 replaced them, see below), with both takes of
    every v2 sound in `sfx2/` (session ids in `audio/sfx2_sessions.json`);
  - narration takes in `vo/`;
  - fitted lines in `out/vo/` (regenerated by `audio/vo_prep.py`).

## Sound design (organic only: no music, melodies, stingers, risers or tonal pads)

**v2 (after feedback on v1).** The v1 sounds were rejected: the paper and "typing" sounds (paper
rustles and soft ticks on the diagrams, pencil scratching) were annoying, the kids didn't sound
right, and there wasn't enough real environment. For v2:
- **No paper, pencil or ticking-diagram sounds anywhere.** The only ticks left are the wall clock
  the boy is staring at (scene 1) and its ghost in the ending, both softened as a clock across a
  room.
- **57 new sounds** from `eleven_text_to_sound_v2` (the account is on the Starter plan now), each
  generated twice. `audio/pick_takes.py` keeps the better take of each:
  - it measures clipping, silence and tonality (music-like steady pitches are rejected);
  - for kids it checks the pitch (children speak at about 250-450 Hz; an adult-sounding take loses);
  - for beds it checks steadiness; for hits, one clean hit.
  - Its numbers are in `audio/takes_report.txt`. Some second takes are kept as `*_alt` for
    variation.
- **Realism rules in the mix:**
  - every place has its own continuous ambience, crossfaded on the picture's transitions, so the
    sound never drops out until the intended silence at the end;
  - voices and hits are panned to where the person is on screen;
  - far kids are quieter, duller and carry more of the place's reverb (a short outdoor or room
    reverb per place);
  - repeated actions use different takes, pitches and levels;
  - ambience beds are high-passed (their wind rumble only muddies the mix), and hissy beds are
    softened.
- **Timing comes from the scene code:**
  - fall landings use the same physics (`FALL_G`);
  - jump take-offs and landings come from `jumpMotion` (worked out with a small script);
  - the high-five slap is at the top of the two kids' jump;
  - the swing creaks at the bottom of each swing;
  - the ball's pan follows its decelerating roll;
  - the flickering hallway light's buzz dips when the tube dims.

| Scene | Sounds (`sfx/*.mp3`) |
| --- | --- |
| 1 classroom | `classroom_tone` room tone. `clock_tick` on each second (the second hand), across the room. A stretching yawn at the back, a yawn behind a hand at the front (`boy_yawn`, muffled). The bored boy's `boy_sigh` just after the opening question (3.3 s). `chair_creak`. |
| 2 the pop | `field_morning` and `breeze` outside. The school's own clock ticks far off until the pop. The air is drawn in as the blue dot swells, then `vanish_whoomp` on the pop and `dust_gust` carrying the dust off to the right. `kids_gasp` while they hang in the air. Each kid's landing (a soft `hop_thump` plus a little low `grass_thud`) at its own physics time and screen position. `kid_oof` (with a giggle). |
| 3 confusion | `kids_murmur` growing as the camera pushes in. Short `grass_steps` as four kids get up. `boy_what` and `girl_huh` on two shrugs, after the narration line. |
| 4 celebration | `kids_cheer` bursting as they jump up, `kids_run` for the two runners, `girl_yay` as she tosses her homework (no paper sound), `high_five` at the top of the jump, landings, `kid_wheee` from the spinning girl, `kids_laugh`, `kids_clap`, dancing footsteps (`grass_steps_alt`), every jump landing. The kids drop back while the camera is on the teachers: `woman_tsk`, `man_groan`. A second cheer and laugh as the camera returns. |
| 5 montage | Birds outside the bedroom window (`garden_birds`), kids far off in the park (`park_far_kids`), `breeze`. The sleeper snores, and again right after "No alarms" (`snore`). `swing_chains` creaks at the bottom of each swing. The park kid's jump landings. The backpack's swish (`air_swish`, pitched down), `backpack_land`, the bag kid's landing. |
| 6 globe | `hall_air` only (a diagram). The dots appear with a fine `sand_trickle` sprinkle, then go out in three waves: three soft `candle_puff`s moving east to west. No ticking count. |
| 7 curb | `street_evening`, `leaves_skitter`, `breeze`, a `car_far` passing. The calendar inset's swish. `ball_roll` (made for v2): the nudge and a gritty roll that slows and fades, panned along the ball's path. `boy_sigh_alt` and `girl_sigh` after the ball passes. A `dog_far` barking far away. |
| 8 literacy | `hall_air`, then `street_evening` around the LIBRARY sign in the inset. The frames swish on; each bar fills like sand pouring in (`sand_trickle`); the Today bar drains like sand running out. `boy_hmm` once the line is over. |
| 9 future | `hospital_corridor` with the flickering `light_flicker` buzz (it dips with the tube and stops when it dies) and a `door_far` closing down the corridor. Then `bridge_wind` and `river`, with `crane_creak` as the hook swings. Then `runway_wind` and the windsock (`flag_flap`). A soft `air_swish` as each panel slides onto the page. |
| 10 sad | `dusk_crickets`, `tree_leaves`, `breeze`. The friends' footsteps walking away and fading (`steps_away_gravel`, two layers). The kid's `boy_sniffle`, then a slower `boy_sigh`. |
| 11 ending | The field again (`field_morning`, `breeze`), quieter. The same sigh, quieter, and the same clock ticks (76-81 s, with the classroom's room sound, like a memory). The chalk board blows away (`dust_gust`, softened). The last ring with `breath_whoosh` (81.5 s), then silence. |

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
  - A few loud moments that land on words (the cheer's first second, the yawns, the backpack, the
    puffs, the bridge wind, the ending ticks) get a further 2-4 dB in this version only
    (`VO_RIDES`); the effects-only version keeps them full.
  - Measured: the voice sits about 10.6 dB above the effects (median of 0.5 s windows while
    speaking).
