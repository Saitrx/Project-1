// Small math, easing, colour and seeded-random helpers. Nothing here reads the clock.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoothstep = (a, b, x) => smooth(inv(a, b, x));
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t) => t * t * t;
export const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const TAU = Math.PI * 2;

// Piecewise-linear keyframes [[t, v], ...] with smoothstep easing between keys.
export function keys(list, t) {
  if (t <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) {
    if (t <= list[i][0]) {
      const [t0, v0] = list[i - 1];
      const [t1, v1] = list[i];
      return lerp(v0, v1, smooth((t - t0) / (t1 - t0)));
    }
  }
  return list[list.length - 1][1];
}

// Mulberry32 seeded random numbers.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => Math.floor(lo + (hi - lo + 1) * next()),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    gauss: () => {
      let u = 0;
      for (let i = 0; i < 4; i++) u += next();
      return (u - 2) / 0.577;
    },
  };
}

// Stable hash noise in [0, 1) for integer lattice coordinates.
function hash2(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth value noise and fractal sum; deterministic for a seed.
export function makeNoise(seed) {
  const n = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, seed);
    const b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed);
    const d = hash2(xi + 1, yi + 1, seed);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  const fbm = (x, y, oct = 4) => {
    let s = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      s += amp * n(x * f, y * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return s / norm;
  };
  return { n, fbm };
}

// Colours as [r, g, b] 0..255.
export function hex(h) {
  const v = parseInt(h.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgba(c, a = 1) {
  const [r, g, b] = typeof c === 'string' ? hex(c) : c;
  return `rgba(${r | 0},${g | 0},${b | 0},${a})`;
}
export function mix(c1, c2, t) {
  const a = typeof c1 === 'string' ? hex(c1) : c1;
  const b = typeof c2 === 'string' ? hex(c2) : c2;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
export function shade(c, k) {
  // k < 0 darkens toward a warm brown, k > 0 lightens toward cream.
  return k < 0 ? mix(c, '#2a1a10', -k) : mix(c, '#fbf3e0', k);
}

// Frame-rate independent smooth noise for idle motion (breathing, sway): sum of sines.
export function wobble(t, seed, freq = 1) {
  const r = makeRng(seed);
  let s = 0;
  for (let i = 0; i < 3; i++) s += Math.sin(t * freq * r.range(0.6, 1.7) * TAU + r.range(0, TAU)) / (i + 1);
  return s / 1.83;
}
