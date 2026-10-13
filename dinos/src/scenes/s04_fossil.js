// 0:17-0:23 A circular inset grows out of the hiding mammal: a fossil slab. A brush sweeps the dust
// off a badger-sized mammal skeleton (Repenomamus); a dashed badger outline shows its size; then the
// view pushes into its stomach, where the bones of a baby dinosaur glow.
import { Layer, drawLayer, smoothPath, stipple, scribble, mottle, rgba, shade, mix, INK, sparkle, strokePartial, hatch } from '../kit/paint.js';
import { makeRng, makeNoise, clamp, lerp, smoothstep, easeOutBack, easeInOut, easeOut, TAU } from '../kit/util.js';
import { setCam } from '../kit/cam.js';

const T0 = 17.0;
const CX = 540;
const CY = 720;
const RAD = 390;
const BONE = '#efe3c8';
const BONE_DARK = '#c7b18a';
const BONE_INK = '#4a3826';

// ---- bone primitives (local slab coordinates, origin at the slab centre) ----
function longBone(g, x1, y1, x2, y2, w) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const l = Math.hypot(x2 - x1, y2 - y1);
  g.save();
  g.translate(x1, y1);
  g.rotate(a);
  const p = new Path2D();
  const k = w * 1.25;
  p.moveTo(0, -k);
  p.bezierCurveTo(k * 0.8, -k * 1.3, k * 1.6, -w * 0.5, k * 1.9, -w * 0.5);
  p.lineTo(l - k * 1.9, -w * 0.5);
  p.bezierCurveTo(l - k * 1.6, -w * 0.5, l - k * 0.8, -k * 1.3, l, -k);
  p.bezierCurveTo(l + k * 0.9, -k * 0.5, l + k * 0.9, k * 0.5, l, k);
  p.bezierCurveTo(l - k * 0.8, k * 1.3, l - k * 1.6, w * 0.5, l - k * 1.9, w * 0.5);
  p.lineTo(k * 1.9, w * 0.5);
  p.bezierCurveTo(k * 1.6, w * 0.5, k * 0.8, k * 1.3, 0, k);
  p.bezierCurveTo(-k * 0.9, k * 0.5, -k * 0.9, -k * 0.5, 0, -k);
  fillBone(g, p, l, w);
  g.restore();
}

function fillBone(g, p, l = 40, w = 10) {
  // drop shadow into the stone, bone fill, shading on the lower side, ink outline
  g.save();
  g.translate(1.6, 2.2);
  g.fillStyle = 'rgba(40,28,16,0.45)';
  g.fill(p);
  g.restore();
  g.fillStyle = BONE;
  g.fill(p);
  g.save();
  g.clip(p);
  g.translate(-1.2, -1.8);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(0,0,0,0)';
  g.restore();
  g.save();
  g.clip(p);
  g.fillStyle = rgba(BONE_DARK, 0.55);
  g.translate(0, w * 0.35);
  g.fill(p);
  g.restore();
  g.strokeStyle = rgba(BONE_INK, 0.95);
  g.lineWidth = 0.9;
  g.stroke(p);
}

function blob(g, pts) {
  const p = smoothPath(pts, true);
  fillBone(g, p, 30, 12);
  return p;
}

function vertebra(g, x, y, a, s) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  const p = new Path2D();
  p.moveTo(-s * 0.55, -s * 0.35);
  p.lineTo(-s * 0.2, -s * 0.45);
  p.lineTo(-s * 0.05, -s * 1.15); // neural spine
  p.lineTo(s * 0.18, -s * 1.12);
  p.lineTo(s * 0.25, -s * 0.45);
  p.lineTo(s * 0.55, -s * 0.35);
  p.quadraticCurveTo(s * 0.68, 0, s * 0.55, s * 0.35);
  p.lineTo(-s * 0.55, s * 0.35);
  p.quadraticCurveTo(-s * 0.68, 0, -s * 0.55, -s * 0.35);
  fillBone(g, p, s, s * 0.7);
  g.restore();
}

