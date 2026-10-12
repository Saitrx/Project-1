// 0:22-0:28  DAY 5. A power plant switches off; then Earth from space as half the city lights go dark.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { makeSky, makeStars, makeEnvironment } from '../kit/sky.js';
import { makeCity, makeFacadeSet } from '../kit/city.js';
import { puffTexture } from '../kit/textures.js';
import { makeEarth, lonLatToVec3 } from '../kit/earth.js';
import { handheld, makeCamera } from '../kit/camera.js';
import { ease, lerp, smoothstep, clamp } from '../util.js';

const CUT = 3.0;
const OFF = [1.0, 1.35, 1.7]; // plant light groups switch off one after another

export function makeCoolingTower(mat) {
  const pts = [
    [28, 0], [25.5, 8], [22.5, 18], [20, 30], [19, 40], [19.3, 48], [20.6, 58], [21, 60],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 48);
  return new THREE.Mesh(g, mat);
}

export function makePylon(mat) {
  const g = new THREE.Group();
  const h = 34;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.35), mat);
      leg.position.set(sx * 2.4, h / 2, sz * 2.4);
      leg.rotation.z = -sx * 0.06;
      leg.rotation.x = sz * 0.06;
      g.add(leg);
    }
  }
  for (const [y, w] of [[22, 16], [28, 12], [33, 7]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, 0.45), mat);
    arm.position.y = y;
    g.add(arm);
  }
  for (let y = 4; y < 30; y += 6) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.2, 0.2), mat);
    br.position.y = y;
    br.rotation.z = 0.7;
    g.add(br);
  }
  return g;
}

