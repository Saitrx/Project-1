// A small Cretaceous mammal (shrew / opossum-like), side view facing right, built as fur sprites:
// tail, far legs, body, near legs, head (pivots at the neck). Thousands of fur strokes per part.
import { Layer, smoothPath, fur, rgba, shade, glossyBall, INK, stipple } from './paint.js';
import { makeRng, TAU, clamp } from './util.js';

const FUR = ['#2f1f12', '#4e3520', '#71502f', '#9a7243', '#c49a62', '#dfc08c'];

function part(res, w, h, ox, oy) {
  return new Layer(w, h, res, ox, oy);
}

export function buildMammal(res) {
  const rng = makeRng(301);
  // ---- body ----
  const body = part(res, 260, 150, 130, 80);
  const bodyPts = [[-78, 0], [-66, -30], [-30, -44], [10, -42], [44, -32], [62, -12], [58, 14], [30, 30], [-10, 34], [-50, 28], [-74, 16]];
  const bodyPath = smoothPath(bodyPts, true);
  {
    const g = body.g;
    g.fillStyle = rgba('#5a3e25');
    g.fill(bodyPath);
    // belly lighter underfur
    g.save();
    g.clip(bodyPath);
    const bel = g.createLinearGradient(0, -10, 0, 36);
    bel.addColorStop(0, 'rgba(210,180,130,0)');
    bel.addColorStop(1, 'rgba(225,198,150,0.85)');
    g.fillStyle = bel;
    g.fillRect(-90, -50, 180, 100);
    g.restore();
    fur(g, bodyPath, { x: -85, y: -52, w: 160, h: 92 }, {
      count: 6500,
      len: [5, 11],
      width: 0.55,
      colors: FUR,
      seed: 302,
      dir: (x, y) => Math.PI + 0.25 + (y > 10 ? 0.9 : 0) + (y < -30 ? -0.35 : 0),
      lenFn: (x, y) => (y > 18 ? 0.7 : 1),
    });
    // belly fur, pale
    fur(g, bodyPath, { x: -70, y: 12, w: 130, h: 26 }, { count: 1200, len: [4, 8], width: 0.5, colors: ['#9d7a52', '#cdb086', '#ead3a6'], seed: 303, dir: () => Math.PI * 0.62 });
    // form shading over the fur: darker underside and rump, warm rim light along the back
    g.save();
    g.clip(bodyPath);
    const sh = g.createLinearGradient(0, -44, 0, 34);
    sh.addColorStop(0, 'rgba(255,230,180,0.18)');
    sh.addColorStop(0.45, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(35,20,8,0.4)');
    g.fillStyle = sh;
    g.fillRect(-90, -50, 180, 100);
    g.restore();
    // dark guard hairs along the spine
    fur(g, smoothPath([[-70, -28], [-30, -46], [10, -44], [44, -34], [40, -22], [0, -32], [-60, -18]], true), { x: -75, y: -50, w: 125, h: 34 }, { count: 700, len: [7, 13], width: 0.5, colors: ['#24170c', '#3b2816'], seed: 304, dir: () => Math.PI + 0.15 });
  }
  // ---- tail ----
  const tail = part(res, 230, 120, 205, 40);
  {
    const g = tail.g;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      pts.push([-u * 190, Math.sin(u * 2.6) * 26 + u * 20]);
    }
    const left = pts.map(([x, y], i) => [x, y - 9 * (1 - i / 13)]);
    const right = pts.map(([x, y], i) => [x, y + 9 * (1 - i / 13)]).reverse();
    const tp = smoothPath([...left, ...right], true);
    g.fillStyle = rgba('#4a321d');
    g.fill(tp);
    fur(g, tp, { x: -200, y: -30, w: 210, h: 70 }, { count: 1800, len: [3, 7], width: 0.45, colors: FUR.slice(0, 5), seed: 305, dir: (x) => Math.PI + 0.2 + Math.cos(-x / 30) * 0.3 });
  }
  // ---- legs (paws) ----
  const legs = [];
  for (const [name, ox, oy, flip] of [
    ['hindFar', -44, 6, 0],
    ['frontFar', 38, 12, 0],
    ['hindNear', -50, 8, 1],
    ['frontNear', 34, 14, 1],
  ]) {
    const L = part(res, 80, 70, 40, 30);
    const g = L.g;
    const hind = name.startsWith('hind');
    // hind: a rounded haunch tucked under the body with a long flat foot; front: short slim arm
    const pts = hind ? [[-22, -22], [10, -24], [22, -6], [14, 14], [6, 22], [26, 28], [24, 34], [-6, 34], [-12, 22], [-24, 2]] : [[-8, -12], [8, -12], [10, 6], [8, 22], [18, 28], [16, 34], [-2, 34], [-4, 22], [-9, 2]];
    const p = smoothPath(pts, true);
    g.fillStyle = rgba(flip ? '#5c4027' : '#3b2817');
    g.fill(p);
    fur(g, p, { x: -26, y: -26, w: 54, h: 62 }, { count: hind ? 900 : 450, len: [3, 7], width: 0.45, colors: flip ? FUR.slice(1) : FUR.slice(0, 4), seed: 306 + legs.length, dir: (x, y) => (y < 10 ? Math.PI * 0.85 : Math.PI * 0.55) });
    // shade the inner side
    g.save();
    g.clip(p);
    const sh = g.createLinearGradient(0, -20, 0, 34);
    sh.addColorStop(0, 'rgba(30,18,8,0)');
    sh.addColorStop(1, 'rgba(30,18,8,0.35)');
    g.fillStyle = sh;
    g.fillRect(-30, -30, 60, 70);
    g.restore();
    // little pink toes
    for (let k = 0; k < 4; k++) {
      const tx = (hind ? 8 : 2) + k * 4.2;
      g.fillStyle = rgba('#d49a8a');
      g.beginPath();
      g.ellipse(tx, 33.5, 2.4, 1.6, 0, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(INK, 0.6);
      g.lineWidth = 0.4;
      g.stroke();
    }
    legs.push({ name, layer: L, ox, oy, near: !!flip });
  }
  // ---- head ---- (local origin at the neck pivot)
  const head = part(res, 150, 110, 40, 60);
  const headPts = [[-14, -26], [10, -34], [36, -30], [62, -16], [84, -6], [90, 0], [82, 8], [60, 12], [34, 18], [6, 20], [-16, 10]];
  const headPath = smoothPath(headPts, true);
  {
    const g = head.g;
    g.fillStyle = rgba('#634529');
    g.fill(headPath);
    g.save();
    g.clip(headPath);
    const ch = g.createLinearGradient(0, 0, 0, 22);
    ch.addColorStop(0, 'rgba(215,185,135,0)');
    ch.addColorStop(1, 'rgba(230,205,160,0.9)');
    g.fillStyle = ch;
    g.fillRect(-20, -40, 120, 70);
    g.restore();
    fur(g, headPath, { x: -20, y: -40, w: 115, h: 64 }, {
      count: 3200,
      len: [3, 8],
      width: 0.45,
      colors: FUR,
      seed: 310,
      dir: (x, y) => Math.PI + (y > 8 ? 0.7 : 0.12) + (x > 55 ? -0.1 : 0),
      lenFn: (x) => (x > 60 ? 0.55 : 1),
    });
    // mask stripe darker around the eye
    fur(g, smoothPath([[18, -22], [52, -18], [60, -8], [24, -6]], true), { x: 14, y: -26, w: 50, h: 22 }, { count: 300, len: [3, 6], width: 0.45, colors: ['#2a1a0e', '#3e2a17'], seed: 311, dir: () => Math.PI + 0.1 });
    // nose
    g.fillStyle = rgba('#b9706a');
    g.beginPath();
    g.ellipse(88, -1, 5.5, 4.2, 0.2, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(INK, 0.8);
    g.lineWidth = 0.6;
    g.stroke();
    g.fillStyle = 'rgba(255,240,230,0.8)';
    g.beginPath();
    g.arc(86.5, -3, 1.4, 0, TAU);
    g.fill();
    // mouth line
    g.strokeStyle = rgba('#2a1a10', 0.8);
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(84, 6);
    g.quadraticCurveTo(70, 11, 56, 9);
    g.stroke();
    // eye
    glossyBall(g, 40, -12, 7.5, { color: '#120b07', ring: '#3b2516' });
  }
  // whiskers drawn per frame (they tremble)
  const whiskers = [];
  for (let i = 0; i < 9; i++) whiskers.push({ a: -0.35 + i * 0.09 + rng.range(-0.03, 0.03), l: rng.range(26, 44), y: rng.range(-3, 4) });
  // ear (pivot at its base)
  const ear = part(res, 40, 40, 14, 30);
  {
    const g = ear.g;
    const ep = smoothPath([[-10, 0], [-12, -16], [-2, -26], [10, -18], [10, 0]], true);
    g.fillStyle = rgba('#7c5636');
    g.fill(ep);
    const inner = smoothPath([[-6, -2], [-7, -14], [-1, -20], [6, -14], [5, -2]], true);
    g.fillStyle = rgba('#c98d7c');
    g.fill(inner);
    g.strokeStyle = rgba(INK, 0.8);
    g.lineWidth = 0.7;
    g.stroke(ep);
    stipple(g, inner, { x: -8, y: -22, w: 16, h: 22 }, { count: 60, r: [0.2, 0.5], color: '#7a3f35', alpha: 0.5, seed: 312 });
  }
  return { body, bodyPath, tail, legs, head, ear, whiskers };
}

// pose: { x, y (ground point under the body), s (scale), breath (0..1 phase), headRot, blink (0..1),
// earBack (0..1), crouch (0..1), sniff (0..1) }
export function drawMammal(g, M, p) {
  const draw = (L, x, y, rot = 0, sx = 1, sy = sx) => {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale(sx, sy);
    g.drawImage(L.c, -L.ox, -L.oy, L.w, L.h);
    g.restore();
  };
  const breath = Math.sin(p.breath * TAU) * 0.025;
  const crouch = p.crouch ?? 0;
  g.save();
  g.translate(p.x, p.y);
  g.scale(p.s, p.s);
  // body sits so its belly is just above the ground
  const by = -36 + crouch * 9;
  g.save();
  g.translate(0, by);
  draw(M.tail, -70, 6 + crouch * 4, (p.tailSway ?? 0) * 0.15);
  for (const leg of M.legs.filter((l) => !l.near)) draw(leg.layer, leg.ox, leg.oy - 2, 0, 0.95);
  draw(M.body, 0, 0, 0, 1 + breath * 0.4, (1 + breath) * (1 - crouch * 0.12));
  for (const leg of M.legs.filter((l) => l.near)) draw(leg.layer, leg.ox, leg.oy + crouch * -4);
  // head on the neck pivot
  const hx = 50;
  const hy = -14 + crouch * 8;
  const hr = (p.headRot ?? 0) + crouch * 0.12 + Math.sin((p.sniff ?? 0) * TAU * 3) * 0.015;
  g.save();
  g.translate(hx, hy);
  g.rotate(hr);
  // ear behind the head outline top
  g.save();
  g.translate(8, -24);
  g.rotate(-0.3 - (p.earBack ?? 0) * 0.7);
  g.drawImage(M.ear.c, -M.ear.ox, -M.ear.oy, M.ear.w, M.ear.h);
  g.restore();
  g.drawImage(M.head.c, -M.head.ox, -M.head.oy, M.head.w, M.head.h);
  // whiskers
  g.strokeStyle = 'rgba(245,235,215,0.75)';
  g.lineWidth = 0.4;
  const tw = Math.sin((p.sniff ?? 0) * TAU * 6) * 0.04;
  for (const w of M.whiskers) {
    g.beginPath();
    g.moveTo(78, 2 + w.y);
    g.quadraticCurveTo(78 + Math.cos(w.a + tw) * w.l * 0.6, 2 + w.y + Math.sin(w.a + tw) * w.l * 0.6 + 2, 78 + Math.cos(w.a + tw) * w.l, 2 + w.y + Math.sin(w.a + tw) * w.l + 6);
    g.stroke();
  }
  // blink: fur-coloured lid closing over the eye
  const b = clamp(p.blink ?? 0);
  if (b > 0) {
    g.fillStyle = rgba('#4e3520');
    g.beginPath();
    g.ellipse(40, -12, 8.2, 8.2 * b, 0, Math.PI, 0);
    g.ellipse(40, -12, 8.2, 8.2 * b * 0.15, 0, 0, Math.PI);
    g.fill();
    g.strokeStyle = rgba(INK, 0.8);
    g.lineWidth = 0.6;
    g.beginPath();
    g.ellipse(40, -12 + 8.2 * (b - 1) * 0, 8.2, 8.2 * b * 0.15, 0, 0, Math.PI);
    g.stroke();
  }
  g.restore();
  g.restore();
  g.restore();
}
