// The school: a two-storey storybook schoolhouse (cream plaster, brick quoins, terracotta roof,
// a clock tower) drawn once into layers: `back` (lit classroom interiors seen through the windows)
// and `front` (facade with window holes, glass, roof, tower). People are drawn between the two.
// It can break into a grid of cells that turn into drifting paper scraps and chalk dust when the
// ripple ring passes them.
import { Layer, drawLayer, smoothPath, hatch, stipple, mottle, INK } from './paint.js';
import { makeRng, rgba, shade, mix, clamp, lerp, easeOut, TAU } from './util.js';

export const SCHOOL = {
  x0: 222, x1: 858, base: 1240, floor1: 975, top: 700,
  roofTop: 598, towerX0: 476, towerX1: 604, towerTop: 430, spire: 352,
  clock: [540, 505, 40],
  gfWin: [260, 377, 611, 728].map((x) => [x, 1080, 92, 135]),
  ffWin: [260, 377, 494, 611, 728].map((x) => [x, 800, 92, 150]),
  door: [496, 1098, 88, 142],
};
const BOX = { x: 120, y: 330, w: 840, h: 930 };

function windowsAll() {
  return [...SCHOOL.gfWin, ...SCHOOL.ffWin];
}

export function buildSchool(res) {
  const back = new Layer(BOX.w, BOX.h, res, -BOX.x, -BOX.y);
  const front = new Layer(BOX.w, BOX.h, res, -BOX.x, -BOX.y);
  const rng = makeRng(501);
  // ---- interiors ----
  {
    const g = back.g;
    for (const [x, y, w, h] of windowsAll()) {
      const wall = g.createLinearGradient(0, y, 0, y + h);
      wall.addColorStop(0, '#e9d3a2');
      wall.addColorStop(1, '#d9b984');
      g.fillStyle = wall;
      g.fillRect(x - 6, y - 6, w + 12, h + 12);
      // a sliver of chalkboard and a poster on the back wall
      g.fillStyle = '#3f5a4a';
      g.fillRect(x + rng.range(-10, 40), y + 22, rng.range(50, 90), 44);
      g.fillStyle = rgba('#efe9da', 0.5);
      g.fillRect(x + 10, y + 34, 26, 2.4);
      g.fillRect(x + 14, y + 44, 34, 2.4);
      g.fillStyle = rng.pick(['#c96f4a', '#6f9fb8', '#d9a441']);
      g.fillRect(x + w - 34, y + 30, 20, 26);
      // warm lamp glow
      const lg = g.createRadialGradient(x + w / 2, y + 10, 4, x + w / 2, y + 10, w * 0.8);
      lg.addColorStop(0, 'rgba(255,240,200,0.55)');
      lg.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = lg;
      g.fillRect(x - 6, y - 6, w + 12, h + 12);
    }
    // door interior (dark hallway)
    const [dx, dy, dw, dh] = SCHOOL.door;
    g.fillStyle = '#6b5440';
    g.fillRect(dx, dy, dw, dh);
  }
  // ---- facade ----
  {
    const g = front.g;
    const S = SCHOOL;
    const wall = new Path2D();
    wall.rect(S.x0, S.top, S.x1 - S.x0, S.base - S.top);
    // tower body
    const tower = new Path2D();
    tower.rect(S.towerX0, S.towerTop, S.towerX1 - S.towerX0, S.top - S.towerTop + 4);
    g.fillStyle = '#ecdcbc';
    g.fill(wall);
    g.fill(tower);
    mottle(g, wall, { x: S.x0, y: S.top, w: S.x1 - S.x0, h: S.base - S.top }, { base: '#ecdcbc', count: 60, size: [30, 110], amount: 0.1, seed: 502 });
    // plaster texture: soft hatch on the shadow side (right) and under the eaves
    g.save();
    g.clip(wall);
    hatch(g, { x: S.x0, y: S.top, w: S.x1 - S.x0, h: S.base - S.top }, { angle: -0.9, spacing: 4.2, width: 0.9, color: '#6a4a2a', alpha: 0.13, seed: 503, broken: 0.6 });
    const eave = g.createLinearGradient(0, S.top, 0, S.top + 70);
    eave.addColorStop(0, 'rgba(90,60,30,0.35)');
    eave.addColorStop(1, 'rgba(90,60,30,0)');
    g.fillStyle = eave;
    g.fillRect(S.x0, S.top, S.x1 - S.x0, 70);
    const side = g.createLinearGradient(S.x1 - 160, 0, S.x1, 0);
    side.addColorStop(0, 'rgba(90,60,30,0)');
    side.addColorStop(1, 'rgba(90,60,30,0.16)');
    g.fillStyle = side;
    g.fillRect(S.x1 - 160, S.top, 160, S.base - S.top);
    g.restore();
    // brick quoins on the corners and the tower edges
    const quoin = (x, y0, y1, dir) => {
      for (let y = y0, k = 0; y < y1; y += 22, k++) {
        const w = k % 2 ? 26 : 40;
        const xx = dir > 0 ? x : x - w;
        g.fillStyle = rng.pick(['#b5664a', '#a95c42', '#bf7255']);
        g.fillRect(xx, y + 1.5, w, 19);
        g.strokeStyle = rgba(INK, 0.5);
        g.lineWidth = 1;
        g.strokeRect(xx, y + 1.5, w, 19);
      }
    };
    quoin(S.x0, S.top, S.base, 1);
    quoin(S.x1, S.top, S.base, -1);
    // belt course between the floors
    g.fillStyle = '#c9a77a';
    g.fillRect(S.x0, S.floor1 - 8, S.x1 - S.x0, 14);
    g.fillStyle = 'rgba(70,45,25,0.35)';
    g.fillRect(S.x0, S.floor1 + 6, S.x1 - S.x0, 4);
    // plinth
    g.fillStyle = '#9b8670';
    g.fillRect(S.x0 - 6, S.base - 26, S.x1 - S.x0 + 12, 26);
    hatch(g, { x: S.x0 - 6, y: S.base - 26, w: S.x1 - S.x0 + 12, h: 26 }, { angle: -0.9, spacing: 3, width: 0.8, color: INK, alpha: 0.25, seed: 504 });
    // windows: frame + glass tint + mullions + sill; cut holes so the interior shows
    for (const [x, y, w, h] of windowsAll()) {
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.fillRect(x, y, w, h);
      g.restore();
      // arch lintel
      g.fillStyle = '#c9a77a';
      g.beginPath();
      g.moveTo(x - 10, y + 2);
      g.quadraticCurveTo(x + w / 2, y - 26, x + w + 10, y + 2);
      g.lineTo(x + w + 10, y - 4);
      g.quadraticCurveTo(x + w / 2, y - 36, x - 10, y - 4);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba(INK, 0.7);
      g.lineWidth = 1.2;
      g.stroke();
      // sill
      g.fillStyle = '#d8c4a0';
      g.fillRect(x - 10, y + h, w + 20, 10);
      g.fillStyle = 'rgba(70,45,25,0.4)';
      g.fillRect(x - 8, y + h + 10, w + 16, 4);
    }
    // door: frame, panels, steps
    const [dx, dy, dw, dh] = SCHOOL.door;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(dx, dy, dw, dh);
    g.restore();
    g.fillStyle = '#6e3f2c';
    g.fillRect(dx + 4, dy + 30, dw / 2 - 5, dh - 30);
    g.fillRect(dx + dw / 2 + 1, dy + 30, dw / 2 - 5, dh - 30);
    g.strokeStyle = rgba(INK, 0.8);
    g.lineWidth = 1.4;
    g.strokeRect(dx + 4, dy + 30, dw / 2 - 5, dh - 30);
    g.strokeRect(dx + dw / 2 + 1, dy + 30, dw / 2 - 5, dh - 30);
    g.fillStyle = '#e6c88a';
    g.beginPath();
    g.arc(dx + dw / 2, dy + 30, dw / 2 - 4, Math.PI, 0);
    g.fill();
    g.fillStyle = '#c9a77a';
    g.fillRect(dx - 16, dy - 14, dw + 32, 14);
    g.fillStyle = '#b8a58c';
    g.fillRect(dx - 24, S.base - 10, dw + 48, 10);
    g.fillRect(dx - 14, S.base - 18, dw + 28, 8);
    // emblem above the door: an open book in a roundel (no text)
    g.fillStyle = '#d9c39a';
    g.beginPath();
    g.arc(540, 1048, 24, 0, TAU);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1.6;
    g.stroke();
    g.fillStyle = '#f6efe0';
    g.beginPath();
    g.moveTo(540, 1056);
    g.quadraticCurveTo(528, 1044, 520, 1048);
    g.lineTo(520, 1038);
    g.quadraticCurveTo(530, 1035, 540, 1044);
    g.quadraticCurveTo(550, 1035, 560, 1038);
    g.lineTo(560, 1048);
    g.quadraticCurveTo(552, 1044, 540, 1056);
    g.fill();
    g.stroke();
    // roof
    const roof = new Path2D();
    roof.moveTo(S.x0 - 26, S.top + 4);
    roof.lineTo(S.x0 + 70, S.roofTop);
    roof.lineTo(S.x1 - 70, S.roofTop);
    roof.lineTo(S.x1 + 26, S.top + 4);
    roof.closePath();
    g.fillStyle = '#b5603f';
    g.fill(roof);
    g.save();
    g.clip(roof);
    for (let y = S.roofTop + 6; y < S.top + 6; y += 11) {
      g.strokeStyle = rgba('#5e2a18', 0.45);
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(S.x0 - 30, y);
      g.lineTo(S.x1 + 30, y);
      g.stroke();
      for (let x = S.x0 - 30 + ((y / 11) % 2) * 9; x < S.x1 + 30; x += 18) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + 11);
        g.stroke();
      }
    }
    hatch(g, { x: S.x0 - 30, y: S.roofTop, w: S.x1 - S.x0 + 60, h: S.top - S.roofTop }, { angle: -0.6, spacing: 3.6, width: 0.9, color: INK, alpha: 0.18, seed: 505 });
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.stroke(roof);
    // tower: drawn over the roof
    g.fillStyle = '#ecdcbc';
    g.fillRect(S.towerX0, S.towerTop, S.towerX1 - S.towerX0, S.roofTop - S.towerTop + 30);
    g.save();
    g.beginPath();
    g.rect(S.towerX0, S.towerTop, S.towerX1 - S.towerX0, S.roofTop - S.towerTop + 30);
    g.clip();
    hatch(g, { x: S.towerX0, y: S.towerTop, w: 150, h: 200 }, { angle: -0.9, spacing: 4.2, width: 0.9, color: '#6a4a2a', alpha: 0.16, seed: 506, broken: 0.5 });
    const ts = g.createLinearGradient(S.towerX1 - 50, 0, S.towerX1, 0);
    ts.addColorStop(0, 'rgba(90,60,30,0)');
    ts.addColorStop(1, 'rgba(90,60,30,0.2)');
    g.fillStyle = ts;
    g.fillRect(S.towerX1 - 50, S.towerTop, 50, 220);
    g.restore();
    quoin(S.towerX0, S.towerTop, S.roofTop + 20, 1);
    quoin(S.towerX1, S.towerTop, S.roofTop + 20, -1);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(S.towerX0, S.towerTop, S.towerX1 - S.towerX0, S.roofTop - S.towerTop + 30);
    // belfry opening + bell
    g.fillStyle = '#4a3a2e';
    g.beginPath();
    g.moveTo(S.towerX0 + 30, S.towerTop + 2);
    g.lineTo(S.towerX0 + 30, S.towerTop - 34);
    g.arc(540, S.towerTop - 34, 42, Math.PI, 0);
    g.lineTo(S.towerX1 - 30, S.towerTop + 2);
    g.closePath();
    g.fill();
    // tower cap
    const cap = new Path2D();
    cap.moveTo(S.towerX0 - 14, S.towerTop + 2);
    cap.lineTo(S.towerX0 + 4, S.towerTop - 6);
    cap.lineTo(S.towerX0 + 4, S.towerTop - 80);
    cap.lineTo(S.towerX1 - 4, S.towerTop - 80);
    cap.lineTo(S.towerX1 - 4, S.towerTop - 6);
    cap.lineTo(S.towerX1 + 14, S.towerTop + 2);
    cap.closePath();
    g.save();
    g.globalCompositeOperation = 'destination-over';
    g.restore();
    g.fillStyle = '#ecdcbc';
    g.fillRect(S.towerX0 + 4, S.towerTop - 84, S.towerX1 - S.towerX0 - 8, 10);
    g.strokeRect(S.towerX0 + 4, S.towerTop - 84, S.towerX1 - S.towerX0 - 8, 10);
    // bell (golden) inside the opening
    g.fillStyle = '#c9963c';
    g.beginPath();
    g.moveTo(540, S.towerTop - 58);
    g.quadraticCurveTo(522, S.towerTop - 50, 522, S.towerTop - 22);
    g.lineTo(518, S.towerTop - 14);
    g.lineTo(562, S.towerTop - 14);
    g.lineTo(558, S.towerTop - 22);
    g.quadraticCurveTo(558, S.towerTop - 50, 540, S.towerTop - 58);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1.4;
    g.stroke();
    // pointed roof
    const spire = new Path2D();
    spire.moveTo(S.towerX0 - 18, S.towerTop - 80);
    spire.lineTo(540, S.spire - 40);
    spire.lineTo(S.towerX1 + 18, S.towerTop - 80);
    spire.closePath();
    g.fillStyle = '#9e4f33';
    g.fill(spire);
    g.save();
    g.clip(spire);
    hatch(g, { x: S.towerX0 - 20, y: S.spire - 40, w: 190, h: 120 }, { angle: -0.7, spacing: 3.2, width: 0.9, color: INK, alpha: 0.25, seed: 507 });
    g.fillStyle = 'rgba(40,20,10,0.22)';
    g.beginPath();
    g.moveTo(540, S.spire - 40);
    g.lineTo(S.towerX1 + 18, S.towerTop - 80);
    g.lineTo(540, S.towerTop - 80);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.stroke(spire);
    // clock face (hands are drawn per frame)
    const [cx, cy, cr] = S.clock;
    g.fillStyle = '#c9a77a';
    g.beginPath();
    g.arc(cx, cy, cr + 8, 0, TAU);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 1.8;
    g.stroke();
    g.fillStyle = '#f7f0df';
    g.beginPath();
    g.arc(cx, cy, cr, 0, TAU);
    g.fill();
    g.stroke();
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      g.strokeStyle = INK;
      g.lineWidth = k % 3 ? 1.6 : 3;
      g.beginPath();
      g.moveTo(cx + Math.sin(a) * cr * 0.8, cy - Math.cos(a) * cr * 0.8);
      g.lineTo(cx + Math.sin(a) * cr * 0.93, cy - Math.cos(a) * cr * 0.93);
      g.stroke();
    }
    // outline of the main block
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(S.x0, S.top, S.x1 - S.x0, S.base - S.top);
  }
  // ---- glass (drawn over the people inside) ----
  const glass = new Layer(BOX.w, BOX.h, res, -BOX.x, -BOX.y);
  {
    const g = glass.g;
    for (const [x, y, w, h] of windowsAll()) {
      g.fillStyle = 'rgba(190,215,225,0.18)';
      g.fillRect(x, y, w, h);
      // reflections
      g.save();
      g.beginPath();
      g.rect(x, y, w, h);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath();
      g.moveTo(x + w * 0.15, y);
      g.lineTo(x + w * 0.38, y);
      g.lineTo(x + w * 0.05, y + h);
      g.lineTo(x - w * 0.18, y + h);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.beginPath();
      g.moveTo(x + w * 0.55, y);
      g.lineTo(x + w * 0.62, y);
      g.lineTo(x + w * 0.3, y + h);
      g.lineTo(x + w * 0.23, y + h);
      g.closePath();
      g.fill();
      g.restore();
      // frame + mullions
      g.strokeStyle = '#f4ecdc';
      g.lineWidth = 6;
      g.strokeRect(x + 3, y + 3, w - 6, h - 6);
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x + w / 2, y);
      g.lineTo(x + w / 2, y + h);
      g.moveTo(x, y + h * 0.42);
      g.lineTo(x + w, y + h * 0.42);
      g.stroke();
      g.strokeStyle = rgba(INK, 0.85);
      g.lineWidth = 1.4;
      g.strokeRect(x, y, w, h);
    }
  }
  return { back, front, glass, box: BOX };
}

