// 0:42-0:48 A T. rex behind a thick steel fence: breathing, a low growl with the jaw parted, a nudge
// that rattles the bars. Then a line-art panel: bite force bars, T. rex about 8x a lion.
import { Layer, drawLayer, smoothPath, stipple, scribble, hatch, rgba, shade, mix, INK, sparkle, mottle, paintShape, cloud } from '../kit/paint.js';
import { makeRng, clamp, lerp, smoothstep, easeOutBack, easeInOut, easeOut, TAU, wobble } from '../kit/util.js';
import { setCam, shakeOffset } from '../kit/cam.js';
import { buildTrex, trexPose, drawCreature, TREX_GROUND } from '../kit/trex.js';
import { grassTuft, trunk } from '../kit/plants.js';

export const PLACE = { x: 830, y: 905, s: 1.12 };
const NUDGE = 44.05;
const GROWL = 43.15;

export function trexCam(t) {
  const push = smoothstep(42.0, 48.6, t);
  const rattle = Math.exp(-Math.max(0, t - NUDGE) * 5) * (t > NUDGE ? 3.5 : 0);
  const [sx, sy] = shakeOffset(t, rattle, 9, 16);
  return { x: 540 + push * 10 + sx, y: 980 - push * 20 + sy, z: 1 + push * 0.05 };
}

export function sceneTrexPose(t) {
  const lower = smoothstep(42.9, 43.6, t) * (1 - smoothstep(44.6, 45.4, t));
  const push = Math.exp(-Math.pow((t - NUDGE) / 0.18, 2));
  const growl = smoothstep(GROWL, GROWL + 0.35, t) * (1 - smoothstep(44.4, 44.9, t));
  const settle = smoothstep(47.0, 47.6, t);
  const p = trexPose(t, { headUp: 0.16 * lower - push * 0.05, neck: -0.12 * lower - push * 0.08, jaw: 0.16 * growl * (0.8 + 0.2 * Math.sin(t * 20)), lean: 0.02 * push });
  if (settle > 0) for (const k of Object.keys(p)) if (typeof p[k] === 'number') p[k] *= 1 - settle * 0.85;
  return p;
}

function buildBackground(S) {
  const res = S * 1.1;
  const L = new Layer(1300, 2100, res, 110, 90);
  const g = L.g;
  const sky = g.createLinearGradient(0, -90, 0, 1150);
  sky.addColorStop(0, '#cfd5c9');
  sky.addColorStop(0.6, '#e6e0c6');
  sky.addColorStop(1, '#efe6c9');
  g.fillStyle = sky;
  g.fillRect(-110, -90, 1300, 2100);
  // storybook clouds
  const rng = makeRng(801);
  for (let i = 0; i < 9; i++) cloud(g, rng.range(-60, 1140), rng.range(120, 640), rng.range(160, 300), 820 + i);
  // far hills
  for (const [y0, col, amp, seed] of [
    [980, '#b9c3a2', 60, 1],
    [1040, '#9fae86', 40, 2],
  ]) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(-110, 2010);
    for (let x = -110; x <= 1190; x += 20) g.lineTo(x, y0 - Math.sin(x * 0.005 + seed) * amp - Math.sin(x * 0.013 + seed * 2) * amp * 0.4);
    g.lineTo(1190, 2010);
    g.fill();
  }
  // tree line
  for (let i = 0; i < 40; i++) {
    const x = rng.range(-100, 1180);
    const y = 1030 + rng.range(-20, 20);
    const r = rng.range(16, 36);
    g.fillStyle = rng.pick(['#7f9168', '#71845d', '#8c9c72']);
    g.beginPath();
    g.ellipse(x, y - r, r * 0.8, r, 0, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(INK, 0.35);
    g.lineWidth = 0.6;
    g.stroke();
  }
  // enclosure ground
  const gr = g.createLinearGradient(0, 1060, 0, 2010);
  gr.addColorStop(0, '#a4a873');
  gr.addColorStop(0.4, '#8b8c58');
  gr.addColorStop(1, '#5d5b37');
  g.fillStyle = gr;
  g.fillRect(-110, 1065, 1300, 950);
  hatch(g, { x: -110, y: 1065, w: 1300, h: 950 }, { angle: -0.05, spacing: 5, width: 0.6, color: '#4c4a2a', alpha: 0.25, seed: 802, broken: 0.6 });
  stipple(g, null, { x: -110, y: 1065, w: 1300, h: 950 }, { count: 14000, r: [0.4, 1.2], color: '#3b3a20', alpha: 0.35, seed: 803 });
  for (let i = 0; i < 70; i++) grassTuft(g, rng.range(-100, 1180), rng.range(1090, 1900), rng.range(14, 40), { count: 9, seed: 810 + i, color: '#8e9a5a', dark: '#5f6a3a' });
  return L;
}

