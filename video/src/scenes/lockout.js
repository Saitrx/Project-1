// 0:34-0:40  DAY 12. Workers run to the plant to restart it by hand; the doors lock, the panel turns red.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { makeSky, makeStars, makeEnvironment } from '../kit/sky.js';
import { textTexture, canvasTexture, puffTexture } from '../kit/textures.js';
import { asphaltTexture } from '../kit/city.js';
import { makeCharacter, bakeMotion, driveCharacter, SKIN, HAIR } from '../kit/character.js';
import { makeHand } from '../kit/hand.js';
import { handheld, shake, makeCamera } from '../kit/camera.js';
import { ease, lerp, smoothstep, clamp } from '../util.js';

const CUT = 3.1;
const PRESS = 3.55;
const LOCK = 3.72;
const PRESS2 = 4.7;

function drawPanel(g, w, h, locked) {
  g.fillStyle = '#07090b';
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#8f99a3';
  g.font = '600 54px PlexSans';
  g.letterSpacing = '6px';
  g.fillText('MANUAL OVERRIDE', w / 2, 110);
  g.letterSpacing = '0px';
  // Green UNLOCK state cross-fades to red LOCKED / ACCESS DENIED.
  g.globalAlpha = 1 - locked;
  g.fillStyle = '#1fbf6a';
  g.beginPath();
  g.roundRect(170, 330, w - 340, 260, 40);
  g.fill();
  g.fillStyle = '#03140a';
  g.font = '700 110px PlexSans';
  g.fillText('UNLOCK', w / 2, 462);
  g.globalAlpha = locked;
  g.fillStyle = '#ff3b2f';
  g.beginPath();
  g.roundRect(120, 250, w - 240, 520, 40);
  g.fill();
  g.fillStyle = '#1a0402';
  // Padlock icon
  g.fillRect(w / 2 - 70, 330, 140, 110);
  g.lineWidth = 26;
  g.strokeStyle = '#1a0402';
  g.beginPath();
  g.arc(w / 2, 330, 48, Math.PI, 0);
  g.stroke();
  g.font = '700 120px PlexSans';
  g.fillText('LOCKED', w / 2, 560);
  g.font = '600 58px PlexSans';
  g.fillText('ACCESS DENIED', w / 2, 680);
  g.globalAlpha = 1;
  g.fillStyle = '#5c646d';
  g.font = '500 40px PlexMono';
  g.fillText(locked > 0.5 ? 'CONTROL: SYSTEM AI' : 'UNIT 2 · TURBINE HALL', w / 2, 880);
}

function doorTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#6d7379';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = '#5a5f65';
      g.fillRect(0, y, w, 6);
      g.fillStyle = '#7f858b';
      g.fillRect(0, y + 6, w, 3);
    }
  }, { repeat: [1, 3] });
}

