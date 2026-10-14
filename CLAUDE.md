# Notes for Claude

- Deliver finished videos (and other large outputs) by committing them to the working branch and
  giving the user the GitHub link to the file (keep each file under GitHub's 100 MB limit). The
  user uploads to TikTok, so also keep a single full-length 1080p file with sound
  (`cars/final/what_if_cars_FHD.mp4`) up to date, plus the 2K one (`cars/final/what_if_cars_2K.mp4`,
  1440x2560 from the 4K render; see `cars/encode2k.sh`).
- The dinosaur video lives in `dinos/` (Canvas 2D, see `dinos/README.md`); its two deliverables are
  `dinos/final/dinosaurs_sfx.mp4` and `dinos/final/dinosaurs_voiceover.mp4` (each under 99 MB).
  ElevenLabs sounds and narration are saved in `dinos/sfx/` and `dinos/vo/`; reuse them instead of
  generating again.
- The user uploads the dinosaur voiceover video to TikTok, so `dinos/final/dinosaurs_voiceover.mp4`
  follows their TikTok spec: under 72 MB, 1080x1920, H.264 at the highest bitrate that fits (about
  9 Mbps for 60 s), AAC 256 kbps stereo. It's rendered with `?nospeckle`; see `dinos/encode_tiktok.sh`.
- The schools video ("What if all the schools disappeared?", 85.5 s) lives in `school/` (Canvas 2D,
  see `school/README.md`). Its deliverables are in `school/output/`:
  - `school_voiceover.mp4` and `school_sfx.mp4` (AAC 320 kbps);
  - `school_master_for_adobe.mp4`;
  - the two WAVs.
  The user's export spec (latest): FHD only, 1080x1920, H.264, true 60 fps (rendered at 60, 5130
  frames), 20 Mbps two-pass, one shared video stream, no lower-quality versions or previews. The
  MP4s are about 215 MB, so `school/output/*.mp4` is stored with Git LFS (`.gitattributes`).
  No paper or typing sounds, and no yawns, sighs or gasps ("the ahhh sound"): the user finds them
  annoying. Effects are set by loudness against the narrator (`lu=` in `school/audio/mix.py`); no
  effect should be louder than the narrator. The first 5 s matter most to the user.
  Rebuild with `school/encode.sh` and check with `school/verify.py`. Sounds and narration are in
  `school/sfx/` and `school/vo/`; reuse them.
