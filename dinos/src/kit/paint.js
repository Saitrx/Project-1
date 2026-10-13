// Drawing kit: layers (offscreen canvases in local design units), smooth paths and tubes, and the
// hand-made textures from the reference: hatching, stipple, scribble, fur, scales, glossy
// highlights, plus paper grain. Everything that is random takes a seeded rng.
import { makeRng, makeNoise, rgba, mix, shade, hex, clamp, lerp, TAU } from './util.js';

export const INK = '#2e2219';
export const CREAM = '#f3e6c8';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// An offscreen drawing surface in local units: local (0,0) sits at (ox, oy) inside a w x h box,
// rendered at `res` device pixels per unit.
export class Layer {
  constructor(w, h, res, ox = 0, oy = 0) {
    Object.assign(this, { w, h, res, ox, oy });
    this.c = canvas(w * res, h * res);
    this.g = this.c.getContext('2d', { willReadFrequently: true });
    this.reset();
  }
  reset() {
    this.g.setTransform(this.res, 0, 0, this.res, this.ox * this.res, this.oy * this.res);
    this.g.globalAlpha = 1;
    this.g.globalCompositeOperation = 'source-over';
    this.g.filter = 'none';
    this.g.lineCap = 'round';
    this.g.lineJoin = 'round';
    this.g.imageSmoothingQuality = 'high';
    return this.g;
  }
  blank() {
    return new Layer(this.w, this.h, this.res, this.ox, this.oy);
  }
  // Local-unit bounding box.
  get box() {
    return { x: -this.ox, y: -this.oy, w: this.w, h: this.h };
  }
  // Composite another same-geometry layer onto this one.
  put(other, op = 'source-over', alpha = 1) {
    const g = this.g;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = op;
    g.globalAlpha = alpha;
    g.drawImage(other.c, 0, 0);
    g.restore();
  }
}

// Draw a layer as a sprite: its local origin lands at (x, y), rotated and scaled about it.
export function drawLayer(g, L, x = 0, y = 0, rot = 0, sx = 1, sy = sx, alpha = 1) {
  if (alpha <= 0) return;
  g.save();
  g.translate(x, y);
  if (rot) g.rotate(rot);
  if (sx !== 1 || sy !== 1) g.scale(sx, sy);
  if (alpha < 1) g.globalAlpha *= alpha;
  g.drawImage(L.c, -L.ox, -L.oy, L.w, L.h);
  g.restore();
}

// ---------- paths ----------

// Catmull-Rom spline through points as a Path2D (closed or open).
export function smoothPath(pts, closed = true, path = new Path2D(), k = 1 / 6) {
  const n = pts.length;
  if (n < 2) return path;
  const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  path.moveTo(pts[0][0], pts[0][1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1);
    const p1 = P(i);
    const p2 = P(i + 1);
    const p3 = P(i + 2);
    path.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  if (closed) path.closePath();
  return path;
}

export function polyPath(pts, closed = true, path = new Path2D()) {
  pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
  if (closed) path.closePath();
  return path;
}

// Sample a Catmull-Rom curve through `pts` into `n` points (with tangents).
export function sampleSpline(pts, n) {
  const out = [];
  const m = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * m;
    const s = Math.min(m - 1, Math.floor(u));
    const t = u - s;
    const p0 = pts[Math.max(0, s - 1)];
    const p1 = pts[s];
    const p2 = pts[s + 1];
    const p3 = pts[Math.min(m, s + 2)];
    const t2 = t * t;
    const t3 = t2 * t;
    const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    const df = (a, b, c, d) => 0.5 * (-a + c + 2 * (2 * a - 5 * b + 4 * c - d) * t + 3 * (-a + 3 * b - 3 * c + d) * t2);
    const x = f(p0[0], p1[0], p2[0], p3[0]);
    const y = f(p0[1], p1[1], p2[1], p3[1]);
    let dx = df(p0[0], p1[0], p2[0], p3[0]);
    let dy = df(p0[1], p1[1], p2[1], p3[1]);
    const l = Math.hypot(dx, dy) || 1;
    out.push({ x, y, tx: dx / l, ty: dy / l, u: i / (n - 1) });
  }
  return out;
}

