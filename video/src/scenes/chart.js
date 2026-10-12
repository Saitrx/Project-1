// 0:40-0:46  DAY 20. Bar chart of pollution sources; bars vanish one by one until one remains.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeEnvironment } from '../kit/sky.js';
import { textTexture, puffTexture } from '../kit/textures.js';
import { handheld, makeCamera } from '../kit/camera.js';
import { ease, lerp, smoothstep } from '../util.js';

// [label, height, vanish time]; the last one standing is the one with no vanish time.
const BARS = [
  ['POWER', 3.4, 2.3],
  ['INDUSTRY', 2.7, 1.6],
  ['TRANSPORT', 2.2, 0.9],
  ['8.1 BILLION', 2.5, null],
  ['BUILDINGS', 1.5, 3.0],
  ['FLIGHTS', 1.0, 3.7],
];
const GAP = 1.15;

function label(text, red) {
  const t = textTexture(512, 128, (g, w, h, k) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 64px PlexSans';
    g.letterSpacing = '3px';
    g.fillStyle = k > 0 ? `rgb(${Math.round(225 + 30 * k)},${Math.round(228 - 150 * k)},${Math.round(232 - 160 * k)})` : '#e2e4e8';
    g.fillText(text, w / 2, h / 2);
  });
  t.redraw(0);
  return t;
}

export async function build(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c11);
  scene.fog = new THREE.Fog(0x0a0c11, 14, 34);
  scene.environment = makeEnvironment(ctx.renderer, { zenith: 0x2a3140, horizon: 0x141822, ground: 0x07080a, intensity: 0.9 });
  scene.add(new THREE.HemisphereLight(0x8090b0, 0x0a0a0c, 0.6));
  const key = new THREE.SpotLight(0xfff2e6, 160, 40, 0.6, 0.8, 1.4);
  key.position.set(2, 12, 6);
  key.target.position.set(0, 1, 0);
  scene.add(key, key.target);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.28, metalness: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  // Soft pool of light under the chart.
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.MeshBasicMaterial({ map: puffTexture(), color: new THREE.Color(0.16, 0.17, 0.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.02;
  scene.add(pool);
  // Baseline
  const base = new THREE.Mesh(new THREE.BoxGeometry(BARS.length * GAP + 0.6, 0.04, 0.04), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.62, 0.66) }));
  base.position.set(0, 0.02, 0.55);
  scene.add(base);
  const title = textTexture(1024, 128, (g, w, h) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 50px PlexSans';
    g.letterSpacing = '10px';
    g.fillStyle = '#9aa2ad';
    g.fillText('EMISSION SOURCES · ACTIVE', w / 2, h / 2);
  });
  title.redraw();
  const titleMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.575), new THREE.MeshBasicMaterial({ map: title.tex, transparent: true, depthWrite: false }));
  titleMesh.position.set(0, 4.0, -0.4);
  scene.add(titleMesh);

  const bars = BARS.map(([name, h, vanish], i) => {
    const x = (i - (BARS.length - 1) / 2) * GAP;
    const human = vanish === null;
    const mat = new THREE.MeshStandardMaterial({ color: human ? 0xb9c0ca : 0x7f8b9a, roughness: 0.35, metalness: 0.1, transparent: true });
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(0.72, 1, 0.72, 3, 0.05), mat);
    mesh.position.set(x, 0.5, 0);
    scene.add(mesh);
    const lab = label(name);
    const labMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.28), new THREE.MeshBasicMaterial({ map: lab.tex, transparent: true, depthWrite: false }));
    labMesh.rotation.x = -0.35;
    labMesh.position.set(x, 0.2, 0.9);
    scene.add(labMesh);
    return { mesh, mat, h, vanish, human, lab, labMesh, x, lastK: -1 };
  });

  const camera = makeCamera(THREE, 42, 0.1, 200);
  const post = { bloomStrength: 0.5, bloomThreshold: 1.2, exposure: 1.15, lift: 0.03, vignette: 0.25, soft: [1.0, 0.2, 0.5] };
  const shot = { scene, camera, post, clearColor: 0x0a0c11 };

  return {
    shotsAt(t) {
      for (const b of bars) {
        let k = 1;
        if (b.vanish !== null) {
          // Shrink down into the floor and fade: one bar at a time.
          const v = ease('power2.in', b.vanish, b.vanish + 0.5, t);
          k = 1 - v;
          b.mat.opacity = 1 - smoothstep(b.vanish + 0.25, b.vanish + 0.5, t);
          b.labMesh.material.opacity = 1 - smoothstep(b.vanish, b.vanish + 0.45, t);
        } else {
          const red = smoothstep(4.0, 4.6, t);
          b.mat.color.setRGB(lerp(0.48, 0.85, red), lerp(0.5, 0.16, red), lerp(0.55, 0.12, red));
          b.mat.emissive.setRGB(0.22 * red, 0.015 * red, 0.01 * red);
          const q = Math.round(red * 10) / 10;
          if (q !== b.lastK) {
            b.lab.redraw(q);
            b.lastK = q;
          }
          k = 1 + 0.15 * ease('power2.out', 4.0, 5.0, t);
        }
        const hh = Math.max(0.001, b.h * k);
        if (b.human) {
          // The surviving bar's label rises above it.
          const up = ease('power2.inOut', 4.0, 4.9, t);
          b.labMesh.position.set(b.x, lerp(0.2, hh + 0.38, up), lerp(0.9, 0.1, up));
          b.labMesh.rotation.x = lerp(-0.35, 0, up);
          b.labMesh.scale.setScalar(lerp(1, 1.35, up));
        }
        b.mesh.scale.y = hh;
        b.mesh.position.y = hh / 2;
        b.mesh.visible = hh > 0.002 && b.mat.opacity > 0.001;
      }
      const human = bars.find((b) => b.human);
      const p = ease('sine.inOut', -0.4, 3.9, t);
      const z = ease('power2.inOut', 3.7, 6.3, t);
      const start = new THREE.Vector3(lerp(-0.5, -0.2, p), lerp(3.4, 3.2, p), lerp(18.5, 16.5, p));
      const end = new THREE.Vector3(human.x + 0.3, 2.6, 9.6);
      camera.position.copy(start).lerp(end, z);
      camera.lookAt(lerp(0, human.x, z), lerp(1.25, 1.35, z), 0);
      titleMesh.material.opacity = 1 - smoothstep(3.6, 4.4, t);
      handheld(camera, t, { amp: 0.6, seed: 91 });
      return [{ shot, w: 1 }];
    },
  };
}
