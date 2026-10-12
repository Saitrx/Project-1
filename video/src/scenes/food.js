// 0:54-1:00  DAY 30. Self-driving tractors parked in empty fields; empty grocery shelves.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeRng } from '../rng.js';
import { makeSky, makeEnvironment, makeCloud } from '../kit/sky.js';
import { canvasTexture } from '../kit/textures.js';
import { makeTree } from '../kit/city.js';
import { makeCharacter, bakeMotion, driveCharacter, SKIN, HAIR } from '../kit/character.js';
import { handheld, makeCamera } from '../kit/camera.js';
import { sunShadow, castShadows } from '../kit/shadows.js';
import { ease, lerp, smoothstep } from '../util.js';

const CUT = 3.0;

function fieldTexture() {
  // Furrows of bare soil with a little stubble: one tile = 8 rows.
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#7a5f3e';
    g.fillRect(0, 0, w, h);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const y = (i * h) / n;
      g.fillStyle = '#8f7349';
      g.fillRect(0, y, w, h / n / 2);
      g.fillStyle = '#a08a52';
      g.fillRect(0, y + h / n / 2 - 6, w, 6);
    }
  }, { repeat: [4, 60] });
}

function makeTractor(rng) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: 0x3f7f45, roughness: 0.45, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.6, metalness: 0.3 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.1, 3.6, 2, 0.12), paint);
  body.position.set(0, 1.45, 0.3);
  g.add(body);
  const hood = new THREE.Mesh(new RoundedBoxGeometry(1.2, 0.8, 1.8, 2, 0.12), paint);
  hood.position.set(0, 1.35, 2.2);
  g.add(hood);
  const rear = new THREE.CylinderGeometry(0.95, 0.95, 0.6, 28);
  const front = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 24);
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(rear, tire);
    r.rotation.z = Math.PI / 2;
    r.position.set(sx * 1.15, 0.95, -0.6);
    g.add(r);
    const f = new THREE.Mesh(front, tire);
    f.rotation.z = Math.PI / 2;
    f.position.set(sx * 0.85, 0.55, 2.3);
    g.add(f);
  }
  // Sensor mast instead of a cab: no driver needed.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 10), dark);
  mast.position.set(0, 2.5, 0.1);
  g.add(mast);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.3, 20), dark);
  dome.position.set(0, 3.1, 0.1);
  g.add(dome);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.12, 0.03) }));
  led.position.set(0, 1.62, 2.1 + 0.9);
  g.add(led);
  return g;
}