// Outline polygon of a tube along a spine. r(u) returns [left, right] radii (left = side of the
// normal (-ty, tx), which is "up" for a spine running left-to-right).
export function tube(spine, r, n = 48, caps = true) {
  const S = sampleSpline(spine, n);
  const L = [];
  const R = [];
  for (const s of S) {
    const [rl, rr] = r(s.u);
    L.push([s.x - s.ty * rl, s.y + s.tx * rl]);
    R.push([s.x + s.ty * rr, s.y - s.tx * rr]);
  }
  const pts = [...L];
  if (caps) {
    const e = S[S.length - 1];
    const [rl, rr] = r(1);
    for (let k = 1; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      const rad = lerp(rl, rr, k / 6);
      pts.push([e.x + (-e.ty * Math.cos(a) + e.tx * Math.sin(a)) * rad, e.y + (e.tx * Math.cos(a) + e.ty * Math.sin(a)) * rad]);
    }
  }
  pts.push(...R.reverse());
  if (caps) {
    const b = S[0];
    const [rl, rr] = r(0);
    for (let k = 1; k < 6; k++) {
      const a = (k / 6) * Math.PI;
      const rad = lerp(rr, rl, k / 6);
      pts.push([b.x + (b.ty * Math.cos(a) - b.tx * Math.sin(a)) * rad, b.y + (-b.tx * Math.cos(a) - b.ty * Math.sin(a)) * rad]);
    }
  }
  return pts;
}

// Hit testing in local units (an identity-transform context, so the path is not transformed).
const hitCtx = canvas(1, 1).getContext('2d');
export const inside = (path, x, y) => hitCtx.isPointInPath(path, x, y);

