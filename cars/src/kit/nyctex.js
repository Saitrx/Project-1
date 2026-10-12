// Canvas textures for the low-poly New York look. All mipmapped + anisotropic (finishTexture).
import * as THREE from 'three';
import { canvasTexture } from './textures.js';
import { makeRng } from '../rng.js';

const cache = new Map();
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, f);
  return '#' + c.getHexString();
}

/**
 * Facade with punched windows. One texture tile = cols bays x rows floors.
 * opts: wall, glass[], frame (null = none), frameW, winW, winH (fractions of the bay/floor), lintel
 */
export function facadeTex(key, { cols = 4, rows = 4, wall, glass, frame = null, winW = 0.46, winH = 0.6, sill = 0.24, lintel = null, seed = 1, brick = false }) {
  return cached('f:' + key, () =>
    canvasTexture(512, 512, (g, W, H) => {
      const rng = makeRng(seed);
      g.fillStyle = wall;
      g.fillRect(0, 0, W, H);
      if (brick) {
        // Very subtle brick courses so walls don't look like plastic up close.
        for (let y = 0; y < H; y += 8) {
          g.fillStyle = y % 16 ? shade(wall, -0.015) : shade(wall, 0.01);
          g.fillRect(0, y, W, 4);
        }
      }
      const bw = W / cols;
      const bh = H / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * bw + bw * (1 - winW) / 2;
          // Canvas y=0 is the top of the texture (= top of the tile in world space).
          const y = (rows - 1 - r) * bh + bh * (1 - sill - winH);
          const w = bw * winW;
          const h = bh * winH;
          if (lintel) {
            g.fillStyle = lintel;
            g.fillRect(x - bw * 0.04, y - bh * 0.07, w + bw * 0.08, bh * 0.06);
            g.fillRect(x - bw * 0.03, y + h, w + bw * 0.06, bh * 0.045);
          }
          if (frame) {
            g.fillStyle = frame;
            g.fillRect(x - bw * 0.03, y - bh * 0.03, w + bw * 0.06, h + bh * 0.06);
          }
          const gc = glass[Math.floor(rng.next() * glass.length)];
          g.fillStyle = gc;
          g.fillRect(x, y, w, h);
          // Soft sky reflection in the top half of the pane.
          g.fillStyle = 'rgba(255,255,255,0.10)';
          g.fillRect(x, y, w, h * 0.42);
          if (frame) {
            g.fillStyle = frame;
            g.fillRect(x + w / 2 - bw * 0.012, y, bw * 0.024, h);
            g.fillRect(x, y + h * 0.5 - bh * 0.012, w, bh * 0.024);
          }
        }
      }
    })
  );
}

// Curtain-wall glass tower: a grid of panels with light mullions.
export function glassTex(key, { base = '#57c0c4', vary = 0.06, mullion = '#d9f0ee', cols = 6, rows = 8, seed = 3 }) {
  return cached('g:' + key, () =>
    canvasTexture(512, 512, (g, W, H) => {
      const rng = makeRng(seed);
      const bw = W / cols;
      const bh = H / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          g.fillStyle = shade(base, (rng.next() - 0.5) * vary * 2);
          g.fillRect(c * bw, r * bh, bw, bh);
        }
      }
      g.fillStyle = mullion;
      for (let c = 0; c <= cols; c++) g.fillRect(c * bw - 3, 0, 6, H);
      for (let r = 0; r <= rows; r++) g.fillRect(0, r * bh - 4, W, 8);
    })
  );
}

