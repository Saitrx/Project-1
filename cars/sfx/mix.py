"""Sound design for 0:00-0:51 (HQ parts 1-5): city ambience, traffic, breakage, crowd panic,
heartbeat and breath, timed to the shots (event times come from the shot code and the physics
bake logged by the renderer). Writes out/sfx_mix.wav.

Two buses: `world` (everything outside us; gets a short street reverb, and is muffled and turned
down while we wake up and again after the shock knocks us down) and `body` (heartbeat, breath,
our own fall, ear ringing), which stays clear.  usage: python3 sfx/mix.py
"""
import os
import subprocess

import numpy as np

from engine import SR, Bus, load, loop, muffle, put, reverb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEN = 51.0
world = Bus(LEN)
body = Bus(LEN)
rng = np.random.default_rng(11)


def walk_times(keys, stride, t_end, half=True):
    """Foot plants for a camera that moves at the piecewise-linear speed `keys` [(t, m/s)]."""
    ts = np.arange(keys[0][0], t_end, 0.002)
    v = np.interp(ts, [k[0] for k in keys], [k[1] for k in keys])
    d = np.cumsum(v) * 0.002 / stride
    k = np.arange(1, int(d[-1]) + 2) - (0.5 if half else 0)
    return [float(ts[np.searchsorted(d, s)]) for s in k if s <= d[-1]]


def step_slices(name, gap=0.4, length=0.42):
    """Cut a footsteps recording into single steps at its onsets."""
    x = load(name).mean(1)
    w = int(0.01 * SR)
    n = len(x) // w
    e = np.sqrt((x[: n * w].reshape(n, w) ** 2).mean(1)) + 1e-9
    rise = np.diff(20 * np.log10(e), prepend=-200)
    hits = []
    for i in np.argsort(rise)[::-1]:
        t = i * 0.01
        if e[i] > e.max() * 0.25 and all(abs(t - h) > gap for h in hits):
            hits.append(t)
    return sorted(h for h in hits if h + length < len(x) / SR)


# ---- ambience and the growing low end (whole stretch) -------------------------------------------------
loop(world, 'amb_city', 0, LEN, xfade=3, gain=-8, fin=0, fout=0.05,
     auto=[(0, -30), (1.5, -18), (3.1, -5), (4.2, 0), (21, 0), (27, -3), (33, -6), (45, -9), (51, -9)])
# Sub rumble of the giant cars: in as soon as they are heavy, deeper and louder with each beat.
loop(world, 'giant_rumble', 16, 21, xfade=2, pitch=0.9, lp=180, gain=-22, fin=1.0, fout=0.05, auto=[(16, -4), (19, 0), (21, -2)])
loop(world, 'giant_rumble', 21, 33, xfade=2, pitch=0.85, lp=260, gain=-15, fin=0.05, fout=0.05, auto=[(21, 0), (26, -3), (28, 3), (33, 4)])
loop(world, 'giant_rumble', 33, 39, xfade=2, pitch=0.78, lp=300, gain=-11, fin=0.05, fout=0.05)
loop(world, 'giant_rumble', 39, 45, xfade=2, pitch=0.72, lp=300, gain=-9, fin=0.05, fout=0.05, auto=[(39, 0), (41.7, 2), (45, 0)])
loop(world, 'giant_rumble', 45, LEN, xfade=2, pitch=0.66, lp=260, gain=-8, fin=0.05, fout=0.03, auto=[(45, 2), (46.6, 3), (47.3, 0)])
# Sirens far off once things start breaking, slowly getting closer.
put(world, 'sirens', 33.5, gain=-20, lp=5000, fin=3, fout=0.05, auto=[(33.5, 0), (45, 4)])
put(world, 'sirens', 45.0, start=3, gain=-18, lp=5000, fin=0.5, fout=0.03)

# ---- 0:00-0:16 waking up on the sidewalk, walking, 1.2x scooter clip, 1.5x squeeze --------------------
# Eyes closed: only a calm heartbeat and the city as a far, low hum. A sleepy groan and breath as
# the lids part (1.5 s, with the title); a soft swell carries the street in until the eyes focus
# (~4 s). Then the head turns on the pavement and we push ourselves up (4.45-5.85 s).
loop(world, 'city_far', 0, 5.5, xfade=2, gain=-6, fin=0.5, fout=2.0)
loop(body, 'heart_rest', 0, 5.0, xfade=0.3, gain=-12, lp=2000, fin=0.8, fout=2.2)
put(body, 'wake_groan', 1.15, gain=-13, lp=7000, fin=0.1, fout=0.6)
put(body, 'wake_swell', 1.5, gain=-20, lp=6000, fin=0.6, fout=1.0, dur=2.6)
put(body, 'head_rustle', 3.55, gain=-16, fout=0.3)
put(body, 'stand_up', 4.5, gain=-11, fout=0.4)
put(world, 'pigeons', 2.15, gain=-13, pan=-0.2, fout=0.5)
# Traffic going by (northbound lanes on our left; the hero taxi is a little lower and closer).
for t, g, p, pitch in [(0.85, -10, -0.35, 1.0), (2.85, -13, -0.5, 1.02), (4.2, -16, -0.7, 0.97), (6.7, -5, -0.35, 0.92),
                       (7.45, -11, -0.5, 1.0), (10.6, -17, -0.7, 0.95)]:
    put(world, 'car_pass', t, pitch=pitch, gain=g, pan=p, fin=0.3, fout=0.6)
