// Procedural, deterministic soundtrack: NO music. Only natural / environmental ambience
// (wind, birds, crickets, water, crowds, room tone) and scene sound effects, synced to the
// timeline. Writes out/audio.wav (48 kHz, 16-bit stereo). 0:51-0:54 is exact digital silence.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DURATION, CODE_LINE } from './src/timeline.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const N = Math.round(DURATION * SR);
const dry = { L: new Float32Array(N), R: new Float32Array(N) };
const wet = { L: new Float32Array(N), R: new Float32Array(N) }; // sent through room reverb (indoor scenes)

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(2030);
const range = (a, b) => a + (b - a) * rnd();
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function mix(buf, t0, gain = 1, pan = 0, bus = dry) {
  const s0 = Math.round(t0 * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < buf.length; i++) {
    const j = s0 + i;
    if (j < 0 || j >= N) continue;
    bus.L[j] += buf[i] * gl;
    bus.R[j] += buf[i] * gr;
  }
}
const mixIn = (buf, t0, gain, pan, wetAmt) => {
  mix(buf, t0, gain, pan, dry);
  if (wetAmt) mix(buf, t0, gain * wetAmt, pan, wet);
};

// ---- DSP helpers -----------------------------------------------------------------------------
function noise(dur) {
  const b = new Float32Array(Math.max(1, Math.round(dur * SR)));
  for (let i = 0; i < b.length; i++) b[i] = rnd() * 2 - 1;
  return b;
}
function lowpass(b, fc) {
  const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
  let y = 0;
  for (let i = 0; i < b.length; i++) b[i] = y += a * (b[i] - y);
  return b;
}
function highpass(b, fc) {
  const a = Math.exp((-2 * Math.PI * fc) / SR);
  let px = 0;
  let py = 0;
  for (let i = 0; i < b.length; i++) {
    const y = a * (py + b[i] - px);
    px = b[i];
    b[i] = py = y;
  }
  return b;
}
function bandpass(b, fc, q = 2) {
  const w = (2 * Math.PI * fc) / SR;
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w);
  const a2 = 1 - alpha;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < b.length; i++) {
    const x = b[i];
    const y = (alpha * x - alpha * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    b[i] = y;
  }
  return b;
}
function env(b, fn) {
  const d = b.length / SR;
  for (let i = 0; i < b.length; i++) b[i] *= fn(i / SR, d);
  return b;
}
// Slow random curve in [0,1] (value noise), used for gusts and crowd swells.
function slowCurve(dur, rate, seed) {
  const r = mulberry32(seed);
  const pts = [];
  for (let k = 0; k <= Math.ceil(dur * rate) + 2; k++) pts.push(r());
  return (t) => {
    const x = t * rate;
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return pts[i] + (pts[i + 1] - pts[i]) * u;
  };
}
const fadeEdges = (fadeIn, fadeOut) => (t, d) => smooth(0, fadeIn, t) * (1 - smooth(d - fadeOut, d, t));

// ---- Nature and environment generators --------------------------------------------------------
// Wind: low-passed noise whose brightness and loudness follow slow gusts. Stereo, uncorrelated.
function wind(t0, dur, { gain = 0.2, cutoff = 500, gust = 0.6, fadeIn = 0.4, fadeOut = 0.4, seed = 1 } = {}) {
  for (const [side, pan] of [[0, -0.7], [1, 0.7]]) {
    const g = slowCurve(dur, 0.35, seed * 7 + side);
    const b = noise(dur);
    let y = 0;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const c = g(t);
      const fc = cutoff * (0.55 + gust * c);
      const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
      y += a * (b[i] - y);
      b[i] = y * (0.45 + gust * 0.9 * c);
    }
    highpass(b, 40);
    env(b, fadeEdges(fadeIn, fadeOut));
    mix(b, t0, gain * 2.2, pan);
  }
}

