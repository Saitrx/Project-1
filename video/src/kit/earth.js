// Earth with real coastlines (Natural Earth land polygons), baked once on the GPU into
// mipmapped equirectangular textures: day albedo, night lights, clouds.
import * as THREE from 'three';
import { feature } from 'topojson-client';

const TW = 4096;
const TH = 2048;

// Major metro regions [lon, lat, weight] that shape the night-lights pattern.
const CITIES = [
  [-74, 40.7, 1.2], [-87.6, 41.9, 0.9], [-118.2, 34, 1.1], [-122.4, 37.8, 0.8], [-95.4, 29.8, 0.8], [-80.2, 25.8, 0.7],
  [-84.4, 33.7, 0.7], [-77, 38.9, 0.8], [-71, 42.4, 0.7], [-79.4, 43.7, 0.7], [-73.6, 45.5, 0.6], [-99.1, 19.4, 1.0],
  [-46.6, -23.5, 1.1], [-43.2, -22.9, 0.9], [-58.4, -34.6, 0.9], [-70.6, -33.4, 0.6], [-77, -12, 0.6], [-74, 4.7, 0.6],
  [-0.1, 51.5, 1.1], [2.35, 48.85, 1.0], [13.4, 52.5, 0.8], [4.9, 52.4, 0.8], [6.9, 50.9, 0.9], [12.5, 41.9, 0.7],
  [9.2, 45.5, 0.8], [-3.7, 40.4, 0.8], [2.2, 41.4, 0.6], [21, 52.2, 0.6], [37.6, 55.8, 1.0], [30.3, 59.9, 0.6],
  [28.9, 41, 0.9], [31.2, 30, 1.1], [3.4, 6.5, 0.9], [36.8, -1.3, 0.5], [28, -26.2, 0.7], [18.4, -33.9, 0.5],
  [51.4, 35.7, 0.8], [46.7, 24.7, 0.6], [55.3, 25.2, 0.7], [44.4, 33.3, 0.6], [67, 24.9, 0.9], [74.3, 31.5, 0.8],
  [77.2, 28.6, 1.3], [72.9, 19.1, 1.2], [88.4, 22.6, 1.1], [80.3, 13.1, 0.9], [77.6, 13, 0.9], [78.5, 17.4, 0.9],
  [90.4, 23.8, 1.1], [100.5, 13.75, 0.9], [106.8, -6.2, 1.1], [103.8, 1.35, 0.6], [101.7, 3.1, 0.6], [121, 14.6, 1.0],
  [106.7, 10.8, 0.7], [116.4, 39.9, 1.2], [121.5, 31.2, 1.3], [113.3, 23.1, 1.3], [114.1, 22.4, 1.0], [104.1, 30.7, 1.0],
  [106.5, 29.6, 0.9], [114.3, 30.6, 0.9], [117.2, 39.1, 0.9], [126.9, 37.5, 1.2], [139.7, 35.7, 1.4], [135.5, 34.7, 1.1],
  [151.2, -33.9, 0.8], [145, -37.8, 0.7], [153, -27.5, 0.5], [115.9, -32, 0.4], [174.8, -36.8, 0.4],
];

