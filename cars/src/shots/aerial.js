// 0:56-1:01 (10,000x, ABOVE THE CLOUDS). Units are kilometres. The camera starts low over a
// low-poly Manhattan and is pushed back and up in proportion to the taxi as it grows, rising
// through the cloud layer; then an airliner with a contrail crosses below the roof line.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { makeSky, makeCloud } from '../kit/sky.js';
import { makeVehicle, placeVehicle } from '../kit/vehicles.js';
import { makeCamera, shake, drift } from '../kit/camrig.js';
import { Dust } from '../kit/fx.js';
import { carScale } from '../timeline.js';
import { lerp, smoothstep, clamp } from '../util.js';

const T0 = 56;
const T1 = 61;
const SUN = new THREE.Vector3(-0.45, 0.62, 0.62).normalize();
const AXIS = 0.5; // island axis yaw (radians)

function polygonMesh(points, y, color) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ShapeGeometry(shape, 4);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
  m.receiveShadow = true;
  return m;
}

// Island outline in its own frame (x across, z along; north = -z), roughly Manhattan's taper.
const ISLAND = [
  [-0.4, 10.8], [0.9, 9.6], [1.7, 7], [2.1, 3], [2.0, -2], [1.8, -6], [1.3, -9.5], [0.6, -11.4], [-0.3, -11.6],
  [-1.2, -9.8], [-1.7, -6.5], [-1.9, -2], [-1.8, 3], [-1.5, 7], [-1.0, 9.8],
];

