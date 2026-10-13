// Faceless storybook people as cut-out puppets: hip-rooted skeleton (spine, neck, head, two arms
// and two legs), each segment drawn in its own frame so its hatch texture moves with it. Emotion is
// all posture. Shapes follow the reference recipe: ink outline, flat fill, a stepped shadow with
// hatching on the side away from the light, a soft lit edge, and hair made of many fine strokes.
import { INK, smoothPath, canvas } from './paint.js';
import { makeRng, rgba, shade, mix, clamp, lerp, TAU } from './util.js';

export const KID = { headR: 13.5, neck: 3.5, torso: 27, upper: 13.5, fore: 12.5, thigh: 16.5, shin: 16, foot: 8.5, shoulderW: 10.5, hipW: 7.5, chestW: 12.5, waistW: 11.5, armW: 3.9, legW: 4.7, hand: 3.8 };
export const ADULT = { headR: 12.5, neck: 5, torso: 40, upper: 19.5, fore: 18, thigh: 25, shin: 24, foot: 10.5, shoulderW: 13.5, hipW: 9.5, chestW: 15, waistW: 13.5, armW: 4.6, legW: 5.9, hand: 4.3 };

// ---------- hatch patterns (device-resolution tiles, seeded) ----------
const tiles = {};
function hatchTile(kind, px) {
  const key = kind + px;
  if (tiles[key]) return tiles[key];
  const N = 120;
  const c = canvas(N, N);
  const g = c.getContext('2d');
  const rng = makeRng(kind === 'cross' ? 77 : 41);
  g.lineCap = 'round';
  const dirs = kind === 'cross' ? [1, -1] : [1];
  for (const dir of dirs) {
    for (let k = -N; k < N; k += px * rng.range(0.85, 1.15)) {
      let s = 0;
      while (s < N) {
        const len = rng.range(N * 0.15, N * 0.6);
        const e = Math.min(N, s + len);
        const a = rng.range(0.55, 1);
        g.strokeStyle = `rgba(0,0,0,${a})`;
        g.lineWidth = rng.range(1.6, 2.4);
        for (const ox of [-N, 0, N]) {
          for (const oy of [-N, 0, N]) {
            g.beginPath();
            if (dir === 1) {
              g.moveTo(k + s + ox, s + oy);
              g.lineTo(k + e + ox, e + oy);
            } else {
              g.moveTo(N - (k + s) + ox, s + oy);
              g.lineTo(N - (k + e) + ox, e + oy);
            }
            g.stroke();
          }
        }
        s = e + rng.range(2, 14);
      }
    }
  }
  tiles[key] = c;
  return c;
}
const patCache = new WeakMap();
function pattern(g, kind) {
  let m = patCache.get(g);
  if (!m) patCache.set(g, (m = {}));
  if (!m[kind]) m[kind] = g.createPattern(hatchTile(kind, kind === 'cross' ? 9 : 6.5), 'repeat');
  return m[kind];
}

// Local frame helpers: linear part of the current transform, to map the world light into it.
function localDir(g, vx, vy) {
  const m = g.getTransform();
  const det = m.a * m.d - m.b * m.c;
  // device vector -> local: inverse of [[a c][b d]]
  const lx = (m.d * vx - m.c * vy) / det;
  const ly = (-m.b * vx + m.a * vy) / det;
  const l = Math.hypot(lx, ly) || 1;
  return [lx / l, ly / l, Math.sqrt(Math.abs(det))];
}

// Shade a closed shape (Path2D in the current frame): stepped shadow + hatch on the side away from
// the light, then a soft lit edge. `light` is the world direction toward the light.
export function shadeShape(g, path, base, o) {
  const [lx, ly, k] = localDir(g, o.light[0], o.light[1]);
  const d = o.depth;
  const big = 1e4;
  const away = (f) => {
    const p = new Path2D();
    p.rect(-big, -big, 2 * big, 2 * big);
    p.addPath(path, new DOMMatrix().translate(lx * d * f, ly * d * f));
    return p;
  };
  g.save();
  g.clip(path);
  const sh = shade(base, -(o.shadeAmt ?? 0.3));
  g.fillStyle = rgba(sh, 0.45);
  g.fill(away(1), 'evenodd');
  g.fillStyle = rgba(sh, 0.4);
  g.fill(away(0.45), 'evenodd');
  if (o.hatch !== false) {
    const pat = pattern(g, 'single');
    pat.setTransform(new DOMMatrix().scale(1 / k));
    g.globalAlpha = o.hatchAlpha ?? 0.26;
    g.fillStyle = pat;
    g.fill(away(0.8), 'evenodd');
    if (o.cross) {
      const pc = pattern(g, 'cross');
      pc.setTransform(new DOMMatrix().scale(1 / k));
      g.globalAlpha = (o.hatchAlpha ?? 0.26) * 0.7;
      g.fillStyle = pc;
      g.fill(away(0.3), 'evenodd');
    }
    g.globalAlpha = 1;
  }
  // lit edge
  const lit = new Path2D();
  lit.rect(-big, -big, 2 * big, 2 * big);
  lit.addPath(path, new DOMMatrix().translate(-lx * d * 0.5, -ly * d * 0.5));
  g.fillStyle = rgba(shade(base, 0.32), o.litAlpha ?? 0.35);
  g.fill(lit, 'evenodd');
  g.restore();
}