export function bounds(pts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ---------- textures ----------

// Parallel hatch lines over a box at `angle`, each line broken into pieces with varying opacity.
export function hatch(g, box, { angle = -0.8, spacing = 3, width = 0.5, color = INK, alpha = 0.35, seed = 1, broken = 0.25, jitter = 0.4 } = {}) {
  const rng = makeRng(seed);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const R = Math.hypot(box.w, box.h) / 2 + 4;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  g.save();
  g.lineWidth = width;
  g.lineCap = 'round';
  const groups = [new Path2D(), new Path2D(), new Path2D()];
  for (let d = -R; d <= R; d += spacing * rng.range(0.8, 1.2)) {
    let s = -R;
    while (s < R) {
      const len = rng.range(R * 0.15, R * 0.8);
      const off = d + rng.range(-jitter, jitter);
      const x0 = cx + ca * s - sa * off;
      const y0 = cy + sa * s + ca * off;
      const e = Math.min(R, s + len);
      const p = groups[rng.int(0, 2)];
      p.moveTo(x0, y0);
      p.lineTo(cx + ca * e - sa * (off + rng.range(-jitter, jitter)), cy + sa * e + ca * (off + rng.range(-jitter, jitter)));
      s = e + (rng.chance(broken) ? rng.range(2, 10) * spacing : rng.range(0.5, 2));
    }
  }
  groups.forEach((p, i) => {
    g.strokeStyle = rgba(color, alpha * [0.55, 0.8, 1][i]);
    g.stroke(p);
  });
  g.restore();
}

// Random clusters of short parallel strokes (the reference's "scribble" texture on surfaces).
export function scribble(g, path, box, { count = 60, len = [6, 18], lines = [3, 6], gap = 1.4, width = 0.45, color = INK, alpha = 0.25, seed = 2, angle = null } = {}) {
  const rng = makeRng(seed);
  g.save();
  if (path) g.clip(path);
  g.lineWidth = width;
  g.strokeStyle = rgba(color, alpha);
  const p = new Path2D();
  for (let i = 0; i < count; i++) {
    const x = box.x + rng.next() * box.w;
    const y = box.y + rng.next() * box.h;
    const a = angle === null ? rng.range(0, Math.PI) : angle + rng.range(-0.25, 0.25);
    const L = rng.range(len[0], len[1]);
    const k = rng.int(lines[0], lines[1]);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (let j = 0; j < k; j++) {
      const o = (j - k / 2) * gap;
      const l2 = L * rng.range(0.6, 1);
      p.moveTo(x - sa * o - (ca * l2) / 2, y + ca * o - (sa * l2) / 2);
      p.lineTo(x - sa * o + (ca * l2) / 2, y + ca * o + (sa * l2) / 2);
    }
  }
  g.stroke(p);
  g.restore();
}

// Stipple dots inside a path. density(x, y) in 0..1 thins them out (e.g. only in shadow).
export function stipple(g, path, box, { count = 400, r = [0.3, 0.8], color = INK, alpha = 0.5, seed = 3, density = null } = {}) {
  const rng = makeRng(seed);
  g.save();
  g.fillStyle = rgba(color, alpha);
  const p = new Path2D();
  for (let i = 0; i < count; i++) {
    const x = box.x + rng.next() * box.w;
    const y = box.y + rng.next() * box.h;
    const keep = rng.next();
    if (path && !inside(path, x, y)) continue;
    if (density && keep > density(x, y)) continue;
    const rr = rng.range(r[0], r[1]);
    p.moveTo(x + rr, y);
    p.arc(x, y, rr, 0, TAU);
  }
  g.fill(p);
  g.restore();
}

// Soft mottling: big faint blotches of lighter and darker tone, clipped to a path.
export function mottle(g, path, box, { base, count = 40, size = [20, 60], amount = 0.12, seed = 4 } = {}) {
  const rng = makeRng(seed);
  g.save();
  if (path) g.clip(path);
  for (let i = 0; i < count; i++) {
    const x = box.x + rng.next() * box.w;
    const y = box.y + rng.next() * box.h;
    const r = rng.range(size[0], size[1]);
    const k = rng.range(-1, 1) * amount;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const c = shade(base, k);
    grd.addColorStop(0, rgba(c, 0.5));
    grd.addColorStop(1, rgba(c, 0));
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  g.restore();
}

// Shadow mask on a layer: the part of `path` NOT covered by the same path shifted toward the light
// by (lx, ly), softened with a blur. Returns a new layer whose alpha is the shadow amount.
export function shadowMask(L, path, { lx = -6, ly = -8, blur = 6, spread = 0 } = {}) {
  const M = L.blank();
  M.g.fillStyle = '#000';
  M.g.fill(path);
  // The shifted copy is drawn unfiltered first, then blurred as an image with an identity transform
  // (Chrome clips filtered path fills to their untransformed bounds).
  const T = L.blank();
  T.g.translate(lx, ly);
  T.g.fillStyle = '#000';
  if (spread) {
    T.g.lineWidth = spread;
    T.g.strokeStyle = '#000';
    T.g.stroke(path);
  }
  T.g.fill(path);
  const g = M.g;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  if (blur > 0) g.filter = `blur(${blur * L.res}px)`;
  g.drawImage(T.c, 0, 0);
  g.restore();
  M.reset();
  return M;
}

// Night side of a sphere of radius R centred on the local origin: the region beyond the
// terminator, a half-ellipse of half-width k*R (k > 0 gibbous, k < 0 crescent). `angle` points from
// the centre toward the dark side.
export function terminatorMask(L, R, angle, k, blur = 0) {
  const T = L.blank();
  const g = T.g;
  g.rotate(angle);
  g.beginPath();
  g.moveTo(0, -R);
  g.arc(0, 0, R, -Math.PI / 2, Math.PI / 2);
  if (k >= 0) g.ellipse(0, 0, Math.max(0.001, k * R), R, 0, Math.PI / 2, -Math.PI / 2, true);
  else g.ellipse(0, 0, -k * R, R, 0, Math.PI / 2, (3 * Math.PI) / 2, false);
  g.closePath();
  g.fillStyle = '#000';
  g.fill();
  if (!blur) {
    T.reset();
    return T;
  }
  const M = L.blank();
  M.g.save();
  M.g.setTransform(1, 0, 0, 1, 0, 0);
  M.g.filter = `blur(${blur * L.res}px)`;
  M.g.drawImage(T.c, 0, 0);
  M.g.restore();
  // keep the mask inside the disc
  const D = L.blank();
  D.g.beginPath();
  D.g.arc(0, 0, R, 0, Math.PI * 2);
  D.g.fill();
  M.put(D, 'destination-in');
  return M;
}

// Paint `color` through a mask layer (alpha) onto L, multiplied by alpha.
export function tintThrough(L, M, color, alpha = 1, op = 'source-atop') {
  const T = M.blank();
  T.put(M);
  const g = T.g;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = rgba(color, 1);
  g.fillRect(0, 0, T.c.width, T.c.height);
  g.restore();
  L.put(T, op, alpha);
}

// Hatch lines that only show where the mask is (shadow hatching).
export function hatchThrough(L, M, opts) {
  const H = L.blank();
  hatch(H.g, L.box, opts);
  H.put(M, 'destination-in');
  L.put(H, 'source-atop');
}

// The full "illustrated shape" recipe: flat fill, mottling, shadow tone + hatching on the side away
// from the light, optional cross-hatch in the deepest shadow, soft highlight, and an ink outline.
export function paintShape(L, path, o) {
  const g = L.g;
  const box = o.box ?? L.box;
  g.save();
  g.fillStyle = rgba(o.fill);
  g.fill(path);
  g.restore();
  if (o.mottle !== false) mottle(g, path, box, { base: o.fill, count: o.mottleCount ?? 30, size: o.mottleSize ?? [box.w * 0.08, box.w * 0.25], amount: o.mottleAmount ?? 0.1, seed: (o.seed ?? 1) + 11 });
  if (o.before) o.before(L);
  const light = o.light ?? [-1, -1.2];
  const ln = Math.hypot(light[0], light[1]);
  const d = o.shadowDepth ?? Math.min(box.w, box.h) * 0.22;
  const M = shadowMask(L, path, { lx: (light[0] / ln) * d, ly: (light[1] / ln) * d, blur: o.shadowBlur ?? d * 0.45 });
  tintThrough(L, M, o.shadow ?? shade(o.fill, -0.35), o.shadowAlpha ?? 0.6);
  if (o.hatch !== false) hatchThrough(L, M, { angle: o.hatchAngle ?? -0.9, spacing: o.hatchSpacing ?? 2.6, width: o.hatchWidth ?? 0.45, color: o.ink ?? INK, alpha: o.hatchAlpha ?? 0.45, seed: (o.seed ?? 1) + 5 });
  if (o.cross) {
    const M2 = shadowMask(L, path, { lx: (light[0] / ln) * d * 2.2, ly: (light[1] / ln) * d * 2.2, blur: d * 0.5 });
    const M3 = M.blank();
    M3.put(M);
    M3.put(M2, 'destination-out');
    const Mi = M.blank();
    Mi.put(M);
    Mi.put(M3, 'destination-out');
    hatchThrough(L, Mi, { angle: (o.hatchAngle ?? -0.9) + 1.3, spacing: (o.hatchSpacing ?? 2.6) * 1.2, width: o.hatchWidth ?? 0.45, color: o.ink ?? INK, alpha: (o.hatchAlpha ?? 0.45) * 0.8, seed: (o.seed ?? 1) + 7 });
  }
  if (o.highlight !== false) {
    const Hm = shadowMask(L, path, { lx: (-light[0] / ln) * d * 0.7, ly: (-light[1] / ln) * d * 0.7, blur: d * 0.5 });
    tintThrough(L, Hm, o.light2 ?? shade(o.fill, 0.35), o.highlightAlpha ?? 0.35);
  }
  if (o.after) o.after(L);
  if (o.outline !== false) {
    g.save();
    g.strokeStyle = rgba(o.ink ?? INK, o.outlineAlpha ?? 0.95);
    g.lineWidth = o.outline ?? 1.1;
    g.stroke(path);
    g.restore();
  }
}

// Fur: many short strokes from inside the shape outward along dir(x, y) (radians), layered dark to
// light so the top layer reads as the light tips. Edge strokes poke past the silhouette.
export function fur(g, path, box, { count = 3000, len = [3, 8], width = 0.45, dir, colors, seed = 5, curl = 0.25, lenFn = null } = {}) {
  const rng = makeRng(seed);
  const nCol = colors.length;
  const groups = colors.map(() => new Path2D());
  let made = 0;
  for (let tries = 0; made < count && tries < count * 6; tries++) {
    const x = box.x + rng.next() * box.w;
    const y = box.y + rng.next() * box.h;
    if (!inside(path, x, y)) continue;
    made++;
    const a = dir(x, y) + rng.range(-0.35, 0.35);
    const L = rng.range(len[0], len[1]) * (lenFn ? lenFn(x, y) : 1);
    const bend = rng.range(-curl, curl);
    const ex = x + Math.cos(a) * L;
    const ey = y + Math.sin(a) * L;
    const mx = (x + ex) / 2 - Math.sin(a) * L * bend;
    const my = (y + ey) / 2 + Math.cos(a) * L * bend;
    const layer = Math.min(nCol - 1, Math.floor((made / count) * nCol + rng.range(-0.6, 0.6)));
    const p = groups[Math.max(0, layer)];
    p.moveTo(x, y);
    p.quadraticCurveTo(mx, my, ex, ey);
  }
  g.save();
  g.lineCap = 'round';
  groups.forEach((p, i) => {
    g.strokeStyle = rgba(colors[i]);
    g.lineWidth = width * (1 - (i / nCol) * 0.35);
    g.stroke(p);
  });
  g.restore();
}

// Reptile scales: a jittered grid of small rounded tiles, drawn row by row so each overlaps the
// one above; each gets a slight tone change and a dark crescent on its lower edge.
export function scales(g, path, box, { size = 4, base, seed = 6, rows = 'down', sizeFn = null, contrast = 1, light = [-0.6, -0.8], ink = INK, highlight = true } = {}) {
  const rng = makeRng(seed);
  const noise = makeNoise(seed);
  g.save();
  g.clip(path);
  const dy = size * 0.78;
  const fills = [];
  const rims = new Path2D();
  const glints = new Path2D();
  for (let y = box.y - size; y < box.y + box.h + size; y += dy) {
    const row = Math.round((y - box.y) / dy);
    for (let x = box.x - size + (row % 2) * size * 0.5; x < box.x + box.w + size; x += size) {
      const s = size * (sizeFn ? sizeFn(x, y) : 1) * rng.range(0.85, 1.12);
      const cx = x + rng.range(-0.18, 0.18) * size;
      const cy = y + rng.range(-0.15, 0.15) * size;
      if (!inside(path, cx, cy) && !inside(path, cx, cy - s * 0.5)) continue;
      const k = (noise.fbm(cx / (size * 6), cy / (size * 6)) - 0.5) * 0.5 * contrast + rng.range(-0.08, 0.08) * contrast;
      const c = shade(base, k);
      const pts = [];
      const nv = 7;
      for (let v = 0; v < nv; v++) {
        const a = (v / nv) * TAU + rng.range(-0.2, 0.2);
        const r = s * 0.55 * rng.range(0.85, 1.05);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8]);
      }
      fills.push([c, pts]);
      // dark rim along the lower edge (the overlap shadow)
      rims.moveTo(cx - s * 0.5, cy + s * 0.05);
      rims.quadraticCurveTo(cx, cy + s * 0.62, cx + s * 0.5, cy + s * 0.05);
      if (highlight && rng.chance(0.35)) {
        glints.moveTo(cx + light[0] * s * 0.2 - s * 0.12, cy + light[1] * s * 0.2);
        glints.lineTo(cx + light[0] * s * 0.2 + s * 0.08, cy + light[1] * s * 0.2 - s * 0.06);
      }
    }
  }
  for (const [c, pts] of fills) {
    g.fillStyle = rgba(c);
    g.fill(smoothPath(pts, true));
  }
  g.lineWidth = size * 0.11;
  g.strokeStyle = rgba(ink, 0.55 * contrast);
  g.stroke(rims);
  g.lineWidth = size * 0.07;
  g.strokeStyle = rgba('#fff6e0', 0.35);
  g.stroke(glints);
  g.restore();
}