// Ground-floor storefront: dark display glass, a door, frame colour and a sign band.
export function storefrontTex(key, { frame = '#2f3b2f', sign = '#c73b2c', glass = '#1f2a36', seed = 5 }) {
  return cached('s:' + key, () =>
    canvasTexture(512, 512, (g, W, H) => {
      g.fillStyle = frame;
      g.fillRect(0, 0, W, H);
      // Sign band at the top.
      g.fillStyle = sign;
      g.fillRect(0, H * 0.04, W, H * 0.16);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 3; i++) g.fillRect(W * 0.18 + i * W * 0.24, H * 0.1, W * 0.14, H * 0.04);
      // Display windows + door.
      g.fillStyle = glass;
      g.fillRect(W * 0.04, H * 0.27, W * 0.56, H * 0.62);
      g.fillRect(W * 0.7, H * 0.27, W * 0.24, H * 0.73);
      g.fillStyle = 'rgba(160,190,215,0.16)';
      g.fillRect(W * 0.04, H * 0.27, W * 0.56, H * 0.22);
      g.fillStyle = frame;
      g.fillRect(W * 0.31, H * 0.27, W * 0.02, H * 0.62);
      // Bulkhead under the windows.
      g.fillStyle = shade(frame, -0.06);
      g.fillRect(W * 0.04, H * 0.89, W * 0.56, H * 0.11);
    })
  );
}

export function sidewalkTex() {
  return cached('sidewalk', () =>
    canvasTexture(512, 512, (g, W, H) => {
      const rng = makeRng(11);
      g.fillStyle = '#c9c8c2';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 1400; i++) {
        const v = 190 + rng.int(-10, 10);
        g.fillStyle = `rgba(${v},${v},${v - 4},0.35)`;
        g.fillRect(rng.range(0, W), rng.range(0, H), 3, 3);
      }
      g.fillStyle = 'rgba(120,120,116,0.55)';
      // 2x2 slabs per tile.
      g.fillRect(0, 0, W, 4);
      g.fillRect(0, H / 2 - 2, W, 4);
      g.fillRect(0, 0, 4, H);
      g.fillRect(W / 2 - 2, 0, 4, H);
    })
  );
}

// Roadway tile: 24 m across (x from -12 to 12), 12 m along the street.
export function roadTex() {
  return cached('road', () =>
    canvasTexture(1024, 512, (g, W, H) => {
      const rng = makeRng(12);
      g.fillStyle = '#45474b';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 4000; i++) {
        const v = 66 + rng.int(-8, 8);
        g.fillStyle = `rgba(${v},${v},${v + 2},0.6)`;
        g.fillRect(rng.range(0, W), rng.range(0, H), 3, 3);
      }
      const px = W / 24;
      const X = (x) => (x + 12) * px;
      g.fillStyle = '#e9e6dc';
      for (const x of [-9, 9]) g.fillRect(X(x) - 0.07 * px, 0, 0.14 * px, H);
      for (const x of [-6, -3, 3, 6]) g.fillRect(X(x) - 0.07 * px, 0, 0.14 * px, H * 0.25);
      g.fillStyle = '#e8b52a';
      for (const x of [-0.17, 0.17]) g.fillRect(X(x) - 0.06 * px, 0, 0.12 * px, H);
    })
  );
}

export function plainRoadTex() {
  return cached('road2', () =>
    canvasTexture(512, 512, (g, W, H) => {
      const rng = makeRng(13);
      g.fillStyle = '#45474b';
      g.fillRect(0, 0, W, H);
      for (let i = 0; i < 2000; i++) {
        const v = 66 + rng.int(-8, 8);
        g.fillStyle = `rgba(${v},${v},${v + 2},0.6)`;
        g.fillRect(rng.range(0, W), rng.range(0, H), 3, 3);
      }
    })
  );
}

export function signTex(key, { bg = '#d63a2c', fg = '#ffffff' }) {
  return cached('sign:' + key, () =>
    canvasTexture(256, 256, (g, W, H) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.fillStyle = fg;
      g.fillRect(W * 0.22, H * 0.3, W * 0.56, H * 0.12);
      g.fillRect(W * 0.22, H * 0.56, W * 0.56, H * 0.12);
    })
  );
}

// Chrysler-like crown: stacked arches with triangular windows.
export function crownTex() {
  return cached('crown', () =>
    canvasTexture(512, 512, (g, W, H) => {
      g.fillStyle = '#d7dadf';
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#5e6670';
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 6; c++) {
          const x = c * (W / 6) + W / 24;
          const y = r * (H / 4) + H / 16;
          g.beginPath();
          g.moveTo(x, y + H / 6);
          g.lineTo(x + W / 24, y);
          g.lineTo(x + W / 12, y + H / 6);
          g.closePath();
          g.fill();
        }
      }
    })
  );
}
