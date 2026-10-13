// 0:27.5-0:34.5 Quick montage on cream paper (the reference film's look): three circular insets pop
// in one after another — sleeping in, playing in the park, a backpack thrown away — each with a thin
// blue rim and a ring ripple. As the narrator lists "No homework. No tests. No alarms." the matching
// inset swells and its moment plays (homework flies out of the backpack, a test sheet becomes a
// paper plane, the alarm clock stays silent while the kid rolls over).
import { setCam } from '../kit/cam.js';
import { makeRng, clamp, lerp, smooth, smoothstep, easeOut, easeInOut, easeOutBack, TAU, rgba, shade, mix } from '../kit/util.js';
import { INK, smoothPath, hatch, mottle } from '../kit/paint.js';
import { makePerson, drawPerson, pose, groundShadow, blendPose, reach, headAt } from '../kit/person.js';
import { STAND, SIT_CHAIR, LEG, idle, walkCycle, jumpCycle, crouchDrop } from '../kit/motion.js';
import { blueDot, ring, ripple, arcFlicks, RING_BLUE } from '../kit/rings.js';
import { sky, treeLayers, drawTree, grassTufts } from '../kit/scenery.js';
import { VO } from '../vo_timing.js';
import { CAST } from './cast.js';

const PAPER = '#ebe5d8';
const L5 = VO[4].chunks.map((c) => c.t); // No homework / No tests / No alarms
const INSETS = [
  { id: 'sleep', x: 540, y: 455, r: 315, t0: 27.65, hi: L5[2] },
  { id: 'park', x: 305, y: 975, r: 265, t0: 27.9, hi: L5[1] },
  { id: 'bag', x: 785, y: 1066, r: 255, t0: 28.15, hi: Math.max(L5[0], 28.45) },
];

