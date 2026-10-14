// 1:15-1:25.5 Ending. The same boy, framed exactly as in the first shot, in exactly the same bored
// pose (head on his hand), but sitting on the empty grass where the school stood. A chalk-line
// ghost of the classroom draws itself around him: the clock above (its second hand ticks again),
// the board, the desk under his elbow. On "nothing to learn" the ghost board blows away as chalk
// dust. On "Would you still wish for it?" the film's blue dot pops at the clock and a last ring
// ripples out; the ghosts dissolve with it and the ticking stops. Silence; the camera eases back
// over the empty field and the frame fades to cream paper.
import { drawLayer, strokePartial, INK } from '../kit/paint.js';
import { setCam } from '../kit/cam.js';
import { makeRng, clamp, lerp, smooth, smoothstep, easeOut, TAU, rgba } from '../kit/util.js';
import { makePerson, drawPerson, groundShadow, joints } from '../kit/person.js';
import { idle } from '../kit/motion.js';
import { sky, hillLayer, meadowLayer, grassTufts, treeLayers, drawTree, vignette } from '../kit/scenery.js';
import { blueDot, ripple, arcFlicks } from '../kit/rings.js';
import { boredBoy, CLOCK } from './s01_classroom.js';
import { CAST } from './cast.js';
import { VO } from '../vo_timing.js';

const CH = VO[10].chunks; // "He's bored again." / "This time, there's nothing to learn." / "Would you still wish for it?"
const BOY = { x: 800, hip: 1450, s: 6.0 };
const GROUND = BOY.hip + 4 * BOY.s; // sitting on the grass
const CHALK = '#f8f3e6';
const T_CLOCK = 75.75;
const T_BOARD = CH[1].t + 0.1;
const T_ERASE = CH[1].t + 1.55;
const T_RING = Math.max(CH[2].t + 1.75, 81.4);
const T_FADE = 84.7;
const END = 85.5;
const BOARD = { x: 50, y: 480, w: 570, h: 380 };
const WIN = { x: 720, y: 470, w: 300, h: 460 };
// sitting on the grass: knees drawn up; the upper body is exactly the classroom pose
const LEGS = { hN: 1.6, kN: -1.95, fN: 0.35, hF: 1.5, kF: -1.85, fF: 0.35 };

function chalkLine(g, pts, a, w = 4.5, f = 1, closed = false) {
  if (a <= 0 || f <= 0) return;
  const P = closed ? [...pts, pts[0]] : pts;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  // a soft dark under-stroke so the chalk reads against the sky
  g.strokeStyle = rgba('#2c3a4c', 0.16 * a);
  g.lineWidth = w + 5;
  strokePartial(g, P, f);
  g.strokeStyle = rgba(CHALK, 0.85 * a);
  g.lineWidth = w;
  strokePartial(g, P, f);
  g.save();
  g.translate(1.6, 1.2);
  g.strokeStyle = rgba(CHALK, 0.3 * a);
  g.lineWidth = w * 0.45;
  strokePartial(g, P, f);
  g.restore();
}
const circlePts = (cx, cy, r, n = 64) => Array.from({ length: n }, (_, i) => [cx + Math.sin((i / n) * TAU) * r, cy - Math.cos((i / n) * TAU) * r]);

