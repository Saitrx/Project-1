"""Sound mix for both versions of the school video (organic sounds only: no music, melodies,
stingers, risers or tonal pads; no paper or pencil/typing sounds).
  output/school_sfx.wav      ambience beds + spot effects
  output/school_sfx_vo.wav   the same effects, ducked 7 dB while the narrator speaks, plus the voice
Every sound is an ElevenLabs sound-effects clip from sfx/ (see notes.md). Spot effects sit on the
on-screen events (times come from the scene code; jump and fall times are worked out from the same
physics the scenes use). How it is made to sound real rather than pasted on:
  - every place has its own continuous air (room tone, field, street, dusk park...), crossfaded on
    the picture's transitions, so the sound never drops to dead digital silence until the ending;
  - voices and hits are placed where the person is on screen (pan) and at their distance: far kids
    are quieter, duller (low-pass) and carry more of the place's reverb than close ones;
  - repeated actions use different takes, pitches and levels so nothing sounds copy-pasted;
  - landings are a soft grass thump plus a little low weight, not a cartoon boom.
Both mixes: 48 kHz, 24-bit stereo, about -14 LUFS integrated, true peak below -1 dBTP.
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import SR, Bus, load, shape, repitch, reverb, curve, db, highpass, lowpass  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEN = 85.5
TARGET = -14.0
LINE_LUFS = -30.0
DUCK_DB = 7.0  # effects dip this much while the narrator speaks (spec: 6-8 dB)
VO_FX_GAIN = 16.0  # effects level in the voiceover version, relative to the voice (see the report)
# narrated version only: a few loud moments that land on words get turned down a little more than
# the ducking does (start, end, dB), so every word stays clear; the effects-only mix keeps them full
VO_RIDES = [(18.7, 21.0, -4), (29.55, 29.95, -3), (37.2, 39.7, -2), (60.9, 62.9, -2), (75.2, 81.3, -2)]

# ---- event times taken from the scene code ----
POP = 7.62  # s02_field: the blue dot (from POP - 0.35) pops, the ring goes out, the school turns to dust
# kids' falls after hanging (FALL_G 1150): landing time and landing x of each kid
FALLS = [(8.848, 292), (8.900, 402), (9.320, 452), (9.194, 338), (9.257, 548), (9.364, 642), (9.212, 738)]
# s02 celebration (jumpMotion): landings of K0's joy jumps, the high-five pair, K2's fist pumps
K0_LAND = [19.536, 21.008, 22.578, 23.81, 25.316, 26.582]
HF_APEX = 19.755  # both kids at the top of their jump: the slap
HF_LAND = [19.93, 19.956]
K2_TAKEOFF = [20.656, 21.878, 23.502, 24.82, 26.258]
K2_LAND = [21.042, 22.264, 23.876, 25.218, 26.664]
TOSS = 19.05  # K5 throws her homework sheets up (silent: no paper sounds)
# s05 montage
PARK_LAND = [28.634, 30.14, 31.536, 32.772, 34.066]
BAG_THROW = 28.8
BAG_LAND = 29.74
BAG_KID_LAND = [29.752, 31.034]
SWING_BOTTOM = [28.80, 30.11, 31.42, 32.72, 34.03]  # swing passes the bottom (period 2.62 s)
# s06 globe
T_YEAR = 36.39
WAVES = [37.39, 38.39, 39.39]
# s07 curb
BALL_T = 45.35
# s08 literacy
T_SLIDE = 54.77
# s09 future
PANELS = [58.35, 60.25, 61.6]
INSET9 = 62.42
# s10 sad
FRIENDS_GO = [68.15, 68.55, 68.9, 69.3]
# s11 ending
T_ERASE = 78.45
T_RING = 81.522


def vo_times():
    return json.load(open(os.path.join(ROOT, 'out/vo/timing.json')))


def pan_x(x, cx=540, z=1.0, k=0.8):
    """Stereo position of something at design x when the camera centres cx at zoom z."""
    return float(np.clip((x - cx) * z / 540 * k, -0.85, 0.85))


def clip(name, start=0.0, dur=None, pitch=1.0):
    x = load(name)
    if pitch != 1.0:
        x = repitch(x, pitch)
    x = x[int(start * SR):]
    if dur is not None:
        x = x[:int(dur * SR)]
    return x


def momentary(x):
    """EBU R128 momentary loudness (400 ms windows every 100 ms, K-weighted) of a stereo signal."""
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    k = np.sqrt((f / 38.0) ** 4 / (1 + (f / 38.0) ** 4)) * (1 + (db(4.0) - 1) * f ** 2 / (f ** 2 + 1500.0 ** 2))
    p = (np.fft.irfft(X * k[:, None], n=len(x), axis=0) ** 2).sum(1)
    w, h = int(0.4 * SR), int(0.1 * SR)
    cs = np.concatenate([[0.0], np.cumsum(p)])
    i = np.arange(0, max(1, len(p) - w + 1), h)
    return -0.691 + 10 * np.log10((cs[np.minimum(i + w, len(p))] - cs[i]) / w + 1e-20)


_ref = []


def narrator_ref():
    """The narrator's typical momentary loudness, expressed on the effects buses (the narrated mix
    adds VO_FX_GAIN to the effects). Every cue level below is set relative to it, in LU."""
    if not _ref:
        v = voice_track(vo_times())
        v = v / (np.sqrt((v[np.abs(v) > 1e-4] ** 2).mean()) + 1e-12) * db(-16)
        m = momentary(np.stack([v, v], 1))
        _ref.append(float(np.median(m[m > m.max() - 20])) - VO_FX_GAIN)
    return _ref[0]


def level(x, lu, stat):
    """Scale x so its loudness (the loudest 400 ms for a spot, the median for a bed) sits `lu` LU
    relative to the narrator in the narrated mix (before ducking)."""
    m = momentary(x)
    cur = m.max() if stat == 'max' else float(np.median(m[m > m.max() - 25]))
    return x * db(narrator_ref() + lu - cur)


def put(bus, name, t, start=0.0, dur=None, pitch=1.0, verb=None, lu=None, **kw):
    """Place clip `name` at time t, trimmed from `start` for `dur` s, optionally through a short
    reverb (rt, wet dB) for the place it happens in; `lu` sets its loudness against the narrator."""
    x = clip(name, start, dur, pitch)
    if verb:
        rt, wet = verb
        x = reverb(np.concatenate([x, np.zeros((int(rt * SR), 2))]), rt=rt, wet=wet, seed=int(t * 10) % 97)
    x = shape(x, t, **kw)
    if lu is not None:
        x = level(x, lu, 'max')
    bus.add(x, t)


def loop(bus, name, t0, t1, xfade=1.5, start=0.0, pitch=1.0, lu=None, **kw):
    """Fill t0..t1 with `name`, repeating it with equal-power crossfades; `lu` sets its typical
    loudness against the narrator."""
    x = clip(name, start, None, pitch)
    need = int((t1 - t0) * SR)
    k = int(xfade * SR)
    out = x.copy()
    a = np.sin(np.linspace(0, np.pi / 2, k))[:, None]
    while len(out) < need:
        out = np.concatenate([out[:-k], out[-k:] * a[::-1] + x[:k] * a, x[k:]])
    out = shape(out[:need], t0, **kw)
    if lu is not None:
        out = level(out, lu, 'median')
    bus.add(out, t0)


# reverbs for the places (rt seconds, wet dB)
ROOM = (0.55, -13)  # classroom
FIELD = (0.45, -19)  # open field: almost dry, a little air
STREET = (0.8, -15)  # street between houses
PARK = (0.6, -18)


def landing(b, t, pan, lu=-13.0, pitch=1.0, alt=False, verb=FIELD):
    """A kid landing on grass: a soft thump (sneakers/body on the lawn) plus a little low weight."""
    put(b, 'hop_thump_alt' if alt else 'hop_thump', t - 0.05, pitch=0.86 * pitch, lu=lu, fout=0.12, pan=pan, verb=verb)
    put(b, 'grass_thud', t, dur=0.35, lu=lu - 9, fout=0.15, pan=pan, hp=40, lp=260)


def hop(b, t, pan, lu=-15.0, alt=False, lp=None, verb=FIELD):
    """A light jump landing (feet only)."""
    put(b, 'hop_thump_alt' if alt else 'hop_thump', t - 0.05, lu=lu, fout=0.1, pan=pan, lp=lp, verb=verb)


def tick(b, t, lu=-16.0, **kw):
    """One tick of the classroom wall clock (the clip is a single tick at 0.0 s), softened a little
    so it reads as a wall clock across the room, not a click in the ear."""
    put(b, 'clock_tick', t - 0.005, dur=0.6, lu=lu, fin=0.002, fout=0.25, lp=kw.pop('lp', 5000), **kw)


def flicker_points(t0, t1, dim=-14.0):
    """Gain points that follow the hallway's flickering ceiling light in s09 (its buzz dips when the
    tube dims) and stop when it goes out at 64.0 s."""
    pts = []
    for t in np.arange(t0, t1, 0.01):
        if t > 64.0:
            g = -40.0
        else:
            fl = np.sin(t * 37) * np.sin(t * 13.3 + 1)
            g = dim if fl > 0.55 else 0.0
        pts.append((float(t), g))
    return pts


# Levels: every cue has a loudness target `lu` in LU against the narrator (before the narrated
# mix's ducking): beds -12 to -22 (the classroom hum -26), background details -15 to -19,
# foreground details -8 to -13, and only the pop and the first burst of the cheer come close
# to the voice (-3).


def beds(b):
    # (beds are high-passed: their wind rumble below ~100 Hz is inaudible on phones and only muddies
    # the mix)
    # 1 classroom: a still room (a faint ventilation hum) and birds behind the window (right),
    # softened by the glass
    loop(b, 'classroom_tone', 0.0, 6.2, lu=-24, fin=0.05, fout=0.9, hp=90)
    loop(b, 'garden_birds', 0.0, 5.9, lu=-20, fin=0.05, fout=0.8, pan=0.45, lp=4000, hp=1500)
    # 2-4 the open field around the school (breeze in the grass, distant birds)
    loop(b, 'field_morning', 5.1, 27.5, lu=-12, fin=0.9, fout=0.6, hp=80, lp=8000)
    loop(b, 'breeze', 5.1, 27.5, lu=-22, fin=0.9, fout=0.6, hp=100)
    # 5 montage: birds outside the bedroom window, a park with kids far away, a light breeze
    loop(b, 'garden_birds', 27.4, 34.4, lu=-14, fin=0.5, fout=0.6, lp=6500, hp=150)
    loop(b, 'park_far_kids', 27.7, 34.3, lu=-19, fin=0.5, fout=0.6, pan=-0.35, lp=5500, hp=150)
    loop(b, 'breeze', 27.9, 34.3, lu=-22, fin=0.5, fout=0.6, pan=0.3, hp=100)
    # 6 globe (a diagram): the quiet air of a large empty hall, nothing else
    loop(b, 'hall_air', 34.2, 42.6, lu=-21, fin=0.8, fout=0.7, lp=3500, hp=150)
    # 7 curb: an evening street, distant traffic, dry leaves moving on the pavement
    loop(b, 'street_evening', 42.0, 50.3, lu=-12, fin=0.7, fout=0.8, hp=70)
    loop(b, 'leaves_skitter', 42.0, 50.3, lu=-19, fin=0.7, fout=0.8, pan=0.2, lp=7000, hp=200)
    loop(b, 'breeze', 42.0, 50.3, lu=-22, fin=0.7, fout=0.8, hp=100)
    # 8 literacy: the diagram's hall air, then the street around the LIBRARY sign in the inset
    loop(b, 'hall_air', 49.6, 58.5, lu=-21, fin=0.6, fout=0.6, lp=3500, auto=[(49.6, 0), (54.0, 0), (54.6, -5), (58.5, -5)], hp=150)
    loop(b, 'street_evening', 53.9, 58.5, lu=-16, fin=0.6, fout=0.5, pan=-0.1, hp=70)
    # 9 future: empty hospital corridor, then wind over the half-built bridge and the river, then
    # the windy airfield (windsock flapping); each fades back as the next panel arrives
    loop(b, 'hospital_corridor', 58.1, 66.1, lu=-13, fin=0.5, fout=0.8, auto=[(58.1, 0), (60.2, 0), (60.9, -7), (66.1, -8)], hp=80)
    loop(b, 'light_flicker', 58.35, 64.2, lu=-20, fin=0.3, fout=0.05, pan=0.1, auto=flicker_points(58.35, 64.2), hp=200, lp=4000)
    loop(b, 'bridge_wind', 60.1, 66.2, lu=-14, fin=0.4, fout=0.8, auto=[(60.1, 0), (61.5, 0), (62.2, -6), (66.2, -6)], hp=90)
    loop(b, 'river', 60.1, 66.2, lu=-18, fin=0.5, fout=0.8, lp=6000, auto=[(60.1, 0), (61.5, 0), (62.2, -5), (66.2, -5)], hp=80)
    loop(b, 'runway_wind', 61.5, 66.4, lu=-12, fin=0.4, fout=0.8, hp=80)
    loop(b, 'flag_flap', 61.6, 66.4, lu=-18, fin=0.4, fout=0.8, pan=0.3, hp=150)
    # 10 sad: a park at dusk, crickets, the big tree's leaves, a little wind
    loop(b, 'dusk_crickets', 65.5, 75.3, lu=-18, fin=0.8, fout=0.9, hp=200, lp=10000)
    loop(b, 'tree_leaves', 65.5, 75.3, lu=-15, fin=0.8, fout=0.9, pan=-0.25, hp=150)
    loop(b, 'breeze', 65.5, 75.3, lu=-22, fin=0.8, fout=0.9, hp=100)
    # 11 ending: the field again, quieter; everything goes with the last ring (then silence)
    loop(b, 'field_morning', 74.5, 82.4, lu=-16, fin=0.9, fout=0.9, hp=80, lp=8000)
    loop(b, 'breeze', 74.5, 82.4, lu=-22, fin=0.9, fout=0.9, hp=100)


def spots(b, big, crowd):
    # ---- 1 classroom (the first 5 s: kept simple and quiet). The wall clock (above the board,
    # left) ticks with its second hand, the very first sound included; one soft chair creak as the
    # girl at the back slumps down again. No yawn, sigh or gasp sounds anywhere (rejected: "the
    # ahhh sound").
    # (after the question, 2.6-5.2 s, the ticking clock is the whole sound: the boredom beat)
    tick(b, 0.02, lu=-14, pan=-0.3, verb=ROOM)
    for s in range(1, 6):
        tick(b, s, lu=-15 if s < 3 else -12, pan=-0.3, verb=ROOM)
    put(b, 'chair_creak', 3.45, dur=1.0, lu=-14, pan=0.3, fout=0.25, lp=6000, verb=ROOM)
    # the camera leaves through the window: a soft breath of air
    put(b, 'air_swish', 5.0, pitch=0.8, lu=-18, fout=0.3)
    # ---- 2 the pop. The school's own clock ticks far off until the school is gone.
    for s in (6, 7):
        tick(b, s, lu=-30, lp=2200, pan=0.0, verb=FIELD)
    # air drawn in as the blue dot swells, the soft deep whoomp on the pop, then a gust carrying
    # the dust away to the right
    put(big, 'vanish_whoomp', POP - 0.97, lu=-3, fin=0.2, fout=0.6)
    put(b, 'dust_gust', POP + 0.02, lu=-8, fin=0.08, fout=0.9, width=1.3, pan_auto=[(POP, -0.1), (POP + 2.6, 0.4)])
    # soft landings on the grass, one per kid, where each one lands; one kid's "oof" and giggle
    for k, (tl, x) in enumerate(FALLS):
        landing(b, tl, pan_x(x, z=1.03), lu=(-13, -14, -12)[k % 3], pitch=(0.94, 1.0, 1.07)[k % 3], alt=k % 2 == 1)
    put(b, 'kid_oof', FALLS[0][0] - 0.22, lu=-10, pan=pan_x(292, z=1.03), lp=8000, fout=0.3, verb=FIELD)
    # ---- 3 confusion: quiet murmurs that grow as the camera pushes in, kids getting up off the
    # grass, a "what?" and a "huh?" on two of the shrugs (after the narration line)
    put(b, 'kids_murmur', 10.3, start=4.6, dur=3.4, lu=-16, fin=0.9, fout=0.6, lp=6000, verb=FIELD)
    put(b, 'kids_murmur', 13.1, start=0.3, dur=3.1, lu=-14, fin=0.5, fout=0.6, lp=7000, verb=FIELD)
    put(b, 'kids_murmur', 15.6, start=4.6, dur=3.2, pitch=1.03, lu=-12, fin=0.5, fout=0.8, verb=FIELD)
    for t0, x, st in ((13.0, 452, 0.3), (13.5, 548, 1.0), (14.4, 738, 1.8), (15.4, 338, 2.6)):
        put(b, 'grass_steps', t0 + 0.1, start=st, dur=0.7, lu=-18, fin=0.05, fout=0.25, pan=pan_x(x, z=1.95, k=0.6))
    put(b, 'boy_what', 15.6, lu=-9, pan=pan_x(738, z=1.95, k=0.6), fout=0.2, verb=FIELD)
    put(b, 'girl_huh', 16.62, lu=-10, pan=pan_x(338, z=1.95, k=0.6), fout=0.2, verb=FIELD)
    # ---- 4 celebration (crowd bus: it drops back while the camera is on the teachers)
    put(crowd, 'kids_cheer', 18.42, lu=-3, fin=0.12, fout=1.0, width=1.25, verb=FIELD, auto=[(18.4, 0), (18.68, 0), (19.0, -4), (30, -4)])
    put(crowd, 'kids_run', 18.8, start=0.1, dur=0.65, lu=-14, fout=0.15, pan=-0.1)
    put(crowd, 'girl_yay', TOSS - 0.05, lu=-10, pan=pan_x(642, z=1.95, k=0.6), fout=0.2, verb=FIELD)
    put(crowd, 'high_five', HF_APEX - 0.35, lu=-9, pan=pan_x(500, z=1.95, k=0.6), verb=FIELD)
    for i, tl in enumerate(HF_LAND):
        hop(crowd, tl, pan_x(500 + (i * 2 - 1) * 35, z=1.95, k=0.6), lu=-15, alt=i == 1)
    put(crowd, 'kid_wheee', 20.15, lu=-11, pan=pan_x(338, z=1.95, k=0.6), fout=0.3, verb=FIELD)
    put(crowd, 'kids_laugh', 20.35, lu=-10, fin=0.1, fout=0.8, pan=-0.05, verb=FIELD)
    put(crowd, 'kids_clap', 19.4, lu=-13, fout=0.5, pan=pan_x(738, z=1.95, k=0.6), verb=FIELD)
    put(crowd, 'kids_clap', 22.3, start=0.2, lu=-15, fout=0.6, pan=0.35, verb=FIELD)
    loop(crowd, 'grass_steps_alt', 19.2, 27.3, lu=-22, fin=0.4, fout=0.6, pan=0.1)
    put(crowd, 'kids_laugh_alt', 23.9, lu=-11, fin=0.3, fout=1.0, pan=0.1, verb=FIELD)
    put(crowd, 'kids_cheer_alt', 25.1, start=1.0, dur=3.0, lu=-7, fin=0.4, fout=0.9, width=1.2, verb=FIELD)
    for i, tl in enumerate(K0_LAND):
        hop(crowd, tl, -0.6, lu=-16 - (i % 2), alt=i % 2 == 1)
    for i, tl in enumerate(K2_LAND):
        hop(crowd, tl, -0.1, lu=-16, alt=i % 2 == 0)
    # the teachers aren't smiling: a tut and a groan once the narrator has said so
    put(b, 'woman_tsk', 23.33, lu=-9, pan=pan_x(790, cx=712, z=2.25, k=0.6), fout=0.2, verb=FIELD)
    put(b, 'man_groan', 24.1, lu=-10, pan=pan_x(676, cx=712, z=2.25, k=0.6), fout=0.3, verb=FIELD)
    # into the montage (the blue dot opens a circle onto it)
    put(b, 'air_swish', 26.95, lu=-14, fout=0.3)
    # ---- 5 montage: the sleeper snores (again right after "No alarms"), the swing creaks at the
    # bottom of each swing, the park kid's jumps, the backpack flung away and landing in the grass
    put(b, 'snore', 27.75, dur=1.3, lu=-14, fin=0.1, fout=0.4, verb=(0.4, -16))
    put(b, 'snore', 31.05, start=2.4, lu=-9, fin=0.1, fout=0.4, verb=(0.4, -16))
    for i, tb in enumerate(SWING_BOTTOM):
        st, pk = ((0.0, 0.16), (1.45, 1.76), (2.5, 2.82))[i % 3]
        put(b, 'swing_chains', tb - (pk - st), start=st, dur=0.8, lu=-17, fin=0.05, fout=0.3, pan=-0.45, verb=PARK)
    for i, tl in enumerate(PARK_LAND):
        hop(b, tl, -0.35, lu=-20, alt=i % 2 == 1, lp=6000, verb=PARK)
    put(b, 'air_swish', BAG_THROW - 0.15, pitch=0.82, lu=-14, fout=0.3, pan_auto=[(BAG_THROW, 0.25), (BAG_LAND, 0.6)])
    put(b, 'backpack_land', BAG_LAND - 0.1, lu=-11, pan=0.6, fout=0.3, verb=PARK)
    hop(b, BAG_KID_LAND[1], 0.4, lu=-17, verb=PARK)
    # into the globe
    put(b, 'air_swish', 34.2, lu=-14, fout=0.3)
    # ---- 6 globe: the school dots scatter on like seeds, then go out in three waves, each a soft
    # puff (like blowing out candles), moving east to west
    put(b, 'sand_trickle', 35.15, start=0.6, dur=1.2, lu=-18, hp=1500, fin=0.2, fout=0.5, width=1.4)
    for i, tw in enumerate(WAVES):
        put(b, 'candle_puff', tw - 0.15, pitch=(1.0, 0.94, 0.88)[i], lu=(-12, -13, -14)[i], pan=(0.35, 0.0, -0.35)[i], fout=0.3)
    # ---- 7 curb: a car passes far off, the calendar inset, the ball nudged and rolling away along
    # the gutter (nobody chases it), a dog barking far away
    put(b, 'car_far', 42.4, lu=-18, lp=5000, fin=0.5, fout=0.8, pan_auto=[(42.4, -0.6), (47.4, 0.6)])
    put(b, 'air_swish', 42.6, lu=-18, pan=-0.4, fout=0.3)
    xs = lambda t: 222 + (320 / 0.3) * (1 - np.exp(-0.3 * max(0.0, t - BALL_T)))
    put(b, 'ball_roll', BALL_T - 0.03, lu=-10, fout=0.6, verb=STREET,
        pan_auto=[(BALL_T + a, pan_x(xs(BALL_T + a))) for a in np.arange(0, 4.2, 0.2)])
    put(b, 'dog_far', 48.75, lu=-19, lp=4000, pan=0.5, verb=STREET)
    # ---- 8 literacy: the bar frames swish on; each bar fills like sand pouring in; the Today bar
    # drains like sand running out; the puzzled kid's "hmm" once the line is over
    put(b, 'air_swish', 50.3, lu=-16, fout=0.3)
    put(b, 'sand_trickle', 51.5, start=1.0, dur=1.1, lu=-15, fin=0.12, fout=0.3, pan=-0.4)
    put(b, 'sand_trickle', 52.7, start=1.5, dur=1.35, lu=-14, fin=0.12, fout=0.3, pan=0.15)
    put(b, 'air_swish', 53.75, lu=-19, pan=-0.1, fout=0.3)
    put(b, 'sand_trickle', T_SLIDE + 0.15, pitch=0.9, lu=-15, fin=0.4, fout=0.9, lp=6000, pan=0.15)
    put(b, 'boy_hmm', 57.98, lu=-10, pan=-0.13, fout=0.25, verb=STREET)
    # ---- 9 future: each panel slides onto the page with a soft swish; a door closes far down the
    # empty corridor; the crane's hook creaks as it swings
    for t0 in PANELS:
        put(b, 'air_swish', t0 + 0.2 - 0.4, lu=-16, fout=0.3)
    put(b, 'air_swish', INSET9 + 0.15 - 0.4, pitch=1.15, lu=-19, pan=-0.45, fout=0.3)
    put(b, 'door_far', 59.95, lu=-17, pan=0.2, fout=0.5)
    put(b, 'crane_creak', 63.65, dur=1.4, lu=-14, pan=-0.4, fout=0.4)
    # ---- 10 sad: the friends' footsteps walking away, fading; the kid sniffles once
    put(b, 'steps_away_gravel', FRIENDS_GO[0], lu=-13, fin=0.2, fout=1.2, pan_auto=[(68.15, 0.3), (73.0, 0.05)], lp=6000, verb=PARK)
    put(b, 'steps_away_gravel', FRIENDS_GO[1] + 0.1, start=1.1, pitch=1.06, lu=-16, fin=0.2, fout=1.0, pan_auto=[(68.65, 0.5), (72.5, 0.75)], lp=5000, verb=PARK)
    put(b, 'boy_sniffle', 71.85, lu=-13, pan=-0.32, fout=0.3, verb=PARK)
    # ---- 11 ending: the same clock ticking again (a memory: the classroom's room sound), the chalk
    # board blowing away as dust, and the last ring with a soft echo of the opening pop; then silence
    for s in range(76, 82):
        tick(b, s, lu=-15, pan=-0.3, verb=ROOM)
    put(b, 'dust_gust', T_ERASE - 0.1, lu=-15, lp=5000, fin=0.2, fout=0.9, pan_auto=[(T_ERASE, -0.45), (T_ERASE + 2.4, 0.2)])
    put(big, 'vanish_whoomp', T_RING - 0.95, lu=-7, fin=0.2, fout=0.8, lp=6000)


def lufs(path):
    out = subprocess.run(['ffmpeg', '-v', 'info', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = float([l for l in out.splitlines() if l.strip().startswith('I:')][-1].split()[1])
    TP = float([l for l in out.splitlines() if l.strip().startswith('Peak:')][-1].split()[1])
    return I, TP


def write(path, x, codec='pcm_f32le'):
    x = np.clip(x, -1, 1).astype(np.float32)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', codec, path], input=x.tobytes(), check=True)


def limit(src, dst, gain):
    # gain, then a limiter on a 4x oversampled signal (so true peaks are held too), 24-bit out
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f'volume={gain:.3f}dB,aresample=192000,alimiter=limit=0.79:attack=1:release=60:level=disabled,aresample=48000',
                    '-c:a', 'pcm_s24le', dst], check=True)


def aac_overs(path):
    """Per-10 ms peak (dBFS, 4x oversampled) of the file after an AAC 320 kbps round trip (the
    delivery codec), so peaks the encoder adds can be found and tamed before delivery."""
    enc = path.replace('.wav', '_test.m4a')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-c:a', 'aac', '-b:a', '320k', '-ar', str(SR), enc], check=True)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', enc, '-ac', '2', '-ar', str(SR * 4), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    os.remove(enc)
    y = np.abs(np.frombuffer(raw, np.float32).reshape(-1, 2)).max(1)
    w = SR * 4 // 100
    nb = len(y) // w
    return 20 * np.log10(y[: nb * w].reshape(nb, w).max(1) + 1e-9)


def master(x, path):
    """Fade the tail, cut sub-bass below 35 Hz, normalise to TARGET LUFS with an oversampled limiter,
    then make sure the AAC-encoded result also keeps its true peak below -1 dBTP: find the spots the
    encoder pushes over, turn just those down a little before the limiter, and repeat."""
    n = len(x)
    k = int(0.5 * SR)
    x[n - k:] *= (np.cos(np.linspace(0, np.pi / 2, k)) ** 2)[:, None]
    x = highpass(x, 35)
    tmp = path.replace('.wav', '_pre.wav')
    write(tmp, x)

    def settle(gain):
        for _ in range(5):
            limit(tmp, path, gain)
            I2, TP2 = lufs(path)
            if abs(I2 - TARGET) < 0.2:
                break
            gain += TARGET - I2
        return gain

    gain = settle(TARGET - lufs(tmp)[0])
    for _ in range(8):
        pk = aac_overs(path)
        over = np.maximum(0, pk + 1.6)
        if over.max() <= 0:
            break
        nb = len(pk)
        red = np.array([over[max(0, i - 20): i + 21].max() for i in range(nb)])
        red = np.convolve(red, np.hanning(15) / np.hanning(15).sum(), 'same') * 1.4 + (red > 0) * 0.4
        x = x * db(-np.interp(np.arange(len(x)), np.arange(nb) * (SR // 100) + SR // 200, red))[:, None]
        write(tmp, x)
        gain = settle(gain)
    os.remove(tmp)
    I2, TP2 = lufs(path)
    print(f'{os.path.basename(path)}: {I2:.1f} LUFS, true peak {TP2:.1f} dBTP, after AAC 320k {aac_overs(path).max():.1f} dBFS')
    return I2, TP2


def voice_track(timing):
    v = np.zeros(int(LEN * SR))
    for line in timing:
        path = os.path.join(ROOT, 'out/vo', f"line{line['line']:02d}.wav")
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        y = np.frombuffer(raw, np.float32).astype(np.float64)
        y = y * db(LINE_LUFS - lufs(path)[0])  # every line equally loud (separate requests)
        i = int(round(line['start'] * SR))
        v[i:i + len(y)] += y[: len(v) - i]
    # light high-pass and gentle compression; no reverb
    p_in = os.path.join(ROOT, 'out/vo_raw.wav')
    p_out = os.path.join(ROOT, 'out/vo_proc.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-', p_in], input=v.tobytes(), check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p_in, '-af', 'highpass=f=75:poles=2,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=150:makeup=1.5',
                    '-ar', str(SR), p_out], check=True)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p_out, '-ac', '1', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)[: int(LEN * SR)]


def speech_activity(timing):
    """0..1 per sample: 1 while a narration line plays (from its start to its end), smoothed with
    ~150 ms attack (starting just before the line) and ~450 ms release."""
    n = int(LEN * SR)
    w = SR // 100
    nb = n // w + 1
    act = np.zeros(nb)
    for line in timing:
        a = int((line['start'] - 0.12) * 100)
        b2 = int((line['start'] + line['dur'] + 0.05) * 100)
        act[max(0, a):b2] = 1
    sm = np.zeros(nb)
    s = 0.0
    up, dn = 1 - np.exp(-1 / 15), 1 - np.exp(-1 / 45)
    for i in range(nb):
        s += (act[i] - s) * (up if act[i] > s else dn)
        sm[i] = s
    return np.interp(np.arange(n), np.arange(nb) * w, sm)


def env400(x):
    """400 ms RMS (speech band) of a mono signal every 10 ms, centred windows."""
    y = lowpass(highpass(x[:, None], 150), 6000)[:, 0]
    w = SR // 100
    n = len(y) // w
    return np.sqrt(np.convolve((y[: n * w].reshape(n, w) ** 2).mean(1), np.ones(40) / 40, 'same')), w


def ceiling(under, v, act, margin=-6.5):
    """While he speaks, the effects never come closer than `margin` dB to the voice (so the words
    stay clear even under the loudest moments); between lines they are left alone."""
    ev, w = env400(v)
    eu, _ = env400(under.mean(1))
    vref = np.maximum(ev, np.percentile(ev[ev > ev.max() * db(-30)], 30))
    a = act[::w][: len(eu)]
    want = np.where(a > 0.5, np.minimum(1.0, vref * db(margin) / (eu + 1e-12)), 1.0)
    g = np.empty(len(want))
    s, dn, up = 1.0, 1 - np.exp(-1 / 4), 1 - np.exp(-1 / 40)
    for i in range(len(want)):
        s += (want[i] - s) * (dn if want[i] < s else up)
        g[i] = s
    return under * np.interp(np.arange(len(under)), np.arange(len(g)) * w + w / 2, g)[:, None]


def main():
    os.makedirs(os.path.join(ROOT, 'output'), exist_ok=True)
    timing = vo_times()
    bed = Bus(LEN)
    fx = Bus(LEN)
    big = Bus(LEN)
    crowd = Bus(LEN)
    beds(bed)
    spots(fx, big, crowd)
    # the celebrating kids drop back (and lose a little top end) while the camera is on the teachers
    crowd.x *= curve(len(crowd.x), 0.0, [(0, 0), (21.6, 0), (22.4, -5), (24.9, -5), (25.6, 0), (LEN, 0)])[:, None]
    fx.x += crowd.x
    sfx = bed.x + fx.x + big.x
    master(sfx.copy(), os.path.join(ROOT, 'output/school_sfx.wav'))

    v = voice_track(timing)
    act = speech_activity(timing)
    duck = db(-DUCK_DB * act)[:, None]
    rides = [(0, 0)]
    for t0, t1, g in VO_RIDES:
        rides += [(t0 - 0.15, 0), (t0, g), (t1, g), (t1 + 0.25, 0)]
    rides.append((LEN, 0))
    under = (bed.x + fx.x + big.x) * db(VO_FX_GAIN) * duck * curve(len(duck), 0.0, rides)[:, None]
    vr = np.sqrt((v[np.abs(v) > 1e-4] ** 2).mean())
    v = v / (vr + 1e-12) * db(-16)
    under = ceiling(under, v, act)
    mix = under + np.stack([v, v], 1)
    master(mix, os.path.join(ROOT, 'output/school_sfx_vo.wav'))
    # report how far under the voice the effects sit while he speaks (short-term RMS, speech band)
    band = lambda y: lowpass(highpass(y, 150), 6000)
    vb = band(np.stack([v, v], 1)).mean(1)
    ub = band(under).mean(1)
    w = SR // 2
    rel = []
    vmax = np.sqrt((vb ** 2).mean()) * 3
    for i in range(0, len(v) - w, w):
        if act[i:i + w].min() > 0.95 and np.sqrt((vb[i:i + w] ** 2).mean()) > vmax * db(-20):
            rel.append(20 * np.log10(np.sqrt((vb[i:i + w] ** 2).mean()) / (np.sqrt((ub[i:i + w] ** 2).mean()) + 1e-12)))
    rel = np.array(rel)
    print(f'voice over effects while speaking: median {np.median(rel):.1f} dB, 10th pct {np.percentile(rel, 10):.1f} dB, min {rel.min():.1f} dB (0.5 s windows)')
    # per-scene level of the effects-only mix (RMS dBFS before mastering) so no scene is lost
    from_t = [0, 5.5, 11.5, 18.5, 27.5, 34.5, 42.5, 50, 58.5, 66, 75, 85.5]
    for k in range(11):
        a, b2 = int(from_t[k] * SR), int(from_t[k + 1] * SR)
        print(f'  scene {k + 1:2d}: effects {20 * np.log10(np.sqrt((sfx[a:b2] ** 2).mean()) + 1e-12):6.1f} dBFS')


if __name__ == '__main__':
    main()
