// 0:33-0:39 (10x, 5 FLOORS TALL): from the corner of the cross street at z = 100 we watch two
// cars, each as wide as half the avenue, roll toward us wall to wall. Their corners rip the
// awnings, signs, shop windows, lamps, trees and the corner signal off the west side; the east
// car crushes the corner hydrant and water jets out from under it as we back away.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { camPath, applyCam, bob, drift, shake } from '../kit/camrig.js';
import { scriptedCar, distanceFn, autoFold, checkOverlaps, kinShapes, kinPose, z0For } from './traffic.js';
import { walker } from './people.js';
import { PhysicsBake } from '../kit/physics.js';
import { Dust, Spray } from '../kit/fx.js';
import { makeHydrant, SIDEWALK_Y } from '../kit/nyc.js';
import { HANDS } from '../kit/fprig.js';
import { lerp, smoothstep } from '../util.js';

const T0 = 33;
const T1 = 39;
const BLOCK = [9, 91];

function blendTarget(a, b, k) {
  const mix = (u, v) => u.map((x, i) => lerp(x, v[i], k));
  return { space: 'cam', pos: mix(a.pos, b.pos), palm: mix(a.palm, b.palm), fingers: mix(a.fingers, b.fingers), curl: lerp(a.curl, b.curl, k) };
}
const LOW_R = { space: 'cam', pos: [0.3, -0.85, -0.15], palm: [0, 0, -1], fingers: [0.1, 1, 0.05], curl: 0.2 };
const LOW_L = { space: 'cam', pos: [-0.3, -0.87, -0.15], palm: [0, 0, -1], fingers: [-0.1, 1, 0.05], curl: 0.2 };