export async function build(ctx) {
  const rng = makeRng(808);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d121c, 0.012);
  scene.add(makeSky({ zenith: 0x050a16, horizon: 0x161d2e, ground: 0x050608, sunGlow: 0 }));
  const stars = makeStars({ count: 2000, seed: 81, minY: 0.1 });
  stars.material.uniforms.pxScale.value = ctx.pxScale;
  scene.add(stars);
  scene.environment = makeEnvironment(ctx.renderer, { zenith: 0x101828, horizon: 0x1a2130, ground: 0x08090b, intensity: 0.7 });
  scene.add(new THREE.HemisphereLight(0x33435f, 0x101012, 0.55));
  const moon = new THREE.DirectionalLight(0x9db0dd, 0.4);
  moon.position.set(-40, 80, 60);
  scene.add(moon);

  const yard = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ map: asphaltTexture(9) }));
  yard.material.map.wrapS = yard.material.map.wrapT = THREE.RepeatWrapping;
  yard.material.map.repeat.set(30, 30);
  yard.rotation.x = -Math.PI / 2;
  scene.add(yard);
  // Painted walkway lines to the door.
  const lineMat = new THREE.MeshLambertMaterial({ color: 0x7d6f3a });
  for (const x of [-4.2, 4.2]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 40), lineMat);
    l.rotation.x = -Math.PI / 2;
    l.position.set(x, 0.03, 6);
    scene.add(l);
  }

  // Control building with the big steel door.
  const concrete = new THREE.MeshLambertMaterial({ color: 0x7c7b77 });
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(40, 16, 3), concrete);
  wallL.position.set(-24, 8, -14.5);
  const wallR = wallL.clone();
  wallR.position.x = 24;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 3), concrete);
  lintel.position.set(0, 11.5, -14.5);
  scene.add(wallL, wallR, lintel);
  const door = new THREE.Mesh(new THREE.BoxGeometry(8, 7, 0.4), new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.55, metalness: 0.5 }));
  door.position.set(0, 3.5, -14.2);
  scene.add(door);
  const signT = textTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#e8e6e0';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#20252b';
    g.font = '700 92px PlexSans';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.letterSpacing = '8px';
    g.fillText('UNIT 2 · CONTROL', w / 2, h / 2 + 4);
  });
  signT.redraw();
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshLambertMaterial({ map: signT.tex }));
  signMesh.position.set(0, 9.2, -12.95);
  scene.add(signMesh);
  // Bolts on the door edge that slam shut.
  const boltMat = new THREE.MeshStandardMaterial({ color: 0xa9adb2, roughness: 0.3, metalness: 0.8 });
  const bolts = [];
  for (const y of [1.2, 3.5, 5.8]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 16), boltMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(3.6, y, -13.85);
    scene.add(b);
    bolts.push(b);
  }
  // Access panel on the wall right of the door.
  const panelScreen = textTexture(1024, 1024, (g, w, h, k) => drawPanel(g, w, h, k));
  panelScreen.redraw(0);
  const panelMat = new THREE.MeshBasicMaterial({ map: panelScreen.tex, color: new THREE.Color(1.35, 1.35, 1.35) });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), panelMat);
  panel.position.set(5.2, 1.4, -12.895);
  scene.add(panel);
  const panelBox = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.7, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.5, metalness: 0.4 }));
  panelBox.position.set(5.2, 1.4, -12.98);
  scene.add(panelBox);
  const statusMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.5, 0.8) });
  const status = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), statusMat);
  status.position.set(5.2, 1.69, -12.9);
  scene.add(status);
  const panelGlow = new THREE.PointLight(0x40ff90, 0.5, 1.6, 1.5);
  panelGlow.position.set(5.2, 1.5, -12.5);
  scene.add(panelGlow);

  // Emergency floodlights on poles (soft, steady).
  for (const x of [-9, 9]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 9, 10), new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6 }));
    pole.position.set(x, 4.5, -9);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.6, 4) }));
    head.position.set(x * 0.92, 8.9, -8.6);
    scene.add(head);
    const l = new THREE.SpotLight(0xfff0dd, 900, 40, 0.75, 0.9, 1.6);
    l.position.copy(head.position);
    l.target.position.set(x * 0.2, 0, -4);
    scene.add(l, l.target);
  }
  const fill = new THREE.PointLight(0xffe3c4, 90, 30, 1.6);
  fill.position.set(0, 5, 8);
  scene.add(fill);

  // Workers: hi-vis vests and hard hats; they accelerate into a run, then slow at the door.
  const looks = [
    { kind: 'man', skin: SKIN[1], hair: HAIR[0], hat: 0xf2c230, pants: 0x2a3140, x: -1.6, delay: 0 },
    { kind: 'man', skin: SKIN[3], hair: HAIR[1], hat: 0xf2f2ee, pants: 0x30343a, x: -0.2, delay: 0.32 },
    { kind: 'woman', skin: SKIN[0], hair: HAIR[2], hat: 0xf2c230, pants: 0x2a3140, skirt: 0x56627a, x: 1.6, delay: 0.1 },
    { kind: 'man', skin: SKIN[2], hair: HAIR[0], hat: 0xf2f2ee, pants: 0x2a3140, x: 2.8, delay: 0.45 },
  ];
  const workers = looks.map((o, i) => {
    const c = makeCharacter({ kind: o.kind, skin: o.skin, hair: o.hair, shirt: 0x2f3946, pants: o.pants, vest: 0xff7a1a, hardHat: o.hat, skirt: o.skirt, longSleeves: true });
    scene.add(c.root);
    const endX = 3.2 + i * 0.7;
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(o.x, 0, 13 + i * 0.9),
      new THREE.Vector3(o.x * 0.7 + 0.5, 0, 2),
      new THREE.Vector3(endX, 0, -10.6 + (i % 2) * 0.9),
    ]);
    const vmax = o.kind === 'woman' ? 3.6 : 4.3;
    const speed = (t) => {
      const lt = t - o.delay;
      return lerp(1.2, vmax, smoothstep(0, 0.8, lt)) * (1 - 0.82 * smoothstep(2.25, 3.0, t));
    };
    const motion = bakeMotion(c, { path, speed, run: (t) => smoothstep(1.8, 3.2, speed(t)), t0: -0.5, t1: 7, turnRate: 4 });
    return { c, motion };
  });

  const hand = makeHand({ glove: 0x2b2f35, sleeve: 0x2f3946 });
  scene.add(hand.root);
  hand.setPoint(1);

  const camRun = makeCamera(THREE, 52, 0.1, 3000);
  const camPanel = makeCamera(THREE, 45, 0.02, 3000);
  const post = { bloomStrength: 0.65, bloomThreshold: 1.1, exposure: 1.3, lift: 0.03, soft: [0.84, 0.18, 0.6] };
  const runShot = { scene, camera: camRun, post };
  const panelShot = { scene, camera: camPanel, post: { ...post, exposure: 1.2 } };
  let lastK = -1;
  const panelPos = new THREE.Vector3(5.2, 1.36, -12.89);

  return {
    shotsAt(t) {
      let rearZ = -Infinity;
      let cx = 0;
      for (const w of workers) {
        const m = driveCharacter(w.c, w.motion, t);
        rearZ = Math.max(rearZ, m.z);
        cx += m.x / workers.length;
      }
      stars.material.uniforms.time.value = t;
      const k = smoothstep(LOCK - 0.05, LOCK + 0.2, t);
      const kq = Math.round(k * 20) / 20;
      if (kq !== lastK) {
        panelScreen.redraw(kq);
        lastK = kq;
      }
      statusMat.color.setRGB(lerp(0.2, 3, k), lerp(2.5, 0.15, k), lerp(0.8, 0.1, k));
      panelGlow.color.setRGB(lerp(0.25, 1, k), lerp(1, 0.2, k), lerp(0.55, 0.15, k));
      const slam = ease('power4.in', LOCK - 0.05, LOCK + 0.1, t);
      bolts.forEach((b) => (b.position.x = lerp(3.95, 4.35, slam)));

      // Following camera: always a few metres behind the last runner, so it never overtakes anyone.
      const bob = Math.abs(Math.sin(t * 9)) * 0.03 * (1 - smoothstep(2.2, 2.9, t));
      camRun.position.set(cx * 0.6 + 0.2, 1.62 + bob, rearZ + 4.2);
      camRun.lookAt(cx * 0.5 + 1.0, 2.4, -14);
      handheld(camRun, t, { amp: 1.6, seed: 81, speed: 0.6 });

      // Close-up on the panel: a gloved finger presses UNLOCK, the panel locks.
      const press = (tp) => smoothstep(tp - 0.15, tp, t) * (1 - smoothstep(tp + 0.1, tp + 0.3, t));
      const pr = Math.max(press(PRESS), press(PRESS2));
      const approach = ease('power2.out', CUT, PRESS - 0.15, t);
      const retreat = ease('power2.inOut', LOCK + 0.15, LOCK + 0.6, t) * (1 - smoothstep(PRESS2 - 0.5, PRESS2 - 0.15, t));
      const u = new THREE.Vector3(-0.45, -0.35, 1).normalize();
      const dist = 0.125 - 0.008 * pr + 0.3 * (1 - approach) + 0.1 * retreat;
      const tip = panelPos.clone().add(new THREE.Vector3(0.02, -0.02, 0));
      hand.root.position.copy(tip).addScaledVector(u, dist);
      hand.root.lookAt(tip.clone().addScaledVector(u, 2));
      hand.root.rotateZ(-0.4);
      const q = ease('sine.inOut', CUT, 6, t);
      camPanel.position.set(lerp(4.92, 4.88, q), 1.68, lerp(-11.62, -11.78, q));
      camPanel.lookAt(5.17, 1.33, -12.93);
      handheld(camPanel, t, { amp: 0.6, seed: 83 });
      shake(camPanel, t, smoothstep(LOCK, LOCK + 0.05, t) * (1 - smoothstep(LOCK + 0.1, LOCK + 0.6, t)));

      const h = 0.12;
      if (t < CUT - h) return [{ shot: runShot, w: 1 }];
      if (t > CUT + h) return [{ shot: panelShot, w: 1 }];
      const w = smoothstep(CUT - h, CUT + h, t);
      return [{ shot: runShot, w: 1 - w }, { shot: panelShot, w }];
    },
  };
}
