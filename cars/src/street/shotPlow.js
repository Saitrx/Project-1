// 0:39-0:45 (20x, HEAVIER THAN THE EIFFEL TOWER): from the cross street we see a taxi taller than
// the corner buildings come down the avenue. Its side shears the pre-fractured corner of the NE
// building into tumbling chunks and dust; the shock knocks us down onto our hands; we look up as it
// grinds on through the intersection into the SE corner.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { camPath, applyCam, drift, shake } from '../kit/camrig.js';
import { scriptedCar, distanceFn, kinShapes, kinPose, z0For } from './traffic.js';
import { walker } from './people.js';
import { PhysicsBake } from '../kit/physics.js';
import { Dust } from '../kit/fx.js';
import { worldBox } from '../kit/geom.js';
import { canvasTexture } from '../kit/textures.js';
import { SIDEWALK_Y } from '../kit/nyc.js';
import { HANDS } from '../kit/fprig.js';
import { lerp, smoothstep, clamp } from '../util.js';

const T0 = 39;
const T1 = 45;
const GROUND = 4.4;
const STRIP_X = 25;

let interiorMat = null;
function getInteriorMat() {
  if (interiorMat) return interiorMat;
  // Exposed floors of a sheared building: dark rooms between pale concrete slabs.
  const tex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#4a3f37';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5c5047';
    for (let i = 0; i < 4; i++) g.fillRect(i * 64 + 6, 30, 50, 200);
    g.fillStyle = '#b8ada0';
    g.fillRect(0, 0, w, 26);
    g.fillStyle = '#8f8478';
    g.fillRect(0, 22, w, 6);
  }, { repeat: [1, 1] });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  interiorMat = new THREE.MeshLambertMaterial({ map: tex });
  return interiorMat;
}

