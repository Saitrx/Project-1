// 0:12-0:17  DAY 2. A highway full of stopped cars; a driver presses START, the dashboard stays dark.
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../rng.js';
import { makeSky, makeEnvironment, makeCloud } from '../kit/sky.js';
import { makeCity, makeFacadeSet, makeCar } from '../kit/city.js';
import { canvasTexture, puffTexture, textTexture } from '../kit/textures.js';
import { makeCharacter, setPose, bakeMotion, driveCharacter, SKIN, HAIR } from '../kit/character.js';
import { makeHand } from '../kit/hand.js';
import { handheld, makeCamera } from '../kit/camera.js';
import { sunShadow, castShadows, receiveShadows } from '../kit/shadows.js';
import { ease, lerp, smoothstep } from '../util.js';

const LANE = 3.6;
const CUT = 2.55; // wide shot -> dashboard close-up
const PRESS1 = 3.15;
const PRESS2 = 3.95;

function roadTexture() {
  // 21 m across: inner shoulder 2.7 m, 4 lanes of 3.6 m, outer shoulder 3.9 m. One tile = 12 m.
  return canvasTexture(1024, 1024, (g, w, h) => {
    g.fillStyle = '#56585b';
    g.fillRect(0, 0, w, h);
    const px = w / 21;
    g.fillStyle = '#e9e7df';
    g.fillRect((2.7 - 0.09) * px, 0, 0.18 * px, h);
    g.fillRect((2.7 + 4 * LANE - 0.09) * px, 0, 0.18 * px, h);
    for (let l = 1; l < 4; l++) {
      const x = (2.7 + l * LANE) * px;
      g.fillRect(x - 0.07 * px, 0, 0.14 * px, h * 0.25);
    }
  }, { repeat: [1, 60] });
}

function mergeCar(rng, color) {
  // Merge each car into one mesh per material: far fewer draw calls for a long jam.
  const car = makeCar(rng, { color });
  car.group.updateMatrixWorld(true);
  const byMat = new Map();
  car.group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (g.index) g.toNonIndexed && null;
    const key = o.material.uuid;
    if (!byMat.has(key)) byMat.set(key, { mat: o.material, geos: [] });
    byMat.get(key).geos.push(g.index ? g.toNonIndexed() : g);
  });
  const out = new THREE.Group();
  for (const { mat, geos } of byMat.values()) {
    for (const g of geos) {
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    out.add(new THREE.Mesh(BufferGeometryUtils.mergeGeometries(geos), mat));
  }
  return { group: out, length: car.length };
}

