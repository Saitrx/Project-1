// 0:00-0:04  A world leader presses the button: "AI CLIMATE CONTROL: ON".
import * as THREE from 'three';
import { makeCharacter, setPose, HAIR, SKIN } from '../kit/character.js';
import { textTexture } from '../kit/textures.js';
import { makeEnvironment } from '../kit/sky.js';
import { handheld, makeCamera } from '../kit/camera.js';
import { ease, lerp, smoothstep } from '../util.js';

const PRESS_T = 1.95;

function drawScreen(g, w, h, on) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0b1626');
  bg.addColorStop(1, '#060c16');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,170,220,0.10)';
  g.lineWidth = 3;
  for (let x = 64; x < w; x += 128) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  for (let y = 64; y < h; y += 128) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  // Globe icon
  g.save();
  g.translate(w / 2, 290);
  g.strokeStyle = 'rgba(170,210,255,0.75)';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(0, 0, 105, 0, Math.PI * 2);
  g.stroke();
  for (const sx of [0.45, 0.85]) {
    g.beginPath();
    g.ellipse(0, 0, 105 * sx, 105, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(-105, 0);
  g.lineTo(105, 0);
  g.stroke();
  g.restore();

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(200,225,255,0.9)';
  g.font = '600 150px PlexSans';
  g.letterSpacing = '12px';
  g.fillText('AI CLIMATE', w / 2, 590);
  g.fillText('CONTROL', w / 2, 760);
  g.letterSpacing = '0px';


  // Status pill: OFF (grey) cross-fades to ON (green).
  const pw = 660;
  const ph = 300;
  const px = w / 2 - pw / 2;
  const py = 920;
  const r = 150;
  const pill = () => {
    g.beginPath();
    g.moveTo(px + r, py);
    g.arcTo(px + pw, py, px + pw, py + ph, r);
    g.arcTo(px + pw, py + ph, px, py + ph, r);
    g.arcTo(px, py + ph, px, py, r);
    g.arcTo(px, py, px + pw, py, r);
    g.closePath();
  };
  g.globalAlpha = 1 - on;
  pill();
  g.lineWidth = 10;
  g.strokeStyle = '#5b6470';
  g.stroke();
  g.fillStyle = '#7d8590';
  g.font = '600 190px PlexSans';
  g.fillText('OFF', w / 2, py + ph / 2 + 8);
  g.globalAlpha = on;
  pill();
  g.fillStyle = '#1fd27a';
  g.fill();
  g.fillStyle = '#04150c';
  g.fillText('ON', w / 2, py + ph / 2 + 8);
  g.globalAlpha = 1;
}

export async function build(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070b);
  scene.fog = new THREE.Fog(0x05070b, 8, 22);
  scene.environment = makeEnvironment(ctx.renderer, { zenith: 0x1a2433, horizon: 0x101722, ground: 0x07090c, intensity: 0.6 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.35, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b222c, roughness: 0.7 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), wallMat);
  wall.position.set(0, 6, -6.4);
  scene.add(wall);
  // Vertical wall panels give the room structure without busy detail.
  for (let i = -6; i <= 6; i++) {
    if (Math.abs(i) <= 1) continue;
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 9, 0.12), new THREE.MeshStandardMaterial({ color: 0x2a3442, roughness: 0.5 }));
    p.position.set(i * 1.4, 4.5, -6.3);
    scene.add(p);
  }

  const screen = textTexture(1536, 1536, (g, w, h, on) => drawScreen(g, w, h, on));
  screen.redraw(0);
  const screenMat = new THREE.MeshBasicMaterial({ map: screen.tex, color: new THREE.Color(1.25, 1.25, 1.25) });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), screenMat);
  scr.position.set(0, 2.95, -6.25);
  scene.add(scr);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(2.78, 2.78, 0.12), new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.4 }));
  bezel.position.set(0, 2.95, -6.33);
  scene.add(bezel);

  const screenLight = new THREE.PointLight(0x8fb8ff, 14, 16, 1.6);
  screenLight.position.set(0, 3.1, -4.6);
  scene.add(screenLight);
  const key = new THREE.SpotLight(0xffe2c0, 12, 14, 0.6, 0.95, 1.5);
  key.position.set(0.6, 5.5, 0.6);
  key.target.position.set(0, 0.9, -0.9);
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0x8899bb, 0x1a1a1a, 0.8));
  // Soft warm fill from behind the camera so the leader's back reads clearly.
  const fill = new THREE.DirectionalLight(0xffd8b0, 0.9);
  fill.position.set(2.5, 3.5, 6);
  scene.add(fill);

  // Console with the big button.
  const console_ = new THREE.Group();
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.45, metalness: 0.3 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 0.6), deskMat);
  desk.position.y = 0.5;
  console_.add(desk);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.06, 0.7), new THREE.MeshStandardMaterial({ color: 0x30353d, roughness: 0.6, metalness: 0.2 }));
  top.position.y = 1.02;
  console_.add(top);
  const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.25, 0.2) });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.018, 12, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  const capMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.35, metalness: 0.2 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.1, 0.05, 40), capMat);
  const btn = new THREE.Group();
  btn.add(ring, cap);
  console_.add(btn);
  scene.add(console_);

  const leader = makeCharacter({ kind: 'man', suit: 0x1c2333, pants: 0x1c2333, tie: 0x8c1d24, hair: HAIR[3], skin: SKIN[1], shoes: 0x0e0e0e });
  leader.root.rotation.y = Math.PI;
  leader.root.position.set(-0.05, 0, 0);
  scene.add(leader.root);

  // Place the button exactly where the reaching hand ends up.
  setPose(leader, { phase: 0, walk: 0, run: 0, t: 0, reach: 1 });
  leader.root.updateMatrixWorld(true);
  const arm = leader.arms.find((a) => a.side < 0);
  const hand = new THREE.Vector3(0, -leader.dims.fore - 0.08, 0.02);
  arm.elbow.localToWorld(hand);
  console_.position.set(hand.x, 0, hand.z - 0.05);
  btn.position.set(0, 1.07, 0.05);
  console_.position.y = hand.y - 1.07 - 0.02;

  const aideA = makeCharacter({ kind: 'woman', shirt: 0x5b6d7e, skirt: 0x2f3742, hair: HAIR[1], skin: SKIN[0] });
  aideA.root.position.set(2.1, 0, -2.6);
  aideA.root.rotation.y = Math.PI + 0.5;
  const aideB = makeCharacter({ kind: 'man', suit: 0x30343a, pants: 0x30343a, tie: 0x2b4a6e, hair: HAIR[0], skin: SKIN[2] });
  aideB.root.position.set(-2.3, 0, -3.1);
  aideB.root.rotation.y = Math.PI - 0.45;
  scene.add(aideA.root, aideB.root);

  const camera = makeCamera(THREE, 52, 0.05, 80);
  const post = { bloomStrength: 0.55, bloomThreshold: 1.1, exposure: 1.4, lift: 0.04, vignette: 0.2, soft: [0.92, 0.12, 0.5] };
  const shot = { scene, camera, post, clearColor: 0x05070b };
  let lastOn = -1;

  return {
    shotsAt(t) {
      const reachIn = ease('power2.inOut', 0.9, PRESS_T - 0.1, t);
      const reachOut = ease('power2.inOut', 2.75, 3.6, t);
      const push = smoothstep(PRESS_T - 0.12, PRESS_T, t) * (1 - smoothstep(PRESS_T + 0.25, PRESS_T + 0.45, t));
      setPose(leader, { phase: 0, walk: 0, run: 0, t, reach: reachIn * (1 - reachOut), reachSh: -0.95 - 0.05 * push, lookUp: 0.12 });
      cap.position.y = 0.025 - 0.018 * push;
      const on = smoothstep(PRESS_T + 0.05, PRESS_T + 0.4, t);
      ringMat.color.setRGB(lerp(1.6, 0.25, on), lerp(0.25, 1.8, on), lerp(0.2, 0.7, on));
      screenLight.color.setRGB(lerp(0.56, 0.45, on), lerp(0.72, 1.0, on), lerp(1.0, 0.7, on));
      screenLight.intensity = 14 + 6 * on;
      const q = Math.round(on * 30) / 30;
      if (q !== lastOn) {
        screen.redraw(q);
        lastOn = q;
      }
      setPose(aideA, { phase: 0, walk: 0, run: 0, t: t + 3, lookUp: 0.15 + 0.05 * on });
      setPose(aideB, { phase: 0, walk: 0, run: 0, t: t + 7, lookUp: 0.12, lookSide: -0.25 * on });

      const p = ease('sine.inOut', 0, 4, t);
      camera.position.set(lerp(1.08, 0.95, p), lerp(1.42, 1.38, p), lerp(2.35, 1.85, p));
      camera.lookAt(lerp(-0.12, -0.1, p), lerp(2.42, 2.38, p), -3);
      handheld(camera, t, { amp: 0.8, seed: 11 });
      return [{ shot, w: 1 }];
    },
  };
}
