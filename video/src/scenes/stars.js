// 0:28-0:34  DAY 9. A CO2 meter dropping; slow tilt up over a dark city to a clear sky full of stars.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { makeSky, makeStars, makeEnvironment } from '../kit/sky.js';
import { makeCity, makeFacadeSet, makeTower, asphaltTexture, makeStreetLamp } from '../kit/city.js';
import { textTexture } from '../kit/textures.js';
import { makeCharacter, setPose, bakeMotion, driveCharacter, SKIN, HAIR } from '../kit/character.js';
import { handheld, makeCamera } from '../kit/camera.js';
import { ease, lerp, smoothstep } from '../util.js';

function drawSign(g, w, h, t) {
  g.fillStyle = '#050607';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#1c2024';
  g.lineWidth = 12;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = '#7fd7a6';
  g.font = '600 46px PlexSans';
  g.letterSpacing = '8px';
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText('ATMOSPHERIC CO₂', 50, 70);
  g.letterSpacing = '0px';
  const v = 417.6 - 1.6 * smoothstep(0, 5.5, t) - 0.25 * t;
  g.font = '600 190px PlexMono';
  g.fillStyle = '#9dffc8';
  g.fillText(v.toFixed(1), 40, 230);
  g.font = '600 56px PlexSans';
  g.fillStyle = '#7fd7a6';
  g.fillText('PPM', 700, 268);
  // Down arrow
  g.beginPath();
  g.moveTo(760, 150);
  g.lineTo(840, 150);
  g.lineTo(800, 205);
  g.closePath();
  g.fill();
  // Falling trend line
  g.strokeStyle = '#5fbf8a';
  g.lineWidth = 7;
  g.beginPath();
  for (let i = 0; i <= 40; i++) {
    const x = 50 + i * 22;
    const y = 380 + i * 2.2 + Math.sin(i * 1.7) * 6 + (i > 30 ? (i - 30) * 3.5 : 0);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
}

export async function build(ctx) {
  const rng = makeRng(707);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b1120, 0.0035);
  const sky = makeSky({ zenith: 0x03060f, horizon: 0x101828, ground: 0x050608, sunGlow: 0, horizonSharp: 0.35, milky: 0.55 });
  scene.add(sky);
  const stars = makeStars({ count: 9000, seed: 71, minY: 0.0 });
  stars.material.uniforms.pxScale.value = ctx.pxScale;
  scene.add(stars);
  scene.environment = makeEnvironment(ctx.renderer, { zenith: 0x0c1424, horizon: 0x141c2c, ground: 0x050607, intensity: 0.8 });
  const moon = new THREE.DirectionalLight(0x9db0dd, 0.55);
  moon.position.set(60, 140, 80);
  scene.add(moon);
  scene.add(new THREE.HemisphereLight(0x2b3b60, 0x0b0b0d, 0.5));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x24262a }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.3;
  scene.add(ground);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 12), new THREE.MeshLambertMaterial({ map: asphaltTexture(7) }));
  road.material.map.repeat.set(40, 1.2);
  road.material.map.wrapS = road.material.map.wrapT = THREE.RepeatWrapping;
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, 6);
  scene.add(road);
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x5a5c60 });
  for (const z of [-2, 14]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(400, 0.15, 4), walkMat);
    s.position.set(0, 0.075, z);
    scene.add(s);
  }

  // Dark glass towers lining the far side of the street; only a few candle-lit windows.
  const set = makeFacadeSet(77, { lit: 0.05, warm: '#ffb565' });
  const front = [];
  let x = -60;
  while (x < 60) {
    const w = rng.range(18, 30);
    const t = makeTower({ w, h: rng.range(90, 170), d: 24, set: set[rng.int(0, set.length - 1)], light: 1.4, env: 0.6, rng });
    t.group.position.set(x + w / 2, 0, -4 - 12 - 0.5);
    scene.add(t.group);
    front.push(t);
    x += w + rng.range(4, 9);
  }
  const city = makeCity({ seed: 78, x0: -500, x1: 500, z0: -700, z1: -60, set, light: 1.4, env: 0.6, minH: 60, maxH: 190, density: 0.8 });
  scene.add(city.group);
  // Street lamps: off (no power).
  for (const lx of [-34, -14, 18, 38]) {
    const l = makeStreetLamp({ height: 7, pool: false });
    l.setOn(0);
    l.group.position.set(lx, 0, -0.5);
    scene.add(l.group);
  }

  // The CO2 meter: a self-powered sign on a post at the kerb, glowing softly.
  const sign = textTexture(1024, 560, (g, w, h, t) => drawSign(g, w, h, t));
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.75), new THREE.MeshBasicMaterial({ map: sign.tex, color: new THREE.Color(1.5, 1.5, 1.5) }));
  signMesh.position.set(1.0, 4.3, -3.2);
  scene.add(signMesh);
  const signBox = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.95, 0.25), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5 }));
  signBox.position.set(1.0, 4.3, -3.35);
  scene.add(signBox);
  for (const px of [-0.3, 2.3]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 10), new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.6 }));
    post.position.set(px, 1.7, -3.35);
    scene.add(post);
  }
  const signLight = new THREE.PointLight(0x8cffc0, 22, 14, 1.6);
  signLight.position.set(1.0, 3.6, -1.6);
  scene.add(signLight);

  // A mother and son walk along the far sidewalk under the sign; a man stands looking up.
  const mom = makeCharacter({ kind: 'woman', shirt: 0x8a6a9c, skirt: 0x6a6090, hair: HAIR[1], skin: SKIN[1] });
  const son = makeCharacter({ kind: 'boy', shirt: 0xe0a83c, pants: 0x30425e, hair: HAIR[0], skin: SKIN[1] });
  scene.add(mom.root, son.root);
  const pathM = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.8, 0.15, -1.7), new THREE.Vector3(1.5, 0.15, -1.6), new THREE.Vector3(9, 0.15, -1.7)]);
  const pathS = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.3, 0.15, -0.85), new THREE.Vector3(2.0, 0.15, -0.8), new THREE.Vector3(9.5, 0.15, -0.85)]);
  const mM = bakeMotion(mom, { path: pathM, speed: () => 1.05, t0: -0.5, t1: 7 });
  const mS = bakeMotion(son, { path: pathS, speed: () => 1.05, t0: -0.5, t1: 7 });
  const man = makeCharacter({ kind: 'man', shirt: 0x4a7fa8, pants: 0x2a2a30, hair: HAIR[3], skin: SKIN[3] });
  man.root.position.set(5.2, 0.15, 14.2);
  man.root.rotation.y = Math.PI + 0.3;
  scene.add(man.root);

  const camera = makeCamera(THREE, 52, 0.1, 6000);
  const post = { bloomStrength: 0.75, bloomThreshold: 1.0, exposure: 1.45, lift: 0.025, vignette: 0.2, soft: [1.0, 0.2, 0.5] };
  const shot = { scene, camera, post };
  let lastQ = -1;

  return {
    shotsAt(t) {
      const q = Math.round(t * 15);
      if (q !== lastQ) {
        sign.redraw(t);
        lastQ = q;
      }
      driveCharacter(mom, mM, t, { lookUp: 0.25 * smoothstep(2.5, 3.5, t) });
      driveCharacter(son, mS, t, { lookUp: 0.35 * smoothstep(2.2, 3.2, t) });
      setPose(man, { phase: 0, walk: 0, run: 0, t, lookUp: 0.7 });
      stars.material.uniforms.time.value = t;
      // Hold on the sign, then a slow tilt up the towers to the stars.
      const tilt = ease('sine.inOut', 1.6, 6.0, t);
      const push = ease('sine.out', -0.4, 2.0, t);
      camera.position.set(-0.4, lerp(1.7, 2.6, tilt), lerp(17.5, 16.2, push));
      const pitch = lerp(0.12, 1.32, tilt);
      const dir = new THREE.Vector3(0.12 * (1 - tilt), Math.sin(pitch), -Math.cos(pitch));
      camera.lookAt(camera.position.clone().add(dir));
      handheld(camera, t, { amp: 0.6, seed: 71 });
      return [{ shot, w: 1 }];
    },
  };
}
