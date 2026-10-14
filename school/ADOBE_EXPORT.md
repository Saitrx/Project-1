# Adobe import and export

Use this if you want to re-cut, re-time or re-mix the video in Premiere Pro and export it with
Adobe Media Encoder. The ready-to-post files are already in `output/` (see `POSTING.md`).

## Files

| File | What it is |
| --- | --- |
| `output/school_master_for_adobe.mp4` | Picture only. 1080x1920, 60 fps constant, H.264 High 4.2, 20 Mbps two-pass, yuv420p, Rec.709 tags, closed 2 s GOP, captions burned in. The same video stream as the two delivery files. |
| `output/school_sfx.wav` | Sound effects only. 48 kHz, 24-bit, stereo, about -14 LUFS, true peak below -1 dBTP. |
| `output/school_sfx_vo.wav` | Sound effects plus narrator (effects ducked 7 dB under the voice). Same format and loudness. |

All three are exactly 85.5 s long and start at 0, so they line up with no offsets.

## Import into Premiere Pro

1. **File → New → Sequence → Settings tab.**
   - Editing Mode: Custom.
   - Timebase: 60.00 frames/second.
   - Frame Size: 1080 horizontal, 1920 vertical.
   - Pixel Aspect Ratio: Square Pixels (1.0).
   - Fields: No Fields (Progressive Scan).
   - Working Color Space: Rec. 709.
   - Audio Sample Rate: 48000 Hz.
2. Import the three files (**File → Import**).
3. Put `school_master_for_adobe.mp4` on V1 at 00:00:00:00.
4. Put **one** of the WAVs on A1 at 00:00:00:00:
   - `school_sfx.wav` for the sound-effects version;
   - `school_sfx_vo.wav` for the narrated version.
5. The clip should end at 00:01:25:15 (85.5 s). Do not let Premiere conform the frame rate, because
   the master is already constant 60 fps.
6. Optional loudness check: **Window → Audio Track Mixer** or the Loudness Radar. The WAVs read
   about -14 LUFS integrated, so leave the track gain at 0 dB.

## Export with Adobe Media Encoder (FHD, 60 fps, H.264, 20 Mbps)

In Premiere, **File → Export → Media**, then **Send to Media Encoder**, or set the same values in
Media Encoder directly.

**Format and video**
- Format: **H.264**.
- Preset: Custom (start from "Match Source - Adaptive High Bitrate").
- Video:
  - Frame size 1080 x 1920.
  - Frame rate **60**.
  - Field order Progressive.
  - Aspect Square Pixels (1.0).
  - Render at Maximum Depth: on.
  - Profile High, Level 4.2.
- Bitrate Encoding: **VBR, 2 pass**.
  - Target Bitrate: **20 Mbps**.
  - Maximum Bitrate: **28 Mbps**.
- Advanced:
  - Key Frame Distance: **120** (2 s at 60 fps).
  - Color: Rec. 709 (in "Color Space" / "Export Color Space").

**Audio**
- Audio Format: AAC.
- Codec: AAC.
- Sample Rate: 48000 Hz.
- Channels: Stereo.
- Audio Quality: High.
- Bitrate: **320 kbps**.

**Multiplexer**
- MP4, Stream Compatibility: Standard.
- Turn on "Fast Start" if your version shows it. (Media Encoder places the moov atom at the front by
  default for MP4.)

**Before you click Export**
- The estimated file size shown at the bottom should be about 215 MB (85.5 s at 20 + 0.32 Mbps).

## Same result from the command line

`./encode.sh` makes all three MP4s from the rendered frames and the two WAVs with ffmpeg, using the
settings above. `python3 verify.py` re-checks every file and writes `output/VERIFY.md`.
