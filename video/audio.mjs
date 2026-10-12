// Procedural, deterministic soundtrack: ambient pad + scene sound effects, synced to the timeline.
// Writes out/audio.wav (48 kHz, 16-bit stereo). 0:51-0:54 is exact digital silence.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DURATION, CODE_LINE } from './src/timeline.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const N = Math.round(DURATION * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const music = { L: new Float32Array(N), R: new Float32Array(N) };

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
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Add a mono buffer into a stereo bus at time t0 with gain and pan (-1..1).
function mix(buf, t0, gain = 1, pan = 0, bus = { L, R }) {
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

function noise(dur) {
  const b = new Float32Array(Math.round(dur * SR));
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
  const b0 = alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * Math.cos(w);
  const a2 = 1 - alpha;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < b.length; i++) {
    const x = b[i];
    const y = (b0 * x - b0 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    b[i] = y;
  }
  return b;
}
function env(b, fn) {
  for (let i = 0; i < b.length; i++) b[i] *= fn(i / SR, b.length / SR);
  return b;
}
function tone(dur, f, { type = 'sine', detune = 0, glideTo = null } = {}) {
  const b = new Float32Array(Math.round(dur * SR));
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const ff = glideTo ? f * Math.pow(glideTo / f, t / dur) : f;
    ph += (2 * Math.PI * ff * (1 + detune)) / SR;
    if (type === 'sine') b[i] = Math.sin(ph);
    else if (type === 'tri') b[i] = (2 / Math.PI) * Math.asin(Math.sin(ph));
    else b[i] = Math.sin(ph) + 0.33 * Math.sin(3 * ph) + 0.2 * Math.sin(5 * ph) + 0.1 * Math.sin(7 * ph);
  }
  return b;
}

// ---- Music: a soft pad that follows the story --------------------------------------------
function padChord(t0, dur, notes, gain, { attack = 1.2, release = 1.5, bright = 900 } = {}) {
  for (const [k, m] of notes.entries()) {
    for (const d of [-0.0035, 0.0035]) {
      let b = tone(dur + release, midi(m), { type: 'warm', detune: d });
      b = lowpass(b, bright);
      env(b, (t) => smooth(0, attack, t) * (1 - smooth(dur, dur + release, t)));
      mix(b, t0, gain / notes.length, (k / Math.max(1, notes.length - 1)) * 1.2 - 0.6 + d * 40, music);
    }
  }
}
// Act 1: curiosity
padChord(0.0, 4.0, [45, 52, 59, 60], 0.22, { attack: 0.8 });
padChord(4.0, 3.0, [45, 52, 57], 0.16, { bright: 600 });
// Act 2: the shutdowns (Am - F - C - G - Dm - Am)
const prog = [
  [7, [45, 52, 57, 60]], [10.5, [41, 48, 57, 60]], [14, [48, 55, 60, 64]], [17.5, [43, 50, 59, 62]],
  [21, [38, 50, 57, 62]], [24.5, [45, 52, 57, 60]],
];
for (const [t0, n] of prog) padChord(t0, 3.6, n, 0.24, { bright: 1100 });
// Stars: open, hopeful (F maj7 -> C add9)
padChord(28, 3.2, [41, 53, 57, 64], 0.26, { bright: 1600 });
padChord(31, 3.2, [48, 55, 62, 64], 0.24, { bright: 1600 });
// Lockout + numbers: tension drone that keeps rising
padChord(34, 6, [33, 40, 45], 0.3, { bright: 500, attack: 0.5 });
padChord(40, 6, [34, 41, 46, 53], 0.26, { bright: 700 });
// Crowd: swell into the cut
{
  const b = new Float32Array(Math.round(5 * SR));
  for (const m of [45, 52, 57, 60, 64, 69]) {
    const tb = tone(5, midi(m), { type: 'warm' });
    for (let i = 0; i < b.length; i++) b[i] += tb[i] / 6;
  }
  env(b, (t) => smooth(0, 4.9, t) ** 2);
  lowpass(b, 1400);
  mix(b, 46, 0.5, 0, music);
}
// Aftermath: sparse, low
padChord(54, 6, [33, 45, 48, 52], 0.22, { bright: 600, attack: 1.5 });
padChord(60, 6, [41, 48, 52, 57], 0.24, { bright: 1300, attack: 1.5 });
padChord(66, 2.5, [45, 52], 0.16, { bright: 500, attack: 0.6, release: 1.2 });
// Soft piano-like notes in the aftermath
function pluck(t0, m, gain) {
  let b = tone(3.2, midi(m), { type: 'tri' });
  const b2 = tone(3.2, midi(m) * 2.001, { type: 'sine' });
  for (let i = 0; i < b.length; i++) b[i] += 0.3 * b2[i];
  env(b, (t) => Math.min(1, t / 0.006) * Math.exp(-t * 1.6));
  lowpass(b, 2500);
  mix(b, t0, gain, 0.15, music);
}
[[54.6, 69], [56.1, 67], [57.6, 64], [59.1, 62], [60.6, 64], [62.6, 69], [64.6, 72], [66.4, 69]].forEach(([t, m]) => pluck(t, m, 0.14));
// A steady low pulse under the lockout (2 Hz; nothing flashes, this is only sound).
for (let t = 34.0; t < 39.9; t += 0.5) {
  const b = env(tone(0.25, midi(33), { type: 'sine' }), (x) => Math.min(1, x / 0.01) * Math.exp(-x * 14));
  mix(b, t, 0.22, 0, music);
}

