// 0:00-0:05.5 Classroom. A little boy rests his head on his hand, bored, staring at the ticking clock
// above the board; other kids yawn and slump; the teacher writes on the board. The scene then pulls
// back out through the boy's window to the whole school (handoff into the field scene).
import { Layer, drawLayer, hatch, mottle, stipple, INK } from '../kit/paint.js';
import { setCam } from '../kit/cam.js';
import { makeRng, clamp, lerp, smooth, smoothstep, easeInOut, keys, TAU, rgba, shade, mix } from '../kit/util.js';
import { makePerson, drawPerson, pose, groundShadow, blendPose, reach, headAt, joints } from '../kit/person.js';
import { STAND, SIT_CHAIR, HEAD_ON_HAND, LEG, idle, keyPose } from '../kit/motion.js';
import { beam, vignette } from '../kit/scenery.js';
import { CAST } from './cast.js';

export const CLOCK = [300, 300, 100];

// The bored boy (shared with the ending so the upper body is exactly the same): slumped, elbow
// down, cheek resting on his hand, head tipped back a little toward the clock.
export const BOY_UPPER = { spine: 0.42, hunch: 0.5, neck: -0.05, roll: -0.28, turn: 0.25, fv: 0.4, aF: 0.75, eF: 0.9 };
export function boredBoy(ch, t, extra = {}) {
  const breathe = Math.sin((t * TAU) / 4.2);
  // one slow sigh: shoulders rise and fall
  const sigh = Math.exp(-(((t % 9) - 1.9) ** 2) * 2.5);
  const p = pose({
    ...SIT_CHAIR,
    ...BOY_UPPER,
    breath: breathe,
    shrug: sigh * 0.55,
    spine: BOY_UPPER.spine + sigh * 0.03,
    roll: BOY_UPPER.roll + Math.sin(t * 0.6) * 0.02,
    ...extra,
  });
  // hand under the cheek (IK)
  const h = headAt(ch, p);
  reach(ch, p, 'N', h.x + h.r * 0.55, h.y + h.r * 0.92, 'fwd');
  return p;
}

function drawClock(g, x, y, r, t) {
  // case
  g.save();
  g.fillStyle = 'rgba(60,40,20,0.25)';
  g.beginPath();
  g.arc(x + 8, y + 10, r + 14, 0, TAU);
  g.fill();
  g.fillStyle = '#8a5a34';
  g.beginPath();
  g.arc(x, y, r + 14, 0, TAU);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 3;
  g.stroke();
  const face = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  face.addColorStop(0, '#fffaf0');
  face.addColorStop(1, '#efe4cc');
  g.fillStyle = face;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.stroke();
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * TAU;
    const big = k % 5 === 0;
    g.strokeStyle = INK;
    g.lineWidth = big ? 5 : 2;
    g.beginPath();
    g.moveTo(x + Math.sin(a) * r * (big ? 0.78 : 0.86), y - Math.cos(a) * r * (big ? 0.78 : 0.86));
    g.lineTo(x + Math.sin(a) * r * 0.93, y - Math.cos(a) * r * 0.93);
    g.stroke();
  }
  // hands: hour/minute creep, second hand ticks each second with a small overshoot
  const sec = Math.floor(t + 23);
  const f = t + 23 - sec;
  const over = f < 0.14 ? Math.sin((f / 0.14) * Math.PI) * 0.09 : 0;
  const sa = ((sec + over) / 60) * TAU;
  const ma = ((38 + t / 60) / 60) * TAU;
  const ha = ((1 + 38 / 60) / 12) * TAU;
  g.lineCap = 'round';
  g.strokeStyle = INK;
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.sin(ha) * r * 0.5, y - Math.cos(ha) * r * 0.5);
  g.stroke();
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + Math.sin(ma) * r * 0.78, y - Math.cos(ma) * r * 0.78);
  g.stroke();
  g.strokeStyle = '#c0392b';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x - Math.sin(sa) * r * 0.18, y + Math.cos(sa) * r * 0.18);
  g.lineTo(x + Math.sin(sa) * r * 0.86, y - Math.cos(sa) * r * 0.86);
  g.stroke();
  g.fillStyle = '#c0392b';
  g.beginPath();
  g.arc(x, y, 6, 0, TAU);
  g.fill();
  // glass glint
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(x, y, r * 0.8, Math.PI * 1.1, Math.PI * 1.4);
  g.stroke();
  g.restore();
}