// One bird note: a pitch glide with a little vibrato and a soft envelope.
function birdNote(t0, f0, f1, dur, gain, pan, vib = 0) {
  const n = Math.round(dur * SR);
  const b = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const f = f0 + (f1 - f0) * u + vib * Math.sin(2 * Math.PI * 38 * (i / SR));
    ph += (2 * Math.PI * f) / SR;
    const a = Math.pow(Math.sin(Math.PI * u), 0.6);
    b[i] = a * (Math.sin(ph) + 0.12 * Math.sin(2 * ph));
  }
  mix(b, t0, gain, pan);
}
// Bird phrases of a few kinds, scattered through [t0, t0+dur).
function birds(t0, dur, { rate = 0.6, gain = 0.05, kinds = ['sparrow'], pan = [-0.8, 0.8] } = {}) {
  let t = t0 + range(0.1, 0.6);
  while (t < t0 + dur - 0.4) {
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    const p = range(pan[0], pan[1]);
    const g = gain * range(0.5, 1);
    let tt = t;
    if (kind === 'sparrow') {
      const n = 2 + Math.floor(rnd() * 4);
      const base = range(2800, 4200);
      for (let k = 0; k < n; k++) {
        const up = rnd() < 0.5;
        birdNote(tt, base * (up ? 0.85 : 1.15), base * (up ? 1.15 : 0.8), range(0.04, 0.08), g, p);
        tt += range(0.07, 0.13);
      }
    } else if (kind === 'blackbird') {
      const n = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const f = range(1700, 2900);
        birdNote(tt, f, f * range(0.8, 1.25), range(0.14, 0.32), g, p, range(30, 90));
        tt += range(0.22, 0.4);
      }
    } else if (kind === 'lark') {
      const len = range(1.2, 2.4);
      while (tt < t + len) {
        const f = range(2600, 5200);
        birdNote(tt, f, f * range(0.85, 1.2), range(0.025, 0.05), g * 0.8, p);
        tt += range(0.04, 0.075);
      }
    } else if (kind === 'pigeon') {
      // "coo-OO-oo": low breathy tone with a swell.
      const n = Math.round(0.75 * SR);
      const b = new Float32Array(n);
      let ph = 0;
      const f = range(300, 360);
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const ff = f * (1 + 0.12 * Math.sin(Math.PI * u)) + 6 * Math.sin(2 * Math.PI * 9 * (i / SR));
        ph += (2 * Math.PI * ff) / SR;
        const a = Math.pow(Math.sin(Math.PI * u), 1.4) * (0.6 + 0.4 * Math.sin(Math.PI * 3 * u) ** 2);
        b[i] = a * Math.sin(ph);
      }
      lowpass(b, 900);
      mix(b, tt, g * 1.6, p);
      tt += 0.8;
    }
    t = tt + (1 / rate) * range(0.4, 1.6);
  }
}
// Crickets: pulse trains of a high carrier, each insect with its own rhythm and position.
function crickets(t0, dur, { count = 4, gain = 0.03, fadeIn = 0.5, fadeOut = 0.5 } = {}) {
  for (let c = 0; c < count; c++) {
    const f = range(4200, 5200);
    const period = range(0.55, 0.95);
    const pulses = 2 + Math.floor(rnd() * 3);
    const pan = range(-0.9, 0.9);
    const g = gain * range(0.4, 1);
    for (let t = t0 + range(0, period); t < t0 + dur; t += period * range(0.95, 1.05)) {
      const edge = smooth(t0, t0 + fadeIn, t) * (1 - smooth(t0 + dur - fadeOut, t0 + dur, t));
      for (let k = 0; k < pulses; k++) {
        const n = Math.round(0.018 * SR);
        const b = new Float32Array(n);
        for (let i = 0; i < n; i++) b[i] = Math.sin((2 * Math.PI * f * i) / SR) * Math.sin((Math.PI * i) / n);
        mix(b, t + k * 0.042, g * edge, pan);
      }
    }
  }
}
// Grasshopper rasp in a field: short bursts of bright filtered noise.
function grasshoppers(t0, dur, { gain = 0.02 } = {}) {
  for (let c = 0; c < 3; c++) {
    const pan = range(-0.8, 0.8);
    for (let t = t0 + range(0, 1); t < t0 + dur - 0.3; t += range(0.9, 2.2)) {
      const len = range(0.25, 0.6);
      const b = bandpass(noise(len), range(6500, 8000), 3);
      for (let i = 0; i < b.length; i++) b[i] *= 0.5 + 0.5 * Math.sign(Math.sin((2 * Math.PI * 28 * i) / SR));
      env(b, fadeEdges(0.03, 0.06));
      mix(b, t, gain, pan);
    }
  }
}
// Crowd murmur ("babble"): voice-band noise layers gated at syllable rate.
function murmur(t0, dur, { gain = 0.1, voices = 10, fadeIn = 0.4, fadeOut = 0.5, wetAmt = 0, level = () => 1 } = {}) {
  const out = new Float32Array(Math.round(dur * SR));
  for (let v = 0; v < voices; v++) {
    const b = bandpass(noise(dur), range(350, 1300), range(2, 4));
    const rate = range(3.5, 6.5);
    const gate = slowCurve(dur, rate, 900 + v + Math.floor(rnd() * 1000));
    const phrase = slowCurve(dur, 0.4, 500 + v);
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      const s = Math.max(0, gate(t) - 0.35) * 1.6;
      out[i] += b[i] * s * (phrase(t) > 0.35 ? 1 : 0.25);
    }
  }
  lowpass(out, 2600);
  for (let i = 0; i < out.length; i++) out[i] *= level(i / SR);
  env(out, fadeEdges(fadeIn, fadeOut));
  mixIn(out, t0, gain / Math.sqrt(voices), range(-0.15, 0.15), wetAmt);
}
// Fountain / splashing water: bright noise with fast random flutter, plus droplets.
function water(t0, dur, { gain = 0.08, level = () => 1 } = {}) {
  for (const pan of [-0.4, 0.4]) {
    const b = noise(dur);
    highpass(b, 700);
    lowpass(b, 5200);
    const flutter = slowCurve(dur, 28, 4000 + Math.floor(rnd() * 999));
    for (let i = 0; i < b.length; i++) b[i] *= (0.45 + 0.8 * flutter(i / SR)) * level(i / SR);
    env(b, fadeEdges(0.4, 0.5));
    mix(b, t0, gain, pan);
  }
  for (let t = t0; t < t0 + dur; t += range(0.05, 0.18)) {
    const f = range(1400, 3200);
    const d = env(new Float32Array(Math.round(0.05 * SR)).map((_, i) => Math.sin((2 * Math.PI * f * i * (1 + i / SR * 8)) / SR)), (x) => Math.exp(-x * 90));
    mix(d, t, gain * 0.25 * level(t - t0), range(-0.5, 0.5));
  }
}
// Room tone: very low air rumble, optionally with mains hum (fluorescent lights).
function roomTone(t0, dur, { gain = 0.04, hum = 0, wetAmt = 0.4 } = {}) {
  const b = lowpass(noise(dur), 220);
  highpass(b, 30);
  if (hum) {
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] += hum * (Math.sin(2 * Math.PI * 120 * t) + 0.4 * Math.sin(2 * Math.PI * 240 * t) + 0.15 * Math.sin(2 * Math.PI * 360 * t));
    }
  }
  env(b, fadeEdges(0.3, 0.3));
  mixIn(b, t0, gain * 3, 0, wetAmt);
}
function footstep(t0, gain, pan, { bright = 900, wetAmt = 0 } = {}) {
  const b = lowpass(noise(0.09), bright * range(0.85, 1.15));
  highpass(b, 80);
  env(b, (x) => Math.min(1, x / 0.003) * Math.exp(-x * 42));
  mixIn(b, t0, gain * range(0.75, 1.1), pan, wetAmt);
}
function steps(t0, t1, rate, gain, pan, opts) {
  for (let t = t0; t < t1; t += (1 / rate) * range(0.94, 1.06)) footstep(t, gain, pan, opts);
}
function owl(t0, gain, pan) {
  for (const [dt, d] of [[0, 0.42], [0.75, 0.16], [0.95, 0.5]]) {
    const n = Math.round(d * SR);
    const b = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      ph += (2 * Math.PI * (390 - 25 * u)) / SR;
      b[i] = Math.sin(ph) * Math.pow(Math.sin(Math.PI * u), 0.8);
    }
    const breath = lowpass(noise(d), 600);
    for (let i = 0; i < n; i++) b[i] += breath[i] * 0.15 * Math.sin((Math.PI * i) / n);
    mix(b, t0 + dt, gain, pan);
  }
}
function wingFlaps(t0, gain, pan) {
  for (let k = 0; k < 9; k++) {
    const b = env(bandpass(noise(0.06), 700, 1.2), (x) => Math.exp(-x * 60));
    mix(b, t0 + k * 0.075, gain * (1 - k / 12), pan + k * 0.04);
  }
}

