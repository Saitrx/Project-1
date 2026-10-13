// 0:23-0:30 A modern city ringed by tall walls; the camera pans across it. A long-necked dinosaur
// standing beyond the elevated highway lifts its head up over the road; the cars brake and stop
// (brake lights, horns) and it calls, a deep rumble echoing off the walls.
import { Layer, drawLayer, smoothPath, stipple, hatch, rgba, shade, mix, INK, sparkle, cloud, paintShape, scales, mottle, glossyBall, sampleSpline, tube, scribble } from '../kit/paint.js';
import { makeRng, clamp, lerp, smoothstep, easeOutBack, easeInOut, easeOut, TAU, wobble, keys } from '../kit/util.js';
import { setCam } from '../kit/cam.js';
import { grassTuft } from '../kit/plants.js';

const SUN = { x: 820, y: 318, r: 56 };
const BRAKE = 25.15;
const DECK = 1188; // far edge of the highway deck

function building(L, x, w, h, base, color, seed) {
  const g = L.g;
  const rng = makeRng(seed);
  const p = new Path2D();
  const top = base - h;
  p.rect(x, top, w, h);
  paintShape(L, p, { fill: color, light: [-1, -0.25], shadowDepth: w * 0.35, shadowAlpha: 0.45, hatchSpacing: 2.4, hatchAlpha: 0.35, seed, cross: false, mottle: false });
  // windows grid
  const cols = Math.max(2, Math.floor(w / 18));
  const ww = (w - 10) / cols;
  for (let y = top + 12; y < base - 14; y += 22) {
    for (let c = 0; c < cols; c++) {
      const lit = rng.chance(0.18);
      g.fillStyle = lit ? 'rgba(255,226,150,0.9)' : rgba(shade(color, -0.32), 0.85);
      g.fillRect(x + 5 + c * ww + 2, y, ww - 5, 12);
    }
  }
  // roof details
  g.fillStyle = shade(color, -0.25);
  if (rng.chance(0.5)) g.fillRect(x + w * 0.2, top - 14, w * 0.25, 14);
  if (rng.chance(0.4)) {
    g.strokeStyle = rgba(INK, 0.8);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x + w * 0.7, top);
    g.lineTo(x + w * 0.7, top - 40);
    g.stroke();
  }
  g.strokeStyle = rgba(INK, 0.85);
  g.lineWidth = 1;
  g.strokeRect(x, top, w, h);
}

