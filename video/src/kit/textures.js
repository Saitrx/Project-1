// Canvas-generated textures: mipmapped and anisotropically filtered so thin lines
// (windows, mullions, lane markings) stay stable while the camera moves.
import * as THREE from 'three';
import { makeRng } from '../rng.js';

let maxAniso = 16;
export function setMaxAniso(a) {
  maxAniso = a;
}

export function finishTexture(tex, { srgb = true, repeat = null } = {}) {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAniso;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.needsUpdate = true;
  return tex;
}

export function canvasTexture(w, h, draw, opts) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return finishTexture(new THREE.CanvasTexture(c), opts);
}

/**
 * Glass tower facade: returns { map, emissive } textures for a grid of cols x rows windows.
 * `lit` is the fraction of windows that are lit; lit windows are warm, others reflect the sky.
 */
export function facadeTextures({ cols = 8, rows = 24, seed = 1, lit = 0.5, glass = '#5d7086', frame = '#2b323b', warm = '#ffd9a0', band = 0 }) {
  const rng = makeRng(seed);
  const cw = 32;
  const ch = 32;
  const W = cols * cw;
  const H = rows * ch;
  const litMask = [];
  for (let i = 0; i < cols * rows; i++) litMask.push(rng.next() < lit);
  const shade = [];
  for (let i = 0; i < cols * rows; i++) shade.push(rng.range(-0.06, 0.06));
  const map = canvasTexture(W, H, (g) => {
    g.fillStyle = frame;
    g.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        const col = new THREE.Color(glass);
        col.offsetHSL(0, 0, shade[k] + (r / rows) * 0.05);
        g.fillStyle = '#' + col.getHexString();
        g.fillRect(c * cw + 3, r * ch + 3, cw - 6, ch - (band ? 10 : 6));
      }
    }
  });
  const emissive = canvasTexture(W, H, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        if (!litMask[k]) continue;
        const col = new THREE.Color(warm);
        col.offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-0.15, 0.05));
        g.fillStyle = '#' + col.getHexString();
        g.fillRect(c * cw + 3, r * ch + 3, cw - 6, ch - (band ? 10 : 6));
      }
    }
  });
  return { map, emissive };
}

// Soft round sprite used for smoke, steam, star glints and lamp glows.
let puff;
export function puffTexture() {
  if (puff) return puff;
  puff = canvasTexture(256, 256, (g) => {
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.7, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  });
  return puff;
}

/** Draws text into a texture, for signs, screens and labels in the 3D world. */
export function textTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const tex = finishTexture(new THREE.CanvasTexture(c));
  return {
    tex,
    canvas: c,
    ctx: g,
    redraw(...args) {
      g.clearRect(0, 0, w, h);
      draw(g, w, h, ...args);
      tex.needsUpdate = true;
    },
  };
}
