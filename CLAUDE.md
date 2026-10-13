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
- TikTok re-encodes uploads and has served the 80-90 MB files at only 540p; a 50 MB, ~5.6 Mbps
  upload got 720p. So also keep TikTok upload files under 50 MB (~6 Mbps, H.264 High 4.1, AAC
  192k): `dinos/final/*_tiktok.mp4`, rendered with `?nospeckle` (see `dinos/encode_tiktok.sh`).