export function drawClockHands(g, t, { tickT = null } = {}) {
  const [cx, cy, cr] = SCHOOL.clock;
  // the minute hand creeps; the second hand ticks once per second with a tiny overshoot
  const sec = Math.floor(t);
  const f = t - sec;
  const overshoot = f < 0.12 ? Math.sin((f / 0.12) * Math.PI) * 0.06 : 0;
  const sa = ((sec % 60) / 60 + overshoot / 60) * TAU + 0.6;
  const ma = (9 * 60 + 40 + t / 60) / 60 * TAU;
  const ha = (2 + 40 / 60) / 12 * TAU;
  g.save();
  g.strokeStyle = INK;
  g.lineCap = 'round';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.sin(ha) * cr * 0.5, cy - Math.cos(ha) * cr * 0.5);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.sin(ma) * cr * 0.75, cy - Math.cos(ma) * cr * 0.75);
  g.stroke();
  g.strokeStyle = '#c0392b';
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(cx - Math.sin(sa) * cr * 0.15, cy + Math.cos(sa) * cr * 0.15);
  g.lineTo(cx + Math.sin(sa) * cr * 0.85, cy - Math.cos(sa) * cr * 0.85);
  g.stroke();
  g.fillStyle = INK;
  g.beginPath();
  g.arc(cx, cy, 3, 0, TAU);
  g.fill();
  g.restore();
}

