// 1:06-1:15 "And kids lose the place where they made friends." Lilac dusk in an empty park. Close
// on a kid sitting alone under a big tree, knees hugged, head down. The camera eases back to reveal
// four friends standing together on the path inside a soft ring of light; one by one they turn
// away and walk off slowly in different directions, heads low, and the ring breaks apart. The kid
// lifts his head to watch them go, then lowers it again. Leaves fall. Then a slow push back in.
import { drawLayer } from '../kit/paint.js';
import { setCam } from '../kit/cam.js';
import { makeRng, clamp, lerp, smooth, smoothstep, keys, TAU, rgba } from '../kit/util.js';
import { makePerson, drawPerson, pose, groundShadow, joints, reach } from '../kit/person.js';
import { STAND, HUG_KNEES, LEG, keyPose, idle, walkCycle } from '../kit/motion.js';
import { sky, hillLayer, meadowLayer, grassTufts, treeLayers, drawTree, vignette } from '../kit/scenery.js';
import { ring } from '../kit/rings.js';
import { CAST } from './cast.js';

const T0 = 66.0;
const GROUND = 1335; // the kid under the tree sits here
const SC_KID = 3.6;
const MEET = [662, 1120]; // where the friends stand together
const SC_F = 2.4;

// camera keys [t, cx, cy, z]
const CAM = [
  [66.0, 362, 1190, 1.55],
  [67.6, 372, 1180, 1.48],
  [70.2, 535, 1045, 1.12],
  [72.6, 528, 1050, 1.12],
  [74.7, 430, 1140, 1.26],
];
function cam(t) {
  if (t <= CAM[0][0]) return { x: CAM[0][1], y: CAM[0][2], z: CAM[0][3] };
  for (let i = 1; i < CAM.length; i++) {
    if (t <= CAM[i][0]) {
      const [t0, x0, y0, z0] = CAM[i - 1];
      const [t1, x1, y1, z1] = CAM[i];
      const u = smooth((t - t0) / (t1 - t0));
      return { x: lerp(x0, x1, u), y: lerp(y0, y1, u), z: lerp(z0, z1, u) };
    }
  }
  const L = CAM[CAM.length - 1];
  return { x: L[1], y: L[2], z: L[3] };
}

// the friends: where they stand, which way they leave, when, and how far into the distance
const FRIENDS = [
  { c: 3, x: 568, y: 1124, face: 1, dir: [-0.45, -0.9], depth: 0.85, go: 68.15, speed: 46 },
  { c: 6, x: 630, y: 1110, face: 1, dir: [0.05, -1], depth: 0.9, go: 68.9, speed: 34 },
  { c: 1, x: 702, y: 1112, face: -1, dir: [0.85, -0.5], depth: 0.6, go: 68.55, speed: 46 },
  { c: 2, x: 764, y: 1126, face: -1, dir: [1, 0.04], depth: 0.05, go: 69.3, speed: 64 },
];

