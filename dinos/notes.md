# What if dinosaurs still existed today? Style notes

## Reference breakdown

The reference (`reference.mp4`, 720x720, 24 fps, 53 s) is an illustrated, code-drawn animation of a honey
bee's life. I studied frames at 2 per second, close-ups of single frames, and frame strips across the
transitions (kept locally in `ref/`; the PNGs are not committed).

### Drawing style and line work
- Flat colour shapes with soft two-tone shading. Most shapes have a thin outline in warm dark brown
  (about `#2e2219`), never pure black. Line weight is even, about 1/400 of the frame.
- Shading is drawn rather than airbrushed:
  - groups of parallel hatch lines, about 0.5 px, in a darker tone of the base at 20-40% opacity;
  - cross-hatching on the darkest side;
  - loose "scribble" clusters of straight strokes scattered over large surfaces.
- Fur is thousands of individual thin strokes, dark at the root and light ochre at the tip. They
  radiate from the body with small random angle jitter, and the silhouette edge is ragged with hairs.
  Legs are dark segments with tiny bristles.
- Wings and membranes are transparent grey with thin vein lines.
- Highlights on glossy round things (eyes, honey, dew) are a thin white arc plus one small white dot.

### Textures
- Paper grain over everything: fine speckle, plus faint, larger blotchy tone variation.
- Surfaces carry stipple dots, tiny specks of lighter and darker tone (pollen, wax), and soft
  concentric rings in the pollen cells.
- The night scene and the tree bark are covered with dense short scratch strokes (wood grain).

### Colour palette
- **Warm hive:** honey amber `#e7bf60`, wax cream `#efe1c4`, ochre and brown wall shading
  `#c2a582` / `#8a5a2b`, bee brown `#6c4b24`.
- **Outdoor:**
  - pale sky blue `#a9cfe0` fading to near-white at the horizon;
  - sage and meadow greens `#c2d588` / `#bccd9a`;
  - leaf green `#628d46`;
  - accents of blossom white-pink and crimson buds.
- **Diagrams:**
  - near-black warm brown background `#180f0b`;
  - cream line art `#f1e3c2`;
  - thin lavender-blue construction lines `#8e8fd6` with tiny 4-point sparkles at the nodes;
  - gold dots `#e8b04a`;
  - occasional magenta or green tint inside a line-art form.
- **Measurement overlays** on top of illustrations: a red line `#d8463d` with tick marks, dashed
  segments, an angle arc and a sun icon.
- **Night:** indigo `#262759` with dense lighter scratches.

### Diagrams and insets
- Diagrams are "technical drawings":
  - cream outlines on dark brown;
  - hex grids and dot fills inside a form;
  - wireframe or contour-line versions of the animals;
  - a small tree diagram in the corner, built up branch by branch.
- Lines draw on progressively, like a compass. A point travels and leaves the circle behind it, then
  the construction lines and nodes appear one after another.
- Circular insets are a cream disc with a thin dark outline holding a line-art cross-section (the
  flower anatomy). They sit in the upper part of the frame while the scene keeps moving underneath.
- Staged diagrams (larva to pupa to bee) show the current stage bright and the earlier and later
  stages as dim ghosts beside it.

### Camera moves
- Mostly locked or very slow:
  - slow pans along a branch;
  - gentle push-ins on a cell;
  - a little parallax between foreground blossoms, the branch and the far horizon.
- A few hard top-down map shots (the meadow) with drawn overlays.
- Zooms are smooth ease-in-out; nothing is handheld.

### Transitions and pacing
- **Illustration to line art:** a colour illustration dissolves into its own line-art or wireframe
  version on the dark background (the bee becomes a wire drawing, then the diagram takes over).
- **Shape continuity:** circle to circle, so the egg, the flower inset and the sun hold the same
  place on screen. A cell zoom becomes the next scene.
- Objects pop in with small staggered delays (dots, flowers, stages), each with a short ease-out
  scale.
- A new idea comes every 3-6 seconds, and each shot holds long enough to read.
- Animals move continuously: wing shimmer, antennae, leg steps, bobbing flight. Nothing is frozen.

