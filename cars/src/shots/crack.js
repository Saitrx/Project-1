// 1:05-1:07 Black. Two headlights come on (one slow fade, no flashing), then the screen cracks:
// spider-web impacts with bright centres spread across the glass, the view goes dark grey and a
// few black shards fall away. The HUD text ("CAR SIZE: TOO BIG / HERE") is drawn by the overlay.
import * as THREE from 'three';
import { makeRng } from '../rng.js';
import { makeVehicle } from '../kit/vehicles.js';
import { makeCamera, shake } from '../kit/camrig.js';
import { clamp, smoothstep } from '../util.js';

const T0 = 65;
const T1 = 67;
const HIT = 65.95;
const IMPACTS = [
  { x: 0.54, y: 0.4, t: HIT, r: 1.0 },
  { x: 0.27, y: 0.66, t: HIT + 0.22, r: 0.62 },
  { x: 0.78, y: 0.71, t: HIT + 0.38, r: 0.5 },
];

// Crack lines drawn once into a 4K canvas: radial jagged lines plus web rings per impact.
function crackCanvas(W, H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const rng = makeRng(4242);
  const unit = W / 1080;
  for (const [n, imp] of IMPACTS.entries()) {
    const cx = imp.x * W;
    const cy = imp.y * H;
    const rays = 15 + n * -3;
    const maxR = imp.r * H * 0.75;
    const rayPts = [];
    for (let i = 0; i < rays; i++) {
      const a0 = (i / rays) * Math.PI * 2 + rng.range(-0.15, 0.15);
      const pts = [[cx, cy]];
      let r = 0;
      let a = a0;
      while (r < maxR * rng.range(0.55, 1)) {
        r += rng.range(18, 60) * unit;
        a += rng.range(-0.12, 0.12);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      rayPts.push(pts);
      for (let j = 1; j < pts.length; j++) {
        const u = j / pts.length;
        g.strokeStyle = `rgba(255,255,255,${(0.95 - 0.55 * u).toFixed(3)})`;
        g.lineWidth = (3.2 - 2.2 * u) * unit;
        g.beginPath();
        g.moveTo(pts[j - 1][0], pts[j - 1][1]);
        g.lineTo(pts[j][0], pts[j][1]);
        g.stroke();
      }
    }
    // Web rings: jagged links between neighbouring rays at a few radii.
    for (const ring of [0.08, 0.17, 0.3, 0.46]) {
      for (let i = 0; i < rays; i++) {
        const A = rayPts[i];
        const B = rayPts[(i + 1) % rays];
        const ia = Math.floor(A.length * ring * 2.2);
        const ib = Math.floor(B.length * ring * 2.2) + (rng.chance(0.5) ? 1 : 0);
        if (ia >= A.length || ib >= B.length || rng.chance(0.18)) continue;
        const pa = A[ia];
        const pb = B[ib];
        const mx = (pa[0] + pb[0]) / 2 + rng.range(-10, 10) * unit;
        const my = (pa[1] + pb[1]) / 2 + rng.range(-10, 10) * unit;
        g.strokeStyle = `rgba(235,240,245,${(0.75 - ring).toFixed(3)})`;
        g.lineWidth = (2.0 - ring * 2) * unit;
        g.beginPath();
        g.moveTo(pa[0], pa[1]);
        g.lineTo(mx, my);
        g.lineTo(pb[0], pb[1]);
        g.stroke();
      }
    }
    // Bright crushed centre.
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, 70 * unit * imp.r);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, 70 * unit * imp.r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

const GLASS_VS = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const GLASS_FS = /* glsl */ `
uniform sampler2D tCrack;
uniform vec3 imp[3];      // x, y, radius reached so far (uv units, y down)
uniform float aspect;
uniform float grey;
varying vec2 vUv;
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y);
  float m = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 d = (p - imp[i].xy) * vec2(1.0, aspect);
    m = max(m, 1.0 - smoothstep(imp[i].z - 0.03, imp[i].z, length(d)));
  }
  vec4 c = texture2D(tCrack, vec2(vUv.x, vUv.y));
  float a = c.a * m;
  // Dark grey frosting over the broken glass, plus the bright crack lines (HDR so they bloom a little).
  vec3 col = vec3(0.045) * grey + c.rgb * a * 1.6;
  gl_FragColor = vec4(col, clamp(grey * 0.97 + a, 0.0, 1.0));
}`;

export function buildCrackShot(ctx) {
  const scene = new THREE.Scene();
  const camera = makeCamera(50, 0.05, 200);
  camera.position.set(0, 1.0, 9);
  camera.lookAt(0, 0.9, 0);
  // The car's front in the dark: only its headlights read.
  const v = makeVehicle('taxi');
  v.group.position.set(0, 0, 0);
  v.group.scale.setScalar(1.6);
  scene.add(v.group);
  scene.add(new THREE.AmbientLight(0xffffff, 0.035));
  const heads = [];
  v.group.traverse((o) => {
    if (o.userData.headlight) {
      o.material = o.material.clone();
      heads.push({ o, base: o.material.color.clone() });
    }
  });

  const W = Math.round(ctx.engine.W);
  const H = Math.round(ctx.engine.H);
  const tex = new THREE.CanvasTexture(crackCanvas(W, H));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  const glassU = {
    tCrack: { value: tex },
    imp: { value: IMPACTS.map(() => new THREE.Vector3()) },
    aspect: { value: H / W },
    grey: { value: 0 },
  };
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: GLASS_VS, fragmentShader: GLASS_FS, uniforms: glassU, transparent: true, depthTest: false, depthWrite: false })
  );
  glass.frustumCulled = false;
  glass.renderOrder = 100;
  scene.add(glass);

  // Black shards falling away from the main impact, drawn directly in clip space.
  const rng = makeRng(99);
  const shards = [];
  const shardMat = new THREE.ShaderMaterial({
    vertexShader: 'void main() { gl_Position = vec4((modelMatrix * vec4(position, 1.0)).xy, 0.0, 1.0); }',
    fragmentShader: 'void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }',
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  for (let i = 0; i < 7; i++) {
    const sh = new THREE.Shape();
    const n = 3 + (i % 2);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const r = rng.range(0.03, 0.07);
      if (k === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), shardMat);
    m.renderOrder = 101;
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    const ang = rng.range(0, Math.PI * 2);
    const d = rng.range(0.05, 0.22);
    shards.push({ m, x0: 0.54 + Math.cos(ang) * d, y0: 0.4 + Math.sin(ang) * d * 0.56, t0: HIT + 0.35 + i * 0.07, vx: rng.range(-0.08, 0.08), spin: rng.range(-2, 2) });
    scene.add(m);
  }

  return {
    ownScene: true,
    scene,
    camera,
    clearColor: 0x000000,
    range: [T0, T1],
    objects: [],
    update(t) {
      // One slow fade-on of the headlights.
      const on = smoothstep(65.25, 65.75, t);
      for (const h of heads) h.o.material.color.copy(h.base).multiplyScalar((0.02 + 1.4 * on) * (1 - 0.97 * smoothstep(HIT, HIT + 0.4, t)));
      camera.position.set(0, 1.0, 9 - 0.6 * smoothstep(T0, HIT, t));
      camera.lookAt(0, 0.9, 0);
      shake(camera, t, 3.5 * smoothstep(HIT, HIT + 0.04, t) * (1 - smoothstep(HIT + 0.05, HIT + 0.7, t)), { seed: 5, freq: 18, trans: 0.03 });
      IMPACTS.forEach((imp, i) => {
        const r = imp.r * 0.75 * (1 - Math.pow(1 - clamp((t - imp.t) / 0.3), 3));
        glassU.imp.value[i].set(imp.x, imp.y, t >= imp.t ? r : -1);
      });
      glassU.grey.value = smoothstep(HIT, HIT + 0.3, t);
      // Shards: position in normalized screen coordinates, falling with gravity.
      for (const s of shards) {
        const a = t - s.t0;
        s.m.visible = a > 0;
        if (!s.m.visible) continue;
        const x = s.x0 + s.vx * a;
        const y = s.y0 + 0.9 * a * a;
        const m = new THREE.Matrix4().makeRotationZ(s.spin * a);
        m.premultiply(new THREE.Matrix4().makeScale(1, W / H, 1));
        m.setPosition(x * 2 - 1, 1 - y * 2, 0);
        s.m.matrix.copy(m);
      }
      return { bloomThreshold: 1.0, bloomStrength: 0.55, exposure: 1.0, vignette: 0.2, grain: 0.012, saturation: 1.0 };
    },
  };
}
