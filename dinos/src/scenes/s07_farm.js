// 0:36-0:42 Farmland. A Triceratops grazes behind a wooden fence, snorts, leans on the creaking
// rail. A line-art panel weighs it against an elephant on a balance: the beam settles level.
import { Layer, drawLayer, smoothPath, stipple, hatch, rgba, shade, mix, INK, sparkle, cloud, paintShape, strokePartial, mottle } from '../kit/paint.js';
import { makeRng, clamp, lerp, smoothstep, easeOutBack, easeInOut, easeOut, TAU, wobble } from '../kit/util.js';
import { setCam } from '../kit/cam.js';
import { buildTrike, trikePose, drawCreature, TRIKE_GROUND } from '../kit/triceratops.js';
import { grassTuft } from '../kit/plants.js';

const PLACE = { x: 690, y: 1078, s: 0.96 };
const SNORT = 37.3;
const LEAN = 38.25;

function buildLand(S) {
  const res = S * 1.1;
  const L = new Layer(1300, 2100, res, 110, 90);
  const g = L.g;
  const rng = makeRng(701);
  const sky = g.createLinearGradient(0, -90, 0, 900);
  sky.addColorStop(0, '#9fc7dc');
  sky.addColorStop(1, '#e4ecdf');
  g.fillStyle = sky;
  g.fillRect(-110, -90, 1300, 1100);
  for (let i = 0; i < 8; i++) cloud(g, rng.range(-60, 1140), rng.range(110, 600), rng.range(150, 280), 720 + i);
  // distant hills and patchwork fields
  const horizon = 860;
  g.fillStyle = '#a9bc8c';
  g.beginPath();
  g.moveTo(-110, 2010);
  for (let x = -110; x <= 1190; x += 20) g.lineTo(x, horizon - 40 - Math.sin(x * 0.004 + 1) * 40 - Math.sin(x * 0.011) * 14);
  g.lineTo(1190, 2010);
  g.fill();
  const fieldCols = ['#c9c27a', '#b3c07a', '#d8c98e', '#9fb46c', '#c8b56c', '#aab873'];
  for (let row = 0; row < 5; row++) {
    const y0 = horizon - 20 + row * row * 16 + row * 30;
    const y1 = horizon - 20 + (row + 1) * (row + 1) * 16 + (row + 1) * 30;
    let x = -110 - rng.range(0, 100);
    while (x < 1190) {
      const w = rng.range(160, 340) * (1 + row * 0.4);
      const c = rng.pick(fieldCols);
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x + w, y0);
      g.lineTo(x + w + (x + w - 540) * 0.08, y1);
      g.lineTo(x + (x - 540) * 0.08, y1);
      g.closePath();
      g.fill();
      // crop rows
      g.save();
      g.clip();
      g.strokeStyle = rgba(shade(c, -0.3), 0.45);
      g.lineWidth = 0.7;
      const ang = rng.range(-0.6, 0.6);
      for (let k = -40; k < 40; k++) {
        g.beginPath();
        g.moveTo(x + w / 2 + k * 9, y0 - 10);
        g.lineTo(x + w / 2 + k * 9 + Math.tan(ang) * 200, y1 + 10);
        g.stroke();
      }
      g.restore();
      // hedgerow along the field edge
      g.fillStyle = '#5f7a45';
      for (let k = 0; k < w; k += 9) {
        g.beginPath();
        g.arc(x + k, y0, 5 + rng.range(0, 3), Math.PI, 0);
        g.fill();
      }
      x += w;
    }
  }
  // barn and silo on the left in the distance
  const bx = 905;
  const by = 905;
  const barn = new Path2D();
  barn.moveTo(bx - 90, by);
  barn.lineTo(bx - 90, by - 90);
  barn.lineTo(bx - 60, by - 140);
  barn.lineTo(bx, by - 170);
  barn.lineTo(bx + 60, by - 140);
  barn.lineTo(bx + 90, by - 90);
  barn.lineTo(bx + 90, by);
  barn.closePath();
  paintShape(L, barn, { fill: '#b4473a', light: [-1, -0.5], shadowDepth: 30, hatchSpacing: 2.4, seed: 731 });
  g.strokeStyle = '#f1e6cf';
  g.lineWidth = 4;
  g.strokeRect(bx - 34, by - 70, 68, 70);
  g.beginPath();
  g.moveTo(bx - 34, by - 70);
  g.lineTo(bx + 34, by);
  g.moveTo(bx + 34, by - 70);
  g.lineTo(bx - 34, by);
  g.stroke();
  g.strokeStyle = '#6b6158';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(bx - 96, by - 88);
  g.lineTo(bx - 62, by - 144);
  g.lineTo(bx, by - 176);
  g.lineTo(bx + 62, by - 144);
  g.lineTo(bx + 96, by - 88);
  g.stroke();
  const silo = new Path2D();
  silo.rect(bx + 110, by - 190, 56, 190);
  silo.ellipse(bx + 138, by - 190, 28, 26, 0, Math.PI, 0);
  paintShape(L, silo, { fill: '#c9c4b6', light: [-1, -0.3], shadowDepth: 22, hatchSpacing: 2.2, seed: 732 });
  // round trees
  for (const [x, y, r] of [[60, 880, 40], [130, 890, 30], [520, 872, 34], [700, 870, 46], [770, 880, 30]]) {
    g.fillStyle = '#5d7d45';
    g.fillRect(x - 4, y - 6, 8, 22);
    const p = new Path2D();
    p.ellipse(x, y - r, r * 0.95, r, 0, 0, TAU);
    paintShape(L, p, { fill: '#6c8f4d', light: [-1, -1], shadowDepth: r * 0.5, hatchSpacing: 2.2, seed: x });
  }
  // near meadow
  const gr = g.createLinearGradient(0, 1040, 0, 2010);
  gr.addColorStop(0, '#a3b56a');
  gr.addColorStop(0.5, '#8aa058');
  gr.addColorStop(1, '#5d7140');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(-110, 1060);
  for (let x = -110; x <= 1190; x += 30) g.lineTo(x, 1050 + Math.sin(x * 0.006) * 12);
  g.lineTo(1190, 2010);
  g.lineTo(-110, 2010);
  g.fill();
  hatch(g, { x: -110, y: 1040, w: 1300, h: 970 }, { angle: -0.08, spacing: 5, width: 0.55, color: '#3f5226', alpha: 0.22, seed: 733, broken: 0.6 });
  stipple(g, null, { x: -110, y: 1040, w: 1300, h: 970 }, { count: 12000, r: [0.4, 1.1], color: '#334420', alpha: 0.3, seed: 734 });
  for (let i = 0; i < 80; i++) grassTuft(g, rng.range(-100, 1180), rng.range(1070, 1900), rng.range(14, 36), { count: 9, seed: 740 + i, color: '#94a85a', dark: '#5f7239' });
  // small flowers
  for (let i = 0; i < 160; i++) {
    const x = rng.range(-100, 1180);
    const y = rng.range(1080, 1900);
    g.fillStyle = rng.pick(['#f4f1e4', '#e8c24a', '#d97a8a', '#ffffff']);
    g.beginPath();
    g.arc(x, y, rng.range(1.5, 3), 0, TAU);
    g.fill();
  }
  return L;
}