### Text
The reference has no captions. Its signature text at the very end is not used here.

## Adaptation for this video (9:16, 1080x1920 at 30 fps, rendered at 2160x3840)
- Same layer recipe, drawn by code with seeded random numbers:
  - flat fills;
  - warm-brown outlines;
  - hatch and cross-hatch shading clipped to each shape;
  - stipple;
  - fur or feather strokes;
  - white arc highlights;
  - paper grain on top.
- Every textured element is drawn once into an offscreen canvas at the resolution it is shown at, so
  its texture never changes between frames. Animation moves and bends these drawings (cut-out
  puppet joints), so nothing boils.
- The diagram scenes (the life dots, the fossil inset frame, the weight and bite diagrams, the
  skeletons) use the dark-brown and cream technical style with lavender construction lines, draw-on
  lines and sparkle nodes.
- Measurement overlays (wingspan) use the reference's red dashed line with tick marks.
- Transitions:
  - the asteroid shot's Earth dissolves into its line-art twin;
  - a life dot opens into the forest;
  - the circular fossil inset grows from the hiding mammal;
  - the inset shrinks to a sun-like disc over the city;
  - the T. rex dissolves into its line-art skeleton, which morphs into the chicken skeleton;
  - the chicken's line art dissolves into the pigeon on the sidewalk.
- People are simple illustrated figures. Women wear long skirts or loose clothing with their hair
  visible.

## Narrator
- **Chosen voice:** Alec – Nature Documentary Narrator. `voice_id`: `Ovio1nb5Thj5cZeW3MPS`.
  - From the ElevenLabs voice library: a calm, warm, cinematic nature-documentary narrator, male,
    middle-aged. It is not a clone of any real person.
  - Of the candidates found by searching "documentary narrator" (Alec, Atlas, Cedric, Max), it had
    the deepest pitch (median F0 about 105 Hz in its preview).
- **Model:** `eleven_v4`, the newest and highest-quality text-to-speech model offered on the account.
  The output format is fixed at mp3 44.1 kHz 128 kbps; it is resampled to 48 kHz in the mix.
- **How it was generated:**
  - Through the ElevenLabs connector, because no `ELEVENLABS_API_KEY` was set in this environment.
    The connector does not expose `previous_text` / `next_text` or the with-timestamps alignment.
  - One request per line, with numbers spelled out ("sixty-six million", "seventy-five percent",
    "ten-meter", "eight times", "ten thousand") and "T-rex".
  - Line timing comes from analysing the audio instead (`audio/vo_prep.py`): speech onset, pauses and
    sentence breaks.
- **Fitting each line to its scene:**
  - Each line starts 0.3 s into its scene; the first line starts at 0.2 s.
  - Over-long pauses between sentences were tightened.
  - Lines 1, 4 and 10 were sped up slightly (atempo 1.11x, 1.12x and 1.05x, pitch unchanged), so
    every line ends before its scene does. No words were cut.
- **Captions:** each caption fades in when its sentence starts; the times are in
  `src/vo_timing.js`.
- **Visuals on the words:** after feedback that the diagrams came in after the narrator had said
  the words, the lines were transcribed with ElevenLabs Scribe (word timestamps, no credit cost) and
  mapped into video time through the same trims and speed-ups (saved in `audio/vo_words.json`).
  Each diagram now moves while its words are spoken:
  - the life dots pop on during "About seventy-five";
  - the donut fills to 75% during "seventy-five percent" (5.8-6.9 s);
  - a glow wave runs over all the dots on "all species";
  - the doomed dots dim, then flare back on "survived" (8.6 s);
  - the balance opens on "weighs", and the elephant lands on "elephant" (38.8 s);
  - the bite chart opens on "bites", the 8x bar grows on "eight times", and the lion row lights up
    on "lion".

## Audio
- There is no music in either version.
- **Sound effects:**
  - Generated with ElevenLabs sound generation (`eleven_text_to_sound_v2`, prompt influence 0.5,
    loop on for the ambience beds) and saved in `sfx/`, so re-renders reuse them.
  - The important sounds got 2 takes each. I picked by waveform and loudness:
    - meteor fly-by: `meteor2_b` (the smoother of the two, one clean build and fade);
    - zoom whoosh: `zoom_b` (smoother, no rough edges);
    - footstep: b (fuller thud);
    - city call: b (take a clipped);
    - wing flaps: a (three distinct beats);
    - T. rex growl: b (lower noise floor);
    - pigeon coo: a (cleaner, more headroom).
