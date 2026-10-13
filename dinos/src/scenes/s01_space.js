// 0:00-0:05 Earth from space. An asteroid streaks in on a red dashed impact course toward the
// Yucatan, then slides past the limb and misses.
import { Layer, drawLayer, paintShape, terminatorMask, smoothPath, stipple, scribble, hatch, sparkle, glossyBall, strokePartial, INK, rgba, shade, shadowMask, tintThrough, hatchThrough, mottle } from '../kit/paint.js';
import { makeRng, makeNoise, clamp, lerp, smoothstep, keys, easeOutBack, TAU, easeInOut } from '../kit/util.js';
import { setCam } from '../kit/cam.js';
import { EARTH, IMPACT, loadLand, makeProjection, landPath, projectPoint } from '../kit/earth.js';

export const T0 = 0;

// Asteroid flight in screen design units: [t, x, y, scale].
const FLIGHT = [
  [0.0, 1040, 170, 0.1],
  [0.6, 985, 245, 0.14],
  [2.4, 870, 380, 0.3],
  [3.3, 745, 470, 0.46],
  [3.85, 560, 470, 0.66],
  [4.35, 330, 420, 0.92],
  [4.95, 40, 330, 1.25],
  [5.6, -330, 210, 1.65],
];
function flight(t) {
  for (let i = 1; i < FLIGHT.length; i++) {
    if (t <= FLIGHT[i][0]) {
      const a = FLIGHT[i - 1];
      const b = FLIGHT[i];
      const u = (t - a[0]) / (b[0] - a[0]);
      // Catmull-Rom through neighbours for a smooth curve.
      const p0 = FLIGHT[Math.max(0, i - 2)];
      const p3 = FLIGHT[Math.min(FLIGHT.length - 1, i + 1)];
      const cr = (k) => 0.5 * (2 * a[k] + (-p0[k] + b[k]) * u + (2 * p0[k] - 5 * a[k] + 4 * b[k] - p3[k]) * u * u + (-p0[k] + 3 * a[k] - 3 * b[k] + p3[k]) * u * u * u);
      return [cr(1), cr(2), cr(3)];
    }
  }
  const l = FLIGHT[FLIGHT.length - 1];
  return [l[1], l[2], l[3]];
}

function buildStars(S) {
  const L = new Layer(1300, 2200, S, 110, 140);
  const g = L.g;
  const rng = makeRng(71);
  const nz = makeNoise(72);
  const bg = g.createLinearGradient(0, -140, 0, 2060);
  bg.addColorStop(0, '#0d0a14');
  bg.addColorStop(0.55, '#140f19');
  bg.addColorStop(1, '#1a1214');
  g.fillStyle = bg;
  g.fillRect(-110, -140, 1300, 2200);
  // Faint dusty nebula bands made of scribbled strokes (the reference's scratchy night texture).
  for (let i = 0; i < 2600; i++) {
    const x = rng.range(-110, 1190);
    const y = rng.range(-140, 2060);
    const n = nz.fbm(x / 380, y / 380);
    if (n < 0.52 || !rng.chance((n - 0.52) * 3)) continue;
    const a = -0.5 + rng.range(-0.3, 0.3);
    const l = rng.range(8, 26);
    g.strokeStyle = rgba(rng.chance(0.5) ? '#6f5a86' : '#8a6c5a', rng.range(0.05, 0.13));
    g.lineWidth = rng.range(0.4, 0.9);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const x = rng.range(-110, 1190);
    const y = rng.range(-140, 2060);
    const r = Math.pow(rng.next(), 3) * 1.6 + 0.35;
    g.fillStyle = rgba(rng.pick(['#f6ecd2', '#e9e3ff', '#ffe2b8']), rng.range(0.45, 0.95));
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 28; i++) sparkle(g, rng.range(-60, 1140), rng.range(-100, 2000), rng.range(4, 9), rng.pick(['#c9cbff', '#f3e6c8']), rng.range(0.5, 0.9));
  return L;
}