function buildFence(S) {
  const res = S * 1.2;
  const L = new Layer(1300, 500, res, 110, -1100);
  const g = L.g;
  const wood = '#a0784c';
  const posts = [];
  for (let x = -60; x < 1200; x += 210) posts.push(x);
  for (const y of [1196, 1268]) {
    const p = new Path2D();
    p.moveTo(-110, y - 12);
    p.lineTo(1190, y - 16);
    p.lineTo(1190, y + 12);
    p.lineTo(-110, y + 14);
    p.closePath();
    paintShape(L, p, { fill: wood, light: [0, -1], shadowDepth: 10, hatchSpacing: 2.2, seed: y, cross: false });
    g.strokeStyle = rgba('#5a3f22', 0.55);
    g.lineWidth = 0.8;
    for (let k = 0; k < 14; k++) {
      g.beginPath();
      const x0 = -100 + k * 95;
      g.moveTo(x0, y - 4 + (k % 3) * 3);
      g.quadraticCurveTo(x0 + 40, y - 6, x0 + 80, y - 2 + (k % 2) * 4);
      g.stroke();
    }
  }
  for (const x of posts) {
    const p = new Path2D();
    p.moveTo(x - 16, 1140);
    p.lineTo(x, 1128);
    p.lineTo(x + 16, 1140);
    p.lineTo(x + 18, 1340);
    p.lineTo(x - 18, 1340);
    p.closePath();
    paintShape(L, p, { fill: '#8f6a42', light: [-1, -0.3], shadowDepth: 12, hatchSpacing: 2, seed: x + 77, cross: true });
  }
  return L;
}