// Side-view school desk (top + legs) and chair, facing left (the kid sits on the right).
function desk(g, x, y, s, flip = -1) {
  g.save();
  g.translate(x, y);
  g.scale(s * flip * -1, s);
  // chair (behind the kid's legs, to the right)
  const wood = '#a87445';
  g.lineWidth = 2.2 / s;
  g.strokeStyle = INK;
  g.fillStyle = shade(wood, -0.1).map ? rgba(shade(wood, -0.1)) : wood;
  // desk top on the left
  const top = new Path2D();
  top.rect(-78, -40, 62, 7);
  g.fillStyle = rgba(wood);
  g.fill(top);
  g.stroke(top);
  g.fillStyle = rgba(shade(wood, -0.25));
  g.fillRect(-74, -33, 4, 33);
  g.strokeRect(-74, -33, 4, 33);
  g.fillRect(-26, -33, 4, 33);
  g.strokeRect(-26, -33, 4, 33);
  // book box under the top
  g.fillStyle = rgba(shade(wood, -0.15));
  g.fillRect(-76, -33, 56, 8);
  g.strokeRect(-76, -33, 56, 8);
  g.restore();
}

function chair(g, x, y, s, flip = -1) {
  g.save();
  g.translate(x, y);
  g.scale(s * flip * -1, s);
  const wood = '#9a6a40';
  g.lineWidth = 2.2 / s;
  g.strokeStyle = INK;
  g.fillStyle = rgba(wood);
  // seat
  g.fillRect(-12, -22, 26, 4);
  g.strokeRect(-12, -22, 26, 4);
  // legs
  g.fillRect(-11, -18, 3, 18);
  g.strokeRect(-11, -18, 3, 18);
  g.fillRect(10, -18, 3, 18);
  g.strokeRect(10, -18, 3, 18);
  // back rest
  g.fillRect(11, -50, 3.5, 30);
  g.strokeRect(11, -50, 3.5, 30);
  g.fillRect(9, -52, 8, 12);
  g.strokeRect(9, -52, 8, 12);
  g.restore();
}

// The boy's desk, seen close: a thick wooden top, a book and a pencil, legs to the floor.
function bigDesk(g, x, top, w, floor) {
  const wood = '#a87445';
  g.save();
  g.lineWidth = 3;
  g.strokeStyle = INK;
  // legs
  g.fillStyle = rgba(shade(wood, -0.3));
  for (const lx of [x + 24, x + w - 48]) {
    g.fillRect(lx, top + 30, 24, floor - top - 30);
    g.strokeRect(lx, top + 30, 24, floor - top - 30);
  }
  // book box
  g.fillStyle = rgba(shade(wood, -0.2));
  g.fillRect(x + 10, top + 30, w - 20, 50);
  g.strokeRect(x + 10, top + 30, w - 20, 50);
  // top
  const tp = new Path2D();
  tp.rect(x, top, w, 32);
  g.fillStyle = rgba(wood);
  g.fill(tp);
  g.save();
  g.clip(tp);
  hatch(g, { x, y: top, w, h: 32 }, { angle: 0.05, spacing: 4, width: 1.2, color: INK, alpha: 0.3, seed: 31, broken: 0.5 });
  g.fillStyle = 'rgba(255,240,210,0.25)';
  g.fillRect(x, top, w, 6);
  g.restore();
  g.stroke(tp);
  // a closed exercise book and a pencil on the desk
  g.fillStyle = '#5f86b0';
  g.fillRect(x + 40, top - 14, 150, 14);
  g.strokeRect(x + 40, top - 14, 150, 14);
  g.fillStyle = '#f3ead6';
  g.fillRect(x + 44, top - 10, 142, 5);
  g.fillStyle = '#e0b040';
  g.save();
  g.translate(x + 230, top - 6);
  g.rotate(-0.08);
  g.fillRect(0, 0, 110, 9);
  g.strokeRect(0, 0, 110, 9);
  g.fillStyle = '#f1c7a5';
  g.beginPath();
  g.moveTo(110, 0);
  g.lineTo(128, 4.5);
  g.lineTo(110, 9);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  g.restore();
}