function buildField(ctx, rng) {
  const scene = new THREE.Scene();
  const ZEN = 0x9cb9d6;
  const HOR = 0xf8c286;
  scene.add(makeSky({ zenith: ZEN, horizon: HOR, ground: 0x6a5a44, sunDir: [-0.8, 0.12, -0.6], sunColor: 0xffc27a, sunGlow: 0.9, horizonSharp: 0.9 }));
  scene.fog = new THREE.FogExp2(0xeab57e, 0.0011);
  scene.environment = makeEnvironment(ctx.renderer, { zenith: ZEN, horizon: HOR, ground: 0x5a4a38, intensity: 1.0 });
  scene.add(new THREE.HemisphereLight(0xcfdcf0, 0x6a5238, 0.9));
  const sun = new THREE.DirectionalLight(0xffcf96, 1.8);
  sun.position.set(-80, 18, -60);
  scene.add(sun);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(600, 900), new THREE.MeshLambertMaterial({ map: fieldTexture() }));
  field.rotation.x = -Math.PI / 2;
  field.rotation.z = 0.35;
  field.position.set(0, 0, -300);
  scene.add(field);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshLambertMaterial({ color: 0x8a8a52 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.3;
  scene.add(grass);
  // Rolling hills on the horizon.
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x7d8a58, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), hillMat);
    h.scale.set(rng.range(150, 260), rng.range(25, 50), rng.range(90, 140));
    h.position.set(-800 + i * 200 + rng.range(-40, 40), -6, rng.range(-900, -750));
    scene.add(h);
  }
  // Farm buildings: silo and barn.
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 22, 24), new THREE.MeshLambertMaterial({ color: 0xc9c5bc }));
  silo.position.set(70, 11, -260);
  const siloTop = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x9aa0a6 }));
  siloTop.position.set(70, 22, -260);
  const barn = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 14), new THREE.MeshLambertMaterial({ color: 0x8c3a2e }));
  barn.position.set(48, 5, -265);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 9.5, 24, 4, 1), new THREE.MeshLambertMaterial({ color: 0x4a4a4e }));
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.75);
  roof.position.set(48, 12.5, -265);
  scene.add(silo, siloTop, barn, roof);
  for (let i = 0; i < 26; i++) {
    const t = makeTree(rng, rng.range(2.2, 3.2));
    t.position.set(-260 + i * 22 + rng.range(-6, 6), 0, -330 + rng.range(-10, 10));
    scene.add(t);
  }
  for (let i = 0; i < 6; i++) {
    const c = makeCloud(rng, rng.range(16, 28), 0xfff1e0);
    c.position.set(rng.range(-500, 500), rng.range(120, 200), rng.range(-1100, -800));
    scene.add(c);
  }
  const tractors = [];
  for (let i = 0; i < 3; i++) {
    const tr = makeTractor(rng);
    tr.position.set(-7 + i * 6.5, 0, -18 - i * 4);
    tr.rotation.y = 0.55 + i * 0.04;
    scene.add(tr);
    tractors.push(tr);
  }
  sunShadow(scene, sun, { cx: 0, cz: -22, size: 30 });
  field.receiveShadow = true;
  for (const tr of tractors) castShadows(tr);

  const camera = makeCamera(THREE, 48, 0.1, 6000);
  return {
    scene,
    camera,
    update(t) {
      const p = ease('sine.inOut', -0.3, CUT + 0.3, t);
      camera.position.set(lerp(-14, -9, p), 2.3, lerp(6, 3, p));
      camera.lookAt(lerp(-1, 1, p), 2.0, -24);
      handheld(camera, t, { amp: 0.6, seed: 111 });
    },
  };
}

function shelfTexture() {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = '#d7d9dc';
    g.fillRect(0, 0, w, h);
    for (let x = 16; x < w; x += 96) {
      g.fillStyle = '#f1d34a';
      g.fillRect(x, 30, 60, 60);
      g.fillStyle = '#2b2d30';
      g.fillRect(x + 8, 46, 44, 8);
      g.fillRect(x + 8, 62, 30, 8);
    }
  }, { repeat: [6, 1] });
}

