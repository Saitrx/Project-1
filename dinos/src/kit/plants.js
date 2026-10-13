// Plants drawn stroke by stroke: fern fronds (lobed pinnae with midribs and veins), cycads, conifer
// silhouettes, grass tufts and leaf litter. Each returns a Layer to be drawn as a sprite.
import { Layer, smoothPath, sampleSpline, rgba, shade, mix, INK, stipple, hatch } from './paint.js';
import { makeRng, clamp, lerp, TAU } from './util.js';

// One fern frond. Base at the local origin, growing along +x and drooping by `droop`.
export function fernFrond(res, { len = 300, droop = 0.25, seed = 1, color = '#5e8f45', dark = '#2f5a2a', light = '#a9c779', width = 0.2, pinnae = 26, ink = INK, inkAlpha = 0.8, detail = 1 } = {}) {
  const rng = makeRng(seed);
  const pad = len * (width + 0.12);
  const L = new Layer(len + pad * 2, len * (0.6 + Math.abs(droop)) + pad * 2, res, pad, len * 0.3 + pad);
  const g = L.g;
  const spine = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    spine.push([len * u, droop * len * u * u - len * 0.08 * Math.sin(u * Math.PI)]);
  }
  const S = sampleSpline(spine, 80);
  const at = (u) => S[Math.min(S.length - 1, Math.round(u * (S.length - 1)))];
  // pinnae from base to tip, alternating sides; draw far-side ones first (darker)
  const list = [];
  for (let i = 0; i < pinnae; i++) {
    const u = 0.1 + (i / (pinnae - 1)) * 0.88;
    for (const side of [-1, 1]) {
      const uu = clamp(u + (side > 0 ? 0.012 : 0));
      const p = at(uu);
      const pl = len * width * Math.pow(Math.sin(Math.PI * Math.min(1, uu * 1.15)), 0.7) * (1.05 - 0.55 * uu) * rng.range(0.9, 1.08);
      const ang = Math.atan2(p.ty, p.tx) + side * (1.05 - 0.45 * uu) + rng.range(-0.06, 0.06);
      list.push({ p, pl, ang, side, u: uu });
    }
  }
  list.sort((a, b) => (a.side === b.side ? 0 : a.side < 0 ? -1 : 1));
  for (const q of list) {
    const far = q.side < 0;
    const base = mix(color, far ? dark : color, far ? 0.35 : 0);
    const W = q.pl * 0.17;
    const lobes = Math.max(3, Math.round(q.pl / 9));
    const top = [];
    const bot = [];
    const n = 24;
    const ca = Math.cos(q.ang);
    const sa = Math.sin(q.ang);
    for (let k = 0; k <= n; k++) {
      const v = k / n;
      const lob = detail ? 1 + 0.32 * Math.abs(Math.sin(v * lobes * Math.PI)) : 1;
      const w = W * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.05 + 0.02)), 0.65) * lob * (1 - 0.35 * v);
      const along = q.pl * v;
      const bend = q.pl * 0.06 * v * v;
      const x = q.p.x + ca * along - sa * bend;
      const y = q.p.y + sa * along + ca * bend;
      top.push([x - sa * w, y + ca * w]);
      bot.push([x + sa * w, y - ca * w]);
    }
    const path = smoothPath([...top, ...bot.reverse()], true);
    const grd = g.createLinearGradient(q.p.x, q.p.y, q.p.x + ca * q.pl, q.p.y + sa * q.pl);
    grd.addColorStop(0, rgba(shade(base, -0.12)));
    grd.addColorStop(0.6, rgba(base));
    grd.addColorStop(1, rgba(mix(base, light, 0.45)));
    g.fillStyle = grd;
    g.fill(path);
    // underside shadow on one half of the pinna
    g.save();
    g.clip(path);
    g.fillStyle = rgba(dark, far ? 0.35 : 0.22);
    g.beginPath();
    g.moveTo(q.p.x, q.p.y);
    for (const [x, y] of bot.slice().reverse()) g.lineTo(x, y);
    g.closePath();
    g.fill();
    if (detail) {
      // pinnule veins
      g.strokeStyle = rgba(dark, 0.45);
      g.lineWidth = 0.35;
      g.beginPath();
      for (let k = 1; k < lobes; k++) {
        const v = k / lobes;
        const x = q.p.x + ca * q.pl * v;
        const y = q.p.y + sa * q.pl * v;
        const w = W * 1.1;
        g.moveTo(x, y);
        g.lineTo(x - sa * w + ca * w * 0.6, y + ca * w + sa * w * 0.6);
        g.moveTo(x, y);
        g.lineTo(x + sa * w + ca * w * 0.6, y - ca * w + sa * w * 0.6);
      }
      g.stroke();
    }
    g.restore();
    // midrib
    g.strokeStyle = rgba(mix(dark, light, 0.3), 0.8);
    g.lineWidth = Math.max(0.4, W * 0.12);
    g.beginPath();
    g.moveTo(q.p.x, q.p.y);
    g.lineTo(q.p.x + ca * q.pl * 0.95, q.p.y + sa * q.pl * 0.95);
    g.stroke();
    g.strokeStyle = rgba(ink, inkAlpha * (far ? 0.7 : 0.85));
    g.lineWidth = 0.55;
    g.stroke(path);
  }
  // rachis on top
  const rach = smoothPath(spine, false);
  g.strokeStyle = rgba(shade(dark, -0.2), 0.95);
  g.lineWidth = len * 0.012 + 0.6;
  g.stroke(rach);
  g.strokeStyle = rgba(light, 0.5);
  g.lineWidth = len * 0.004 + 0.2;
  g.stroke(smoothPath(spine.map(([x, y]) => [x, y - len * 0.004]), false));
  return L;
}

