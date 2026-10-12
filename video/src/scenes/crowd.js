// 0:46-0:51  DAY 20. Top-down shot of a crowd in a city square, zooming out to the whole planet.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { makeSky, makeStars, makeEnvironment } from '../kit/sky.js';
import { makeCity, makeFacadeSet, makeTree, asphaltTexture } from '../kit/city.js';
import { canvasTexture } from '../kit/textures.js';
import { makeCharacter, setPose, bakeMotion, driveCharacter, SKIN, HAIR } from '../kit/character.js';
import { makeEarth, lonLatToVec3 } from '../kit/earth.js';
import { makeCamera } from '../kit/camera.js';
import { sunShadow, castShadows } from '../kit/shadows.js';
import { fbm1 } from '../rng.js';
import { ease, lerp, smoothstep, clamp } from '../util.js';

const CUT = 3.05;
const SHIRTS = [0x3aa0e0, 0xd9762b, 0xf2c94c, 0x3e8f8a, 0xc0392b, 0x8e6bbf, 0x6f8f3c, 0xe8e2d0, 0x2f5d8c, 0xd35f8d];
const PANTS = [0x1e2a44, 0x5a2a24, 0x2b2b30, 0x3b4a5c, 0x6b5b45];
const SKIRTS = [0x8a6aa0, 0x5f6f86, 0xa0685a, 0x5f7aaa, 0x6f8a5a];

function plazaTexture() {
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#b8b2a6';
    g.fillRect(0, 0, w, h);
    const n = 8;
    const s = w / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = 176 + ((i * 7 + j * 13) % 5) * 4;
        g.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
        g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
      }
    }
  }, { repeat: [7, 7] });
}

function buildCity(ctx, rng) {
  const scene = new THREE.Scene();
  const ZEN = 0x8fb0cc;
  const HOR = 0xdfe6ea;
  scene.add(makeSky({ zenith: ZEN, horizon: HOR, ground: 0x9a9a96 }));
  scene.fog = new THREE.FogExp2(0xd4dde2, 0.00055);
  scene.environment = makeEnvironment(ctx.renderer, { zenith: ZEN, horizon: HOR, ground: 0x7a7670, intensity: 1.1 });
  scene.add(new THREE.HemisphereLight(0xe9f0f6, 0x7a7266, 1.15));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.5);
  sun.position.set(-50, 90, 30);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x7d7f7c }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.4;
  scene.add(ground);
  const roads = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshLambertMaterial({ map: asphaltTexture(5) }));
  roads.material.map.wrapS = roads.material.map.wrapT = THREE.RepeatWrapping;
  roads.material.map.repeat.set(120, 120);
  roads.rotation.x = -Math.PI / 2;
  roads.position.y = -0.2;
  scene.add(roads);
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(64, 0.3, 64), [null, null, new THREE.MeshLambertMaterial({ map: plazaTexture() }), null, null, null].map((m) => m ?? new THREE.MeshLambertMaterial({ color: 0x9c968a })));
  plaza.position.y = -0.15;
  scene.add(plaza);
  // Fountain
  const stone = new THREE.MeshLambertMaterial({ color: 0xcfc8ba });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.65, 0.55, 40), stone);
  rim.position.y = 0.3;
  scene.add(rim);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.1, 40), new THREE.MeshStandardMaterial({ color: 0x5f8ea8, roughness: 0.1, metalness: 0.3 }));
  water.position.y = 0.5;
  scene.add(water);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 1.6, 16), stone);
  spire.position.y = 1.2;
  scene.add(spire);
  for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24], [0, -26], [0, 26], [-26, 0], [26, 0]]) {
    const tree = makeTree(rng, 1.5);
    tree.position.set(x, 0, z);
    scene.add(tree);
  }
  const set = makeFacadeSet(101, { lit: 0.08, glass: ['#6f879c', '#7f93a6', '#5f7488', '#8ea0b0'] });
  const city = makeCity({
    seed: 102, x0: -900, x1: 900, z0: -900, z1: 900, set, light: 0.6, env: 1.1, density: 0.88,
    avoid: (x, z) => Math.abs(x) < 70 && Math.abs(z) < 70,
    heightFn: (x, z, r) => r.range(25, 70) + 140 * Math.exp(-((x - 200) ** 2 + (z + 150) ** 2) / 90000) * r.range(0.6, 1.2),
  });
  scene.add(city.group);

  // Crowd: a small, readable group crossing the square in all directions.
  const people = [];
  const kinds = ['man', 'woman', 'man', 'woman', 'boy', 'girl', 'man', 'woman'];
  for (let i = 0; i < 26; i++) {
    const kind = kinds[i % kinds.length];
    const c = makeCharacter({
      kind,
      shirt: SHIRTS[i % SHIRTS.length],
      pants: PANTS[i % PANTS.length],
      skirt: kind === 'woman' || kind === 'girl' ? SKIRTS[i % SKIRTS.length] : undefined,
      hair: HAIR[i % HAIR.length],
      skin: SKIN[(i * 3) % SKIN.length],
    });
    scene.add(c.root);
    const ang = rng.range(0, Math.PI * 2);
    const r0 = rng.range(11, 17);
    const off = (i % 2 ? 1 : -1) * rng.range(3.4, 8);
    const a = new THREE.Vector3(Math.cos(ang) * r0, 0, Math.sin(ang) * r0);
    const perp = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(off);
    const mid = perp.clone().add(new THREE.Vector3(rng.range(-2, 2), 0, rng.range(-2, 2)));
    // Keep everyone out of the fountain.
    if (mid.length() < 3.6) mid.setLength(3.6);
    const b = a.clone().multiplyScalar(-1).add(perp);
    const path = new THREE.CatmullRomCurve3([a, mid, b]);
    const v = (kind === 'boy' || kind === 'girl' ? 1.0 : 1.25) * rng.range(0.85, 1.1);
    const motion = bakeMotion(c, { path, speed: () => v, t0: -rng.range(4, 12), t1: 6 });
    people.push({ c, motion });
  }
  const standers = [];
  for (const [x, z, ry, i] of [[4.2, 6.5, 2.4, 1], [5.2, 7.1, -2.2, 2], [-4.6, -6.2, 0.6, 3], [-3.8, -5.4, 3.6, 4], [-4.3, -7.2, 1.4, 5], [6.5, -8.5, -0.8, 6]]) {
    const kind = ['man', 'woman', 'man', 'woman', 'girl', 'man'][i - 1];
    const c = makeCharacter({ kind, shirt: SHIRTS[(i * 3) % SHIRTS.length], pants: PANTS[i % PANTS.length], skirt: kind !== 'man' ? SKIRTS[i % SKIRTS.length] : undefined, hair: HAIR[i % HAIR.length], skin: SKIN[i % SKIN.length] });
    c.root.position.set(x, 0, z);
    c.root.rotation.y = ry;
    scene.add(c.root);
    standers.push(c);
  }

  sunShadow(scene, sun, { cx: 0, cz: 0, size: 36 });
  plaza.receiveShadow = true;
  for (const p of people) castShadows(p.c.root);
  for (const c of standers) castShadows(c.root);
  scene.traverse((o) => {
    if (o.isMesh && (o.material === stone || o.parent?.children.length === 2)) o.castShadow = true;
  });

  const camera = makeCamera(THREE, 50, 0.5, 20000);
  return {
    scene,
    camera,
    update(t) {
      for (const p of people) driveCharacter(p.c, p.motion, t);
      standers.forEach((c, i) => setPose(c, { phase: 0, walk: 0, run: 0, t: t + i * 2 }));
      // Exponential climb: equal zoom speed at every scale.
      const u = ease('power1.in', 0.2, CUT + 0.2, t);
      const h = 23 * Math.pow(75, u);
      camera.position.set(0.0 + fbm1(t * 0.3, 7) * 0.2, h, 0.0 + fbm1(t * 0.3, 9) * 0.2);
      camera.up.set(0, 0, -1);
      camera.lookAt(0, 0, 0);
      camera.rotateZ(0.12 + 0.05 * u);
      camera.far = Math.max(2000, h * 6);
      camera.updateProjectionMatrix();
      scene.fog.density = 0.00055 * Math.min(1, 300 / h + 0.15);
    },
  };
}