export function buildPlowShot(ctx, W) {
  const { scene, camera, fp } = W;
  const rng = makeRng(505);
  const objs = [];
  const own = (o) => {
    objs.push(o);
    return o;
  };

  // ---- the taxi: front at z = 76 when it reaches full 20x (40.6 s), 12.5 m/s south -----------------
  const v = distanceFn([[0, 12.5], [60, 12.5]]);
  const taxi = scriptedCar(scene, { type: 'taxi', x: 6.4, dir: 1, dist: v, z0: z0For(30, 40.6, 1, v) });
  own(taxi.v.group);
  const frontZ = (t) => {
    const p = taxi.pose(t);
    return p.z + (taxi.v.dims.L / 2) * p.s;
  };

  const bake = new PhysicsBake({ t0: T0, t1: T1 + 0.2, seed: 21, maxSpeed: 13 });
  bake.addKinematic(kinPose(taxi), kinShapes(taxi.v, { wheels: true }), { triggerMargin: 0.1 });

  // ---- corner buildings: an intact remainder plus a strip of chunks along the avenue face -----------
  const chunkPieces = [];
  const corners = [];
  for (const key of ['NE', 'SE']) {
    const c = W.corners[key];
    const cornice = new THREE.MeshLambertMaterial({ color: c.style === 'brickRed' ? 0x7d2f22 : 0xcdbd8a });
    const box = (min, max, mats, center) => {
      const store = min[1] < GROUND - 0.01;
      const geo = worldBox(min, max, {
        uvOrigin: store ? [c.x0, 0, c.z0] : [c.x0, GROUND, c.z0],
        tile: store ? { w: 6, h: GROUND } : c.tile,
        center,
      });
      return new THREE.Mesh(geo, mats ?? [store ? c.storeMat : c.facadeMat, c.roofMat, c.roofMat]);
    };
    // Remainder (east of the strip), with the sheared floors showing on its west face.
    const rest = new THREE.Group();
    rest.add(box([STRIP_X, 0, c.z0], [c.x1, GROUND, c.z1]));
    rest.add(box([STRIP_X, GROUND, c.z0], [c.x1, c.top, c.z1]));
    const cap = new THREE.Mesh(new THREE.BoxGeometry(c.x1 - STRIP_X + 0.35, 0.7, c.z1 - c.z0 + 0.7), cornice);
    cap.position.set((STRIP_X + c.x1 + 0.35) / 2, c.top + 0.35, (c.z0 + c.z1) / 2);
    rest.add(cap);
    const cut = new THREE.Mesh(new THREE.PlaneGeometry(c.z1 - c.z0, c.top), getInteriorMat());
    cut.material = cut.material.clone();
    cut.material.map = cut.material.map.clone();
    cut.material.map.repeat.set((c.z1 - c.z0) / 6, c.top / 3.2);
    cut.material.map.needsUpdate = true;
    cut.rotation.y = -Math.PI / 2;
    cut.position.set(STRIP_X - 0.02, c.top / 2, (c.z0 + c.z1) / 2);
    rest.add(cut);
    rest.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.customDepthMaterial = W.depthMat;
      }
    });
    scene.add(rest);
    own(rest);
    bake.addStaticBox([STRIP_X, 0, c.z0], [c.x1, 60, c.z1]);
    // Chunks: 2 across x 18..25, 5 along z, 4 layers (shop floor + 3 bands of floors).
    const xs = [c.x0, 21.5, STRIP_X];
    const zs = Array.from({ length: 6 }, (_, i) => c.z0 + ((c.z1 - c.z0) * i) / 5);
    const band = (c.top - GROUND) / 3;
    const ys = [0, GROUND, GROUND + band, GROUND + 2 * band, c.top];
    const grid = [];
    for (let ix = 0; ix < 2; ix++) {
      for (let iz = 0; iz < 5; iz++) {
        for (let iy = 0; iy < 4; iy++) {
          const min = [xs[ix], ys[iy], zs[iz]];
          const max = [xs[ix + 1], ys[iy + 1], zs[iz + 1]];
          const ctr = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
          const m = box(min, max, null, ctr);
          if (iy === 3) {
            const cc = new THREE.Mesh(new THREE.BoxGeometry(max[0] - min[0] + (ix === 0 ? 0.35 : 0), 0.7, max[2] - min[2] + (iz === 0 || iz === 4 ? 0.35 : 0)), cornice);
            cc.position.set(ix === 0 ? -0.17 : 0, max[1] - ctr[1] + 0.35, iz === 0 ? -0.17 : iz === 4 ? 0.17 : 0);
            m.add(cc);
          }
          m.position.set(...ctr);
          m.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              o.customDepthMaterial = W.depthMat;
            }
          });
          scene.add(m);
          own(m);
          W.reg(m);
          const half = [(max[0] - min[0]) / 2 - 0.02, (max[1] - min[1]) / 2 - 0.02, (max[2] - min[2]) / 2 - 0.02];
          const cell = { ix, iz, iy, m, piece: null };
          grid.push(cell);
          cell.piece = bake.addPiece(m, {
            half,
            mass: 3000 * (half[0] * half[1] * half[2]) / 40,
            trigger: 'kinematic',
            // Also falls as soon as the chunk under it has gone.
            alsoTrigger: (t) => {
              if (iy === 0) return false;
              const below = grid.find((g) => g.ix === ix && g.iz === iz && g.iy === iy - 1);
              return below?.piece.active && t > below.piece.activatedAt + 0.06;
            },
            inherit: 0.55,
            angularDamping: 0.1,
            damping: 0.02,
            // Never toward the camera side of the cross street.
            velClamp: { x: [-9, 0.4], y: [-30, 4] },
            kick: (b, r) => {
              b.velocity.x += r.range(-2.5, 0.6);
              b.velocity.y += r.range(0, 2.5);
              b.velocity.z += r.range(0, 2);
              b.angularVelocity.set(r.range(-1.5, 1.5), r.range(-0.8, 0.8), r.range(-1.5, 1.5));
            },
          });
          chunkPieces.push(cell.piece);
        }
      }
    }
    corners.push({ c, rest, grid });
  }

  // Keep debris in the intersection: an invisible stop across the cross street, well short of us.
  bake.addStaticBox([27.5, 0, 91], [29, 60, 109]);

  // ---- street furniture in the taxi's path near the intersection: knocked flying; elsewhere gone ------
  const sweep = { x0: -13.6, x1: 25.5 };
  const furn = [...W.furn.lamps, ...W.furn.trees];
  const furnPieces = [];
  for (const f of furn) {
    const p = f.position;
    if (p.x < sweep.x0 || p.x > sweep.x1 || p.z < 60 || p.z > 140) continue;
    const tree = W.furn.trees.includes(f);
    furnPieces.push({
      f,
      piece: bake.addPiece(f, {
        shapes: tree ? [{ half: [0.16, 1.3, 0.16], offset: [0, 1.3, 0] }, { half: [1.1, 0.9, 1.1], offset: [0, 3.7, 0] }] : [{ half: [0.13, 4, 0.13], offset: [0, 4, 0] }, { half: [1.2, 0.06, 0.06], offset: [-1.15, 7.9, 0] }],
        mass: tree ? 300 : 220,
        trigger: 'kinematic',
        inherit: 0.6,
        kick: (b, r) => b.angularVelocity.set(r.range(1.2, 2.2), r.range(-0.5, 0.5), r.range(-0.6, 0.6)),
      }),
    });
  }
  for (const s of W.furn.signals) {
    if (s.zc !== 100) continue;
    W.reg(s.group);
    furnPieces.push({
      f: s.group,
      piece: bake.addPiece(s.group, {
        shapes: [{ half: [0.17, 3.2, 0.17], offset: [0, 3.2, 0] }, { half: [4.8, 0.1, 0.1], offset: [-4.8, 5.8, 0] }],
        mass: 400,
        trigger: 'kinematic',
        inherit: 0.6,
        kick: (b) => b.angularVelocity.set(1.2, 0.3, 0),
      }),
    });
  }
  bake.bake();
  const act = chunkPieces.filter((p) => p.activatedAt !== null);
  console.log(`plow physics: ${act.length}/${chunkPieces.length} chunks, first ${Math.min(...act.map((p) => p.activatedAt)).toFixed(2)}`);
  if (new URLSearchParams(location.search).has('dbgchunks')) for (const tt of [42.5, 44.5]) console.log(tt, chunkPieces.map((p) => bake.positionAt(p, tt).toArray().map((x) => x.toFixed(0)).join(',')).join(' | '));

  // ---- dust: bursts at every chunk that breaks off, plus a rolling wall down the cross street -------
  const dust = new Dust(scene, { color: 0xb49a75, max: 360, opacity: 0.72 });
  dust.sprites.forEach(own);
  chunkPieces.forEach((p, i) => {
    if (p.activatedAt === null) return;
    const q = bake.positionAt(p, p.activatedAt);
    dust.emit({ t: p.activatedAt, pos: [q.x - 1, q.y, q.z + 2], count: 2, spread: [1.5, 1.5, 1.5], vel: [-1, 0.6, 3.5], velSpread: 1.2, size: 4, growth: 3.2, life: 8, rise: 0.3, seed: 600 + i, shade: [0.8, 1.05] });
  });
  // The shock: the moment the front bursts out of the corner's south face.
  let shockT = 41.8;
  for (let t = T0; t < T1; t += 0.01) {
    if (frontZ(t) >= 90.5) {
      shockT = Math.min(42.2, t);
      break;
    }
  }
  dust.emit({ t: shockT + 0.1, duration: 0.8, pos: [19, 1.5, 96], count: 22, spread: [4, 1.2, 4], vel: [4.2, 0.5, 2.2], velSpread: 1.2, size: 5, growth: 3.5, life: 7, rise: 0.25, drag: 0.35, seed: 700 });
  for (let i = 0; i < 6; i++) {
    const z = 60 + i * 15;
    const tz = (() => {
      for (let t = T0; t < T1; t += 0.05) if (frontZ(t) >= z) return t;
      return null;
    })();
    if (tz !== null) dust.emit({ t: tz, pos: [-11, 1.5, z], count: 3, spread: [2, 1, 3], vel: [-1.5, 0.4, 3], velSpread: 1, size: 4.5, growth: 3, life: 8, rise: 0.25, seed: 800 + i });
  }

  // ---- people fleeing east along the cross street -----------------------------------------------------
  const runners = [];
  for (let i = 0; i < 9; i++) {
    const south = i % 2 === 0;
    const w = walker(scene, rng, {
      points: [new THREE.Vector3(36 + i * 3.4, SIDEWALK_Y, south ? 107.4 : 92.6), new THREE.Vector3(160, SIDEWALK_Y, south ? 107.4 : 92.6)],
      speed: () => rng.range(4, 5),
      run: () => 1,
      t0: T0 - 1,
      t1: T1 + 1,
    });
    own(w.rig.root);
    runners.push(w);
  }

  // ---- camera ------------------------------------------------------------------------------------------
  const CX = 33.0;
  const CZ = 107.8;
  const fallT = shockT + 0.25;
  const landT = fallT + 0.45;
  const look = camPath([
    { t: T0, x: CX, y: 1.62, z: CZ, yaw: 0.8, pitch: 0.22, roll: 0 },
    { t: 40.2, yaw: 0.76, pitch: 0.3 },
    { t: shockT - 0.3, yaw: 0.6, pitch: 0.24 },
    { t: fallT, x: CX, y: 1.6, z: CZ, yaw: 0.52, pitch: 0.12, roll: 0 },
    { t: landT, x: CX - 0.32, y: 0.78, z: CZ - 0.5, yaw: 0.58, pitch: -0.95, roll: -0.12 },
    { t: landT + 0.25, y: 0.72, pitch: -0.82, roll: -0.08 },
    { t: 43.4, x: CX - 0.32, y: 0.76, z: CZ - 0.5, yaw: 0.66, pitch: -0.62, roll: -0.04 },
    { t: 44.3, y: 0.8, yaw: 0.56, pitch: 0.82, roll: 0.02 },
    { t: T1, y: 0.8, yaw: 0.5, pitch: 0.9, roll: 0.0 },
  ]);
  // Where the hands land: in front of the landing pose, on the pavement.
  const landPose = look(landT);
  const fwd = new THREE.Vector3(-Math.sin(landPose.yaw), 0, -Math.cos(landPose.yaw));
  const right = new THREE.Vector3(Math.cos(landPose.yaw), 0, -Math.sin(landPose.yaw));
  const handR = new THREE.Vector3(landPose.x, SIDEWALK_Y + 0.03, landPose.z).addScaledVector(fwd, 0.42).addScaledVector(right, 0.2);
  const handL = new THREE.Vector3(landPose.x, SIDEWALK_Y + 0.03, landPose.z).addScaledVector(fwd, 0.44).addScaledVector(right, -0.22);

  return {
    range: [T0, T1],
    objects: objs,
    update(t) {
      taxi.update(t);
      for (const c of Object.values(W.corners)) c.intact.visible = false;
      // Everything else the taxi sweeps through away from the intersection is already gone.
      W.crush(sweep.x0, sweep.x1, -500, 60);
      W.crush(sweep.x0, sweep.x1, 140, 600);
      for (const b of W.city.buildings) if (b.side > 0 && !b.back && b.x0 < sweep.x1 && b.z0 >= 60 && b.z1 <= 140 && b.cross === undefined) b.group.visible = false;
      bake.apply(t);
      dust.update(t);
      for (const w of runners) w.update(t);

      const p = look(t);
      applyCam(camera, p);
      drift(camera, t, 1, 19);
      const fz = frontZ(t);
      const near = 1 - smoothstep(10, 70, Math.abs(fz - CZ));
      shake(camera, t, 0.7 + 1.6 * near, { seed: 61, freq: 9, trans: 0.015 });
      const jolt = smoothstep(shockT, shockT + 0.06, t) * (1 - smoothstep(shockT + 0.1, shockT + 1.4, t));
      shake(camera, t, 4.5 * jolt, { seed: 63, freq: 17, trans: 0.03 });
      const thud = smoothstep(landT, landT + 0.04, t) * (1 - smoothstep(landT + 0.05, landT + 0.5, t));
      shake(camera, t, 3.0 * thud, { seed: 67, freq: 20, trans: 0.02 });

      // Hands: flinch up at the shock, thrown forward to break the fall, then planted on the ground.
      let rightT = null;
      let leftT = null;
      const flinch = smoothstep(shockT - 0.05, shockT + 0.2, t) * (1 - smoothstep(fallT, fallT + 0.2, t));
      if (flinch > 0.01) {
        rightT = { ...HANDS.shieldR, pos: [0.15, -0.05 - 0.4 * (1 - flinch), -0.4] };
        leftT = { ...HANDS.shieldL, pos: [-0.15, -0.07 - 0.4 * (1 - flinch), -0.4] };
      }
      if (t >= fallT) {
        const k = clamp((t - fallT) / (landT - fallT));
        camera.updateMatrixWorld(true);
        const reach = (target, sx) => {
          const air = new THREE.Vector3(sx * 0.2, -0.3, -0.45).applyMatrix4(camera.matrixWorld);
          return air.lerp(target, k * k);
        };
        rightT = { space: 'world', pos: reach(handR, 1).toArray(), palm: [0, -1, 0], fingers: fwd.clone().addScaledVector(right, 0.25).toArray(), curl: 0.1 };
        leftT = { space: 'world', pos: reach(handL, -1).toArray(), palm: [0, -1, 0], fingers: fwd.clone().addScaledVector(right, -0.25).toArray(), curl: 0.1 };
        if (t > 43.9) {
          rightT = null;
          leftT = null;
        }
      }
      fp.update(camera, { right: rightT, left: leftT });
      fp.placeBody(camera, t < fallT ? { mode: 'stand', groundY: SIDEWALK_Y, yaw: p.yaw, t } : { mode: 'hide' });

      W.setShadowFocus(10, 95, 55, 200, 40);
      const dusty = 0.8 + 0.2 * smoothstep(shockT, shockT + 2, t);
      scene.fog.color.lerp(new THREE.Color(0xbfa27c), dusty);
      scene.fog.density = lerp(0.0006, 0.0045, dusty);
      return {
        bloomThreshold: 1.7,
        bloomStrength: 0.35,
        tint: new THREE.Color(1, 1, 1).lerp(new THREE.Color(1.08, 0.97, 0.85), dusty),
        saturation: 1.04,
      };
    },
  };
}