# Our own footsteps: plants from the walk speed in the shot (0.72 m stride).
steps = step_slices('walk_steps')
for i, t in enumerate(walk_times([(6.7, 0), (7.5, 1.35), (11.6, 1.35), (12.5, 0)], 0.72, 12.6)):
    s = steps[i % len(steps)]
    put(world, 'walk_steps', t - 0.02, start=max(0, s - 0.02), dur=0.42, gain=-9 + rng.uniform(-1.5, 1), pan=0.12 if i % 2 else -0.12,
        fin=0.005, fout=0.15)
# The 1.2x taxi's mirror clips the parked scooter (~10.25 s); it tips over and clatters down.
put(world, 'scooter_fall', 10.25 - 0.34, dur=1.3, gain=-4, pan=-0.45, fout=0.2)
put(world, 'scooter_fall', 10.95, start=1.85, gain=-6, pan=-0.45, fout=0.3)
# 1.5x: lanes jam (11.8 s) and horns start; the squeeze scrapes and the mirror snaps off at 13.4 s.
put(world, 'horns', 11.7, dur=4.3, gain=-11, pan=-0.3, fin=0.5, fout=0.05)
put(world, 'horns', 13.9, start=2.5, dur=2.1, gain=-16, pan=0.4, lp=4000, fin=0.4, fout=0.05)
put(world, 'mirror_scrape', 12.4, dur=1.6, gain=-6, pan=-0.3, fin=0.15, fout=0.3)
put(world, 'crowd_gasp', 13.55, start=0.3, gain=-17, pan=0.3, fout=0.8)

# ---- 0:16-0:21 2x: the heavy sedan rolls past, the manhole cover clanks and steam puffs ---------------
put(world, 'heavy_pass', 16.0, start=1.3, pitch=0.85, gain=-3, pan=-0.25, fin=0.05, fout=0.1, dur=5.0)
put(world, 'car_pass', 16.4, start=0.8, pitch=0.95, gain=-18, pan=-0.8, fin=0.05, fout=0.5)
put(world, 'manhole', 16.8, start=1.6, dur=1.2, gain=-20, fin=0.6, fout=0.3)  # humming in its frame as the weight nears
put(world, 'manhole', 18.07, dur=0.9, gain=-4, fout=0.25)  # front axle
put(world, 'manhole', 19.42, gain=-1, fout=0.4)  # rear axle: bounces longer, lands askew
put(world, 'steam', 19.82, dur=1.15, gain=-10, fin=0.08, fout=0.1)
put(world, 'crowd_gasp', 18.2, start=0.2, gain=-18, pan=0.2, fout=0.6, dur=2.8)

# ---- 0:21-0:33 4x signals ripped down, then 5x: asphalt cracks, lamp post snaps, everyone runs ------
put(world, 'heavy_pass', 21.0, start=3.4, pitch=0.75, gain=-1, pan=-0.3, fin=0.05, fout=1.5)  # car A rolls past us
put(world, 'signal_rip', 21.75, gain=-3, pan=-0.35)  # its roof tears through the SE signal arm (23.68)
put(world, 'lamp_snap', 24.0, pitch=1.35, dur=0.8, gain=-7, pan=-0.35)  # heads snap off
put(world, 'lamp_snap', 24.25, pitch=1.5, dur=0.8, gain=-9, pan=-0.4)
put(world, 'light_smash', 25.05, gain=-4, pan=-0.35, fout=0.4)  # ... and smash on the asphalt
put(world, 'light_smash', 25.32, start=0.8, pitch=1.06, gain=-8, pan=-0.45, fout=0.4)
put(world, 'crowd_gasp', 23.3, gain=-7, pan=0.25, fout=1.0)  # people point and hold their heads
put(world, 'signal_rip', 22.75, gain=-15, lp=2500, pan=0.35)  # the far signal (24.68) goes too
put(world, 'light_smash', 26.2, gain=-17, lp=2200, pan=0.3)
put(world, 'light_smash', 26.45, start=0.5, gain=-19, lp=2200, pan=0.35)
put(world, 'heavy_pass', 25.0, start=3.6, pitch=0.68, gain=0, pan=-0.3, fin=1.0, fout=1.2)  # the 5x van (27.5)
for t, g, lp in [(26.5, -5, None), (27.0, -8, 6000), (27.35, -3, None), (27.6, -7, None), (28.2, -5, None),
                 (29.6, -11, 4000), (30.4, -13, 3500), (30.6, -12, 4000), (31.4, -14, 3000), (31.7, -15, 3000)]:
    put(world, 'asphalt_crack', t - 0.2, gain=g, lp=lp, pitch=0.85, dur=1.6, fout=0.4)
