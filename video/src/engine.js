// Render pipeline: HDR multisampled scene -> soft bloom on bright lights only ->
// ACES filmic tone mapping + grade + dither -> composite 4K text overlay.
import * as THREE from 'three';

const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const PREFILTER_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tSrc, vUv + texel * vec2(-0.5, -0.5)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2( 0.5, -0.5)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2(-0.5,  0.5)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2( 0.5,  0.5)).rgb;
  c *= 0.25;
  c = min(c, vec3(64.0));
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-5);
  float contrib = max(soft, br - threshold) / max(br, 1e-5);
  gl_FragColor = vec4(c * contrib, 1.0);
}`;

// Dual-filter (Kawase) down/up sampling gives a wide, smooth, flicker-free glow.
const DOWN_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec2 h = texel * 0.5;
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += texture2D(tSrc, vUv - h).rgb;
  c += texture2D(tSrc, vUv + h).rgb;
  c += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb;
  c += texture2D(tSrc, vUv - vec2(h.x, -h.y)).rgb;
  gl_FragColor = vec4(c / 8.0, 1.0);
}`;

const UP_FS = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tBase;
uniform vec2 texel;
uniform float baseWeight;
varying vec2 vUv;
void main() {
  vec2 h = texel * 0.5;
  vec3 c = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  c += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  c += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  c /= 12.0;
  gl_FragColor = vec4(c + texture2D(tBase, vUv).rgb * baseWeight, 1.0);
}`;

const FINAL_FS = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tPrev;
uniform sampler2D tOverlay;
uniform sampler2D tSoft;
uniform vec3 soft;
uniform float bloomStrength;
uniform float exposure;
uniform float saturation;
uniform float lift;
uniform vec3 liftTint;
uniform float vignette;
uniform float mixPrev;
uniform float fade;
uniform float useOverlay;
uniform float useDither;
uniform float frame;
uniform vec2 resolution;
varying vec2 vUv;

// ACES filmic fit (same curve three.js uses for ACESFilmicToneMapping).
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 ACESInputMat = mat3(
    vec3(0.59719, 0.07600, 0.02840),
    vec3(0.35458, 0.90834, 0.13383),
    vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(
    vec3( 1.60475, -0.10208, -0.00327),
    vec3(-0.53108,  1.10813, -0.07276),
    vec3(-0.07367, -0.00605,  1.07602));
  color *= 1.0 / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec3 sharp = texture2D(tScene, vUv).rgb;
  // Miniature-style soft focus toward the top and bottom of frame (soft = top, bottom, strength).
  float sm = soft.z * clamp(smoothstep(soft.x, 1.0, vUv.y) + smoothstep(soft.y, 0.0, vUv.y), 0.0, 1.0);
  vec3 base = sm > 0.0 ? mix(sharp, texture2D(tSoft, vUv).rgb, sm) : sharp;
  vec3 hdr = base + texture2D(tBloom, vUv).rgb * bloomStrength;
  vec3 c = aces(hdr * exposure);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, saturation), 0.0);
  c = toSRGB(c);
  c = c * (1.0 - lift) + lift * liftTint;
  vec2 q = vUv - 0.5;
  q.x *= resolution.x / resolution.y;
  c *= 1.0 - vignette * smoothstep(0.25, 0.85, length(q) * 1.25);
  c = mix(c, texture2D(tPrev, vUv).rgb, mixPrev);
  c *= fade;
  if (useOverlay > 0.5) {
    vec4 ov = texture2D(tOverlay, vUv);
    c = c * (1.0 - ov.a) + ov.rgb;
  }
  if (useDither > 0.5) {
    // Triangular dither, +-1 LSB, so dark gradients never band.
    vec2 fc = gl_FragCoord.xy + vec2(frame * 17.0, frame * 31.0);
    float d = hash(fc) + hash(fc + 71.3) - 1.0;
    c += d / 255.0;
  }
  gl_FragColor = vec4(c, 1.0);
}`;