function rib(g, x, y, len, a, curl) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    const ang = a + curl * u;
    pts.push([x + Math.cos(ang) * len * u, y + Math.sin(ang) * len * u + Math.sin(u * Math.PI) * len * 0.12]);
  }
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(40,28,16,0.4)';
  g.lineWidth = 6.5;
  g.translate(1.5, 2);
  g.stroke(smoothPath(pts, false));
  g.restore();
  g.strokeStyle = BONE_INK;
  g.lineWidth = 6.4;
  g.stroke(smoothPath(pts, false));
  g.strokeStyle = BONE;
  g.lineWidth = 4.6;
  g.stroke(smoothPath(pts, false));
}

function buildSlab(res) {
  const L = new Layer(2 * RAD + 40, 2 * RAD + 40, res, RAD + 20, RAD + 20);
  const g = L.g;
  const rng = makeRng(401);
  const nz = makeNoise(402);
  const box = { x: -RAD - 20, y: -RAD - 20, w: 2 * RAD + 40, h: 2 * RAD + 40 };
  g.fillStyle = '#b8a587';
  g.fillRect(box.x, box.y, box.w, box.h);
  mottle(g, null, box, { base: '#b8a587', count: 90, size: [40, 140], amount: 0.16, seed: 403 });
  // strata: wavy lighter/darker bands
  for (let i = 0; i < 26; i++) {
    const y0 = box.y + (i / 26) * box.h + rng.range(-8, 8);
    g.strokeStyle = rgba(rng.chance(0.5) ? '#9c8a6c' : '#d4c4a6', rng.range(0.25, 0.5));
    g.lineWidth = rng.range(1, 5);
    g.beginPath();
    for (let x = box.x; x <= box.x + box.w; x += 20) {
      const y = y0 + Math.sin(x * 0.01 + i) * 6 + (nz.n(x * 0.02, i) - 0.5) * 10;
      if (x === box.x) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  stipple(g, null, box, { count: 26000, r: [0.3, 1.0], color: '#4b3d2b', alpha: 0.4, seed: 404 });
  stipple(g, null, box, { count: 9000, r: [0.3, 0.9], color: '#f5ead2', alpha: 0.5, seed: 405 });
  scribble(g, null, box, { count: 220, len: [8, 20], color: '#4b3d2b', alpha: 0.18, seed: 406 });
  // cracks
  g.strokeStyle = rgba('#3e3020', 0.7);
  g.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    let x = rng.range(box.x, box.x + box.w);
    let y = rng.range(box.y, box.y + box.h);
    let a = rng.range(0, TAU);
    g.lineWidth = rng.range(0.8, 1.8);
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 14; k++) {
      a += rng.range(-0.6, 0.6);
      x += Math.cos(a) * rng.range(8, 22);
      y += Math.sin(a) * rng.range(8, 22);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return L;
}

function buildSkeleton(res) {
  // The mammal lies on its side, head left, back curved, tail curling to the right.
  const L = new Layer(2 * RAD + 40, 2 * RAD + 40, res, RAD + 20, RAD + 20);
  const g = L.g;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // spine curve (neck -> back -> tail)
  const spine = [];
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const x = -170 + u * 520;
    const y = -40 - Math.sin(u * Math.PI * 0.9) * 70 + (u > 0.7 ? (u - 0.7) * 260 : 0);
    spine.push([x, y]);
  }
  // ribs under the back
  for (let i = 0; i < 13; i++) {
    const [x, y] = spine[6 + i];
    rib(g, x, y + 8, 105 - Math.abs(i - 6) * 6, Math.PI * 0.52 + i * 0.012, -0.55);
  }
  // hind limbs (far side first): short and stout, like a badger's
  longBone(g, 178, -8, 196, 52, 9); // femur far
  longBone(g, 196, 52, 176, 100, 7);
  for (let k = 0; k < 5; k++) longBone(g, 176, 100, 196 + k * 7, 116 + k * 1.5, 2.6);
  longBone(g, 196, -4, 226, 56, 10.5); // femur near
  longBone(g, 226, 56, 204, 106, 8.5); // tibia
  for (let k = 0; k < 5; k++) longBone(g, 204, 106, 226 + k * 8, 124 + k * 2, 2.8);
  // pelvis (ilium + ischium)
  blob(g, [[140, -54], [196, -66], [232, -46], [226, -10], [196, 8], [172, -12], [150, -30]]);
  g.fillStyle = 'rgba(60,44,28,0.75)';
  g.beginPath();
  g.ellipse(200, -22, 9, 7, 0.3, 0, TAU);
  g.fill();
  // fore limbs
  longBone(g, -106, -12, -96, 52, 8.5);
  longBone(g, -96, 52, -118, 98, 6.5);
  for (let k = 0; k < 5; k++) longBone(g, -118, 98, -100 + k * 6, 114 + k * 1.5, 2.4);
  longBone(g, -76, -8, -60, 56, 9.5);
  longBone(g, -60, 56, -82, 104, 7.5);
  for (let k = 0; k < 5; k++) longBone(g, -82, 104, -62 + k * 7, 122 + k * 2, 2.6);
  // scapula
  blob(g, [[-128, -80], [-72, -92], [-60, -54], [-94, -26], [-124, -42]]);
  // vertebrae along the spine and tail
  for (let i = 0; i < 38; i += 1) {
    const [x, y] = spine[i];
    const [x2, y2] = spine[Math.min(40, i + 1)];
    const s = i < 6 ? 14 : i < 26 ? 17 - (i - 6) * 0.1 : Math.max(5, 15 - (i - 26) * 0.9);
    vertebra(g, x, y, Math.atan2(y2 - y, x2 - x), s);
  }
  // skull and jaw: domed braincase, sagittal crest, short snout
  g.save();
  g.translate(-226, -70);
  g.rotate(0.2);
  g.scale(0.82, 0.82);
  const skull = smoothPath([[-104, 6], [-106, -8], [-80, -22], [-40, -34], [-4, -50], [30, -54], [56, -40], [64, -14], [46, 10], [-10, 16], [-70, 16]], true);
  fillBone(g, skull, 160, 50);
  g.fillStyle = 'rgba(55,38,24,0.85)';
  g.beginPath();
  g.ellipse(-28, -16, 15, 12, -0.2, 0, TAU);
  g.fill();
  g.strokeStyle = BONE_INK;
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(-60, 0);
  g.quadraticCurveTo(-10, 8, 40, -6);
  g.moveTo(-2, -48);
  g.quadraticCurveTo(26, -60, 58, -40);
  g.stroke();
  // teeth: big canines, then cheek teeth
  g.fillStyle = BONE;
  for (let k = 0; k < 9; k++) {
    const x = -100 + k * 10;
    g.beginPath();
    g.moveTo(x, 14);
    g.lineTo(x + 4, k === 1 ? 34 : 24);
    g.lineTo(x + 8, 14);
    g.closePath();
    g.fill();
    g.stroke();
  }
  const jaw = smoothPath([[-100, 26], [-60, 24], [0, 22], [34, 14], [46, 30], [14, 42], [-60, 40], [-96, 36]], true);
  fillBone(g, jaw, 140, 20);
  g.restore();
  return { L, stomach: [40, 10] };
}

function buildBaby(res) {
  // Bones of a young Psittacosaurus, curled up: small beaked skull, limb bones, vertebrae.
  const L = new Layer(260, 220, res, 130, 110);
  const g = L.g;
  g.lineCap = 'round';
  const amber = '#f2d29a';
  const save = { BONE };
  const draw = () => {
    // vertebrae ring
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * 0.2 + (i / 18) * Math.PI * 1.55;
      vertebra(g, Math.cos(a) * 58, Math.sin(a) * 42, a + Math.PI / 2, 7.5);
    }
    longBone(g, -20, 10, 25, 30, 4);
    longBone(g, 25, 30, 50, -2, 3.4);
    longBone(g, -12, -18, 22, -30, 3.6);
    // beaked skull
    g.save();
    g.translate(-62, -12);
    g.rotate(-0.4);
    const sk = smoothPath([[-30, 4], [-34, -6], [-18, -18], [8, -20], [22, -8], [14, 10], [-10, 14]], true);
    fillBone(g, sk, 60, 20);
    g.fillStyle = 'rgba(55,38,24,0.85)';
    g.beginPath();
    g.ellipse(-2, -6, 6, 5, 0, 0, TAU);
    g.fill();
    g.restore();
  };
  draw();
  void amber;
  void save;
  return L;
}