// ---- Sound effects --------------------------------------------------------------------------
const click = (t0, gain = 0.5, f = 2500, pan = 0) => {
  const b = env(bandpass(noise(0.05), f, 1.5), (t) => Math.exp(-t * 160));
  mix(b, t0, gain, pan);
};
const thump = (t0, gain = 0.6, f = 70) => {
  const b = env(tone(0.5, f, { glideTo: f * 0.55 }), (t) => Math.min(1, t / 0.004) * Math.exp(-t * 9));
  mix(b, t0, gain);
};
const ambience = (t0, dur, fc, gain, q = 0.7, fade = 0.6, pan = 0) => {
  const b = env(bandpass(noise(dur), fc, q), (t, d) => smooth(0, fade, t) * (1 - smooth(d - fade, d, t)));
  mix(b, t0, gain, pan);
};

// 0:00 control room tone, button click and power-up swell
ambience(0, 4.0, 200, 0.12, 0.5, 0.3);
click(1.95, 0.7, 1800);
thump(1.97, 0.35, 110);
{
  const b = env(tone(1.4, 220, { glideTo: 660 }), (t, d) => smooth(0, 0.3, t) * (1 - smooth(0.6, d, t)));
  lowpass(b, 1200);
  mix(b, 2.05, 0.18);
}
// 0:04 typing: one key click per character
{
  const { start, typeEnd, text } = CODE_LINE;
  for (let i = 1; i <= text.length; i++) {
    const t = start + ((typeEnd - start) * i) / text.length + (rnd() - 0.5) * 0.012;
    click(t, 0.25 + rnd() * 0.1, 3000 + rnd() * 1500, (rnd() - 0.5) * 0.3);
  }
  ambience(4.0, 3.0, 90, 0.08, 0.5, 0.3);
}
// 0:07 industrial hum that steps down as each stack stops
{
  const stops = [0.9, 1.6, 2.2, 2.8, 3.4, 4.0].map((x) => x + 7);
  const dur = 5.4;
  const hum = tone(dur, 55, { type: 'warm' });
  const rumble = lowpass(noise(dur), 160);
  for (let i = 0; i < hum.length; i++) {
    const t = 7 + i / SR;
    const live = stops.filter((s) => t < s).length / stops.length;
    const g = smooth(7, 7.35, t) * (0.25 + 0.75 * live) * (1 - smooth(11.6, 12.2, t));
    hum[i] = (hum[i] * 0.25 + rumble[i] * 1.6) * g;
  }
  mix(hum, 7, 0.35);
  stops.forEach((s, i) => thump(s, 0.28, 60 + i * 4));
}
// 0:12 highway: wind and distant city, then the dead START button (click, no engine)
ambience(12, 5, 400, 0.08, 0.4, 0.5);
ambience(12, 2.7, 1200, 0.025, 0.6, 0.4, -0.3);
click(15.15, 0.55, 1500, 0.2);
click(15.95, 0.55, 1500, 0.2);
click(15.17, 0.15, 5000, 0.2);
// 0:17 airport murmur + split-flap clatter per row
ambience(17, 5, 650, 0.12, 0.9, 0.5);
for (let r = 0; r < 8; r++) {
  const t0 = 17 + 0.55 + r * 0.36;
  for (let k = 0; k < 9; k++) click(t0 + k * 0.032 + rnd() * 0.01, 0.22, 3200 + rnd() * 800, -0.2 + r * 0.05);
}
// 0:22 plant hum, then power-down sweep, then the quiet of space
{
  const dur = 2.2;
  const b = tone(dur, 100, { type: 'warm', glideTo: 25 });
  env(b, (t, d) => smooth(0, 0.2, t) * (1 - smooth(0.6, d, t)));
  lowpass(b, 900);
  mix(b, 23.0, 0.35);
  ambience(22, 1.3, 180, 0.18, 0.6, 0.2);
  [23.0, 23.35, 23.7].forEach((t) => thump(t, 0.25, 50));
  ambience(25, 3, 120, 0.05, 0.4, 0.8);
}
// 0:28 night wind and a few crickets
ambience(28, 6, 500, 0.05, 0.3, 0.8);
for (let t = 28.3; t < 33.5; t += 0.7 + rnd() * 0.6) {
  for (let k = 0; k < 3; k++) {
    const b = env(tone(0.03, 4200 + rnd() * 300), (x) => Math.sin(Math.PI * x / 0.03));
    mix(b, t + k * 0.05, 0.035, 0.6);
  }
}
// 0:34 running footsteps, then the bolts slam and the panel refuses
for (let w = 0; w < 4; w++) {
  let t = 34 + w * 0.12;
  let rate = 2.6;
  while (t < 36.9) {
    const b = env(lowpass(noise(0.08), 900 + rnd() * 300), (x) => Math.exp(-x * 45));
    mix(b, t, 0.3 * (1 - smooth(36.4, 36.9, t)), -0.4 + w * 0.25);
    rate = Math.min(3.4, rate + 0.12);
    t += 1 / rate + (rnd() - 0.5) * 0.02;
  }
}
click(37.55, 0.5, 2000, 0.1);
{
  thump(37.72, 0.9, 55);
  const clank = env(bandpass(noise(0.6), 900, 4), (t) => Math.exp(-t * 7));
  mix(clank, 37.72, 0.6);
  for (const f of [523, 829, 1140]) {
    const ring = env(tone(1.2, f), (t) => Math.exp(-t * 4));
    mix(ring, 37.72, 0.05);
  }
  for (const t of [37.82, 38.12]) mix(env(tone(0.16, 330, { type: 'warm' }), (x, d) => smooth(0, 0.01, x) * (1 - smooth(d - 0.02, d, x))), t, 0.15);
  click(38.7, 0.45, 2000, 0.1);
  mix(env(tone(0.16, 330, { type: 'warm' }), (x, d) => smooth(0, 0.01, x) * (1 - smooth(d - 0.02, d, x))), 38.85, 0.15);
}
// 0:40 the chart: a soft descending blip as each bar vanishes, a low hit on the last one
[0.9, 1.6, 2.3, 3.0, 3.7].forEach((x, i) => {
  const b = env(tone(0.35, 880 - i * 90, { glideTo: 440 - i * 45 }), (t) => Math.min(1, t / 0.005) * Math.exp(-t * 10));
  mix(b, 40 + x, 0.12, -0.3 + i * 0.15);
});
thump(44.0, 0.5, 45);
// 0:46 crowd murmur fading as we pull away; whoosh into the cut
ambience(46, 3.3, 700, 0.14, 1.2, 0.3);
ambience(46, 3.3, 1100, 0.06, 1.5, 0.3, 0.3);
{
  const b = env(highpass(noise(5), 300), (t, d) => smooth(0, d, t) ** 3);
  lowpass(b, 3000);
  mix(b, 46, 0.12);
}
// 0:54 wind over the empty fields, then the store's fluorescent hum and slow footsteps
ambience(54, 3.2, 350, 0.08, 0.4, 0.5);
{
  const b = env(tone(3.0, 120, { type: 'warm' }), (t, d) => smooth(0, 0.3, t) * (1 - smooth(d - 0.4, d, t)));
  mix(b, 57, 0.04);
  for (let t = 57.2; t < 59.9; t += 0.6) {
    const s = env(lowpass(noise(0.07), 1200), (x) => Math.exp(-x * 50));
    mix(s, t, 0.12, -0.1);
  }
}