function drawPanel(g, t) {
  const a = smoothstep(38.85, 39.25, t) * (1 - smoothstep(41.25, 41.6, t));
  if (a <= 0) return;
  const pop = easeOutBack(clamp((t - 38.85) / 0.45), 1.2);
  g.save();
  g.globalAlpha = a;
  g.translate(540, 390);
  g.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);
  g.translate(-540, -390);
  g.fillStyle = 'rgba(24,15,11,0.94)';
  g.beginPath();
  g.roundRect(80, 140, 920, 500, 26);
  g.fill();
  g.strokeStyle = '#f1e3c2';
  g.lineWidth = 2.4;
  g.stroke();
  g.strokeStyle = 'rgba(142,143,214,0.6)';
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(92, 152, 896, 476, 18);
  g.stroke();
  // balance: post, beam that swings and settles level, two pans
  const draw = clamp((t - 39.15) / 0.6);
  const tilt = 0.32 * Math.exp(-Math.max(0, t - 39.7) * 2.2) * Math.cos(Math.max(0, t - 39.7) * 6.5) * smoothstep(39.6, 39.75, t);
  const cx = 540;
  const cy = 300;
  g.strokeStyle = '#f1e3c2';
  g.lineWidth = 2.4;
  strokePartial(g, [[cx, cy], [cx, 590]], draw);
  strokePartial(g, [[cx - 90, 590], [cx + 90, 590]], draw);
  g.beginPath();
  g.moveTo(cx - 16, cy + 6);
  g.lineTo(cx, cy - 18);
  g.lineTo(cx + 16, cy + 6);
  g.closePath();
  g.stroke();
  const L2 = 330;
  const ca = Math.cos(tilt);
  const sa = Math.sin(tilt);
  const ends = [[cx - L2 * ca, cy - L2 * sa], [cx + L2 * ca, cy + L2 * sa]];
  strokePartial(g, [ends[0], ends[1]], draw);
  // tick marks on the beam
  g.strokeStyle = 'rgba(142,143,214,0.8)';
  g.lineWidth = 1;
  for (let k = -6; k <= 6; k++) {
    if (!k) continue;
    const x = cx + (k / 6) * L2 * ca;
    const y = cy + (k / 6) * L2 * sa;
    g.beginPath();
    g.moveTo(x - sa * 6, y + ca * 6 - 12);
    g.lineTo(x + sa * 6, y + ca * 6 - 4);
    g.stroke();
  }
  const pk = smoothstep(39.4, 39.8, t);
  for (const [i, [ex, ey]] of ends.entries()) {
    g.globalAlpha = a * pk;
    g.strokeStyle = '#f1e3c2';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(ex, ey);
    g.lineTo(ex - 90, ey + 150);
    g.moveTo(ex, ey);
    g.lineTo(ex + 90, ey + 150);
    g.stroke();
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(ex - 110, ey + 150);
    g.quadraticCurveTo(ex, ey + 190, ex + 110, ey + 150);
    g.stroke();
    // silhouettes standing on the pans
    g.save();
    g.translate(ex, ey + 150);
    g.fillStyle = 'rgba(241,227,194,0.12)';
    g.strokeStyle = '#f1e3c2';
    g.lineWidth = 2;
    const sil = i === 0 ? TRIKE_ICON : ELEPHANT_ICON;
    const p = smoothPath(sil, true);
    g.fill(p);
    g.stroke(p);
    g.restore();
    sparkle(g, ex, ey, 8, '#d6d7ff', 0.9);
  }
  g.globalAlpha = a * smoothstep(40.2, 40.6, t);
  g.fillStyle = '#e8b04a';
  g.font = 'italic 500 64px "EBGaramond"';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('=', cx, cy + 70);
  g.restore();
}