// ---- Sound effects ------------------------------------------------------------------------------
const click = (t0, gain = 0.5, f = 2500, pan = 0, wetAmt = 0) => {
  const b = env(bandpass(noise(0.05), f, 1.5), (t) => Math.exp(-t * 160));
  mixIn(b, t0, gain, pan, wetAmt);
};
const thump = (t0, gain = 0.6, f = 70, pan = 0) => {
  const n = Math.round(0.5 * SR);
  const b = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (2 * Math.PI * f * Math.pow(0.55, t / 0.5)) / SR;
    b[i] = Math.sin(ph) * Math.min(1, t / 0.004) * Math.exp(-t * 9);
  }
  mix(b, t0, gain, pan);
};
const beep = (t0, f, dur, gain, wetAmt = 0) => {
  const n = Math.round(dur * SR);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    b[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * 3 * f * t)) * smooth(0, 0.008, t) * (1 - smooth(dur - 0.02, dur, t));
  }
  mixIn(b, t0, gain, 0, wetAmt);
};
const sweep = (t0, dur, f0, f1, gain) => {
  const n = Math.round(dur * SR);
  const b = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    ph += (2 * Math.PI * f0 * Math.pow(f1 / f0, u)) / SR;
    b[i] = (Math.sin(ph) + 0.33 * Math.sin(3 * ph) + 0.2 * Math.sin(5 * ph)) * smooth(0, 0.08, u) * (1 - smooth(0.55, 1, u));
  }
  lowpass(b, 900);
  mix(b, t0, gain);
};

