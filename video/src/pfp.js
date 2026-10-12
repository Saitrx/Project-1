// Square "pov" profile pictures in the video's style. Variants:
//   a: block character from behind, looking out over a dusk skyline (a literal point of view)
//   b: the planet's limb at sunrise, city lights on the night side
//   c: minimal close-up of the faceless block character
import * as THREE from 'three';
import { setMaxAniso } from './kit/textures.js';
import { makeSky, makeStars, makeEnvironment, makeCloud } from './kit/sky.js';
import { makeCity, makeFacadeSet } from './kit/city.js';
import { makeCharacter, setPose, HAIR, SKIN } from './kit/character.js';
import { bakeEarth, makeEarth, lonLatToVec3 } from './kit/earth.js';
import { makeRng } from './rng.js';

function camera(fov) {
  return new THREE.PerspectiveCamera(fov, 1, 0.05, 8000);
}

function drawName(ctx, W, { y = 0.33, size = 0.3, color = '#ffffff', shadow = 'rgba(0,0,0,0.45)' } = {}) {
  ctx.clearRect(0, 0, W, W);
  ctx.save();
  ctx.font = `600 ${Math.round(W * size)}px Serif4`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${Math.round(W * 0.006)}px`;
  ctx.shadowColor = shadow;
  ctx.shadowBlur = W * 0.03;
  ctx.shadowOffsetY = W * 0.006;
  ctx.fillStyle = color;
  ctx.fillText('pov', W / 2, W * y);
  ctx.restore();
}

function dusk(ctx) {
  const scene = new THREE.Scene();
  const ZEN = 0x1b2a4d;
  const HOR = 0xe8996f;
  scene.add(makeSky({ zenith: ZEN, horizon: HOR, ground: 0x2c2a30, sunDir: [0.0, 0.01, -1], sunColor: 0xffa060, sunGlow: 1.6, horizonSharp: 0.42 }));
  scene.fog = new THREE.FogExp2(0x6a5260, 0.00055);
  scene.environment = makeEnvironment(ctx.renderer, { zenith: ZEN, horizon: HOR, ground: 0x231f22, intensity: 0.9 });
  scene.add(new THREE.HemisphereLight(0x8a96c0, 0x2a2228, 0.6));
  const rim = new THREE.DirectionalLight(0xffb27a, 2.2);
  rim.position.set(0.3, 0.6, -1);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9fb0e0, 0.5);
  fill.position.set(-1, 1, 1.5);
  scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x2e2c30 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.3;
  scene.add(ground);
  const set = makeFacadeSet(5, { lit: 0.4 });
  const city = makeCity({ seed: 6, x0: -1500, x1: 1500, z0: -2600, z1: -1100, set, light: 1.8, env: 0.8, minH: 40, maxH: 150, density: 0.85 });
  scene.add(city.group);
  const rng = makeRng(7);
  for (let i = 0; i < 6; i++) {
    const c = makeCloud(rng, rng.range(20, 34), 0xffd2b0);
    c.position.set(rng.range(-500, 500), rng.range(160, 260), rng.range(-1300, -900));
    scene.add(c);
  }
  const me = makeCharacter({ kind: 'man', shirt: 0x3aa0e0, pants: 0x1e2a44, hair: HAIR[0], skin: SKIN[1], shadow: false });
  me.root.rotation.y = Math.PI;
  scene.add(me.root);
  setPose(me, { phase: 0, walk: 0, run: 0, t: 0, lookUp: 0.08 });
  const cam = camera(40);
  cam.position.set(0.12, 1.42, 2.6);
  cam.lookAt(0.0, 2.3, -6);
  return { scene, camera: cam, post: { bloomStrength: 0.6, bloomThreshold: 1.1, exposure: 1.1, lift: 0.03, vignette: 0.22, soft: [0.95, 0.35, 0.6] }, text: { y: 0.24 } };
}

function planet(ctx) {
  const scene = new THREE.Scene();
  const stars = makeStars({ count: 5000, seed: 9, minY: -1.1, radius: 3000 });
  stars.material.uniforms.pxScale.value = ctx.pxScale;
  scene.add(stars);
  const earth = makeEarth(ctx.earth);
  scene.add(earth.group);
  const focus = lonLatToVec3(15, 38).normalize();
  const north = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(north, focus).normalize();
  // Sun just beyond the limb: a thin sunrise on the right, city lights on the night side.
  earth.uniforms.sunDir.value.copy(focus.clone().multiplyScalar(-0.15).addScaledVector(east, 1).addScaledVector(north, 0.2).normalize());
  earth.uniforms.lightsGain.value = 3.2;
  earth.uniforms.ambient.value = 0.004;
  const cam = camera(48);
  cam.position.copy(focus).multiplyScalar(1.85).addScaledVector(north, -0.35);
  cam.up.copy(north);
  cam.lookAt(focus.clone().multiplyScalar(0.55).addScaledVector(north, 0.62));
  return { scene, camera: cam, post: { bloomStrength: 0.9, bloomThreshold: 0.9, exposure: 1.15, lift: 0.01, vignette: 0.15 }, text: { y: 0.3 } };
}

function portrait(ctx) {
  const scene = new THREE.Scene();
  scene.add(makeSky({ zenith: 0x3f78b8, horizon: 0xf4b07c, ground: 0x6a5a50, sunDir: [0.4, 0.05, -1], sunColor: 0xffb070, sunGlow: 0.8, horizonSharp: 0.55 }));
  scene.environment = makeEnvironment(ctx.renderer, { zenith: 0xbfd0e4, horizon: 0xf0d2b4, ground: 0x6a5a50, intensity: 1.0 });
  scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x6a5a50, 1.0));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.8);
  key.position.set(-1.2, 1.4, 1.6);
  scene.add(key);
  const back = new THREE.DirectionalLight(0xffc08a, 1.4);
  back.position.set(1.5, 0.8, -1.2);
  scene.add(back);
  const me = makeCharacter({ kind: 'man', shirt: 0x3aa0e0, pants: 0x1e2a44, hair: HAIR[0], skin: SKIN[1], shadow: false });
  me.root.rotation.y = -0.45;
  scene.add(me.root);
  setPose(me, { phase: 0, walk: 0, run: 0, t: 0 });
  const cam = camera(30);
  cam.position.set(0.05, 1.75, 2.9);
  cam.lookAt(0.02, 1.72, 0);
  return { scene, camera: cam, post: { bloomStrength: 0.3, bloomThreshold: 1.4, exposure: 1.0, lift: 0.03, vignette: 0.2, soft: [0.9, 0.12, 0.6] }, text: { y: 0.21, size: 0.25 } };
}

export async function buildPfp(engine, variant) {
  setMaxAniso(engine.maxAniso);
  const ctx = { renderer: engine.renderer, pxScale: engine.H / 1920 };
  if (variant === 'b') ctx.earth = await bakeEarth(engine.renderer, engine.maxAniso);
  const shot = variant === 'b' ? planet(ctx) : variant === 'c' ? portrait(ctx) : dusk(ctx);
  return {
    render(n) {
      drawName(engine.overlayCtx, engine.W, shot.text);
      engine.renderShot(shot, false, n);
      engine.present(0, n);
    },
  };
}