export async function build(env) {
  const { S } = env;
  const people = CAST.map(makePerson);
  const hills = [
    hillLayer(S * 0.8, { w: 1900, y0: 120, amp: 50, freq: 1.2, color: '#8b80aa', haze: '#d9b6bc', seed: 13, trees: 30, treeColor: '#7f749e', h: 260 }),
    hillLayer(S * 0.9, { w: 1900, y0: 120, amp: 38, freq: 1.7, color: '#76806e', haze: '#b9a9a8', seed: 17, trees: 50, treeColor: '#6b745f', h: 240 }),
  ];
  const meadow = meadowLayer(S * 2.0, { x0: -320, y0: 1040, w: 1720, h: 1000, base: '#8d9a72', far: '#aaa58c', dark: '#56624a', light: '#c9c3a2', seed: 47 });
  const tree = treeLayers(S * 1.8, { h: 640, w: 470, seed: 101, leaf: '#6c8a5c', leafDark: '#465c44', leafLight: '#9fb486', bark: '#6a4a36' });
  const rng = makeRng(1010);
  const leaves = Array.from({ length: 22 }, () => ({
    x0: rng.range(60, 520),
    y0: rng.range(760, 980),
    per: rng.range(3.6, 5.6),
    off: rng.range(0, 6),
    drift: rng.range(40, 120),
    ph: rng.range(0, TAU),
    s: rng.range(0.8, 1.3),
    c: rng.pick(['#c9963c', '#b5642d', '#d8a85a', '#a8743a', '#8f9a58']),
  }));
  const stars = Array.from({ length: 18 }, () => ({ x: rng.range(40, 1040), y: rng.range(60, 520), r: rng.range(1.6, 2.8), ph: rng.range(0, TAU) }));

  function friendState(F, t) {
    const ch = people[F.c];
    const P = ch.P;
    const a = t - F.go;
    // turn away: through a front-ish view, then the walking direction
    const turnU = clamp(a / 0.6);
    const walkDir = F.dir[0] >= 0 ? 1 : -1;
    const flip = turnU < 0.5 ? F.face : walkDir;
    const fvTurn = Math.sin(turnU * Math.PI) * 0.5;
    // distance walked (eases in from a standstill)
    const w = Math.max(0, a - 0.35);
    const dist = F.speed * (w - (w < 0.8 ? w - (w * w) / 1.6 : 0.4));
    const u = clamp(dist / 260); // how far into the distance (for depth scaling)
    const sc = SC_F * (1 - F.depth * 0.45 * u);
    const x = F.x + F.dir[0] * dist;
    const yFeet = F.y + F.dir[1] * dist * 0.55;
    const walking = w > 0;
    let p;
    if (!walking) {
      // standing together, chatting quietly (small nods and weight shifts), then turning away
      const nod = Math.sin(t * 2.1 + F.c) * 0.08;
      p = pose({ ...STAND, x, y: yFeet - LEG(P) * sc, flip, sc, fv: 0.35 + fvTurn, turn: 0.25 - fvTurn * 0.4, neck: 0.12 + nod + turnU * 0.15, hunch: 0.15 + turnU * 0.1 });
    } else {
      const ph = dist / (60 * (sc / SC_F)) + F.c * 0.13;
      const wc = walkCycle(ph, { amp: 0.32, arm: 0.3, sad: 1 });
      p = pose({ ...STAND, ...wc.pose, x, y: yFeet - LEG(P) * sc - wc.bob * sc * 0.6, flip, sc, fv: 0.3, turn: 0.1, skirtFlutter: 0.3 });
    }
    return { p: idle(p, t, F.c, 0.6), x, yFeet, sc, u };
  }

  function friendRing(g, t) {
    // a soft ring of light around their feet that stretches and breaks as they drift apart
    const st = FRIENDS.map((F) => friendState(F, t));
    const br = smoothstep(68.3, 70.6, t);
    const a = (1 - smoothstep(70.0, 71.6, t)) * smoothstep(66.2, 66.8, t);
    if (a <= 0) return;
    const cx = MEET[0];
    const cy = MEET[1] + 6;
    g.save();
    g.translate(cx, cy);
    g.scale(1, 0.24);
    const glow = g.createRadialGradient(0, 0, 40, 0, 0, 200);
    glow.addColorStop(0, rgba('#ffe2c0', 0.22 * a * (1 - br)));
    glow.addColorStop(1, rgba('#ffe2c0', 0));
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, 200, 0, TAU);
    g.fill();
    if (br <= 0) {
      ring(g, 0, 0, 195, { width: 5, color: '#efd9b6', alpha: 0.8 * a });
    } else {
      // four arcs, each pulled outward toward the friend leaving that way
      g.lineCap = 'round';
      st.forEach((s, i) => {
        const ang = Math.atan2((s.yFeet - cy) / 0.24, s.x - cx);
        const span = (TAU / 4) * (1 - br * 0.7) * 0.85;
        const push = br * 60;
        g.strokeStyle = rgba('#efd9b6', 0.8 * a);
        g.lineWidth = 5;
        g.beginPath();
        g.arc(Math.cos(ang) * push, Math.sin(ang) * push, 195 + br * 20, ang - span / 2, ang + span / 2);
        g.stroke();
      });
    }
    g.restore();
  }

  // sitting on the grass, knees drawn up, arms folded across them, head resting on the arms
  const SAD_SIT = { spine: 0.1, hunch: 0.5, neck: 1.3, roll: 0.15, turn: 0.45, fv: 0.45, hN: 2.1, kN: -2.45, fN: 0.45, hF: 2.0, kF: -2.35, fF: 0.45 };
  function kid(g, t) {
    const ch = people[0];
    // head lifts to watch the friends leave, then sinks again; one long sigh
    const look = smoothstep(69.4, 70.4, t) * (1 - smoothstep(71.6, 72.6, t));
    const sigh = Math.exp(-(((t - 73.2) / 0.5) ** 2));
    const p = idle(pose({ ...SAD_SIT, x: 338, y: GROUND - 4 * SC_KID, flip: 1, sc: SC_KID, neck: lerp(1.3, 0.25, look), roll: lerp(0.15, -0.05, look), spine: lerp(0.1, 0.0, look) - sigh * 0.04, shrug: sigh * 0.6 }), t, 3, 0.9);
    const J = joints(ch, p);
    // hands rest across the front of the knees
    reach(ch, p, 'N', J.knN[0] + 3.5, J.knN[1] + 3, 'fwd');
    reach(ch, p, 'F', J.knF[0] + 3, J.knF[1] + 2.5, 'fwd');
    p.farArmFront = false;
    groundShadow(g, 372, GROUND + 4, 130, 0.3);
    drawPerson(g, ch, p, { t, light: [0.7, -0.7] });
  }

  function fallingLeaves(g, t) {
    for (const L of leaves) {
      const k = (t + L.off) / L.per;
      const u = k - Math.floor(k);
      const x = L.x0 + u * L.drift + Math.sin(u * 7 + L.ph) * 26;
      const y = L.y0 + u * (GROUND + 60 - L.y0);
      const a = Math.min(1, u * 6) * Math.min(1, (1 - u) * 6);
      g.save();
      g.globalAlpha = a;
      g.translate(x, y);
      g.rotate(Math.sin(u * 9 + L.ph) * 1.3);
      g.scale(L.s, L.s * (0.35 + Math.abs(Math.cos(u * 8 + L.ph))));
      g.fillStyle = L.c;
      g.beginPath();
      g.ellipse(0, 0, 12, 5.5, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(46,34,25,0.6)';
      g.lineWidth = 1.4;
      g.stroke();
      g.restore();
    }
  }

  function path(g) {
    // a worn dirt path from the foreground up to the horizon
    g.fillStyle = 'rgba(196,170,140,0.75)';
    g.beginPath();
    g.moveTo(470, 1980);
    g.bezierCurveTo(560, 1500, 520, 1240, 640, 1080);
    g.bezierCurveTo(690, 1030, 720, 1010, 760, 1000);
    g.lineTo(782, 1000);
    g.bezierCurveTo(760, 1020, 740, 1060, 735, 1090);
    g.bezierCurveTo(760, 1250, 840, 1500, 900, 1980);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(120,96,74,0.35)';
    g.lineWidth = 2;
    g.stroke();
  }

  function draw(g, t) {
    const c = cam(t);
    g.setTransform(S, 0, 0, S, 0, 0);
    sky(g, 0, 0, 1080, 1920, [[0, '#7c76aa'], [0.32, '#ad97c0'], [0.47, '#dfaeb4'], [0.55, '#f0c6a8']], [760, 900, 560, '#ffd7aa', 0.45]);
    // a few early stars and a thin moon
    const par = (f) => setCam(g, S, 540 + (c.x - 540) * f, 960 + (c.y - 960) * f, 1 + (c.z - 1) * f);
    par(0.15);
    for (const s of stars) {
      g.fillStyle = rgba('#fff6e6', 0.45 + 0.35 * Math.sin(t * 1.4 + s.ph));
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#fbf0da';
    g.beginPath();
    g.arc(840, 300, 34, 0, TAU);
    g.fill();
    g.fillStyle = '#9d8fbc';
    g.beginPath();
    g.arc(856, 290, 32, 0, TAU);
    g.fill();
    // hills on the horizon (same vertical camera as the ground, slower sideways)
    setCam(g, S, 540 + (c.x - 540) * 0.5, c.y, c.z);
    drawLayer(g, hills[0], 540, 905);
    setCam(g, S, 540 + (c.x - 540) * 0.75, c.y, c.z);
    drawLayer(g, hills[1], 540, 945);
    setCam(g, S, c.x, c.y, c.z);
    drawLayer(g, meadow, 0, 0);
    path(g);
    // the friends (behind the tree's foreground), far ones first
    friendRing(g, t);
    const st = FRIENDS.map((F) => ({ F, ...friendState(F, t) })).sort((a, b) => a.yFeet - b.yFeet);
    for (const s of st) {
      groundShadow(g, s.x, s.yFeet + 2, 46 * (s.sc / SC_F), 0.22);
      drawPerson(g, people[s.F.c], s.p, { t, light: [0.7, -0.7] });
    }
    drawTree(g, tree, 250, GROUND + 6, t, { scale: 1, seed: 4 });
    kid(g, t);
    fallingLeaves(g, t);
    grassTufts(g, t, { x0: -200, x1: 1300, y: 1975, n: 230, len: [26, 60], seed: 83, color: '#4f5c40', tip: '#b6b48e' });
    grassTufts(g, t, { x0: -200, x1: 1300, y: 1380, n: 110, len: [14, 28], seed: 84, color: '#56624a', tip: '#c2bd98' });
    g.setTransform(1, 0, 0, 1, 0, 0);
    vignette(g, g.canvas.width, g.canvas.height, 0.36, '#2a1838');
  }
  return { draw };
}
