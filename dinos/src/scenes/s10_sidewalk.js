// 0:54-1:00 A city sidewalk in front of a little bakery. Passers-by walk past; a pigeon walks into
// frame with its head-bob, stops, and turns its head to look at us.
import { Layer, drawLayer, smoothPath, stipple, hatch, rgba, shade, mix, INK, paintShape, scribble, mottle } from '../kit/paint.js';
import { makeRng, clamp, lerp, smoothstep, easeInOut, easeOut, TAU, wobble } from '../kit/util.js';
import { setCam } from '../kit/cam.js';
import { buildPigeon, drawPigeon, PIGEON_GROUND } from '../kit/pigeon.js';

const BASE = 1000; // where the shop front meets the pavement
const WALK_Y = 1040; // passers-by feet

function buildStreet(S) {
  const res = S * 1.1;
  const L = new Layer(1300, 2100, res, 110, 90);
  const g = L.g;
  const rng = makeRng(1101);
  // brick facade
  const wall = new Path2D();
  wall.rect(-110, -90, 1300, BASE + 90);
  g.fillStyle = '#b5664a';
  g.fill(wall);
  mottle(g, wall, { x: -110, y: -90, w: 1300, h: BASE + 90 }, { base: '#b5664a', count: 60, size: [60, 160], amount: 0.12, seed: 1102 });
  g.strokeStyle = rgba('#efe0cc', 0.55);
  g.lineWidth = 1.2;
  for (let y = -90, row = 0; y < BASE; y += 22, row++) {
    g.beginPath();
    g.moveTo(-110, y);
    g.lineTo(1190, y);
    g.stroke();
    for (let x = -110 + (row % 2) * 30; x < 1190; x += 60) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 22);
      g.stroke();
    }
  }
  // per-brick tone
  for (let y = -90, row = 0; y < BASE; y += 22, row++) {
    for (let x = -110 + (row % 2) * 30; x < 1190; x += 60) {
      if (!rng.chance(0.3)) continue;
      g.fillStyle = rgba(rng.chance(0.5) ? '#8e4a34' : '#cf8a6a', 0.35);
      g.fillRect(x + 1.5, y + 1.5, 57, 19);
    }
  }
  hatch(g, { x: -110, y: -90, w: 1300, h: BASE + 90 }, { angle: -0.9, spacing: 4, width: 0.5, color: '#3d1f14', alpha: 0.15, seed: 1103, broken: 0.6 });
  // shop window with frame, display and reflections
  const win = new Path2D();
  win.rect(140, 470, 620, 470);
  g.fillStyle = '#3f4f55';
  g.fill(win);
  g.save();
  g.clip(win);
  const wg = g.createLinearGradient(140, 470, 760, 940);
  wg.addColorStop(0, '#6d8890');
  wg.addColorStop(1, '#2f3c42');
  g.fillStyle = wg;
  g.fill(win);
  // bread loaves and plants inside
  for (let i = 0; i < 7; i++) {
    const x = 190 + i * 80;
    const p = new Path2D();
    p.ellipse(x, 840, 34, 18, 0, 0, TAU);
    paintShape(L, p, { fill: '#c9914f', light: [-0.6, -1], shadowDepth: 10, hatchSpacing: 2, seed: 1110 + i, cross: false });
    g.strokeStyle = 'rgba(255,240,210,0.7)';
    g.lineWidth = 1.5;
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.moveTo(x + k * 12 - 6, 832);
      g.lineTo(x + k * 12 + 6, 828);
      g.stroke();
    }
  }
  g.fillStyle = '#d8cdb5';
  g.fillRect(150, 860, 600, 14);
  for (let i = 0; i < 4; i++) {
    const x = 220 + i * 160;
    g.fillStyle = '#5c7f4a';
    for (let k = 0; k < 9; k++) {
      g.beginPath();
      g.ellipse(x + rng.range(-24, 24), 640 + rng.range(-30, 30), 14, 8, rng.range(0, 3), 0, TAU);
      g.fill();
    }
  }
  g.fillStyle = 'rgba(255,255,255,0.18)';
  for (const [x0, w] of [[200, 70], [300, 26], [520, 90], [640, 30]]) {
    g.beginPath();
    g.moveTo(x0, 470);
    g.lineTo(x0 + w, 470);
    g.lineTo(x0 + w - 260, 940);
    g.lineTo(x0 - 260, 940);
    g.fill();
  }
  g.restore();
  g.strokeStyle = '#efe6d2';
  g.lineWidth = 12;
  g.strokeRect(140, 470, 620, 470);
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(450, 470);
  g.lineTo(450, 940);
  g.stroke();
  g.strokeStyle = rgba(INK, 0.9);
  g.lineWidth = 1.2;
  g.strokeRect(134, 464, 632, 482);
  // door
  const door = new Path2D();
  door.rect(830, 470, 190, 530);
  paintShape(L, door, { fill: '#3e5a4a', light: [-1, -0.4], shadowDepth: 30, hatchSpacing: 2.2, seed: 1120, cross: false });
  g.fillStyle = '#6d8890';
  g.fillRect(856, 500, 138, 220);
  g.strokeStyle = '#efe6d2';
  g.lineWidth = 6;
  g.strokeRect(856, 500, 138, 220);
  g.fillStyle = '#d9b45a';
  g.beginPath();
  g.arc(992, 780, 7, 0, TAU);
  g.fill();
  // striped awning
  const aw = new Path2D();
  aw.moveTo(110, 350);
  aw.lineTo(1050, 350);
  aw.lineTo(1080, 450);
  aw.lineTo(80, 450);
  aw.closePath();
  g.save();
  g.clip(aw);
  for (let x = 60; x < 1100; x += 60) {
    g.fillStyle = (x / 60) % 2 ? '#efe6d2' : '#4f7a5c';
    g.beginPath();
    g.moveTo(x, 350);
    g.lineTo(x + 60, 350);
    g.lineTo(x + 62, 450);
    g.lineTo(x + 2, 450);
    g.fill();
  }
  g.fillStyle = 'rgba(40,30,20,0.18)';
  g.fillRect(60, 410, 1100, 40);
  g.restore();
  // scalloped valance
  for (let x = 80; x < 1080; x += 40) {
    g.fillStyle = ((x - 80) / 40) % 2 ? '#efe6d2' : '#4f7a5c';
    g.beginPath();
    g.arc(x + 20, 450, 20, 0, Math.PI);
    g.fill();
    g.strokeStyle = rgba(INK, 0.6);
    g.lineWidth = 0.8;
    g.stroke();
  }
  g.strokeStyle = rgba(INK, 0.8);
  g.lineWidth = 1.2;
  g.stroke(aw);
  // sign board (blank, no lettering) and wall lamp
  g.fillStyle = '#2f3b33';
  g.fillRect(260, 200, 440, 100);
  g.strokeStyle = '#d9b45a';
  g.lineWidth = 4;
  g.strokeRect(272, 212, 416, 76);
  // a loaf icon on the sign instead of a name
  const lp = new Path2D();
  lp.ellipse(480, 250, 60, 26, 0, 0, TAU);
  g.fillStyle = '#d9b45a';
  g.fill(lp);
  g.strokeStyle = '#2f3b33';
  g.lineWidth = 3;
  for (let k = -1; k <= 1; k++) {
    g.beginPath();
    g.moveTo(480 + k * 24 - 8, 244);
    g.lineTo(480 + k * 24 + 8, 236);
    g.stroke();
  }
  // pavement in perspective
  const pv = g.createLinearGradient(0, BASE, 0, 2010);
  pv.addColorStop(0, '#b9b4a8');
  pv.addColorStop(1, '#8f8a80');
  g.fillStyle = pv;
  g.fillRect(-110, BASE, 1300, 1010);
  g.fillStyle = '#7f7a70';
  g.fillRect(-110, BASE, 1300, 10);
  g.strokeStyle = rgba('#5f5a52', 0.6);
  g.lineWidth = 1.4;
  let y = BASE + 40;
  let k = 1;
  while (y < 2010) {
    g.beginPath();
    g.moveTo(-110, y);
    g.lineTo(1190, y);
    g.stroke();
    k++;
    y += 30 + k * k * 4;
  }
  for (let i = -12; i <= 12; i++) {
    g.beginPath();
    g.moveTo(540 + i * 90, BASE);
    g.lineTo(540 + i * 330, 2010);
    g.stroke();
  }
  stipple(g, null, { x: -110, y: BASE, w: 1300, h: 1010 }, { count: 22000, r: [0.4, 1.2], color: '#3c3830', alpha: 0.35, seed: 1130 });
  stipple(g, null, { x: -110, y: BASE, w: 1300, h: 1010 }, { count: 8000, r: [0.4, 1.0], color: '#f2eee4', alpha: 0.35, seed: 1131 });
  scribble(g, null, { x: -110, y: BASE + 100, w: 1300, h: 900 }, { count: 160, len: [10, 26], color: '#3c3830', alpha: 0.18, seed: 1132 });
  // a few fallen leaves and a crack
  for (let i = 0; i < 14; i++) {
    const x = rng.range(-80, 1160);
    const yy = rng.range(BASE + 60, 1900);
    g.save();
    g.translate(x, yy);
    g.rotate(rng.range(0, TAU));
    g.scale(1, 0.55);
    g.fillStyle = rng.pick(['#c98a3a', '#b5662f', '#d9a44a']);
    g.beginPath();
    g.ellipse(0, 0, 12, 6, 0, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(INK, 0.5);
    g.lineWidth = 0.6;
    g.stroke();
    g.restore();
  }
  g.strokeStyle = rgba('#3c3830', 0.7);
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(180, 1500);
  g.lineTo(230, 1530);
  g.lineTo(250, 1580);
  g.lineTo(310, 1610);
  g.stroke();
  // lamp post on the left
  g.fillStyle = '#2f3533';
  g.fillRect(36, 120, 16, 900);
  g.fillRect(24, 1000, 40, 30);
  g.beginPath();
  g.moveTo(44, 140);
  g.quadraticCurveTo(44, 90, 110, 90);
  g.lineTo(110, 100);
  g.quadraticCurveTo(56, 100, 56, 140);
  g.fill();
  g.fillStyle = '#fff1c4';
  g.beginPath();
  g.moveTo(96, 100);
  g.lineTo(124, 100);
  g.lineTo(118, 122);
  g.lineTo(102, 122);
  g.closePath();
  g.fill();
  return L;
}