function buildCity(S) {
  const res = S * 1.1;
  const sky = new Layer(1080, 1920, res, 0, 0);
  {
    const g = sky.g;
    const gr = g.createLinearGradient(0, 0, 0, 1000);
    gr.addColorStop(0, '#b6cfdc');
    gr.addColorStop(0.6, '#e9e4cf');
    gr.addColorStop(1, '#f3e3c2');
    g.fillStyle = gr;
    g.fillRect(0, 0, 1080, 1920);
    const rng = makeRng(501);
    for (let i = 0; i < 6; i++) cloud(g, rng.range(-40, 1120), rng.range(130, 560), rng.range(140, 250), 520 + i);
  }
  // skyline (behind the wall), wide for panning
  const city = new Layer(1900, 1100, res, 400, 0);
  {
    const rng = makeRng(530);
    const cols = ['#c9b8a0', '#b9a58d', '#d4c7ad', '#a8957f', '#c2b29a', '#9fa7a8', '#b8bfbf'];
    // far row (paler) then near row
    for (const [base, hmin, hmax, fade] of [
      [930, 220, 420, 0.35],
      [960, 160, 520, 0],
    ]) {
      let x = -400;
      while (x < 1500) {
        const w = rng.range(60, 140);
        const h = rng.range(hmin, hmax) * (Math.abs(x - 560) < 300 ? 1.25 : 1);
        building(city, x, w, h, base, mix(rng.pick(cols), '#e8e6dc', fade), rng.int(1, 9999));
        x += w + rng.range(4, 18);
      }
    }
  }
  // the ring wall: a curved band bulging toward us, with buttresses and watch posts
  const wall = new Layer(1900, 700, res, 400, -560);
  {
    const g = wall.g;
    const topY = (x) => 700 - 30 * Math.cos(((x - 560) / 1500) * Math.PI);
    const botY = (x) => 1000 + 40 * Math.cos(((x - 560) / 1500) * Math.PI);
    const pts = [];
    for (let x = -400; x <= 1500; x += 40) pts.push([x, topY(x)]);
    for (let x = 1500; x >= -400; x -= 40) pts.push([x, botY(x)]);
    const band = new Path2D();
    pts.forEach(([x, y], i) => (i ? band.lineTo(x, y) : band.moveTo(x, y)));
    band.closePath();
    paintShape(wall, band, { fill: '#cfc8b8', light: [0, -1], shadowDepth: 60, shadowAlpha: 0.4, hatchSpacing: 2.6, seed: 541, cross: false });
    g.save();
    g.clip(band);
    // panel joints
    g.strokeStyle = rgba('#6c665a', 0.55);
    g.lineWidth = 1;
    for (let x = -400; x < 1500; x += 34) {
      g.beginPath();
      g.moveTo(x, topY(x));
      g.lineTo(x + 2, botY(x));
      g.stroke();
    }
    for (let k = 1; k < 6; k++) {
      g.beginPath();
      for (let x = -400; x <= 1500; x += 40) {
        const y = lerp(topY(x), botY(x), k / 6);
        if (x === -400) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    stipple(g, null, { x: -400, y: 640, w: 1900, h: 420 }, { count: 9000, r: [0.4, 1.1], color: '#4a4436', alpha: 0.3, seed: 542 });
    g.restore();
    // buttresses and watch posts with lights
    for (let x = -360; x < 1500; x += 230) {
      const t0 = topY(x) - 40;
      const b = botY(x);
      const p = new Path2D();
      p.moveTo(x - 24, t0);
      p.lineTo(x + 24, t0);
      p.lineTo(x + 34, b);
      p.lineTo(x - 34, b);
      p.closePath();
      paintShape(wall, p, { fill: '#bdb5a3', light: [-1, -0.3], shadowDepth: 20, hatchSpacing: 2.2, seed: 543 + x, cross: false });
      const cab = new Path2D();
      cab.rect(x - 30, t0 - 34, 60, 34);
      paintShape(wall, cab, { fill: '#9c968a', light: [-1, -0.5], shadowDepth: 10, hatchSpacing: 2, seed: 544 + x, cross: false });
      g.fillStyle = '#ffd77a';
      g.fillRect(x - 22, t0 - 26, 44, 10);
      g.strokeStyle = rgba(INK, 0.8);
      g.strokeRect(x - 22, t0 - 26, 44, 10);
    }
    // railing along the top
    g.strokeStyle = rgba(INK, 0.75);
    g.lineWidth = 1.2;
    g.beginPath();
    for (let x = -400; x <= 1500; x += 40) {
      const y = topY(x) - 14;
      if (x === -400) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    for (let x = -400; x <= 1500; x += 14) {
      g.beginPath();
      g.moveTo(x, topY(x));
      g.lineTo(x, topY(x) - 14);
      g.stroke();
    }
  }
  // ground between wall and highway, then the elevated highway with pillars
  const ground = new Layer(1900, 1000, res, 400, -960);
  {
    const g = ground.g;
    const gr = g.createLinearGradient(0, 980, 0, 1960);
    gr.addColorStop(0, '#a5b07a');
    gr.addColorStop(1, '#6f7f4a');
    g.fillStyle = gr;
    g.fillRect(-400, 980, 1900, 980);
    hatch(g, { x: -400, y: 980, w: 1900, h: 980 }, { angle: -0.06, spacing: 5, width: 0.55, color: '#3e4c26', alpha: 0.22, seed: 551, broken: 0.6 });
    const rng = makeRng(552);
    for (let i = 0; i < 26; i++) {
      const x = rng.range(-380, 1480);
      const y = rng.range(1000, 1120);
      const r = rng.range(14, 26);
      const p = new Path2D();
      p.ellipse(x, y - r, r * 0.9, r, 0, 0, TAU);
      paintShape(ground, p, { fill: '#6f8b4c', light: [-1, -1], shadowDepth: r * 0.5, hatchSpacing: 2.2, seed: 553 + i, cross: false });
    }
  }
  const deck = new Layer(1900, 820, res, 400, -1120);
  {
    const g = deck.g;
    // pillars
    for (let x = -360; x < 1500; x += 260) {
      const p = new Path2D();
      p.rect(x - 26, 1300, 52, 600);
      paintShape(deck, p, { fill: '#c4bdae', light: [-1, -0.3], shadowDepth: 18, hatchSpacing: 2.2, seed: 561 + x, cross: false });
    }
    // road surface (two lanes) seen slightly from above
    const road = new Path2D();
    road.rect(-400, DECK, 1900, 108);
    g.fillStyle = '#77756e';
    g.fill(road);
    stipple(g, road, { x: -400, y: DECK, w: 1900, h: 108 }, { count: 8000, r: [0.4, 1], color: '#2e2d29', alpha: 0.4, seed: 562 });
    g.strokeStyle = 'rgba(245,240,220,0.9)';
    g.lineWidth = 3;
    g.setLineDash([30, 26]);
    g.beginPath();
    g.moveTo(-400, DECK + 52);
    g.lineTo(1500, DECK + 52);
    g.stroke();
    g.setLineDash([]);
    // deck slab edge
    const slab = new Path2D();
    slab.rect(-400, DECK + 108, 1900, 46);
    paintShape(deck, slab, { fill: '#d6cfbf', light: [0, -1], shadowDepth: 16, hatchSpacing: 2.2, seed: 563, cross: false });
    // far guard rail
    g.strokeStyle = '#8d8a80';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-400, DECK - 8);
    g.lineTo(1500, DECK - 8);
    g.stroke();
    g.lineWidth = 2;
    for (let x = -400; x < 1500; x += 40) {
      g.beginPath();
      g.moveTo(x, DECK - 8);
      g.lineTo(x, DECK + 4);
      g.stroke();
    }
    // lamp posts
    for (let x = -300; x < 1500; x += 320) {
      g.strokeStyle = rgba('#555', 0.9);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, DECK);
      g.lineTo(x, DECK - 150);
      g.quadraticCurveTo(x, DECK - 166, x + 26, DECK - 166);
      g.stroke();
      g.fillStyle = '#fff1c4';
      g.fillRect(x + 20, DECK - 168, 18, 6);
    }
  }
  const nearRail = new Layer(1900, 120, res, 400, -(DECK + 60));
  {
    const g = nearRail.g;
    const y = DECK + 108;
    const p = new Path2D();
    p.rect(-400, y - 26, 1900, 22);
    paintShape(nearRail, p, { fill: '#c7c3b7', light: [0, -1], shadowDepth: 10, hatchSpacing: 2, seed: 571, cross: false });
    g.strokeStyle = rgba(INK, 0.6);
    g.lineWidth = 1;
    for (let x = -400; x < 1500; x += 60) {
      g.beginPath();
      g.moveTo(x, y - 26);
      g.lineTo(x, y - 4);
      g.stroke();
    }
  }
  return { sky, city, wall, ground, deck, nearRail };
}

// Little storybook cars (side view, facing right; flip for left).
function buildCar(S, seed, kind) {
  const rng = makeRng(seed);
  const res = S * 1.4;
  const L = new Layer(190, 90, res, 95, 70);
  const g = L.g;
  const color = rng.pick(['#c65b44', '#e0b04a', '#5f86a4', '#7f9a62', '#e9e2d0', '#4f5d6e', '#b98a5a']);
  const len = kind === 'van' ? 170 : kind === 'bus' ? 186 : 150;
  const h = kind === 'van' ? 58 : kind === 'bus' ? 62 : 40;
  const body = new Path2D();
  if (kind === 'car') {
    body.moveTo(-len / 2, -10);
    body.lineTo(-len / 2 + 8, -h + 18);
    body.lineTo(-len / 2 + 40, -h + 14);
    body.lineTo(-24, -h - 8);
    body.lineTo(30, -h - 8);
    body.lineTo(52, -h + 14);
    body.lineTo(len / 2 - 4, -h + 18);
    body.lineTo(len / 2, -10);
    body.closePath();
  } else body.roundRect(-len / 2, -h - 10, len, h, 8);
  paintShape(L, body, { fill: color, light: [-0.5, -1], shadowDepth: 12, hatchSpacing: 2, seed, cross: false });
  g.fillStyle = '#9fc0cf';
  g.strokeStyle = rgba(INK, 0.8);
  g.lineWidth = 0.8;
  if (kind === 'car') {
    g.beginPath();
    g.moveTo(-20, -h - 3);
    g.lineTo(2, -h - 3);
    g.lineTo(2, -h + 12);
    g.lineTo(-36, -h + 12);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(8, -h - 3);
    g.lineTo(27, -h - 3);
    g.lineTo(44, -h + 12);
    g.lineTo(8, -h + 12);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    for (let x = -len / 2 + 10; x < len / 2 - 20; x += 30) {
      g.fillRect(x, -h - 2, 22, 16);
      g.strokeRect(x, -h - 2, 22, 16);
    }
  }
  for (const x of [-len / 2 + 28, len / 2 - 28]) {
    g.fillStyle = '#231e1a';
    g.beginPath();
    g.arc(x, -8, 13, 0, TAU);
    g.fill();
    g.fillStyle = '#b8b3a8';
    g.beginPath();
    g.arc(x, -8, 5, 0, TAU);
    g.fill();
  }
  return { L, len, h };
}

function buildHead(S) {
  // sauropod head, facing right in local coords (neck joint at origin), rounded with a nasal arch
  const res = S * 1.5;
  const L = new Layer(200, 140, res, 40, 80);
  const pts = [[-10, -24], [20, -46], [54, -56], [80, -48], [104, -34], [126, -18], [134, 0], [124, 14], [96, 22], [60, 26], [24, 28], [-6, 20], [-14, 0]];
  const p = smoothPath(pts, true);
  paintShape(L, p, {
    fill: '#8b8d63',
    light: [-0.4, -1],
    shadowDepth: 18,
    hatchSpacing: 2.2,
    seed: 581,
    before: (Lx) => scales(Lx.g, p, Lx.box, { size: 5, base: '#8b8d63', seed: 582, contrast: 0.9 }),
    after: (Lx) => {
      const g = Lx.g;
      glossyBall(g, 62, -22, 6.5, { color: '#1c140c', ring: '#4a3a1c' });
      g.fillStyle = 'rgba(30,24,14,0.85)';
      g.beginPath();
      g.ellipse(84, -44, 6, 3.5, 0.3, 0, TAU);
      g.fill();
      g.strokeStyle = rgba(INK, 0.85);
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(132, 6);
      g.quadraticCurveTo(100, 14, 66, 12);
      g.stroke();
      // peg teeth hint
      g.strokeStyle = 'rgba(240,232,210,0.9)';
      g.lineWidth = 1;
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.moveTo(124 - k * 8, 6 + k * 0.6);
        g.lineTo(124 - k * 8, 10 + k * 0.6);
        g.stroke();
      }
    },
  });
  return L;
}