export async function build(env) {
  const { S } = env;
  const people = CAST.map(makePerson);
  const tree = treeLayers(S * 1.6, { h: 330, w: 260, seed: 71 });
  const rng = makeRng(5);

  // ---------- inset A: sleeping in ----------
  function sleep(g, t, R, hi) {
    // warm bedroom wall + window with morning sun
    g.fillStyle = '#f0c9a0';
    g.fillRect(-R, -R, 2 * R, 2 * R);
    const wg = g.createLinearGradient(0, -R, 0, R);
    wg.addColorStop(0, 'rgba(255,236,200,0.6)');
    wg.addColorStop(1, 'rgba(210,150,110,0.25)');
    g.fillStyle = wg;
    g.fillRect(-R, -R, 2 * R, 2 * R);
    hatch(g, { x: -R, y: -R, w: 2 * R, h: 2 * R }, { angle: -0.9, spacing: 4.5, width: 1, color: '#7a4a2a', alpha: 0.1, seed: 51, broken: 0.6 });
    // window
    g.fillStyle = '#bfe0ef';
    g.fillRect(40, -230, 190, 170);
    g.fillStyle = '#fff4d0';
    g.beginPath();
    g.arc(170, -190, 34, 0, TAU);
    g.fill();
    g.strokeStyle = '#f7efe0';
    g.lineWidth = 10;
    g.strokeRect(40, -230, 190, 170);
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(135, -230);
    g.lineTo(135, -60);
    g.stroke();
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.strokeRect(35, -235, 200, 180);
    // sunbeam sweeping slowly across the bed
    const sw = Math.sin(t * 0.5) * 20;
    g.fillStyle = 'rgba(255,245,210,0.35)';
    g.beginPath();
    g.moveTo(40, -230);
    g.lineTo(230, -60);
    g.lineTo(60 + sw, 220);
    g.lineTo(-170 + sw, 220);
    g.closePath();
    g.fill();
    // nightstand + alarm clock (silent: its hammer never moves)
    g.fillStyle = '#9a6a40';
    g.fillRect(-250, 20, 110, 150);
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.strokeRect(-250, 20, 110, 150);
    g.strokeRect(-240, 40, 90, 50);
    const cx = -195;
    const cy = -22;
    const bob = hi > 0 ? Math.sin(hi * Math.PI) * 4 : 0;
    g.fillStyle = '#d8463d';
    g.beginPath();
    g.arc(cx, cy - bob, 38, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = '#fbf6ea';
    g.beginPath();
    g.arc(cx, cy - bob, 29, 0, TAU);
    g.fill();
    g.stroke();
    for (const s of [-1, 1]) {
      g.fillStyle = '#c9963c';
      g.beginPath();
      g.arc(cx + s * 26, cy - 36 - bob, 13, Math.PI, 0);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx, cy - bob);
    g.lineTo(cx + 12, cy - 10 - bob);
    g.moveTo(cx, cy - bob);
    g.lineTo(cx - 2, cy + 20 - bob);
    g.stroke();
    // a little "off" switch glint on No alarms
    if (hi > 0) {
      g.strokeStyle = rgba(RING_BLUE, (1 - hi) * 0.9);
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy - bob, 50 + hi * 40, 0, TAU);
      g.stroke();
    }
    // bed: headboard, pillow, patchwork quilt rising and falling with slow breaths
    g.fillStyle = '#8a5a34';
    g.fillRect(-110, -60, 26, 250);
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.strokeRect(-110, -60, 26, 250);
    g.fillStyle = '#f7f1e3';
    g.beginPath();
    g.ellipse(-30, 30, 64, 30, 0.05, 0, TAU);
    g.fill();
    g.stroke();
    // sleeping kid's head on the pillow (the rig, rotated to lie down)
    const roll = smoothstep(0, 0.6, hi);
    const ch = people[3];
    const p = pose({ x: 0, y: 0, sc: 1.9, flip: 1, fv: 0.6, turn: lerp(0.35, -0.45, roll), roll: 0, spine: 0, neck: 0 });
    g.save();
    g.translate(50 + roll * 4, 26);
    g.rotate(-Math.PI / 2 + 0.06);
    drawPerson(g, ch, { ...p, aN: 2.8, eN: 0.6, aF: -0.1, eF: 0.2 }, { t, light: [0.4, -0.9] });
    g.restore();
    const breath = Math.sin(t * TAU / 3.6) * 4;
    const quilt = new Path2D();
    quilt.moveTo(-6, 52 - breath * 0.3);
    quilt.bezierCurveTo(40, 6 - breath, 160, 0 - breath, 260, 30);
    quilt.lineTo(300, 230);
    quilt.lineTo(-20, 230);
    quilt.closePath();
    g.save();
    g.fillStyle = '#7fa6c9';
    g.fill(quilt);
    g.clip(quilt);
    const cols = ['#e8b04a', '#d8705a', '#7fa6c9', '#9cc08a', '#f2e6cc'];
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 4; j++) {
        g.fillStyle = cols[(i * 2 + j * 3) % cols.length];
        g.fillRect(-90 + i * 66, -10 + j * 60, 62, 56);
      }
    }
    g.strokeStyle = 'rgba(255,250,235,0.7)';
    g.lineWidth = 2;
    g.setLineDash([6, 5]);
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      g.moveTo(-90 + i * 66, -20);
      g.lineTo(-90 + i * 66, 240);
      g.stroke();
    }
    g.setLineDash([]);
    hatch(g, { x: -100, y: -20, w: 420, h: 260 }, { angle: -0.8, spacing: 4, width: 1, color: INK, alpha: 0.18, seed: 52 });
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke(quilt);
  }

  // ---------- inset B: the park ----------
  const swingKid = people[1];
  const runKid = people[2];
  function park(g, t, R, hi) {
    sky(g, -R, -R, 2 * R, 2 * R, [[0, '#9fcbe2'], [0.55, '#d9ebe6'], [1, '#e8efd2']]);
    g.fillStyle = '#9fc06e';
    g.beginPath();
    g.moveTo(-R, 40);
    g.quadraticCurveTo(0, 10, R, 50);
    g.lineTo(R, R);
    g.lineTo(-R, R);
    g.closePath();
    g.fill();
    drawTree(g, tree, 150, 120, t, { scale: 0.75, seed: 3 });
    // swing frame
    g.strokeStyle = '#5a6e7a';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(-200, 150);
    g.lineTo(-150, -120);
    g.lineTo(10, -120);
    g.lineTo(60, 150);
    g.stroke();
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.stroke();
    // swinging kid: pendulum from the bar
    const th = Math.sin(t * 2.4) * 0.55;
    const px = -70;
    const py = -116;
    const L = 175;
    const sx = px + Math.sin(th) * L;
    const sy = py + Math.cos(th) * L;
    g.strokeStyle = '#6a5a4a';
    g.lineWidth = 2.5;
    for (const o of [-14, 14]) {
      g.beginPath();
      g.moveTo(px + o, py);
      g.lineTo(sx + o * Math.cos(th), sy - o * Math.sin(th));
      g.stroke();
    }
    g.save();
    g.translate(sx, sy);
    g.rotate(-th);
    g.fillStyle = '#9a6a40';
    g.fillRect(-20, -4, 40, 8);
    g.strokeStyle = INK;
    g.strokeRect(-20, -4, 40, 8);
    const legs = Math.cos(t * 2.4) * 0.7; // kick forward on the up-swing
    const sp = pose({ ...SIT_CHAIR, x: 0, y: -8, sc: 1.55, flip: 1, fv: 0.4, turn: 0.4, hN: 1.4 + legs * 0.3, kN: -1.2 + legs, hF: 1.3 + legs * 0.3, kF: -1.3 + legs, spine: -legs * 0.3, aN: 3.0, eN: -0.2, aF: 2.9, eF: -0.2, skirtFlutter: 1 });
    drawPerson(g, swingKid, sp, { t, light: [-0.6, -0.8] });
    g.restore();
    // a kid jumps for joy, and at "No tests" folds the test into a paper plane and throws it
    const ch = runKid;
    const y0 = 160 - LEG(ch.P) * 1.5;
    let p;
    const tk = t - (hi > 0 ? 0 : 99);
    const j = jumpCycle(t / 0.9, 22);
    p = pose({ ...STAND, ...j.pose, x: 70, y: y0 - j.dy * 1.5 + crouchDrop(ch.P, j.crouch) * 1.5, sc: 1.5, flip: -1, fv: 0.8, turn: -0.2 });
    groundShadow(g, 70, 160, 40, 0.2);
    drawPerson(g, ch, p, { t, light: [-0.6, -0.8] });
    // paper plane (the test) flies out on "No tests"
    const pa = t - (INSETS[1].hi - 0.05);
    if (pa > 0) {
      const x = 60 - pa * 160;
      const y = -40 - pa * 60 + Math.sin(pa * 3) * 14;
      g.save();
      g.translate(x, y);
      g.rotate(-0.25 + Math.sin(pa * 3) * 0.1);
      g.fillStyle = '#fbf7ee';
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-28, 0);
      g.lineTo(26, -8);
      g.lineTo(-20, 12);
      g.closePath();
      g.fill();
      g.stroke();
      g.strokeStyle = 'rgba(200,60,60,0.8)';
      g.beginPath();
      g.moveTo(-10, 2);
      g.lineTo(6, -2);
      g.stroke();
      g.restore();
    }
    grassTufts(g, t, { x0: -R, x1: R, y: R - 10, n: 60, len: [14, 30], seed: 81 });
  }

  // ---------- inset C: the backpack thrown away ----------
  const bagKid = people[6];
  const sheets = Array.from({ length: 9 }, () => ({ vx: rng.range(-120, 160), vy: rng.range(-260, -120), sp: rng.range(-4, 4), fl: rng.range(2, 3.4), ph: rng.range(0, TAU) }));
  function bag(g, t, R, hi) {
    sky(g, -R, -R, 2 * R, 2 * R, [[0, '#a7cfe4'], [0.6, '#eaf0dc'], [1, '#e6e0c8']]);
    // front yard: fence and lawn
    g.fillStyle = '#a9c779';
    g.fillRect(-R, 30, 2 * R, R);
    g.fillStyle = '#efe6d2';
    for (let x = -R; x < R; x += 34) {
      g.beginPath();
      g.moveTo(x, 40);
      g.lineTo(x, -40);
      g.lineTo(x + 11, -54);
      g.lineTo(x + 22, -40);
      g.lineTo(x + 22, 40);
      g.closePath();
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 1.6;
      g.stroke();
    }
    g.fillRect(-R, -20, 2 * R, 10);
    g.fillRect(-R, 15, 2 * R, 10);
    // the throw: wind-up (0-0.35), release (0.4), arms up after
    const tt = t - (INSETS[2].hi + 0.35);
    const ch = bagKid;
    const y0 = 150 - LEG(ch.P) * 1.55;
    const wind = smoothstep(-0.4, 0, tt) * (1 - smoothstep(0, 0.15, tt));
    const after = smoothstep(0.05, 0.4, tt);
    let p = pose({ ...STAND, x: -60, y: y0, sc: 1.55, flip: 1, fv: 0.55, turn: 0.4 });
    p = blendPose(p, pose({ ...p, spine: -0.15, aN: -1.4, eN: 0.6, aF: -0.6, eF: 0.4, hN: 0.3, kN: -0.3 }), wind);
    if (tt > 0) {
      const j = jumpCycle((tt - 0.3) / 0.8, 18);
      const jp = tt > 0.3 ? j : { dy: 0, crouch: 0, pose: {} };
      p = blendPose(p, pose({ ...STAND, ...jp.pose, x: -60, y: y0 - jp.dy * 1.55, sc: 1.55, flip: 1, fv: 0.8, turn: 0.15, aN: 2.7, eN: 0.2, aF: -2.6, eF: -0.2 }), after);
    }
    groundShadow(g, -60, 150, 42, 0.2);
    drawPerson(g, ch, p, { t, light: [-0.6, -0.8] });
    // the backpack: on his back, then flying away tumbling, then landing far right
    const bx = tt < 0 ? -78 : -60 + tt * 260;
    const by = tt < 0 ? y0 - 10 : y0 - 30 - tt * 220 + 260 * tt * tt;
    const land = by > 120;
    g.save();
    g.translate(land ? Math.min(bx, 170) : bx, land ? 120 : by);
    g.rotate(tt > 0 ? (land ? 1.2 : tt * 6) : -0.1);
    g.fillStyle = '#c8634a';
    g.strokeStyle = INK;
    g.lineWidth = 2.2;
    g.beginPath();
    g.roundRect(-22, -28, 44, 56, 10);
    g.fill();
    g.stroke();
    g.fillStyle = '#a8452f';
    g.beginPath();
    g.roundRect(-16, 2, 32, 20, 6);
    g.fill();
    g.stroke();
    g.restore();
    // homework sheets flying out of it
    if (tt > 0.15) {
      const a = tt - 0.15;
      sheets.forEach((q) => {
        const drag = 1 - Math.exp(-a * 1.6);
        const x = Math.min(bx, 170) + (q.vx / 1.6) * drag + Math.sin(a * q.fl + q.ph) * 10;
        const y = Math.min(by, 120) - 10 + (q.vy / 1.6) * drag + 40 * a * a;
        if (y > 160) return;
        g.save();
        g.translate(x, y);
        g.rotate(q.sp * a * 0.5);
        g.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(a * q.fl + q.ph)));
        g.fillStyle = '#fbf7ee';
        g.fillRect(-11, -14, 22, 28);
        g.strokeStyle = 'rgba(80,110,170,0.7)';
        g.lineWidth = 1.3;
        for (let k = 1; k < 5; k++) {
          g.beginPath();
          g.moveTo(-9, -14 + k * 5.6);
          g.lineTo(9, -14 + k * 5.6);
          g.stroke();
        }
        g.strokeStyle = INK;
        g.lineWidth = 1.4;
        g.strokeRect(-11, -14, 22, 28);
        g.restore();
      });
    }
    grassTufts(g, t, { x0: -R, x1: R, y: R - 6, n: 60, len: [14, 30], seed: 83 });
  }

  const DRAW = { sleep, park, bag };

  function inset(g, I, t) {
    const a = t - I.t0;
    if (a < 0) return;
    const pop = a < 0.5 ? easeOutBack(clamp(a / 0.45), 1.6) : 1;
    const hi = clamp((t - I.hi) / 1.1);
    const swell = Math.sin(clamp((t - I.hi + 0.1) / 0.9) * Math.PI) * 0.07;
    const k = pop * (1 + swell);
    const R = I.r;
    // soft drop shadow
    g.save();
    g.translate(I.x, I.y);
    g.scale(k, k);
    const sg = g.createRadialGradient(14, 22, R * 0.8, 14, 22, R * 1.12);
    sg.addColorStop(0, 'rgba(70,50,30,0.22)');
    sg.addColorStop(1, 'rgba(70,50,30,0)');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(14, 22, R * 1.12, 0, TAU);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.clip();
    DRAW[I.id](g, t, R, t > I.hi ? hi : 0);
    g.restore();
    ring(g, 0, 0, R, { width: 6, color: RING_BLUE });
    g.restore();
    ripple(g, I.x, I.y, t, I.t0 + 0.05, { rMax: R * 1.9, dur: 1.0, width: 4, count: 1 });
    ripple(g, I.x, I.y, t, I.hi, { rMax: R * 1.6, dur: 0.9, width: 4, count: 1 });
  }

  const scene = {
    draw(g, t) {
      g.setTransform(S, 0, 0, S, 0, 0);
      g.fillStyle = PAPER;
      g.fillRect(0, 0, 1080, 1920);
      // faint concentric construction rings (the film's paper backdrop)
      for (let i = 1; i < 6; i++) ring(g, 540, 900, 180 * i + ((t * 12) % 180), { width: 2, color: '#9bb3d6', alpha: 0.18, dashed: i % 2 === 0 });
      const z = 1 + (t - 27.5) * 0.008;
      setCam(g, S, 540, 920, z);
      // the blue dot sits at the heart of the cluster, like the film
      blueDot(g, 540, 800, 13, 1);
      for (const I of INSETS) inset(g, I, t);
      arcFlicks(g, 540, 800, t, 27.6, { ang: -0.8, r0: 30, spread: 80 });
    },
    // hand-off into the globe: insets shrink into dots, then a dark circle opens from the centre
    handoff(g, t, u, A, B, Ss) {
      g.drawImage(A, 0, 0);
      const W = g.canvas.width;
      const H = g.canvas.height;
      const r = easeInOut(u) * Math.hypot(W, H) * 0.55;
      g.save();
      g.beginPath();
      g.arc(W / 2, H * 0.42, r, 0, TAU);
      g.clip();
      g.drawImage(B, 0, 0);
      g.restore();
      g.strokeStyle = RING_BLUE;
      g.lineWidth = 5 * Ss;
      g.beginPath();
      g.arc(W / 2, H * 0.42, r, 0, TAU);
      g.stroke();
    },
  };
  return scene;
}