- **Narration:** saved in `vo/`.
- **Mix** (`audio/mix.py`):
  - Ambience beds crossfade about 0.5 s between scenes, and spot effects sit on the on-screen events.
  - In the voiceover version the beds duck 8 dB and the effects 7 dB under the voice, then return
    to full strength between lines.
  - The voice gets a gentle 80 Hz high-pass and light compression; there is no reverb.
  - Both mixes are normalised to -12 LUFS with true peak below -1 dBTP (checked after the AAC
    encode), 48 kHz stereo, and fade to silence over the last half second.
- **Phone-speaker pass**, after feedback that the meteor and the stomp made no sound:
  - Those clips were almost pure sub-bass (95-99% of their energy below 150 Hz), which phone
    speakers can't play. Deep sounds now get saturated harmonics in the 200 Hz - 2 kHz range so
    phones reproduce them.
  - Five more ElevenLabs layers: a fiery meteor rush, a ground-smash crunch, shaking leaves, a soft
    swoosh for transitions and a mid-range T. rex snarl.
  - Extra cues so every moment has sound: twinkling dots, the foot coming down and lifting, inset
    and transition swooshes, the sauropod's exhale, the Triceratops and T. rex breathing, clicks as
    the skeleton draws in, and the pigeon's steps.
- **Meteor and transition pass**, after feedback that the meteor sounded unrealistic and too loud,
  and that the paper sound didn't fit:
  - The meteor is now one sound. The fly-by `meteor2_b` replaces the earlier three layers (deep
    whoosh plus two fiery rushes). Its saturated harmonics are gone too; they had made it fuzzy.
  - Its build is stretched 3x with the pitch kept, so it is heard coming from far away (from about
    1.5 s) and peaks as it skims past Earth at about 4.2 s. It pans right to left with the meteor.
  - It gets only a clean EQ: below 45 Hz cut and the 150-700 Hz body lifted about 5 dB, so phones
    still carry it. It sits about 6 dB lower than before, at an ordinary effect level.
  - The space rumble under it is soft and clean.
  - The paper rustles are replaced by a soft, warm zoom whoosh (`zoom_b`):
    - one where Earth turns into its line-art drawing;
    - one, slightly deeper, for the push into the life dot as the circle opens onto the forest.
- **Voice-first pass (voiceover version)**, after TikTok's Quality Advisor flagged background noise
  and feedback that some moments were too loud and the sound felt like a separate background track:
  - Under the narration, the beds and effects were only 5-11 dB below the voice in the speech band
    on five of the ten lines (worst: the T. rex growl and the wing beats).
  - They are now ducked 15-18 dB above 150 Hz and 6 dB below it. A rider also keeps the speech band
    at least 17 dB under the voice while he speaks (the deep lows get half of that). Every line is
    now 15.5-30 dB clear.
  - A second rider keeps every effect at least 3 dB under the voice level, also between lines. That
    removed the spike of the sauropod's call at 27-29 s (momentary -5.5 down to about -11 LUFS).
  - The narration lines came from separate requests and differed by up to 4 dB. Each one is now
    levelled to the same loudness.
  - The ambience beds sit 4 dB lower. The room tone under the globe and skeleton diagrams is gone,
    because nothing on screen makes it.
  - The sound-effects-only version is unchanged.
- **Globe sounds**, after feedback that the dot sounds were annoying: about 30 quick ticks for the
  dots and the 75% chart were replaced with three gentle sounds (new ElevenLabs effects, 2 takes
  each):
  - an airy shimmer (`dots_shimmer_a`) that pans left to right with the dots;
  - one smooth sweep (`ring_sweep_a`, the smoother take) as the donut fills;
  - a lower, warmer shimmer (`dots_shimmer_b`) when the dots flare back.
  - The balance and bite charts keep only a few soft ticks, when something lands.