function buildHump(S) {
  const res = S * 1.2;
  const L = new Layer(700, 300, res, 340, 230);
  const p = smoothPath([[-330, 60], [-300, -40], [-200, -130], [-40, -170], [120, -150], [260, -90], [330, 0], [330, 60]], true);
  paintShape(L, p, {
    fill: '#868a5f',
    light: [-0.4, -1],
    shadowDepth: 60,
    hatchSpacing: 2.4,
    seed: 595,
    cross: true,
    before: (Lx) => {
      scales(Lx.g, p, Lx.box, { size: 9, base: '#868a5f', seed: 596, contrast: 1 });
      const g = Lx.g;
      g.save();
      g.clip(p);
      g.fillStyle = 'rgba(60,56,34,0.35)';
      for (let x = -300; x < 330; x += 60) {
        g.beginPath();
        g.ellipse(x, -150, 18, 60, 0.2, 0, TAU);
        g.fill();
      }
      g.restore();
    },
  });
  return L;
}

export async function build(env) {
  const { S } = env;
  const C = buildCity(S);
  const hump = buildHump(S);
  const head = buildHead(S);
  const rng = makeRng(590);
  const kinds = ['car', 'car', 'van', 'car', 'bus', 'car', 'car', 'van', 'car', 'car'];
  const cars = kinds.map((k, i) => {
    const c = buildCar(S, 600 + i, k);
    const far = i % 2 === 0;
    return { ...c, far, x0: rng.range(-500, 1600), v: (far ? 1 : -1) * rng.range(170, 230), gap: rng.range(0, 1) };
  });
  // neck texture pattern
  const tile = new Layer(64, 64, S * 1.3, 0, 0);
  scales(tile.g, null ?? new Path2D('M0 0H64V64H0Z'), { x: 0, y: 0, w: 64, h: 64 }, { size: 6, base: '#8b8d63', seed: 591, contrast: 0.9 });
  let pattern = null;

  function camAt(t) {
    const p = easeInOut(clamp((t - 22.6) / 3.6));
    return { x: lerp(380, 640, p), y: 905 + smoothstep(25, 28, t) * 20, z: 1.0 + smoothstep(25, 29.6, t) * 0.04 };
  }

  // Neck spine (world coords) at time t: base hidden behind the deck, head path rising then
  // bending down toward the cars.
  function neckSpine(t) {
    const rise = easeInOut(clamp((t - 23.9) / 1.9));
    const bend = easeInOut(clamp((t - 25.6) / 1.2));
    const call = Math.exp(-Math.pow((t - 26.9) / 0.6, 2));
    const bob = Math.sin(t * 1.3) * 6;
    const base = [905, 1250];
    const hx = lerp(lerp(980, 820, rise), 650, bend);
    const hy = lerp(lerp(1500, 690, rise), 900, bend) - call * 60 + bob;
    const m1 = [lerp(930, 880, rise), lerp(1290, 1040, rise)];
    const m2 = [lerp(hx + 60, hx + 150, bend), lerp(hy + 120, hy + 30, bend)];
    return { pts: [base, m1, m2, [hx, hy]], call };
  }

  function drawNeck(g, t) {
    const { pts, call } = neckSpine(t);
    const outline = tube(pts, (u) => {
      const r = lerp(88, 30, Math.pow(u, 0.7));
      return [r, r * 1.08];
    }, 50, false);
    const path = smoothPath(outline, true);
    if (!pattern) pattern = g.createPattern(tile.c, 'repeat');
    g.save();
    g.fillStyle = '#8b8d63';
    g.fill(path);
    g.clip(path);
    const m = new DOMMatrix().translate(pts[0][0], pts[0][1]).scale(1 / tile.res, 1 / tile.res);
    pattern.setTransform(m);
    g.fillStyle = pattern;
    g.fill(path);
    // underside shadow and hatching along the throat side
    const S2 = sampleSpline(pts, 40);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(40,34,20,0.32)';
    g.lineWidth = 60;
    g.beginPath();
    S2.forEach((s, i) => {
      const x = s.x + s.ty * 40;
      const y = s.y - s.tx * 40;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.stroke();
    g.strokeStyle = 'rgba(255,248,220,0.18)';
    g.lineWidth = 18;
    g.beginPath();
    S2.forEach((s, i) => {
      const x = s.x - s.ty * 34;
      const y = s.y + s.tx * 34;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    });
    g.stroke();
    // throat folds
    g.strokeStyle = rgba(INK, 0.4);
    g.lineWidth = 1;
    for (let i = 4; i < 38; i += 3) {
      const s = S2[i];
      const r = lerp(88, 30, Math.pow(s.u, 0.7));
      g.beginPath();
      g.moveTo(s.x + s.ty * r * 0.2, s.y - s.tx * r * 0.2);
      g.quadraticCurveTo(s.x + s.ty * r * 0.7 + s.tx * 6, s.y - s.tx * r * 0.7 + s.ty * 6, s.x + s.ty * r, s.y - s.tx * r);
      g.stroke();
    }
    g.restore();
    g.strokeStyle = rgba(INK, 0.9);
    g.lineWidth = 1.4;
    g.stroke(path);
    // head at the end, along the tangent
    const end = S2[S2.length - 1];
    const ang = Math.atan2(end.ty, end.tx);
    g.save();
    g.translate(end.x, end.y);
    // facing left: mirror the right-facing head
    g.rotate(ang + Math.PI);
    g.scale(-1, 1);
    g.rotate(-call * 0.15);
    g.scale(1.35, 1.35);
    g.drawImage(head.c, -head.ox, -head.oy, head.w, head.h);
    g.restore();
  }

  function carX(c, t) {
    // drive, then brake to a stop as the head comes over the road
    const T = BRAKE + c.gap * 0.35;
    const dt = Math.min(t, T) - 22.0;
    let x = c.x0 + c.v * dt;
    if (t > T) {
      const d = Math.min(t - T, 0.9);
      x += c.v * (d - (d * d) / 1.8);
    }
    const span = 2100;
    return ((((x + 500) % span) + span) % span) - 500;
  }

  function draw(g, t) {
    const c = camAt(t);
    setCam(g, S);
    drawLayer(g, C.sky, 0, 0);
    // pale sun (the fossil inset shrinks into it)
    g.fillStyle = '#faeecd';
    g.beginPath();
    g.arc(SUN.x, SUN.y, SUN.r, 0, TAU);
    g.fill();
    const sg = g.createRadialGradient(SUN.x, SUN.y, SUN.r, SUN.x, SUN.y, SUN.r * 2.6);
    sg.addColorStop(0, 'rgba(255,240,200,0.45)');
    sg.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = sg;
    g.fillRect(SUN.x - SUN.r * 3, SUN.y - SUN.r * 3, SUN.r * 6, SUN.r * 6);
    const lay = (f) => setCam(g, S, 540 + (c.x - 540) * f, 960 + (c.y - 960) * f, 1 + (c.z - 1) * f);
    lay(0.45);
    drawLayer(g, C.city, 0, 0);
    lay(0.65);
    drawLayer(g, C.wall, 0, 0);
    lay(1);
    drawLayer(g, C.ground, 0, 0);
    drawLayer(g, C.deck, 0, 0);
    // far-lane cars (behind the neck), then the neck and head, then near-lane cars
    const drawCar = (car) => {
      const x = carX(car, t);
      const y = car.far ? DECK + 46 : DECK + 100;
      g.save();
      g.translate(x, y);
      if (car.v < 0) g.scale(-1, 1);
      g.drawImage(car.L.c, -car.L.ox, -car.L.oy, car.L.w, car.L.h);
      // brake lights
      if (t > BRAKE + car.gap * 0.35 - 0.05) {
        const bx = -car.len / 2 + 2;
        const gl = g.createRadialGradient(bx, -22, 0, bx, -22, 16);
        gl.addColorStop(0, 'rgba(255,60,40,0.95)');
        gl.addColorStop(1, 'rgba(255,60,40,0)');
        g.fillStyle = gl;
        g.fillRect(bx - 16, -38, 32, 32);
      }
      g.restore();
    };
    g.save();
    g.beginPath();
    g.rect(-600, -400, 2400, DECK + 400 + 2);
    g.clip();
    drawLayer(g, hump, 1110, DECK + 6 + Math.sin(t * 1.2) * 3);
    drawNeck(g, t);
    g.restore();
    cars.filter((k) => k.far).forEach(drawCar);
    cars.filter((k) => !k.far).forEach(drawCar);
    drawLayer(g, C.nearRail, 0, 0);
    // bottom vignette for the captions
    g.setTransform(1, 0, 0, 1, 0, 0);
    const H = g.canvas.height;
    const vg = g.createLinearGradient(0, H * 0.6, 0, H);
    vg.addColorStop(0, 'rgba(20,14,6,0)');
    vg.addColorStop(1, 'rgba(20,14,6,0.45)');
    g.fillStyle = vg;
    g.fillRect(0, H * 0.6, g.canvas.width, H * 0.4);
  }
  return { draw, sun: SUN };
}