put(world, 'lamp_snap', 28.57, pitch=0.9, gain=-1, pan=-0.3)  # the van's body snaps the lamp post
put(world, 'metal_groan', 28.3, start=2.0, dur=1.6, pitch=1.2, gain=-12, pan=-0.3, fin=0.2, fout=0.4)
put(world, 'light_smash', 29.82, pitch=0.75, gain=-3, pan=-0.2, fout=0.5)  # it crashes down
put(world, 'body_fall', 29.82, pitch=0.6, gain=-6, pan=-0.2)
# Panic: screams as everyone turns and runs (27.5-28.3), a baby crying somewhere; we run at 29.45.
put(world, 'crowd_scream', 27.3, gain=-6, fin=0.35, fout=0.05, dur=5.7, width=1.3)
put(world, 'baby_cry', 28.9, gain=-15, pan=0.45, lp=5000, fin=0.6, fout=0.05, dur=4.1)
put(world, 'car_alarms', 29.2, gain=-17, lp=6000, pan=-0.3, fin=1.2, fout=0.05, dur=3.8)
put(world, 'run_breath', 29.35, start=1.2, gain=-4, fin=0.25, fout=0.05, dur=3.65)
loop(body, 'heart_fast', 27.6, 39.6, xfade=0.25, gain=-10, lp=1200, fin=1.0, fout=1.0, auto=[(27.6, 0), (31, 2), (36, 1), (39.6, -4)])

# ---- 0:33-0:39 10x: two cars fill the avenue, ripping the west side; the hydrant bursts ------------
loop(world, 'giant_grind', 33, 39, xfade=1.5, pitch=0.72, gain=-4, fin=0.05, fout=0.05, auto=[(33, -3), (36.5, 0), (39, 3)])
for t, name, g, p in [(33.6, 'shop_glass', -10, -0.4), (34.2, 'awning_tear', -9, -0.45), (34.9, 'lamp_snap', -9, -0.4),
                      (35.5, 'shop_glass', -8, -0.4), (36.0, 'awning_tear', -8, -0.4), (36.6, 'signal_rip', -9, -0.35),
                      (37.1, 'shop_glass', -6, -0.35), (37.9, 'awning_tear', -7, -0.35), (38.3, 'lamp_snap', -6, -0.3)]:
    start = {'awning_tear': 1.2, 'signal_rip': 1.4}.get(name, 0)
    put(world, name, t, start=start, gain=g + 2, pan=p, lp=6500, fout=0.3, dur=min(2.5, 39 - t))
put(world, 'hydrant', 37.47, gain=-6, pan=0.35, fin=0.03, fout=0.05, dur=1.53)
put(world, 'tire_burst', 37.45, pitch=1.3, dur=0.6, gain=-10, pan=0.35)  # the cap pops
put(world, 'crowd_scream', 33.0, start=3.0, gain=-14, lp=5000, fin=0.05, fout=0.05, dur=6.0, pan=0.4)
put(world, 'baby_cry', 34.6, start=2.5, gain=-19, lp=4000, pan=0.6, fin=0.6, fout=0.05, dur=4.4)
put(world, 'car_alarms', 33.0, start=3.0, gain=-16, lp=6000, pan=-0.4, fin=0.05, fout=0.05, dur=6.0)
put(world, 'run_breath', 36.1, start=4.0, gain=-11, fin=0.3, fout=0.05, dur=2.9)  # backing away

