// Rock pigeon, side view facing left: plump body with feather scallops and wing bars, iridescent
// neck, a profile head and a front-facing head (for turning to camera), and walking legs with a
// head-bob. Origin at the hip, ground at y = 92.
import { Layer, smoothPath, paintShape, rgba, shade, mix, INK, glossyBall, stipple } from './paint.js';
import { makeRng, TAU, clamp, lerp } from './util.js';

export const PIGEON_GROUND = 92;

function featherRows(g, path, box, { size = 9, color = '#9aa3ad', ink = '#4f5560', seed = 1, alpha = 0.5 }) {
  const rng = makeRng(seed);
  g.save();
  g.clip(path);
  g.strokeStyle = rgba(ink, alpha);
  g.lineWidth = 0.7;
  for (let y = box.y; y < box.y + box.h; y += size * 0.7) {
    const row = Math.round((y - box.y) / (size * 0.7));
    for (let x = box.x + (row % 2) * size * 0.5; x < box.x + box.w; x += size) {
      g.fillStyle = rgba(shade(color, rng.range(-0.08, 0.08)), 0.5);
      g.beginPath();
      g.arc(x, y, size * 0.55, 0.15, Math.PI - 0.15);
      g.fill();
      g.stroke();
    }
  }
  g.restore();
}

export function buildPigeon(res) {
  const parts = {};
  // body + tail
  {
    const L = new Layer(330, 190, res, 120, 120);
    const pts = [[-70, -40], [-48, -66], [0, -72], [50, -58], [100, -44], [170, -36], [178, -24], [120, -12], [70, 8], [20, 22], [-34, 18], [-66, -6]];
    const p = smoothPath(pts, true);
    paintShape(L, p, {
      fill: '#9aa3ad',
      light: [-0.5, -1],
      shadowDepth: 30,
      hatchSpacing: 2,
      seed: 1001,
      before: (Lx) => {
        const g = Lx.g;
        // pale belly and darker tail band
        g.save();
        g.clip(p);
        const gr = g.createLinearGradient(0, -20, 0, 24);
        gr.addColorStop(0, 'rgba(200,205,212,0)');
        gr.addColorStop(1, 'rgba(205,210,216,0.6)');
        g.fillStyle = gr;
        g.fillRect(-90, -80, 280, 110);
        g.fillStyle = 'rgba(60,64,72,0.75)';
        g.fillRect(150, -50, 40, 40);
        g.restore();
        featherRows(g, p, { x: -70, y: -60, w: 200, h: 80 }, { size: 9, seed: 1002, alpha: 0.35 });
      },
    });
    parts.body = L;
  }
  // folded wing with two dark bars and primary feathers
  {
    const L = new Layer(240, 120, res, 60, 70);
    const pts = [[-40, -40], [10, -52], [80, -40], [150, -26], [168, -14], [120, -2], [40, 6], [-20, 0], [-44, -20]];
    const p = smoothPath(pts, true);
    paintShape(L, p, {
      fill: '#a9b1ba',
      light: [-0.5, -1],
      shadowDepth: 18,
      hatchSpacing: 2,
      seed: 1003,
      before: (Lx) => {
        const g = Lx.g;
        featherRows(g, p, { x: -40, y: -50, w: 120, h: 50 }, { size: 8, seed: 1004, alpha: 0.4 });
        g.save();
        g.clip(p);
        g.fillStyle = 'rgba(40,42,48,0.85)';
        for (const x of [36, 66]) {
          g.beginPath();
          g.moveTo(x, -50);
          g.quadraticCurveTo(x + 8, -20, x + 2, 8);
          g.lineTo(x + 12, 8);
          g.quadraticCurveTo(x + 18, -20, x + 10, -50);
          g.fill();
        }
        // primaries
        g.strokeStyle = 'rgba(40,44,52,0.7)';
        g.lineWidth = 1;
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          g.moveTo(90 + k * 10, -34 + k * 2);
          g.quadraticCurveTo(130 + k * 6, -26 + k * 2, 166, -14);
          g.stroke();
        }
        g.fillStyle = 'rgba(55,58,66,0.55)';
        g.fillRect(110, -40, 70, 50);
        g.restore();
      },
    });
    parts.wing = L;
  }
  // neck with green/purple sheen (pivot at its base on the chest)
  {
    const L = new Layer(110, 130, res, 60, 100);
    const pts = [[-34, 0], [-36, -40], [-26, -76], [0, -84], [20, -70], [26, -30], [30, 6], [0, 14]];
    const p = smoothPath(pts, true);
    paintShape(L, p, {
      fill: '#7d8794',
      light: [-0.5, -1],
      shadowDepth: 16,
      hatchSpacing: 2,
      seed: 1005,
      before: (Lx) => {
        const g = Lx.g;
        g.save();
        g.clip(p);
        const gr = g.createLinearGradient(-36, -70, 30, 0);
        gr.addColorStop(0, 'rgba(120,180,140,0)');
        gr.addColorStop(0.35, 'rgba(110,175,130,0.75)');
        gr.addColorStop(0.65, 'rgba(160,110,170,0.7)');
        gr.addColorStop(1, 'rgba(160,110,170,0)');
        g.fillStyle = gr;
        g.fillRect(-40, -90, 80, 110);
        g.restore();
        featherRows(g, p, { x: -36, y: -84, w: 66, h: 96 }, { size: 6, color: '#8f98a5', seed: 1006, alpha: 0.3 });
      },
    });
    parts.neck = L;
  }
  // head in profile (pivot at the back of the head/neck top), beak to the left
  {
    const L = new Layer(110, 90, res, 60, 50);
    const p = smoothPath([[-30, -2], [-28, -26], [-10, -36], [12, -30], [22, -12], [16, 10], [-6, 16], [-24, 12]], true);
    paintShape(L, p, { fill: '#7f8996', light: [-0.5, -1], shadowDepth: 12, hatchSpacing: 2, seed: 1007 });
    const g = L.g;
    // beak with white cere
    g.fillStyle = '#3b3a3c';
    g.beginPath();
    g.moveTo(-26, -14);
    g.quadraticCurveTo(-46, -12, -54, -4);
    g.quadraticCurveTo(-42, -2, -26, -4);
    g.closePath();
    g.fill();
    g.fillStyle = '#efece4';
    g.beginPath();
    g.ellipse(-30, -15, 6, 3.5, -0.2, 0, TAU);
    g.fill();
    g.strokeStyle = rgba(INK, 0.6);
    g.lineWidth = 0.6;
    g.stroke();
    // orange eye
    glossyBall(g, -8, -16, 5.2, { color: '#c8602a', ring: '#e0a060' });
    g.fillStyle = '#100a06';
    g.beginPath();
    g.arc(-8, -16, 2.2, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,250,0.95)';
    g.beginPath();
    g.arc(-9.5, -17.5, 1.2, 0, TAU);
    g.fill();
    parts.head = L;
  }
  // head facing the camera: round head, both eyes, beak pointing at us
  {
    const L = new Layer(110, 90, res, 55, 50);
    const p = smoothPath([[-26, -4], [-22, -28], [0, -38], [22, -28], [26, -4], [16, 14], [0, 18], [-16, 14]], true);
    paintShape(L, p, { fill: '#7f8996', light: [-0.5, -1], shadowDepth: 12, hatchSpacing: 2, seed: 1008 });
    const g = L.g;
    for (const s of [-1, 1]) {
      glossyBall(g, s * 15, -14, 4.6, { color: '#c8602a', ring: '#e0a060' });
      g.fillStyle = '#100a06';
      g.beginPath();
      g.arc(s * 15, -14, 2, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,255,250,0.95)';
      g.beginPath();
      g.arc(s * 15 - 1.2, -15.5, 1.1, 0, TAU);
      g.fill();
    }
    g.fillStyle = '#efece4';
    g.beginPath();
    g.ellipse(0, -10, 7, 4, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#3b3a3c';
    g.beginPath();
    g.moveTo(-6, -6);
    g.lineTo(6, -6);
    g.lineTo(0, 10);
    g.closePath();
    g.fill();
    parts.headFront = L;
  }
  return parts;
}