// ---- The soundscape, scene by scene ------------------------------------------------------------
// 0:00 control room
roomTone(0, 4.2, { gain: 0.035, wetAmt: 0.5 });
click(1.95, 0.6, 1800, 0.1, 0.4);
thump(1.97, 0.25, 110);
beep(2.12, 1046, 0.09, 0.07, 0.6);
beep(2.24, 1568, 0.14, 0.07, 0.6);

// 0:04 black: key clicks on near-silence
roomTone(4, 3.1, { gain: 0.015, wetAmt: 0.2 });
{
  const { start, typeEnd, text } = CODE_LINE;
  for (let i = 1; i <= text.length; i++) {
    const t = start + ((typeEnd - start) * i) / text.length + range(-0.006, 0.006);
    click(t, 0.22 + rnd() * 0.08, range(3000, 4500), range(-0.15, 0.15));
  }
}

// 0:07 factories at dusk: evening wind, a blackbird; the industrial hum steps down stack by stack
wind(6.8, 5.5, { gain: 0.11, cutoff: 420, seed: 3 });
birds(7.2, 4.6, { rate: 0.5, gain: 0.035, kinds: ['blackbird'], pan: [-0.7, -0.2] });
{
  const stops = [0.9, 1.6, 2.2, 2.8, 3.4, 4.0].map((x) => x + 7);
  const dur = 5.4;
  const rumble = lowpass(noise(dur), 140);
  for (let i = 0; i < rumble.length; i++) {
    const t = 7 + i / SR;
    const live = stops.filter((s) => t < s).length / stops.length;
    rumble[i] *= smooth(7, 7.35, t) * (0.15 + 0.85 * live) * (1 - smooth(11.6, 12.2, t)) * 1.8;
  }
  mix(rumble, 7, 0.35);
  stops.forEach((s, i) => thump(s, 0.22, 58 + i * 4, -0.4 + i * 0.16));
}

