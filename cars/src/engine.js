// Render pipeline:
//   HDR 4x-MSAA scene -> soft bloom (bright lights only) -> optional focus blur
//   -> ACES filmic + grade + eyelids + grain + dither -> 4K text layer composited LAST.
// The text layer never receives bloom, blur, grain, dither or any colour change.
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

// Dual-filter (Kawase) down/up sampling: wide, smooth and stable blur.
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
uniform sampler2D tBlurA;
uniform sampler2D tBlurB;
uniform sampler2D tBloom;
uniform sampler2D tPrev;
uniform sampler2D tOverlay;
uniform float blurMode;   // 0 none, 1 mix(scene, blurB), 2 mix(blurA, blurB)
uniform float blurMix;
uniform float bloomStrength;
uniform float exposure;
uniform float saturation;
uniform float contrast;
uniform float lift;
uniform vec3 liftTint;
uniform vec3 tint;
uniform float vignette;
uniform float mixPrev;
uniform float fade;
uniform float lid;        // 0 = eyes fully open, 1 = closed
uniform float lidGlow;    // warm light through the eyelids
uniform sampler2D tEye;   // eyelid matte (green = open), from a blink clip
uniform float eyeMatte;   // 1 = use tEye
uniform float eyeOpenMix; // 0..1 fades the matte out to fully open
uniform float grain;
uniform float useOverlay;
uniform float useDither;
uniform float frame;
uniform vec2 resolution;
varying vec2 vUv;

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
// Visible part of the frame between two soft, curved eyelids.
float eyeOpen(vec2 uv) {
  if (lid <= 0.0) return 1.0;
  float x = uv.x - 0.5;
  float h = (1.0 - lid) * 0.78;
  float curve = 1.0 - 1.5 * x * x;
  float top = 0.53 + h * curve;
  float bot = 0.5 - h * curve * 0.86;
  float soft = 0.045 + 0.06 * lid;
  return smoothstep(top, top - soft, uv.y) * smoothstep(bot, bot + soft, uv.y);
}
void main() {
  vec3 base = texture2D(tScene, vUv).rgb;
  if (blurMode > 1.5) base = mix(texture2D(tBlurA, vUv).rgb, texture2D(tBlurB, vUv).rgb, blurMix);
  else if (blurMode > 0.5) base = mix(base, texture2D(tBlurB, vUv).rgb, blurMix);
  vec3 hdr = base * tint + texture2D(tBloom, vUv).rgb * bloomStrength;
  vec3 c = aces(hdr * exposure);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, saturation), 0.0);
  c = toSRGB(c);
  c = clamp((c - 0.5) * contrast + 0.5, 0.0, 1.0);
  c = c * (1.0 - lift) + lift * liftTint;
  vec2 q = vUv - 0.5;
  q.x *= resolution.x / resolution.y;
  c *= 1.0 - vignette * smoothstep(0.3, 0.9, length(q) * 1.25);
  c = mix(c, texture2D(tPrev, vUv).rgb, mixPrev);
  c *= fade;
  if (lid > 0.0) {
    // Closed lids: dark, with warm sunlight glowing through (brighter toward the top).
    float m = eyeOpen(vUv);
    vec3 glow = vec3(1.0, 0.34, 0.12) * lidGlow * (0.45 + 0.55 * smoothstep(0.0, 1.0, vUv.y));
    glow *= 0.7 + 0.3 * dot(texture2D(tBlurB, vUv).rgb, vec3(0.3));
    c = mix(glow, c, m);
  }
  if (eyeMatte > 0.5) {
    // Real blink footage used only as a matte: green is where we see through; the lids are plain
    // black (none of the clip's own colour, so no green or olive fringe at the soft edges).
    vec3 e = texture2D(tEye, vUv).rgb;
    float key = smoothstep(0.05, 0.62, e.g - max(e.r, e.b));
    key = mix(key, 1.0, eyeOpenMix);
    c *= key;
  }
  if (grain > 0.0) {
    float g = hash(gl_FragCoord.xy * 0.73 + vec2(frame * 13.1, frame * 7.7)) - 0.5;
    c += g * grain;
  }
  if (useDither > 0.5) {
    vec2 fc = gl_FragCoord.xy + vec2(frame * 17.0, frame * 31.0);
    float d = hash(fc) + hash(fc + 71.3) - 1.0;
    c += d / 255.0;
  }
  c = clamp(c, 0.0, 1.0);
  if (useOverlay > 0.5) {
    // Text layer: premultiplied alpha, composited after every image effect.
    vec4 ov = texture2D(tOverlay, vUv);
    c = c * (1.0 - ov.a) + ov.rgb;
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
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    // Strict front-to-back for opaque objects so hidden facades are rejected by the depth test
    // before shading (the default sorts by material first, which causes heavy overdraw).
    if (!new URLSearchParams(location.search).has('defsort')) {
      r.setOpaqueSort((a, b) => (a.groupOrder - b.groupOrder) || (a.renderOrder - b.renderOrder) || (a.z - b.z) || (a.id - b.id));
    }
    r.info.autoReset = true;
    this.maxAniso = r.capabilities.getMaxAnisotropy();

    const hf = { type: THREE.HalfFloatType, depthBuffer: false };
    const qp = new URLSearchParams(location.search);
    const rtType = qp.get('rttype') === 'ubyte' ? THREE.UnsignedByteType : qp.get('rttype') === 'float' ? THREE.FloatType : THREE.HalfFloatType;
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { type: rtType, samples: qp.has('nomsaa') ? 0 : Number(qp.get('samples') ?? 4) });
    this.prevRT = new THREE.WebGLRenderTarget(W, H, hf);
    this.blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.blackTex.needsUpdate = true;

    const levels = (n) => {
      const out = [];
      let w = Math.round(W / 2);
      let h = Math.round(H / 2);
      for (let i = 0; i < n; i++) {
        out.push(new THREE.WebGLRenderTarget(w, h, hf));
        w = Math.max(1, Math.round(w / 2));
        h = Math.max(1, Math.round(h / 2));
      }
      return out;
    };
    this.down = levels(6);
    this.up = levels(6);
    this.bd = levels(7);
    this.bu = levels(7);
    this.blurA = new THREE.WebGLRenderTarget(Math.round(W / 2), Math.round(H / 2), hf);
    this.blurB = new THREE.WebGLRenderTarget(Math.round(W / 2), Math.round(H / 2), hf);

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
    this.overlayTex.minFilter = THREE.NearestFilter;
    this.overlayTex.magFilter = THREE.NearestFilter;

    this.finalMat = quadMaterial(FINAL_FS, {
      tScene: { value: this.sceneRT.texture },
      tBlurA: { value: this.blurA.texture },
      tBlurB: { value: this.blurB.texture },
      tBloom: { value: this.up[0].texture },
      tPrev: { value: this.prevRT.texture },
      tOverlay: { value: this.overlayTex },
      blurMode: { value: 0 },
      blurMix: { value: 0 },
      bloomStrength: { value: 0.5 },
      exposure: { value: 1.0 },
      saturation: { value: 1.1 },
      contrast: { value: 1.04 },
      lift: { value: 0.02 },
      liftTint: { value: new THREE.Color(0.3, 0.3, 0.32) },
      tint: { value: new THREE.Color(1, 1, 1) },
      vignette: { value: 0.12 },
      mixPrev: { value: 0 },
      fade: { value: 1 },
      lid: { value: 0 },
      lidGlow: { value: 0 },
      tEye: { value: null },
      eyeMatte: { value: 0 },
      eyeOpenMix: { value: 0 },
      grain: { value: 0.012 },
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

  // Blur the scene by `k` dual-filter levels into `target` (half resolution).
  blurChain(k, target) {
    let src = this.sceneRT;
    for (let i = 0; i < k; i++) {
      this.downMat.uniforms.tSrc.value = src.texture;
      this.downMat.uniforms.texel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.downMat, i === 0 && k === 1 ? target : this.bd[i]);
      src = this.bd[i];
    }
    if (k === 1) return;
    let from = this.bd[k - 1];
    for (let i = k - 2; i >= 0; i--) {
      this.upMat.uniforms.tSrc.value = from.texture;
      this.upMat.uniforms.tBase.value = from.texture;
      this.upMat.uniforms.texel.value.set(1 / from.width, 1 / from.height);
      this.upMat.uniforms.baseWeight.value = 0;
      const dst = i === 0 ? target : this.bu[i];
      this.pass(this.upMat, dst);
      from = this.bu[i];
    }
  }

  /**
   * Render a shot { scene, camera, post } to the HDR target and set grade uniforms.
   * post: { bloomThreshold, bloomKnee, bloomStrength, exposure, saturation, contrast, lift,
   *         vignette, tint, focusBlur (0..6 levels), lid, lidGlow, grain }
   */
  renderShot(shot, frame, { toPrev = false, fade = 1 } = {}) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(shot.clearColor ?? 0x000000, 1);
    r.clear(true, true, true);
    r.render(shot.scene, shot.camera);
    const p = shot.post || {};
    this.bloom(p.bloomThreshold ?? 1.6, p.bloomKnee ?? 0.5);
    const u = this.finalMat.uniforms;
    const fb = Math.max(0, Math.min(5.99, p.focusBlur ?? 0));
    if (fb > 0) {
      // Variable-strength blur: crossfade between two whole-level dual-filter blurs.
      const k = Math.floor(fb);
      const f = fb - k;
      if (k === 0) {
        this.blurChain(1, this.blurB);
        u.blurMode.value = 1;
      } else {
        this.blurChain(k, this.blurA);
        this.blurChain(k + 1, this.blurB);
        u.blurMode.value = 2;
      }
      u.blurMix.value = f;
    } else {
      u.blurMode.value = 0;
      u.blurMix.value = 0;
    }
    u.bloomStrength.value = p.bloomStrength ?? 0.4;
    u.exposure.value = p.exposure ?? 1.0;
    u.saturation.value = p.saturation ?? 1.1;
    u.contrast.value = p.contrast ?? 1.04;
    u.lift.value = p.lift ?? 0.02;
    u.vignette.value = p.vignette ?? 0.12;
    u.tint.value.set(p.tint ?? 0xffffff);
    u.lid.value = p.lid ?? 0;
    u.lidGlow.value = p.lidGlow ?? 0;
    u.eyeMatte.value = p.eye ? 1 : 0;
    if (p.eye) u.tEye.value = p.eye;
    u.eyeOpenMix.value = p.eyeOpenMix ?? 0;
    u.grain.value = p.grain ?? 0.012;
    u.fade.value = fade * (p.fade ?? 1);
    u.frame.value = frame;
    if (toPrev) {
      u.mixPrev.value = 0;
      u.useOverlay.value = 0;
      u.useDither.value = 0;
      u.tPrev.value = this.blackTex;
      this.pass(this.finalMat, this.prevRT);
      u.tPrev.value = this.prevRT.texture;
    }
  }

  present(frame, { mixPrev = 0, dither = true } = {}) {
    const u = this.finalMat.uniforms;
    u.mixPrev.value = mixPrev;
    u.useOverlay.value = 1;
    u.useDither.value = dither ? 1 : 0;
    u.frame.value = frame;
    this.overlayTex.needsUpdate = true;
    this.pass(this.finalMat, null);
  }

  // A plain black frame with the text layer on top.
  presentBlack(frame) {
    const u = this.finalMat.uniforms;
    u.fade.value = 0;
    u.lid.value = 0;
    u.eyeMatte.value = 0;
    u.grain.value = 0;
    u.blurMode.value = 0;
    u.bloomStrength.value = 0;
    this.present(frame, { dither: false });
  }

  readPixels() {
    const gl = this.renderer.getContext();
    const out = new Uint8Array(this.W * this.H * 4);
    gl.readPixels(0, 0, this.W, this.H, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }
}
