// 0:00-0:16 One continuous first-person take:
//   waking up on the sidewalk (eyelids, blink, focus pull, looking up, head turn, hand push,
//   standing up dizzy), walking north, a slightly-too-big taxi clipping a parked scooter (1.2x),
//   then traffic squeezing out of its lanes and mirrors scraping (1.5x).
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { Track, camPathQ, camPath, applyCamQ, applyCam, bob, drift, shake } from '../kit/camrig.js';
import { scriptedCar, distanceFn, autoFold, checkOverlaps } from './traffic.js';
import { walker } from './people.js';
import { PhysicsBake } from '../kit/physics.js';
import { makePigeons } from '../kit/fx.js';
import { carScale } from '../timeline.js';
import { clamp, lerp, smoothstep } from '../util.js';

const X = 15.35; // our walking line on the east sidewalk
const Z0 = 30; // where we wake up

function makeScooter() {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: 0x6cc4b6 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x222326 });
  const seat = new THREE.MeshLambertMaterial({ color: 0x5a3a2a });
  const add = (geo, m, x, y, z, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.x = rx;
    mesh.castShadow = true;
    g.add(mesh);
  };
  add(new THREE.BoxGeometry(0.42, 0.42, 1.05), body, 0, 0.5, -0.2);
  add(new THREE.BoxGeometry(0.36, 0.12, 0.6), seat, 0, 0.78, -0.25);
  add(new THREE.BoxGeometry(0.34, 0.75, 0.16), body, 0, 0.72, 0.45, -0.25);
  add(new THREE.BoxGeometry(0.7, 0.06, 0.06), dark, 0, 1.12, 0.55);
  add(new THREE.BoxGeometry(0.2, 0.12, 0.08), body, 0, 1.04, 0.6);
  for (const z of [-0.5, 0.55]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 10), dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.22, z);
    w.castShadow = true;
    g.add(w);
  }
  return g;
}