function quadMaterial(fragmentShader, uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: QUAD_VS,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

export class Engine {
  constructor(canvas, W, H) {
    this.W = W;
    this.H = H;
    const r = (this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    }));
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.toneMapping = THREE.NoToneMapping;
    r.outputColorSpace = THREE.LinearSRGBColorSpace;
    // Soft, filtered sun shadows for the daylight scenes.
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.maxAniso = r.capabilities.getMaxAnisotropy();

    const hf = { type: THREE.HalfFloatType, depthBuffer: false };
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
    this.prevRT = new THREE.WebGLRenderTarget(W, H, hf);
    // Scene blur chain for the soft-focus effect (1/2, 1/4, 1/8 down; back up to 1/2).
    this.softDown = [2, 4, 8].map((d) => new THREE.WebGLRenderTarget(Math.round(W / d), Math.round(H / d), hf));
    this.softUp = [2, 4].map((d) => new THREE.WebGLRenderTarget(Math.round(W / d), Math.round(H / d), hf));

    this.down = [];
    this.up = [];
    let w = Math.round(W / 2);
    let h = Math.round(H / 2);
    for (let i = 0; i < 6; i++) {
      this.down.push(new THREE.WebGLRenderTarget(w, h, hf));
      this.up.push(new THREE.WebGLRenderTarget(w, h, hf));
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
    }

    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);

    this.prefilterMat = quadMaterial(PREFILTER_FS, {
      tSrc: { value: null },
      texel: { value: new THREE.Vector2(1 / W, 1 / H) },
      threshold: { value: 1.0 },
      knee: { value: 0.5 },
    });
    this.downMat = quadMaterial(DOWN_FS, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
    this.upMat = quadMaterial(UP_FS, {
      tSrc: { value: null },
      tBase: { value: null },
      texel: { value: new THREE.Vector2() },
      baseWeight: { value: 1 },
    });

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = W;
    this.overlayCanvas.height = H;
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    this.overlayTex = new THREE.CanvasTexture(this.overlayCanvas);
    this.overlayTex.colorSpace = THREE.NoColorSpace;
    this.overlayTex.premultiplyAlpha = true;
    this.overlayTex.generateMipmaps = false;
    this.overlayTex.minFilter = THREE.LinearFilter;
    this.overlayTex.magFilter = THREE.LinearFilter;

    this.finalMat = quadMaterial(FINAL_FS, {
      tScene: { value: this.sceneRT.texture },
      tBloom: { value: this.up[0].texture },
      tPrev: { value: this.prevRT.texture },
      tOverlay: { value: this.overlayTex },
      tSoft: { value: this.softUp[0].texture },
      soft: { value: new THREE.Vector3(1, 0, 0) },
      bloomStrength: { value: 0.6 },
      exposure: { value: 1.0 },
      saturation: { value: 0.92 },
      lift: { value: 0.03 },
      liftTint: { value: new THREE.Color(0.32, 0.31, 0.3) },
      vignette: { value: 0.18 },
      mixPrev: { value: 0 },
      fade: { value: 1 },
      useOverlay: { value: 1 },
      useDither: { value: 1 },
      frame: { value: 0 },
      resolution: { value: new THREE.Vector2(W, H) },
    });
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  bloom(threshold, knee) {
    const u = this.prefilterMat.uniforms;
    u.tSrc.value = this.sceneRT.texture;
    u.threshold.value = threshold;
    u.knee.value = knee;
    this.pass(this.prefilterMat, this.down[0]);
    for (let i = 1; i < this.down.length; i++) {
      const src = this.down[i - 1];
      this.downMat.uniforms.tSrc.value = src.texture;
      this.downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.downMat, this.down[i]);
    }
    const last = this.down.length - 1;
    // Seed the top of the upsample chain with the smallest level.
    this.downMat.uniforms.tSrc.value = this.down[last].texture;
    this.downMat.uniforms.texel.value.set(0, 0);
    this.pass(this.downMat, this.up[last]);
    for (let i = last - 1; i >= 0; i--) {
      const src = this.up[i + 1];
      this.upMat.uniforms.tSrc.value = src.texture;
      this.upMat.uniforms.tBase.value = this.down[i].texture;
      this.upMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this.upMat.uniforms.baseWeight.value = 1.0;
      this.pass(this.upMat, this.up[i]);
    }
  }

  softBlur() {
    let src = this.sceneRT;
    for (const t of this.softDown) {
      this.downMat.uniforms.tSrc.value = src.texture;
      this.downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.downMat, t);
      src = t;
    }
    for (let i = this.softUp.length - 1; i >= 0; i--) {
      const from = i === this.softUp.length - 1 ? this.softDown[2] : this.softUp[i + 1];
      this.upMat.uniforms.tSrc.value = from.texture;
      this.upMat.uniforms.tBase.value = from.texture;
      this.upMat.uniforms.texel.value.set(1 / from.width, 1 / from.height);
      this.upMat.uniforms.baseWeight.value = 0;
      this.pass(this.upMat, this.softUp[i]);
    }
  }

  // Render a scene description { scene, camera, post } into the HDR target and post-process.
  // If `toPrev` is true the graded result is stored for a crossfade instead of shown.
  renderShot(shot, toPrev, frame, fade = 1) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(shot.clearColor ?? 0x000000, 1);
    r.clear(true, true, true);
    r.render(shot.scene, shot.camera);
    const p = shot.post || {};
    this.bloom(p.bloomThreshold ?? 1.2, p.bloomKnee ?? 0.6);
    const u = this.finalMat.uniforms;
    if (p.soft) {
      this.softBlur();
      u.soft.value.set(p.soft[0], p.soft[1], p.soft[2]);
    } else {
      u.soft.value.set(1, 0, 0);
    }
    u.bloomStrength.value = p.bloomStrength ?? 0.5;
    u.exposure.value = p.exposure ?? 1.0;
    u.saturation.value = p.saturation ?? 0.92;
    u.lift.value = p.lift ?? 0.03;
    u.vignette.value = p.vignette ?? 0.18;
    u.fade.value = fade * (p.fade ?? 1);
    u.frame.value = frame;
    if (toPrev) {
      u.mixPrev.value = 0;
      u.useOverlay.value = 0;
      u.useDither.value = 0;
      this.pass(this.finalMat, this.prevRT);
    }
  }

  present(mixPrev, frame, dither = true) {
    const u = this.finalMat.uniforms;
    u.mixPrev.value = mixPrev;
    u.useOverlay.value = 1;
    u.useDither.value = dither ? 1 : 0;
    u.frame.value = frame;
    this.overlayTex.needsUpdate = true;
    this.pass(this.finalMat, null);
  }

  // Plain black frame (for the black beats) with the text overlay on top.
  presentBlack(frame) {
    const u = this.finalMat.uniforms;
    u.fade.value = 0;
    this.present(0, frame, false);
  }

  readPixels() {
    const gl = this.renderer.getContext();
    const out = new Uint8Array(this.W * this.H * 4);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }
}