// Draw a pigeon. pose: { x, y (ground), s, step (walk phase, radians), walking (0..1), turn (0..1:
// profile -> facing camera), bob (head forward offset), peck }
export function drawPigeon(g, P, pose) {
  const { x, y, s } = pose;
  const ph = pose.step ?? 0;
  const w = pose.walking ?? 0;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  // legs (behind body): coral pink, three toes forward, one back
  const leg = (off, phase, far) => {
    const lift = Math.max(0, Math.sin(phase)) * 14 * w;
    const fwd = Math.cos(phase) * 22 * w;
    const hx = off;
    const hy = 2;
    const fx = off + fwd;
    const fy = 92 - lift;
    g.strokeStyle = far ? '#a85a52' : '#c96d63';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hx, hy);
    g.quadraticCurveTo((hx + fx) / 2 + 12, (hy + fy) / 2, fx, fy - 4);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(fx, fy - 4);
    g.lineTo(fx - 20, fy);
    g.moveTo(fx, fy - 4);
    g.lineTo(fx - 12, fy + 2);
    g.moveTo(fx, fy - 4);
    g.lineTo(fx + 12, fy - 1);
    g.stroke();
  };
  leg(6, ph + Math.PI, true);
  // body sways and bobs slightly with the step
  const sway = Math.sin(ph * 2) * 2 * w;
  g.save();
  g.translate(0, sway);
  g.drawImage(P.body.c, -P.body.ox, -P.body.oy, P.body.w, P.body.h);
  leg(-4, ph, false);
  g.drawImage(P.wing.c, -P.wing.ox, -P.wing.oy, P.wing.w, P.wing.h);
  // neck + head with the bob: the head moves forward then holds while the body catches up
  const bob = pose.bob ?? 0;
  g.save();
  g.translate(-50, -40);
  g.drawImage(P.neck.c, -P.neck.ox, -P.neck.oy, P.neck.w, P.neck.h);
  g.translate(-8 - bob, -82 + (pose.peck ?? 0) * 30);
  const turn = clamp(pose.turn ?? 0);
  if (turn < 0.5) {
    g.scale(1 - turn * 2, 1);
    g.drawImage(P.head.c, -P.head.ox, -P.head.oy, P.head.w, P.head.h);
  } else {
    g.scale((turn - 0.5) * 2, 1);
    g.drawImage(P.headFront.c, -P.headFront.ox, -P.headFront.oy, P.headFront.w, P.headFront.h);
  }
  g.restore();
  g.restore();
  g.restore();
}