// Simple illustrated passer-by, drawn each frame. kind: 'woman' (long skirt, loose cardigan, hair
// visible), 'man' (long coat, trousers). Facing dir (1 = walking right). h = height.
function drawPerson(g, kind, x, y, h, dir, phase, palette) {
  const s = h / 560;
  g.save();
  g.translate(x, y);
  g.scale(s * dir, s);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const sw = Math.sin(phase);
  const ink = rgba(INK, 0.9);
  const bob = Math.abs(Math.cos(phase)) * 6;
  g.translate(0, -bob);
  // back arm
  g.strokeStyle = shade(palette.top, -0.25);
  g.lineWidth = 28;
  g.beginPath();
  g.moveTo(0, -420);
  g.lineTo(-sw * 40, -300);
  g.stroke();
  if (kind === 'woman') {
    // feet peeking under the long skirt
    for (const k of [-1, 1]) {
      g.fillStyle = '#4a3828';
      g.beginPath();
      g.ellipse(sw * 26 * k + 10, -8 + Math.max(0, -Math.cos(phase) * k) * -10, 26, 10, 0, 0, TAU);
      g.fill();
    }
    // long A-line skirt, hem swaying
    const skirt = new Path2D();
    skirt.moveTo(-50, -300);
    skirt.lineTo(50, -300);
    skirt.lineTo(90 + sw * 18, -20);
    skirt.quadraticCurveTo(0, -8 + sw * 6, -90 + sw * 18, -20);
    skirt.closePath();
    g.fillStyle = palette.bottom;
    g.fill(skirt);
    g.strokeStyle = ink;
    g.lineWidth = 2.5;
    g.stroke(skirt);
    g.strokeStyle = rgba(shade(palette.bottom, -0.3), 0.6);
    g.lineWidth = 2;
    for (const k of [-0.5, 0, 0.5]) {
      g.beginPath();
      g.moveTo(k * 40, -290);
      g.quadraticCurveTo(k * 70 + sw * 8, -150, k * 90 + sw * 16, -24);
      g.stroke();
    }
  } else {
    // trousers: two legs swinging
    for (const k of [-1, 1]) {
      const a = sw * 0.38 * k;
      g.strokeStyle = palette.bottom;
      g.lineWidth = 36;
      g.beginPath();
      g.moveTo(0, -270);
      g.lineTo(Math.sin(a) * 250, -270 + Math.cos(a) * 250);
      g.stroke();
      g.fillStyle = '#2e2620';
      g.beginPath();
      g.ellipse(Math.sin(a) * 262 + 14, -270 + Math.cos(a) * 262, 28, 12, 0, 0, TAU);
      g.fill();
    }
  }
  // torso: loose cardigan or long coat
  const top = new Path2D();
  if (kind === 'woman') {
    top.moveTo(-46, -470);
    top.quadraticCurveTo(0, -490, 46, -470);
    top.lineTo(66, -270);
    top.lineTo(-62, -270);
    top.closePath();
  } else {
    top.moveTo(-50, -470);
    top.quadraticCurveTo(0, -490, 50, -470);
    top.lineTo(64, -160);
    top.lineTo(-64, -160);
    top.closePath();
  }
  g.fillStyle = palette.top;
  g.fill(top);
  g.strokeStyle = ink;
  g.lineWidth = 2.5;
  g.stroke(top);
  g.save();
  g.clip(top);
  hatch(g, { x: 0, y: -500, w: 80, h: 360 }, { angle: -0.9, spacing: 5, width: 1.2, color: '#2a1a10', alpha: 0.3, seed: 7 });
  g.restore();
  // scarf / collar
  g.fillStyle = palette.accent;
  g.beginPath();
  g.ellipse(4, -466, 40, 14, 0, 0, TAU);
  g.fill();
  // front arm
  g.strokeStyle = palette.top;
  g.lineWidth = 28;
  g.beginPath();
  g.moveTo(10, -430);
  g.lineTo(sw * 40 + 10, -300);
  g.stroke();
  g.fillStyle = palette.skin;
  g.beginPath();
  g.arc(sw * 40 + 10, -292, 14, 0, TAU);
  g.fill();
  if (palette.bag) {
    g.fillStyle = palette.bag;
    g.beginPath();
    g.roundRect(sw * 40 - 20, -296, 60, 70, 8);
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = 2;
    g.stroke();
  }
  // neck and head
  g.fillStyle = palette.skin;
  g.fillRect(-12, -500, 24, 30);
  g.beginPath();
  g.ellipse(6, -536, 36, 42, 0, 0, TAU);
  g.fill();
  g.strokeStyle = ink;
  g.lineWidth = 2.2;
  g.stroke();
  // hair (visible)
  g.fillStyle = palette.hair;
  g.beginPath();
  if (kind === 'woman') {
    g.ellipse(-2, -548, 40, 36, 0, Math.PI * 0.95, Math.PI * 2.1);
    g.fill();
    g.beginPath();
    g.ellipse(-30, -520, 16, 44, 0.15, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(-30, -566, 18, 0, TAU); // bun
    g.fill();
  } else {
    g.ellipse(2, -560, 38, 24, 0, Math.PI, Math.PI * 2.05);
    g.fill();
  }
  // eye and nose hint
  g.fillStyle = '#2a1a10';
  g.beginPath();
  g.arc(26, -540, 3.5, 0, TAU);
  g.fill();
  g.strokeStyle = rgba('#7a4a30', 0.8);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(40, -536);
  g.lineTo(44, -522);
  g.lineTo(38, -520);
  g.stroke();
  g.restore();
}

export async function build(env) {
  const { S } = env;
  const street = buildStreet(S);
  const P = buildPigeon(S * 1.6);
  const PG = { x: 560, y: 1236, s: 1.45 };
  const people = [
    { kind: 'man', dir: 1, t0: 53.9, t1: 59.0, x0: -160, x1: 1240, h: 560, palette: { top: '#b98c5a', bottom: '#3f4450', accent: '#8c3b32', skin: '#e2b896', hair: '#3a2a1e' } },
    { kind: 'woman', dir: -1, t0: 55.2, t1: 60.6, x0: 1260, x1: -180, h: 540, palette: { top: '#e7dcc4', bottom: '#4f6f7a', accent: '#c9874a', skin: '#c99772', hair: '#4a2e1c', bag: '#9a6a3a' } },
  ];

  // pigeon walk: in from the right, decelerating to a stop; head-bob locked to the steps
  function pigeonPose(t) {
    const u = clamp((t - 54.4) / 2.9);
    const e = 1 - Math.pow(1 - u, 2.2);
    const x = lerp(1240, PG.x, e);
    const walking = 1 - smoothstep(0.85, 1, u);
    const dist = 1240 - x;
    const step = dist / 26; // radians of gait per unit travelled
    const bob = (((step / Math.PI) % 1) - 0.5) * 14 * walking;
    const turn = smoothstep(57.55, 57.85, t);
    const coo = Math.exp(-Math.pow((t - 58.15) / 0.35, 2));
    return { x, y: PG.y, s: PG.s, step, walking, bob, turn, coo };
  }

  function draw(g, t) {
    const push = smoothstep(53.6, 60, t);
    setCam(g, S, 540, 960 + push * 30, 1 + push * 0.06);
    drawLayer(g, street, 0, 0);
    for (const p of people) {
      const u = (t - p.t0) / (p.t1 - p.t0);
      if (u < 0 || u > 1) continue;
      const x = lerp(p.x0, p.x1, u);
      // soft shadow
      g.fillStyle = 'rgba(30,26,20,0.25)';
      g.beginPath();
      g.ellipse(x, WALK_Y + 4, 70, 10, 0, 0, TAU);
      g.fill();
      drawPerson(g, p.kind, x, WALK_Y, p.h, p.dir, (t - p.t0) * 5.6, p.palette);
    }
    const pp = pigeonPose(t);
    g.fillStyle = 'rgba(30,26,20,0.3)';
    g.beginPath();
    g.ellipse(pp.x + 40 * PG.s, PG.y + 4, 100 * PG.s, 12, 0, 0, TAU);
    g.fill();
    g.save();
    // a little puff of the chest when it coos
    drawPigeon(g, P, { ...pp, s: PG.s * (1 + pp.coo * 0.03) });
    g.restore();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const H = g.canvas.height;
    const vg = g.createLinearGradient(0, H * 0.66, 0, H);
    vg.addColorStop(0, 'rgba(20,14,6,0)');
    vg.addColorStop(1, 'rgba(20,14,6,0.4)');
    g.fillStyle = vg;
    g.fillRect(0, H * 0.66, g.canvas.width, H * 0.34);
  }
  return { draw };
}