// Glossy eye or bead: dark ball with a white arc highlight and a small dot, like the reference.
export function glossyBall(g, x, y, r, { color = '#1d1410', ring = null, arc = true } = {}) {
  g.save();
  const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grd.addColorStop(0, rgba(shade(color, 0.25)));
  grd.addColorStop(1, rgba(color));
  g.fillStyle = grd;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  if (ring) {
    g.strokeStyle = rgba(ring);
    g.lineWidth = r * 0.12;
    g.stroke();
  }
  if (arc) {
    g.strokeStyle = 'rgba(255,252,240,0.85)';
    g.lineWidth = Math.max(0.3, r * 0.1);
    g.beginPath();
    g.arc(x, y, r * 0.72, Math.PI * 1.05, Math.PI * 1.45);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,250,0.95)';
  g.beginPath();
  g.arc(x - r * 0.32, y - r * 0.38, r * 0.16, 0, TAU);
  g.fill();
  g.restore();
}

// Storybook cloud: overlapping puffs with a flat base, light tops, a soft grey underside and a
// faint ink outline.
export function cloud(g, x, y, w, seed = 1, { color = '#fbf6ea', shadow = '#cfd2cc', ink = 0.25 } = {}) {
  const rng = makeRng(seed);
  const n = 5 + Math.floor(w / 60);
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const r = w * (0.11 + 0.16 * Math.sin(Math.PI * u)) * rng.range(0.8, 1.15);
    puffs.push([x - w / 2 + u * w, y - r * rng.range(0.35, 0.75), r]);
  }
  const p = new Path2D();
  for (const [px, py, r] of puffs) {
    p.moveTo(px + r, py);
    p.arc(px, py, r, 0, Math.PI * 2);
  }
  g.save();
  g.beginPath();
  g.rect(x - w, y - w, w * 2, w);
  g.clip();
  // outline first (doubled width) so the fills cover the inner arcs, leaving only the silhouette
  g.strokeStyle = `rgba(80,80,80,${ink})`;
  g.lineWidth = 1.6;
  g.stroke(p);
  g.fillStyle = shadow;
  g.fill(p);
  g.save();
  g.translate(-w * 0.015, -w * 0.035);
  g.fillStyle = color;
  g.fill(p);
  g.restore();
  g.restore();
  g.strokeStyle = `rgba(80,80,80,${ink})`;
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(x - w * 0.47, y);
  g.lineTo(x + w * 0.47, y);
  g.stroke();
}