export async function build(ctx) {
  const rng = makeRng(404);
  const scene = new THREE.Scene();
  const ZEN = 0x4f86c2;
  const HOR = 0xcddbe5;
  scene.fog = new THREE.FogExp2(0xc3d2dd, 0.0013);
  scene.add(makeSky({ zenith: ZEN, horizon: HOR, ground: 0x9a9a96, sunDir: [-0.5, 0.35, -0.6], sunGlow: 0.25, horizonSharp: 0.32 }));
  scene.environment = makeEnvironment(ctx.renderer, { zenith: ZEN, horizon: HOR, ground: 0x6d6c68, intensity: 1.1 });
  scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x6f6a60, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0dc, 1.3);
  sun.position.set(-60, 80, 40);
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x8c8a78 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.3;
  scene.add(ground);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTexture() });
  for (const side of [1, -1]) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(21, 720), roadMat);
    road.rotation.x = -Math.PI / 2;
    if (side < 0) road.rotation.z = Math.PI; // mirror the markings for the other carriageway
    road.position.set(side * 11.7, 0, -320);
    scene.add(road);
  }
  // Concrete median barrier.
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 720), new THREE.MeshLambertMaterial({ color: 0xb9b6ae }));
  barrier.position.set(0, 0.45, -320);
  scene.add(barrier);
  // Light poles along the median.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a8f95, roughness: 0.5, metalness: 0.5 });
  for (let z = 40; z > -600; z -= 38) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 11, 8), poleMat);
    pole.position.set(0, 5.5, z);
    scene.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, 0.2), poleMat);
    arm.position.set(0, 10.9, z);
    scene.add(arm);
  }
  // Overhead gantry with a dark (powerless) sign.
  const gantry = new THREE.Group();
  for (const x of [-0.6, 22.6]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 0.4), poleMat);
    leg.position.set(x, 3.5, 0);
    gantry.add(leg);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(23.6, 0.5, 0.5), poleMat);
  beam.position.set(11, 6.8, 0);
  gantry.add(beam);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 0.25), new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.4 }));
  sign.position.set(11, 6.8, 0.2);
  gantry.add(sign);
  gantry.position.z = -70;
  scene.add(gantry);

  const set = makeFacadeSet(21, { lit: 0.08, glass: ['#7f93a6', '#8ea0b0', '#6f8497', '#9aa9b6'] });
  const city = makeCity({ seed: 22, x0: -500, x1: 500, z0: -1500, z1: -720, set, light: 0.5, env: 1.1, minH: 40, maxH: 170, density: 0.75 });
  scene.add(city.group);
  for (let i = 0; i < 16; i++) {
    const c = makeCloud(rng, rng.range(18, 34));
    c.position.set(rng.range(-700, 400), rng.range(120, 240), rng.range(-1400, -800));
    scene.add(c);
  }

  // The jam: cars in every lane, both carriageways, all stopped.
  const shadowMat = new THREE.MeshBasicMaterial({ map: puffTexture(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false });
  const shadowGeo = new THREE.PlaneGeometry(2.6, 5.6);
  const addCar = (x, z, dir, color) => {
    const c = mergeCar(rng, color);
    c.group.position.set(x, 0, z);
    c.group.rotation.y = dir > 0 ? Math.PI : 0;
    c.group.rotation.y += rng.range(-0.03, 0.03);
    scene.add(c.group);
    const sh = new THREE.Mesh(shadowGeo, shadowMat);
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(x, 0.02, z);
    scene.add(sh);
    return c;
  };
  const interiorZ = 36;
  const interiorLaneX = 1.2 + 2.7 + 2.5 * LANE;
  for (let lane = 0; lane < 4; lane++) {
    const x = 1.2 + 2.7 + (lane + 0.5) * LANE;
    for (let z = 48 + rng.range(0, 4); z > -420; z -= rng.range(6.6, 9.5)) {
      if (lane === 2 && Math.abs(z - interiorZ) < 5) continue;
      if (lane === 3 && z > -5 && z < 9) continue; // gap for the standing driver's car
      addCar(x + rng.range(-0.25, 0.25), z, 1);
    }
    const xo = -x;
    for (let z = 40 + rng.range(0, 4); z > -420; z -= rng.range(6.6, 9.5)) addCar(xo + rng.range(-0.25, 0.25), z, -1);
  }
  // The standing driver's car with its door open.
  addCar(1.2 + 2.7 + 3.5 * LANE, 2, 1, 0x2e4a6e);

  // People: a driver standing by his car, a woman walking along the shoulder toward camera,
  // a man walking away between the lanes.
  const driver = makeCharacter({ kind: 'man', shirt: 0xd9762b, pants: 0x2b3446, hair: HAIR[0], skin: SKIN[2] });
  driver.root.position.set(18.9, 0, 0.4);
  driver.root.rotation.y = -2.3;
  scene.add(driver.root);
  const walker = makeCharacter({ kind: 'woman', shirt: 0x3e8f8a, skirt: 0x7a6596, hair: HAIR[1], skin: SKIN[1] });
  scene.add(walker.root);
  const walkPath = new THREE.CatmullRomCurve3([new THREE.Vector3(21.4, 0, -12), new THREE.Vector3(21.5, 0, -4), new THREE.Vector3(21.3, 0, 6)]);
  const walkMotion = bakeMotion(walker, { path: walkPath, speed: () => 1.25, t0: -1, t1: 6 });
  const away = makeCharacter({ kind: 'man', shirt: 0x3c7dd6, pants: 0x5a2a24, hair: HAIR[2], skin: SKIN[0] });
  scene.add(away.root);
  const awayPath = new THREE.CatmullRomCurve3([new THREE.Vector3(14.7, 0, -6), new THREE.Vector3(14.75, 0, -20), new THREE.Vector3(14.7, 0, -40)]);
  const awayMotion = bakeMotion(away, { path: awayPath, speed: () => 1.35, t0: -1, t1: 6 });
  const kid = makeCharacter({ kind: 'boy', shirt: 0xf2c94c, pants: 0x2d4f7c, hair: HAIR[0], skin: SKIN[2] });
  kid.root.position.set(19.7, 0, 1.5);
  kid.root.rotation.y = -2.0;
  scene.add(kid.root);

  // Car interior for the close-up, parked in the gap in lane 3.
  const interior = new THREE.Group();
  interior.position.set(interiorLaneX, 0, interiorZ);
  scene.add(interior);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.7 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.5, metalness: 0.2 });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.32, 0.55), dashMat);
  dash.position.set(0, 0.92, -0.95);
  interior.add(dash);
  const dashTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.75), dashMat);
  dashTop.position.set(0, 1.1, -1.05);
  dashTop.rotation.x = 0.12;
  interior.add(dashTop);
  const cluster = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.13), new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.15, metalness: 0.5 }));
  cluster.position.set(-0.37, 1.03, -0.66);
  cluster.rotation.x = -0.25;
  interior.add(cluster);
  const centerScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.17), cluster.material);
  centerScreen.position.set(0.08, 1.0, -0.665);
  centerScreen.rotation.x = -0.2;
  interior.add(centerScreen);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 12, 40), trimMat);
  wheel.position.set(-0.37, 0.98, -0.5);
  wheel.rotation.x = -0.35;
  interior.add(wheel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), trimMat);
  hub.position.copy(wheel.position);
  hub.rotation.x = Math.PI / 2 - 0.35;
  interior.add(hub);
  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), dashMat);
    pillar.position.set(sx * 0.82, 1.45, -0.95);
    pillar.rotation.x = 0.5;
    pillar.rotation.z = -sx * 0.06;
    interior.add(pillar);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 1.8), new THREE.MeshStandardMaterial({ color: 0x5b5a57, roughness: 0.9 }));
  roof.position.set(0, 1.86, 0.1);
  interior.add(roof);
  const label = textTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#161719';
    g.beginPath();
    g.arc(128, 128, 126, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#3b3e43';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(128, 128, 112, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#8d9096';
    g.font = '600 46px PlexSans';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ENGINE', 128, 96);
    g.font = '600 56px PlexSans';
    g.fillText('START', 128, 150);
    g.font = '600 34px PlexSans';
    g.fillText('STOP', 128, 196);
  });
  label.redraw();
  // The cylinder cap's UVs are rotated and flipped relative to the camera; undo both.
  label.tex.center.set(0.5, 0.5);
  label.tex.rotation = Math.PI / 2;
  label.tex.repeat.set(-1, 1);
  const startBtn = new THREE.Group();
  const btnBody = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.02, 32), [trimMat, new THREE.MeshStandardMaterial({ map: label.tex, roughness: 0.4 }), trimMat]);
  btnBody.rotation.x = Math.PI / 2;
  startBtn.add(btnBody);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.007, 8, 32), trimMat);
  startBtn.add(bezel);
  startBtn.position.set(-0.06, 0.95, -0.665);
  startBtn.rotation.x = -0.2;
  interior.add(startBtn);
  const hand = makeHand({ sleeve: 0x2f3a4a, skin: SKIN[2] });
  interior.add(hand.root);
  hand.setPoint(1);

  sunShadow(scene, sun, { cx: 16, cz: 0, size: 32 });
  receiveShadows(ground);
  scene.traverse((o) => {
    if (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.material === roadMat) o.receiveShadow = true;
  });
  for (const c of [driver, walker, away, kid]) castShadows(c.root);
  scene.traverse((o) => {
    if (o.isMesh && !o.material.transparent && o.parent?.type === 'Group' && o.parent.parent === scene && o.parent !== interior) o.castShadow = true;
  });

  const camWide = makeCamera(THREE, 50, 0.1, 4000);
  const camIn = makeCamera(THREE, 50, 0.02, 4000);
  const post = { bloomStrength: 0.35, bloomThreshold: 1.5, exposure: 1.05, lift: 0.04, saturation: 0.95, soft: [0.8, 0.2, 0.7] };
  const wide = { scene, camera: camWide, post };
  const close = { scene, camera: camIn, post: { ...post, exposure: 1.0 } };
  const btnWorld = new THREE.Vector3();

  return {
    shotsAt(t) {
      setPose(driver, { phase: 0, walk: 0, run: 0, t, lookSide: Math.sin(t * 0.9) * 0.5, lookUp: 0.05 });
      setPose(kid, { phase: 0, walk: 0, run: 0, t: t + 2, lookUp: 0.25 });
      driveCharacter(walker, walkMotion, t);
      driveCharacter(away, awayMotion, t);

      const p = ease('sine.inOut', -0.3, CUT + 0.3, t);
      camWide.position.set(lerp(19.4, 19.0, p), 1.65, lerp(18, 12, p));
      camWide.lookAt(lerp(8.5, 8, p), 1.9, -55);
      handheld(camWide, t, { amp: 1, seed: 41 });

      // Close-up: the hand presses START twice; nothing lights up.
      const press = (tp) => smoothstep(tp - 0.18, tp, t) * (1 - smoothstep(tp + 0.12, tp + 0.32, t));
      const pr = Math.max(press(PRESS1), press(PRESS2));
      const approach = ease('power2.out', CUT, PRESS1 - 0.2, t);
      const q = ease('sine.inOut', CUT, 5, t);
      camIn.position.set(interiorLaneX - 0.24 + 0.02 * q, 1.2, interiorZ + 0.1 - 0.05 * q);
      camIn.lookAt(interiorLaneX - 0.07, 0.95, interiorZ - 0.66);
      // The index fingertip rests on the button; the arm comes in from the lower right.
      startBtn.getWorldPosition(btnWorld);
      const from = new THREE.Vector3(0.22, -0.3, 0.0).add(camIn.position);
      const u = from.sub(btnWorld).normalize();
      const dist = 0.128 - 0.009 * pr + 0.25 * (1 - approach);
      const P = btnWorld.clone().addScaledVector(u, dist);
      interior.worldToLocal(P);
      hand.root.position.copy(P);
      hand.root.lookAt(btnWorld.clone().addScaledVector(u, 2));
      hand.root.rotateZ(0.35);
      btnBody.position.y = -0.006 * pr;
      handheld(camIn, t, { amp: 0.7, seed: 43 });

      if (t < CUT - 0.12) return [{ shot: wide, w: 1 }];
      if (t > CUT + 0.12) return [{ shot: close, w: 1 }];
      const w = smoothstep(CUT - 0.12, CUT + 0.12, t);
      return [{ shot: wide, w: 1 - w }, { shot: close, w }];
    },
  };
}
