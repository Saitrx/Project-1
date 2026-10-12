// Gradient sky dome, star field, puffy low-poly clouds and image-based ambient light.
import * as THREE from 'three';
import { makeRng } from '../rng.js';

const SKY_VS = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w * 0.99999;
}`;

const SKY_FS = /* glsl */ `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 ground;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float sunSize;
uniform float sunGlow;
uniform float horizonSharp;
uniform float milky;
uniform vec3 milkyAxis;
varying vec3 vDir;
float h21(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h21(i), h21(i + vec3(1,0,0)), f.x), mix(h21(i + vec3(0,1,0)), h21(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h21(i + vec3(0,0,1)), h21(i + vec3(1,0,1)), f.x), mix(h21(i + vec3(0,1,1)), h21(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), horizonSharp));
  col = mix(col, ground, smoothstep(0.0, -0.08, h));
  float sd = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(sd, 6.0) * sunGlow + smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, sd) * 6.0);
  if (milky > 0.0) {
    // Soft Milky Way band: low-frequency noise only, so nothing shimmers.
    float band = exp(-pow(dot(d, normalize(milkyAxis)) * 4.0, 2.0));
    float n = vnoise(d * 6.0) * 0.6 + vnoise(d * 14.0) * 0.4;
    col += vec3(0.16, 0.17, 0.22) * band * (0.4 + n) * milky * smoothstep(0.0, 0.25, h);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function makeSky(opts = {}) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VS,
    fragmentShader: SKY_FS,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(opts.zenith ?? 0x3a6ea8) },
      horizon: { value: new THREE.Color(opts.horizon ?? 0xc8d6e0) },
      ground: { value: new THREE.Color(opts.ground ?? 0x6a6a68) },
      sunDir: { value: new THREE.Vector3(...(opts.sunDir ?? [0.3, 0.4, -1])).normalize() },
      sunColor: { value: new THREE.Color(opts.sunColor ?? 0xfff2dd) },
      sunSize: { value: opts.sunSize ?? 0.0 },
      sunGlow: { value: opts.sunGlow ?? 0.2 },
      horizonSharp: { value: opts.horizonSharp ?? 0.6 },
      milky: { value: opts.milky ?? 0 },
      milkyAxis: { value: new THREE.Vector3(0.6, 0.3, 0.75).normalize() },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
  mesh.scale.setScalar(opts.radius ?? 4000);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.onBeforeRender = (renderer, scene, camera) => mesh.position.copy(camera.position);
  return mesh;
}

const STAR_VS = /* glsl */ `
attribute float size;
attribute float bright;
attribute float seed;
attribute vec3 tint;
uniform float pxScale;
uniform float time;
uniform float reveal;
varying float vB;
varying vec3 vTint;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99998;
  float tw = 0.85 + 0.15 * sin(time * (0.6 + seed * 0.9) + seed * 40.0);
  vB = bright * tw * reveal;
  vTint = tint;
  gl_PointSize = size * pxScale;
}`;

const STAR_FS = /* glsl */ `
varying float vB;
varying vec3 vTint;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float a = smoothstep(1.0, 0.0, r);
  a *= a;
  gl_FragColor = vec4(vTint * vB * a, 1.0);
}`;

export function makeStars({ count = 4000, seed = 7, radius = 3500, minY = -0.15 } = {}) {
  const rng = makeRng(seed);
  const pos = [];
  const size = [];
  const bright = [];
  const seeds = [];
  const tint = [];
  while (pos.length / 3 < count) {
    const u = rng.range(-1, 1);
    const th = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(1 - u * u);
    const v = new THREE.Vector3(r * Math.cos(th), u, r * Math.sin(th));
    if (v.y < minY) continue;
    pos.push(v.x * radius, v.y * radius, v.z * radius);
    const m = Math.pow(rng.next(), 6);
    size.push(3 + m * 9);
    bright.push(0.6 + m * 7);
    seeds.push(rng.next());
    const warm = rng.next();
    const c = new THREE.Color().setHSL(warm < 0.5 ? 0.6 : 0.09, 0.35 * rng.next(), 0.85);
    tint.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute('bright', new THREE.Float32BufferAttribute(bright, 1));
  g.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1));
  g.setAttribute('tint', new THREE.Float32BufferAttribute(tint, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VS,
    fragmentShader: STAR_FS,
    uniforms: { pxScale: { value: 1 }, time: { value: 0 }, reveal: { value: 1 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = -9;
  pts.onBeforeRender = (renderer, scene, camera) => pts.position.copy(camera.position);
  return pts;
}

// Puffy low-poly cloud cluster, like the reference's 3D cumulus.
export function makeCloud(rng, scale = 1, color = 0xf4f4f2) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.35) });
  const n = rng.int(5, 9);
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.5, 1.1) * scale;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), mat);
    m.position.set(rng.range(-1.6, 1.6) * scale, rng.range(0, 0.6) * scale, rng.range(-0.6, 0.6) * scale);
    m.scale.y = 0.75;
    g.add(m);
  }
  return g;
}

// Image-based ambient light from a simple gradient environment.
export function makeEnvironment(renderer, { zenith, horizon, ground, intensity = 1 }) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  const sky = makeSky({ zenith, horizon, ground, sunGlow: 0, radius: 10 });
  sky.onBeforeRender = () => {};
  sky.material.uniforms.zenith.value.multiplyScalar(intensity);
  sky.material.uniforms.horizon.value.multiplyScalar(intensity);
  sky.material.uniforms.ground.value.multiplyScalar(intensity);
  s.add(sky);
  const rt = pmrem.fromScene(s, 0.02, 0.1, 50);
  pmrem.dispose();
  return rt.texture;
}

// Camera-relative handheld drift: smooth seeded noise, never random per frame.
export { fbm1 } from '../rng.js';