async function buildEarth(S) {
  const land = await loadLand();
  const R = EARTH.r;
  const res = S * 1.12;
  const L = new Layer(2 * R + 80, 2 * R + 80, res, R + 40, R + 40);
  const g = L.g;
  const rng = makeRng(81);
  const proj = makeProjection(0, 0, R);
  const disc = new Path2D();
  disc.arc(0, 0, R, 0, TAU);
  const lp = landPath(land, proj);
  // Atmosphere glow behind the disc.
  const atm = g.createRadialGradient(0, 0, R * 0.96, 0, 0, R * 1.09);
  atm.addColorStop(0, 'rgba(150,205,235,0.55)');
  atm.addColorStop(0.4, 'rgba(120,180,225,0.22)');
  atm.addColorStop(1, 'rgba(110,160,220,0)');
  g.fillStyle = atm;
  g.fillRect(-R - 40, -R - 40, 2 * R + 80, 2 * R + 80);
  g.save();
  g.clip(disc);
  // Ocean with soft depth toward the limb.
  const oc = g.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
  oc.addColorStop(0, '#5a9bb3');
  oc.addColorStop(0.7, '#3f7d98');
  oc.addColorStop(1, '#2d5f7c');
  g.fillStyle = oc;
  g.fill(disc);
  mottle(g, disc, { x: -R, y: -R, w: 2 * R, h: 2 * R }, { base: '#3f7d98', count: 50, size: [40, 120], amount: 0.12, seed: 82 });
  // Shallow water halos around the coasts, then fine ocean hatching.
  for (const [w, a] of [
    [26, 0.1],
    [14, 0.14],
    [6, 0.2],
  ]) {
    g.strokeStyle = rgba('#a9dbe0', a);
    g.lineWidth = w;
    g.stroke(lp);
  }
  hatch(g, { x: -R, y: -R, w: 2 * R, h: 2 * R }, { angle: -0.12, spacing: 4.2, width: 0.5, color: '#c6e6ef', alpha: 0.13, seed: 83, broken: 0.5 });
  // Land.
  g.fillStyle = '#93ad69';
  g.fill(lp);
  g.save();
  g.clip(lp);
  // Biomes as blotches placed on the globe: deserts in the subtropics, deep green near the equator,
  // pale tundra up north.
  const blob = (lon, lat, r, color, alpha) => {
    const p = projectPoint(lon, lat, 0, 0, R);
    if (!p) return;
    const rr = r * (0.5 + 0.5 * p[2]);
    const gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr);
    gr.addColorStop(0, rgba(color, alpha));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(p[0] - rr, p[1] - rr, 2 * rr, 2 * rr);
  };
  for (let i = 0; i < 900; i++) {
    const lon = rng.range(-180, 60);
    const lat = rng.range(-60, 75);
    const al = Math.abs(lat);
    if (al > 14 && al < 36 && rng.chance(0.75)) blob(lon, lat, rng.range(18, 46), rng.pick(['#d2ad68', '#c99c58', '#dcbd80']), 0.55);
    else if (al < 12) blob(lon, lat, rng.range(16, 40), rng.pick(['#5f8a45', '#6b9750']), 0.5);
    else if (al > 52) blob(lon, lat, rng.range(18, 40), rng.pick(['#c9cfaa', '#b7c08f']), 0.5);
    else blob(lon, lat, rng.range(14, 34), rng.pick(['#7f9f5a', '#a5b877']), 0.4);
  }
  stipple(g, null, { x: -R, y: -R, w: 2 * R, h: 2 * R }, { count: 9000, r: [0.35, 0.9], color: '#3f5a2a', alpha: 0.35, seed: 84 });
  scribble(g, null, { x: -R, y: -R, w: 2 * R, h: 2 * R }, { count: 260, len: [6, 14], color: '#3a4a22', alpha: 0.22, seed: 85 });
  // Mountain chevrons along the Andes and the Rockies.
  const ranges = [
    [[-70.5, -42], [-70, -30], [-69, -18], [-76, -8], [-78, 2], [-74, 8]],
    [[-122, 56], [-116, 49], [-111, 43], [-107, 37], [-105, 31]],
    [[-100, 26], [-104, 22], [-99, 18]],
  ];
  g.strokeStyle = rgba('#4e3d24', 0.65);
  g.lineWidth = 1;
  for (const rr of ranges) {
    for (let i = 0; i < rr.length - 1; i++) {
      for (let k = 0; k < 4; k++) {
        const u = k / 4;
        const p = projectPoint(lerp(rr[i][0], rr[i + 1][0], u), lerp(rr[i][1], rr[i + 1][1], u), 0, 0, R);
        if (!p) continue;
        const s = 5 * p[2];
        g.beginPath();
        g.moveTo(p[0] - s, p[1] + s * 0.5);
        g.lineTo(p[0], p[1] - s * 0.6);
        g.lineTo(p[0] + s, p[1] + s * 0.5);
        g.stroke();
      }
    }
  }
  g.restore();
  // Coast: a light inner edge and an ink line.
  g.save();
  g.clip(lp);
  g.strokeStyle = rgba('#e9e2b8', 0.45);
  g.lineWidth = 4;
  g.stroke(lp);
  g.restore();
  g.strokeStyle = rgba(INK, 0.8);
  g.lineWidth = 1.1;
  g.stroke(lp);
  // Cloud swirls: projected wavy bands and curls in cream.
  const cl = makeRng(86);
  g.lineCap = 'round';
  for (let i = 0; i < 30; i++) {
    const lat0 = cl.pick([-46, -34, -6, 6, 36, 47, 56]) + cl.range(-5, 5);
    const lon0 = cl.range(-160, 20);
    const len = cl.range(10, 34);
    const ph = cl.range(0, 6);
    const pts = [];
    for (let k = 0; k <= 20; k++) {
      const lon = lon0 + (k / 20) * len;
      const lat = lat0 + Math.sin(k * 0.22 + ph) * 1.3;
      const p = projectPoint(lon, lat, 0, 0, R);
      if (p) pts.push([p[0], p[1]]);
    }
    if (pts.length < 3) continue;
    const w = cl.range(4, 10);
    const path = smoothPath(pts, false);
    g.strokeStyle = rgba('#fbf6ea', 0.16);
    g.lineWidth = w * 2.2;
    g.stroke(path);
    g.strokeStyle = rgba('#fbf6ea', cl.range(0.35, 0.55));
    g.lineWidth = w;
    g.stroke(path);
    g.strokeStyle = rgba('#ffffff', 0.45);
    g.lineWidth = w * 0.3;
    g.stroke(smoothPath(pts.map(([x, y]) => [x - 1, y - w * 0.25]), false));
  }
  for (let i = 0; i < 7; i++) {
    const p = projectPoint(cl.range(-150, 10), cl.pick([-40, 12, 45]) + cl.range(-6, 6), 0, 0, R);
    if (!p) continue;
    const s = cl.range(10, 22) * p[2];
    g.strokeStyle = rgba('#fbf6ea', 0.5);
    g.lineWidth = 2.2;
    g.beginPath();
    for (let a = 0; a < 4.2 * Math.PI; a += 0.2) {
      const r = (s * a) / (4.2 * Math.PI);
      const x = p[0] + Math.cos(a) * r;
      const y = p[1] + Math.sin(a) * r * 0.6;
      if (a === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
  // Night side and terminator: tone plus cross-hatching, light from the upper left.
  const M = terminatorMask(L, R, 0.32, 0.42, R * 0.035);
  tintThrough(L, M, '#10142a', 0.8);
  hatchThrough(L, M, { angle: -0.95, spacing: 3.2, width: 0.55, color: '#05060e', alpha: 0.5, seed: 87 });
  const M2 = terminatorMask(L, R, 0.32, 0.05, R * 0.03);
  hatchThrough(L, M2, { angle: 0.55, spacing: 3.6, width: 0.5, color: '#05060e', alpha: 0.45, seed: 88 });
  // City-light speckle on the night side would be anachronistic 66 Myr ago; keep it dark.
  // Glossy highlight arc on the lit limb, rim light and outline.
  g.save();
  g.strokeStyle = 'rgba(255,253,240,0.5)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, R * 0.92, Math.PI * 1.08, Math.PI * 1.38);
  g.stroke();
  g.lineWidth = 1.4;
  g.beginPath();
  g.arc(0, 0, R * 0.86, Math.PI * 1.12, Math.PI * 1.22);
  g.stroke();
  g.strokeStyle = rgba('#bfe3f2', 0.8);
  g.lineWidth = 2.2;
  g.beginPath();
  g.arc(0, 0, R - 1, Math.PI * 0.9, Math.PI * 1.7);
  g.stroke();
  g.strokeStyle = rgba(INK, 0.9);
  g.lineWidth = 1.3;
  g.stroke(disc);
  g.restore();
  return L;
}

function buildRock(S) {
  const R = 62;
  const L = new Layer(2 * R + 30, 2 * R + 30, S * 1.7, R + 15, R + 15);
  const rng = makeRng(91);
  const nz = makeNoise(92);
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const r = R * (0.78 + 0.32 * nz.fbm(Math.cos(a) * 1.4 + 3, Math.sin(a) * 1.4 + 3, 3) + rng.range(-0.03, 0.03));
    pts.push([Math.cos(a) * r * 1.08, Math.sin(a) * r * 0.92]);
  }
  const path = smoothPath(pts, true);
  paintShape(L, path, {
    fill: '#8b7660',
    light: [-0.7, -1],
    shadowDepth: 34,
    shadowAlpha: 0.7,
    cross: true,
    hatchSpacing: 2.1,
    seed: 93,
    after: (L2) => {
      const g = L2.g;
      g.save();
      g.clip(path);
      // Craters: dark bowl, light rim on the lit side.
      for (let i = 0; i < 9; i++) {
        const x = rng.range(-R * 0.7, R * 0.7);
        const y = rng.range(-R * 0.6, R * 0.6);
        const r = rng.range(4, 11);
        g.fillStyle = rgba('#5a4a3b', 0.75);
        g.beginPath();
        g.ellipse(x, y, r, r * 0.8, 0.3, 0, TAU);
        g.fill();
        g.strokeStyle = rgba('#d8c3a0', 0.75);
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(x, y, r, r * 0.8, 0.3, Math.PI * 0.05, Math.PI * 0.95);
        g.stroke();
        g.strokeStyle = rgba(INK, 0.6);
        g.lineWidth = 0.7;
        g.beginPath();
        g.ellipse(x, y, r, r * 0.8, 0.3, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      }
      stipple(g, path, L2.box, { count: 1600, r: [0.25, 0.8], color: '#2e2219', alpha: 0.45, seed: 94 });
      stipple(g, path, L2.box, { count: 500, r: [0.25, 0.7], color: '#f0dfc0', alpha: 0.5, seed: 95 });
      g.restore();
    },
  });
  return L;
}

export async function build(env) {
  const { S } = env;
  const stars = buildStars(S);
  const earth = await buildEarth(S);
  const rock = buildRock(S);
  const target = projectPoint(IMPACT[0], IMPACT[1], EARTH.x, EARTH.y, EARTH.r);
  const start = flight(0.6);

  function draw(g, t) {
    // Slow push: stars drift a little more than the Earth (parallax).
    const push = smoothstep(0, 5.5, t);
    setCam(g, S, 540 + push * 10, 960 - push * 18, 1 + push * 0.025);
    drawLayer(g, stars, 0, 0);
    setCam(g, S);
    const er = 1 + push * 0.012;
    drawLayer(g, earth, EARTH.x, EARTH.y, 0, er);

    // Red dashed impact course with a target ring on the Yucatan.
    const draw1 = smoothstep(0.7, 1.9, t);
    const fade = 1 - smoothstep(3.4, 4.3, t);
    if (draw1 > 0 && fade > 0) {
      g.save();
      g.strokeStyle = rgba('#d8463d', 0.9 * fade);
      g.lineWidth = 2.4;
      g.setLineDash([11, 9]);
      g.lineDashOffset = -t * 30;
      const ex = lerp(start[0], target[0], draw1);
      const ey = lerp(start[1], target[1], draw1);
      g.beginPath();
      g.moveTo(start[0], start[1]);
      g.lineTo(ex, ey);
      g.stroke();
      g.setLineDash([]);
      const pop = smoothstep(1.55, 2.05, t);
      if (pop > 0) {
        const r = 26 * easeOutBack(clamp(pop)) * (1 + 0.6 * smoothstep(3.6, 4.4, t));
        g.lineWidth = 2.2;
        g.beginPath();
        g.arc(target[0], target[1], r, 0, TAU);
        g.stroke();
        g.lineWidth = 1.4;
        g.beginPath();
        g.arc(target[0], target[1], r * 0.45, 0, TAU);
        g.stroke();
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          g.beginPath();
          g.moveTo(target[0] + Math.cos(a) * r * 0.7, target[1] + Math.sin(a) * r * 0.7);
          g.lineTo(target[0] + Math.cos(a) * r * 1.35, target[1] + Math.sin(a) * r * 1.35);
          g.stroke();
        }
      }
      g.restore();
    }

    // Asteroid with a warm tapered trail and speed lines.
    if (t < 5.6) {
      const [x, y, s] = flight(t);
      const trail = [];
      for (let k = 0; k <= 16; k++) trail.push(flight(Math.max(0, t - k * 0.045)));
      const dx = trail[0][0] - trail[6][0];
      const dy = trail[0][1] - trail[6][1];
      const dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl;
      const ny = dx / dl;
      const w = 52 * s;
      const left = [];
      const right = [];
      trail.forEach(([tx, ty], k) => {
        const u = k / 16;
        const ww = w * (1 - u) * 0.95;
        left.push([tx + nx * ww, ty + ny * ww]);
        right.push([tx - nx * ww, ty - ny * ww]);
      });
      const tail = trail[16];
      const grd = g.createLinearGradient(x, y, tail[0], tail[1]);
      grd.addColorStop(0, 'rgba(255,214,150,0.55)');
      grd.addColorStop(0.4, 'rgba(240,160,100,0.25)');
      grd.addColorStop(1, 'rgba(200,120,90,0)');
      g.fillStyle = grd;
      g.fill(smoothPath([...left, ...right.reverse()], true));
      g.save();
      g.strokeStyle = rgba('#ffe6bf', 0.5);
      g.lineWidth = 1.2;
      for (let k = -3; k <= 3; k++) {
        const off = k * w * 0.28;
        const l = (1 - Math.abs(k) / 4) * 1.4 * Math.hypot(tail[0] - x, tail[1] - y);
        g.beginPath();
        g.moveTo(x + nx * off - (dx / dl) * w * 0.6, y + ny * off - (dy / dl) * w * 0.6);
        g.lineTo(x + nx * off - (dx / dl) * (w * 0.6 + l), y + ny * off - (dy / dl) * (w * 0.6 + l));
        g.stroke();
      }
      g.restore();
      // Warm glow on the leading face.
      const glow = g.createRadialGradient(x, y, 0, x, y, 75 * s);
      glow.addColorStop(0, 'rgba(255,220,170,0.35)');
      glow.addColorStop(1, 'rgba(255,200,150,0)');
      g.fillStyle = glow;
      g.fillRect(x - 75 * s, y - 75 * s, 150 * s, 150 * s);
      drawLayer(g, rock, x, y, t * 0.35 + 0.4, s);
    }

    // Fade up from black.
    const fin = 1 - smoothstep(0, 0.6, t);
    if (fin > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = `rgba(0,0,0,${fin})`;
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    }
  }
  return { draw };
}