export async function build(env) {
  const { S } = env;
  const boy = makePerson(CAST[0]);
  const hills = [
    hillLayer(S * 0.8, { w: 1900, y0: 120, amp: 55, freq: 1.1, color: '#a3b2c4', haze: '#dfdcd0', seed: 3, trees: 30, treeColor: '#97a8bb', h: 260 }),
    hillLayer(S * 0.9, { w: 1900, y0: 120, amp: 42, freq: 1.6, color: '#8aa385', haze: '#c9d3ae', seed: 7, trees: 60, treeColor: '#7a9676', h: 240 }),
  ];
  const meadow = meadowLayer(S * 2.0, { x0: -400, y0: 1010, w: 1900, h: 1300, base: '#9fbd6e', far: '#c3d39a', dark: '#5a7a38', light: '#dfe7b0', seed: 41 });
  const treeL = treeLayers(S * 1.4, { h: 520, w: 380, seed: 61 });
  const treeR = treeLayers(S * 1.4, { h: 460, w: 340, seed: 67, leaf: '#76a052' });
  const rng = makeRng(1111);
  // chalk dust: the board blows away (left to right), later the clock and desk go with the ring
  const boardDust = Array.from({ length: 420 }, () => {
    const side = rng.int(0, 4);
    let x;
    let y;
    if (side === 0) [x, y] = [BOARD.x + rng.next() * BOARD.w, BOARD.y];
    else if (side === 1) [x, y] = [BOARD.x + rng.next() * BOARD.w, BOARD.y + BOARD.h];
    else if (side === 2) [x, y] = [BOARD.x + (rng.next() < 0.5 ? 0 : BOARD.w), BOARD.y + rng.next() * BOARD.h];
    else if (side === 3) [x, y] = [BOARD.x + 120 + rng.next() * 330, BOARD.y + 150 + rng.next() * 80];
    else [x, y] = rng.next() < 0.5 ? [WIN.x + rng.next() * WIN.w, WIN.y + (rng.next() < 0.5 ? 0 : WIN.h)] : [WIN.x + (rng.next() < 0.5 ? 0 : WIN.w), WIN.y + rng.next() * WIN.h];
    return { x, y, t0: T_ERASE + ((x - BOARD.x) / (WIN.x + WIN.w - BOARD.x)) * 1.3 + rng.range(0, 0.2), vx: rng.range(70, 190), vy: rng.range(-70, -15), r: rng.range(1.8, 4), life: rng.range(0.9, 1.6) };
  });
  const ringDust = Array.from({ length: 220 }, () => {
    const onClock = rng.next() < 0.6;
    const a = rng.range(0, TAU);
    const x = onClock ? CLOCK[0] + Math.sin(a) * CLOCK[2] * rng.range(0.2, 1.05) : rng.range(300, 760);
    const y = onClock ? CLOCK[1] - Math.cos(a) * CLOCK[2] * rng.range(0.2, 1.05) : rng.range(1230, 1290);
    const d = Math.hypot(x - CLOCK[0], y - CLOCK[1]);
    return { x, y, t0: T_RING + d / 1500 * 1.2, vx: rng.range(30, 120), vy: rng.range(-80, -20), r: rng.range(1.8, 3.6), life: rng.range(0.8, 1.4) };
  });

  function dust(g, list, t) {
    for (const d of list) {
      const a = t - d.t0;
      if (a < 0 || a > d.life) continue;
      const u = a / d.life;
      g.fillStyle = rgba(CHALK, 0.75 * (1 - u));
      g.beginPath();
      g.arc(d.x + d.vx * a + Math.sin(a * 6 + d.x) * 6, d.y + d.vy * a, d.r * (1 - u * 0.4), 0, TAU);
      g.fill();
    }
  }

  // the ghost clock: same face layout and the same ticking second hand as the classroom clock
  function ghostClock(g, t, a) {
    const [x, y, r] = CLOCK;
    const f = easeOut(clamp((t - T_CLOCK) / 0.8));
    chalkLine(g, circlePts(x, y, r + 14), a, 5, f, true);
    chalkLine(g, circlePts(x, y, r), a * 0.6, 3, f, true);
    if (f < 1) return;
    for (let k = 0; k < 12; k++) {
      const q = (k / 12) * TAU;
      chalkLine(g, [[x + Math.sin(q) * r * 0.76, y - Math.cos(q) * r * 0.76], [x + Math.sin(q) * r * 0.92, y - Math.cos(q) * r * 0.92]], a, 4.5);
    }
    const sec = Math.floor(t + 23);
    const fr = t + 23 - sec;
    const over = fr < 0.14 ? Math.sin((fr / 0.14) * Math.PI) * 0.09 : 0;
    const sa = ((sec + over) / 60) * TAU;
    const ma = ((38 + t / 60) / 60) * TAU;
    const ha = ((1 + 38 / 60) / 12) * TAU;
    chalkLine(g, [[x, y], [x + Math.sin(ha) * r * 0.5, y - Math.cos(ha) * r * 0.5]], a, 8);
    chalkLine(g, [[x, y], [x + Math.sin(ma) * r * 0.78, y - Math.cos(ma) * r * 0.78]], a, 5.5);
    chalkLine(g, [[x - Math.sin(sa) * r * 0.18, y + Math.cos(sa) * r * 0.18], [x + Math.sin(sa) * r * 0.86, y - Math.cos(sa) * r * 0.86]], a, 3.5);
  }

  function ghostBoard(g, t) {
    const f = easeOut(clamp((t - T_BOARD) / 0.7));
    // erased left to right: a moving clip edge
    const er = clamp((t - T_ERASE) / 1.3);
    if (f <= 0 || er >= 1) return;
    g.save();
    if (er > 0) {
      g.beginPath();
      g.rect(BOARD.x - 20 + er * (WIN.x + WIN.w + 40 - BOARD.x), BOARD.y - 40, 2000, WIN.h + 80);
      g.clip();
    }
    const { x, y, w, h } = BOARD;
    chalkLine(g, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], 0.9, 5, f, true);
    // the classroom window beside it (four panes)
    const W = WIN;
    chalkLine(g, [[W.x, W.y], [W.x + W.w, W.y], [W.x + W.w, W.y + W.h], [W.x, W.y + W.h]], 0.85, 5, f, true);
    chalkLine(g, [[W.x + W.w / 2, W.y], [W.x + W.w / 2, W.y + W.h]], 0.7, 4, f);
    chalkLine(g, [[W.x, W.y + W.h * 0.45], [W.x + W.w, W.y + W.h * 0.45]], 0.7, 4, f);
    chalkLine(g, [[W.x - 14, W.y + W.h + 12], [W.x + W.w + 14, W.y + W.h + 12]], 0.7, 4, f);
    chalkLine(g, [[x + 12, y + h + 14], [x + w - 12, y + h + 14]], 0.7, 4, f);
    const ta = smoothstep(T_BOARD + 0.5, T_BOARD + 1.0, t);
    if (ta > 0) {
      g.font = 'italic 500 84px "EBGaramond"';
      g.textAlign = 'center';
      g.fillStyle = rgba(CHALK, 0.7 * ta);
      g.fillText('7 × 8 = ?', x + w / 2, y + h / 2 + 28);
    }
    g.restore();
  }

  function ghostDesk(g, t, a, elbowY) {
    const f = easeOut(clamp((t - (T_CLOCK + 0.35)) / 0.8));
    const x = BOY.x - 480;
    const w = 440;
    chalkLine(g, [[x, elbowY], [x + w, elbowY], [x + w, elbowY + 32], [x, elbowY + 32]], a, 5, f, true);
    chalkLine(g, [[x + 36, elbowY + 32], [x + 36, GROUND - 4]], a, 5, f);
    chalkLine(g, [[x + w - 36, elbowY + 32], [x + w - 36, GROUND - 4]], a, 5, f);
    chalkLine(g, [[x + 40, elbowY - 14], [x + 190, elbowY - 14]], a * 0.8, 4, f);
  }

  function cam(t) {
    // starts on the classroom's final framing, then (after the last line) eases back over the field
    const k = smooth(clamp((t - 81.9) / 3.2));
    return { x: lerp(540, 600, k), y: lerp(980, 1060, k), z: lerp(1.07, 0.86, k) };
  }

  function draw(g, t) {
    const c = cam(t);
    g.setTransform(S, 0, 0, S, 0, 0);
    sky(g, 0, 0, 1080, 1920, [[0, '#7a99b9'], [0.3, '#a3b9cc'], [0.47, '#d6d3c4'], [0.55, '#efd9b4'], [1, '#efd9b4']], [820, 760, 640, '#ffe7bf', 0.4]);
    setCam(g, S, 540 + (c.x - 540) * 0.5, c.y, c.z);
    drawLayer(g, hills[0], 540, 900);
    setCam(g, S, 540 + (c.x - 540) * 0.75, c.y, c.z);
    drawLayer(g, hills[1], 540, 950);
    setCam(g, S, c.x, c.y, c.z);
    drawLayer(g, meadow, 0, 0);
    // where the school stood: a pale patch of flattened grass and a path leading to nothing
    g.fillStyle = 'rgba(214,206,160,0.55)';
    g.beginPath();
    g.moveTo(230, 1060);
    g.lineTo(870, 1060);
    g.lineTo(960, 1235);
    g.lineTo(140, 1235);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(120,110,70,0.3)';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = 'rgba(200,180,140,0.6)';
    g.beginPath();
    g.moveTo(505, 1060);
    g.lineTo(575, 1060);
    g.lineTo(610, 1010);
    g.lineTo(590, 1010);
    g.closePath();
    g.fill();
    drawTree(g, treeL, 40, 1090, t, { scale: 0.62, seed: 1 });
    drawTree(g, treeR, 1050, 1080, t, { scale: 0.58, seed: 2 });
    grassTufts(g, t, { x0: -300, x1: 1400, y: 1250, n: 120, len: [10, 22], seed: 25 });
    // the ghosts (fade with the final ring)
    const ga = 1 - smoothstep(T_RING + 0.05, T_RING + 0.6, t);
    // the boy (same pose function as the classroom)
    const bp = idle(boredBoy(boy, t, { x: BOY.x, y: BOY.hip, flip: -1, sc: BOY.s, ...LEGS }), t, 0, 0);
    const J = joints(boy, bp);
    const elbowY = bp.y + (J.elN[1] + boy.P.armW * 1.2) * bp.sc;
    if (ga > 0) {
      ghostClock(g, t, ga);
      ghostBoard(g, t);
    }
    dust(g, boardDust, t);
    dust(g, ringDust, t);
    groundShadow(g, BOY.x - 20, GROUND + 6, 230, 0.26);
    drawPerson(g, boy, bp, { t, light: [0.7, -0.7] });
    // the last ring, from the clock
    const dotA = smoothstep(T_RING - 0.35, T_RING - 0.15, t) * (1 - smoothstep(T_RING + 0.9, T_RING + 1.5, t));
    if (dotA > 0) {
      const s = 1 + Math.max(0, Math.sin(clamp((t - T_RING + 0.35) / 0.3) * Math.PI)) * 0.35;
      blueDot(g, CLOCK[0], CLOCK[1], 13 * s, dotA);
    }
    ripple(g, CLOCK[0], CLOCK[1], t, T_RING, { rMax: 1700, dur: 2.0, width: 6, count: 2, gap: 0.2 });
    arcFlicks(g, CLOCK[0], CLOCK[1], t, T_RING + 0.05, { ang: 0.6, r0: 40, spread: 120, width: 6 });
    grassTufts(g, t, { x0: -300, x1: 1400, y: GROUND + 90, n: 200, len: [24, 56], seed: 26, wind: 0.8 });
    grassTufts(g, t, { x0: -300, x1: 1400, y: GROUND + 420, n: 220, len: [30, 66], seed: 27, wind: 0.8 });
    g.setTransform(1, 0, 0, 1, 0, 0);
    vignette(g, g.canvas.width, g.canvas.height, 0.3);
    // fade to cream paper at the very end
    const fa = smoothstep(T_FADE, END - 0.05, t);
    if (fa > 0) {
      g.fillStyle = rgba('#f3e6c8', fa);
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    }
  }
  return { draw };
}