export function buildAvenueShot(ctx, W) {
  const { scene, camera, fp } = W;
  const rng = makeRng(404);
  const objs = [];
  const own = (o) => {
    objs.push(o);
    return o;
  };

  // ---- the two cars: fronts at z = 55 at 33 s, rolling south at 10.3 m/s ---------------------------
  const v = distanceFn([[0, 10.3], [60, 10.3]]);
  const west = scriptedCar(scene, { type: 'sedan', color: 0xeeeae2, x: -9.0, dir: 1, dist: v, z0: z0For(79, 37.5, 1, v) });
  const east = scriptedCar(scene, { type: 'sedan', color: 0xc8352b, x: 9.0, dir: 1, dist: v, z0: z0For(76, 37.5, 1, v) });
  const cars = [west, east];
  cars.forEach((c) => own(c.v.group));
  checkOverlaps(cars, T0, T1, 'avenue');

  // ---- physics -------------------------------------------------------------------------------------------
  const bake = new PhysicsBake({ t0: T0, t1: T1 + 0.2, seed: 12, maxSpeed: 9 });
  bake.addStaticBox([12, -0.5, -300], [18, SIDEWALK_Y, 300]);
  bake.addStaticBox([-18, -0.5, -300], [-12, SIDEWALK_Y, 300]);
  bake.addStaticBox([-80, 0, BLOCK[0]], [-18, 40, BLOCK[1]]); // west building faces
  bake.addStaticBox([18, 0, BLOCK[0]], [80, 40, BLOCK[1]]);
  cars.forEach((c) => bake.addKinematic(kinPose(c), kinShapes(c.v, { wheels: true }), { triggerMargin: 0.06 }));

  const inBlock = (o, side) => Math.sign(o.position.x) === side && o.position.z > BLOCK[0] && o.position.z < BLOCK[1] + 1;
  const westPieces = [];
  const hideEast = [];
  const fwdKick = (spin = 2) => (b, r) => {
    b.velocity.z += r.range(1.5, 4);
    b.velocity.y += r.range(1, 3);
    b.angularVelocity.set(r.range(-spin, spin), r.range(-spin, spin), r.range(-spin, spin));
  };
  // Awning panels tear off one by one.
  for (const a of W.hero.awnings) {
    if (a.userData.side > 0) {
      if (inBlock(a, 1)) hideEast.push(a);
      continue;
    }
    if (!inBlock(a, -1)) continue;
    westPieces.push(bake.addPiece(a, { half: [0.87, 0.05, 0.6], mass: 18, trigger: 'kinematic', inherit: 0.6, kick: fwdKick(4) }));
  }
  for (const s of W.hero.signs) {
    if (s.userData.side > 0) {
      if (inBlock(s, 1)) hideEast.push(s);
      continue;
    }
    if (!inBlock(s, -1)) continue;
    westPieces.push(bake.addPiece(s, { shapes: [{ half: [0.6, 0.05, 0.05], offset: [0.6, 0.6, 0] }, { half: [0.05, 0.5, 0.55], offset: [0.95, 0, 0] }], mass: 25, trigger: 'kinematic', inherit: 0.5, kick: fwdKick(3) }));
  }
  // Shop windows burst into shards (the intact pane hides once its shards are live).
  const shardMat = W.hero.panes[0]?.material ?? new THREE.MeshLambertMaterial({ color: 0x2a3a4d });
  const glintMat = new THREE.MeshLambertMaterial({ color: 0x9fc4dc, transparent: true, opacity: 0.85 });
  const panes = [];
  for (const p of W.hero.panes) {
    if (p.userData.side > 0) {
      if (inBlock(p, 1)) hideEast.push(p);
      continue;
    }
    if (!inBlock(p, -1)) continue;
    const shards = [];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const w = 3.3 / 3;
        const h = 2.7 / 3;
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, h * 0.96, w * 0.96), (i + j) % 3 === 0 ? glintMat : shardMat);
        m.position.set(p.position.x, p.position.y - 1.35 + h * (j + 0.5), p.position.z - 1.65 + w * (i + 0.5));
        m.castShadow = true;
        scene.add(m);
        own(m);
        W.reg(m);
        const piece = bake.addPiece(m, {
          half: [0.03, h * 0.48, w * 0.48],
          mass: 6,
          trigger: 'kinematic',
          inherit: 0.4,
          maxSpeed: 7,
          kick: (b, r) => {
            b.velocity.set(r.range(1.5, 3.5), r.range(0.5, 2.5), r.range(2, 5));
            b.angularVelocity.set(r.range(-6, 6), r.range(-6, 6), r.range(-6, 6));
          },
        });
        shards.push({ m, piece });
      }
    }
    panes.push({ pane: p, shards });
  }
  // Lamps, trees and the corner signal on the west side, knocked forward.
  for (const l of W.furn.lamps) {
    if (!inBlock(l, Math.sign(l.position.x))) continue;
    if (l.position.x > 0) {
      hideEast.push(l);
      continue;
    }
    westPieces.push(bake.addPiece(l, {
      shapes: [{ half: [0.13, 4, 0.13], offset: [0, 4, 0] }, { half: [1.2, 0.06, 0.06], offset: [-1.15, 7.9, 0] }],
      mass: 220,
      trigger: 'kinematic',
      inherit: 0.5,
      kick: (b) => b.angularVelocity.set(1.3, 0, 0.3),
    }));
  }
  for (const tr of W.furn.trees) {
    if (!inBlock(tr, Math.sign(tr.position.x))) continue;
    if (tr.position.x > 0) {
      hideEast.push(tr);
      continue;
    }
    westPieces.push(bake.addPiece(tr, {
      shapes: [{ half: [0.16, 1.3, 0.16], offset: [0, 1.3, 0] }, { half: [1.1, 0.9, 1.1], offset: [0, 3.7, 0] }],
      mass: 300,
      trigger: 'kinematic',
      inherit: 0.5,
      kick: (b, r) => b.angularVelocity.set(r.range(1.2, 2), r.range(-0.5, 0.5), r.range(-0.4, 0.4)),
    }));
  }
  const nwSignal = W.furn.signals.find((s) => s.zc === 100 && s.side < 0);
  if (nwSignal) {
    W.reg(nwSignal.group);
    westPieces.push(bake.addPiece(nwSignal.group, {
      shapes: [{ half: [0.17, 3.2, 0.17], offset: [0, 3.2, 0] }, { half: [4.8, 0.1, 0.1], offset: [-4.8, 5.8, 0] }],
      mass: 400,
      trigger: 'kinematic',
      inherit: 0.5,
      kick: (b) => b.angularVelocity.set(1.0, 0.2, 0),
    }));
  }
  // The corner hydrant under the east car's right front wheel.
  const hydrant = makeHydrant();
  hydrant.position.set(16.5, SIDEWALK_Y, 92.4);
  scene.add(hydrant);
  own(hydrant);
  W.reg(hydrant);
  const hydPiece = bake.addPiece(hydrant, {
    shapes: [{ half: [0.15, 0.36, 0.15], offset: [0, 0.36, 0] }],
    mass: 80,
    trigger: 'kinematic',
    inherit: 0.6,
    kick: (b) => {
      b.velocity.set(2.5, 3.5, 2);
      b.angularVelocity.set(3, 1, -4);
    },
  });
  bake.bake();
  const hydAt = hydPiece.activatedAt ?? 37.4;
  console.log(`avenue physics: ${westPieces.filter((p) => p.activatedAt !== null).length}/${westPieces.length} west pieces, ${panes.reduce((n, p) => n + p.shards.filter((s) => s.piece.activatedAt !== null).length, 0)} shards, hydrant @${hydPiece.activatedAt?.toFixed(2)}`);

  // Water jets sideways out from under the car, toward the open cross street.
  const spray = new Spray(scene, { pos: [16.5, 0.35, 92.4], t0: hydAt + 0.05, t1: T1 + 0.5, count: 160, seed: 6, dir: [5.6, 2.6, 0.8], spread: [1.2, 0.9], rate: 80, size: [0.45, 0.9] });
  spray.sprites.forEach(own);

  // ---- dust where the corners scrape the facades ------------------------------------------------------
  const dust = new Dust(scene, { color: 0xb89d77, max: 320, opacity: 0.62 });
  dust.sprites.forEach(own);
  const frontAt = (car, z) => {
    for (let t = T0 - 1; t < T1 + 1; t += 0.02) {
      const p = car.pose(t);
      if (p.z + (car.v.dims.L / 2) * p.s >= z) return t;
    }
    return null;
  };
  for (let z = 52; z < 92; z += 3) {
    const t = frontAt(west, z);
    if (t === null) continue;
    dust.emit({ t, pos: [-16.5, 3, z + 2], count: 5, spread: [1.2, 2.5, 1.5], vel: [1.5, 0.6, 3], velSpread: 1.0, size: 3.2, growth: 2.8, life: 7, rise: 0.3, seed: 200 + z, shade: [0.85, 1.05] });
  }
  westPieces.forEach((p, i) => {
    if (p.activatedAt === null) return;
    const q = bake.positionAt(p, p.activatedAt);
    dust.emit({ t: p.activatedAt, pos: [q.x + 0.5, q.y, q.z + 1], count: 2, spread: [0.5, 0.5, 0.5], vel: [1, 0.8, 2.5], velSpread: 0.8, size: 1.6, growth: 2, life: 5, seed: 260 + i });
  });
  for (let z = 86; z < 96; z += 3) {
    const t = frontAt(east, z);
    if (t === null) continue;
    dust.emit({ t, pos: [17.2, 2.0, z + 2], count: 2, spread: [0.8, 1.0, 1.2], vel: [1.5, 0.4, 1.5], velSpread: 0.6, size: 1.8, growth: 1.8, life: 7, rise: 0.2, seed: 300 + z });
  }
  dust.emit({ t: hydAt, pos: [16.5, 0.6, 92.4], count: 5, spread: [0.6, 0.2, 0.6], vel: [2, 0.6, 0.5], velSpread: 0.8, size: 1.2, growth: 1.6, life: 5, seed: 333 });

  // ---- people fleeing along the cross street (nobody on the avenue) -----------------------------------
  const runners = [];
  const runner = (o) => {
    const w = walker(scene, rng, {
      kind: o.kind,
      points: [new THREE.Vector3(o.x0, SIDEWALK_Y, o.z), new THREE.Vector3(o.x1, SIDEWALK_Y, o.z + (o.dz ?? 0))],
      speed: () => o.speed,
      run: () => 1,
      t0: T0 - 1,
      t1: T1 + 1,
    });
    own(w.rig.root);
    runners.push({ w, o });
  };
  runner({ kind: 'man', x0: 29, x1: 120, z: 93.2, speed: 4.6 });
  runner({ kind: 'woman', x0: 34, x1: 120, z: 92.3, speed: 4.2, armsUp: true });
  runner({ kind: 'man', x0: 27, x1: 120, z: 107.0, speed: 4.8 });
  runner({ kind: 'girl', x0: 30.2, x1: 120, z: 108.2, speed: 4.3 });
  runner({ kind: 'woman', x0: 29.5, x1: 120, z: 107.4, speed: 4.3 });
  runner({ kind: 'man', x0: 39, x1: 120, z: 107.6, speed: 4.4 });
  for (let i = 0; i < 6; i++) runner({ x0: -21 - i * 3.2, x1: -140, z: i % 2 ? 92.6 : 107.5, speed: rng.range(3.9, 4.8) });

  // ---- camera: standing at the corner, then backing away east --------------------------------------
  // South-east corner of the intersection, looking up the avenue past the NE corner building.
  const X0 = 21.2;
  const Z = 107.8;
  const back = distanceFn([[0, 0], [36.2, 0], [36.7, 1.5], [38.0, 1.7], [38.6, 1.0], [39.2, 0.6]]);
  const look = camPath([
    { t: 33.0, yaw: 0.66, pitch: 0.16, roll: 0 },
    { t: 34.4, yaw: 0.78, pitch: 0.17 },
    { t: 35.6, yaw: 0.66, pitch: 0.2 },
    { t: 36.6, yaw: 0.38, pitch: 0.28 },
    { t: 37.25, yaw: 0.3, pitch: 0.1 },
    { t: 37.9, yaw: 0.75, pitch: 0.22 },
    { t: 38.5, yaw: 1.2, pitch: 0.16 },
    { t: 39.0, yaw: 1.1, pitch: 0.12 },
  ]);

  return {
    range: [T0, T1],
    objects: objs,
    update(t) {
      for (const c of cars) c.update(t);
      autoFold(cars, t);
      for (const o of hideEast) o.visible = false;
      // Fire escapes along the swept west block would cut through the car: they are torn away.
      for (const b of W.city.buildings) if (b.side < 0 && !b.back && b.z1 > BLOCK[0] && b.z0 < BLOCK[1]) for (const e of b.extras) e.visible = false;
      bake.apply(t);
      for (const { pane, shards } of panes) {
        const live = shards.some((s) => s.piece.activatedAt !== null && t >= s.piece.activatedAt);
        pane.visible = !live;
        for (const s of shards) s.m.visible = live;
      }
      spray.update(t);
      dust.update(t);
      for (const { w, o } of runners) w.update(t, o.armsUp ? { armsUp: 0.55 } : {});

      const d = back(t);
      const steps = d / 0.75;
      const moving = smoothstep(35.9, 36.4, t);
      const b = bob(steps, 'walk');
      const lk = look(t);
      applyCam(camera, { x: X0 + d + b.dx * moving, y: 1.62 + b.dy * moving, z: Z, yaw: lk.yaw, pitch: lk.pitch, roll: b.roll * moving });
      drift(camera, t, 1, 17);
      const ep = east.pose(t);
      const near = 1 - smoothstep(5, 55, Math.abs(ep.z + (east.v.dims.L / 2) * ep.s - Z));
      shake(camera, t, 0.55 + 1.2 * near, { seed: 51, freq: 9, trans: 0.012 });
      shake(camera, t, 1.2 * smoothstep(hydAt, hydAt + 0.08, t) * (1 - smoothstep(hydAt + 0.1, hydAt + 0.9, t)), { seed: 53, freq: 16 });

      const guard = smoothstep(37.55, 38.05, t) * (1 - smoothstep(38.7, 39.2, t));
      fp.update(camera, guard > 0.01 ? { right: blendTarget(LOW_R, HANDS.shieldR, guard), left: blendTarget(LOW_L, HANDS.shieldL, guard) } : {});
      fp.placeBody(camera, { mode: moving > 0.5 ? 'walk' : 'stand', phase: -steps / 2, groundY: SIDEWALK_Y, yaw: lk.yaw, t });

      W.setShadowFocus(2, 78, 48, 160, 30);
      const dusty = 0.55 + 0.25 * smoothstep(34, 38, t);
      scene.fog.color.lerp(new THREE.Color(0xc4ab88), dusty);
      scene.fog.density = lerp(0.0006, 0.0032, dusty);
      return {
        bloomThreshold: 1.7,
        bloomStrength: 0.35,
        tint: new THREE.Color(1, 1, 1).lerp(new THREE.Color(1.06, 0.98, 0.88), dusty),
        saturation: 1.06,
      };
    },
  };
}