// 0:12 highway (outdoors), then inside the car at 0:14.55 everything outside is muffled
wind(11.8, 2.95, { gain: 0.13, cutoff: 600, seed: 5, fadeOut: 0.25 });
birds(12.1, 2.4, { rate: 1.2, gain: 0.04, kinds: ['sparrow', 'sparrow', 'blackbird'] });
{
  const city = lowpass(noise(2.9), 250);
  env(city, fadeEdges(0.3, 0.25));
  mix(city, 11.8, 0.12);
}
steps(12.0, 14.5, 1.8, 0.08, 0.6, { bright: 1200 });
steps(12.1, 14.5, 1.85, 0.05, -0.1, { bright: 1000 });
wind(14.4, 2.9, { gain: 0.1, cutoff: 180, seed: 6, fadeIn: 0.2 });
click(15.15, 0.55, 1500, 0.15, 0);
click(15.17, 0.12, 5200, 0.15, 0);
click(15.95, 0.55, 1500, 0.15, 0);
click(15.97, 0.12, 5200, 0.15, 0);

// 0:17 airport: indoor crowd murmur, a traveller's footsteps, split-flap clatter per row
murmur(16.8, 5.4, { gain: 0.65, voices: 12, wetAmt: 0.5 });
roomTone(16.8, 5.4, { gain: 0.02, wetAmt: 0.6 });
steps(17.0, 19.9, 1.75, 0.1, 0.5, { bright: 1800, wetAmt: 0.5 });
for (let r = 0; r < 8; r++) {
  const t0 = 17 + 0.55 + r * 0.36;
  for (let k = 0; k < 9; k++) click(t0 + k * 0.032 + rnd() * 0.01, 0.18, range(3000, 4000), -0.25 + r * 0.05, 0.4);
}

// 0:22 power plant at night: crickets, wind, steam hiss; everything powers down; then space is near-silent
crickets(21.8, 3.6, { count: 5, gain: 0.03, fadeOut: 0.3 });
wind(21.8, 3.5, { gain: 0.07, cutoff: 380, seed: 8, fadeOut: 0.4 });
{
  const hiss = highpass(noise(3.2), 2500);
  env(hiss, (t) => smooth(0, 0.3, t) * (1 - smooth(1.0, 3.0, t)));
  mix(hiss, 21.9, 0.03, 0.3);
  const hum = lowpass(noise(2.0), 120);
  env(hum, (t) => smooth(0, 0.2, t) * (1 - smooth(0.9, 1.9, t)));
  mix(hum, 21.9, 0.11);
  sweep(23.0, 2.0, 110, 28, 0.08);
  [23.0, 23.35, 23.7].forEach((t, i) => thump(t, 0.12, 50, -0.3 + i * 0.3));
  click(23.02, 0.25, 900, -0.3);
  click(23.37, 0.25, 900, 0);
  click(23.72, 0.25, 900, 0.3);
}
roomTone(25.0, 3.1, { gain: 0.012, wetAmt: 0 });

