// 0:07-0:12  DAY 1. Industrial skyline at dusk; smokestacks stop one by one, the smoke fades.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { makeSky, makeEnvironment } from '../kit/sky.js';
import { makeCity, makeFacadeSet } from '../kit/city.js';
import { puffTexture } from '../kit/textures.js';
import { handheld, makeCamera } from '../kit/camera.js';
import { ease, lerp, smoothstep, clamp } from '../util.js';

const HORIZON = 0xd99a7c;
const ZENITH = 0x1d2b4c;

function bandTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9690';
  g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#a8362c';
  g.fillRect(0, 0, 64, 26);
  g.fillRect(0, 52, 64, 26);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export async function build(ctx) {
  const rng = makeRng(301);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x5a4a58, 0.0011);
  scene.add(makeSky({ zenith: ZENITH, horizon: HORIZON, ground: 0x3a3532, sunDir: [0.15, -0.02, -1], sunColor: 0xffa060, sunGlow: 1.2, horizonSharp: 0.35 }));
  scene.environment = makeEnvironment(ctx.renderer, { zenith: ZENITH, horizon: HORIZON, ground: 0x2a2624, intensity: 0.9 });
  scene.add(new THREE.HemisphereLight(0x8090b8, 0x3a2e28, 0.7));
  const sun = new THREE.DirectionalLight(0xffb27a, 1.4);
  sun.position.set(30, 20, -200);
  scene.add(sun);
  const front = new THREE.DirectionalLight(0x9aa8d0, 0.35);
  front.position.set(-40, 50, 120);
  scene.add(front);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x4a4440 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  // Calm river in the foreground reflecting the sky glow.
  const river = new THREE.Mesh(new THREE.PlaneGeometry(1600, 50), new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.12, metalness: 0.6 }));
  river.rotation.x = -Math.PI / 2;
  river.position.set(0, 0.05, -40);
  scene.add(river);

  const set = makeFacadeSet(11, { lit: 0.3 });
  const city = makeCity({ seed: 12, x0: -900, x1: 900, z0: -1700, z1: -950, set, light: 1.3, env: 0.7, minH: 40, maxH: 130, density: 0.8 });
  scene.add(city.group);

  // Factories with chimneys.
  const shedMat = new THREE.MeshStandardMaterial({ color: 0x5f6670, roughness: 0.75, metalness: 0.2 });
  const shedMat2 = new THREE.MeshStandardMaterial({ color: 0x6e6158, roughness: 0.8, metalness: 0.1 });
  const chimMat = new THREE.MeshStandardMaterial({ map: bandTexture(), roughness: 0.8 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x8c9096, roughness: 0.5, metalness: 0.4 });
  const sites = [
    { x: -70, z: -150, h: 92, stop: 0.9 },
    { x: -28, z: -105, h: 78, stop: 1.6 },
    { x: 14, z: -190, h: 112, stop: 2.2 },
    { x: 48, z: -120, h: 86, stop: 2.8 },
    { x: 86, z: -175, h: 100, stop: 3.4 },
    { x: -112, z: -230, h: 96, stop: 4.0 },
  ];
  const chimneys = [];
  const puff = puffTexture();
  for (const [i, s] of sites.entries()) {
    const site = new THREE.Group();
    site.position.set(s.x, 0, s.z);
    const sw = rng.range(26, 40);
    const sd = rng.range(18, 28);
    const sh = rng.range(9, 15);
    const shed = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), i % 2 ? shedMat : shedMat2);
    shed.position.set(-sw * 0.25, sh / 2, 6);
    site.add(shed);
    // Saw-tooth roof
    for (let k = 0; k < 4; k++) {
      const tooth = new THREE.Mesh(new THREE.CylinderGeometry(0.01, sd * 0.13, sw * 0.24, 3), i % 2 ? shedMat : shedMat2);
      tooth.rotation.z = Math.PI / 2;
      tooth.position.set(-sw * 0.25 - sw * 0.36 + k * sw * 0.24, sh + 1.5, 6);
      site.add(tooth);
    }
    const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc27a).multiplyScalar(2.4) });
    for (let k = 0; k < 6; k++) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(sw * 0.1, 1.4), winMat);
      w.position.set(-sw * 0.25 - sw * 0.4 + k * sw * 0.16, sh * 0.55, 6 + sd / 2 + 0.05);
      site.add(w);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 11, 24), tankMat);
    tank.position.set(sw * 0.35, 5.5, 14);
    site.add(tank);
    const r = 2.6 + s.h * 0.025;
    const chim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r, s.h, 24, 1, true), chimMat);
    chim.position.set(sw * 0.15, s.h / 2, -2);
    site.add(chim);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.25, 0.15) }));
    lamp.position.set(sw * 0.15, s.h + 0.8, -2);
    site.add(lamp);
    scene.add(site);
    const top = new THREE.Vector3(s.x + sw * 0.15, s.h, s.z - 2);
    // Smoke puffs: birth times are fixed by index, so frame n always shows the same smoke.
    const rate = 14;
    const life = 7.5;
    const sprites = [];
    for (let j = 0; j < Math.ceil(rate * (life + 6)); j++) {
      const m = new THREE.SpriteMaterial({ map: puff, color: 0x8a8079, transparent: true, depthWrite: false, opacity: 0 });
      const sp = new THREE.Sprite(m);
      sp.userData = { birth: -life + j / rate, jx: rng.range(-1, 1), jz: rng.range(-1, 1), js: rng.range(0.8, 1.25), shade: rng.range(0.85, 1.1) };
      scene.add(sp);
      sprites.push(sp);
    }
    chimneys.push({ ...s, top, sprites, life, winMat, r });
  }

  const camera = makeCamera(THREE, 50, 1, 6000);
  const post = { bloomStrength: 0.6, bloomThreshold: 1.2, exposure: 1.0, lift: 0.035, saturation: 0.95, soft: [0.86, 0.18, 0.6] };
  const shot = { scene, camera, post };

  return {
    shotsAt(t) {
      for (const c of chimneys) {
        const stopped = smoothstep(c.stop, c.stop + 0.7, t);
        c.winMat.color.set(0xffc27a).multiplyScalar(lerp(2.4, 0.04, stopped));
        for (const sp of c.sprites) {
          const u = sp.userData;
          const age = t - u.birth;
          const alive = u.birth <= c.stop && age >= 0 && age <= c.life;
          sp.visible = alive;
          if (!alive) continue;
          const k = age / c.life;
          sp.position.set(
            c.top.x + 3.2 * age + u.jx * (0.6 + 1.6 * Math.sqrt(age)),
            c.top.y + 1 + 7.5 * age * (1 - 0.35 * k),
            c.top.z + u.jz * (0.6 + 1.4 * Math.sqrt(age))
          );
          const size = (c.r * 1.7 + 2.9 * age) * u.js;
          sp.scale.set(size, size, 1);
          // Fade in at the stack, fade out with age; after a stop the remaining plume thins faster.
          const thin = 1 - smoothstep(c.stop + 0.3, c.stop + 2.6, t) * smoothstep(0, 1, k + 0.35);
          sp.material.opacity = 0.42 * smoothstep(0, 0.35, age) * (1 - smoothstep(0.5, 1, k)) * clamp(thin);
          sp.material.color.setRGB(0.36 * u.shade, 0.33 * u.shade, 0.33 * u.shade);
        }
      }
      const p = ease('sine.inOut', -0.5, 5.5, t);
      camera.position.set(lerp(-8, 2, p), lerp(34, 30, p), lerp(95, 62, p));
      camera.lookAt(lerp(-4, 2, p), 62, -200);
      handheld(camera, t, { amp: 0.6, seed: 31 });
      return [{ shot, w: 1 }];
    },
  };
}