function buildPlanet(ctx) {
  const scene = new THREE.Scene();
  const stars = makeStars({ count: 5000, seed: 103, minY: -1.1, radius: 3000 });
  stars.material.uniforms.pxScale.value = ctx.pxScale;
  scene.add(stars);
  const earth = makeEarth(ctx.earth);
  scene.add(earth.group);
  const focus = lonLatToVec3(8, 47).normalize();
  const north = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(north, focus).normalize();
  earth.uniforms.sunDir.value.copy(focus.clone().multiplyScalar(0.75).addScaledVector(east, -0.45).addScaledVector(north, 0.3).normalize());
  earth.uniforms.ambient.value = 0.03;
  earth.uniforms.lightsGain.value = 0;
  const camera = makeCamera(THREE, 50, 0.001, 5000);
  return {
    scene,
    camera,
    update(t) {
      const lt = t - CUT;
      const u = ease('power2.out', -0.3, 1.95, lt);
      const alt = 0.22 * Math.pow(3.25 / 0.22, u);
      camera.position.copy(focus).multiplyScalar(1 + alt);
      camera.up.copy(north);
      camera.lookAt(0, 0, 0);
      camera.rotateZ(0.12 * (1 - u));
      stars.material.uniforms.time.value = t;
      earth.uniforms.cloudShift.value = 0.0015 * lt;
    },
  };
}

export async function build(ctx) {
  const rng = makeRng(1001);
  const city = buildCity(ctx, rng);
  const planet = buildPlanet(ctx);
  const cityShot = { scene: city.scene, camera: city.camera, post: { bloomStrength: 0.3, bloomThreshold: 1.6, exposure: 1.05, lift: 0.04, saturation: 0.95, soft: [0.76, 0.24, 0.85] } };
  const planetShot = { scene: planet.scene, camera: planet.camera, post: { bloomStrength: 0.5, bloomThreshold: 1.1, exposure: 0.92, lift: 0.015, vignette: 0.12 } };
  return {
    shotsAt(t) {
      const h = 0.22;
      const list = [];
      if (t < CUT + h) {
        city.update(t);
        list.push({ shot: cityShot, w: 1 - smoothstep(CUT - h, CUT + h, t) });
      }
      if (t > CUT - h) {
        planet.update(t);
        list.push({ shot: planetShot, w: smoothstep(CUT - h, CUT + h, t) });
      }
      return list;
    },
  };
}
