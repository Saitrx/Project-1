// Shared scenery: film-style soft skies and hazy hill layers, stroke-grass meadows, storybook trees,
// clouds, sunbeams and dust motes. Every textured piece is drawn once into a Layer (seeded), then
// placed per frame.
import { Layer, drawLayer, smoothPath, hatch, stipple, mottle, cloud, INK } from './paint.js';
import { makeRng, makeNoise, rgba, mix, shade, clamp, lerp, TAU, wobble } from './util.js';

// Vertical gradient sky with an optional warm glow (sun) — big soft gradient, film style.
export function sky(g, x, y, w, h, stops, glow = null) {
  const grd = g.createLinearGradient(0, y, 0, y + h);
  stops.forEach(([o, c]) => grd.addColorStop(o, c));
  g.fillStyle = grd;
  g.fillRect(x, y, w, h);
  if (glow) {
    const [gx, gy, gr, gc, ga] = glow;
    const rg = g.createRadialGradient(gx, gy, 0, gx, gy, gr);
    rg.addColorStop(0, rgba(gc, ga));
    rg.addColorStop(0.4, rgba(gc, ga * 0.35));
    rg.addColorStop(1, rgba(gc, 0));
    g.fillStyle = rg;
    g.fillRect(x, y, w, h);
  }
}

// A hazy hill silhouette band drawn into a layer: smooth noise ridge, gradient fill toward the haze
// colour at its base, optional tree bumps along the ridge.
export function hillLayer(res, { w = 1600, y0 = 0, amp = 60, freq = 1.4, color, haze, seed = 1, trees = 0, treeColor = null, h = 600 }) {
  const L = new Layer(w, h, res, w / 2, 0);
  const g = L.g;
  const nz = makeNoise(seed);
  const rng = makeRng(seed + 5);
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const x = -w / 2 + (i / 64) * w;
    pts.push([x, y0 - amp * (nz.fbm(i / 64 * freq * 4 + seed, seed * 0.37, 3) - 0.3) * 2]);
  }
  const p = new Path2D();
  p.moveTo(-w / 2, h);
  pts.forEach(([x, y]) => p.lineTo(x, y));
  p.lineTo(w / 2, h);
  p.closePath();
  const grd = g.createLinearGradient(0, y0 - amp, 0, h);
  grd.addColorStop(0, color);
  grd.addColorStop(1, haze);
  g.fillStyle = grd;
  g.fill(p);
  if (trees) {
    g.fillStyle = treeColor ?? color;
    for (let i = 0; i < trees; i++) {
      const x = -w / 2 + rng.next() * w;
      const k = Math.round(((x + w / 2) / w) * 64);
      const y = pts[clamp(k, 0, 64)][1];
      const s = rng.range(8, 20);
      if (rng.chance(0.5)) {
        // round tree
        g.beginPath();
        g.ellipse(x, y - s * 0.9, s * 0.8, s, 0, 0, TAU);
        g.fill();
      } else {
        // pine
        g.beginPath();
        g.moveTo(x, y - s * 2.4);
        g.lineTo(x + s * 0.7, y + 2);
        g.lineTo(x - s * 0.7, y + 2);
        g.closePath();
        g.fill();
      }
    }
  }
  return L;
}

// Meadow ground: gradient base + mottling + thousands of grass strokes (dark root, light tip),
// larger toward the bottom (closer). Returns a layer covering [x0..x0+w] x [y0..y0+h].
export function meadowLayer(res, { x0 = -300, y0 = 1100, w = 1700, h = 1000, base = '#a9c27a', far = '#c9d6a0', dark = '#5f7d3c', light = '#e3e8b8', seed = 11, density = 1 } = {}) {
  const L = new Layer(w, h, res, -x0, -y0);
  const g = L.g;
  const grd = g.createLinearGradient(0, y0, 0, y0 + h);
  grd.addColorStop(0, far);
  grd.addColorStop(0.35, base);
  grd.addColorStop(1, rgba(shade(base, -0.12)));
  g.fillStyle = grd;
  g.fillRect(x0, y0, w, h);
  mottle(g, null, { x: x0, y: y0, w, h }, { base, count: 70, size: [60, 180], amount: 0.1, seed: seed + 1 });
  const rng = makeRng(seed);
  const n = Math.round(14000 * density * (w * h) / (1700 * 1000));
  const groups = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const cols = [shade(dark, -0.1), dark, mix(base, light, 0.35), light];
  for (let i = 0; i < n; i++) {
    const v = Math.pow(rng.next(), 0.8);
    const y = y0 + v * h;
    const x = x0 + rng.next() * w;
    const depth = (y - y0) / h; // 0 far .. 1 near
    const len = lerp(2.5, 16, depth) * rng.range(0.6, 1.3);
    const lean = rng.range(-0.45, 0.45);
    const k = Math.min(3, Math.floor(rng.next() * 4 + (rng.next() < 0.3 ? 0 : 0)));
    const p = groups[k];
    p.moveTo(x, y);
    p.quadraticCurveTo(x + lean * len * 0.3, y - len * 0.55, x + lean * len, y - len);
  }
  g.lineCap = 'round';
  groups.forEach((p, i) => {
    g.strokeStyle = rgba(cols[i], i < 2 ? 0.55 : 0.5);
    g.lineWidth = i < 2 ? 1.05 : 0.9;
    g.stroke(p);
  });
  stipple(g, null, { x: x0, y: y0, w, h }, { count: 2500, r: [0.5, 1.3], color: shade(dark, -0.2), alpha: 0.18, seed: seed + 3 });
  return L;
}

