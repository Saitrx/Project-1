// The shared street world: city, sky, sun, furniture, hero storefront pieces and helpers that every
// street shot uses. Objects that shots move or break register a default pose and are reset first
// on every frame, so each frame is a pure function of time.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { makeSky, makeCloud } from '../kit/sky.js';
import { buildCity, makeTree, makeHydrant, makeLamp, makeTrashCan, makeHotDogCart, makeManhole, makeSignal, AVE, STREETS, STREET_HALF, SIDEWALK_Y } from '../kit/nyc.js';
import { worldBox, Batch } from '../kit/geom.js';
import { facadeTex, storefrontTex } from '../kit/nyctex.js';
import { FPRig } from '../kit/fprig.js';
import { makeCamera } from '../kit/camrig.js';

export const SUN_DIR = new THREE.Vector3(-0.45, 0.62, 0.62).normalize();
export const HERO_CORNERS = {
  NE: { x0: 18, x1: 44, z0: 66, z1: 91, style: 'brickRed', floors: 6, strip: 25 },
  SE: { x0: 18, x1: 46, z0: 109, z1: 135, style: 'stone', floors: 7, strip: 25 },
};
const FLOOR = 3.2;
const GROUND = 4.4;

function lam(color) {
  return new THREE.MeshLambertMaterial({ color });
}

