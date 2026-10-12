// 0:17-0:22  DAY 3. Airport departure board: every row flips to CANCELLED; planes parked outside.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { makeSky, makeEnvironment, makeCloud } from '../kit/sky.js';
import { textTexture, canvasTexture } from '../kit/textures.js';
import { makeCharacter, setPose, bakeMotion, driveCharacter, SKIN, HAIR } from '../kit/character.js';
import { handheld, makeCamera } from '../kit/camera.js';
import { ease, lerp, smoothstep, clamp } from '../util.js';

const ROWS = [
  ['08:15', 'LONDON', 'WF 102', 'ON TIME'],
  ['08:30', 'DUBAI', 'WF 318', 'BOARDING'],
  ['08:45', 'TOKYO', 'WF 077', 'ON TIME'],
  ['09:05', 'NEW YORK', 'WF 241', 'ON TIME'],
  ['09:20', 'PARIS', 'WF 156', 'DELAYED'],
  ['09:40', 'SINGAPORE', 'WF 410', 'ON TIME'],
  ['10:00', 'ISTANBUL', 'WF 233', 'ON TIME'],
  ['10:25', 'SYDNEY', 'WF 509', 'ON TIME'],
];
const FLIP_START = 0.55;
const FLIP_STEP = 0.36;
const FLIP_LEN = 0.32;

// Split-flap board, redrawn each frame from the scene time.
function drawBoard(g, w, h, t) {
  g.fillStyle = '#0d0f12';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8c35a';
  g.font = '600 64px PlexSans';
  g.letterSpacing = '10px';
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText('DEPARTURES', 70, 82);
  g.letterSpacing = '4px';
  g.font = '500 30px PlexSans';
  g.fillStyle = '#8b8f96';
  const cols = [70, 400, 1010, 1400];
  ['TIME', 'DESTINATION', 'FLIGHT', 'STATUS'].forEach((c, i) => g.fillText(c, cols[i], 170));
  g.letterSpacing = '0px';
  const rowH = 104;
  const cell = 56;
  ROWS.forEach((row, r) => {
    const y = 250 + r * rowH;
    const t0 = FLIP_START + r * FLIP_STEP;
    const k = clamp((t - t0) / FLIP_LEN);
    // Each text cell is drawn as dark flap tiles with characters on them.
    const drawCells = (text, x, color, n) => {
      for (let i = 0; i < n; i++) {
        g.fillStyle = '#1c1f24';
        g.fillRect(x + i * cell, y - 38, cell - 6, 76);
        g.fillStyle = '#0b0c0e';
        g.fillRect(x + i * cell, y - 1, cell - 6, 3);
        const ch = text[i] ?? '';
        if (ch) {
          g.fillStyle = color;
          g.font = '600 52px PlexMono';
          g.textAlign = 'center';
          g.fillText(ch, x + i * cell + (cell - 6) / 2, y + 2);
        }
      }
      g.textAlign = 'left';
    };
    drawCells(row[0], cols[0], '#f1efe8', 5);
    drawCells(row[1], cols[1], '#f1efe8', 10);
    drawCells(row[2], cols[2], '#f1efe8', 6);
    const statusX = cols[3];
    const n = 9;
    if (k <= 0) {
      drawCells(row[3], statusX, row[3] === 'DELAYED' ? '#f2b33d' : '#63d68a', n);
    } else if (k >= 1) {
      drawCells('CANCELLED', statusX, '#ff4a3d', n);
    } else {
      // Mid-flip: the falling flap squashes vertically, old text on top, new text revealed.
      drawCells('CANCELLED', statusX, '#ff4a3d', n);
      g.save();
      const squash = Math.cos(k * Math.PI);
      g.beginPath();
      g.rect(statusX - 4, y - 40, n * cell + 8, 40);
      g.clip();
      if (squash > 0) {
        g.translate(0, y);
        g.scale(1, squash);
        g.translate(0, -y);
        drawCells(row[3], statusX, row[3] === 'DELAYED' ? '#f2b33d' : '#63d68a', n);
      }
      g.restore();
    }
  });
}

