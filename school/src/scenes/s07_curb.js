// 0:42.5-0:50 "Within weeks, the fun runs out." Late afternoon on a quiet street. Four kids sit on the
// curb doing nothing: chin in hands, leaning back staring at the sky, poking the ground with a stick,
// idly nudging a ball. The ball rolls away down the road; one kid watches it go, then looks back
// down. Nobody chases it. A small calendar inset crosses off the days (weeks passing).
import { Layer, drawLayer, hatch, mottle, stipple, INK } from '../kit/paint.js';
import { setCam } from '../kit/cam.js';
import { makeRng, clamp, lerp, smooth, smoothstep, easeOut, easeInOut, easeOutBack, keys, TAU, rgba, shade, mix } from '../kit/util.js';
import { makePerson, drawPerson, pose, groundShadow, blendPose, reach, headAt, joints } from '../kit/person.js';
import { idle } from '../kit/motion.js';
import { sky, treeLayers, drawTree, vignette } from '../kit/scenery.js';
import { ring, ripple, RING_BLUE } from '../kit/rings.js';
import { CAST } from './cast.js';

const CURB = 1190; // top of the curb (where they sit)
const ROAD = 1228; // road surface
const SC = 3.05;
const T0 = 42.5;
const SIT_CURB = { hN: 1.2, kN: -1.45, fN: 0.15, hF: 1.1, kF: -1.35, fF: 0.15 };

