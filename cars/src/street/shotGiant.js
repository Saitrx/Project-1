// 0:45-0:56 The taxi outgrows the city.
//   45-51 (50x, TIRES CAN'T HOLD IT): from the edge of the flattened blocks we watch the front
//         tyre burst; rubber flies, the body sags onto its rims and cracks spread across the paint,
//         while huge glass panes shake loose from distant towers and fall.
//   51-56 (100x, 450 METERS LONG): standing in front of it, the front surges toward us and one
//         headlight the size of a building fills the sky.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { camPath, applyCam, drift, shake } from '../kit/camrig.js';
import { makeVehicle, placeVehicle } from '../kit/vehicles.js';
import { PhysicsBake } from '../kit/physics.js';
import { Dust } from '../kit/fx.js';
import { worldBox } from '../kit/geom.js';
import { glassTex } from '../kit/nyctex.js';
import { SIDEWALK_Y } from '../kit/nyc.js';
import { carScale } from '../timeline.js';
import { lerp, smoothstep, clamp } from '../util.js';

const T0 = 45;
const TCUT = 51;
const T1 = 56;
const CAR = { x: 6.4, z: 169 };

export function buildGiantShot(ctx, W) {
  const { scene, camera, fp } = W;
  const rng = makeRng(606);
  const objs = [];
  const own = (o) => {
    objs.push(o);
    return o;
  };

  const v = makeVehicle('taxi');
  scene.add(v.group);
  own(v.group);
  const D = v.dims;
  const burstT = 47.25;
  // Front-right wheel (local +x, +z) bursts; the others squash under the load.
  const burstWheel = v.wheels.find((w) => w.front && w.side > 0);
  const sagT = (t) => smoothstep(burstT, burstT + 0.9, t);

  // ---- body cracks (thin dark lines in the body's local frame, growing over time) -------------------
  const crackMat = new THREE.MeshBasicMaterial({ color: 0x1a1612 });
  const cracks = [];
  const lowerH = D.H * 0.45;
  const crackWalk = (start, dirFn, n, t0, seed) => {
    const r = makeRng(seed);
    let p = start.clone();
    let ang = r.range(-0.4, 0.4);
    for (let i = 0; i < n; i++) {
      ang += r.range(-0.7, 0.7);
      const len = r.range(0.05, 0.12);
      const d = dirFn(ang).multiplyScalar(len);
      const q = p.clone().add(d);
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crackMat);
      v.body.add(m);
      cracks.push({ m, a: p.clone(), b: q.clone(), t0: t0 + i * 0.09, w: 0.012 * (1 - i / (n * 1.4)) });
      p = q;
    }
  };
  // On the right side (x = W/2): lines climbing from above the burst wheel.
  for (let k = 0; k < 4; k++) {
    crackWalk(new THREE.Vector3(D.W / 2 + 0.004, D.clearance + 0.05, D.wheelbase / 2 + (k - 1.5) * 0.18), (a) => new THREE.Vector3(0, Math.cos(a), Math.sin(a)), 7, burstT + 0.7 + k * 0.25, 900 + k);
  }
  // On the front face (z = L/2): from the bumper corner up toward the headlight.
  for (let k = 0; k < 3; k++) {
    crackWalk(new THREE.Vector3(D.W * (0.18 + k * 0.1), D.clearance + 0.03, D.L / 2 + 0.004), (a) => new THREE.Vector3(Math.sin(a) * 0.8, Math.cos(a), 0), 6, burstT + 1.0 + k * 0.3, 950 + k);
  }

  // ---- rubber chunks flung from the burst tyre (baked physics) -----------------------------------------
  const bake = new PhysicsBake({ t0: T0, t1: TCUT + 0.2, seed: 31, maxSpeed: 40 });
  const rubberMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1e });
  const s50 = 50;
  const wheelWorld = new THREE.Vector3(CAR.x + (D.track / 2) * s50, 0, CAR.z + (D.wheelbase / 2) * s50);
  for (let i = 0; i < 14; i++) {
    const sz = [rng.range(2, 4.5), rng.range(1, 2.2), rng.range(2, 5)];
    const m = new THREE.Mesh(new THREE.BoxGeometry(...sz), rubberMat);
    const a = rng.range(-1.2, 1.2);
    m.position.set(wheelWorld.x + rng.range(-3, 6), rng.range(1.5, 6), wheelWorld.z + rng.range(-10, 10));
    m.rotation.set(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3));
    m.castShadow = true;
    m.visible = false;
    scene.add(m);
    own(m);
    const piece = bake.addPiece(m, {
      half: sz.map((x) => x / 2),
      mass: 900,
      trigger: burstT + rng.range(0, 0.08),
      kick: (b, r) => {
        b.velocity.set(r.range(6, 16), r.range(4, 13), Math.sin(a) * r.range(4, 14));
        b.angularVelocity.set(r.range(-5, 5), r.range(-5, 5), r.range(-5, 5));
      },
    });
    m.userData.piece = piece;
  }
  bake.bake();
  const rubber = objs.filter((o) => o.userData.piece);

  // ---- glass towers in the distance, shedding huge panes ------------------------------------------------
  const towers = [
    { x0: -135, x1: -85, z0: 135, z1: 185, h: 220, tex: 'glassA', base: '#56c2c6' },
    { x0: -175, x1: -125, z0: 15, z1: 65, h: 250, tex: 'glassB', base: '#4f9fcf' },
  ];
  const panes = [];
  const paneMat = new THREE.MeshLambertMaterial({ color: 0xa9dcec, emissive: 0x1a3440 });
  const holeMat = new THREE.MeshLambertMaterial({ color: 0x1d2a33 });
  for (const [ti, T] of towers.entries()) {
    const tex = glassTex(T.tex, { base: T.base });
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const mesh = new THREE.Mesh(worldBox([T.x0, 0, T.z0], [T.x1, T.h, T.z1], { tile: { w: 24, h: 24 } }), [mat, W.city.materials.roofMat, W.city.materials.roofMat]);
    mesh.castShadow = true;
    scene.add(mesh);
    own(mesh);
    // Panes on the two faces we can see (east and south).
    for (let i = 0; i < 9; i++) {
      const east = i % 2 === 0;
      const y = rng.range(T.h * 0.45, T.h * 0.9);
      const u = rng.range(0.15, 0.85);
      const pos = east ? new THREE.Vector3(T.x1 + 0.25, y, lerp(T.z0, T.z1, u)) : new THREE.Vector3(lerp(T.x0, T.x1, u), y, T.z1 + 0.25);
      const g = new THREE.Mesh(new THREE.BoxGeometry(east ? 0.5 : 8, 12, east ? 8 : 0.5), paneMat);
      g.position.copy(pos);
      scene.add(g);
      own(g);
      const hole = new THREE.Mesh(new THREE.BoxGeometry(east ? 0.3 : 8, 12, east ? 8 : 0.3), holeMat);
      hole.position.copy(pos).add(east ? new THREE.Vector3(-0.2, 0, 0) : new THREE.Vector3(0, 0, -0.2));
      scene.add(hole);
      own(hole);
      const out = east ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      panes.push({ g, hole, pos, out, td: 47.6 + ti * 0.4 + i * rng.range(0.25, 0.4), spin: new THREE.Vector3(rng.range(-0.8, 0.8), rng.range(-0.4, 0.4), rng.range(-0.8, 0.8)) });
    }
  }

  // ---- rubble field where the blocks were flattened ------------------------------------------------------
  const RUB = 900;
  const rubble = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), RUB);
  const palette = [0x9a3a2a, 0xb04a32, 0xcdbd8a, 0xd8cfb8, 0x8a8f96, 0x6c6258, 0xb9b2a4];
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let i = 0; i < RUB; i++) {
    // Mostly in a band around the 50x footprint and in front of the 100x car, never close to us.
    let x;
    let z;
    for (let tries = 0; tries < 30; tries++) {
      if (i < 520) {
        const side = rng.int(0, 3);
        x = side === 0 ? rng.range(-75, -38) : side === 1 ? rng.range(50, 95) : rng.range(-60, 90);
        z = side === 2 ? rng.range(280, 330) : side === 3 ? rng.range(20, 58) : rng.range(40, 330);
      } else {
        x = rng.range(-90, 100);
        z = rng.range(400, 520);
      }
      if (Math.hypot(x - 110, z - 330) > 34 && Math.hypot(x - 52, z - 450) > 40) break;
    }
    const s = rng.range(0.8, 3.8) * (rng.chance(0.12) ? 1.8 : 1);
    m4.compose(
      new THREE.Vector3(x, s * 0.25 + SIDEWALK_Y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-0.5, 0.5), rng.range(0, 3), rng.range(-0.5, 0.5))),
      new THREE.Vector3(s * rng.range(0.7, 1.6), s * rng.range(0.4, 0.9), s * rng.range(0.7, 1.6))
    );
    rubble.setMatrixAt(i, m4);
    rubble.setColorAt(i, col.setHex(rng.pick(palette)));
  }
  rubble.castShadow = true;
  rubble.receiveShadow = true;
  scene.add(rubble);
  own(rubble);

  const dust = new Dust(scene, { color: 0xb39a77, max: 260, opacity: 0.6 });
  dust.sprites.forEach(own);
  dust.emit({ t: burstT, duration: 0.5, pos: [wheelWorld.x + 4, 6, wheelWorld.z], count: 26, spread: [6, 4, 12], vel: [9, 3, 0], velSpread: 4, size: 10, growth: 8, life: 9, rise: 0.6, drag: 0.6, seed: 61 });
  for (let i = 0; i < 18; i++) {
    dust.emit({ t: T0 + i * 0.3, pos: [rng.range(-50, 80), 4, rng.range(60, 320)], count: 2, spread: [10, 3, 10], vel: [1.5, 0.3, 0.5], velSpread: 1, size: 18, growth: 6, life: 9, rise: 0.4, seed: 70 + i, alpha: 0.6 });
  }
  for (let i = 0; i < 16; i++) {
    dust.emit({ t: TCUT - 0.5 + i * 0.25, pos: [rng.range(-80, 100), 6, rng.range(380, 450)], count: 2, spread: [12, 4, 8], vel: [0.5, 0.4, 4], velSpread: 1.5, size: 22, growth: 7, life: 8, rise: 0.5, seed: 120 + i, alpha: 0.55 });
  }

  // ---- cameras ---------------------------------------------------------------------------------------------
  const camA = camPath([
    { t: T0, x: 110, y: 1.62, z: 330, yaw: 0.8, pitch: 0.34, roll: 0 },
    { t: 46.6, yaw: 0.74, pitch: 0.3 },
    { t: burstT, yaw: 0.66, pitch: 0.2 },
    { t: 48.3, yaw: 0.7, pitch: 0.26 },
    { t: 49.3, yaw: 0.84, pitch: 0.42 },
    { t: 50.3, yaw: 0.86, pitch: 0.46 },
    { t: TCUT, yaw: 0.8, pitch: 0.34 },
  ]);
  const camB = camPath([
    { t: TCUT, x: 54, y: 1.62, z: 446, yaw: -0.14, pitch: 0.2, roll: 0 },
    { t: 52.6, x: 54, y: 1.62, z: 449, yaw: -0.16, pitch: 0.42 },
    { t: 54.4, yaw: -0.15, pitch: 0.9 },
    { t: T1, yaw: -0.14, pitch: 0.96 },
  ]);

  return {
    range: [T0, T1],
    objects: objs,
    update(t) {
      // Holds just above 100x here; the counter already runs on toward the next beat.
      const s = Math.min(carScale(t), 104);
      placeVehicle(v, CAR.x, 0, CAR.z, 0, s);
      v.roll(0, s);
      // The body drops onto the rims and leans toward the burst wheel.
      const sag = sagT(t);
      v.body.position.y = -0.16 * sag;
      v.body.rotation.z = -0.025 * sag;
      v.body.rotation.x = 0.012 * sag;
      for (const w of v.wheels) {
        const flat = w === burstWheel ? 0.55 * sag : 0.12 * sag;
        w.tire.scale.set(1, 1 - flat, 1 + flat * 0.45);
        w.group.position.y = D.wheelR * (1 - flat);
      }
      for (const c of cracks) {
        const u = clamp((t - c.t0) / 0.12);
        c.m.visible = u > 0;
        if (!c.m.visible) continue;
        const b = c.a.clone().lerp(c.b, u);
        const mid = c.a.clone().add(b).multiplyScalar(0.5);
        const len = c.a.distanceTo(b);
        c.m.position.copy(mid);
        c.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().sub(c.a).normalize());
        c.m.scale.set(c.w, c.w, Math.max(1e-4, len));
      }
      bake.apply(t);
      for (const r of rubber) r.visible = t >= burstT && t < TCUT;
      for (const p of panes) {
        const a = Math.max(0, t - p.td);
        p.g.position.copy(p.pos).addScaledVector(p.out, 2.2 * a).add(new THREE.Vector3(0, -4.9 * a * a, 0));
        p.g.rotation.set(p.spin.x * a, p.spin.y * a, p.spin.z * a);
        p.g.visible = p.g.position.y > 0;
        p.hole.visible = t > p.td;
      }
      dust.update(t);

      // Clear the flattened blocks (buildings, furniture) around the car, and under our towers.
      W.crush(-100, 120, -80, 540);
      for (const T of towers) W.crush(T.x0 - 2, T.x1 + 2, T.z0 - 2, T.z1 + 2);
      for (const c of Object.values(W.corners)) c.intact.visible = false;

      const p = t < TCUT ? camA(t) : camB(t);
      applyCam(camera, p);
      drift(camera, t, 1.4, 23);
      const quake = t < TCUT ? 0.9 + 0.8 * smoothstep(T0, 46.6, t) * (1 - smoothstep(46.6, 47.2, t)) : 1.0 + 1.4 * smoothstep(TCUT, 52.6, t) * (1 - smoothstep(52.6, 53.8, t));
      shake(camera, t, quake, { seed: 71, freq: 6, trans: 0.02 });
      shake(camera, t, 3.2 * smoothstep(burstT, burstT + 0.05, t) * (1 - smoothstep(burstT + 0.1, burstT + 1.3, t)), { seed: 73, freq: 15, trans: 0.03 });
      fp.update(camera, {});
      fp.placeBody(camera, { mode: 'stand', groundY: SIDEWALK_Y, yaw: p.yaw, t });

      if (t < TCUT) W.setShadowFocus(20, 190, 170, 320, 60);
      else W.setShadowFocus(10, 260, 280, 420, 60);
      scene.fog.color.set(0xc2a885);
      scene.fog.density = 0.0021;
      return {
        bloomThreshold: 1.6,
        bloomStrength: t < TCUT ? 0.38 : 0.5,
        tint: new THREE.Color(1.08, 0.98, 0.86),
        saturation: 1.02,
      };
    },
  };
}