function buildFence(S) {
  const res = S * 1.2;
  const L = new Layer(1300, 1500, res, 110, -560);
  const g = L.g;
  const steel = '#6f7476';
  const posts = [-30, 450, 930];
  const bars = [860, 1110, 1360];
  // horizontal bars (behind posts)
  for (const y of bars) {
    const p = new Path2D();
    p.rect(-110, y - 16, 1300, 32);
    paintShape(L, p, { fill: '#7b8183', light: [0, -1], shadowDepth: 14, shadowAlpha: 0.6, hatchSpacing: 2.2, seed: y, mottle: false, cross: false });
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-110, y - 10);
    g.lineTo(1190, y - 10);
    g.stroke();
  }
  // posts: thick I-beams with bolts and a warning band
  for (const x of posts) {
    const p = new Path2D();
    p.rect(x - 34, 640, 68, 1420);
    paintShape(L, p, { fill: steel, light: [-1, -0.2], shadowDepth: 26, shadowAlpha: 0.65, cross: true, hatchSpacing: 2.2, seed: x + 900, mottle: true });
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(x - 26, 640, 8, 1420);
    // cap
    g.fillStyle = '#5b6062';
    g.fillRect(x - 42, 626, 84, 20);
    g.strokeStyle = rgba(INK, 0.9);
    g.lineWidth = 1.2;
    g.strokeRect(x - 42, 626, 84, 20);
    // warning stripes
    g.save();
    g.beginPath();
    g.rect(x - 34, 700, 68, 90);
    g.clip();
    g.fillStyle = '#e2b13c';
    g.fillRect(x - 34, 700, 68, 90);
    g.fillStyle = '#2b2219';
    for (let k = -4; k < 8; k++) {
      g.beginPath();
      g.moveTo(x - 34 + k * 26, 700);
      g.lineTo(x - 34 + k * 26 + 13, 700);
      g.lineTo(x - 34 + k * 26 + 13 - 90, 790);
      g.lineTo(x - 34 + k * 26 - 90, 790);
      g.fill();
    }
    g.restore();
    g.strokeStyle = rgba(INK, 0.9);
    g.strokeRect(x - 34, 700, 68, 90);
    // bolts at bar crossings
    for (const y of bars) {
      for (const dy of [-8, 8]) {
        g.fillStyle = '#4a4f51';
        g.beginPath();
        g.arc(x, y + dy, 5, 0, TAU);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.beginPath();
        g.arc(x - 1.5, y + dy - 1.5, 1.6, 0, TAU);
        g.fill();
      }
    }
  }
  return { L, posts, bars };
}