// Per-frame swaying foreground grass tufts along a line y (in the current frame).
export function grassTufts(g, t, { x0 = -100, x1 = 1180, y = 1900, n = 160, len = [18, 46], seed = 21, color = '#5f7d3c', tip = '#cfdc9a', wind = 1 } = {}) {
  const rng = makeRng(seed);
  g.save();
  g.lineCap = 'round';
  const dark = new Path2D();
  const lite = new Path2D();
  for (let i = 0; i < n; i++) {
    const x = lerp(x0, x1, rng.next());
    const yy = y + rng.range(-10, 14);
    const L = rng.range(len[0], len[1]);
    const ph = rng.range(0, TAU);
    const sway = (Math.sin(t * 1.7 + ph + x * 0.01) * 0.6 + Math.sin(t * 0.9 + ph * 2) * 0.4) * 0.22 * wind + rng.range(-0.3, 0.3);
    const p = rng.chance(0.6) ? dark : lite;
    p.moveTo(x, yy);
    p.quadraticCurveTo(x + sway * L * 0.25, yy - L * 0.55, x + sway * L, yy - L);
  }
  g.strokeStyle = rgba(color, 0.85);
  g.lineWidth = 2.1;
  g.stroke(dark);
  g.strokeStyle = rgba(tip, 0.8);
  g.lineWidth = 1.7;
  g.stroke(lite);
  g.restore();
}