export async function build(env) {
  const { S } = env;
  const people = CAST.map(makePerson);
  const field = await env.get('field');
  // static room drawn once
  const room = new Layer(1080, 1920, S * 1.15, 0, 0);
  {
    const g = room.g;
    const wall = g.createLinearGradient(0, 0, 0, 1180);
    wall.addColorStop(0, '#dcc18e');
    wall.addColorStop(1, '#ecd7a8');
    g.fillStyle = wall;
    g.fillRect(0, 0, 1080, 1180);
    mottle(g, null, { x: 0, y: 0, w: 1080, h: 1180 }, { base: '#e7cf9f', count: 50, size: [60, 200], amount: 0.1, seed: 11 });
    hatch(g, { x: 0, y: 0, w: 1080, h: 1180 }, { angle: -0.9, spacing: 5, width: 1, color: '#6a4a2a', alpha: 0.1, seed: 12, broken: 0.6 });
    // wainscot
    g.fillStyle = '#b98a57';
    g.fillRect(0, 960, 1080, 220);
    for (let x = 0; x < 1080; x += 54) {
      g.strokeStyle = 'rgba(70,45,25,0.45)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, 965);
      g.lineTo(x, 1180);
      g.stroke();
    }
    hatch(g, { x: 0, y: 960, w: 1080, h: 220 }, { angle: 1.45, spacing: 3.2, width: 0.9, color: INK, alpha: 0.18, seed: 13 });
    g.fillStyle = '#8a5f38';
    g.fillRect(0, 952, 1080, 14);
    // floor boards in perspective toward a vanishing point
    const vp = [520, 760];
    g.fillStyle = '#c08e5c';
    g.fillRect(0, 1180, 1080, 740);
    const fl = g.createLinearGradient(0, 1180, 0, 1920);
    fl.addColorStop(0, 'rgba(70,40,20,0.35)');
    fl.addColorStop(1, 'rgba(70,40,20,0)');
    g.fillStyle = fl;
    g.fillRect(0, 1180, 1080, 740);
    g.strokeStyle = 'rgba(70,40,20,0.35)';
    g.lineWidth = 2;
    for (let k = -14; k <= 14; k++) {
      const xb = 540 + k * 110;
      g.beginPath();
      g.moveTo(lerp(vp[0], xb, (1180 - vp[1]) / (1920 - vp[1])), 1180);
      g.lineTo(xb, 1920);
      g.stroke();
    }
    hatch(g, { x: 0, y: 1180, w: 1080, h: 740 }, { angle: 0.1, spacing: 4, width: 0.9, color: INK, alpha: 0.12, seed: 14, broken: 0.7 });
    // chalkboard with a wooden frame and a chalk ledge
    const bx = 50;
    const by = 480;
    const bw = 570;
    const bh = 380;
    g.fillStyle = '#7a5232';
    g.fillRect(bx - 16, by - 16, bw + 32, bh + 32);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.strokeRect(bx - 16, by - 16, bw + 32, bh + 32);
    const bg = g.createLinearGradient(bx, by, bx + bw, by + bh);
    bg.addColorStop(0, '#3f5a4a');
    bg.addColorStop(1, '#324a3c');
    g.fillStyle = bg;
    g.fillRect(bx, by, bw, bh);
    // chalk smudges
    const r = makeRng(15);
    for (let i = 0; i < 26; i++) {
      const x = bx + r.next() * bw;
      const y = by + r.next() * bh;
      const rg = g.createRadialGradient(x, y, 0, x, y, r.range(30, 90));
      rg.addColorStop(0, 'rgba(230,236,226,0.07)');
      rg.addColorStop(1, 'rgba(230,236,226,0)');
      g.fillStyle = rg;
      g.fillRect(bx, by, bw, bh);
    }
    // chalk writing: a sum, a little sum line, and a doodled sun
    g.save();
    g.beginPath();
    g.rect(bx, by, bw, bh);
    g.clip();
    g.font = 'italic 500 86px "EBGaramond"';
    g.fillStyle = 'rgba(240,240,232,0.88)';
    g.fillText('7 × 8 = ?', bx + 50, by + 130);
    g.font = 'italic 500 70px "EBGaramond"';
    g.fillText('12 + 9 = 21', bx + 60, by + 250);
    g.strokeStyle = 'rgba(240,240,232,0.8)';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(bx + 60, by + 285);
    g.lineTo(bx + 380, by + 280);
    g.stroke();
    g.beginPath();
    g.arc(bx + 470, by + 120, 36, 0, TAU);
    g.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      g.beginPath();
      g.moveTo(bx + 470 + Math.cos(a) * 48, by + 120 + Math.sin(a) * 48);
      g.lineTo(bx + 470 + Math.cos(a) * 66, by + 120 + Math.sin(a) * 66);
      g.stroke();
    }
    // chalky breakup: speckle out the writing a little
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = 'rgba(50,72,60,0.6)';
      g.fillRect(bx + r.next() * bw, by + r.next() * bh, r.range(1, 3), r.range(1, 3));
    }
    g.restore();
    g.fillStyle = '#8a5f38';
    g.fillRect(bx - 20, by + bh + 14, bw + 40, 14);
    g.strokeRect(bx - 20, by + bh + 14, bw + 40, 14);
    g.fillStyle = '#f4f0e6';
    g.fillRect(bx + 80, by + bh + 8, 22, 7);
    g.fillRect(bx + 120, by + bh + 9, 14, 6);
    // window on the right
    const wx = 720;
    const wy = 470;
    const ww = 300;
    const wh = 460;
    const sk = g.createLinearGradient(0, wy, 0, wy + wh);
    sk.addColorStop(0, '#a8cfe2');
    sk.addColorStop(1, '#e8eedc');
    g.fillStyle = sk;
    g.fillRect(wx, wy, ww, wh);
    // a tree outside
    g.fillStyle = '#7da35a';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(wx + 90 + r.range(-60, 80), wy + 230 + r.range(-90, 60), r.range(50, 80), 0, TAU);
      g.fill();
    }
    g.fillStyle = '#9fbf7a';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(wx + 70 + r.range(-40, 60), wy + 190 + r.range(-60, 40), r.range(28, 44), 0, TAU);
      g.fill();
    }
    g.fillStyle = '#6f5034';
    g.fillRect(wx + 110, wy + 290, 22, 200);
    g.fillStyle = '#b9d08c';
    g.fillRect(wx, wy + wh - 70, ww, 70);
    g.strokeStyle = '#f2e8d4';
    g.lineWidth = 14;
    g.strokeRect(wx, wy, ww, wh);
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(wx + ww / 2, wy);
    g.lineTo(wx + ww / 2, wy + wh);
    g.moveTo(wx, wy + wh * 0.45);
    g.lineTo(wx + ww, wy + wh * 0.45);
    g.stroke();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.strokeRect(wx - 7, wy - 7, ww + 14, wh + 14);
    g.fillStyle = '#e2d2b4';
    g.fillRect(wx - 24, wy + wh + 6, ww + 48, 16);
    g.strokeRect(wx - 24, wy + wh + 6, ww + 48, 16);
    // a poster: alphabet blocks (no text: coloured squares)
    const cols = ['#d8463d', '#e8b04a', '#5f9e8f', '#6f86c0', '#c96f9a'];
    cols.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(720 + i * 58, 130, 48, 48);
      g.strokeRect(720 + i * 58, 130, 48, 48);
      g.fillStyle = 'rgba(255,250,235,0.85)';
      g.beginPath();
      g.arc(744 + i * 58, 154, 10, 0, TAU);
      g.fill();
    });
  }

  // cast in the room
  const SEATS = [
    { c: 3, x: 800, y: 1262, s: 3.1, role: 'yawnBig' },
    { c: 5, x: 1010, y: 1262, s: 3.1, role: 'headDown' },
    { c: 2, x: 150, y: 1372, s: 3.7, role: 'yawnHand' },
    { c: 6, x: 395, y: 1372, s: 3.7, role: 'write' },
  ];
  const BOY = { c: 0, x: 800, hip: 1450, s: 6.0 };
  const teacher = { c: 7, x: 655, feet: 1210, s: 3.45 };

  function seatedPose(o, t) {
    const ch = people[o.c];
    const Pp = ch.P;
    const hipY = o.y - (Pp.shin + 4.6) * o.s - 3 * o.s;
    const base = { ...SIT_CHAIR, x: o.x, y: hipY, flip: -1, sc: o.s, fv: 0.35, turn: 0.35 };
    let p;
    if (o.role === 'yawnBig') {
      // a big stretching yawn: arms up and back, head tips back, then slumps back down
      const k = smoothstep(0.5, 1.4, t) * (1 - smoothstep(3.0, 3.9, t));
      p = blendPose(pose({ ...base, aN: 0.8, eN: 1.2, aF: 0.6, eF: 1.1, hunch: 0.3 }), pose({ ...base, aN: 3.0, eN: 0.5, aF: 2.8, eF: 0.6, spine: -0.18, neck: -0.45, hunch: -0.1, shrug: 0.6 }), k);
    } else if (o.role === 'headDown') {
      p = pose({ ...base, spine: 0.85, hunch: 0.7, neck: 0.5, roll: 0.3, aN: 1.35, eN: 1.6, aF: 1.25, eF: 1.7, turn: 0.2 });
    } else if (o.role === 'write') {
      // slowly doodling, chin low, pencil hand moving
      const w = Math.sin(t * 7) * 0.1;
      p = pose({ ...base, spine: 0.3, hunch: 0.4, neck: 0.4, aN: 0.95, eN: 0.9 + w, aF: 0.8, eF: 1.2, turn: 0.15 });
    } else {
      // yawn behind a hand: head tips back, hand to the mouth, then rubs an eye
      const k = smoothstep(1.4, 2.0, t) * (1 - smoothstep(3.6, 4.2, t));
      p = blendPose(pose({ ...base, spine: 0.2, hunch: 0.4, aN: 0.9, eN: 1.1, aF: 0.7, eF: 1.1 }), pose({ ...base, spine: -0.05, hunch: 0.2, neck: -0.35, shrug: 0.5, turn: 0.45, aF: 0.6, eF: 1.0 }), k);
      if (k > 0) {
        const h = headAt(ch, p);
        const q = { ...p };
        reach(ch, q, 'N', h.x + h.r * 0.75, h.y + h.r * 0.45, 1);
        p = blendPose(pose({ ...p, aN: 0.9, eN: 1.1 }), q, k);
      }
    }
    return idle(p, t, o.c * 1.3, 0.8);
  }

  function boyPose(t) {
    return boredBoy(people[0], t, { x: BOY.x, y: BOY.hip, flip: -1, sc: BOY.s });
  }

  function teacherPose(t) {
    const ch = people[teacher.c];
    const y = teacher.feet - LEG(ch.P) * teacher.s;
    const p = idle(pose({ ...STAND, x: teacher.x, y, flip: -1, sc: teacher.s, fv: 0.3, turn: -0.75, aF: 0.2, eF: 1.6, spine: 0.06 }), t, 7);
    // chalk hand writes on the board: small loops moving along a line (IK to a board point)
    const wx = 545 + Math.sin(t * 1.3) * 26 + Math.sin(t * 9) * 5;
    const wy = 720 + Math.cos(t * 7) * 6;
    reach(ch, p, 'N', (wx - p.x) / (p.flip * p.sc), (wy - p.y) / p.sc, -1);
    return p;
  }

  const chalk = (g, x, y, a) => {
    g.save();
    g.translate(x, y);
    g.rotate(-a + 0.3);
    g.fillStyle = '#f7f4ec';
    g.strokeStyle = INK;
    g.lineWidth = 1;
    g.fillRect(-1.6, -9, 3.2, 10);
    g.strokeRect(-1.6, -9, 3.2, 10);
    g.restore();
  };

  const scene = {
    draw(g, t) {
      // slow push toward the boy and the clock
      const z = 1 + smooth(clamp(t / 5.2)) * 0.07;
      setCam(g, S, 540, 980, z);
      drawLayer(g, room, 0, 0);
      drawClock(g, CLOCK[0], CLOCK[1], CLOCK[2], t);
      // teacher at the board
      const tp = teacherPose(t);
      tp.handN = (gg, x, y, a, st) => st === 'fill' && chalk(gg, x, y, a);
      groundShadow(g, teacher.x, teacher.feet + 2, 40 * teacher.s, 0.22);
      drawPerson(g, people[teacher.c], tp, { t, light: [0.7, -0.7] });
      // sunbeam from the window across the room
      beam(g, [[720, 430], [1020, 430], [560, 1500], [120, 1420]], t, { alpha: 0.16, motes: 46, seed: 4 });
      // rows of desks back to front
      for (const o of SEATS) {
        chair(g, o.x + 8 * o.s, o.y, o.s);
        const p = seatedPose(o, t);
        groundShadow(g, o.x - 10 * o.s, o.y + 1, 46 * o.s, 0.2);
        drawPerson(g, people[o.c], p, { t, light: [0.7, -0.7] });
        desk(g, o.x - 2 * o.s, o.y, o.s);
      }
      // the boy, big in the foreground, his desk top right under his elbow
      const bp = boyPose(t);
      const J = joints(people[0], bp);
      const elbowY = bp.y + (J.elN[1] + people[0].P.armW * 1.2) * bp.sc;
      const floorY = bp.y + (people[0].P.shin + 4.6) * bp.sc + 3 * bp.sc;
      groundShadow(g, BOY.x - 60, floorY + 4, 300, 0.22);
      chair(g, BOY.x + 8 * BOY.s, floorY, BOY.s);
      bigDesk(g, BOY.x - 480, elbowY, 440, floorY);
      drawPerson(g, people[0], bp, { t, light: [0.7, -0.7] });
      g.setTransform(1, 0, 0, 1, 0, 0);
      vignette(g, g.canvas.width, g.canvas.height, 0.32);
    },
    // pull back out through the boy's window to the school (B = field)
    handoff(g, t, u, A, B, Ss) {
      g.drawImage(B, 0, 0);
      const e = easeInOut(clamp(u / 0.95));
      const [wx, wy, ww, wh] = field.windowRect(t).map((v) => v * Ss);
      const W = g.canvas.width;
      const H = g.canvas.height;
      const x = lerp(0, wx, e);
      const y = lerp(0, wy, e);
      const w = lerp(W, ww, e);
      const h = lerp(H, wh, e);
      const fade = 1 - smoothstep(0.75, 1, u);
      if (fade <= 0) return;
      g.save();
      g.globalAlpha = fade;
      g.beginPath();
      g.rect(x, y, w, h);
      g.clip();
      // cover-fit the classroom into the shrinking frame, centred on the boy
      const k = Math.max(w / W, h / H);
      const dw = W * k;
      const dh = H * k;
      const fx = 0.62;
      const fy = 0.62;
      g.drawImage(A, x + w / 2 - dw * fx, y + h / 2 - dh * fy, dw, dh);
      g.restore();
      // the window frame closing in around it
      g.save();
      g.globalAlpha = fade * smoothstep(0.05, 0.4, u);
      g.strokeStyle = '#f4ecdc';
      g.lineWidth = Math.max(6 * Ss, 26 * Ss * (1 - e));
      g.strokeRect(x, y, w, h);
      g.strokeStyle = INK;
      g.lineWidth = 2.5 * Ss;
      g.strokeRect(x - g.lineWidth, y - g.lineWidth, w + 2 * g.lineWidth, h + 2 * g.lineWidth);
      g.restore();
    },
  };
  return scene;
}