// A whole fern: several fronds fanning from a crown, as one sprite set (drawn back to front).
export function fern(res, { size = 300, count = 9, seed = 1, spread = 2.6, base = -Math.PI / 2, colors } = {}) {
  const rng = makeRng(seed);
  const fronds = [];
  for (let i = 0; i < count; i++) {
    const f = i / (count - 1);
    const ang = base + (f - 0.5) * spread + rng.range(-0.1, 0.1);
    const side = Math.cos(ang);
    const back = rng.chance(0.4);
    const c = colors ?? {};
    fronds.push({
      layer: fernFrond(res, { len: size * rng.range(0.75, 1.1), droop: 0.32 + Math.abs(side) * 0.3, seed: seed * 31 + i, color: back ? c.back ?? '#4f7d3c' : c.front ?? '#628f47', dark: c.dark ?? '#2c5229', light: c.light ?? '#b5cf7f', width: 0.21 }),
      ang,
      flip: side < 0,
      back,
      phase: rng.range(0, TAU),
    });
  }
  fronds.sort((a, b) => (a.back === b.back ? Math.abs(Math.cos(b.ang)) - Math.abs(Math.cos(a.ang)) : a.back ? -1 : 1));
  return fronds;
}

// Draw a fern at (x, y) with sway (radians) and per-frond jitter.
export function drawFern(g, fronds, x, y, scale, sway, shake = 0, t = 0) {
  for (const f of fronds) {
    const s = sway * (0.7 + 0.3 * Math.sin(f.phase)) + shake * Math.sin(t * 22 + f.phase) ;
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    // fronds are authored growing along +x; flip the ones that lean left
    if (f.flip) {
      g.scale(-1, 1);
      g.rotate(Math.PI - f.ang - s);
    } else g.rotate(f.ang + s);
    g.drawImage(f.layer.c, -f.layer.ox, -f.layer.oy, f.layer.w, f.layer.h);
    g.restore();
  }
}