// Tapered capsule from (0,0) down to (0,L), half-widths w0 at the top and w1 at the bottom.
function capsule(L, w0, w1) {
  const p = new Path2D();
  p.moveTo(-w0, 0);
  p.lineTo(-w1, L);
  p.arc(0, L, w1, Math.PI, 0, true);
  p.lineTo(w0, 0);
  p.arc(0, 0, w0, 0, Math.PI, true);
  p.closePath();
  return p;
}

const dirv = (a) => [Math.sin(a), Math.cos(a)];

// ---------- character definitions ----------
// A character: { adult, skin, hair, hairStyle, shirt, sleeves, pants, legwear, shoes, socks, detail,
// accent, seed }. build() precomputes the seeded hair strokes.
export function makePerson(def) {
  const P = def.adult ? ADULT : KID;
  const ch = { ...def, P };
  ch.hairStrokes = buildHair(ch);
  return ch;
}

function buildHair(ch) {
  const rng = makeRng(ch.seed * 31 + 7);
  const r = ch.P.headR;
  const st = ch.hairStyle;
  // three groups: dark, mid, light (light strokes favour the lit upper-left)
  const strokes = [new Path2D(), new Path2D(), new Path2D()];
  const n = st === 'curly' ? 300 : 260;
  const crown = [r * 0.05, -r * 0.95];
  for (let i = 0; i < n; i++) {
    let x;
    let y;
    do {
      x = rng.range(-1.2, 1.2) * r;
      y = rng.range(-1.2, 0.75) * r;
    } while (Math.hypot(x, y * 1.02) > r * 1.18);
    const lit = clamp(0.5 + (-x - y) / (3 * r));
    const grp = rng.next() < lit * 0.55 ? 2 : rng.next() < 0.55 ? 0 : 1;
    const p = strokes[grp];
    if (st === 'curly') {
      const cr = rng.range(1.1, 2.1);
      const a0 = rng.range(0, TAU);
      p.moveTo(x + Math.cos(a0) * cr, y + Math.sin(a0) * cr);
      p.arc(x, y, cr, a0, a0 + rng.range(3.2, 5.5));
    } else {
      // comb away from the crown, curving down the sides
      let dx = x - crown[0];
      let dy = y - crown[1];
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
      const len = (st === 'crop' ? rng.range(0.18, 0.38) : rng.range(0.3, 0.62)) * r;
      const ex = x + dx * len;
      const ey = y + dy * len + len * 0.15;
      p.moveTo(x, y);
      p.quadraticCurveTo((x + ex) / 2 + rng.range(-1, 1), (y + ey) / 2 + rng.range(-1, 1), ex, ey);
    }
  }
  // long back-hair strokes (falling)
  const back = new Path2D();
  if (st === 'long' || st === 'pony' || st === 'braids') {
    for (let i = 0; i < 160; i++) {
      const x = rng.range(-1, 1) * r * 1.05;
      const y = rng.range(-0.2, 0.4) * r;
      const len = rng.range(1.2, 2.6) * r;
      back.moveTo(x, y);
      back.quadraticCurveTo(x * 1.15 + rng.range(-1, 1), y + len * 0.5, x * 1.05 + rng.range(-1.5, 1.5), y + len);
    }
  }
  return { strokes, back };
}

// ---------- pose ----------
export const BASE_POSE = {
  x: 0, y: 0, flip: 1, sc: 1, fv: 0.45,
  spine: 0, hunch: 0, neck: 0, roll: 0, turn: 0.35, shrug: 0,
  aN: 0.08, eN: 0.12, aF: -0.08, eF: 0.12,
  hN: 0.05, kN: -0.05, fN: 0, hF: -0.05, kF: -0.05, fF: 0,
  sqx: 1, sqy: 1, breath: 0, farArmFront: false, handN: null, handF: null,
  skirtFlutter: 0,
};

export function pose(o) {
  return { ...BASE_POSE, ...o };
}

const ANG = ['spine', 'hunch', 'neck', 'roll', 'turn', 'shrug', 'aN', 'eN', 'aF', 'eF', 'hN', 'kN', 'fN', 'hF', 'kF', 'fF', 'x', 'y', 'sqx', 'sqy', 'fv', 'sc', 'skirtFlutter'];
export function blendPose(a, b, t) {
  const o = { ...a };
  for (const k of ANG) o[k] = lerp(a[k] ?? BASE_POSE[k], b[k] ?? BASE_POSE[k], t);
  o.flip = t < 0.5 ? a.flip : b.flip;
  o.farArmFront = t < 0.5 ? a.farArmFront : b.farArmFront;
  return o;
}

// Keyframed pose track: [[t, poseObject], ...] with smooth easing between keys.
export function track(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1];
      const [t1, b] = keys[i];
      const u = (t - t0) / (t1 - t0);
      return blendPose(a, b, u * u * (3 - 2 * u));
    }
  }
  return keys[keys.length - 1][1];
}

