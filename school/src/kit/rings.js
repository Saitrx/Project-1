// The reference film's motif: a small glossy blue sphere with a soft offset shadow, thin rings that
// ripple out from it (one solid, one dashed), and short tapered arc "flicks" like sound waves.
import { TAU, clamp, easeOut, rgba } from './util.js';

export const RING_BLUE = '#2f6fc4';
export const RING_PINK = '#e0508f';

export function blueDot(g, x, y, r, alpha = 1, shadow = true) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  if (shadow) {
    const sg = g.createRadialGradient(x + r * 0.9, y + r * 0.8, 0, x + r * 0.9, y + r * 0.8, r * 1.5);
    sg.addColorStop(0, 'rgba(70,50,90,0.28)');
    sg.addColorStop(1, 'rgba(70,50,90,0)');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(x + r * 0.9, y + r * 0.8, r * 1.5, 0, TAU);
    g.fill();
  }
  const grd = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  grd.addColorStop(0, '#6aa6ee');
  grd.addColorStop(0.55, '#2f6fc4');
  grd.addColorStop(1, '#1d4c96');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.beginPath();
  g.ellipse(x - r * 0.35, y - r * 0.42, r * 0.2, r * 0.15, -0.5, 0, TAU);
  g.fill();
  g.restore();
}

// A thin ring of radius r. `fade` 0..1 thins and fades it out at the end of its life.
export function ring(g, x, y, r, { width = 5, color = RING_BLUE, alpha = 1, dashed = false, glow = false } = {}) {
  if (alpha <= 0 || r <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  if (glow) {
    g.strokeStyle = rgba('#ffffff', 0.55);
    g.lineWidth = width * 2.6;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.stroke();
  }
  g.strokeStyle = color;
  g.lineWidth = width;
  if (dashed) {
    const circ = TAU * r;
    const n = Math.max(8, Math.round(circ / 70));
    g.setLineDash([(circ / n) * 0.62, (circ / n) * 0.38]);
  }
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.stroke();
  g.restore();
}

// A ripple: rings born at time t0, growing to rMax over `dur` seconds and fading as they go.
export function ripple(g, x, y, t, t0, { rMax = 1300, dur = 1.8, width = 5.5, color = RING_BLUE, count = 2, gap = 0.22, glow = false } = {}) {
  for (let i = 0; i < count; i++) {
    const u = (t - t0 - i * gap) / dur;
    if (u <= 0 || u >= 1) continue;
    const r = rMax * easeOut(u);
    const a = (1 - u) ** 1.2 * clamp(u * 12);
    ring(g, x, y, r, { width: width * (1 - u * 0.55), color, alpha: a, dashed: i % 2 === 1, glow });
  }
}

// Tapered arc strokes flicking outward (like ")))"), centred on angle `ang`.
export function arcFlicks(g, x, y, t, t0, { ang = 0, r0 = 60, spread = 90, n = 3, dur = 0.9, color = RING_BLUE, width = 5 } = {}) {
  for (let i = 0; i < n; i++) {
    const u = (t - t0 - i * 0.08) / dur;
    if (u <= 0 || u >= 1) continue;
    const r = r0 + spread * easeOut(u) + i * 22;
    const half = 0.32 - i * 0.04;
    const a = (1 - u) * clamp(u * 8);
    // tapered: draw as a filled crescent
    g.save();
    g.globalAlpha *= a;
    g.fillStyle = color;
    g.beginPath();
    const w = width * (1 - u * 0.4);
    g.arc(x, y, r + w / 2, ang - half, ang + half);
    g.arc(x, y, r - w / 2, ang + half, ang - half, true);
    g.closePath();
    g.fill();
    g.restore();
  }
}