function buildPlant(ctx, rng) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0e1420, 0.0024);
  scene.add(makeSky({ zenith: 0x060b18, horizon: 0x1c2438, ground: 0x07090c, sunGlow: 0, horizonSharp: 0.5, milky: 0.4 }));
  const stars = makeStars({ count: 2500, seed: 61, minY: 0.05 });
  stars.material.uniforms.pxScale.value = ctx.pxScale;
  scene.add(stars);
  scene.environment = makeEnvironment(ctx.renderer, { zenith: 0x0e1626, horizon: 0x1b2232, ground: 0x07080a, intensity: 0.7 });
  const moon = new THREE.DirectionalLight(0x8fa6d6, 0.8);
  moon.position.set(-80, 120, 60);
  scene.add(moon);
  scene.add(new THREE.HemisphereLight(0x2a3a5c, 0x0a0a0c, 0.45));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshLambertMaterial({ color: 0x3c403c }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const concrete = new THREE.MeshLambertMaterial({ color: 0x8d8a85, side: THREE.DoubleSide });
  const towers = [];
  for (const [x, z] of [[-34, -170], [34, -205]]) {
    const t = makeCoolingTower(concrete);
    t.position.set(x, 0, z);
    scene.add(t);
    towers.push(new THREE.Vector3(x, 60, z));
  }
  const hallMat = new THREE.MeshLambertMaterial({ color: 0x4d5560 });
  const hall = new THREE.Mesh(new THREE.BoxGeometry(70, 22, 30), hallMat);
  hall.position.set(-6, 11, -118);
  scene.add(hall);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.4, 95, 20), hallMat);
  stack.position.set(30, 47.5, -125);
  scene.add(stack);

  // Light groups: each group is a set of emissive materials + point lights that turn off together.
  const groups = OFF.map(() => ({ mats: [], lights: [] }));
  const winColor = new THREE.Color(0xffcf8a);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 12; i++) {
      const m = new THREE.MeshBasicMaterial({ color: winColor.clone().multiplyScalar(2.2) });
      m.userData.base = 2.2;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), m);
      w.position.set(-36 + i * 5.4, 5 + row * 5.5, -102.9);
      scene.add(w);
      groups[(i + row) % 3].mats.push(m);
    }
  }
  for (const [k, pos] of [[0, [-34, 3, -136]], [1, [34, 3, -171]], [2, [-6, 2, -95]], [0, [20, 2, -100]]]) {
    const l = new THREE.PointLight(0xffc483, 2600, 160, 2);
    l.position.set(...pos);
    l.userData.base = 2600;
    scene.add(l);
    groups[k].lights.push(l);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshBasicMaterial({ color: winColor.clone().multiplyScalar(8) }));
    lamp.material.userData.base = 8;
    lamp.position.set(...pos);
    scene.add(lamp);
    groups[k].mats.push(lamp.material);
  }

  // Pylons marching toward the camera with sagging cables.
  const steel = new THREE.MeshLambertMaterial({ color: 0x5a6068 });
  const pylonPos = [];
  // A line of pylons crossing the frame diagonally, from near-left to far-right.
  const A = new THREE.Vector2(-95, 30);
  const B = new THREE.Vector2(140, -150);
  const dir = B.clone().sub(A).normalize();
  const pylonYaw = Math.atan2(dir.x, dir.y) + Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const q = A.clone().lerp(B, i / 5);
    const p = makePylon(steel);
    p.position.set(q.x, 0, q.y);
    p.rotation.y = pylonYaw;
    scene.add(p);
    pylonPos.push(new THREE.Vector3(q.x, 0, q.y));
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1) }));
    red.position.set(q.x, 34.6, q.y);
    scene.add(red);
  }
  const cableMat = new THREE.MeshLambertMaterial({ color: 0x3a3e44 });
  for (let i = 0; i < pylonPos.length - 1; i++) {
    for (const [ox, oy] of [[-8, 22], [8, 22], [-6, 28], [6, 28]]) {
      const off = new THREE.Vector3(ox * Math.cos(pylonYaw), oy, -ox * Math.sin(pylonYaw));
      const a = pylonPos[i].clone().add(off);
      const b = pylonPos[i + 1].clone().add(off);
      const mid = a.clone().lerp(b, 0.5);
      mid.y -= 3.2;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.07, 5), cableMat));
    }
  }

  // Distant city on the horizon that goes dark after the plant.
  const set = makeFacadeSet(66, { lit: 0.55 });
  const city = makeCity({ seed: 67, x0: -900, x1: 900, z0: -1400, z1: -800, set, light: 2.2, env: 0.4, minH: 30, maxH: 120, density: 0.75 });
  scene.add(city.group);

  // Steam plumes from the cooling towers.
  const puff = puffTexture();
  const steam = [];
  for (const top of towers) {
    for (let j = 0; j < 130; j++) {
      const m = new THREE.SpriteMaterial({ map: puff, color: 0x9ea6b2, transparent: true, depthWrite: false, opacity: 0 });
      const sp = new THREE.Sprite(m);
      sp.userData = { top, birth: -8 + j * 0.07, jx: rng.range(-1, 1), jz: rng.range(-1, 1), js: rng.range(0.8, 1.2) };
      scene.add(sp);
      steam.push(sp);
    }
  }

  const camera = makeCamera(THREE, 50, 1, 6000);
  return {
    scene,
    camera,
    update(t) {
      groups.forEach((g, i) => {
        const on = 1 - smoothstep(OFF[i], OFF[i] + 0.3, t);
        for (const m of g.mats) m.color.copy(winColor).multiplyScalar(Math.max(0.02, m.userData.base * on));
        for (const l of g.lights) l.intensity = l.userData.base * on;
      });
      // The city fades out in a sweep from left to right.
      for (const tw of city.towers) {
        const tOff = 1.9 + clamp((tw.x + 900) / 1800) * 0.8;
        tw.tower.setLights(2.2 * (1 - smoothstep(tOff, tOff + 0.25, t)) + 0.0);
      }
      const plantOn = 1 - smoothstep(OFF[0], OFF[2] + 0.3, t);
      for (const sp of steam) {
        const u = sp.userData;
        const age = t - u.birth;
        const life = 8;
        const alive = age >= 0 && age <= life && u.birth <= OFF[0];
        sp.visible = alive;
        if (!alive) continue;
        const k = age / life;
        sp.position.set(u.top.x + 2.6 * age + u.jx * (5 + 2 * Math.sqrt(age)), u.top.y + 3 + 7 * age, u.top.z + u.jz * (5 + 1.5 * Math.sqrt(age)));
        const size = (9 + 2.8 * age) * u.js;
        sp.scale.set(size, size, 1);
        const fadeAfter = 1 - smoothstep(OFF[0] + 0.5, OFF[0] + 3.5, t) * smoothstep(0, 1, k + 0.3);
        sp.material.opacity = 0.26 * smoothstep(0, 0.6, age) * (1 - smoothstep(0.5, 1, k)) * fadeAfter;
        const lit = 0.35 + 0.65 * plantOn;
        sp.material.color.setRGB(0.42 * lit + 0.08, 0.43 * lit + 0.09, 0.47 * lit + 0.12);
      }
      stars.material.uniforms.time.value = t;
      const p = ease('sine.inOut', -0.5, CUT + 0.5, t);
      camera.position.set(lerp(-62, -54, p), lerp(5, 4.6, p), lerp(120, 98, p));
      camera.lookAt(lerp(-8, -6, p), 40, -170);
      handheld(camera, t, { amp: 0.6, seed: 61 });
    },
  };
}