// Tall misty tree trunk with a few branches (background silhouette), flat tone + light hatch.
export function trunk(res, { h = 1400, w = 60, color = '#9fae8a', seed = 1 } = {}) {
  const rng = makeRng(seed);
  const L = new Layer(w * 6, h + 40, res, w * 3, h + 20);
  const g = L.g;
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    pts.push([rng.range(-w * 0.06, w * 0.06) + Math.sin(u * 3 + seed) * w * 0.1, -h * u]);
  }
  const left = pts.map(([x, y], i) => [x - (w / 2) * (1.25 - (i / 10) * 0.5), y]);
  const right = pts.map(([x, y], i) => [x + (w / 2) * (1.25 - (i / 10) * 0.5), y]).reverse();
  const path = smoothPath([...left, ...right], true);
  g.fillStyle = rgba(color);
  g.fill(path);
  g.save();
  g.clip(path);
  g.fillStyle = rgba(shade(color, -0.12));
  g.fillRect(0, -h, w, h);
  g.strokeStyle = rgba(shade(color, -0.3), 0.35);
  g.lineWidth = 0.6;
  for (let y = -h; y < 0; y += rng.range(6, 14)) {
    g.beginPath();
    g.moveTo(-w, y + rng.range(-3, 3));
    g.quadraticCurveTo(0, y + rng.range(-6, 6), w, y + rng.range(-3, 3));
    g.stroke();
  }
  g.restore();
  // bark: long vertical scratches and a few knots
  g.save();
  g.clip(path);
  g.strokeStyle = rgba(shade(color, -0.35), 0.4);
  g.lineWidth = 0.7;
  for (let i = 0; i < 40; i++) {
    const x = rng.range(-w * 0.6, w * 0.6);
    const y0 = -rng.range(0, h);
    g.beginPath();
    g.moveTo(x, y0);
    g.lineTo(x + rng.range(-3, 3), y0 - rng.range(60, 220));
    g.stroke();
  }
  g.fillStyle = rgba(shade(color, 0.18), 0.5);
  g.fillRect(-w, -h, w * 0.35, h);
  g.restore();
  return L;
}

// Cycad / tree-fern crown: radiating stiff leaves on a short scaly trunk.
export function cycad(res, { size = 220, trunkH = 160, color = '#6d8f50', dark = '#355a2c', seed = 1, detail = 1 } = {}) {
  const rng = makeRng(seed);
  const L = new Layer(size * 2.6, size * 1.6 + trunkH, res, size * 1.3, size * 0.9 + trunkH);
  const g = L.g;
  // trunk with diamond leaf-base scales
  const tw = size * 0.16;
  const tp = smoothPath([[-tw, 0], [-tw * 0.85, -trunkH], [tw * 0.85, -trunkH], [tw, 0]], true);
  g.fillStyle = rgba('#7a6347');
  g.fill(tp);
  g.save();
  g.clip(tp);
  g.strokeStyle = rgba('#3e2f20', 0.6);
  g.lineWidth = 0.7;
  for (let y = 0; y > -trunkH; y -= tw * 0.45) {
    for (let x = -tw; x < tw; x += tw * 0.5) {
      const ox = ((y / (tw * 0.45)) & 1) * tw * 0.25;
      g.beginPath();
      g.moveTo(x + ox, y);
      g.lineTo(x + ox + tw * 0.25, y - tw * 0.2);
      g.lineTo(x + ox + tw * 0.5, y);
      g.stroke();
    }
  }
  g.restore();
  g.strokeStyle = rgba(INK, 0.8);
  g.lineWidth = 0.8;
  g.stroke(tp);
  // leaves
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + ((i / (n - 1)) - 0.5) * 3.4 + rng.range(-0.08, 0.08);
    const ll = size * rng.range(0.8, 1.05);
    const droop = Math.abs(Math.cos(a)) * 0.55;
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10;
      pts.push([Math.cos(a) * ll * u, -trunkH + Math.sin(a) * ll * u + droop * ll * u * u]);
    }
    const sp = sampleSpline(pts, 30);
    g.strokeStyle = rgba(shade(color, -0.25));
    g.lineWidth = 1.4;
    g.stroke(smoothPath(pts, false));
    // stiff leaflets along the leaf
    g.lineWidth = Math.max(0.8, size * 0.012);
    for (let k = 2; k < sp.length; k += detail ? 1 : 2) {
      const s = sp[k];
      const lw = size * 0.13 * Math.sin(Math.PI * s.u) + 2;
      for (const side of [-1, 1]) {
        const ang = Math.atan2(s.ty, s.tx) + side * 0.95;
        g.strokeStyle = rgba(side < 0 ? shade(color, -0.15) : color);
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.lineTo(s.x + Math.cos(ang) * lw, s.y + Math.sin(ang) * lw);
        g.stroke();
      }
    }
  }
  return L;
}