// World-ish joint positions in the character's local frame (hip at the origin, y down).
export function joints(ch, p) {
  const P = ch.P;
  const s = p.spine;
  const U = [Math.sin(s), -Math.cos(s)];
  const Pp = [Math.cos(s), Math.sin(s)];
  const T = P.torso * (1 + p.breath * 0.02);
  const hunch = p.hunch;
  const mid = [U[0] * T * 0.5 - Pp[0] * hunch * T * 0.2, U[1] * T * 0.5 - Pp[1] * hunch * T * 0.2];
  const top = [U[0] * T + Pp[0] * hunch * T * 0.16, U[1] * T + Pp[1] * hunch * T * 0.16];
  const spread = (w) => w * (0.28 + 0.72 * p.fv);
  const sh = [top[0] - U[0] * T * 0.1 + U[0] * p.shrug * 4, top[1] - U[1] * T * 0.1 + U[1] * p.shrug * 4];
  const sw = spread(P.shoulderW);
  const shN = [sh[0] + Pp[0] * sw * 0.92, sh[1] + Pp[1] * sw * 0.92];
  const shF = [sh[0] - Pp[0] * sw * 0.92, sh[1] - Pp[1] * sw * 0.92];
  const hw = spread(P.hipW);
  const hipN = [hw * 0.75, 0];
  const hipF = [-hw * 0.75, 0];
  const headDir = s + p.neck * 0.8 + p.hunch * 0.35;
  const HU = [Math.sin(headDir), -Math.cos(headDir)];
  const neckLen = P.neck * (1 - p.shrug * 0.5);
  const head = [top[0] + HU[0] * (neckLen + P.headR * 0.92), top[1] + HU[1] * (neckLen + P.headR * 0.92)];
  const limb = (o, a, L1, e, L2) => {
    const d1 = dirv(a);
    const m = [o[0] + d1[0] * L1, o[1] + d1[1] * L1];
    const d2 = dirv(a + e);
    return [m, [m[0] + d2[0] * L2, m[1] + d2[1] * L2]];
  };
  const [elN, wrN] = limb(shN, p.aN, P.upper, p.eN, P.fore);
  const [elF, wrF] = limb(shF, p.aF, P.upper, p.eF, P.fore);
  const [knN, anN] = limb(hipN, p.hN, P.thigh, p.kN, P.shin);
  const [knF, anF] = limb(hipF, p.hF, P.thigh, p.kF, P.shin);
  return { U, Pp, T, mid, top, shN, shF, hipN, hipF, head, headDir, elN, wrN, elF, wrF, knN, anN, knF, anF };
}

// Convert a local joint position to the parent (scene) frame.
export function toWorld(p, pt) {
  return [p.x + pt[0] * p.flip * p.sc * p.sqx, p.y + pt[1] * p.sc * p.sqy];
}

// ---------- drawing ----------
const OUT = 1.25; // outline half-width in local units

function strokeFill(g, path, fill, ow) {
  g.lineWidth = ow * 2;
  g.strokeStyle = INK;
  g.stroke(path);
  g.fillStyle = fill;
  g.fill(path);
}

function inFrame(g, x, y, a, fn) {
  g.save();
  g.translate(x, y);
  g.rotate(-a);
  fn();
  g.restore();
}

// Limb of two segments (+ optional end cap like a hand or shoe drawn by `endFn`).
function drawLimb(g, o, a, L1, e, L2, w, cols, light, endFn, ow) {
  const d1 = dirv(a);
  const m = [o[0] + d1[0] * L1, o[1] + d1[1] * L1];
  const a2 = a + e;
  const p1 = capsule(L1, w[0], w[1]);
  const p2 = capsule(L2, w[1], w[2]);
  // outlines first (so the joint seam disappears under the fills)
  inFrame(g, o[0], o[1], a, () => {
    g.lineWidth = ow * 2;
    g.strokeStyle = INK;
    g.stroke(p1);
  });
  inFrame(g, m[0], m[1], a2, () => {
    g.lineWidth = ow * 2;
    g.strokeStyle = INK;
    g.stroke(p2);
  });
  if (endFn) endFn('outline', m, a2, L2);
  inFrame(g, o[0], o[1], a, () => {
    g.fillStyle = cols[0];
    g.fill(p1);
    shadeShape(g, p1, cols[0], { light, depth: w[0] * 0.9 });
  });
  inFrame(g, m[0], m[1], a2, () => {
    g.fillStyle = cols[1];
    g.fill(p2);
    shadeShape(g, p2, cols[1], { light, depth: w[1] * 0.9 });
    if (cols[2]) {
      // a cuff / sock band at the far end
      g.save();
      g.clip(p2);
      g.fillStyle = cols[2];
      g.fillRect(-w[1] * 2, L2 - cols[3], w[1] * 4, cols[3] + w[2] * 2);
      g.restore();
    }
  });
  if (endFn) endFn('fill', m, a2, L2);
}