export function buildWakeShot(ctx, W) {
  const { scene, camera, fp } = W;
  const rng = makeRng(101);
  const objs = [];
  const own = (o) => {
    objs.push(o);
    return o;
  };

  // ---- traffic -----------------------------------------------------------------------------------
  const slow = (v0, vc = 1.8) => distanceFn([[0, v0], [12.0, v0], [12.8, vc], [20, vc]]);
  const lanes = [
    { x: 7.5, dir: -1, v: 5.5, cars: [[76.9, 'taxi', null, 'hero'], [46.9, 'sedan', 0xd8d4cc], [16.9, 'van'], [106.9, 'sedan', 0xc8352b], [-15, 'taxi'], [-48, 'sedan', 0x2b3f63]] },
    { x: 4.5, dir: -1, v: 7.0, cars: [[95.9, 'sedan', 0xd9c49c, 'squeeze'], [65.9, 'taxi'], [35.9, 'sedan', 0xf2f2ee], [5.9, 'van'], [125.9, 'taxi'], [-26, 'sedan', 0x8a2a24]] },
    { x: 1.6, dir: -1, v: 6.5, cars: [[58, 'taxi'], [26, 'sedan', 0x3a4a63], [92, 'van'], [-6, 'taxi'], [-40, 'sedan', 0xe0e0dc]] },
    { x: -2.0, dir: 1, v: 6.0, cars: [[-60, 'bus'], [-110, 'taxi'], [-10, 'sedan', 0xc8b48c], [-160, 'van']] },
    { x: -4.8, dir: 1, v: 7.0, cars: [[-20, 'taxi'], [-95, 'sedan', 0xb03a2e], [-140, 'taxi']] },
    { x: -7.6, dir: 1, v: 5.0, cars: [[-35, 'sedan', 0xf0efe9], [-75, 'taxi'], [-125, 'van']] },
  ];
  // The two near northbound lanes jam right in front of us at 1.5x, so the squeeze and the mirror
  // scrape happen about 12 m away instead of down the block.
  const jam = {
    7.5: distanceFn([[0, 5.5], [10.6, 5.5], [11.8, 0.9], [13.0, 0.5], [20, 0.5]]),
    4.5: distanceFn([[0, 7.0], [10.6, 7.0], [11.8, 3.2], [13.0, 0.8], [13.6, 0.5], [20, 0.5]]),
  };
  const cars = [];
  let heroTaxi = null;
  let squeezeSedan = null;
  for (const L of lanes) {
    const dist = jam[L.x] ?? slow(L.v, L.dir < 0 ? 1.8 : L.v * 0.6);
    for (const [z0, type, color, tag] of L.cars) {
      let xFn = L.x;
      if (tag === 'hero') {
        // Drifts right as it grows, so its mirror clips the scooter; back a little after.
        xFn = (t) => L.x + 0.7 * smoothstep(8.6, 10.0, t) - 0.45 * smoothstep(11.0, 12.6, t);
      }
      if (tag === 'squeeze') xFn = (t) => L.x + 0.25 * smoothstep(12.5, 13.6, t);
      const c = scriptedCar(scene, { type, color: color ?? undefined, x: xFn, z0, dir: L.dir, dist });
      own(c.v.group);
      cars.push(c);
      if (tag === 'hero') heroTaxi = c;
      if (tag === 'squeeze') squeezeSedan = c;
    }
  }
  // Parked cars along both curbs (they grow too).
  for (const [x, z, type, color] of [[10.5, 45, 'sedan', 0xd6d2c8], [10.5, 53, 'taxi'], [10.5, 67, 'sedan', 0x2b4a7a], [10.5, 79, 'van'], [-10.5, 16, 'sedan', 0xc8352b], [-10.5, 28, 'sedan', 0xe6e2d8], [-10.5, 41, 'van'], [-10.5, 56, 'taxi'], [-10.5, 70, 'sedan', 0x4a5a3a]]) {
    const c = scriptedCar(scene, { type, color, x, z0: z, dir: -1, dist: () => 0 });
    own(c.v.group);
    cars.push(c);
  }
  checkOverlaps(cars, 0, 16, 'wake');

  // ---- scooter + mirror physics -------------------------------------------------------------------
  const scooter = makeScooter();
  scooter.position.set(10.05, 0, 19.5);
  scooter.rotation.y = -0.45;
  scene.add(scooter);
  own(scooter);
  const bake = new PhysicsBake({ t0: 8, t1: 16.5, seed: 5, maxSpeed: 6 });
  bake.addStaticBox([12, -0.3, -100], [40, 0.15, 200]);
  const heroPose = (t) => {
    const p = heroTaxi.pose(t);
    return {
      position: new THREE.Vector3(p.x, 0, p.z),
      quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.heading),
      scale: p.s,
    };
  };
  const td = heroTaxi.v.dims;
  bake.addKinematic(heroPose, [
    { half: [td.W / 2, td.H * 0.3, td.L / 2], offset: [0, td.clearance + td.H * 0.3, 0] },
    // The east-side mirror (local -x for a northbound car).
    { half: [0.14, 0.1, 0.13], offset: [-(td.mirrorReach - 0.12), td.mirrorY, td.mirrorZ] },
  ], { triggerMargin: 0.02 });
  const scooterPiece = bake.addPiece(scooter, {
    shapes: [
      { half: [0.21, 0.3, 0.55], offset: [0, 0.45, -0.15] },
      { half: [0.35, 0.05, 0.05], offset: [0, 1.12, 0.55] },
    ],
    mass: 110,
    trigger: 'kinematic',
    inherit: 0.25,
    kick: (b) => {
      b.angularVelocity.set(0.2, 0, -2.6);
      b.velocity.x += 0.9;
    },
  });
  // The taxi's west mirror snaps off against the squeezing sedan at 13.4 s.
  const SNAP = 13.4;
  const snapMirror = new THREE.Group();
  {
    const dark = new THREE.MeshLambertMaterial({ color: 0x26282b });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), dark);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.17, 0.22), heroTaxi.v.paint);
    head.position.x = 0.09;
    arm.position.x = 0;
    snapMirror.add(arm, head);
    snapMirror.traverse((o) => o.isMesh && (o.castShadow = true));
    const p = heroTaxi.pose(SNAP);
    const s = p.s;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.heading);
    const local = new THREE.Vector3(td.W * 0.47 + 0.1, td.mirrorY, td.mirrorZ).multiplyScalar(s);
    snapMirror.position.set(p.x, 0, p.z).add(local.applyQuaternion(q));
    snapMirror.quaternion.copy(q);
    snapMirror.scale.setScalar(s);
    scene.add(snapMirror);
    own(snapMirror);
  }
  bake.addPiece(snapMirror, {
    half: [0.17 * 1.5, 0.1 * 1.5, 0.13 * 1.5],
    mass: 3,
    trigger: SNAP,
    kick: (b) => {
      b.velocity.set(-1.6, 1.2, -1.8);
      b.angularVelocity.set(3, 5, -2);
    },
  });
  bake.bake();
  const scooterHit = scooterPiece.activatedAt ?? 99;

  // ---- pedestrians -----------------------------------------------------------------------------------
  const peds = [];
  const ped = (spec) => {
    const w = walker(scene, rng, { t0: -1, t1: 17, ...spec });
    own(w.rig.root);
    peds.push(w);
    return w;
  };
  // Feet walking past our head while we lie on the sidewalk.
  ped({ kind: 'woman', x: 14.35, z0: 22.5, z1: 60, speed: 1.3 });
  ped({ kind: 'man', x: 14.2, z0: 26, z1: 60, speed: 1.4 });
  ped({ kind: 'man', x: 14.0, z0: -8, z1: 60, speed: 1.35 });
  ped({ kind: 'girl', x: 14.55, z0: -10, z1: 60, speed: 1.25 });
  ped({ kind: 'woman', x: 14.25, z0: -16, z1: 60, speed: 1.25 });
  ped({ kind: 'man', x: 16.95, z0: 44, z1: -40, speed: 1.3 });
  ped({ kind: 'woman', x: 16.85, z0: 40, z1: -40, speed: 1.2 });
  ped({ kind: 'boy', x: 16.95, z0: 33.5, z1: -40, speed: 1.35 });
  ped({ kind: 'man', x: 16.9, z0: 12, z1: -40, speed: 1.2 });
  ped({ kind: 'woman', x: 16.95, z0: -4, z1: -60, speed: 1.15 });
  for (let i = 0; i < 10; i++) {
    const south = i % 2 === 0;
    ped({ x: south ? -14.3 : -16.9, z0: south ? -40 + i * 9 : 60 - i * 8, z1: south ? 90 : -60, speed: rng.range(1.1, 1.45) });
  }
  ped({ kind: 'man', x: 14.3, z0: -18, z1: 60, speed: 1.3 });
  ped({ kind: 'woman', x: 14.4, z0: -26, z1: 60, speed: 1.25 });

  // ---- pigeons flying over while we look up -------------------------------------------------------
  const pigeons = makePigeons(scene, 9, 21);
  pigeons.birds.forEach((b) => own(b.g));
  const pigeonPath = (u) => new THREE.Vector3(lerp(2, 30, u), 13 + 5 * Math.sin(u * Math.PI), lerp(48, 6, u));

  // ---- camera ----------------------------------------------------------------------------------------
  const lie = { yaw: Math.PI, pitch: Math.PI / 2 - 0.02, roll: 0 };
  const wakePath = camPathQ([
    { t: 0, x: X, y: 0.22, z: Z0, ...lie },
    { t: 3.55, x: X, y: 0.22, z: Z0, yaw: Math.PI, pitch: Math.PI / 2 - 0.05, roll: 0 },
    { t: 4.25, x: X - 0.03, y: 0.25, z: Z0, yaw: Math.PI / 2 + 0.05, pitch: -0.06, roll: -0.95 },
    { t: 4.62, x: X - 0.03, y: 0.25, z: Z0, yaw: Math.PI / 2 + 0.12, pitch: -0.1, roll: -0.85 },
    { t: 5.12, x: X - 0.08, y: 0.86, z: Z0 + 0.22, yaw: 1.25, pitch: -0.42, roll: -0.18 },
    { t: 5.85, x: X, y: 1.62, z: Z0 + 0.05, yaw: 0.95, pitch: -0.06, roll: 0.05 },
    { t: 6.55, x: X, y: 1.62, z: Z0, yaw: 0.42, pitch: 0.24, roll: 0 },
    { t: 7.2, x: X, y: 1.62, z: Z0, yaw: 0.05, pitch: 0.02, roll: 0 },
  ]);
  const walkDist = distanceFn([[0, 0], [6.7, 0], [7.5, 1.35], [11.6, 1.35], [12.5, 0], [17, 0]]);
  const lookPath = camPath([
    { t: 7.2, yaw: 0.05, pitch: 0.02, roll: 0 },
    { t: 8.0, yaw: 0.14, pitch: 0.06 },
    { t: 8.8, yaw: -0.1, pitch: 0.0 },
    { t: 9.45, yaw: 0.5, pitch: -0.05 },
    { t: 10.2, yaw: 0.62, pitch: -0.12 },
    { t: 11.1, yaw: 0.5, pitch: -0.1 },
    { t: 11.9, yaw: 0.12, pitch: 0.0 },
    { t: 12.7, yaw: 0.66, pitch: -0.03 },
    { t: 13.3, yaw: 0.68, pitch: -0.05 },
    { t: 13.75, yaw: 0.55, pitch: -0.04 },
    { t: 14.8, yaw: 0.6, pitch: -0.06 },
    { t: 16, yaw: 0.7, pitch: -0.05 },
  ]);
  const lidT = new Track([[0, 1], [1.5, 1], [2.05, 0.42], [2.25, 0.4], [2.5, 0.94], [2.62, 0.94], [3.08, 0]]);
  const blurT = new Track([[0, 5.3], [1.5, 5.3], [2.1, 4.1], [2.6, 3.5], [3.0, 2.3], [3.6, 0.7], [4.05, 0]]);
  const glowT = new Track([[0, 0.3], [1.5, 0.34], [3.1, 0.24]]);
  const dizzy = (t) => smoothstep(5.0, 5.6, t) * (1 - smoothstep(5.6, 8.4, t));

  function handTarget(t) {
    // Right hand comes into view and pushes on the pavement while we sit up.
    if (t < 4.45 || t > 5.75) return null;
    const ground = new THREE.Vector3(X - 0.62, 0.17, Z0 - 0.5);
    const press = smoothstep(4.45, 4.9, t) * (1 - smoothstep(5.3, 5.75, t));
    const fromCam = new THREE.Vector3(0.3, -0.55, 0.05).applyMatrix4(camera.matrixWorld);
    const p = fromCam.lerp(ground, press);
    p.y -= 0.025 * smoothstep(4.9, 5.1, t) * (1 - smoothstep(5.15, 5.3, t));
    return { space: 'world', pos: p.toArray(), palm: [0.1, -1, 0], fingers: [-1, 0, -0.45], curl: 0.1 };
  }

  return {
    range: [0, 16],
    objects: objs,
    update(t) {
      // Vehicles.
      for (const c of cars) c.update(t);
      autoFold(cars, t, new Set([heroTaxi]));
      // Hero taxi mirrors: east mirror folds back when it clips the scooter; west mirror snaps off.
      const hm = heroTaxi.v.mirrors;
      for (const m of hm) {
        if (m.side < 0) m.pivot.rotation.y = -1.25 * smoothstep(scooterHit, scooterHit + 0.12, t);
        else m.pivot.visible = t < SNAP;
      }
      snapMirror.visible = t >= SNAP;
      bake.apply(t);
      if (t < 8) {
        scooter.position.set(10.05, 0, 19.5);
        scooter.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.45);
      }
      for (const p of peds) p.update(t);
      pigeons.update(t, pigeonPath, 2.4, 6.4);

      // Camera.
      let walkSteps = 0;
      if (t < 7.2) {
        applyCamQ(camera, wakePath(t));
      } else {
        const d = walkDist(t);
        walkSteps = d / 0.72;
        const lk = lookPath(t);
        const b = bob(walkSteps, 'walk');
        const moving = smoothstep(6.8, 7.4, t) * (1 - smoothstep(11.9, 12.6, t));
        applyCam(camera, { x: X + b.dx * moving, y: 1.62 + b.dy * moving, z: Z0 - d, yaw: lk.yaw, pitch: lk.pitch + b.pitch * moving, roll: b.roll * moving });
      }
      const dz = dizzy(t);
      if (dz > 0) {
        camera.rotateZ(0.06 * Math.sin(t * 2.6) * dz);
        camera.rotateX(0.035 * Math.sin(t * 1.9 + 0.7) * dz);
        camera.rotateY(0.03 * Math.sin(t * 1.3) * dz);
      }
      drift(camera, t, t < 3.5 ? 0.5 : 1, 7);
      // A little bump of shake when the 1.5x cars scrape.
      shake(camera, t, 0.25 * smoothstep(13.2, 13.4, t) * (1 - smoothstep(13.6, 14.4, t)), { seed: 3, freq: 9 });

      fp.update(camera, { right: handTarget(t) });
      const lying = t < 4.75;
      fp.placeBody(camera, lying ? { mode: 'lie', groundY: 0.15, t } : { mode: t > 6.8 && t < 12.5 ? 'walk' : 'stand', phase: walkSteps / 2, groundY: 0.15, yaw: camera.rotation.y, t, sit: 1 - smoothstep(4.75, 5.8, t) });
      fp.body.root.rotation.y = lying ? 0 : new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y + Math.PI;

      W.setShadowFocus(12, Z0 - walkDist(t) - 14, 42);
      const lid = lidT.at(t);
      return {
        bloomThreshold: 1.7,
        bloomStrength: 0.35,
        exposure: 1.0,
        lid,
        lidGlow: glowT.at(t),
        focusBlur: blurT.at(t),
      };
    },
  };
}