function makePlane(rng, livery = 0xf2f2f0) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: livery, roughness: 0.4, metalness: 0.2 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x2e5d8c, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.3, metalness: 0.4 });
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(2.0, 30, 6, 20), body);
  fus.rotation.x = Math.PI / 2;
  fus.position.y = 4.4;
  g.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(34, 0.5, 5.5), body);
  wing.position.set(0, 3.4, 1);
  g.add(wing);
  const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7, 5), accent);
  tailFin.position.set(0, 8.4, -14.5);
  tailFin.rotation.x = -0.35;
  g.add(tailFin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(11, 0.35, 3), body);
  stab.position.set(0, 5.2, -15);
  g.add(stab);
  for (const sx of [-1, 1]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3.6, 20), dark);
    eng.rotation.x = Math.PI / 2;
    eng.position.set(sx * 6.5, 2.3, 2.5);
    g.add(eng);
  }
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 1.2), dark);
  cockpit.position.set(0, 5.3, 16.2);
  g.add(cockpit);
  const gear = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), dark);
  gear.position.set(0, 1.1, 14);
  g.add(gear);
  return g;
}

export async function build(ctx) {
  const rng = makeRng(505);
  const scene = new THREE.Scene();
  const ZEN = 0x9fb3c4;
  const HOR = 0xcfd6da;
  scene.add(makeSky({ zenith: ZEN, horizon: HOR, ground: 0x8a8a86, sunGlow: 0.2 }));
  scene.environment = makeEnvironment(ctx.renderer, { zenith: 0xb8c4cc, horizon: 0xc9cbc6, ground: 0x7a766e, intensity: 0.9 });
  scene.fog = new THREE.FogExp2(0xc4cbcf, 0.0009);
  scene.add(new THREE.HemisphereLight(0xe6edf2, 0x6c665c, 0.9));
  const sun = new THREE.DirectionalLight(0xfff1de, 1.0);
  sun.position.set(40, 60, -30);
  scene.add(sun);

  // Terminal interior: polished floor, ceiling with light panels, big glass wall.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: 0x9a958d, roughness: 0.3, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -10);
  scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: 0xe7e5e0, roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 9, -10);
  scene.add(ceil);
  const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.15, 2.0) });
  for (let x = -24; x <= 24; x += 8) {
    for (let z = 10; z >= -26; z -= 6) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.6), panelMat);
      p.rotation.x = Math.PI / 2;
      p.position.set(x, 8.95, z);
      scene.add(p);
    }
  }
  // Glass wall with mullions at the far side; tarmac and planes beyond.
  const mullionMat = new THREE.MeshStandardMaterial({ color: 0x5d636b, roughness: 0.4, metalness: 0.6 });
  for (let x = -30; x <= 30; x += 4) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 9, 0.3), mullionMat);
    m.position.set(x, 4.5, -28);
    scene.add(m);
  }
  for (const y of [0.2, 4.5, 8.8]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(62, 0.22, 0.3), mullionMat);
    m.position.set(0, y, -28);
    scene.add(m);
  }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(62, 9), new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.12, depthWrite: false }));
  glass.position.set(0, 4.5, -28.05);
  scene.add(glass);
  const tarmac = new THREE.Mesh(new THREE.PlaneGeometry(1200, 800), new THREE.MeshLambertMaterial({ color: 0x77787a }));
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.set(0, -0.4, -430);
  scene.add(tarmac);
  const planeRows = [
    { x: -30, z: -78, ry: 0.35, s: 1 },
    { x: 26, z: -95, ry: -0.5, s: 1 },
    { x: -70, z: -150, ry: 0.15, s: 1 },
    { x: 70, z: -170, ry: -0.2, s: 1 },
    { x: 0, z: -220, ry: 0.6, s: 1 },
  ];
  for (const pr of planeRows) {
    const pl = makePlane(rng);
    pl.position.set(pr.x, -0.4, pr.z);
    pl.rotation.y = Math.PI + pr.ry;
    scene.add(pl);
  }
  for (let i = 0; i < 7; i++) {
    const c = makeCloud(rng, rng.range(14, 26));
    c.position.set(rng.range(-400, 400), rng.range(110, 190), rng.range(-900, -600));
    scene.add(c);
  }
  // Control tower far away.
  const tower = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 46, 16), new THREE.MeshLambertMaterial({ color: 0xc7c5c0 }));
  shaft.position.y = 23;
  tower.add(shaft);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(8, 6, 7, 12), new THREE.MeshStandardMaterial({ color: 0x435463, roughness: 0.1, metalness: 0.8 }));
  cab.position.y = 49;
  tower.add(cab);
  tower.position.set(-120, -0.4, -380);
  scene.add(tower);

  // Departure board hung from the ceiling.
  const board = textTexture(2048, 1150, (g, w, h, t) => drawBoard(g, w, h, t));
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 3.7), new THREE.MeshBasicMaterial({ map: board.tex, color: new THREE.Color(1.15, 1.15, 1.15) }));
  boardMesh.position.set(-1.6, 5.6, -8);
  scene.add(boardMesh);
  const boardBack = new THREE.Mesh(new THREE.BoxGeometry(6.9, 4.0, 0.3), new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5 }));
  boardBack.position.set(-1.6, 5.6, -8.2);
  scene.add(boardBack);
  for (const x of [-4.4, 1.2]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), mullionMat);
    rod.position.set(x, 8.0, -8.2);
    rod.scale.y = 2.6;
    scene.add(rod);
  }
  // Row of seats.
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.6 });
  for (let i = 0; i < 8; i++) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.55), seatMat);
    seat.position.set(5 + i * 0.62, 0.48, -13);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.1), seatMat);
    back.position.set(5 + i * 0.62, 0.8, -13.28);
    scene.add(seat, back);
  }

  // Travellers looking up at the board; one walks in and stops.
  const people = [];
  const add = (opts, x, z, ry, look) => {
    const c = makeCharacter(opts);
    c.root.position.set(x, 0, z);
    c.root.rotation.y = ry;
    scene.add(c.root);
    people.push({ c, look, seed: people.length * 3 });
    return c;
  };
  add({ kind: 'man', shirt: 0x3c7dd6, pants: 0x29303d, hair: HAIR[0], skin: SKIN[1] }, -3.4, -1.0, Math.PI + 0.1, 0.42);
  add({ kind: 'woman', shirt: 0xc7a46a, skirt: 0x5a3e3a, hair: HAIR[2], skin: SKIN[0] }, -1.5, -0.4, Math.PI - 0.15, 0.4);
  add({ kind: 'girl', shirt: 0xe26d5a, skirt: 0x3d4f7a, hair: HAIR[1], skin: SKIN[0] }, -0.85, 0.0, Math.PI - 0.2, 0.55);
  add({ kind: 'man', shirt: 0x6f8f3c, pants: 0x3a2f2a, hair: HAIR[3], skin: SKIN[3] }, 1.2, -2.6, Math.PI - 0.4, 0.38);
  const suitcase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.24), new THREE.MeshStandardMaterial({ color: 0x8c2f2a, roughness: 0.5 }));
  suitcase.position.set(-3.0, 0.32, -0.7);
  scene.add(suitcase);
  const walker = makeCharacter({ kind: 'woman', shirt: 0x2f6f73, skirt: 0x2b2e3a, hair: HAIR[0], skin: SKIN[2] });
  scene.add(walker.root);
  const path = new THREE.CatmullRomCurve3([new THREE.Vector3(3.6, 0, 5.2), new THREE.Vector3(1.9, 0, 2.6), new THREE.Vector3(0.6, 0, 0.4)]);
  const motion = bakeMotion(walker, { path, speed: (t) => 1.25 * (1 - smoothstep(2.2, 3.2, t)), t0: -0.5, t1: 6 });

  const camera = makeCamera(THREE, 50, 0.1, 3000);
  const post = { bloomStrength: 0.4, bloomThreshold: 1.3, exposure: 1.0, lift: 0.04, saturation: 0.9, soft: [0.9, 0.2, 0.55] };
  const shot = { scene, camera, post };
  let lastQ = -1;

  return {
    shotsAt(t) {
      const q = Math.round(t * 30);
      if (q !== lastQ) {
        board.redraw(t);
        lastQ = q;
      }
      for (const p of people) setPose(p.c, { phase: 0, walk: 0, run: 0, t: t + p.seed, lookUp: p.look });
      const m = driveCharacter(walker, motion, t, { lookUp: 0.2 * smoothstep(2.4, 3.4, t) });
      // Once stopped, she turns to face the board.
      const face = smoothstep(2.6, 3.6, t);
      walker.root.rotation.y = lerp(m.heading, Math.PI - 0.3, face);
      const p = ease('sine.inOut', -0.5, 5.5, t);
      camera.position.set(lerp(0.9, 0.3, p), lerp(1.7, 1.72, p), lerp(9.8, 7.6, p));
      camera.lookAt(lerp(-1.3, -1.5, p), lerp(4.1, 4.35, p), -8);
      handheld(camera, t, { amp: 0.8, seed: 51 });
      return [{ shot, w: 1 }];
    },
  };
}
