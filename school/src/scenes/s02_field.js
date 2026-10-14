// 0:05.5-0:27.5 (scenes 2-4), one continuous place: the school on its green field.
//  2  The camera pulls back out of the boy's classroom window to the whole school. "One second it's
//     there..." then POP: a blue dot, a thin ring ripples out, and wherever the ring passes the
//     building crumbles into fine dust (its own brick, cream and roof colours) that a gust carries
//     away and that fades in the air: nothing lands. The kids hang in the air for a beat, then drop
//     and land softly on the grass.
//  3  Confusion: kids look at each other, heads turning, shrugs; two stand up. The teachers stand
//     frozen with their chalk and books, looking around.
//  4  Celebration: real jumps (crouch, push-off, flight, landing), dancing, spinning, a running
//     high five, one girl tossing the homework sheets she has been holding since class, clapping and
//     stomping. The teachers stand still, arms crossed / hands on their heads, not smiling.
import { Layer, drawLayer } from '../kit/paint.js';
import { setCam } from '../kit/cam.js';
import { makeRng, clamp, lerp, smooth, smoothstep, easeInOut, easeOut, easeIn, keys, TAU, rgba, mix } from '../kit/util.js';
import { makePerson, drawPerson, pose, groundShadow, blendPose } from '../kit/person.js';
import { sky, hillLayer, meadowLayer, grassTufts, treeLayers, drawTree, cloudLayer, vignette } from '../kit/scenery.js';
import { buildSchool, drawClockHands, makeVanish, drawIntact, drawReleased, SCHOOL } from '../kit/building.js';
import { blueDot, ripple, arcFlicks, ring } from '../kit/rings.js';
import { STAND, SIT_CHAIR, SIT_GROUND, HEAD_ON_HAND, ARMS_UP, SHRUG, ARMS_CROSSED, HANDS_ON_HEAD, HOLD_CHALK, HOLD_BOOKS, LEG, keyPose, idle, jumpMotion, crouchDrop, walkCycle, strideLen, danceCycle } from '../kit/motion.js';
import { CAST } from './cast.js';

export const FALL_G = 1150; // design px/s^2 (1 px ~ 1 cm for these kids): a soft but real fall
export const POP = 7.62; // the blue dot pops and the ring goes out (just after "...it's there...")
const DROP = 8.45; // the kids start to fall after hanging for a beat
const SC = 1.3; // kid scale in the world
const TSC = 1.2; // teacher scale
const GROUND = 1240;

// Window seats (hip positions) and where each person lands.
const KIDS = [
  { c: 0, seat: [306, 1213], land: [292, 1312], flip: 1, gf: true },
  { c: 1, seat: [423, 1213], land: [402, 1304], flip: -1, gf: true },
  { c: 2, seat: [423, 948], land: [452, 1262], flip: 1 },
  { c: 3, seat: [306, 948], land: [338, 1274], flip: 1 },
  { c: 4, seat: [540, 948], land: [548, 1268], flip: -1 },
  { c: 5, seat: [657, 948], land: [642, 1300], flip: -1 },
  { c: 6, seat: [774, 948], land: [738, 1290], flip: -1 },
];
const TEACH = [
  { c: 7, x: 790, feet: 1250, flip: -1, prop: 'chalk' },
  { c: 8, x: 676, feet: 1244, flip: -1, prop: 'books' },
];

// Camera keyframes: [t, cx, cy, z]
const CAM = [
  [5.2, 306, 1150, 2.6],
  [6.05, 540, 985, 1.0],
  [8.95, 540, 990, 1.03],
  [11.2, 546, 1175, 1.62],
  [14.5, 540, 1208, 1.95],
  [18.4, 540, 1212, 1.95],
  [20.6, 530, 1210, 1.9],
  [21.7, 712, 1185, 2.25],
  [24.2, 725, 1185, 2.3],
  [25.4, 545, 1210, 1.9],
  [27.6, 560, 1220, 2.0],
];
export function cam(t) {
  let i = 1;
  while (i < CAM.length - 1 && t > CAM[i][0]) i++;
  const [t0, x0, y0, z0] = CAM[i - 1];
  const [t1, x1, y1, z1] = CAM[i];
  const u = easeInOut(clamp((t - t0) / (t1 - t0)));
  // zoom interpolates in log space so the pull-back feels even
  return { x: lerp(x0, x1, u), y: lerp(y0, y1, u), z: Math.exp(lerp(Math.log(z0), Math.log(z1), u)) };
}