// ---------- paper ----------

// Screen-space paper grain: fine light/dark speckle plus faint blotchy tone, as an overlay canvas.
export function paperGrain(W, H, seed = 9) {
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  let s = seed >>> 0;
  for (let i = 0; i < W * H; i++) {
    s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    const v = (s & 0xffff) / 65535;
    const o = i * 4;
    if (v < 0.035) {
      d[o] = 60;
      d[o + 1] = 40;
      d[o + 2] = 25;
      d[o + 3] = 28 + ((s >>> 16) & 31);
    } else if (v > 0.975) {
      d[o] = 255;
      d[o + 1] = 248;
      d[o + 2] = 230;
      d[o + 3] = 22 + ((s >>> 16) & 23);
    }
  }
  g.putImageData(img, 0, 0);
  // Blotchy tone from smooth noise at low resolution, scaled up.
  const lw = Math.ceil(W / 24);
  const lh = Math.ceil(H / 24);
  const low = canvas(lw, lh);
  const lg = low.getContext('2d');
  const li = lg.createImageData(lw, lh);
  const nz = makeNoise(seed + 1);
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const n = nz.fbm(x / 9, y / 9, 4);
      const o = (y * lw + x) * 4;
      const dark = n < 0.5;
      li.data[o] = dark ? 70 : 255;
      li.data[o + 1] = dark ? 50 : 246;
      li.data[o + 2] = dark ? 30 : 225;
      li.data[o + 3] = Math.abs(n - 0.5) * 2 * 13;
    }
  }
  lg.putImageData(li, 0, 0);
  g.imageSmoothingQuality = 'high';
  g.drawImage(low, 0, 0, W, H);
  return c;
}