// Grass tuft: blades as thin tapered curves.
export function grassTuft(g, x, y, h, { count = 14, color = '#7f9a4f', dark = '#4c6a32', seed = 1, sway = 0 } = {}) {
  const rng = makeRng(seed);
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + rng.range(-0.55, 0.55);
    const hh = h * rng.range(0.55, 1.1);
    const bx = x + rng.range(-h * 0.15, h * 0.15);
    const tx = bx + Math.cos(a) * hh + sway * hh * 0.3;
    const ty = y + Math.sin(a) * hh;
    const w = h * 0.035;
    g.fillStyle = rgba(rng.chance(0.4) ? dark : color);
    g.beginPath();
    g.moveTo(bx - w, y);
    g.quadraticCurveTo((bx + tx) / 2 - w, (y + ty) / 2, tx, ty);
    g.quadraticCurveTo((bx + tx) / 2 + w, (y + ty) / 2, bx + w, y);
    g.closePath();
    g.fill();
  }
}

// Leaf litter: overlapping small fallen leaves with midribs, twigs and pebbles over a box.
export function leafLitter(g, box, { count = 900, colors = ['#a8793f', '#8d6233', '#c19356', '#6f5a2f', '#9a8a4a'], seed = 1, size = [6, 14] } = {}) {
  const rng = makeRng(seed);
  for (let i = 0; i < count; i++) {
    const x = box.x + rng.next() * box.w;
    const y = box.y + Math.pow(rng.next(), 0.8) * box.h;
    const persp = 0.55 + 0.45 * ((y - box.y) / box.h);
    const s = rng.range(size[0], size[1]) * persp;
    const a = rng.range(0, TAU);
    const c = rng.pick(colors);
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.scale(1, 0.5 + 0.2 * persp);
    g.fillStyle = rgba(c);
    g.beginPath();
    g.ellipse(0, 0, s, s * 0.42, 0, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(shade(c, -0.4), 0.7);
    g.lineWidth = 0.5;
    g.stroke();
    g.beginPath();
    g.moveTo(-s, 0);
    g.lineTo(s, 0);
    g.stroke();
    g.restore();
  }
  // twigs
  g.strokeStyle = rgba('#4a3522', 0.8);
  g.lineCap = 'round';
  for (let i = 0; i < count / 30; i++) {
    const x = box.x + rng.next() * box.w;
    const y = box.y + rng.next() * box.h;
    const a = rng.range(-0.4, 0.4);
    const l = rng.range(14, 40);
    g.lineWidth = rng.range(1, 2.4);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + rng.range(-4, 4), x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // pebbles
  for (let i = 0; i < count / 25; i++) {
    const x = box.x + rng.next() * box.w;
    const y = box.y + rng.next() * box.h;
    const r = rng.range(2, 6);
    g.fillStyle = rgba(rng.pick(['#b8ab93', '#9c8f78', '#d1c4a8']));
    g.beginPath();
    g.ellipse(x, y, r, r * 0.65, 0, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(INK, 0.6);
    g.lineWidth = 0.5;
    g.stroke();
    g.fillStyle = 'rgba(255,250,235,0.6)';
    g.beginPath();
    g.arc(x - r * 0.3, y - r * 0.25, r * 0.25, 0, TAU);
    g.fill();
  }
}

export { stipple, hatch };