// ---------- vanishing ----------
// The ring radius as a function of time since the pop (matches ripple() in rings.js: easeOut).
export function makeVanish({ cx = 540, cy = 860, t0, rMax = 1500, dur = 1.9, cols = 19, rows = 25, seed = 900 }) {
  const cw = BOX.w / cols;
  const ch = BOX.h / rows;
  const rng = makeRng(seed);
  const cells = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = BOX.x + i * cw;
      const y = BOX.y + j * ch;
      const mx = x + cw / 2;
      const my = y + ch / 2;
      const d = Math.hypot(mx - cx, my - cy);
      // invert r = rMax * easeOut(u): u = 1 - cbrt(1 - r/rMax)
      const u = 1 - Math.cbrt(Math.max(0, 1 - d / rMax));
      const tr = t0 + u * dur + rng.range(0, 0.06);
      const ang = Math.atan2(my - cy, mx - cx);
      cells.push({
        x, y, w: cw, h: ch, mx, my, tr,
        vx: Math.cos(ang) * rng.range(40, 140) + rng.range(-40, 40),
        vy: Math.sin(ang) * rng.range(30, 90) - rng.range(60, 170),
        spin: rng.range(-3, 3),
        flutter: rng.range(1.5, 3.2),
        phase: rng.range(0, TAU),
        life: rng.range(1.8, 3.4),
        paper: rng.next() < 0.34,
        scrap: [rng.range(0.55, 0.95), rng.range(0.5, 0.8)],
        lines: rng.int(1, 3),
        tint: rng.pick(['#f7f1e3', '#f3ead6', '#efe6d0', '#f8f4ea']),
        dust: Array.from({ length: 3 }, () => [rng.range(-1, 1), rng.range(-1, 0.3), rng.range(0.6, 1.4), rng.range(1.2, 2.8)]),
        land: rng.next() < 0.12 ? rng.range(1255, 1400) : null,
      });
    }
  }
  return { cells, t0 };
}