// Storybook tree: trunk with bark hatching + canopy of overlapping leafy clusters with leaf strokes.
// Returns { trunk, canopy, top } where canopy is drawn rotated about `top` for sway.
export function treeLayers(res, { h = 420, w = 300, seed = 31, leaf = '#6f9a4c', leafDark = '#4c7436', leafLight = '#a9c779', bark = '#7a5636', autumn = 0 } = {}) {
  const rng = makeRng(seed);
  const trunk = new Layer(w * 0.5, h, res, w * 0.25, h);
  {
    const g = trunk.g;
    const p = new Path2D();
    const tw = w * 0.05;
    p.moveTo(-tw * 1.7, 0);
    p.quadraticCurveTo(-tw, -h * 0.2, -tw * 0.85, -h * 0.5);
    p.lineTo(-tw * 0.5, -h * 0.72);
    p.lineTo(tw * 0.5, -h * 0.72);
    p.lineTo(tw * 0.85, -h * 0.5);
    p.quadraticCurveTo(tw, -h * 0.2, tw * 1.8, 0);
    p.closePath();
    g.fillStyle = bark;
    g.fill(p);
    g.save();
    g.clip(p);
    hatch(g, { x: -tw * 2, y: -h, w: tw * 4, h }, { angle: Math.PI / 2 + 0.05, spacing: 2.4, width: 0.8, color: INK, alpha: 0.35, seed: seed + 1, broken: 0.5 });
    g.fillStyle = 'rgba(30,20,10,0.25)';
    g.fillRect(0, -h, tw * 3, h);
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 1.6;
    g.stroke(p);
  }
  const canopy = new Layer(w * 1.3, h * 0.95, res, w * 0.65, h * 0.75);
  {
    const g = canopy.g;
    const blobs = [];
    for (let i = 0; i < 16; i++) {
      const a = rng.range(0, TAU);
      const rr = Math.sqrt(rng.next());
      blobs.push([Math.cos(a) * rr * w * 0.34, -h * 0.28 + Math.sin(a) * rr * h * 0.26, rng.range(0.2, 0.3) * w]);
    }
    blobs.sort((a, b) => a[1] - b[1]);
    const cols = autumn ? [mix(leafDark, '#b5642d', autumn), mix(leaf, '#d08a3a', autumn), mix(leafLight, '#e8b860', autumn)] : [leafDark, leaf, leafLight];
    // outline pass then fills
    const all = new Path2D();
    for (const [x, y, r] of blobs) {
      all.moveTo(x + r, y);
      all.arc(x, y, r, 0, TAU);
    }
    g.lineWidth = 3.2;
    g.strokeStyle = INK;
    g.stroke(all);
    g.fillStyle = cols[0];
    g.fill(all);
    for (const [x, y, r] of blobs) {
      const grd = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      grd.addColorStop(0, rgba(cols[2], 0.95));
      grd.addColorStop(0.55, rgba(cols[1], 0.9));
      grd.addColorStop(1, rgba(cols[0], 0.2));
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r * 0.97, 0, TAU);
      g.fill();
    }
    // leaf strokes
    g.save();
    g.clip(all);
    const lp = [new Path2D(), new Path2D()];
    for (let i = 0; i < 1400; i++) {
      const x = rng.range(-0.55, 0.55) * w;
      const y = -h * 0.35 + rng.range(-0.5, 0.45) * h * 0.6;
      const a = rng.range(0, TAU);
      const l = rng.range(3, 7);
      const p = lp[i % 2];
      p.moveTo(x, y);
      p.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.6, y + Math.sin(a + 0.5) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    g.lineCap = 'round';
    g.strokeStyle = rgba(shade(cols[0], -0.3), 0.45);
    g.lineWidth = 1.2;
    g.stroke(lp[0]);
    g.strokeStyle = rgba(cols[2], 0.5);
    g.lineWidth = 1.1;
    g.stroke(lp[1]);
    hatch(g, { x: -w * 0.6, y: -h * 0.7, w: w * 1.2, h: h * 0.7 }, { angle: -0.8, spacing: 3.4, width: 0.8, color: INK, alpha: 0.12, seed: seed + 9, broken: 0.5 });
    g.restore();
  }
  return { trunk, canopy, h, w };
}

export function drawTree(g, T, x, y, t, { scale = 1, sway = 1, seed = 1 } = {}) {
  drawLayer(g, T.trunk, x, y, 0, scale);
  const a = (Math.sin(t * 0.9 + seed) * 0.6 + Math.sin(t * 1.7 + seed * 2) * 0.4) * 0.012 * sway;
  drawLayer(g, T.canopy, x, y - T.h * 0.75 * scale, a, scale);
}

// Cloud layer (pre-rendered) from the shared cloud() painter.
export function cloudLayer(res, w, seed, opts) {
  const L = new Layer(w * 1.2, w * 0.5, res, w * 0.6, w * 0.42);
  cloud(L.g, 0, 0, w, seed, opts);
  return L;
}

// Soft light beam (window sunlight) with floating dust motes.
export function beam(g, pts, t, { color = '#fff3cf', alpha = 0.22, motes = 40, seed = 3 } = {}) {
  g.save();
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  p.closePath();
  const [a, b] = [pts[0], pts[2]];
  const grd = g.createLinearGradient(a[0], a[1], b[0], b[1]);
  grd.addColorStop(0, rgba(color, alpha));
  grd.addColorStop(1, rgba(color, 0));
  g.fillStyle = grd;
  g.fill(p);
  g.clip(p);
  const rng = makeRng(seed);
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  for (let i = 0; i < motes; i++) {
    const px = lerp(x0, x1, rng.next()) + Math.sin(t * rng.range(0.2, 0.5) + i) * 12;
    const py = lerp(y0, y1, (rng.next() + t * rng.range(0.004, 0.012)) % 1);
    const r = rng.range(0.9, 2.2);
    g.fillStyle = `rgba(255,250,230,${rng.range(0.35, 0.8)})`;
    g.beginPath();
    g.arc(px, py, r, 0, TAU);
    g.fill();
  }
  g.restore();
}

// Vignette, film style.
export function vignette(g, W, H, amount = 0.35, color = '#2a1a10') {
  const grd = g.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  grd.addColorStop(0, rgba(color, 0));
  grd.addColorStop(1, rgba(color, amount));
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}

export { wobble };