const BAKE_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p, int oct) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * snoise(p); p *= 2.03; a *= 0.5; }
  return s;
}`;

const BAKE_FS = /* glsl */ `
uniform sampler2D tLand;
uniform sampler2D tCoast;
uniform sampler2D tInterior;
uniform sampler2D tCities;
uniform int mode;
uniform float green;
varying vec2 vUv;
${NOISE}
vec3 toS(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }
void main() {
  float lon = (vUv.x - 0.5) * 6.2831853;
  float lat = (vUv.y - 0.5) * 3.1415927;
  vec3 p = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  float land = smoothstep(0.35, 0.65, texture2D(tLand, vUv).r);
  float coast = texture2D(tCoast, vUv).r;
  float interior = texture2D(tInterior, vUv).r;
  float alat = abs(lat) * 57.29578;
  if (mode == 0) {
    float n1 = fbm(p * 4.0, 6);
    float n2 = fbm(p * 18.0 + 3.1, 4);
    vec3 deep = vec3(0.012, 0.045, 0.11);
    vec3 shallow = vec3(0.03, 0.14, 0.2);
    vec3 ocean = mix(deep, shallow, smoothstep(0.05, 0.6, coast)) * (0.9 + 0.1 * n2);
    float desert = exp(-pow((alat - 23.0) / 11.0, 2.0)) * smoothstep(0.25, 0.75, interior + n1 * 0.35);
    desert *= (1.0 - 0.75 * green);
    float tundra = smoothstep(52.0, 66.0, alat + n1 * 6.0);
    vec3 forest = mix(vec3(0.05, 0.13, 0.045), vec3(0.045, 0.19, 0.05), green);
    vec3 grass = mix(vec3(0.2, 0.24, 0.1), vec3(0.12, 0.26, 0.08), green);
    vec3 sand = vec3(0.52, 0.42, 0.27);
    vec3 tun = vec3(0.3, 0.3, 0.26);
    vec3 g = mix(forest, grass, smoothstep(-0.2, 0.4, n1 + n2 * 0.3));
    g = mix(g, sand, desert);
    g = mix(g, tun, tundra);
    float ice = smoothstep(66.0, 72.0, alat + n1 * 4.0 + interior * 6.0) * step(0.0, 1.0);
    if (lat < -1.05) ice = 1.0;
    g = mix(g, vec3(0.82, 0.85, 0.88), ice);
    g *= 0.85 + 0.3 * (n2 * 0.5 + 0.5);
    vec3 col = mix(ocean, g, land);
    gl_FragColor = vec4(toS(col), land);
  } else if (mode == 1) {
    float city = texture2D(tCities, vUv).r;
    float hf = fbm(p * 260.0, 3) * 0.5 + 0.5;
    float mid = fbm(p * 30.0 + 7.0, 4) * 0.5 + 0.5;
    // Lights cluster in metro regions and along temperate coasts; deserts and interiors stay dark.
    float coastal = smoothstep(0.2, 0.75, coast) * (1.0 - smoothstep(0.5, 0.8, interior));
    float temperate = smoothstep(62.0, 45.0, alat);
    float dens = city * 1.25 + coastal * temperate * 0.4 * smoothstep(0.45, 0.75, mid);
    float sparkle = smoothstep(0.5, 0.82, hf);
    float lights = clamp(dens * sparkle * 1.9, 0.0, 1.0) * land;
    float region = fbm(p * 5.0 + 11.0, 3) * 0.5 + 0.5;
    region = clamp((region - 0.25) / 0.5, 0.0, 1.0);
    gl_FragColor = vec4(lights, region, land, 1.0);
  } else {
    vec3 q = p * 2.2;
    vec3 w = vec3(fbm(q + 1.7, 4), fbm(q + 9.2, 4), fbm(q + 4.4, 4));
    float c = fbm(q * 1.6 + w * 1.4, 7);
    float band = 0.55 + 0.45 * cos(lat * 6.0) * 0.5 + 0.2 * smoothstep(40.0, 60.0, alat);
    float cov = smoothstep(0.05, 0.55, c * 0.9 + band * 0.35 - 0.12);
    gl_FragColor = vec4(cov, cov, cov, 1.0);
  }
}`;

function rasterLand(topo) {
  const c = document.createElement('canvas');
  c.width = TW;
  c.height = TH;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, TW, TH);
  g.fillStyle = '#fff';
  const land = feature(topo, topo.objects.land);
  const feats = land.type === 'FeatureCollection' ? land.features : [land];
  const X = (lon) => ((lon + 180) / 360) * TW;
  const Y = (lat) => ((90 - lat) / 180) * TH;
  for (const f of feats) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      g.beginPath();
      for (const ring of poly) {
        let prev = null;
        ring.forEach(([lon, lat], i) => {
          // Rings that wrap the antimeridian are drawn without the long horizontal jump.
          if (i === 0 || (prev && Math.abs(lon - prev) > 180)) g.moveTo(X(lon), Y(lat));
          else g.lineTo(X(lon), Y(lat));
          prev = lon;
        });
        g.closePath();
      }
      g.fill('evenodd');
    }
  }
  // Antarctica's ring runs along the map edge; make sure the pole rows are solid.
  g.fillRect(0, Y(-84), TW, TH - Y(-84));
  return c;
}

function blurred(src, px) {
  const c = document.createElement('canvas');
  c.width = TW;
  c.height = TH;
  const g = c.getContext('2d');
  g.filter = `blur(${px}px)`;
  g.drawImage(src, 0, 0);
  return c;
}

function citiesCanvas() {
  const c = document.createElement('canvas');
  c.width = TW;
  c.height = TH;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, TW, TH);
  g.globalCompositeOperation = 'lighter';
  for (const [lon, lat, w] of CITIES) {
    const x = ((lon + 180) / 360) * TW;
    const y = ((90 - lat) / 180) * TH;
    const r = 36 * w / Math.max(0.35, Math.cos((lat * Math.PI) / 180));
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const a = Math.min(1, 0.7 * w);
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(0.4, `rgba(255,255,255,${a * 0.45})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(x, y, r * Math.max(0.35, Math.cos((lat * Math.PI) / 180)) * 1.6, r, 0, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function tex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

export async function bakeEarth(renderer, maxAniso) {
  const topo = await (await fetch('node_modules/world-atlas/land-50m.json')).json();
  const landC = rasterLand(topo);
  const uniforms = {
    tLand: { value: tex(blurred(landC, 1.2)) },
    tCoast: { value: tex(blurred(landC, 14)) },
    tInterior: { value: tex(blurred(landC, 70)) },
    tCities: { value: tex(blurred(citiesCanvas(), 6)) },
    mode: { value: 0 },
    green: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: BAKE_VS, fragmentShader: BAKE_FS, uniforms, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const scene = new THREE.Scene();
  scene.add(quad);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const out = {};
  const bake = (name, mode, green) => {
    const rt = new THREE.WebGLRenderTarget(TW, TH, {
      depthBuffer: false,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
    });
    rt.texture.anisotropy = maxAniso;
    uniforms.mode.value = mode;
    uniforms.green.value = green;
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
    out[name] = rt.texture;
  };
  bake('day', 0, 0);
  bake('green', 0, 1);
  bake('night', 1, 0);
  bake('clouds', 2, 0);
  renderer.setRenderTarget(null);
  return out;
}

const EARTH_VS = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const EARTH_FS = /* glsl */ `
uniform sampler2D tDay;
uniform sampler2D tNight;
uniform sampler2D tClouds;
uniform vec3 sunDir;
uniform float sunI;
uniform float ambient;
uniform float lightsGain;
uniform float outage;
uniform float outageFront;
uniform float cloudAmt;
uniform float cloudShift;
uniform vec3 frontDir;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec4 dayS = texture2D(tDay, vUv);
  vec3 day = pow(dayS.rgb, vec3(2.2));
  float land = dayS.a;
  vec4 nt = texture2D(tNight, vUv);
  float cl = texture2D(tClouds, vUv + vec2(cloudShift, 0.0)).r * cloudAmt;
  float ndl = dot(N, normalize(sunDir));
  float lit = smoothstep(-0.12, 0.35, ndl);
  vec3 col = day * (max(ndl, 0.0) * sunI + ambient);
  vec3 R = reflect(-normalize(sunDir), N);
  col += (1.0 - land) * vec3(1.0, 0.95, 0.85) * pow(max(dot(R, V), 0.0), 40.0) * 0.35 * sunI * (1.0 - cl);
  col = mix(col, vec3(0.92) * (max(ndl, 0.0) * sunI * 1.1 + ambient * 1.3), cl);
  // City lights on the night side. The outage kills regions whose random value is below
  // the threshold, sweeping in from the front direction so it reads as a wave.
  // Regions beyond the moving front (d > front) are in the outage.
  float sweep = smoothstep(outageFront - 0.05, outageFront + 0.3, dot(N, normalize(frontDir)) * 0.5 + 0.5);
  float off = smoothstep(nt.g - 0.04, nt.g + 0.04, outage * sweep);
  float lights = nt.r * (1.0 - off) * (1.0 - lit) * (1.0 - cl * 0.8);
  col += vec3(1.0, 0.72, 0.42) * lights * lightsGain;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(0.25, 0.5, 1.0) * fres * (lit * 0.9 + 0.05) * sunI * 0.6;
  gl_FragColor = vec4(col, 1.0);
}`;

const ATMO_FS = /* glsl */ `
uniform vec3 sunDir;
uniform float strength;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  // Back faces: brightest just outside the planet's limb, fading to zero at the outer edge.
  float rim = pow(clamp(abs(dot(N, V)) / 0.27, 0.0, 1.0), 2.0);
  float lit = smoothstep(-0.3, 0.4, dot(N, normalize(sunDir)));
  gl_FragColor = vec4(vec3(0.3, 0.55, 1.0) * rim * (lit + 0.06) * strength, 1.0);
}`;

export function lonLatToVec3(lon, lat, r = 1) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
}

export function makeEarth(textures, { green = false } = {}) {
  const group = new THREE.Group();
  const uniforms = {
    tDay: { value: green ? textures.green : textures.day },
    tNight: { value: textures.night },
    tClouds: { value: textures.clouds },
    sunDir: { value: new THREE.Vector3(1, 0.2, 0.4).normalize() },
    sunI: { value: 2.2 },
    ambient: { value: 0.02 },
    lightsGain: { value: 3.0 },
    outage: { value: 0 },
    outageFront: { value: 1.2 },
    frontDir: { value: new THREE.Vector3(1, 0, 0) },
    cloudAmt: { value: 0.85 },
    cloudShift: { value: 0 },
  };
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 192, 96),
    new THREE.ShaderMaterial({ vertexShader: EARTH_VS, fragmentShader: EARTH_FS, uniforms })
  );
  group.add(earth);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.035, 128, 64),
    new THREE.ShaderMaterial({
      vertexShader: EARTH_VS,
      fragmentShader: ATMO_FS,
      uniforms: { sunDir: uniforms.sunDir, strength: { value: 1.4 } },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  group.add(atmo);
  return { group, earth, uniforms, atmo };
}