export function buildWorld(ctx) {
  const scene = new THREE.Scene();
  const rng = makeRng(2024);
  const sky = makeSky({ zenith: 0x1f5fd0, horizon: 0xa6d2f2, ground: 0x8f8a80, sunDir: SUN_DIR.toArray(), sunColor: 0xfff1d6, sunGlow: 0.35, horizonSharp: 0.42, radius: 5000 });
  // Drawn after all opaque geometry so covered pixels are never shaded twice.
  sky.renderOrder = 1000;
  scene.add(sky);
  scene.fog = new THREE.FogExp2(0xb7d2ec, 0.0006);
  const hemi = new THREE.HemisphereLight(0xb4d4f6, 0x8f8576, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2dc, 3.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  scene.add(sun, sun.target);
  for (let i = 0; i < 14; i++) {
    const c = makeCloud(rng, rng.range(30, 60), 0xffffff);
    c.position.set(rng.range(-900, 900), rng.range(380, 620), rng.range(-2600, 600));
    scene.add(c);
  }

  const city = buildCity({
    seed: 77,
    heroRange: [-40, 170],
    reserved: [
      { side: 1, z0: HERO_CORNERS.NE.z0, z1: HERO_CORNERS.NE.z1 },
      { side: 1, z0: HERO_CORNERS.SE.z0, z1: HERO_CORNERS.SE.z1 },
    ],
  });
  scene.add(city.root);

  const resettable = [];
  const reg = (obj) => {
    obj.userData.home = { p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone(), v: true };
    resettable.push(obj);
    return obj;
  };
  const add = (obj) => {
    scene.add(obj);
    return reg(obj);
  };

  // ---- hero corner buildings (intact versions; shots may swap in chunked versions) -----------------
  const corners = {};
  for (const [key, c] of Object.entries(HERO_CORNERS)) {
    const st = facadeTex(c.style === 'brickRed' ? 'brickRed' : 'stone', {});
    const map = st.clone();
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.needsUpdate = true;
    const tile = c.style === 'brickRed' ? { w: 6, h: 4 * FLOOR } : { w: 12, h: 4 * FLOOR };
    const facadeMat = new THREE.MeshLambertMaterial({ map });
    const store = storefrontTex(key === 'NE' ? 'store0' : 'store1', {}).clone();
    store.wrapS = store.wrapT = THREE.RepeatWrapping;
    store.needsUpdate = true;
    const storeMat = new THREE.MeshLambertMaterial({ map: store });
    const roof = city.materials.roofMat;
    const top = GROUND + c.floors * FLOOR;
    const batch = new Batch();
    batch.add(worldBox([c.x0, 0, c.z0], [c.x1, GROUND, c.z1], { uvOrigin: [c.x0, 0, c.z0], tile: { w: 6, h: GROUND } }), [storeMat, roof, roof]);
    batch.add(worldBox([c.x0, GROUND, c.z0], [c.x1, top, c.z1], { uvOrigin: [c.x0, GROUND, c.z0], tile }), [facadeMat, roof, roof]);
    batch.add(new THREE.BoxGeometry(c.x1 - c.x0 + 0.7, 0.7, c.z1 - c.z0 + 0.7).translate((c.x0 + c.x1) / 2, top + 0.35, (c.z0 + c.z1) / 2), lam(c.style === 'brickRed' ? 0x7d2f22 : 0xcdbd8a));
    const intact = batch.build();
    scene.add(intact);
    corners[key] = { ...c, top, intact, facadeMat, storeMat, tile, roofMat: roof };
  }

  // ---- furniture --------------------------------------------------------------------------------------
  const furn = { trees: [], lamps: [], hydrants: [], trash: [], signals: [], manholes: [], parked: [] };
  const nearStreets = STREETS.filter((z) => z >= -300 && z <= 300);
  for (let i = 0; i < STREETS.length - 1; i++) {
    const za = STREETS[i + 1] + STREET_HALF;
    const zb = STREETS[i] - STREET_HALF;
    if (zb < -420 || za > 320) continue;
    for (const side of [1, -1]) {
      // Trees on the curb strip, skipping the corners and the wake-up hydrant zone.
      for (let z = za + 7; z < zb - 5; z += 12) {
        if (side > 0 && z > 10 && z < 36) continue;
        if (side < 0 && za === -91) continue; // no trees on that west block (cars pass close)
        const t = makeTree(rng);
        t.position.set(side * 12.9, SIDEWALK_Y - 0.15, z + rng.range(-1, 1));
        furn.trees.push(add(t));
      }
      for (const z of [za + 3.5, (za + zb) / 2 + 4, zb - 3.5]) {
        const l = makeLamp();
        l.position.set(side * 12.45, SIDEWALK_Y, z);
        l.rotation.y = side > 0 ? 0 : Math.PI;
        furn.lamps.push(add(l));
      }
    }
  }
  // Specific props around the wake-up block.
  const hydrant = makeHydrant();
  hydrant.position.set(12.75, SIDEWALK_Y, 28.4);
  furn.hydrants.push(add(hydrant));
  const hydrant2 = makeHydrant();
  hydrant2.position.set(16.6, SIDEWALK_Y, 64);
  furn.hydrants.push(add(hydrant2));
  const cart = makeHotDogCart();
  cart.position.set(13.3, SIDEWALK_Y, 35);
  cart.rotation.y = Math.PI / 2;
  furn.cart = add(cart);
  for (const [x, z] of [[13.35, 25], [-13.35, 14], [13.35, -14.5], [-13.35, 47]]) {
    const tc = makeTrashCan();
    tc.position.set(x, SIDEWALK_Y, z);
    furn.trash.push(add(tc));
  }
  // Traffic signals at the near intersections: SE corner arm over the northbound lanes,
  // NW corner arm over the southbound lanes.
  for (const zc of nearStreets) {
    for (const [sx, sz] of [[1, 1], [-1, -1]]) {
      const s = makeSignal({ arm: 9.6, height: 5.8, heads: [3.4, 6.8] });
      const g = new THREE.Group();
      g.position.set(sx * 12.6, SIDEWALK_Y, zc + sz * 10.5);
      g.rotation.y = sx > 0 ? 0 : Math.PI;
      g.add(s.pole, s.arm, ...s.heads);
      scene.add(g);
      furn.signals.push({ group: g, ...s, x: sx * 12.6, z: zc + sz * 10.5, side: sx, zc });
    }
  }
  for (const [x, z] of [[5.95, 33.5], [-4.2, 60], [1.5, -40], [6, -2]]) {
    const m = makeManhole();
    m.position.set(x, 0.02, z);
    furn.manholes.push(add(m));
  }

  // ---- hero storefront dressing (awnings, signs, display windows) -----------------------------------
  const hero = { awnings: [], signs: [], panes: [] };
  for (const a of city.hero.awnings) {
    // Each awning is split into 1.25 m wide panels so it can tear apart.
    const n = Math.max(2, Math.round((a.z1 - a.z0) / 1.25));
    const pw = (a.z1 - a.z0) / n;
    const mat = lam(a.color);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.1, pw * 0.98), mat);
      m.position.set(a.fx - a.side * 0.82, 3.33, a.z0 + pw * (i + 0.5));
      m.rotation.z = a.side * 0.32;
      m.castShadow = true;
      m.receiveShadow = true;
      hero.awnings.push(add(m));
      m.userData.side = a.side;
    }
  }
  const signArmMat = lam(0x202224);
  for (const s of city.hero.signs) {
    const g = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), signArmMat);
    arm.position.set(-s.side * 0.6 + 0, 0.6, 0);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.1), s.mat);
    board.position.set(-s.side * 0.95, 0, 0);
    g.add(arm, board);
    g.position.set(s.fx, 5.0, s.z);
    g.traverse((o) => o.isMesh && (o.castShadow = true));
    hero.signs.push(add(g));
    g.userData.side = s.side;
  }
  // Display windows: separate panes in front of the storefront texture on the hero block (east and
  // west sides of z in [9, 91]) so they can burst.
  const paneMat = new THREE.MeshLambertMaterial({ color: 0x2a3a4d, transparent: true, opacity: 0.92 });
  for (const b of city.buildings) {
    if (b.back || b.cross !== undefined) continue;
    if (!(b.z0 >= 9 && b.z1 <= 91)) continue;
    const fx = b.side * AVE.face;
    for (let z = b.z0 + 1.2; z + 3.2 < b.z1; z += 6) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.7, 3.3), paneMat);
      m.position.set(fx - b.side * 0.05, 2.55, z + 1.7);
      m.castShadow = false;
      hero.panes.push(add(m));
      m.userData.side = b.side;
    }
  }

  const camera = makeCamera(66, 0.03, 9000);
  const fp = new FPRig(scene);

  // Shadow box around the action: only a short slab along the sun direction is rendered, which
  // keeps the shadow pass cheap (far buildings along the sun ray are not drawn into the map).
  function setShadowFocus(x, z, half = 45, up = 150, down = 25) {
    sun.target.position.set(x, 0, z);
    sun.position.set(x, 0, z).addScaledVector(SUN_DIR, 400);
    const c = sun.shadow.camera;
    c.left = -half;
    c.right = half;
    c.top = half;
    c.bottom = -half;
    c.near = 400 - up;
    c.far = 400 + down;
    c.updateProjectionMatrix();
    sun.target.updateMatrixWorld();
  }

  const FOG = { color: new THREE.Color(0xb7d2ec), density: 0.0006 };
  function resetAll() {
    scene.fog.color.copy(FOG.color);
    scene.fog.density = FOG.density;
    for (const o of resettable) {
      const h = o.userData.home;
      o.position.copy(h.p);
      o.quaternion.copy(h.q);
      o.scale.copy(h.s);
      o.visible = h.v;
    }
    for (const s of furn.signals) {
      s.group.visible = true;
    }
    for (const b of city.buildings) {
      b.group.visible = true;
      for (const e of b.extras) e.visible = true;
    }
    for (const c of Object.values(corners)) c.intact.visible = true;
  }

  // Hide every building whose footprint overlaps the rectangle (giant-car shots).
  function crush(x0, x1, z0, z1) {
    for (const b of city.buildings) {
      if (b.x1 > x0 && b.x0 < x1 && b.z1 > z0 && b.z0 < z1) {
        b.group.visible = false;
        for (const e of b.extras) e.visible = false;
      }
    }
    for (const c of Object.values(corners)) if (c.x1 > x0 && c.x0 < x1 && c.z1 > z0 && c.z0 < z1) c.intact.visible = false;
    for (const o of resettable) {
      const p = o.position;
      if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) o.visible = false;
    }
    for (const s of furn.signals) if (s.x > x0 && s.x < x1 && s.z > z0 && s.z < z1) s.group.visible = false;
  }

  return { scene, camera, sun, hemi, sky, city, furn, hero, corners, fp, reg, add, resetAll, crush, setShadowFocus };
}