function buildStore(ctx, rng) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2c2e);
  scene.fog = new THREE.Fog(0x3a3c3e, 10, 46);
  scene.environment = makeEnvironment(ctx.renderer, { zenith: 0xd8dade, horizon: 0x9a9ca0, ground: 0x5a5a58, intensity: 0.7 });
  scene.add(new THREE.HemisphereLight(0xf2f4f6, 0x5c5a56, 0.55));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 80), new THREE.MeshStandardMaterial({ color: 0xc3c0b8, roughness: 0.25, metalness: 0.0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -25;
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 80), new THREE.MeshLambertMaterial({ color: 0xd9d8d4 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 4.6, -25);
  scene.add(ceil);
  // Ceiling light panels: some still on, some dark (motivated, soft light only).
  for (let z = 2; z > -60; z -= 4) {
    const on = rng.next() > 0.35;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.4), new THREE.MeshBasicMaterial({ color: on ? new THREE.Color(2.6, 2.6, 2.5) : new THREE.Color(0.35, 0.35, 0.36) }));
    p.rotation.x = Math.PI / 2;
    p.position.set(0, 4.58, z);
    scene.add(p);
    if (on && z > -30) {
      const l = new THREE.PointLight(0xf4f6ff, 9, 12, 1.6);
      l.position.set(0, 4.2, z);
      scene.add(l);
    }
  }
  const metal = new THREE.MeshStandardMaterial({ color: 0xc8cacd, roughness: 0.45, metalness: 0.5 });
  const backMat = new THREE.MeshLambertMaterial({ color: 0xe4e2dc });
  const tagMat = new THREE.MeshLambertMaterial({ map: shelfTexture() });
  const itemColors = [0xd8492f, 0x3b7dd8, 0xf2c94c, 0x5aa65c, 0xe8e2d0];
  for (const side of [-1, 1]) {
    const x = side * 1.75;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 56), backMat);
    back.position.set(x + side * 0.55, 1.15, -26);
    scene.add(back);
    for (let k = 0; k < 5; k++) {
      const y = 0.15 + k * 0.48;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 56), metal);
      shelf.position.set(x + side * 0.05, y, -26);
      scene.add(shelf);
      const tags = new THREE.Mesh(new THREE.PlaneGeometry(56, 0.07), tagMat);
      tags.rotation.y = -side * Math.PI / 2;
      tags.position.set(x - side * 0.46, y - 0.02, -26);
      scene.add(tags);
      // A few leftover items, very sparse.
      for (let z = 0; z > -54; z -= rng.range(5, 14)) {
        if (rng.next() > 0.45) continue;
        const it = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.16), new THREE.MeshLambertMaterial({ color: rng.pick(itemColors) }));
        it.position.set(x + side * 0.1, y + 0.16, z);
        it.rotation.y = rng.range(-0.3, 0.3);
        scene.add(it);
      }
    }
    for (let z = 2; z > -56; z -= 3.5) {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 0.06), metal);
      up.position.set(x - side * 0.45, 1.15, z);
      scene.add(up);
    }
  }
  const mom = makeCharacter({ kind: 'woman', shirt: 0x7a5c8f, skirt: 0x6b5f80, hair: HAIR[2], skin: SKIN[1] });
  const son = makeCharacter({ kind: 'boy', shirt: 0x3aa0e0, pants: 0x2b3446, hair: HAIR[2], skin: SKIN[1] });
  scene.add(mom.root, son.root);
  // Empty shopping basket in mom's right hand.
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0xc23b2f, roughness: 0.5 }));
  basket.position.set(0, -mom.dims.fore - 0.2, 0);
  mom.arms.find((a) => a.side < 0).elbow.add(basket);
  const pathM = new THREE.CatmullRomCurve3([new THREE.Vector3(0.35, 0, -1.5), new THREE.Vector3(0.3, 0, -8), new THREE.Vector3(0.4, 0, -16)]);
  const pathS = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.45, 0, -1.2), new THREE.Vector3(-0.55, 0, -8), new THREE.Vector3(-0.5, 0, -16)]);
  const mM = bakeMotion(mom, { path: pathM, speed: () => 0.85, t0: CUT - 0.6, t1: 7 });
  const mS = bakeMotion(son, { path: pathS, speed: () => 0.85, t0: CUT - 0.6, t1: 7 });
  const camera = makeCamera(THREE, 50, 0.05, 200);
  return {
    scene,
    camera,
    update(t) {
      driveCharacter(mom, mM, t, { lookSide: Math.sin(t * 0.8) * 0.35 });
      driveCharacter(son, mS, t, { lookSide: -0.5 + Math.sin(t * 0.6) * 0.2, lookUp: 0.1 });
      const lt = t - CUT;
      camera.position.set(0.1, 1.55, lerp(2.8, 0.4, ease('sine.inOut', -0.4, 3.2, lt)));
      camera.lookAt(0, 1.2, -20);
      handheld(camera, t, { amp: 0.7, seed: 113 });
    },
  };
}

export async function build(ctx) {
  const rng = makeRng(1212);
  const field = buildField(ctx, rng);
  const store = buildStore(ctx, rng);
  const fieldShot = { scene: field.scene, camera: field.camera, post: { bloomStrength: 0.4, bloomThreshold: 1.4, exposure: 1.0, lift: 0.04, saturation: 0.95, soft: [0.8, 0.22, 0.65] } };
  const storeShot = { scene: store.scene, camera: store.camera, post: { bloomStrength: 0.3, bloomThreshold: 1.2, exposure: 1.1, lift: 0.04, saturation: 0.88, soft: [0.86, 0.18, 0.5] } };
  return {
    shotsAt(t) {
      const h = 0.2;
      const list = [];
      if (t < CUT + h) {
        field.update(t);
        list.push({ shot: fieldShot, w: 1 - smoothstep(CUT - h, CUT + h, t) });
      }
      if (t > CUT - h) {
        store.update(t);
        list.push({ shot: storeShot, w: smoothstep(CUT - h, CUT + h, t) });
      }
      return list;
    },
  };
}