// 0:28 night street: crickets, a soft breeze, footsteps of mother and son, an owl over the dark city
crickets(27.8, 6.4, { count: 6, gain: 0.042 });
wind(27.8, 6.4, { gain: 0.06, cutoff: 350, seed: 11 });
steps(27.9, 31.4, 1.75, 0.06, -0.3, { bright: 1300 });
steps(27.95, 31.4, 2.1, 0.035, -0.2, { bright: 1500 });
owl(31.4, 0.05, 0.5);

// 0:34 the yard: crickets, running footsteps, the bolts slam, the panel refuses
crickets(33.8, 6.4, { count: 4, gain: 0.022 });
wind(33.8, 6.4, { gain: 0.05, cutoff: 320, seed: 13 });
for (let w = 0; w < 4; w++) {
  let t = 34 + w * 0.12;
  let rate = 2.6;
  while (t < 36.9) {
    footstep(t, 0.2 * (1 - smooth(36.3, 36.9, t)), -0.4 + w * 0.25, { bright: 1100 });
    rate = Math.min(3.4, rate + 0.12);
    t += (1 / rate) * range(0.97, 1.03);
  }
}
click(37.55, 0.45, 2000, 0.1);
thump(37.72, 0.85, 55);
{
  const clank = env(bandpass(noise(0.6), 900, 4), (t) => Math.exp(-t * 7));
  mix(clank, 37.72, 0.55);
  for (const f of [523, 829, 1140]) {
    const n = Math.round(1.1 * SR);
    const ring = new Float32Array(n);
    for (let i = 0; i < n; i++) ring[i] = Math.sin((2 * Math.PI * f * i) / SR) * Math.exp((-i / SR) * 4.5);
    mix(ring, 37.72, 0.04);
  }
}
beep(37.84, 330, 0.16, 0.12);
beep(38.14, 330, 0.16, 0.12);
click(38.7, 0.4, 2000, 0.1);
beep(38.86, 330, 0.16, 0.12);

// 0:40 the chart: a quiet room, a soft tick as each bar sinks, a low hit on the last one
roomTone(40, 6.1, { gain: 0.02, wetAmt: 0.6 });
[0.9, 1.6, 2.3, 3.0, 3.7].forEach((x, i) => {
  click(40 + x, 0.2, 1400 - i * 120, -0.3 + i * 0.15, 0.5);
  thump(40 + x + 0.05, 0.08, 120 - i * 8);
});
thump(44.0, 0.45, 45);

// 0:46 the city square from above: murmur, fountain, pigeons; it all falls away as we climb
{
  const away = (t) => 1 - smooth(0.6, 3.2, t);
  murmur(45.8, 5.0, { gain: 0.3, voices: 14, level: away, fadeOut: 0.3 });
  water(45.8, 5.0, { gain: 0.05, level: away });
  birds(46.0, 2.6, { rate: 1.1, gain: 0.05, kinds: ['pigeon', 'sparrow'] });
  wingFlaps(46.7, 0.05, -0.4);
  steps(45.9, 48.2, 2.2, 0.03, 0.2, { bright: 1500 });
  // Wind grows as the camera rises, then cuts dead at 0:51.
  const n = Math.round(5.2 * SR);
  const w = noise(5.2);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const k = smooth(1.0, 5.0, t);
    const a = 1 - Math.exp((-2 * Math.PI * (250 + 1600 * k)) / SR);
    y += a * (w[i] - y);
    w[i] = y * k * k;
  }
  mix(w, 45.8, 0.35);
}

// 0:51-0:54 silence (enforced at the end).

// 0:54 empty fields: wind in the grass, skylarks, grasshoppers
wind(54.0, 3.2, { gain: 0.14, cutoff: 700, gust: 0.8, seed: 17, fadeIn: 0.15, fadeOut: 0.3 });
birds(54.2, 2.8, { rate: 0.8, gain: 0.04, kinds: ['lark', 'lark', 'sparrow'] });
grasshoppers(54.1, 3.0, { gain: 0.018 });
// 0:57 the store: fluorescent hum, mother and son's slow footsteps
roomTone(56.8, 3.4, { gain: 0.045, hum: 0.02, wetAmt: 0.6 });
steps(57.1, 60.1, 1.45, 0.14, -0.05, { bright: 1700, wetAmt: 0.5 });
steps(57.3, 60.1, 1.75, 0.09, 0.15, { bright: 1900, wetAmt: 0.5 });