// Line-art bite force panel, timed to "A T-rex bites about eight times harder than a lion": it
// opens on "bites" (43.1 s), the lion's 1x bar is set down, the T. rex bar grows to 8x as he says
// "eight times" (43.8-44.5 s), and the lion row lights up on "lion" (45.4 s).
const PANEL = 43.1;
function drawPanel(g, t) {
  const a = smoothstep(PANEL, PANEL + 0.35, t) * (1 - smoothstep(47.15, 47.55, t));
  if (a <= 0) return;
  const pop = easeOutBack(clamp((t - PANEL) / 0.45), 1.2);
  g.save();
  g.globalAlpha = a;
  g.translate(540, 390);
  g.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);
  g.translate(-540, -390);
  const X0 = 80;
  const Y0 = 150;
  const W = 920;
  const H = 480;
  g.fillStyle = 'rgba(24,15,11,0.94)';
  g.beginPath();
  g.roundRect(X0, Y0, W, H, 26);
  g.fill();
  g.strokeStyle = '#f1e3c2';
  g.lineWidth = 2.4;
  g.stroke();
  g.strokeStyle = 'rgba(142,143,214,0.6)';
  g.lineWidth = 1;
  g.beginPath();
  g.roundRect(X0 + 12, Y0 + 12, W - 24, H - 24, 18);
  g.stroke();
  const unit = 70;
  const bx = 300;
  const rows = [
    { y: 300, n: 1, t0: 43.38, label: 'lion' },
    { y: 480, n: 8, t0: 43.78, label: 'T. rex' },
  ];
  // ruler ticks (one per lion bite)
  g.strokeStyle = 'rgba(142,143,214,0.75)';
  g.lineWidth = 1;
  for (let k = 0; k <= 8; k++) {
    const x = bx + k * unit;
    g.beginPath();
    g.moveTo(x, 228);
    g.lineTo(x, k % 4 === 0 ? 556 : 548);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(bx, 552);
  g.lineTo(bx + 8 * unit, 552);
  g.stroke();
  const lionGlow = Math.exp(-Math.pow((t - 45.55) / 0.3, 2));
  for (const r of rows) {
    const grow = easeOut(clamp((t - r.t0) / (r.n === 1 ? 0.35 : 0.8)));
    const len = unit * r.n * grow;
    if (r.n === 1 && lionGlow > 0.01) {
      g.fillStyle = `rgba(255,224,160,${0.35 * lionGlow})`;
      g.fillRect(bx - 8, r.y - 30, len + 16, 60);
    }
    // bar: gold fill with cream outline and a hatched shadow strip
    g.fillStyle = '#e8b04a';
    g.fillRect(bx, r.y - 22, len, 44);
    g.save();
    g.beginPath();
    g.rect(bx, r.y + 6, len, 16);
    g.clip();
    hatch(g, { x: bx, y: r.y + 6, w: Math.max(1, len), h: 16 }, { angle: -0.9, spacing: 3, width: 0.8, color: '#5a3a10', alpha: 0.6, seed: r.n });
    g.restore();
    g.strokeStyle = '#f1e3c2';
    g.lineWidth = 2;
    g.strokeRect(bx, r.y - 22, len, 44);
    if (grow > 0 && grow < 1) sparkle(g, bx + len, r.y, 11, '#fff2c8', 1);
    // multiplier at the bar end
    g.fillStyle = '#f1e3c2';
    g.font = 'italic 500 40px "EBGaramond"';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    if (grow > 0.98) g.fillText(`${r.n}×`, bx + len + 16, r.y + 2);
    // label
    g.font = '500 34px "EBGaramond"';
    g.textAlign = 'left';
    g.fillText(r.label, X0 + 34, r.y + 2);
  }
  // icons: line-art lion head and T. rex skull
  g.strokeStyle = '#f1e3c2';
  g.lineWidth = 2;
  // lion: zigzag mane ring, face
  const lx = bx - 52;
  const ly = 300;
  g.beginPath();
  for (let k = 0; k <= 24; k++) {
    const ang = (k / 24) * TAU;
    const rr = k % 2 ? 34 : 42;
    const x = lx + Math.cos(ang) * rr;
    const y = ly + Math.sin(ang) * rr;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.beginPath();
  g.arc(lx, ly + 2, 22, 0, TAU);
  g.stroke();
  g.fillStyle = '#f1e3c2';
  g.beginPath();
  g.arc(lx - 8, ly - 4, 2.6, 0, TAU);
  g.arc(lx + 8, ly - 4, 2.6, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(lx - 5, ly + 6);
  g.lineTo(lx + 5, ly + 6);
  g.lineTo(lx, ly + 11);
  g.closePath();
  g.fill();
  // T. rex skull
  g.save();
  g.translate(bx - 40, 484);
  g.scale(0.28, 0.28);
  g.lineWidth = 5.5;
  g.stroke(smoothPath([[90, -10], [70, -60], [20, -78], [-40, -70], [-110, -56], [-170, -40], [-196, -14], [-186, 10], [-110, 20], [-20, 28], [60, 30]], true));
  g.beginPath();
  g.ellipse(10, -36, 18, 14, 0, 0, TAU);
  g.ellipse(-60, -22, 26, 14, 0.1, 0, TAU);
  g.stroke();
  for (let k = 0; k < 8; k++) {
    const x = -180 + k * 22;
    g.beginPath();
    g.moveTo(x, 16);
    g.lineTo(x + 6, 36);
    g.lineTo(x + 12, 18);
    g.stroke();
  }
  g.restore();
  g.restore();
}

export async function build(env) {
  const { S } = env;
  const bg = buildBackground(S);
  const fence = buildFence(S);
  const rex = buildTrex(S * PLACE.s * 1.25);
  const rng = makeRng(830);
  const fgGrass = Array.from({ length: 26 }, () => ({ x: rng.range(-60, 1140), y: rng.range(1560, 1700), h: rng.range(50, 110), seed: rng.int(1, 9999) }));

  function draw(g, t) {
    const c = trexCam(t);
    setCam(g, S, 540 + (c.x - 540) * 0.4, 960 + (c.y - 960) * 0.4, 1 + (c.z - 1) * 0.4);
    drawLayer(g, bg, 0, 0);
    setCam(g, S, c.x, c.y, c.z);
    // T. rex shadow on the ground, then the animal
    g.fillStyle = 'rgba(40,36,20,0.35)';
    g.beginPath();
    g.ellipse(PLACE.x - 40, PLACE.y + TREX_GROUND * PLACE.s + 4, 360, 26, 0, 0, TAU);
    g.fill();
    g.save();
    g.translate(PLACE.x, PLACE.y);
    g.scale(PLACE.s, PLACE.s);
    drawCreature(g, rex, sceneTrexPose(t));
    g.restore();
    // fence, bars rattling after the nudge
    const rat = t > NUDGE ? Math.exp(-(t - NUDGE) * 3.2) : 0;
    g.save();
    g.translate(Math.sin(t * 70) * 3 * rat, Math.sin(t * 53) * 1.5 * rat);
    drawLayer(g, fence.L, 0, 0);
    g.restore();
    // foreground grass blades
    for (const b of fgGrass) grassTuft(g, b.x, b.y, b.h, { count: 7, seed: b.seed, color: '#6b7a40', dark: '#3f4a26', sway: wobble(t, b.seed, 0.3) * 0.3 });
    setCam(g, S);
    drawPanel(g, t);
    // bottom vignette for the captions
    g.setTransform(1, 0, 0, 1, 0, 0);
    const H = g.canvas.height;
    const vg = g.createLinearGradient(0, H * 0.6, 0, H);
    vg.addColorStop(0, 'rgba(20,14,6,0)');
    vg.addColorStop(1, 'rgba(20,14,6,0.45)');
    g.fillStyle = vg;
    g.fillRect(0, H * 0.6, g.canvas.width, H * 0.4);
  }

  return { draw };
}