export function buildAerialShot(ctx) {
  const scene = new THREE.Scene();
  const rng = makeRng(707);
  scene.fog = new THREE.FogExp2(0xa9c8e4, 0.0042);
  const sky = makeSky({ zenith: 0x1d58c8, horizon: 0xb3d3ef, ground: 0x7d9ab4, sunDir: SUN.toArray(), sunColor: 0xfff1d6, sunGlow: 0.3, horizonSharp: 0.45, radius: 500 });
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(0xbcd8f6, 0x6f7f74, 1.2));
  const sun = new THREE.DirectionalLight(0xfff2dc, 3.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera;
  sc.left = -55;
  sc.right = 55;
  sc.top = 55;
  sc.bottom = -55;
  sc.near = 1;
  sc.far = 260;
  sun.position.copy(SUN).multiplyScalar(130);
  scene.add(sun, sun.target);

  // ---- water, land, the island and its buildings ----------------------------------------------------
  const world = new THREE.Group();
  world.rotation.y = AXIS;
  scene.add(world);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: 0x3d79b0 }));
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  scene.add(water);
  world.add(polygonMesh([[-60, -80], [-3.2, -60], [-2.6, -12], [-2.4, 2], [-2.8, 12], [-60, 40]], 0.02, 0x8d9a7c)); // west shore
  world.add(polygonMesh([[2.6, -14], [3.1, -2], [3.4, 6], [3.0, 14], [12, 30], [80, 40], [80, -80], [9, -30]], 0.02, 0x93a07f)); // east shore
  world.add(polygonMesh([[-3, -60], [1.0, -13.2], [4, -16], [30, -80]], 0.02, 0x8f9c7a)); // north
  const LAND = 0.03; // km: the island surface sits 30 m above the water
  const island = polygonMesh(ISLAND, LAND, 0xb3ab9c);
  world.add(island);

  const park = polygonMesh([[-0.7, -3.6], [0.4, -3.4], [0.6, -7.2], [-0.5, -7.4]], LAND + 0.004, 0x5f9a4a);
  world.add(park);
  // Buildings: instanced boxes on the island, taller in midtown and downtown.
  const NB = 2600;
  const bmesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), NB);
  const bpal = [0xd8cfb8, 0xc9b28a, 0x9a4a36, 0xb7b9bd, 0x7fa9c9, 0x8fc3c6, 0xe2ddd2, 0x6f7a86];
  const inIsland = (x, z) => {
    let inside = false;
    for (let i = 0, j = ISLAND.length - 1; i < ISLAND.length; j = i++) {
      const [xi, zi] = ISLAND[i];
      const [xj, zj] = ISLAND[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  const builds = [];
  const m4 = new THREE.Matrix4();
  const c = new THREE.Color();
  while (builds.length < NB) {
    const x = rng.range(-2.1, 2.1);
    const z = rng.range(-11.6, 10.8);
    if (!inIsland(x, z) || (x > -0.7 && x < 0.6 && z < -3.4 && z > -7.4)) continue;
    const mid = Math.exp(-Math.pow((z + 1.5) / 2.2, 2)) + 0.8 * Math.exp(-Math.pow((z - 8.8) / 1.2, 2));
    const h = (0.02 + rng.next() * 0.06 + mid * rng.next() * 0.28) * (rng.chance(0.04) ? 1.8 : 1);
    const w = rng.range(0.05, 0.11);
    builds.push({ x, z, h, w, d: rng.range(0.05, 0.11) });
    bmesh.setColorAt(builds.length - 1, c.setHex(rng.pick(bpal)));
  }
  bmesh.castShadow = true;
  bmesh.receiveShadow = true;
  world.add(bmesh);

  // ---- clouds -------------------------------------------------------------------------------------------
  const clouds = new THREE.Group();
  for (let i = 0; i < 520; i++) {
    const cl = makeCloud(rng, rng.range(0.6, 1.6), 0xffffff);
    const r = 4 + Math.sqrt(rng.next()) * (i < 300 ? 55 : 120);
    const a = rng.range(0, Math.PI * 2);
    cl.position.set(Math.cos(a) * r, rng.range(1.8, 3.0), Math.sin(a) * r);
    cl.scale.y = 0.6;
    cl.rotation.y = rng.range(0, 3);
    cl.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    clouds.add(cl);
  }
  scene.add(clouds);

  // ---- the taxi (scaled metres -> km) ------------------------------------------------------------------------
  const v = makeVehicle('taxi');
  scene.add(v.group);
  const heading = AXIS + Math.PI; // facing down the island
  const dust = new Dust(scene, { color: 0xb59c7a, max: 60, opacity: 0.55 });
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1;
    const sz = i < 2 ? 1 : -1;
    dust.emit({ t: T0, duration: 2.5, pos: [0, 0.3, 0], count: 10, spread: [1, 0.2, 1], vel: [0, 0.1, 0], velSpread: 0.15, size: 1.2, growth: 0.6, life: 6, rise: 0.05, seed: 30 + i });
    dust.specs.slice(-10).forEach((sp) => sp.p.set(sx, 0.2, sz));
  }

  // ---- airliner with a contrail -----------------------------------------------------------------------------
  const plane = new THREE.Group();
  {
    const white = new THREE.MeshLambertMaterial({ color: 0xf4f5f6 });
    const grey = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
    const add = (geo, m, x, y, z) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      plane.add(mesh);
      return mesh;
    };
    add(new THREE.BoxGeometry(0.0042, 0.0045, 0.062), white, 0, 0, 0);
    add(new THREE.BoxGeometry(0.06, 0.0008, 0.011), grey, 0, -0.0008, 0.002);
    add(new THREE.BoxGeometry(0.022, 0.0007, 0.006), grey, 0, 0.001, -0.027);
    add(new THREE.BoxGeometry(0.0007, 0.01, 0.008), white, 0, 0.005, -0.027);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.0035, 0.0035, 0.008), grey, sx * 0.011, -0.003, 0.006);
  }
  scene.add(plane);
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xf6f8fb, transparent: true, opacity: 0.75, depthWrite: false, fog: true });
  const trails = [-1, 1].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0, -0.5), trailMat);
    scene.add(m);
    return m;
  });

  // ---- camera ---------------------------------------------------------------------------------------------------
  const camera = makeCamera(66, 0.004, 700);
  const carDir = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)); // car forward (world)
  const side = new THREE.Vector3(carDir.z, 0, -carDir.x); // car's left-hand side
  // Viewing direction from the car: three-quarter front, from its left side.
  const viewDir = side.clone().multiplyScalar(0.8).addScaledVector(carDir, 0.6).normalize();
  const planeFrom = new THREE.Vector3();
  const planeTo = new THREE.Vector3();

  return {
    ownScene: true,
    scene,
    camera,
    clearColor: 0x9cc2e6,
    range: [T0, T1],
    objects: [],
    update(t) {
      const s = carScale(t);
      const L = 4.6e-3 * s; // km
      placeVehicle(v, 0, LAND, 0, heading, s / 1000);
      // Hide buildings under the car's footprint.
      const half = { w: (1.84e-3 * s) / 2 + 0.02, l: L / 2 + 0.02 };
      const rel = AXIS - heading;
      builds.forEach((b, i) => {
        // Building position in the car's frame (both live in the rotated island frame).
        const lx = b.x * Math.cos(rel) - b.z * Math.sin(rel);
        const lz = b.x * Math.sin(rel) + b.z * Math.cos(rel);
        const crushed = Math.abs(lx) < half.w && Math.abs(lz) < half.l;
        m4.compose(new THREE.Vector3(b.x, LAND, b.z), new THREE.Quaternion(), crushed ? new THREE.Vector3(1e-5, 1e-5, 1e-5) : new THREE.Vector3(b.w, b.h, b.d));
        bmesh.setMatrixAt(i, m4);
      });
      bmesh.instanceMatrix.needsUpdate = true;
      dust.specs.forEach((sp, i) => {
        const k = Math.floor(i / 10);
        const sx = k % 2 ? 1 : -1;
        const sz = k < 2 ? 1 : -1;
        const local = new THREE.Vector3(sx * 0.8 * 0.92e-3 * s, 0.2, sz * 0.5 * L * 0.6);
        sp.p.copy(local.applyAxisAngle(new THREE.Vector3(0, 1, 0), heading)).add(new THREE.Vector3(((i * 37) % 7) * 0.1, 0, ((i * 53) % 5) * 0.1));
      });
      dust.update(t);
      dust.sprites.forEach((sp) => sp.scale.multiplyScalar(Math.max(0.3, L / 8)));

      // Camera distance tracks the car's size while it grows, then settles and drifts.
      const Lc = Math.min(L, 46);
      const D = 1.5 * Lc;
      const height = lerp(0.5, 10.4, clamp(Math.log(Lc / 0.9) / Math.log(46 / 0.9)));
      const drift1 = (t - T0) * 0.6;
      const pos = viewDir.clone().multiplyScalar(D).addScaledVector(carDir.clone().multiplyScalar(-1), drift1 * (Lc / 46));
      camera.position.set(pos.x, height, pos.z);
      camera.near = Math.max(0.004, height * 0.02); camera.updateProjectionMatrix();
      const target = new THREE.Vector3(0, 0.42 * 1.52e-3 * s, 0).addScaledVector(carDir, -0.1 * L);
      target.y = lerp(target.y, height - 0.6, smoothstep(57.2, 58.5, t));
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      drift(camera, t, 1.0, 81);
      shake(camera, t, 0.35 * (1 - smoothstep(56.6, 57.8, t)), { seed: 83, freq: 5 });
      camera.updateMatrixWorld(true);

      // The airliner: level at about the camera's height, crossing in front, under the roof line.
      const pt = clamp((t - 57.6) / (T1 - 57.6));
      const camR = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).setY(0).normalize();
      const camF = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).setY(0).normalize();
      planeFrom.copy(camera.position).addScaledVector(camF, 0.6).addScaledVector(camR, -0.3);
      planeTo.copy(camera.position).addScaledVector(camF, 0.66).addScaledVector(camR, 0.24);
      planeFrom.y = planeTo.y = height + 0.024;
      plane.position.lerpVectors(planeFrom, planeTo, pt);
      plane.lookAt(planeTo.clone().addScaledVector(planeTo.clone().sub(planeFrom), 1));
      plane.visible = t > 57.4;
      const along = planeTo.clone().sub(planeFrom).normalize();
      const trailLen = 0.35 + 1.6 * pt;
      trails.forEach((tr, i) => {
        const offset = new THREE.Vector3(along.z, 0, -along.x).multiplyScalar((i ? 1 : -1) * 0.011);
        tr.position.copy(plane.position).add(offset).addScaledVector(along, -0.012);
        tr.quaternion.copy(plane.quaternion);
        tr.scale.set(0.0028, 0.0028, trailLen * 0.6);
        tr.visible = plane.visible;
      });

      sun.target.position.set(0, 0, 0);
      sun.target.updateMatrixWorld();
      sc.updateProjectionMatrix();
      return { bloomThreshold: 1.6, bloomStrength: 0.4, exposure: 1.0, saturation: 1.08, grain: 0.012 };
    },
  };
}