// 1:00 year 100: nature is back. Gentle wind and birdsong.
wind(59.8, 6.4, { gain: 0.08, cutoff: 500, seed: 19, fadeIn: 0.6 });
birds(60.3, 5.6, { rate: 0.7, gain: 0.04, kinds: ['blackbird', 'sparrow', 'lark'] });
// 1:06 end card: the wind and one last bird fade out
wind(65.6, 4.4, { gain: 0.06, cutoff: 420, seed: 23, fadeOut: 2.5 });
birds(66.2, 1.6, { rate: 0.5, gain: 0.03, kinds: ['blackbird'] });

// ---- Mix and master ---------------------------------------------------------------------------
function reverb(x) {
  const y = new Float32Array(x.length);
  for (const d of [1557, 1617, 1491, 1422].map((v) => Math.round(v * 1.3))) {
    const buf = new Float32Array(d);
    let k = 0;
    let lp = 0;
    for (let i = 0; i < x.length; i++) {
      const out = buf[k];
      lp += 0.35 * (out - lp);
      buf[k] = x[i] + lp * 0.8;
      y[i] += out * 0.2;
      k = (k + 1) % d;
    }
  }
  return y;
}
const rl = reverb(wet.L);
const rr = reverb(wet.R);
const L = new Float32Array(N);
const R = new Float32Array(N);
for (let i = 0; i < N; i++) {
  L[i] = dry.L[i] + rl[i];
  R[i] = dry.R[i] + rr[i];
}
// Loudness: bring the ambience up to a comfortable level, soft-limit the peaks.
let sum = 0;
let cnt = 0;
for (let i = 0; i < N; i++) {
  sum += L[i] * L[i] + R[i] * R[i];
  cnt += 2;
}
const rms = Math.sqrt(sum / cnt);
const target = Math.pow(10, -22 / 20);
const pre = target / rms;
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * pre * 1.1) / 1.1;
  R[i] = Math.tanh(R[i] * pre * 1.1) / 1.1;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = Math.min(1, 0.89 / peak);
// "Us." (0:51-0:54): a 15 ms fade-out into exact zeros, then a 15 ms fade-in afterwards.
const s51 = Math.round(51 * SR);
const s54 = Math.round(54 * SR);
const fadeN = Math.round(0.015 * SR);
for (let i = 0; i < N; i++) {
  let g = norm;
  if (i >= s51 - fadeN && i < s51) g *= (s51 - i) / fadeN;
  if (i >= s51 && i < s54) g = 0;
  if (i >= s54 && i < s54 + fadeN) g *= (i - s54) / fadeN;
  if (i > N - SR * 0.6) g *= (N - i) / (SR * 0.6);
  L[i] *= g;
  R[i] *= g;
}

const out = path.join(ROOT, 'out');
fs.mkdirSync(out, { recursive: true });
const data = Buffer.alloc(44 + N * 4);
data.write('RIFF', 0);
data.writeUInt32LE(36 + N * 4, 4);
data.write('WAVE', 8);
data.write('fmt ', 12);
data.writeUInt32LE(16, 16);
data.writeUInt16LE(1, 20);
data.writeUInt16LE(2, 22);
data.writeUInt32LE(SR, 24);
data.writeUInt32LE(SR * 4, 28);
data.writeUInt16LE(4, 32);
data.writeUInt16LE(16, 34);
data.write('data', 36);
data.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
}
fs.writeFileSync(path.join(out, 'audio.wav'), data);
console.log(`wrote out/audio.wav (${DURATION}s, ambience + sound effects, no music; pre-gain ${pre.toFixed(2)}, peak ${peak.toFixed(3)})`);