export function drawPerson(g, ch, p0, opts = {}) {
  const p = { ...p0, _t: opts.t ?? 0 };
  const P = ch.P;
  const light = opts.light ?? [-0.55, -0.85];
  const J = joints(ch, p);
  const ow = (opts.ow ?? OUT) / Math.max(0.6, p.sc);
  g.save();
  g.translate(p.x, p.y);
  g.scale(p.flip * p.sc * p.sqx, p.sc * p.sqy);
  // light in the mirrored frame
  const L = [light[0] * p.flip, light[1]];
  const skin = rgba(ch.skin);
  const skirt = ch.legwear === 'skirt';
  const sleeveCol = rgba(ch.shirt);
  const pantsCol = rgba(skirt ? ch.tights ?? shade(ch.pants, -0.2) : ch.pants);
  const shinCol = ch.legwear === 'shorts' ? skin : pantsCol;
  const shoeCol = rgba(ch.shoes);

  const hand = (which) => (stage, m, a2, L2) => {
    const d = dirv(a2);
    const hx = m[0] + d[0] * (L2 + P.hand * 0.55);
    const hy = m[1] + d[1] * (L2 + P.hand * 0.55);
    g.beginPath();
    g.ellipse(hx, hy, P.hand * 0.95, P.hand * 1.12, -a2, 0, TAU);
    if (stage === 'outline') {
      g.lineWidth = ow * 2;
      g.strokeStyle = INK;
      g.stroke();
    } else {
      g.fillStyle = skin;
      g.fill();
      const held = which === 'N' ? p.handN : p.handF;
      if (held) held(g, hx, hy, a2, stage);
    }
  };
  const shoe = (stage, m, a2, L2) => {
    const d = dirv(a2);
    const ax = m[0] + d[0] * L2;
    const ay = m[1] + d[1] * L2;
    const fl = P.foot * (1 - 0.55 * p.fv);
    const fa = a2 + Math.PI / 2;
    const fd = dirv(fa);
    const path = new Path2D();
    path.ellipse(ax + fd[0] * fl * 0.35, ay + fd[1] * fl * 0.35 + 0.6, fl * 0.68 + 1.6, P.legW * 0.78, -fa + Math.PI / 2, 0, TAU);
    if (stage === 'outline') {
      g.lineWidth = ow * 2;
      g.strokeStyle = INK;
      g.stroke(path);
    } else {
      g.fillStyle = shoeCol;
      g.fill(path);
      g.save();
      g.clip(path);
      g.fillStyle = rgba(shade(ch.shoes, 0.35), 0.5);
      g.fillRect(ax - 20, ay - P.legW * 1.2, 40, P.legW * 0.6);
      g.restore();
    }
  };

  const armW = [P.armW * 1.05, P.armW * 0.9, P.armW * 0.75];
  const legW = [P.legW * 1.1, P.legW * 0.95, P.legW * 0.78];
  const longSleeve = ch.sleeves === 'long';
  const armCols = [sleeveCol, longSleeve ? sleeveCol : skin, longSleeve ? rgba(shade(ch.shirt, -0.15)) : null, 2.5];
  const legColsN = [skirt ? pantsCol : rgba(ch.pants), shinCol, ch.legwear === 'shorts' ? rgba(ch.socks ?? '#f2ece0') : null, 4.5];

  const farArm = () => drawLimb(g, J.shF, p.aF, P.upper, p.eF, P.fore, armW, armCols.map((c, i) => (i < 3 && c ? dim(c) : c)), L, hand('F'), ow);
  const nearArm = () => drawLimb(g, J.shN, p.aN, P.upper, p.eN, P.fore, armW, armCols, L, hand('N'), ow);
  const farLeg = () => drawLimb(g, J.hipF, p.hF, P.thigh, p.kF, P.shin, legW, legColsN.map((c, i) => (i < 3 && c ? dim(c) : c)), L, shoe, ow);
  const nearLeg = () => drawLimb(g, J.hipN, p.hN, P.thigh, p.kN, P.shin, legW, legColsN, L, shoe, ow);

  if (!p.farArmFront) farArm();
  farLeg();
  nearLeg();
  if (skirt) drawSkirt(g, ch, p, J, L, ow, opts.t ?? 0);
  else drawShortsTop(g, ch, p, J, L, ow);
  drawBackHair(g, ch, p, J, ow);
  drawTorso(g, ch, p, J, L, ow);
  drawHead(g, ch, p, J, L, ow);
  if (p.farArmFront) farArm();
  nearArm();
  g.restore();
  return J;
}

function dim(c) {
  // far limbs a touch darker (they're further from the light and in the body's shadow)
  const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(c);
  if (!m) return c;
  return rgba(shade([+m[1], +m[2], +m[3]], -0.12), +m[4]);
}

function drawShortsTop(g, ch, p, J, L, ow) {
  // hips / seat of the trousers: a rounded block from the waist down over the tops of the thighs
  const P = ch.P;
  const w = P.hipW * (0.32 + 0.6 * p.fv) + P.legW * 0.95;
  const top = -P.torso * 0.16;
  const bot = P.legW * 1.5;
  const path = new Path2D();
  path.moveTo(-w * 0.94, top);
  path.lineTo(w * 0.94, top);
  path.quadraticCurveTo(w * 1.08, bot * 0.4, w * 0.95, bot);
  path.quadraticCurveTo(0, bot * 1.25, -w * 0.95, bot);
  path.quadraticCurveTo(-w * 1.08, bot * 0.4, -w * 0.94, top);
  path.closePath();
  strokeFill(g, path, rgba(ch.pants), ow);
  shadeShape(g, path, ch.pants, { light: L, depth: 4 });
}