function buildDust(res) {
  const L = new Layer(2 * RAD + 40, 2 * RAD + 40, res, RAD + 20, RAD + 20);
  const g = L.g;
  const box = { x: -RAD - 20, y: -RAD - 20, w: 2 * RAD + 40, h: 2 * RAD + 40 };
  g.fillStyle = '#cbb793';
  g.fillRect(box.x, box.y, box.w, box.h);
  mottle(g, null, box, { base: '#cbb793', count: 60, size: [30, 100], amount: 0.15, seed: 411 });
  stipple(g, null, box, { count: 20000, r: [0.3, 1.1], color: '#6b5a40', alpha: 0.45, seed: 412 });
  stipple(g, null, box, { count: 8000, r: [0.3, 0.9], color: '#fff3dc', alpha: 0.5, seed: 413 });
  return L;
}

// Brush sweep path over the slab, as [t, x, y] (local slab coords).
const SWEEP = (() => {
  const pts = [];
  const rows = [-150, -80, -10, 60, 130, 190];
  let t = 17.9;
  rows.forEach((y, i) => {
    const dir = i % 2 ? -1 : 1;
    for (let k = 0; k <= 12; k++) {
      const u = k / 12;
      pts.push([t + u * 0.27, dir * lerp(-330, 330, u), y + Math.sin(u * Math.PI) * 18]);
    }
    t += 0.3;
  });
  return pts;
})();

