// 1:01-1:05 (2,800,000x, AS BIG AS EARTH). Units: 1000 km. A flat-shaded low-poly Earth (land
// from Natural Earth via world-atlas) and, beside it, the taxi growing from a speck to the size of
// the planet.
import * as THREE from 'three';
import { feature } from 'topojson-client';
import { makeRng } from '../rng.js';
import { makeStars } from '../kit/sky.js';
import { makeVehicle, placeVehicle } from '../kit/vehicles.js';
import { makeCamera, drift } from '../kit/camrig.js';
import { carScale } from '../timeline.js';
import { lerp, smoothstep } from '../util.js';

const T0 = 61;
const T1 = 65;
const R = 6.371;

async function landMask() {
  const topo = await (await fetch('node_modules/world-atlas/land-110m.json')).json();
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff';
  const land = feature(topo, topo.objects.land);
  const feats = land.type === 'FeatureCollection' ? land.features : [land];
  const X = (lon) => ((lon + 180) / 360) * W;
  const Y = (lat) => ((90 - lat) / 180) * H;
  for (const f of feats) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      g.beginPath();
      for (const ring of poly) {
        let prev = null;
        ring.forEach(([lon, lat], i) => {
          if (i === 0 || (prev !== null && Math.abs(lon - prev) > 180)) g.moveTo(X(lon), Y(lat));
          else g.lineTo(X(lon), Y(lat));
          prev = lon;
        });
        g.closePath();
      }
      g.fill('evenodd');
    }
  }
  g.fillRect(0, Y(-80), W, H - Y(-80));
  const data = g.getImageData(0, 0, W, H).data;
  return (lon, lat) => {
    const x = Math.min(W - 1, Math.max(0, Math.floor(X(lon))));
    const y = Math.min(H - 1, Math.max(0, Math.floor(Y(lat))));
    return data[(y * W + x) * 4] / 255;
  };
}

function lowPolyEarth(mask) {
  const geo = new THREE.IcosahedronGeometry(R, 5).toNonIndexed();
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rng = makeRng(77);
  const col = new THREE.Color();
  const cen = new THREE.Vector3();
  for (let f = 0; f < pos.count; f += 3) {
    cen.set(0, 0, 0);
    for (let k = 0; k < 3; k++) cen.add(new THREE.Vector3().fromBufferAttribute(pos, f + k));
    cen.normalize();
    const lat = (Math.asin(cen.y) * 180) / Math.PI;
    const lon = (Math.atan2(cen.z, -cen.x) * 180) / Math.PI - 180;
    const lonN = ((lon + 540) % 360) - 180;
    const land = mask(lonN, lat) > 0.5;
    const j = rng.range(-0.04, 0.04);
    if (Math.abs(lat) > 70 || (land && Math.abs(lat) > 62 && rng.chance(0.5))) col.setRGB(0.93 + j, 0.95 + j, 0.97 + j);
    else if (land) {
      const dry = Math.abs(lat) > 14 && Math.abs(lat) < 34;
      col.setHex(dry && rng.chance(0.7) ? 0xc9b07a : rng.chance(0.5) ? 0x5c9a45 : 0x6fa94f);
      col.offsetHSL(0, 0, j);
    } else {
      col.setHex(0x2f6db6);
      col.offsetHSL(0, 0, j * 0.6);
    }
    for (let k = 0; k < 3; k++) colors.set([col.r, col.g, col.b], (f + k) * 3);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}

const ATMO_VS = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const ATMO_FS = /* glsl */ `
uniform vec3 sunDir;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float rim = pow(clamp(abs(dot(normalize(vN), V)) / 0.3, 0.0, 1.0), 2.0);
  float lit = smoothstep(-0.3, 0.4, dot(normalize(vN), sunDir));
  gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * rim * (lit + 0.05) * 1.3, 1.0);
}`;

export async function buildSpaceShot(ctx) {
  const scene = new THREE.Scene();
  const mask = await landMask();
  const sunDir = new THREE.Vector3(-0.75, 0.35, 0.56).normalize();
  const stars = makeStars({ count: 5000, seed: 171, minY: -1.1, radius: 900 });
  stars.material.uniforms.pxScale.value = ctx.pxScale;
  stars.material.uniforms.time.value = 0;
  scene.add(stars);
  scene.add(new THREE.AmbientLight(0x2a3550, 0.6));
  const sun = new THREE.DirectionalLight(0xfff4e6, 3.4);
  sun.position.copy(sunDir).multiplyScalar(100);
  scene.add(sun);

  const earth = new THREE.Group();
  const globe = lowPolyEarth(mask);
  earth.add(globe);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.035, 96, 48),
    new THREE.ShaderMaterial({ vertexShader: ATMO_VS, fragmentShader: ATMO_FS, uniforms: { sunDir: { value: sunDir } }, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  earth.add(atmo);
  earth.position.set(0.6, 8.6, -2);
  // Show the Americas and the Atlantic, tilted like a globe.
  globe.rotation.set(0.32, 1.9, 0.05);
  scene.add(earth);

  const v = makeVehicle('taxi');
  scene.add(v.group);
  const carPos = new THREE.Vector3(0.8, -9.6, 1.0);

  const camera = makeCamera(66, 5, 2000);
  return {
    ownScene: true,
    scene,
    camera,
    clearColor: 0x000000,
    range: [T0, T1],
    objects: [],
    update(t) {
      const s = carScale(t);
      // Metres -> thousands of km; centre the car on its body so it grows in place.
      const k = s / 1e6;
      placeVehicle(v, carPos.x, carPos.y - 0.76 * k, carPos.z, -0.62, k);
      v.group.rotation.set(0.14, -1.3, 0.05);
      earth.rotation.y = 0.03 * (t - T0);
      const d = lerp(40, 37, smoothstep(T0, T1, t));
      camera.position.set(-1.0, 1.0, d);
      camera.up.set(0, 1, 0);
      camera.lookAt(0.2, 1.6, 0);
      drift(camera, t, 1.2, 91);
      return { bloomThreshold: 1.2, bloomStrength: 0.45, exposure: 1.0, saturation: 1.05, vignette: 0.16, grain: 0.01 };
    },
  };
}