function buildSpace(ctx) {
  const scene = new THREE.Scene();
  const stars = makeStars({ count: 5000, seed: 62, minY: -1.1, radius: 3000 });
  stars.material.uniforms.pxScale.value = ctx.pxScale;
  scene.add(stars);
  const earth = makeEarth(ctx.earth);
  scene.add(earth.group);
  const focus = lonLatToVec3(35, 28).normalize();
  const camera = makeCamera(THREE, 40, 0.01, 5000);
  const up = new THREE.Vector3(0, 1, 0);
  // Sun behind and to the right: night side faces us with a thin daylit crescent.
  const right = new THREE.Vector3().crossVectors(focus, up).normalize();
  earth.uniforms.sunDir.value.copy(focus.clone().multiplyScalar(-0.45).addScaledVector(right, -0.9).normalize());
  earth.uniforms.lightsGain.value = 3.4;
  earth.uniforms.frontDir.value.copy(right.clone().multiplyScalar(-1));
  earth.uniforms.ambient.value = 0.004;
  return {
    scene,
    camera,
    update(t) {
      const lt = t - CUT;
      earth.group.rotation.y = -0.02 * lt;
      // Half the lights go dark in a sweep that crosses the visible hemisphere.
      earth.uniforms.outage.value = 0.55 * smoothstep(0.5, 2.6, lt);
      earth.uniforms.outageFront.value = lerp(1.1, -0.45, ease('sine.inOut', 0.5, 2.6, lt));
      earth.uniforms.cloudShift.value = 0.002 * lt;
      stars.material.uniforms.time.value = t;
      const d = lerp(5.4, 4.7, ease('sine.inOut', -0.3, 3.3, lt));
      camera.position.copy(focus).multiplyScalar(d).addScaledVector(up, 0.15);
      camera.lookAt(focus.clone().multiplyScalar(0.1));
      handheld(camera, t, { amp: 0.25, seed: 63 });
    },
  };
}

export async function build(ctx) {
  const rng = makeRng(606);
  const plant = buildPlant(ctx, rng);
  const space = buildSpace(ctx);
  const plantShot = { scene: plant.scene, camera: plant.camera, post: { bloomStrength: 0.7, bloomThreshold: 1.1, exposure: 1.25, lift: 0.035, soft: [1.0, 0.25, 0.55] } };
  const spaceShot = { scene: space.scene, camera: space.camera, post: { bloomStrength: 0.85, bloomThreshold: 0.9, exposure: 1.1, lift: 0.015, vignette: 0.12 } };
  return {
    shotsAt(t) {
      const h = 0.18;
      const list = [];
      if (t < CUT + h) {
        plant.update(t);
        list.push({ shot: plantShot, w: 1 - smoothstep(CUT - h, CUT + h, t) });
      }
      if (t > CUT - h) {
        space.update(t);
        list.push({ shot: spaceShot, w: smoothstep(CUT - h, CUT + h, t) });
      }
      return list;
    },
  };
}