export async function build(env) {
  const { S } = env;
  const res = S * 1.5;
  const slab = buildSlab(res);
  const skel = buildSkeleton(res);
  const baby = buildBaby(res * 1.6);
  const dust = buildDust(res);
  const work = new Layer(dust.w, dust.h, dust.res, dust.ox, dust.oy);
  const forest = await env.get('forest');
  const rng = makeRng(420);
  const specks = Array.from({ length: 120 }, () => ({ k: rng.int(0, SWEEP.length - 1), vx: rng.range(-90, 90), vy: rng.range(-120, -30), s: rng.range(1, 3) }));
  // badger silhouette outline (side view), around the skeleton, as a polyline
  const badger = [[-332, -40], [-300, -84], [-262, -112], [-232, -138], [-212, -126], [-190, -128], [-120, -150], [0, -170], [120, -170], [230, -146], [300, -104], [380, -86], [390, -66], [312, -50], [270, 40], [262, 130], [214, 136], [196, 70], [60, 76], [-40, 74], [-50, 130], [-100, 134], [-110, 60], [-170, 30], [-250, 14], [-310, -6]];
  const stomach = skel.stomach;

  function inset(g, t, cx, cy, r, alpha = 1) {
    // contents in slab coords; push toward the stomach in the second half
    const push = easeInOut(clamp((t - 20.0) / 1.6));
    const z = (r / RAD) * (1 + push * 0.75);
    const fx = lerp(0, stomach[0] + 10, push);
    const fy = lerp(0, stomach[1] + 8, push);
    g.save();
    g.globalAlpha = alpha;
    g.beginPath();
    g.arc(cx, cy, Math.max(0, r), 0, TAU);
    g.save();
    g.clip();
    g.translate(cx, cy);
    g.scale(z, z);
    g.translate(-fx, -fy);
    drawLayer(g, slab, 0, 0);
    drawLayer(g, skel.L, 0, 0);
    // baby dinosaur bones in the stomach: amber tint and a soft glow once revealed
    const glow = smoothstep(20.3, 21.2, t);
    if (glow > 0) {
      const gr = g.createRadialGradient(stomach[0], stomach[1], 0, stomach[0], stomach[1], 120);
      gr.addColorStop(0, `rgba(255,205,120,${0.5 * glow})`);
      gr.addColorStop(1, 'rgba(255,205,120,0)');
      g.fillStyle = gr;
      g.fillRect(stomach[0] - 120, stomach[1] - 120, 240, 240);
    }
    drawLayer(g, baby, stomach[0], stomach[1], 0, 0.62);
    // dust layer, erased along the brush path so far
    if (t < 19.9) {
      work.g.save();
      work.g.setTransform(1, 0, 0, 1, 0, 0);
      work.g.globalCompositeOperation = 'copy';
      work.g.drawImage(dust.c, 0, 0);
      work.g.restore();
      work.reset();
      work.g.globalCompositeOperation = 'destination-out';
      for (const [pt, x, y] of SWEEP) {
        if (pt > t) break;
        const gr = work.g.createRadialGradient(x, y, 0, x, y, 70);
        gr.addColorStop(0, 'rgba(0,0,0,0.95)');
        gr.addColorStop(0.7, 'rgba(0,0,0,0.6)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        work.g.fillStyle = gr;
        work.g.fillRect(x - 70, y - 70, 140, 140);
      }
      work.reset();
      const fade = 1 - smoothstep(19.5, 19.9, t);
      drawLayer(g, work, 0, 0, 0, 1, 1, fade);
    }
    // badger outline: dashed lavender, drawn on, with a 1 m scale bar
    const bo = smoothstep(18.6, 19.6, t) * (1 - smoothstep(20.0, 20.5, t));
    if (bo > 0) {
      g.save();
      g.strokeStyle = rgba('#5f5fb8', 0.9 * Math.min(1, bo * 2));
      g.lineWidth = 2.6 / z;
      g.setLineDash([12, 8]);
      strokePartial(g, badger, bo, true);
      g.setLineDash([]);
      g.restore();
      g.save();
      g.globalAlpha *= bo;
      g.strokeStyle = '#3d3020';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-250, 250);
      g.lineTo(250, 250);
      g.moveTo(-250, 238);
      g.lineTo(-250, 262);
      g.moveTo(250, 238);
      g.lineTo(250, 262);
      g.stroke();
      g.fillStyle = '#3d3020';
      g.font = 'italic 500 34px "EBGaramond"';
      g.textAlign = 'center';
      g.fillText('about 1 m', 0, 232);
      g.restore();
    }
    // stomach highlight: lavender ring drawn on with sparkles
    const ring = smoothstep(20.4, 21.3, t);
    if (ring > 0) {
      g.save();
      g.strokeStyle = rgba('#6d6fd0', 0.95);
      g.lineWidth = 2.2 / z;
      g.beginPath();
      g.arc(stomach[0], stomach[1], 66, -Math.PI / 2, -Math.PI / 2 + TAU * ring);
      g.stroke();
      if (ring < 1) {
        const a = -Math.PI / 2 + TAU * ring;
        sparkle(g, stomach[0] + Math.cos(a) * 66, stomach[1] + Math.sin(a) * 66, 9 / z, '#4b4db8', 1);
      } else {
        sparkle(g, stomach[0] + 66, stomach[1] - 66 * 0.1, 7 / z, '#4b4db8', 0.9);
        sparkle(g, stomach[0] - 50, stomach[1] - 46, 5 / z, '#4b4db8', 0.8);
      }
      g.restore();
    }
    // brush and flying specks
    if (t > 17.8 && t < 19.95) {
      let cur = SWEEP[0];
      for (const p of SWEEP) if (p[0] <= t) cur = p;
      const nxt = SWEEP[Math.min(SWEEP.length - 1, SWEEP.indexOf(cur) + 1)];
      const u = clamp((t - cur[0]) / Math.max(0.001, nxt[0] - cur[0]));
      const bx = lerp(cur[1], nxt[1], u);
      const by = lerp(cur[2], nxt[2], u);
      for (const sp of specks) {
        const [pt, x, y] = SWEEP[sp.k];
        const age = t - pt;
        if (age < 0 || age > 0.6) continue;
        g.fillStyle = `rgba(214,196,160,${0.8 * (1 - age / 0.6)})`;
        g.beginPath();
        g.arc(x + sp.vx * age, y + sp.vy * age + 120 * age * age, sp.s, 0, TAU);
        g.fill();
      }
      g.save();
      g.translate(bx, by);
      g.rotate(-0.5 + Math.sin(t * 9) * 0.12);
      // bristles
      g.fillStyle = '#d9c6a0';
      g.beginPath();
      g.moveTo(-34, 0);
      g.lineTo(34, 0);
      g.lineTo(28, -60);
      g.lineTo(-28, -60);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba('#7a6545', 0.8);
      g.lineWidth = 0.8;
      for (let k = -30; k <= 30; k += 3) {
        g.beginPath();
        g.moveTo(k, 0);
        g.lineTo(k * 0.85, -60);
        g.stroke();
      }
      // ferrule and handle
      g.fillStyle = '#9a8f80';
      g.fillRect(-30, -78, 60, 18);
      g.strokeStyle = INK;
      g.lineWidth = 1;
      g.strokeRect(-30, -78, 60, 18);
      g.fillStyle = '#8a5a32';
      g.beginPath();
      g.moveTo(-12, -78);
      g.lineTo(-8, -260);
      g.quadraticCurveTo(0, -272, 8, -260);
      g.lineTo(12, -78);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
    }
    g.restore();
    // inset frame: cream ring and ink lines, like the reference's circular insets
    g.lineWidth = 9;
    g.strokeStyle = rgba('#f3e6c8', 1);
    g.stroke();
    g.lineWidth = 1.4;
    g.strokeStyle = rgba(INK, 0.9);
    g.beginPath();
    g.arc(cx, cy, Math.max(0, r + 4.5), 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, Math.max(0, r - 4.5), 0, TAU);
    g.stroke();
    g.restore();
  }

  function insetGeom(t) {
    const o = easeOutBack(clamp((t - T0) / 0.8), 1.3);
    const [mx, my] = forest.mammalScreen(T0);
    const m = easeInOut(clamp((t - T0) / 0.8));
    return [lerp(mx, CX, m), lerp(my, CY, m), Math.max(0.001, RAD * o)];
  }

  function draw(g, t) {
    forest.draw(g, t);
    // warm darkening behind the inset
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = `rgba(28,18,10,${0.5 * smoothstep(T0, T0 + 0.6, t)})`;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    setCam(g, S);
    const [cx, cy, r] = insetGeom(t);
    inset(g, t, cx, cy, r);
  }

  // Hand-off to the city: the forest fades and the inset shrinks into the city's sun.
  function drawShrink(g, t, u, city) {
    const e = easeInOut(u);
    g.save();
    g.globalAlpha = 1 - e;
    // draw the forest + darkening into the frame with fading alpha via a temporary canvas
    g.restore();
    const sun = city.sun ?? { x: 820, y: 330, r: 60 };
    const cx = lerp(CX, sun.x, e);
    const cy = lerp(CY, sun.y, e);
    const r = lerp(RAD, sun.r, e);
    // forest background fading out
    if (e < 1) {
      const tmp = env.tmp ?? (env.tmp = document.createElement('canvas'));
      if (tmp.width !== g.canvas.width) {
        tmp.width = g.canvas.width;
        tmp.height = g.canvas.height;
      }
      const tg = tmp.getContext('2d');
      tg.setTransform(1, 0, 0, 1, 0, 0);
      tg.clearRect(0, 0, tmp.width, tmp.height);
      forest.draw(tg, t);
      tg.setTransform(1, 0, 0, 1, 0, 0);
      tg.fillStyle = 'rgba(28,18,10,0.5)';
      tg.fillRect(0, 0, tmp.width, tmp.height);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1 - smoothstep(0, 0.7, u);
      g.drawImage(tmp, 0, 0);
      g.globalAlpha = 1;
    }
    setCam(g, S);
    inset(g, t, cx, cy, r, 1 - smoothstep(0.55, 1, u));
    // the disc warms into the pale sun as it lands
    const k = smoothstep(0.35, 1, u);
    if (k > 0) {
      g.fillStyle = `rgba(250,238,206,${k})`;
      g.beginPath();
      g.arc(cx, cy, r + 4, 0, TAU);
      g.fill();
    }
  }

  return { draw, drawShrink };
}