// Small outline silhouettes (feet at y = 0), about 150 wide.
const TRIKE_ICON = [[-76, 0], [-72, -26], [-90, -34], [-104, -50], [-96, -60], [-78, -56], [-86, -84], [-62, -74], [-50, -96], [-34, -70], [-10, -64], [30, -66], [62, -50], [96, -30], [74, -24], [56, -10], [54, 0], [40, 0], [36, -14], [-20, -16], [-28, 0], [-44, 0], [-50, -18], [-62, -16], [-62, 0]];
const ELEPHANT_ICON = [[-60, 0], [-60, -40], [-74, -50], [-84, -44], [-86, -20], [-94, -12], [-98, -24], [-96, -54], [-80, -82], [-56, -96], [-30, -92], [10, -98], [48, -88], [70, -64], [72, -30], [80, -16], [74, -14], [66, -30], [64, 0], [46, 0], [44, -26], [-30, -28], [-34, 0], [-50, 0], [-50, -26]];

export async function build(env) {
  const { S } = env;
  const land = buildLand(S);
  const fence = buildFence(S);
  const trike = buildTrike(S * PLACE.s * 1.2);
  const rng = makeRng(760);
  const puffs = Array.from({ length: 10 }, () => ({ a: rng.range(-0.5, 0.5), sp: rng.range(40, 110), r: rng.range(8, 22), d: rng.range(0, 0.2) }));

  function draw(g, t) {
    const push = smoothstep(35.6, 42.4, t);
    setCam(g, S, 540 + push * 20, 960 + push * 10, 1 + push * 0.05);
    drawLayer(g, land, 0, 0);
    // trike shadow, the animal, nostril puffs
    g.fillStyle = 'rgba(40,46,22,0.35)';
    g.beginPath();
    g.ellipse(PLACE.x - 80, PLACE.y + TRIKE_GROUND * PLACE.s + 2, 360, 24, 0, 0, TAU);
    g.fill();
    const graze = smoothstep(36.4, 36.9, t) * (1 - smoothstep(37.0, 37.4, t));
    const lean = Math.exp(-Math.pow((t - LEAN) / 0.35, 2));
    const pose = trikePose(t, { head: 0.18 * graze - 0.06 * lean, step: 0.05 * lean });
    g.save();
    g.translate(PLACE.x - lean * 10, PLACE.y);
    g.scale(PLACE.s, PLACE.s);
    const mats = drawCreature(g, trike, pose);
    g.restore();
    const ns = t - SNORT;
    if (ns > 0 && ns < 1.4) {
      const m = mats.head;
      const p = m.transformPoint(new DOMPoint(-262, 2));
      const nx = PLACE.x + p.x * PLACE.s;
      const ny = PLACE.y + p.y * PLACE.s;
      for (const pf of puffs) {
        const u = clamp((ns - pf.d) / 1.1);
        if (u <= 0) continue;
        const e = easeOut(u);
        const x = nx - Math.cos(pf.a) * pf.sp * e - 10;
        const y = ny + Math.sin(pf.a) * pf.sp * e * 0.5 + 10 * e;
        const r = pf.r * (0.6 + e);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(240,236,220,${0.45 * (1 - u)})`);
        gr.addColorStop(1, 'rgba(240,236,220,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    }
    // the fence bends a little when leaned on
    g.save();
    g.translate(0, lean * 4);
    drawLayer(g, fence, 0, 0);
    g.restore();
    for (let i = 0; i < 18; i++) {
      const r2 = makeRng(780 + i);
      grassTuft(g, r2.range(-80, 1160), r2.range(1500, 1720), r2.range(40, 80), { count: 8, seed: 790 + i, color: '#6f8a44', dark: '#45592a', sway: wobble(t, i, 0.3) * 0.3 });
    }
    setCam(g, S);
    drawPanel(g, t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const H = g.canvas.height;
    const vg = g.createLinearGradient(0, H * 0.62, 0, H);
    vg.addColorStop(0, 'rgba(20,14,6,0)');
    vg.addColorStop(1, 'rgba(20,14,6,0.42)');
    g.fillStyle = vg;
    g.fillRect(0, H * 0.62, g.canvas.width, H * 0.38);
  }
  return { draw };
}