function drawSkirt(g, ch, p, J, L, ow, t) {
  const P = ch.P;
  const pad = P.legW * 1.5;
  const pts = [];
  const add = (x, y) => pts.push([x, y]);
  const w = P.waistW * (0.62 + 0.38 * p.fv) * 1.02;
  add(-w, -P.torso * 0.22);
  add(w, -P.torso * 0.22);
  add(-w * 1.15, 0);
  add(w * 1.15, 0);
  for (const [k, a] of [
    [J.knN, J.anN],
    [J.knF, J.anF],
  ]) {
    for (const s of [-1, 1]) {
      add(k[0] + s * pad, k[1]);
      add(k[0], k[1] + s * pad);
      // hem stops a little above the ankle
      const hx = lerp(k[0], a[0], 0.86);
      const hy = lerp(k[1], a[1], 0.86);
      add(hx + s * pad * 1.25, hy);
      add(hx, hy + pad * 0.5);
    }
  }
  const hull = convexHull(pts);
  // flutter on the lower half
  const yMax = Math.max(...hull.map((q) => q[1]));
  const fl = hull.map(([x, y], i) => {
    const k = clamp((y - 2) / Math.max(1, yMax - 2));
    return [x + Math.sin(t * 7 + i * 1.7) * p.skirtFlutter * k * 2.2, y + Math.cos(t * 6 + i) * p.skirtFlutter * k * 1.2];
  });
  const path = smoothPath(fl, true, new Path2D(), 1 / 7);
  const col = ch.skirtColor ?? ch.pants;
  strokeFill(g, path, rgba(col), ow);
  shadeShape(g, path, col, { light: L, depth: 7, hatchAlpha: 0.22 });
  // a couple of soft fold lines
  g.save();
  g.clip(path);
  g.strokeStyle = rgba(shade(col, -0.35), 0.45);
  g.lineWidth = 0.9;
  const cx = (J.anN[0] + J.anF[0]) / 2;
  for (const f of [-0.35, 0.3]) {
    g.beginPath();
    g.moveTo(f * w, 2);
    g.quadraticCurveTo(f * w * 1.4 + cx * 0.3, yMax * 0.55, f * w * 1.8 + cx * 0.5, yMax - 1);
    g.stroke();
  }
  g.restore();
}

