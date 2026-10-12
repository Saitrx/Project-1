// Seeded randomness so every frame is reproducible. Never use Math.random().

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (a, b) => a + (b - a) * r(),
    int: (a, b) => Math.floor(a + (b - a + 1) * r()),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
  };
}

// Stable hash of an integer to [0, 1).
export function hash1(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// Smooth 1D value noise, used for camera sway and handheld drift.
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash1(i * 7919 + seed * 104729);
  const b = hash1((i + 1) * 7919 + seed * 104729);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

export function fbm1(x, seed = 0, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (noise1(x * freq, seed + o * 13) * 2 - 1);
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum;
}