// ---------- line art ----------

// Polyline length helpers for draw-on animation.
export function polyLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// Stroke the first `f` (0..1) of a polyline.
export function strokePartial(g, pts, f, closed = false) {
  if (f <= 0 || pts.length < 2) return;
  const all = closed ? [...pts, pts[0]] : pts;
  const total = polyLength(all);
  let left = total * Math.min(1, f);
  g.beginPath();
  g.moveTo(all[0][0], all[0][1]);
  for (let i = 1; i < all.length && left > 0; i++) {
    const [x0, y0] = all[i - 1];
    const [x1, y1] = all[i];
    const l = Math.hypot(x1 - x0, y1 - y0);
    if (l <= left) {
      g.lineTo(x1, y1);
      left -= l;
    } else {
      const t = left / l;
      g.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      left = 0;
    }
  }
  g.stroke();
}

// The reference's little 4-point construction sparkle.
export function sparkle(g, x, y, s, color = '#c9cbff', alpha = 1) {
  g.save();
  g.strokeStyle = rgba(color, alpha);
  g.lineWidth = s * 0.12;
  g.beginPath();
  g.moveTo(x - s, y);
  g.lineTo(x + s, y);
  g.moveTo(x, y - s);
  g.lineTo(x, y + s);
  g.stroke();
  g.lineWidth = s * 0.08;
  g.beginPath();
  g.moveTo(x - s * 0.45, y - s * 0.45);
  g.lineTo(x + s * 0.45, y + s * 0.45);
  g.moveTo(x - s * 0.45, y + s * 0.45);
  g.lineTo(x + s * 0.45, y - s * 0.45);
  g.stroke();
  g.restore();
}

export { rgba, mix, shade, hex, clamp };