// ---- Mix, master, and the silent beat --------------------------------------------------------
for (let i = 0; i < N; i++) {
  L[i] += music.L[i] * 0.9;
  R[i] += music.R[i] * 0.9;
}
// Gentle reverb (feedback combs) to glue everything together.
function reverb(x) {
  const y = new Float32Array(x.length);
  const delays = [1557, 1617, 1491, 1422].map((d) => d * 1.2);
  for (const d of delays) {
    const buf = new Float32Array(Math.round(d));
    let k = 0;
    let lp = 0;
    for (let i = 0; i < x.length; i++) {
      const out = buf[k];
      lp = lp + 0.3 * (out - lp);
      buf[k] = x[i] + lp * 0.78;
      y[i] += out * 0.18;
      k = (k + 1) % buf.length;
    }
  }
  return y;
}
const rl = reverb(L);
const rr = reverb(R);
for (let i = 0; i < N; i++) {
  L[i] += rl[i] * 0.35;
  R[i] += rr[i] * 0.35;
}
// Soft limiter + normalise to -1 dBFS peak.
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 1.2);
  R[i] = Math.tanh(R[i] * 1.2);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak;
// "Us." (0:51-0:54): a 15 ms fade-out into exact zeros, then a 15 ms fade-in after.
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
console.log(`wrote out/audio.wav (${DURATION}s, peak normalised from ${peak.toFixed(3)})`);