export async function build(env) {
  const { S } = env;
  const people = CAST.map(makePerson);
  const school = buildSchool(S * 2.6);
  const V = makeVanish({ cx: 540, cy: 900, t0: POP, rMax: 1500, dur: 1.9 });
  const hills = [
    hillLayer(S * 0.8, { w: 1800, y0: 120, amp: 55, freq: 1.1, color: '#a3b2c4', haze: '#dfdcd0', seed: 3, trees: 30, treeColor: '#97a8bb', h: 260 }),
    hillLayer(S * 0.9, { w: 1800, y0: 120, amp: 42, freq: 1.6, color: '#8aa385', haze: '#c9d3ae', seed: 7, trees: 60, treeColor: '#7a9676', h: 240 }),
  ];
  const meadow = meadowLayer(S * 2.3, { x0: -40, y0: 1150, w: 1160, h: 800, base: '#9fbd6e', far: '#c3d39a', dark: '#5a7a38', light: '#dfe7b0', seed: 41 });
  const treeL = treeLayers(S * 1.8, { h: 520, w: 380, seed: 61 });
  const treeR = treeLayers(S * 1.8, { h: 460, w: 340, seed: 67, leaf: '#76a052' });
  const clouds = [cloudLayer(S, 260, 3), cloudLayer(S, 200, 8), cloudLayer(S, 320, 12)];
  const rng = makeRng(77);

  // the one paper moment: K5 has held her homework sheets since class; at TOSS she throws them up
  // once. Six sheets rise, slow down, and drift down like leaves, then lie on the grass.
  const TOSS = 19.05;
  const THROWS = [TOSS];
  const tossRng = makeRng(301);
  const sheets = Array.from({ length: 6 }, (_, i) => ({
    vx: tossRng.range(-90, 90) + (i - 2.5) * 22,
    vy: tossRng.range(-430, -330),
    fl: tossRng.range(2.2, 3.4),
    ph: tossRng.range(0, TAU),
    sway: tossRng.range(18, 34),
    fall: tossRng.range(70, 95),
    spin: tossRng.range(-1.2, 1.2),
    rest: tossRng.range(-0.4, 0.4),
    land: tossRng.range(-28, 30),
    w: 17,
    h: 22,
  }));

  // ---- choreography ----
  function kidPose(k, t) {
    const K = KIDS[k];
    const ch = people[K.c];
    const Pp = ch.P;
    const seed = k * 1.7;
    const base = { flip: K.flip, sc: SC, fv: 0.45, turn: 0.3 };
    const sitY = (gy) => gy - 6 * SC;
    // in the classroom window, sitting at a desk (the boy is the bored one)
    if (t < POP + 0.05) {
      let p = { ...base, ...SIT_CHAIR, x: K.seat[0], y: K.seat[1] };
      if (k === 0) p = { ...p, ...HEAD_ON_HAND };
      else p = { ...p, turn: 0.35 + Math.sin(t * 0.8 + seed) * 0.15, aN: 0.85, eN: 1.1, aF: 0.7, eF: 1.0 };
      return idle(pose(p), t, seed);
    }
    const hangEnd = DROP + (k % 3) * 0.07;
    const startY = K.seat[1];
    const landY = sitY(K.land[1]);
    const g = FALL_G;
    const fallDur = Math.sqrt((2 * Math.max(1, landY - startY)) / g);
    const tLand = hangEnd + fallDur;
    if (t < hangEnd) {
      // hanging in the air, surprised: limbs drift up, look down, gentle bob
      const u = smoothstep(POP, POP + 0.5, t);
      const p = blendPose(pose({ ...base, ...SIT_CHAIR, x: K.seat[0], y: K.seat[1] }), pose({ ...base, ...SIT_CHAIR, x: K.seat[0], y: K.seat[1] - 6, aN: 1.6, eN: 0.6, aF: -1.3, eF: -0.4, kN: -0.3, kF: -0.5, hN: 1.1, hF: 0.9, neck: 0.55, turn: 0.1, shrug: 0.7, roll: -0.1 }), u);
      p.y += Math.sin((t - POP) * 9) * 1.5 * u;
      return p;
    }
    if (t < tLand) {
      const a = t - hangEnd;
      const u = a / fallDur;
      const y = startY + 0.5 * g * a * a;
      const x = lerp(K.seat[0], K.land[0], smooth(u));
      return pose({ ...base, x, y, aN: 2.4, eN: 0.4, aF: -2.3, eF: -0.4, hN: 1.2, kN: -0.6, hF: 0.9, kF: -0.8, neck: 0.2, turn: 0.15, shrug: 0.4, fv: 0.6, skirtFlutter: 1 });
    }
    // landed: squash and settle into sitting on the grass
    const al = t - tLand;
    const sq = Math.exp(-al * 7) * Math.cos(al * 18);
    const landed = { ...base, ...SIT_GROUND, x: K.land[0], y: landY, sqy: 1 - 0.14 * sq, sqx: 1 + 0.09 * sq, fv: 0.5 };
    const settle = smoothstep(0, 0.35, al);
    let p = blendPose(pose({ ...base, x: K.land[0], y: landY, aN: 2.0, eN: 0.5, aF: -1.9, eF: -0.5, hN: 1.4, kN: -0.4, hF: 1.3, kF: -0.5, fv: 0.6 }), pose(landed), settle);
    if (t < 11.4) return idle(p, t, seed, 0.6);
    return later(k, t, p, base, landY);
  }

  // scenes 3 and 4 for each kid
  function later(k, t, sit, base, landY) {
    const K = KIDS[k];
    const ch = people[K.c];
    const Pp = ch.P;
    const seed = k * 1.7;
    const standY = K.land[1] - LEG(Pp) * SC;
    const look = (arr) => keys(arr, t);
    // confused head turns (looking at neighbours), shrugs
    const confusedTurn = [
      look([[11.4, 0.3], [12.2, -0.7], [13.4, 0.8], [14.6, -0.3], [16, 0.6], [17.4, -0.6]]),
      look([[11.4, -0.4], [12.6, 0.7], [13.8, -0.8], [15.2, 0.5], [16.6, -0.5]]),
      look([[11.4, 0.6], [12.4, -0.5], [13.2, 0.7], [14.8, -0.7], [16.2, 0.4]]),
      look([[11.4, -0.2], [12.8, 0.8], [14.2, -0.6], [15.6, 0.7], [17, -0.4]]),
      look([[11.4, 0.5], [12.1, -0.8], [13.6, 0.5], [15, -0.6], [16.4, 0.8]]),
      look([[11.4, -0.6], [12.9, 0.6], [14.4, -0.7], [15.8, 0.3], [17.2, -0.6]]),
      look([[11.4, 0.4], [12.5, -0.6], [14, 0.6], [15.4, -0.8], [16.8, 0.5]]),
    ][k];
    const tilt = Math.sin(t * 0.9 + seed) * 0.12;
    // who stands up in scene 3 and when
    const standAt = { 2: 13.0, 4: 13.5, 6: 14.4, 3: 15.4 }[k];
    let p;
    if (t < 18.3) {
      const shrug = k === 2 || k === 4 || k === 6 || k === 3 ? smoothstep(standAt + 1.2, standAt + 1.6, t) * (1 - smoothstep(standAt + 2.8, standAt + 3.3, t)) : 0;
      const sitConf = pose({ ...sit, turn: confusedTurn, roll: tilt, neck: 0.1 });
      if (standAt && t > standAt) {
        const u = clamp((t - standAt) / 0.9);
        const mid = pose({ ...base, x: K.land[0], y: landY - 12 * SC, spine: 0.55, hunch: 0.3, hN: 1.9, kN: -2.4, hF: 1.7, kF: -2.2, aN: 0.6, eN: 0.6, aF: 0.4, eF: 0.5, turn: confusedTurn });
        const st = pose({ ...base, ...STAND, x: K.land[0], y: standY, turn: confusedTurn, roll: tilt });
        p = u < 0.5 ? blendPose(sitConf, mid, smooth(u * 2)) : blendPose(mid, st, smooth(u * 2 - 1));
        if (shrug > 0) p = blendPose(p, pose({ ...p, ...SHRUG, fv: 0.75 }), shrug);
      } else {
        p = sitConf;
        // seated shrug for the others, once
        const s2 = smoothstep(14.2 + k * 0.3, 14.6 + k * 0.3, t) * (1 - smoothstep(15.6 + k * 0.3, 16.1 + k * 0.3, t));
        if (s2 > 0) p = blendPose(p, pose({ ...p, shrug: 1, aN: 0.6, eN: 1.2, aF: -0.2, eF: 0.8 }), s2 * (k === 0 || k === 1 ? 1 : 0.6));
      }
      return idle(p, t, seed, 0.7);
    }
    // ---- scene 4: celebration ----
    const wasStanding = standAt !== undefined;
    const upAt = wasStanding ? 18.3 : 18.35 + k * 0.05;
    const rise = clamp((t - upAt) / 0.6);
    const from = wasStanding ? pose({ ...base, ...STAND, x: K.land[0], y: standY }) : pose({ ...sit, turn: 0.2 });
    const tt = t - 18.9;
    let act;
    let dx = 0;
    let dy = 0;
    if (k === 0) {
      // jumping for joy: real jumps with a wind-up, varied heights and short pauses
      const j = jumpMotion(tt + 0.05, { height: 20, seed: 3, gap: [0.1, 0.5] });
      dy = -j.dy * SC + crouchDrop(Pp, j.crouch) * SC;
      act = { ...base, ...j.pose, turn: 0.15, fv: 0.8 };
    } else if (k === 1) {
      const d = danceCycle(tt / 1.0, 0);
      dx = d.dx;
      dy = -d.dy;
      act = { ...base, ...d.pose, turn: 0.1, fv: 0.85, skirtFlutter: 0.8 };
    } else if (k === 2 || k === 4) {
      // run together, a real jump (crouch, push-off, flight) and a high five at the top of it
      // (about 19.77 s), land, then fist-pump jumps / dance
      const meetX = 500;
      const side = k === 2 ? -1 : 1;
      const startX = K.land[0];
      const targetX = meetX + side * 35;
      const run = clamp((t - 18.9) / 0.42);
      const xPos = lerp(startX, targetX, smooth(run));
      const w = walkCycle((t - 18.9) / 0.36, { amp: 0.55, arm: 0.6 });
      const facing = side === -1 ? 1 : -1;
      if (t < 19.3) {
        act = { ...base, ...w.pose, flip: facing, turn: 0.6, fv: 0.35 };
        dx = xPos - K.land[0];
        dy = -w.bob * SC;
      } else if (t < 20.4) {
        dx = targetX - K.land[0];
        const j = jumpMotion(t - 19.3, { height: 16, seed: 10 + k, n: 1, armsUp: 0.85 });
        dy = -j.dy * SC + crouchDrop(Pp, j.crouch) * SC;
        // the high-five hand goes up and forward to meet the partner's; the other arm stays lower
        act = { ...base, ...j.pose, flip: facing, turn: 0.7, fv: 0.4, aN: lerp(j.pose.aN, 2.35, j.air), eN: lerp(j.pose.eN, 0.1, j.air), aF: lerp(j.pose.aF, -0.5, 0.75), eF: 0.35 };
      } else {
        dx = targetX - K.land[0];
        if (k === 2) {
          // fist-pump jumps: one arm punches up, the other stays bent
          const j = jumpMotion(t - 20.4, { height: 14, seed: 7, gap: [0.2, 0.7] });
          dy = -j.dy * SC + crouchDrop(Pp, j.crouch) * SC;
          act = { ...base, ...j.pose, aF: -0.5, eF: -1.8, turn: 0.2, fv: 0.7 };
        } else {
          const d = danceCycle((t - 20.4) / 0.95, 1);
          dy = -d.dy;
          act = { ...base, ...d.pose, turn: -0.2 };
        }
      }
    } else if (k === 3) {
      // spinning with arms out; the facing turns through a full circle
      const sp = (t - 18.9) / 1.15;
      const ang = sp * TAU;
      const c = Math.cos(ang);
      act = { ...base, flip: Math.sin(ang) >= 0 ? 1 : -1, fv: Math.abs(c), turn: c * 0.3, aN: 1.55, eN: 0.15, aF: -1.55, eF: -0.15, hN: 0.08, kN: -0.1, hF: -0.08, kF: -0.25, skirtFlutter: 1.6, roll: 0.08 };
      dy = -Math.abs(Math.sin(ang * 2)) * 3;
    } else if (k === 5) {
      // tosses her homework sheets into the air, once
      const tk = THROWS.map((x) => t - x + 0.45).filter((x) => x >= 0 && x < 1.4)[0];
      if (tk !== undefined) {
        // crouch with the papers (0-0.4), swing up and release (0.45), arms up, recover
        const crouch = tk < 0.4 ? Math.sin((tk / 0.4) * Math.PI * 0.5) : Math.max(0, 1 - (tk - 0.4) / 0.25);
        const up = smoothstep(0.35, 0.55, tk) * (1 - smoothstep(1.0, 1.4, tk));
        act = { ...base, turn: 0.2, fv: 0.8, spine: 0.35 * crouch, hunch: 0.3 * crouch, hN: 0.7 * crouch, kN: -1.2 * crouch, hF: 0.6 * crouch, kF: -1.1 * crouch, aN: lerp(0.6, 2.8, up), eN: lerp(1.0, 0.1, up), aF: lerp(-0.4, -2.7, up), eF: lerp(-0.9, -0.1, up), skirtFlutter: 0.6 };
        dy = crouchDrop(Pp, crouch) * SC - up * 6 * SC;
      } else {
        const d = danceCycle((t - 18.9) / 1.1, 0);
        dx = d.dx * 0.6;
        dy = -d.dy;
        act = { ...base, ...d.pose, turn: -0.3, fv: 0.8, skirtFlutter: 0.6 };
      }
    } else {
      // clapping and stomping
      const d = danceCycle((t - 18.9) / 1.0, 1);
      dy = -d.dy;
      act = { ...base, ...d.pose, turn: -0.15 };
    }
    p = pose({ ...act, x: K.land[0] + dx, y: standY + dy });
    if (rise < 1) p = blendPose(from, p, smooth(rise));
    return p;
  }

  function teacherPose(i, t) {
    const T = TEACH[i];
    const ch = people[T.c];
    const y = T.feet - LEG(ch.P) * TSC;
    const base = { x: T.x, y, flip: T.flip, sc: TSC, fv: 0.55, ...STAND };
    const prop = T.prop === 'chalk' ? HOLD_CHALK : HOLD_BOOKS;
    if (t < POP) {
      // teaching: chalk hand moves (writing), the other holds the book
      const w = Math.sin(t * 5) * 0.12;
      return idle(pose({ ...base, ...prop, eN: (prop.eN ?? 0) + w * (T.prop === 'chalk' ? 1 : 0), turn: 0.6 }), t, i * 3);
    }
    // flinch at the pop, then freeze, looking around (head turns slowly, body still)
    const flinch = smoothstep(POP, POP + 0.15, t) * (1 - smoothstep(POP + 0.5, POP + 1.1, t));
    const look = keys(i === 0 ? [[8, 0.6], [10, -0.7], [12, 0.8], [14, -0.6], [16, 0.7], [18, -0.2]] : [[8, -0.4], [10.5, 0.8], [12.5, -0.7], [14.5, 0.6], [16.5, -0.7], [18, 0.1]], t);
    let p = pose({ ...base, ...prop, shrug: 0.25 + flinch * 0.6, turn: look, roll: Math.sin(t * 0.5 + i) * 0.05 });
    if (t >= 18.4) {
      // not smiling: arms crossed (woman) / hands on head (man), slumped, slow head shake
      const u = smoothstep(18.4, 19.2, t);
      const target = i === 0 ? { ...ARMS_CROSSED, shrug: 0.15, hunch: 0.35, neck: 0.25, turn: 0.35 + Math.sin(t * 2.2) * 0.25 * smoothstep(20.5, 21.2, t), roll: -0.08 } : { ...HANDS_ON_HEAD, hunch: 0.25, neck: 0.15, turn: 0.4 + Math.sin(t * 1.3) * 0.1, roll: 0.06 };
      p = blendPose(p, pose({ ...base, ...target }), u);
    }
    return idle(p, t, i * 3, 0.8);
  }

  // props held in hands
  const chalkProp = (g, x, y, a) => {
    g.save();
    g.translate(x, y);
    g.rotate(-a + 0.6);
    g.fillStyle = '#f7f4ec';
    g.strokeStyle = 'rgba(46,34,25,0.9)';
    g.lineWidth = 1;
    g.fillRect(-1.6, -9, 3.2, 10);
    g.strokeRect(-1.6, -9, 3.2, 10);
    g.restore();
  };
  const bookProp = (g, x, y, a) => {
    g.save();
    g.translate(x, y);
    g.rotate(-0.15);
    g.fillStyle = '#a8452f';
    g.strokeStyle = '#2e2219';
    g.lineWidth = 1.2;
    g.fillRect(-11, -14, 22, 26);
    g.strokeRect(-11, -14, 22, 26);
    g.fillStyle = '#3f6e8a';
    g.fillRect(-10, 10, 21, 7);
    g.strokeRect(-10, 10, 21, 7);
    g.fillStyle = '#efe6d0';
    g.fillRect(9, -12, 2.5, 22);
    g.restore();
  };

  function drawPeople(g, t, inside) {
    const list = [];
    KIDS.forEach((K, k) => list.push({ ch: people[K.c], p: kidPose(k, t), kid: true, k }));
    TEACH.forEach((T, i) => list.push({ ch: people[T.c], p: teacherPose(i, t), kid: false, i }));
    // depth: by ground contact
    list.forEach((o) => (o.depth = o.kid ? (t < POP ? 0 : KIDS[o.k].land[1]) : TEACH[o.i].feet));
    list.sort((a, b) => a.depth - b.depth);
    for (const o of list) {
      const inBuilding = t < POP;
      if (inBuilding !== inside) continue;
      const p = o.p;
      if (o.kid && o.k === 5 && t >= POP && t < TOSS) p.handN = (gg, x, y, a, st) => st === 'fill' && paperStack(gg, x, y, a);
      if (!o.kid) {
        p.handN = TEACH[o.i].prop === 'chalk' && t < 18.6 ? (gg, x, y, a, st) => st === 'fill' && chalkProp(gg, x, y, a) : null;
        p.handF = TEACH[o.i].prop === 'books' && t < 18.7 ? (gg, x, y, a, st) => st === 'fill' && bookProp(gg, x, y, a) : null;
      }
      if (!inBuilding) {
        // shadow on the grass, smaller when airborne
        const gy = o.depth;
        const air = Math.max(0, gy - (p.y + (o.kid ? 6 * SC : LEG(o.ch.P) * TSC)));
        const groundY = o.kid ? gy : TEACH[o.i].feet;
        groundShadow(g, p.x, groundY + 2, (o.kid ? 30 : 34) * (o.kid ? SC : TSC) * (1 - clamp(air / 400) * 0.6), 0.26 * (1 - clamp(air / 500) * 0.7));
      }
      drawPerson(g, o.ch, p, { t, light: [-0.6, -0.8] });
    }
  }

  // little puffs of grass where the kids land
  function landingPuffs(g, t) {
    KIDS.forEach((K, k) => {
      const hangEnd = DROP + (k % 3) * 0.07;
      const landY = K.land[1] - 6 * SC;
      const fallDur = Math.sqrt((2 * Math.max(1, landY - K.seat[1])) / 2600);
      const a = t - (hangEnd + fallDur);
      if (a < 0 || a > 0.9) return;
      const r = makeRng(400 + k);
      for (let i = 0; i < 14; i++) {
        const ang = Math.PI + r.range(0.1, Math.PI - 0.1);
        const sp = r.range(30, 90);
        const x = K.land[0] + Math.cos(ang) * sp * a * 1.4;
        const y = K.land[1] + Math.sin(ang) * sp * a * 0.9 + 60 * a * a;
        g.strokeStyle = rgba(r.chance(0.5) ? '#6f8f45' : '#b8cc86', 1 - a / 0.9);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(ang + 1) * 5, y + Math.sin(ang + 1) * 5);
        g.stroke();
      }
      g.fillStyle = `rgba(240,236,220,${0.35 * (1 - a / 0.9)})`;
      g.beginPath();
      g.ellipse(K.land[0], K.land[1], 30 + a * 40, 8 + a * 6, 0, 0, TAU);
      g.fill();
    });
  }

  // the homework sheets after the toss: linear-drag physics (a quick rise that slows, then a
  // leaf-like fall at a gentle terminal speed with side-to-side sway), then they lie flat on the
  // grass and stay there
  const SHEET_K = 3.2;
  function sheetAt(q, a) {
    const K = KIDS[5];
    const x0 = K.land[0] + 6;
    const y0 = K.land[1] - LEG(people[K.c].P) * SC - 62;
    const vt = q.fall;
    const y = y0 + vt * a + ((q.vy - vt) * (1 - Math.exp(-SHEET_K * a))) / SHEET_K;
    const x = x0 + (q.vx * (1 - Math.exp(-2 * a))) / 2 + Math.sin(a * q.fl + q.ph) * q.sway * clamp(a / 0.6);
    return [x, y];
  }
  sheets.forEach((q) => {
    // when does it reach the grass?
    const ground = KIDS[5].land[1] + q.land;
    let lo = 0.2;
    let hi = 8;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (sheetAt(q, mid)[1] < ground) lo = mid;
      else hi = mid;
    }
    q.tl = hi;
    q.ground = ground;
    q.lx = sheetAt(q, hi)[0];
  });
  function sheet(g, x, y, rot, sy, w, h) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(1, sy);
    g.fillStyle = '#f8f4ea';
    g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = 'rgba(80,110,170,0.55)';
    g.lineWidth = 1.2;
    for (let i = 1; i < 5; i++) {
      g.beginPath();
      g.moveTo(-w / 2 + 2.5, -h / 2 + (i * h) / 5);
      g.lineTo(w / 2 - 2.5, -h / 2 + (i * h) / 5);
      g.stroke();
    }
    g.strokeStyle = 'rgba(46,34,25,0.75)';
    g.lineWidth = 1.3;
    g.strokeRect(-w / 2, -h / 2, w, h);
    g.restore();
  }
  function drawSheets(g, t, layer) {
    const a = t - TOSS;
    if (a < 0) return;
    for (const q of sheets) {
      const down = a >= q.tl;
      if ((layer === 'ground') !== down) continue;
      if (down) {
        sheet(g, q.lx, q.ground, q.rest, 0.42, q.w, q.h);
      } else {
        const [x, y] = sheetAt(q, a);
        const tumble = Math.cos(a * q.fl * 1.4 + q.ph);
        sheet(g, x, y, q.spin * a * 0.5 + Math.sin(a * q.fl + q.ph) * 0.55, 0.3 + 0.7 * Math.abs(tumble), q.w, q.h);
      }
    }
  }
  // the stack she holds (in her near hand) from the vanish until she tosses it
  const paperStack = (g, x, y, a) => {
    g.save();
    g.translate(x, y);
    g.rotate(-a + 0.25);
    for (let i = 2; i >= 0; i--) {
      g.save();
      g.translate(i * 1.2, -i * 1.0);
      g.rotate(i * 0.06);
      g.fillStyle = '#f8f4ea';
      g.fillRect(-6, -9, 12, 15);
      g.strokeStyle = 'rgba(80,110,170,0.5)';
      g.lineWidth = 0.7;
      for (let k = 1; k < 4; k++) {
        g.beginPath();
        g.moveTo(-5, -9 + k * 3.8);
        g.lineTo(5, -9 + k * 3.8);
        g.stroke();
      }
      g.strokeStyle = 'rgba(46,34,25,0.75)';
      g.lineWidth = 0.9;
      g.strokeRect(-6, -9, 12, 15);
      g.restore();
    }
    g.restore();
  };

  // a worn dirt path from the school door down to the bottom of the frame
  const pathRng = makeRng(88);
  const pathStones = Array.from({ length: 70 }, () => [pathRng.next(), pathRng.next(), pathRng.range(1.5, 4)]);
  function path(g) {
    g.save();
    const p = new Path2D();
    p.moveTo(500, GROUND);
    p.bezierCurveTo(490, 1450, 420, 1700, 330, 1960);
    p.lineTo(690, 1960);
    p.bezierCurveTo(640, 1700, 590, 1450, 580, GROUND);
    p.closePath();
    const grd = g.createLinearGradient(0, GROUND, 0, 1960);
    grd.addColorStop(0, 'rgba(214,190,140,0.75)');
    grd.addColorStop(1, 'rgba(196,166,116,0.9)');
    g.fillStyle = grd;
    g.fill(p);
    g.clip(p);
    for (const [u, v, r] of pathStones) {
      const y = GROUND + v * 720;
      const half = lerp(40, 180, v);
      const x = 540 - half + u * 2 * half - v * 80;
      g.fillStyle = 'rgba(120,95,65,0.35)';
      g.beginPath();
      g.ellipse(x, y, r * (1 + v), r * 0.6 * (1 + v), 0, 0, TAU);
      g.fill();
    }
    g.restore();
    g.strokeStyle = 'rgba(90,110,50,0.45)';
    g.lineWidth = 2;
    g.stroke(p);
  }

  // the imprint where the school stood: slightly paler, flattened grass
  function imprint(g, t) {
    const a = smoothstep(POP + 0.4, POP + 2.0, t) * 0.5;
    if (a <= 0) return;
    g.save();
    g.globalAlpha = a;
    const grd = g.createLinearGradient(0, GROUND - 6, 0, GROUND + 30);
    grd.addColorStop(0, 'rgba(214,214,170,0.0)');
    grd.addColorStop(0.3, 'rgba(214,214,170,0.55)');
    grd.addColorStop(1, 'rgba(214,214,170,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(540, GROUND + 8, 400, 26, 0, 0, TAU);
    g.fill();
    g.restore();
  }

  const scene = {
    cam,
    // where the boy's window is on screen at time t (for the pull-back from the classroom)
    windowRect(t) {
      const c = cam(t);
      const [x, y, w, h] = SCHOOL.gfWin[0];
      const k = c.z;
      return [540 + (x - c.x) * k, 960 + (y - c.y) * k, w * k, h * k];
    },
    draw(g, t) {
      const c = cam(t);
      // sky (screen space) with a warm morning glow
      g.setTransform(S, 0, 0, S, 0, 0);
      sky(g, 0, 0, 1080, 1920, [[0, '#9fc7de'], [0.38, '#cfe0e0'], [0.58, '#f1e6cf'], [1, '#f3e3c4']], [820, 640, 700, '#fff1c8', 0.55]);
      // clouds (slow drift, slight parallax)
      const par = (f) => setCam(g, S, 540 + (c.x - 540) * f, 960 + (c.y - 960) * f, 1 + (c.z - 1) * f);
      par(0.25);
      drawLayer(g, clouds[0], 180 + t * 4, 330, 0, 1, 1, 0.95);
      drawLayer(g, clouds[1], 860 + t * 3, 260, 0, 1, 1, 0.9);
      drawLayer(g, clouds[2], 560 - t * 2.5, 470, 0, 0.8, 0.8, 0.85);
      // hills
      // hills sit on the horizon (same vertical camera as the ground, slower sideways)
      setCam(g, S, 540 + (c.x - 540) * 0.5, c.y, c.z);
      drawLayer(g, hills[0], 540, 990);
      setCam(g, S, 540 + (c.x - 540) * 0.75, c.y, c.z);
      drawLayer(g, hills[1], 540, 1035);
      // ground and scene
      setCam(g, S, c.x, c.y, c.z);
      drawLayer(g, meadow, 0, 0);
      path(g);
      imprint(g, t);
      drawTree(g, treeL, 70, 1250, t, { scale: 1, seed: 1 });
      drawTree(g, treeR, 1030, 1236, t, { scale: 1, seed: 2 });
      drawSheets(g, t, 'ground');
      // the school
      if (t < POP) {
        drawLayer(g, school.back, 0, 0);
        drawPeople(g, t, true);
        drawLayer(g, school.front, 0, 0);
        drawLayer(g, school.glass, 0, 0);
        drawClockHands(g, t);
      } else {
        drawIntact(g, school.back, V, t);
        drawPeople(g, t, true);
        drawIntact(g, school.front, V, t);
        drawIntact(g, school.glass, V, t);
      }
      landingPuffs(g, t);
      if (t >= POP) drawReleased(g, [school.back, school.front, school.glass], V, t);
      if (t >= POP) drawPeople(g, t, false);
      drawSheets(g, t, 'air');
      // the motif: blue dot pops in at the school's heart, rings ripple out, flicks
      const dotA = smoothstep(POP - 0.35, POP - 0.15, t) * (1 - smoothstep(POP + 1.0, POP + 1.6, t));
      if (dotA > 0) {
        const s = 1 + Math.max(0, Math.sin(clamp((t - POP + 0.35) / 0.3) * Math.PI)) * 0.35;
        blueDot(g, 540, 900, 13 * s, dotA);
      }
      ripple(g, 540, 900, t, POP, { rMax: 1500, dur: 1.9, width: 6, count: 2, gap: 0.2 });
      arcFlicks(g, 540, 900, t, POP + 0.05, { ang: -0.6, r0: 40, spread: 120, width: 6 });
      arcFlicks(g, 540, 900, t, POP + 0.12, { ang: 2.6, r0: 50, spread: 110, width: 6 });
      // foreground grass
      setCam(g, S, c.x, c.y, c.z);
      grassTufts(g, t, { x0: -60, x1: 1140, y: 1935, n: 220, len: [26, 60], seed: 23 });
      grassTufts(g, t, { x0: -60, x1: 1140, y: 1760, n: 120, len: [14, 30], seed: 24 });
      g.setTransform(1, 0, 0, 1, 0, 0);
      vignette(g, g.canvas.width, g.canvas.height, 0.28);
    },
    // hand-off into the montage (film motif): the blue dot pops at the centre and a ring opens,
    // revealing the cream montage page inside it
    handoff(g, t, u, A, B, Ss) {
      g.drawImage(A, 0, 0);
      const W = g.canvas.width;
      const Hh = g.canvas.height;
      const cx = W / 2;
      const cy = Hh * 0.47;
      const e = easeInOut(clamp((u - 0.12) / 0.88));
      const R = e * Math.hypot(W, Hh) * 0.62;
      if (R > 0) {
        g.save();
        g.beginPath();
        g.arc(cx, cy, R, 0, TAU);
        g.clip();
        g.drawImage(B, 0, 0);
        g.restore();
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        ring(g, cx, cy, R, { width: 6 * Ss, color: '#2f6fc4', alpha: 1 - smoothstep(0.85, 1, u) });
        g.restore();
      }
      const d = smoothstep(0, 0.12, u) * (1 - smoothstep(0.3, 0.45, u));
      if (d > 0) blueDot(g, cx, cy, 13 * Ss * (1 + 0.3 * Math.sin(clamp(u / 0.2) * Math.PI)), d);
    },
  };
  return scene;
}
