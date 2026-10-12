// 0:21-0:33 (4x then 5x): standing on the east sidewalk south of the intersection.
//   4x: a taxi as tall as the traffic lights rolls past and its roof rips through the signal arm;
//       the heads swing and snap off, a second car tears the far signal's heads. People point; we
//       raise our hands.
//   5x: a giant van crushes past, the asphalt cracks under its wheels, its body snaps a lamp post;
//       everyone panics and runs, and we turn and run too.
// All breakage is baked with cannon-es at a fixed step (see PhysicsBake).
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { camPath, applyCam, bob, drift, shake } from '../kit/camrig.js';
import { scriptedCar, distanceFn, autoFold, checkOverlaps, kinShapes, kinPose, z0For } from './traffic.js';
import { walker } from './people.js';
import { PhysicsBake, CANNON } from '../kit/physics.js';
import { Dust, Cracks } from '../kit/fx.js';
import { makeSignal, SIDEWALK_Y } from '../kit/nyc.js';
import { HANDS, runArms } from '../kit/fprig.js';
import { clamp, lerp, smoothstep } from '../util.js';

const CX = 15.4; // where we stand
const CZ = 26;

function blendTarget(a, b, k) {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const mix = (u, v) => u.map((x, i) => lerp(x, v[i], k));
  return { space: 'cam', pos: mix(a.pos, b.pos), palm: mix(a.palm, b.palm), fingers: mix(a.fingers, b.fingers), curl: lerp(a.curl, b.curl, k) };
}
const HIDDEN_R = { space: 'cam', pos: [0.3, -0.85, -0.15], palm: [0, 0, -1], fingers: [0.1, 1, 0.05], curl: 0.2 };
const HIDDEN_L = { space: 'cam', pos: [-0.3, -0.87, -0.15], palm: [0, 0, -1], fingers: [-0.1, 1, 0.05], curl: 0.2 };