// Draw unreleased cells of a layer in place.
export function drawIntact(g, L, V, t) {
  for (const c of V.cells) {
    if (t >= c.tr) continue;
    g.drawImage(L.c, (c.x - BOX.x) * L.res, (c.y - BOX.y) * L.res, c.w * L.res, c.h * L.res, c.x, c.y, c.w + 0.6, c.h + 0.6);
  }
}

// Draw released cells: the building piece pops, turns into a paper scrap or a puff of chalk dust and
// drifts away; some scraps settle on the grass.
export function drawReleased(g, layers, V, t) {
  for (const c of V.cells) {
    const a = t - c.tr;
    if (a < 0) continue;
    // chalk dust
    for (const [dx, dy, sp, sz] of c.dust) {
      const k = a / 1.3;
      if (k >= 1) continue;
      const drag = 1 - Math.exp(-a * 2.2);
      const px = c.mx + (dx * 60 * sp) * drag + c.vx * 0.15 * drag;
      const py = c.my + (dy * 50 * sp) * drag - 14 * a;
      g.fillStyle = `rgba(250,248,240,${0.55 * (1 - k) ** 1.5})`;
      g.beginPath();
      g.arc(px, py, sz * (1 + k * 1.8), 0, TAU);
      g.fill();
    }
    if (!c.paper) {
      // non-paper cells just flash away into dust
      const k = clamp(a / 0.22);
      if (k < 1) {
        g.save();
        g.globalAlpha = 1 - k;
        for (const L of layers) g.drawImage(L.c, (c.x - BOX.x) * L.res, (c.y - BOX.y) * L.res, c.w * L.res, c.h * L.res, c.x - k * 3, c.y - k * 3, c.w + k * 6, c.h + k * 6);
        g.restore();
      }
      continue;
    }
    if (a > c.life + 0.6 && !c.land) continue;
    // motion: initial burst with drag, then a gentle fall with side-to-side flutter
    const drag = 1 - Math.exp(-a * 1.6);
    let px = c.mx + (c.vx / 1.6) * drag + Math.sin(a * c.flutter + c.phase) * 14 * clamp(a);
    let py = c.my + (c.vy / 1.6) * drag + 22 * a * a * 0.5 + 18 * a;
    let rot = c.spin * a * 0.6 + Math.sin(a * c.flutter * 1.3 + c.phase) * 0.5;
    let alpha = 1 - clamp((a - c.life) / 0.6);
    if (c.land && py >= c.land) {
      // find when it landed (approximate: clamp) and rest there, flat
      py = c.land;
      rot = c.spin * 0.4;
      alpha = 1;
    }
    if (alpha <= 0) continue;
    const morph = clamp(a / 0.3);
    const sx = lerp(1, c.scrap[0], morph);
    const sy = lerp(1, c.scrap[1], morph) * (0.55 + 0.45 * Math.abs(Math.cos(a * c.flutter + c.phase)) * (c.land && py >= c.land ? 0 : 1) + (c.land && py >= c.land ? 0.45 : 0));
    g.save();
    g.translate(px, py);
    g.rotate(rot);
    g.scale(sx, sy);
    g.globalAlpha = alpha;
    if (morph < 1) {
      g.globalAlpha = alpha * (1 - morph);
      for (const L of layers) g.drawImage(L.c, (c.x - BOX.x) * L.res, (c.y - BOX.y) * L.res, c.w * L.res, c.h * L.res, -c.w / 2, -c.h / 2, c.w, c.h);
      g.globalAlpha = alpha * morph;
    }
    // paper scrap: cream sheet, ink outline, a couple of ruled blue lines
    g.fillStyle = c.tint;
    g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    g.strokeStyle = 'rgba(80,110,170,0.6)';
    g.lineWidth = 1.1;
    for (let k = 1; k <= c.lines; k++) {
      const yy = -c.h / 2 + (k / (c.lines + 1)) * c.h;
      g.beginPath();
      g.moveTo(-c.w / 2 + 2, yy);
      g.lineTo(c.w / 2 - 2, yy);
      g.stroke();
    }
    g.strokeStyle = 'rgba(46,34,25,0.7)';
    g.lineWidth = 1.2;
    g.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
    g.restore();
  }
}

export { BOX as SCHOOL_BOX, drawLayer };