export async function build(env) {
  const { S } = env;
  const people = CAST.map(makePerson);
  const tree = treeLayers(S * 1.4, { h: 560, w: 420, seed: 91, leaf: '#7a9a58', leafDark: '#566f40', leafLight: '#b5c98a' });
  const rng = makeRng(707);
  // the street, drawn once
  const street = new Layer(1300, 1400, S * 1.1, 110, -560);
  {
    const g = street.g;
    // houses
    const houses = [
      [-80, 250, '#d9a07a', '#8e4f3a'],
      [180, 230, '#c9b48a', '#6f5a7a'],
      [430, 270, '#e0c39a', '#9e4f33'],
      [720, 240, '#b8a3c4', '#5e5a7a'],
      [970, 250, '#d6b48a', '#8e4f3a'],
    ];
    for (const [x, w, wall, roof] of houses) {
      const top = 690 + rng.range(-20, 30);
      g.fillStyle = wall;
      g.fillRect(x, top, w, 1000 - top);
      g.save();
      g.beginPath();
      g.rect(x, top, w, 1000 - top);
      g.clip();
      hatch(g, { x, y: top, w, h: 1000 - top }, { angle: -0.9, spacing: 4.5, width: 1, color: '#4a2f22', alpha: 0.14, seed: x + 3, broken: 0.6 });
      const sh = g.createLinearGradient(x, 0, x + w, 0);
      sh.addColorStop(0, 'rgba(60,30,40,0)');
      sh.addColorStop(1, 'rgba(60,30,40,0.22)');
      g.fillStyle = sh;
      g.fillRect(x, top, w, 1000 - top);
      g.restore();
      g.strokeStyle = INK;
      g.lineWidth = 2.4;
      g.strokeRect(x, top, w, 1000 - top);
      // roof
      g.fillStyle = roof;
      g.beginPath();
      g.moveTo(x - 18, top + 4);
      g.lineTo(x + w / 2, top - 120);
      g.lineTo(x + w + 18, top + 4);
      g.closePath();
      g.fill();
      g.stroke();
      // windows with warm light
      for (const wx of [x + w * 0.18, x + w * 0.6]) {
        g.fillStyle = '#f6d58e';
        g.fillRect(wx, top + 60, w * 0.22, 80);
        g.fillStyle = 'rgba(255,240,190,0.35)';
        g.fillRect(wx - 6, top + 54, w * 0.22 + 12, 92);
        g.strokeStyle = '#f4ecdc';
        g.lineWidth = 4;
        g.strokeRect(wx, top + 60, w * 0.22, 80);
        g.strokeStyle = INK;
        g.lineWidth = 1.6;
        g.strokeRect(wx - 2, top + 58, w * 0.22 + 4, 84);
      }
      g.fillStyle = shade(wall, -0.35).map ? rgba(shade(wall, -0.35)) : '#6a4a3a';
      g.fillRect(x + w * 0.42, 900, 40, 100);
      g.strokeRect(x + w * 0.42, 900, 40, 100);
    }
    // hedge / low wall along the sidewalk
    g.fillStyle = '#6f8f55';
    for (let x = -100; x < 1200; x += 40) {
      g.beginPath();
      g.arc(x, 1000, 34 + rng.range(-6, 6), Math.PI, 0);
      g.fill();
    }
    g.fillStyle = '#5a7a44';
    g.fillRect(-110, 995, 1320, 18);
    // sidewalk
    g.fillStyle = '#d8d0c0';
    g.fillRect(-110, 1010, 1320, CURB - 1010);
    mottle(g, null, { x: -110, y: 1010, w: 1320, h: CURB - 1010 }, { base: '#d8d0c0', count: 40, size: [30, 90], amount: 0.1, seed: 71 });
    g.strokeStyle = 'rgba(90,80,70,0.4)';
    g.lineWidth = 2;
    for (let x = -100; x < 1200; x += 150) {
      g.beginPath();
      g.moveTo(x, 1010);
      g.lineTo(x - 30, CURB);
      g.stroke();
    }
    stipple(g, null, { x: -110, y: 1010, w: 1320, h: CURB - 1010 }, { count: 1800, r: [0.6, 1.4], color: '#6a6050', alpha: 0.3, seed: 72 });
    // curb (top edge + face)
    g.fillStyle = '#c9c0ae';
    g.fillRect(-110, CURB - 6, 1320, 12);
    g.fillStyle = '#9a9384';
    g.fillRect(-110, CURB + 6, 1320, ROAD - CURB - 6);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-110, CURB - 6);
    g.lineTo(1210, CURB - 6);
    g.moveTo(-110, ROAD);
    g.lineTo(1210, ROAD);
    g.stroke();
    // road
    const rd = g.createLinearGradient(0, ROAD, 0, 1960);
    rd.addColorStop(0, '#6b6870');
    rd.addColorStop(1, '#55535c');
    g.fillStyle = rd;
    g.fillRect(-110, ROAD, 1320, 1960 - ROAD);
    stipple(g, null, { x: -110, y: ROAD, w: 1320, h: 1960 - ROAD }, { count: 5000, r: [0.6, 1.6], color: '#2e2a30', alpha: 0.35, seed: 73 });
    stipple(g, null, { x: -110, y: ROAD, w: 1320, h: 1960 - ROAD }, { count: 2500, r: [0.6, 1.3], color: '#b8b4bc', alpha: 0.25, seed: 74 });
    // dashed centre line
    g.fillStyle = '#e8d9a8';
    for (let x = -100; x < 1200; x += 170) g.fillRect(x, 1640, 100, 12);
    // gutter shadow
    const gs = g.createLinearGradient(0, ROAD, 0, ROAD + 40);
    gs.addColorStop(0, 'rgba(20,15,25,0.35)');
    gs.addColorStop(1, 'rgba(20,15,25,0)');
    g.fillStyle = gs;
    g.fillRect(-110, ROAD, 1320, 40);
    // lamp post
    g.fillStyle = '#3e4a52';
    g.fillRect(990, 640, 14, 390);
    g.strokeStyle = INK;
    g.lineWidth = 1.6;
    g.strokeRect(990, 640, 14, 390);
    g.fillStyle = '#f2dc9a';
    g.beginPath();
    g.arc(997, 630, 22, 0, TAU);
    g.fill();
    g.stroke();
  }
  // leaves drifting
  const leaves = Array.from({ length: 16 }, () => ({ x: rng.range(-200, 1200), y: rng.range(500, 1500), s: rng.range(0.7, 1.3), v: rng.range(30, 70), ph: rng.range(0, TAU), c: rng.pick(['#c9963c', '#b5642d', '#d8a85a', '#8a9a48']) }));

  const KIDS = [
    { c: 6, x: 140, role: 'ball' },
    { c: 2, x: 396, role: 'lean' },
    { c: 3, x: 566, role: 'chin' },
    { c: 1, x: 722, role: 'stick' },
  ];
  // the ball: nudged at 45.35 by the boy on the left, it rolls right along the gutter past every
  // kid's feet and out of frame (~48.4). Nobody gets up.
  const BALL0 = [222, 1262];
  const BALL_T = 45.35;
  const ballX = (t) => {
    const a = Math.max(0, t - BALL_T);
    // decelerating roll: v0 = 320, drag
    return BALL0[0] + (320 / 0.3) * (1 - Math.exp(-0.3 * a));
  };
  // a lazy glance as the ball passes a kid (0..1), no other movement
  const glance = (o, t) => {
    if (t < BALL_T) return 0;
    const d = ballX(t) - (o.x + 60);
    return Math.exp(-((d / 150) ** 2));
  };

  function kidPose(o, t) {
    const ch = people[o.c];
    const base = { ...SIT_CURB, x: o.x, y: CURB - 4 * SC, flip: o.flip ?? 1, sc: SC, fv: 0.32, turn: 0.35 };
    let p;
    if (o.role === 'chin') {
      // elbows on the knees, chin propped on both fists; a slow sigh lifts the shoulders
      const sigh = Math.exp(-(((t - 44.6) / 0.5) ** 2));
      const gl = glance(o, t);
      p = pose({ ...base, spine: 0.8, hunch: 0.35, neck: -0.75 + gl * 0.2, roll: 0.1, turn: 0.3 + gl * 0.45, fv: 0.4, shrug: sigh * 0.5, hN: 1.75, kN: -2.25, fN: 0.4, hF: 1.65, kF: -2.1, fF: 0.4 });
      const h = headAt(ch, p);
      reach(ch, p, 'N', h.x + h.r * 0.55, h.y + h.r * 1.05, -1);
      reach(ch, p, 'F', h.x + h.r * 0.25, h.y + h.r * 1.1, -1);
    } else if (o.role === 'lean') {
      // leaning back on the hands, staring up; a slow sigh
      const sigh = Math.exp(-(((t - 46.4) / 0.6) ** 2));
      const gl = glance(o, t);
      p = pose({ ...base, spine: -0.3, hunch: 0.15, neck: -0.25 - sigh * 0.1 + gl * 0.35, roll: -0.1, turn: 0.1 + gl * 0.5, aN: -0.7, eN: 0.1, aF: -0.85, eF: 0.15, shrug: 0.3 + sigh * 0.5, hN: 1.35, kN: -1.0, hF: 1.25, kF: -0.8 });
    } else if (o.role === 'ball') {
      // elbows on knees; nudges the ball with his foot, watches it roll off, looks back down
      const nudge = Math.exp(-(((t - BALL_T + 0.12) / 0.16) ** 2));
      const look = smoothstep(BALL_T + 0.2, BALL_T + 0.8, t) * (1 - smoothstep(BALL_T + 2.0, BALL_T + 2.8, t));
      p = pose({ ...base, spine: 0.82 - look * 0.12, hunch: 0.45, neck: 0.15 - look * 0.75, roll: 0.1 - look * 0.15, turn: lerp(0.4, 0.9, look), hN: 1.65 - nudge * 0.35, kN: -2.1 + nudge * 1.1, fN: 0.35, hF: 1.6, kF: -2.0, fF: 0.35 });
      // elbows on the knees, forearms and hands hanging between them
      p.aN = 0.12;
      p.eN = 0.55;
      p.aF = 0.05;
      p.eF = 0.6;
    } else {
      // poking at the ground with a stick, slowly
      const gl = glance(o, t);
      const poke = (Math.sin(t * 2.2) * 0.5 + 0.5) * (1 - gl * 0.8);
      p = pose({ ...base, spine: 0.3, hunch: 0.55, neck: 0.55 - gl * 0.3, roll: 0.2, turn: 0.4 + gl * 0.4, aN: 0.55 + poke * 0.2, eN: 0.25 - poke * 0.15, aF: 0.6, eF: 1.0, skirtFlutter: 0.1 });
    }
    return idle(p, t, o.c, 0.8);
  }

  const stick = (g, x, y, a) => {
    g.save();
    g.translate(x, y);
    g.rotate(-a);
    g.strokeStyle = '#6f4a2a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(2, 48);
    g.moveTo(1, 30);
    g.lineTo(7, 36);
    g.stroke();
    g.restore();
  };

  function ball(g, t) {
    const x = ballX(t);
    const r = 26;
    // two small hops off the boy's shoe, then a plain roll
    const a = t - BALL_T;
    const hop = a > 0 && a < 0.9 ? Math.abs(Math.sin((a / 0.9) * Math.PI * 2)) * 14 * (1 - a / 0.9) : 0;
    const y = BALL0[1] + 20 - hop;
    const ang = (x - BALL0[0]) / r;
    groundShadow(g, x + 6, y + r - 2, 36, 0.3);
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = '#d8463d';
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fill();
    g.fillStyle = '#f2e6cc';
    g.fillRect(-r, -5, 2 * r, 10);
    g.strokeStyle = INK;
    g.lineWidth = 2.2;
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.stroke();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath();
    g.ellipse(x - 8, y - 10, 7, 4, -0.6, 0, TAU);
    g.fill();
  }

  // calendar inset: the days get crossed off (weeks go by)
  function calendar(g, t) {
    const a = smoothstep(42.75, 43.1, t) * (1 - smoothstep(47.2, 47.7, t));
    if (a <= 0) return;
    const cx = 250;
    const cy = 330;
    const R = 150;
    const pop = easeOutBack(clamp((t - 42.75) / 0.4), 1.4);
    g.save();
    g.globalAlpha = a;
    g.translate(cx, cy);
    g.scale(pop, pop);
    g.fillStyle = 'rgba(40,30,30,0.2)';
    g.beginPath();
    g.arc(10, 14, R * 1.04, 0, TAU);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.clip();
    g.fillStyle = '#f4ecdc';
    g.fillRect(-R, -R, 2 * R, 2 * R);
    // calendar page
    g.fillStyle = '#d8463d';
    g.fillRect(-100, -95, 200, 40);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(-100, -95, 200, 190);
    const n = Math.floor(clamp((t - 43.0) / 3.2) * 28);
    for (let k = 0; k < 28; k++) {
      const col = k % 7;
      const row = Math.floor(k / 7);
      const x = -96 + col * 27.5;
      const y = -50 + row * 36;
      g.strokeStyle = 'rgba(46,34,25,0.5)';
      g.lineWidth = 1.4;
      g.strokeRect(x, y, 26, 34);
      if (k < n) {
        g.strokeStyle = '#3a5fa8';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x + 5, y + 6);
        g.lineTo(x + 21, y + 28);
        g.moveTo(x + 21, y + 6);
        g.lineTo(x + 5, y + 28);
        g.stroke();
      }
    }
    // rings on the binding
    g.fillStyle = INK;
    for (const x of [-60, 0, 60]) {
      g.beginPath();
      g.arc(x, -95, 5, 0, TAU);
      g.fill();
    }
    g.restore();
    ring(g, 0, 0, R, { width: 5, color: RING_BLUE });
    g.restore();
  }

  function draw(g, t) {
    g.setTransform(S, 0, 0, S, 0, 0);
    sky(g, 0, 0, 1080, 1920, [[0, '#b7a6cf'], [0.3, '#dcb9c4'], [0.48, '#f2c9a6'], [0.6, '#f6dcb8']], [700, 560, 600, '#ffe2b8', 0.6]);
    const z = 1.22 + smooth(clamp((t - T0) / 7.5)) * 0.05;
    setCam(g, S, 470, 1100, z);
    // distant soft hills behind the houses
    g.fillStyle = 'rgba(150,130,170,0.45)';
    g.beginPath();
    g.moveTo(-100, 760);
    g.quadraticCurveTo(300, 640, 600, 720);
    g.quadraticCurveTo(900, 790, 1200, 700);
    g.lineTo(1200, 1000);
    g.lineTo(-100, 1000);
    g.closePath();
    g.fill();
    drawLayer(g, street, 0, 0);
    drawTree(g, tree, 120, 1004, t, { scale: 0.9, seed: 5 });
    // kids on the curb
    for (const o of KIDS) {
      const p = kidPose(o, t);
      if (o.role === 'stick') p.handN = (gg, x, y, a, st) => st === 'fill' && stick(gg, x, y, a);
      groundShadow(g, o.x + 40, ROAD + 34, 84, 0.25);
      drawPerson(g, people[o.c], p, { t, light: [0.6, -0.8] });
    }
    ball(g, t);
    // leaves
    for (const L of leaves) {
      const x = ((L.x + (t - T0) * L.v * 1.6 + 1400) % 1400) - 150;
      const y = L.y + Math.sin((t - T0) * 1.3 + L.ph) * 30 + (t - T0) * L.v * 0.3;
      g.save();
      g.translate(x, y);
      g.rotate(Math.sin((t - T0) * 2 + L.ph) * 1.2);
      g.scale(L.s, L.s * Math.abs(Math.cos((t - T0) * 2.4 + L.ph)) + 0.2);
      g.fillStyle = L.c;
      g.beginPath();
      g.ellipse(0, 0, 11, 5, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(46,34,25,0.6)';
      g.lineWidth = 1.2;
      g.stroke();
      g.restore();
    }
    g.setTransform(S, 0, 0, S, 0, 0);
    calendar(g, t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    vignette(g, g.canvas.width, g.canvas.height, 0.32, '#2a1a30');
  }
  return { draw };
}