export function buildLightsShot(ctx, W) {
  const { scene, camera, fp } = W;
  const rng = makeRng(303);
  const objs = [];
  const own = (o) => {
    objs.push(o);
    return o;
  };

  // ---- vehicles ---------------------------------------------------------------------------------------
  const vA = distanceFn([[0, 5.5], [60, 5.5]]);
  const vB = distanceFn([[0, 5.0], [60, 5.0]]);
  const vC = distanceFn([[0, 5.5], [60, 5.5]]);
  // A: taxi whose cabin reaches the SE signal arm (z = 10.5) at about 23.6 s.
  const carA = scriptedCar(scene, { type: 'taxi', x: 6.2, dir: -1, dist: vA, z0: z0For(14.2, 23.6, -1, vA) });
  // B: southbound sedan whose cabin reaches the NW signal (z = -10.5) at about 24.6 s.
  const carB = scriptedCar(scene, { type: 'sedan', color: 0x2b4a7a, x: -6.2, dir: 1, dist: vB, z0: z0For(-14.1, 24.6, 1, vB) });
  // C: van passing us at about 27.5 s; its body hits the lamp at z = 12.5 at about 28.6 s.
  const carC = scriptedCar(scene, { type: 'van', color: 0xc8402e, x: 5.6, dir: -1, dist: vC, z0: z0For(19.8, 28.6, -1, vC) });
  // E: a giant taxi coming up the avenue toward us while we run.
  const carE = scriptedCar(scene, { type: 'taxi', x: 5.6, dir: -1, dist: vC, z0: z0For(59.8, 29.5, -1, vC) });
  const cars = [carA, carB, carC, carE];
  cars.forEach((c) => own(c.v.group));
  checkOverlaps(cars, 21, 33, 'lights');

  // ---- physics ---------------------------------------------------------------------------------------
  const bake = new PhysicsBake({ t0: 21, t1: 33.2, seed: 9, maxSpeed: 12 });
  bake.addStaticBox([12, -0.5, -300], [80, SIDEWALK_Y, 300]);
  bake.addStaticBox([-80, -0.5, -300], [-12, SIDEWALK_Y, 300]);
  const kins = cars.map((c) => bake.addKinematic(kinPose(c), kinShapes(c.v), { triggerMargin: 0.05 }));

  // Our own copies of the two signals at the z = 0 intersection, as separate rigid pieces.
  const hiddenSignals = W.furn.signals.filter((s) => s.zc === 0);
  const heads = [];
  const signals = [];
  for (const base of hiddenSignals) {
    const sig = makeSignal({ arm: 9.6, height: 5.8, heads: [3.4, 6.8] });
    const gq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), base.side > 0 ? 0 : Math.PI);
    const gp = new THREE.Vector3(base.x, SIDEWALK_Y, base.z);
    const place = (o) => {
      o.position.applyQuaternion(gq).add(gp);
      o.quaternion.premultiply(gq);
      scene.add(o);
      own(o);
      W.reg(o);
      return o;
    };
    place(sig.pole);
    const arm = place(sig.arm);
    const headObjs = sig.heads.map(place);
    const jointWorld = new THREE.Vector3(0, sig.height, 0).applyQuaternion(gq).add(gp);
    const poleTop = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    poleTop.position.set(jointWorld.x, jointWorld.y, jointWorld.z);
    bake.world.addBody(poleTop);
    const armPiece = bake.addPiece(arm, {
      half: [4.8, 0.08, 0.08],
      mass: 140,
      trigger: 'kinematic',
      inherit: 0.15,
      angularDamping: 0.3,
      onActivate: (piece) => {
        bake.world.addConstraint(new CANNON.PointToPointConstraint(piece.body, new CANNON.Vec3(4.8, 0, 0), poleTop, new CANNON.Vec3(0, 0, 0)));
      },
    });
    for (const [i, h] of headObjs.entries()) {
      const piece = bake.addPiece(h, { shapes: [{ half: [0.21, 0.54, 0.17], offset: [0, -0.62, 0] }], mass: 28, active: true, angularDamping: 0.2 });
      piece.body.allowSleep = false;
      const local = new THREE.Vector3(...h.position.toArray()).sub(arm.position).applyQuaternion(arm.quaternion.clone().invert());
      const c = new CANNON.PointToPointConstraint(piece.body, new CANNON.Vec3(0, 0.02, 0), armPiece.body, new CANNON.Vec3(local.x, local.y + 0.02, local.z));
      bake.world.addConstraint(c);
      heads.push({ piece, c, hitAt: null, delay: 0.3 + 0.25 * i + 0.1 * signals.length, attached: true });
    }
    signals.push({ base, armPiece });
  }
  // Heads swing first, then their hangers snap.
  bake.onStep = (t) => {
    for (const h of heads) {
      if (!h.attached) continue;
      if (h.hitAt === null && h.piece.body.velocity.length() > 0.7) h.hitAt = t;
      if (h.hitAt !== null && t > h.hitAt + h.delay) {
        bake.world.removeConstraint(h.c);
        h.attached = false;
        h.snappedAt = t;
      }
    }
  };

  // Lamp posts along both curbs near the action snap at the base when a car body strikes them.
  const lamps = W.furn.lamps.filter((l) => l.position.z > -60 && l.position.z < 70);
  const lampPieces = lamps.map((l) => {
    const side = l.position.x > 0 ? 1 : -1;
    return bake.addPiece(l, {
      shapes: [
        { half: [0.13, 4, 0.13], offset: [0, 4, 0] },
        { half: [1.2, 0.06, 0.06], offset: [-1.15, 7.9, 0] },
        { half: [0.38, 0.1, 0.17], offset: [-2.35, 7.8, 0] },
      ],
      mass: 220,
      trigger: 'kinematic',
      inherit: 0.35,
      angularDamping: 0.15,
      kick: (b, r, kin) => {
        const dir = kin && kin.vel.z < 0 ? -1 : 1;
        b.angularVelocity.set(dir * 1.1, 0, -side * 0.25);
      },
    });
  });
  bake.bake();
  console.log(`lights physics: arms ${signals.map((s) => s.armPiece.activatedAt?.toFixed(2)).join(',')} heads ${heads.map((h) => `${h.hitAt?.toFixed(2)}/${h.snappedAt?.toFixed(2)}`).join(',')} lamps ${lampPieces.map((l, i) => `${lamps[i].position.x.toFixed(0)},${lamps[i].position.z.toFixed(0)}@${l.activatedAt?.toFixed(2)}`).join(' ')}`);

  // ---- cracks and dust -----------------------------------------------------------------------------------
  const cracks = new Cracks(scene, { maxSegments: 1400 });
  own(cracks.mesh);
  const crackSeeds = [
    [4.6, 36, 26.5, 11],
    [8.4, 29, 27.0, 12],
    [4.8, 21, 27.6, 12],
    [8.7, 14, 28.2, 10],
    [9.6, 31, 27.35, 6],
    [-4.4, 8, 29.6, 10],
    [-8.2, 16, 30.6, 11],
    [-4.0, 23, 31.4, 10],
    [7.6, 47, 30.4, 12],
    [3.8, 54, 31.0, 11],
    [8.4, 40, 31.7, 10],
  ];
  const dust = new Dust(scene, { color: 0xb59c78, max: 160, opacity: 0.7 });
  dust.sprites.forEach(own);
  crackSeeds.forEach(([x, z, t0, len], i) => {
    cracks.grow({ t0, x, z, len, width: 0.22, speed: 7, seed: 70 + i, branches: 5 });
    dust.emit({ t: t0, duration: 0.6, pos: [x, 0.3, z], count: 5, spread: [2, 0.1, 2], vel: [0, 0.4, 0], velSpread: 0.5, size: 1.2, growth: 1.5, life: 4.5, rise: 0.15, seed: 90 + i });
  });
  for (const h of heads) {
    const tl = bake.landTime(h.piece, h.snappedAt ?? 99, 0.9);
    if (tl) {
      const p = bake.positionAt(h.piece, tl);
      dust.emit({ t: tl, pos: [p.x, 0.3, p.z], count: 4, spread: [0.4, 0.1, 0.4], vel: [0, 0.6, 0], velSpread: 0.6, size: 0.9, growth: 1.4, life: 3.5, seed: Math.round(p.z * 10) });
    }
  }
  lampPieces.forEach((lp, i) => {
    if (lp.activatedAt === null) return;
    const tl = lp.activatedAt + 1.25;
    const p = bake.positionAt(lp, tl);
    dust.emit({ t: tl, pos: [p.x, 0.3, p.z], count: 6, spread: [1.2, 0.1, 2.5], vel: [0, 0.5, 0], velSpread: 0.7, size: 1.3, growth: 1.6, life: 4, seed: 130 + i });
  });

  // ---- people -----------------------------------------------------------------------------------------------
  const people = [];
  // spec: x, z (start), face (initial heading), tRun, runX, kind, pose(t) extras, speed
  const person = (o) => {
    const vRun = o.speed ?? 4.4;
    const w = walker(scene, rng, {
      kind: o.kind,
      points: [new THREE.Vector3(o.runX ?? o.x, SIDEWALK_Y, o.z), new THREE.Vector3(o.runX ?? o.x, SIDEWALK_Y, o.z + 80)],
      speed: (t) => (o.walk && t < o.tRun ? o.walk : vRun * smoothstep(o.tRun, o.tRun + 0.7, t)),
      run: (t) => smoothstep(o.tRun, o.tRun + 0.4, t),
      t0: 20.5,
      t1: 33.5,
      turnRate: 9,
    });
    own(w.rig.root);
    people.push({ w, o });
  };
  const turnTo = (from, to, k) => {
    let d = to - from;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return from + d * k;
  };
  // East sidewalk, north of us: they watch, point, then run past us.
  person({ kind: 'man', x: 14.0, runX: 13.3, z: 19.2, face: Math.PI + 0.35, tRun: 27.75, pose: (t) => ({ point: smoothstep(23.7, 24.2, t) * (1 - smoothstep(27.3, 27.7, t)), pointUp: 0.55 }) });
  person({ kind: 'woman', x: 16.9, runX: 17.4, z: 17.6, face: Math.PI + 0.2, tRun: 27.9, pose: (t) => ({ lookUp: 0.3 * smoothstep(23, 23.8, t), holdHead: smoothstep(24.0, 24.5, t) * (1 - smoothstep(27.4, 27.9, t)) }) });
  person({ kind: 'woman', x: 13.4, z: 14.6, face: Math.PI + 0.3, tRun: 28.15, pose: () => ({ holdHand: 1, holdSide: -1, holdSh: 0.32 }) });
  person({ kind: 'boy', x: 14.1, z: 14.6, face: Math.PI + 0.3, tRun: 28.15, pose: () => ({ holdHand: 1, holdSide: 1, holdSh: -0.6, holdAbd: 0.3 }) });
  person({ kind: 'man', x: 17.4, z: 21.6, face: -Math.PI / 2 - 1.0, tRun: 27.6, pose: (t) => ({ point: smoothstep(24.6, 25.1, t) * (1 - smoothstep(27.1, 27.5, t)), pointUp: 0.4 }) });
  // South of us: walking toward us, then turning back and running.
  person({ kind: 'woman', x: 16.9, z: 44, face: Math.PI, walk: 0, tRun: 28.0, pose: (t) => ({ armsUp: 0.7 * smoothstep(27.6, 28.0, t) * (1 - smoothstep(28.8, 29.4, t)) }) });
  person({ kind: 'man', x: 13.6, z: 40, face: Math.PI, tRun: 27.9, pose: () => ({}) });
  person({ kind: 'girl', x: 17.2, z: 36.5, face: Math.PI + 0.4, tRun: 28.05, pose: () => ({}) });
  // Faster runners from behind us who overtake us as we start to run.
  person({ kind: 'man', x: 13.5, z: 28.2, face: Math.PI + 0.3, tRun: 28.7, speed: 4.6, pose: () => ({}) });
  person({ kind: 'woman', x: 17.4, z: 29.6, face: Math.PI + 0.1, tRun: 28.5, speed: 4.4, pose: () => ({}) });
  person({ kind: 'man', x: 17.1, z: 31.5, face: Math.PI - 0.2, tRun: 28.3, speed: 4.8, pose: (t) => ({ armsUp: 0.6 * smoothstep(28.2, 28.5, t) * (1 - smoothstep(29.2, 29.8, t)) }) });
  // West sidewalk.
  for (let i = 0; i < 7; i++) {
    const x = i % 2 ? -14.2 : -16.8;
    person({ x, z: -4 + i * 7.5, face: Math.PI - 0.6 + rng.range(-0.4, 0.4), tRun: 27.5 + rng.range(0, 0.8), speed: rng.range(3.8, 4.6), pose: (t) => (i % 3 === 0 ? { point: smoothstep(24 + i * 0.1, 24.5 + i * 0.1, t) * (1 - smoothstep(27, 27.4, t)), pointUp: 0.5 } : { lookUp: 0.25 }) });
  }

  // ---- camera ----------------------------------------------------------------------------------------------
  const look = camPath([
    { t: 21.0, yaw: 1.75, pitch: 0.03, roll: 0 },
    { t: 21.8, yaw: 1.3, pitch: 0.06 },
    { t: 22.6, yaw: 0.8, pitch: 0.12 },
    { t: 23.3, yaw: 0.52, pitch: 0.2 },
    { t: 24.2, yaw: 0.48, pitch: 0.19 },
    { t: 24.65, yaw: 0.53, pitch: 0.13 },
    { t: 25.5, yaw: 0.5, pitch: 0.15 },
    { t: 26.2, yaw: 0.85, pitch: 0.22 },
    { t: 26.9, yaw: 1.1, pitch: 0.3 },
    { t: 27.5, yaw: 0.85, pitch: 0.1 },
    { t: 28.2, yaw: 0.45, pitch: 0.1 },
    { t: 28.75, yaw: 0.3, pitch: 0.08 },
    { t: 29.25, yaw: 0.38, pitch: 0.05 },
    { t: 29.95, yaw: Math.PI - 0.12, pitch: -0.02 },
    { t: 31.0, yaw: Math.PI + 0.02, pitch: -0.03 },
    { t: 32.0, yaw: Math.PI - 0.22, pitch: 0.0 },
    { t: 33.0, yaw: Math.PI - 0.1, pitch: -0.02 },
  ]);
  const runDist = distanceFn([[0, 0], [29.45, 0], [30.25, 3.0], [31.0, 4.2], [34, 4.2]]);

  return {
    range: [21, 33],
    objects: objs,
    update(t) {
      for (const c of cars) c.update(t);
      autoFold(cars, t);
      for (const s of hiddenSignals) s.group.visible = false;
      // Push the curb trees back a little so the giant bodies pass clear of the canopies.
      for (const tr of W.furn.trees) if (Math.abs(tr.position.x) < 13.2) tr.position.x = Math.sign(tr.position.x) * 13.45;
      bake.apply(t);
      cracks.update(t);
      dust.update(t);
      for (const { w, o } of people) {
        w.update(t, o.pose(t));
        // Face the action while standing, then whip round as they start to run.
        const k = smoothstep(o.tRun - 0.45, o.tRun + 0.05, t);
        if (!o.walk) w.rig.root.rotation.y = turnTo(o.face, w.rig.root.rotation.y, k);
      }

      // Camera: stand, then turn and run south.
      const d = runDist(t);
      const steps = d / 1.3;
      const running = smoothstep(29.4, 30.2, t);
      const b = bob(steps, 'run');
      const lk = look(t);
      applyCam(camera, { x: CX + 0.15 * running + b.dx * running, y: 1.62 + b.dy * running, z: CZ + d, yaw: lk.yaw, pitch: lk.pitch + b.pitch * running, roll: b.roll * running });
      drift(camera, t, 1, 13);
      // Ground shake from the giant cars, growing with their size, plus jolts at impacts.
      const near = (c) => 1 - smoothstep(6, 40, Math.abs(c.pose(t).z - camera.position.z));
      const quake = 0.25 + 0.6 * Math.max(near(carA) * 0.7, near(carC)) + 0.4 * smoothstep(27, 28.5, t);
      shake(camera, t, quake, { seed: 41, freq: 10, trans: 0.006 });
      shake(camera, t, 1.4 * smoothstep(23.5, 23.65, t) * (1 - smoothstep(23.65, 24.6, t)), { seed: 43, freq: 15 });
      shake(camera, t, 1.2 * smoothstep(28.5, 28.65, t) * (1 - smoothstep(28.65, 29.6, t)), { seed: 47, freq: 15 });

      // Hands: shield at the snap, pump while running.
      const shieldK = smoothstep(24.25, 24.75, t) * (1 - smoothstep(25.9, 26.5, t));
      let right = shieldK > 0.01 ? blendTarget(HIDDEN_R, HANDS.shieldR, shieldK) : null;
      let left = shieldK > 0.01 ? blendTarget(HIDDEN_L, HANDS.shieldL, shieldK) : null;
      if (running > 0.01) {
        const ra = runArms(steps / 2, running);
        right = ra.right;
        left = ra.left;
      }
      fp.update(camera, { right, left });
      fp.placeBody(camera, { mode: running > 0.5 ? 'run' : 'stand', phase: steps / 2, groundY: SIDEWALK_Y, yaw: lk.yaw, t, armsUp: 0, lean: 0.12 * running });

      W.setShadowFocus(8, camera.position.z - 14, 44);
      // The air starts to fill with a little dust as things break.
      const dusty = smoothstep(27.5, 32, t);
      scene.fog.color.lerp(new THREE.Color(0xc9b597), dusty * 0.5);
      scene.fog.density = lerp(0.0006, 0.0016, dusty);
      return {
        bloomThreshold: 1.7,
        bloomStrength: 0.35,
        tint: new THREE.Color(1, 1, 1).lerp(new THREE.Color(1.04, 0.99, 0.92), dusty),
      };
    },
  };
}
