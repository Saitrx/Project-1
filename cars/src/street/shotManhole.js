// 0:16-0:21 (2x, AS HEAVY AS A CITY BUS): standing at the curb, a sedan the size of a van rolls
// past close enough to touch; its wheels roll over a manhole and the iron cover rattles and jumps,
// then a little steam puffs out.
import * as THREE from 'three';
import { makeRng, fbm1 } from '../rng.js';
import { camPath, applyCam, drift, shake } from '../kit/camrig.js';
import { scriptedCar, distanceFn, autoFold, checkOverlaps } from './traffic.js';
import { walker, stander } from './people.js';
import { Dust } from '../kit/fx.js';
import { makeManhole } from '../kit/nyc.js';
import { smoothstep } from '../util.js';

const MH = { x: 5.95, z: 33.5 };

export function buildManholeShot(ctx, W) {
  const { scene, camera, fp } = W;
  const rng = makeRng(202);
  const objs = [];
  const own = (o) => {
    objs.push(o);
    return o;
  };

  // ---- traffic: slow, heavy, bumper to bumper ----------------------------------------------------
  const cars = [];
  const lane = (x, dir, v, list) => {
    const dist = distanceFn([[0, v], [30, v]]);
    for (const [z0, type, color] of list) {
      const c = scriptedCar(scene, { type, color, x, z0, dir, dist });
      own(c.v.group);
      cars.push(c);
    }
  };
  // Hero: front wheels cross the manhole at about 18.0 s; its near (east) wheels roll over it.
  lane(4.4, -1, 4.0, [[108.2, 'sedan', 0xe9e5dc], [123.5, 'taxi'], [92.4, 'taxi'], [77, 'sedan', 0x2b4a7a]]);
  lane(9.3, -1, 4.0, [[142, 'taxi'], [160, 'sedan', 0xc8352b], [62, 'van']]);
  lane(-2.6, 1, 4.2, [[-20, 'taxi'], [-5, 'sedan', 0x3a4a63], [10, 'taxi'], [-35, 'van']]);
  lane(-6.8, 1, 3.8, [[-12, 'sedan', 0xf0efe9], [3, 'taxi'], [18, 'sedan', 0x8a2a24]]);
  for (const [x, z, type, color] of [[-10.5, 47, 'sedan', 0xc8352b], [-10.5, 62, 'taxi'], [-10.5, 75, 'sedan', 0xe6e2d8]]) {
    const c = scriptedCar(scene, { type, color, x, z0: z, dir: -1, dist: () => 0 });
    own(c.v.group);
    cars.push(c);
  }
  checkOverlaps(cars, 16, 21, 'manhole');
  const hero = cars[0];

  // When does each hero wheel axle cross the manhole?
  const axleTimes = [];
  for (const sign of [1, -1]) {
    let prev = null;
    for (let t = 15; t < 22; t += 0.01) {
      const p = hero.pose(t);
      const wz = p.z - sign * (hero.v.dims.wheelbase / 2) * p.s;
      if (prev !== null && prev > MH.z && wz <= MH.z) axleTimes.push(t);
      prev = wz;
    }
  }

  // ---- the manhole cover (a separate copy we can lift) ---------------------------------------------
  const cover = makeManhole();
  cover.position.set(MH.x, 0.02, MH.z);
  scene.add(cover);
  own(cover);
  const coverHome = W.furn.manholes.find((m) => Math.abs(m.position.x - MH.x) < 0.01 && Math.abs(m.position.z - MH.z) < 0.01);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 16), new THREE.MeshBasicMaterial({ color: 0x0c0c0d }));
  hole.position.set(MH.x, 0.006, MH.z);
  scene.add(hole);
  own(hole);

  const steam = new Dust(scene, { color: 0xf1efea, max: 48, opacity: 0.38 });
  steam.sprites.forEach(own);
  // Steam escapes once the cover has been knocked askew by the rear axle.
  const lastAxle = Math.max(...axleTimes);
  steam.emit({ t: lastAxle + 0.35, duration: 1.3, pos: [MH.x, 0.15, MH.z], count: 24, spread: [0.22, 0.04, 0.22], vel: [0.15, 1.0, -0.3], velSpread: 0.3, size: 0.32, growth: 1.0, life: 3.0, rise: 0.4, drag: 1.2, seed: 41 });

  // ---- people watching ---------------------------------------------------------------------------------
  const people = [];
  const st = (spec, pose) => {
    const s = stander(scene, rng, spec);
    own(s.rig.root);
    people.push({ s, pose });
  };
  st({ kind: 'man', x: 14.1, z: 37.2, heading: -Math.PI / 2 - 0.35 }, (t) => ({ point: smoothstep(18.3, 18.9, t), pointUp: 0.05, lookSide: -0.25 * smoothstep(18.6, 19.6, t) }));
  st({ kind: 'woman', x: 16.6, z: 38.4, heading: -Math.PI / 2 - 0.2 }, (t) => ({ lookSide: 0.3 * smoothstep(17.2, 18.4, t) - 0.5 * smoothstep(19.3, 20.4, t) }));
  st({ kind: 'woman', x: 14.6, z: 25.4, heading: -Math.PI / 2 + 0.5 }, (t) => ({ holdHand: 1, holdSide: -1, holdSh: 0.32, lookSide: -0.3 * smoothstep(17.5, 19, t) }));
  st({ kind: 'girl', x: 14.85, z: 24.75, heading: -Math.PI / 2 + 0.5 }, (t) => ({ holdHand: 1, holdSide: 1, holdSh: -0.55, holdAbd: 0.3, lookUp: 0.15 }));
  const walkers = [];
  for (let i = 0; i < 8; i++) {
    const south = i % 2 === 0;
    const w = walker(scene, rng, { x: south ? -14.3 : -16.9, z0: south ? -10 + i * 7 : 75 - i * 7, z1: south ? 90 : -60, speed: rng.range(1.1, 1.4), t0: 15, t1: 22 });
    own(w.rig.root);
    walkers.push(w);
  }
  const w2 = walker(scene, rng, { kind: 'man', x: 16.9, z0: 58, z1: -20, speed: 1.3, t0: 15, t1: 22 });
  own(w2.rig.root);
  walkers.push(w2);

  // ---- camera --------------------------------------------------------------------------------------------
  const X = 12.25;
  const Z = 32.4;
  const look = camPath([
    { t: 16.0, x: X, y: 1.62, z: Z, yaw: 2.36, pitch: -0.02, roll: 0 },
    { t: 16.9, yaw: 2.26, pitch: -0.05 },
    { t: 17.6, yaw: 2.0, pitch: -0.16 },
    { t: 18.3, yaw: 1.78, pitch: -0.22 },
    { t: 19.0, yaw: 1.74, pitch: -0.25 },
    { t: 19.8, yaw: 1.72, pitch: -0.27 },
    { t: 20.35, yaw: 1.62, pitch: -0.2 },
    { t: 21.0, yaw: 1.12, pitch: -0.04 },
  ]);

  return {
    range: [16, 21],
    objects: objs,
    update(t) {
      for (const c of cars) c.update(t);
      autoFold(cars, t);
      for (const p of people) p.s.update(t, p.pose(t));
      for (const w of walkers) w.update(t);

      // Manhole: hums while the car is near, lifts and clanks after each axle rolls over it.
      if (coverHome) coverHome.visible = false;
      const hp = hero.pose(t);
      const near = 1 - smoothstep(4, 14, Math.abs(hp.z - MH.z));
      let lift = 0.004 * near * (0.5 + 0.5 * fbm1(t * 22, 3));
      let tiltX = 0.012 * near * fbm1(t * 18, 5);
      let tiltZ = 0.012 * near * fbm1(t * 17, 9);
      let slide = 0;
      for (const [i, ta] of axleTimes.entries()) {
        const a = t - (ta + 0.12);
        if (a < 0) continue;
        // Decaying hops (the last axle keeps it bouncing as the weight rolls off); lands askew.
        const hop = Math.abs(Math.sin((a * Math.PI) / 0.17)) * Math.exp(-a * (i === 0 ? 6.5 : 2.6)) * (i === 0 ? 0.075 : 0.085);
        lift += hop;
        tiltX += Math.sin(a * 21 + i) * Math.exp(-a * 5) * 0.14;
        tiltZ += Math.cos(a * 17 + i * 2) * Math.exp(-a * 5) * 0.1;
        slide += 0.035 * smoothstep(0, 0.5, a);
      }
      cover.position.set(MH.x + slide, 0.02 + lift, MH.z - slide * 0.6);
      cover.rotation.set(tiltX, slide * 2.5, tiltZ);
      hole.visible = slide > 0.005;
      steam.update(t);

      const p = look(t);
      applyCam(camera, p);
      drift(camera, t, 1, 11);
      // Ground tremor grows as the heavy car passes.
      const pass = 1 - smoothstep(3, 16, Math.abs(hp.z - Z));
      shake(camera, t, 0.15 + 0.55 * pass, { seed: 21, freq: 11, trans: 0.004 });
      for (const ta of axleTimes) shake(camera, t, 0.9 * Math.exp(-Math.max(0, t - ta) * 7) * (t > ta ? 1 : 0), { seed: 31, freq: 16 });

      fp.update(camera, {});
      fp.placeBody(camera, { mode: 'stand', groundY: 0.15, yaw: p.yaw, t });
      W.setShadowFocus(8, 33, 38);
      return { bloomThreshold: 1.7, bloomStrength: 0.35 };
    },
  };
}