# ---- 0:39-0:45 20x: the taxi shears the corner building; the shock knocks us down ------------------
SHOCK = 41.76  # front bursts out of the corner's south face (shotPlow.js)
LAND = SHOCK + 0.7
loop(world, 'giant_grind', 39, 45, xfade=1.5, pitch=0.6, gain=-4, fin=0.05, fout=0.05, auto=[(39, -2), (41.7, 1), (45, -1)])
put(world, 'building_collapse', 40.12, gain=-4, pan=-0.2, fout=0.05, dur=4.88)  # first chunks (40.14)
put(world, 'building_collapse', 40.9, start=0.3, pitch=0.8, gain=-8, pan=-0.35, fout=0.05, dur=4.1)
put(world, 'shop_glass', 40.6, gain=-12, lp=5000, pan=-0.3, fout=0.4)
put(world, 'crowd_scream', 39.0, start=1.0, gain=-11, lp=6000, pan=0.45, fin=0.05, fout=0.5, dur=3.2)
put(world, 'tire_burst', SHOCK, pitch=0.62, gain=0, fout=0.6)  # the shock: a deep blast
put(world, 'building_collapse', SHOCK + 0.05, pitch=0.7, lp=1200, gain=-4, fout=0.05, dur=45 - SHOCK - 0.05)
put(body, 'body_fall', LAND - 0.02, gain=-5)
put(body, 'tinnitus', SHOCK + 0.15, gain=-21, lp=7000, fin=0.3, fout=1.6, dur=45.6 - SHOCK)
loop(body, 'heart_fast', 42.3, 45.6, xfade=0.25, pitch=0.9, gain=-7, lp=1000, fin=0.6, fout=0.8)
put(body, 'wake_breath', 43.25, gain=-11, fin=0.3, fout=0.6, dur=2.3)  # catching our breath, looking up

# ---- 0:45-0:51 50x: the tyre bursts, the body sags onto its rims, panes fall from the towers --------
BURST = 47.25
put(world, 'metal_groan', 45.0, start=0.5, pitch=0.8, gain=-10, lp=3000, fin=0.6, fout=0.4, dur=2.2)
put(world, 'tire_burst', BURST - 0.03, pitch=0.72, gain=1, fout=0.8)
put(world, 'building_collapse', BURST, pitch=0.55, lp=900, gain=-6, fout=1.0, dur=3.5)
put(world, 'metal_groan', BURST - 1.6, pitch=0.68, gain=-3, fin=0.4, fout=0.05, dur=LEN - BURST + 1.6)  # sags onto the rims
put(world, 'asphalt_crack', 48.2, pitch=0.75, gain=-10, lp=4000, fout=0.6)  # paint cracking
put(world, 'glass_far', 48.6, gain=-9, lp=6000, pan=0.4, fin=0.05, fout=0.05, dur=LEN - 48.6)
put(world, 'glass_far', 49.9, start=0.3, gain=-13, lp=5000, pan=-0.3, fin=0.05, fout=0.05, dur=LEN - 49.9)
put(world, 'crowd_scream', 45.0, start=1.5, gain=-20, lp=3500, fin=0.05, fout=0.05, dur=6.0)
put(world, 'car_alarms', 45.0, gain=-19, lp=5000, pan=0.3, fin=0.05, fout=0.05, dur=6.0)

# ---- master ---------------------------------------------------------------------------------------------
w = reverb(world.x, rt=1.1, wet=-13)
# Waking: the world starts far away and dull and opens up as our eyes open (lids part at 1.5-2.05,
# blink, open at 3.1, focus by 4.05, standing at 5.85). Then again after the shock knocks us down.
w = muffle(w, [(0, 1.0), (1.5, 1.0), (2.05, 0.72), (2.3, 0.8), (2.62, 0.6), (3.1, 0.38), (4.05, 0.1), (4.6, 0.0),
               (SHOCK + 0.05, 0.0), (SHOCK + 0.2, 0.9), (LAND + 0.3, 0.88), (43.4, 0.55),
               (44.3, 0.2), (45.0, 0.0)])
t = np.arange(len(w)) / SR
lift = np.interp(t, [0, 1.5, 3.1, 4.2, SHOCK + 0.05, SHOCK + 0.25, 43.4, 45.0],
                 [-12, -11, -4, 0, 0, -8, -5, 0])
w *= (10 ** (lift / 20))[:, None]
mix = w + body.x
fade = int(0.03 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]

os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
raw = os.path.join(ROOT, 'out', 'sfx_raw.f32')
out = os.path.join(ROOT, 'out', 'sfx_mix.wav')
mix.astype(np.float32).tofile(raw)
src = ['-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', raw]
# Static gain to -16 LUFS integrated (keeps the quiet wake-up quiet), then a gentle peak limiter.
stats = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', *src, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
lufs = float(stats.rsplit('I:', 1)[1].split('LUFS')[0])
gain = -16.0 - lufs
subprocess.run(['ffmpeg', '-v', 'error', '-y', *src, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.79:attack=4:release=60:level=disabled',
                '-c:a', 'pcm_s24le', out], check=True)
os.remove(raw)
print(f'mix: {LEN:.0f}s, measured {lufs:.1f} LUFS, gain {gain:+.1f} dB -> {out}')