function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function drawTorso(g, ch, p, J, L, ow) {
  const P = ch.P;
  // tube along hip -> mid -> top, wider at the chest
  const spine = [[0, -1], J.mid, J.top];
  const cw = P.chestW * (0.62 + 0.38 * p.fv);
  const ww = P.waistW * (0.62 + 0.38 * p.fv);
  const N = 14;
  const S = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // quadratic bezier through the three spine points
    const a = spine[0];
    const b = [2 * spine[1][0] - (spine[0][0] + spine[2][0]) / 2, 2 * spine[1][1] - (spine[0][1] + spine[2][1]) / 2];
    const c = spine[2];
    const x = (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * b[0] + u * u * c[0];
    const y = (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * b[1] + u * u * c[1];
    S.push([x, y]);
  }
  const left = [];
  const right = [];
  for (let i = 0; i <= N; i++) {
    const a = S[Math.max(0, i - 1)];
    const b = S[Math.min(N, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const u = i / N;
    const w = lerp(ww, cw, Math.min(1, u * 1.25)) * (u > 0.88 ? Math.sqrt(1 - (u - 0.88) / 0.14 * 0.55) : 1);
    left.push([S[i][0] - ty * w, S[i][1] + tx * w]);
    right.push([S[i][0] + ty * w, S[i][1] - tx * w]);
  }
  const pts = [...left, ...right.reverse()];
  const path = smoothPath(pts, true, new Path2D(), 1 / 6);
  const col = ch.shirt;
  // neck (behind the collar)
  const nk = new Path2D();
  const nd = [J.head[0] - J.top[0], J.head[1] - J.top[1]];
  nk.moveTo(J.top[0] - 3.4, J.top[1] + 2);
  nk.lineTo(J.top[0] + nd[0] * 0.55 - 3.1, J.top[1] + nd[1] * 0.55);
  nk.lineTo(J.top[0] + nd[0] * 0.55 + 3.1, J.top[1] + nd[1] * 0.55);
  nk.lineTo(J.top[0] + 3.4, J.top[1] + 2);
  nk.closePath();
  strokeFill(g, nk, rgba(ch.skin), ow);
  strokeFill(g, path, rgba(col), ow);
  shadeShape(g, path, col, { light: L, depth: cw * 0.55, hatchAlpha: 0.24 });
  // clothing details clipped to the torso
  g.save();
  g.clip(path);
  if (ch.detail === 'stripes') {
    g.strokeStyle = rgba(ch.accent, 0.85);
    g.lineWidth = 2.2;
    for (let k = 0.2; k < 0.95; k += 0.2) {
      const q = S[Math.round(k * N)];
      g.beginPath();
      g.moveTo(q[0] - 30, q[1] + p.spine * -30);
      g.lineTo(q[0] + 30, q[1] + p.spine * 30);
      g.stroke();
    }
  } else if (ch.detail === 'cardigan') {
    const a = S[1];
    const b = S[N - 1];
    g.strokeStyle = rgba(shade(col, -0.45), 0.9);
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(a[0] + 1.5 * p.fv, a[1]);
    g.lineTo(b[0] + 1.5 * p.fv, b[1]);
    g.stroke();
    g.fillStyle = rgba(ch.accent);
    for (let k = 0.25; k < 0.85; k += 0.18) {
      const q = S[Math.round(k * N)];
      g.beginPath();
      g.arc(q[0] + 2.8 * p.fv + 1, q[1], 0.9, 0, TAU);
      g.fill();
    }
  } else if (ch.detail === 'pocket') {
    const q = S[Math.round(0.62 * N)];
    g.strokeStyle = rgba(shade(col, -0.4), 0.8);
    g.lineWidth = 0.9;
    g.strokeRect(q[0] + 1, q[1] - 2, 4.5, 5);
  }
  // collar
  g.strokeStyle = rgba(ch.collar ?? shade(col, 0.4), 0.95);
  g.lineWidth = 1.6;
  g.beginPath();
  const t0 = J.top;
  g.ellipse(t0[0], t0[1] + 1.2, 4.2, 2.2, p.spine, 0, Math.PI);
  g.stroke();
  // hem band
  g.strokeStyle = rgba(shade(col, -0.25), 0.7);
  g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(left[1][0], left[1][1]);
  g.lineTo(right[right.length - 2][0], right[right.length - 2][1]);
  g.stroke();
  g.restore();
}

function backDir(p) {
  // unit-ish x offset toward the back of the head for a turn in [-1, 1]
  return -Math.sin(p.turn * Math.PI * 0.45);
}

function drawBackHair(g, ch, p, J, ow) {
  const st = ch.hairStyle;
  if (st !== 'long' && st !== 'pony' && st !== 'braids' && st !== 'bun') return;
  const r = ch.P.headR;
  const [hx, hy] = J.head;
  const bx = backDir(p);
  g.save();
  g.translate(hx, hy);
  g.rotate(p.spine * 0.5 + p.neck * 0.8 + p.roll);
  const col = rgba(ch.hair);
  if (st === 'long') {
    const w = r * (1.08 - 0.25 * Math.abs(bx));
    const path = new Path2D();
    path.moveTo(-w + bx * r * 0.35, -r * 0.2);
    path.quadraticCurveTo(-w * 1.15 + bx * r * 0.5, r * 1.3, -w * 0.8 + bx * r * 0.7, r * 2.15);
    path.quadraticCurveTo(bx * r * 0.6, r * 2.35, w * 0.8 + bx * r * 0.7, r * 2.15);
    path.quadraticCurveTo(w * 1.15 + bx * r * 0.5, r * 1.3, w + bx * r * 0.35, -r * 0.2);
    path.closePath();
    strokeFill(g, path, col, ow);
    g.save();
    g.clip(path);
    g.translate(bx * r * 0.45, 0);
    g.strokeStyle = rgba(shade(ch.hair, 0.3), 0.75);
    g.lineWidth = 0.75;
    g.stroke(ch.hairStrokes.back);
    g.restore();
  } else if (st === 'pony' || st === 'braids') {
    const swing = Math.sin((p._t ?? 0) * 5) * 0.15;
    const sides = st === 'braids' ? [-1, 1] : [1];
    for (const sd of sides) {
      const ox = st === 'braids' ? sd * r * 0.8 + bx * r * 0.3 : bx * r * 0.85;
      const oy = st === 'braids' ? r * 0.3 : -r * 0.35;
      const path = new Path2D();
      const len = st === 'braids' ? r * 1.6 : r * 1.7;
      const headRot = p.spine * 0.5 + p.neck * 0.8 + p.roll;
      const ang = (st === 'braids' ? 0.1 * sd + headRot * 0.6 : bx * 0.55 + headRot) + swing;
      const tx = ox + Math.sin(ang) * len;
      const ty = oy + Math.cos(ang) * len;
      path.moveTo(ox - 3, oy);
      path.quadraticCurveTo(ox + (tx - ox) * 0.5 - 4.5, oy + (ty - oy) * 0.5, tx, ty);
      path.quadraticCurveTo(ox + (tx - ox) * 0.5 + 4.5, oy + (ty - oy) * 0.5, ox + 3, oy);
      path.closePath();
      strokeFill(g, path, col, ow);
      // braid crossings / strands
      g.strokeStyle = rgba(shade(ch.hair, 0.35), 0.8);
      g.lineWidth = 0.7;
      for (let k = 0.15; k < 0.95; k += st === 'braids' ? 0.14 : 0.08) {
        const cx = ox + (tx - ox) * k;
        const cy = oy + (ty - oy) * k;
        g.beginPath();
        g.moveTo(cx - 2.2, cy - 1);
        g.lineTo(cx + 2.2, cy + 1);
        g.stroke();
      }
      // hair tie
      g.fillStyle = rgba(ch.accent ?? '#c0504a');
      g.beginPath();
      g.arc(ox + (tx - ox) * (st === 'braids' ? 0.85 : 0.08), oy + (ty - oy) * (st === 'braids' ? 0.85 : 0.08), 1.9, 0, TAU);
      g.fill();
    }
  } else if (st === 'bun') {
    const path = new Path2D();
    path.arc(bx * r * 0.7, -r * 0.75, r * 0.5, 0, TAU);
    strokeFill(g, path, col, ow);
    g.strokeStyle = rgba(shade(ch.hair, 0.35), 0.7);
    g.lineWidth = 0.7;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.arc(bx * r * 0.7, -r * 0.75, r * (0.15 + k * 0.07), k, k + 2.4);
      g.stroke();
    }
  }
  g.restore();
}


// Hairline control points (unit head radius), ordered back/left to front/right.
const HL_FRONT = [[-1.3, 0.3], [-0.97, 0.12], [-0.8, -0.18], [-0.5, -0.3], [-0.17, -0.36], [0.17, -0.36], [0.5, -0.3], [0.8, -0.18], [0.97, 0.12], [1.3, 0.3]];
const HL_SIDE = [[-1.3, 0.62], [-0.8, 0.58], [-0.5, 0.36], [-0.3, 0.04], [-0.08, -0.22], [0.14, -0.46], [0.4, -0.62], [0.66, -0.68], [0.92, -0.58], [1.3, -0.45]];
const HL_CROP = (pts) => pts.map(([x, y]) => [x, y - 0.12]);
function hairCap(st, turn, r) {
  const k = Math.min(1, Math.abs(turn) * 1.05);
  const e = k * k * (3 - 2 * k);
  let pts = HL_FRONT.map((p, i) => [lerp(p[0], HL_SIDE[i][0], e), lerp(p[1], HL_SIDE[i][1], e)]);
  if (st === 'crop') pts = HL_CROP(pts);
  if (st === 'long' || st === 'braids' || st === 'pony' || st === 'bun') pts = pts.map(([x, y], i) => [x, y + (i === 0 || i === 9 ? 0.25 : 0) - 0.02]);
  if (turn < 0) pts = pts.map(([x, y]) => [-x, y]).reverse();
  const P = pts.map(([x, y]) => [x * r, y * r]);
  const path = new Path2D();
  // smooth hairline, then close over the top of the head
  const last = P[P.length - 1];
  const first = P[0];
  smoothPath(P, false, path);
  path.lineTo(last[0] + (last[0] > 0 ? 1 : -1) * r * 0.4, last[1]);
  path.lineTo(last[0] > 0 ? r * 1.8 : -r * 1.8, -r * 1.8);
  path.lineTo(first[0] > 0 ? r * 1.8 : -r * 1.8, -r * 1.8);
  path.lineTo(first[0] + (first[0] > 0 ? 1 : -1) * r * 0.4, first[1]);
  path.closePath();
  return path;
}

function drawHead(g, ch, p, J, L, ow) {
  const r = ch.P.headR;
  const [hx, hy] = J.head;
  const bx = backDir(p);
  const turn = clamp(p.turn, -1, 1);
  const yaw = turn * Math.PI * 0.45;
  g.save();
  g.translate(hx, hy);
  g.rotate(p.spine * 0.5 + p.neck * 0.8 + p.roll);
  const headPath = new Path2D();
  headPath.ellipse(0, 0, r * 0.97, r, 0, 0, TAU);
  // ears (behind the head outline, visible on the facing hemisphere)
  for (const sd of [-1, 1]) {
    const th = yaw + (sd * Math.PI) / 2;
    const ex = r * Math.sin(th) * 0.98;
    const ez = Math.cos(th);
    if (ez < -0.25) continue;
    const ear = new Path2D();
    ear.ellipse(ex, r * 0.12, r * 0.2 * (0.45 + 0.55 * Math.abs(Math.sin(th))) + 0.8, r * 0.28, 0, 0, TAU);
    strokeFill(g, ear, rgba(shade(ch.skin, -0.06)), ow);
  }
  strokeFill(g, headPath, rgba(ch.skin), ow);
  shadeShape(g, headPath, ch.skin, { light: L, depth: r * 0.45, hatch: true, hatchAlpha: 0.12, shadeAmt: 0.18, litAlpha: 0.3 });
  // ear in front of the face outline when nearly in profile
  for (const sd of [-1, 1]) {
    const th = yaw + (sd * Math.PI) / 2;
    const ez = Math.cos(th);
    if (ez < 0.55) continue;
    const ex = r * Math.sin(th) * 0.98;
    const ear = new Path2D();
    ear.ellipse(ex, r * 0.12, r * 0.17, r * 0.27, 0, 0, TAU);
    strokeFill(g, ear, rgba(shade(ch.skin, -0.04)), ow * 0.8);
    g.strokeStyle = rgba(shade(ch.skin, -0.35), 0.8);
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(ex, r * 0.12, r * 0.09, -1.2, 1.4);
    g.stroke();
  }
  // a soft warm cheek tone on the facing side (no features)
  const fx = r * Math.sin(yaw) * 0.55;
  const grd = g.createRadialGradient(fx, r * 0.3, 0, fx, r * 0.3, r * 0.45);
  grd.addColorStop(0, rgba(mix(ch.skin, '#e0705a', 0.5), 0.22));
  grd.addColorStop(1, rgba(mix(ch.skin, '#e0705a', 0.5), 0));
  g.fillStyle = grd;
  g.beginPath();
  g.arc(fx, r * 0.3, r * 0.45, 0, TAU);
  g.fill();
  // hair cap: everything above a hairline that turns with the head (front view: forehead fringe and
  // temples; profile: from the brow over the ear to the nape), clipped to a slightly bigger head.
  const st = ch.hairStyle;
  const cap = hairCap(st, turn, r);
  const puff = st === 'curly' ? 1.2 : st === 'crop' ? 1.03 : 1.08;
  const outer = new Path2D();
  if (st === 'curly') {
    const op = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU;
      const rr = r * puff * (1 + 0.05 * Math.sin(a * 9 + ch.seed));
      op.push([Math.cos(a) * rr - Math.sin(yaw) * r * 0.08, Math.sin(a) * rr * 0.96 - r * 0.06]);
    }
    smoothPath(op, true, outer);
  } else outer.ellipse(-Math.sin(yaw) * r * 0.04, -r * 0.02, r * puff, r * (puff - 0.01), 0, 0, TAU);
  g.save();
  g.clip(outer);
  g.lineWidth = ow * 2;
  g.strokeStyle = INK;
  g.stroke(cap);
  g.fillStyle = rgba(ch.hair);
  g.fill(cap);
  g.clip(cap);
  shadeShape(g, cap, ch.hair, { light: L, depth: r * 0.5, hatch: false, shadeAmt: 0.25, litAlpha: 0.25 });
  const tones = [shade(ch.hair, -0.35), shade(ch.hair, 0.12), shade(ch.hair, 0.4)];
  ch.hairStrokes.strokes.forEach((s, i) => {
    g.strokeStyle = rgba(tones[i], i === 2 ? 0.55 : 0.7);
    g.lineWidth = i === 0 ? 0.8 : 0.65;
    g.stroke(s);
  });
  g.restore();
  // outline of the cap where it extends past the head
  {
    g.save();
    const inv = new Path2D();
    inv.rect(-1e3, -1e3, 2e3, 2e3);
    inv.addPath(headPath);
    g.clip(inv, 'evenodd');
    g.clip(outer);
    g.lineWidth = ow * 2;
    g.strokeStyle = INK;
    g.stroke(cap);
    g.fillStyle = rgba(ch.hair);
    g.fill(cap);
    g.restore();
  }
  g.restore();
}

// Soft ground shadow ellipse under a character (scene frame).
export function groundShadow(g, x, y, w, alpha = 0.22) {
  const grd = g.createRadialGradient(x, y, 0, x, y, w);
  grd.addColorStop(0, `rgba(40,30,20,${alpha})`);
  grd.addColorStop(1, 'rgba(40,30,20,0)');
  g.save();
  g.translate(x, y);
  g.scale(1, 0.22);
  g.translate(-x, -y);
  g.fillStyle = grd;
  g.beginPath();
  g.arc(x, y, w, 0, TAU);
  g.fill();
  g.restore();
}

// Two-bone IK: set an arm's angles so its hand reaches (tx, ty) in the character's local frame.
// `bend` +1 / -1 picks which way the elbow points.
export function reach(ch, p, which, tx, ty, bend = 1) {
  const P = ch.P;
  const J = joints(ch, p);
  const S = which === 'N' ? J.shN : J.shF;
  const L1 = P.upper;
  const L2 = P.fore + P.hand * 0.55;
  let dx = tx - S[0];
  let dy = ty - S[1];
  let d = Math.hypot(dx, dy);
  const maxd = (L1 + L2) * 0.999;
  if (d > maxd) {
    dx *= maxd / d;
    dy *= maxd / d;
    d = maxd;
  }
  d = Math.max(d, Math.abs(L1 - L2) + 0.01);
  const phi = Math.atan2(dx, dy);
  const ca = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
  const alpha = Math.acos(Math.max(-1, Math.min(1, ca)));
  if (bend === 'fwd') {
    // pick the solution whose elbow sits further forward (+x) and lower
    const ea = phi + alpha;
    const eb = phi - alpha;
    const sa = Math.sin(ea) + 0.3 * Math.cos(ea);
    const sb = Math.sin(eb) + 0.3 * Math.cos(eb);
    bend = sa >= sb ? 1 : -1;
  }
  const a = phi + bend * alpha;
  const ex = S[0] + Math.sin(a) * L1;
  const ey = S[1] + Math.cos(a) * L1;
  const a2 = Math.atan2(S[0] + dx - ex, S[1] + dy - ey);
  let e = a2 - a;
  while (e > Math.PI) e -= 2 * Math.PI;
  while (e < -Math.PI) e += 2 * Math.PI;
  if (which === 'N') {
    p.aN = a;
    p.eN = e;
  } else {
    p.aF = a;
    p.eF = e;
  }
  return p;
}

// The head centre and radius in the character's local frame (for IK targets).
export function headAt(ch, p) {
  const J = joints(ch, p);
  return { x: J.head[0], y: J.head[1], r: ch.P.headR, J };
}
