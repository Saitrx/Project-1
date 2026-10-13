// 0:30-0:36 An airport: control tower, tarmac, a small high-wing plane. A giant pterosaur glides
// overhead past the tower (seen from below, wings spread). Red dotted lines measure its wingspan
// against the plane's: about the same, ten metres.
import { Layer, drawLayer, smoothPath, stipple, hatch, rgba, shade, mix, INK, sparkle, cloud, paintShape, strokePartial, mottle, glossyBall } from '../kit/paint.js';
import { makeRng, clamp, lerp, smoothstep, easeOutBack, easeInOut, easeOut, TAU, wobble } from '../kit/util.js';
import { setCam } from '../kit/cam.js';

const RED = '#d8463d';

function buildScene(S) {
  const res = S * 1.1;
  const L = new Layer(1300, 2100, res, 110, 90);
  const g = L.g;
  const rng = makeRng(601);
  const sky = g.createLinearGradient(0, -90, 0, 1200);
  sky.addColorStop(0, '#8fbcd6');
  sky.addColorStop(0.7, '#cfe2e6');
  sky.addColorStop(1, '#ece9da');
  g.fillStyle = sky;
  g.fillRect(-110, -90, 1300, 1400);
  for (let i = 0; i < 10; i++) cloud(g, rng.range(-60, 1140), rng.range(100, 1000), rng.range(130, 260), 620 + i);
  // distant terminal and hills
  const hor = 1180;
  g.fillStyle = '#b7c3a6';
  g.beginPath();
  g.moveTo(-110, hor);
  for (let x = -110; x <= 1190; x += 20) g.lineTo(x, hor - 30 - Math.sin(x * 0.006) * 20);
  g.lineTo(1190, hor + 10);
  g.lineTo(-110, hor + 10);
  g.fill();
  const term = new Path2D();
  term.rect(420, hor - 70, 560, 70);
  paintShape(L, term, { fill: '#d7d2c4', light: [-1, -0.6], shadowDepth: 20, hatchSpacing: 2.4, seed: 602, cross: false });
  g.fillStyle = '#6f8ea0';
  for (let x = 440; x < 960; x += 26) g.fillRect(x, hor - 54, 16, 22);
  g.strokeStyle = rgba(INK, 0.7);
  g.lineWidth = 0.8;
  for (let x = 440; x < 960; x += 26) g.strokeRect(x, hor - 54, 16, 22);
  // tarmac with perspective markings
  const tg = g.createLinearGradient(0, hor, 0, 2010);
  tg.addColorStop(0, '#a9a8a0');
  tg.addColorStop(1, '#6d6c66');
  g.fillStyle = tg;
  g.fillRect(-110, hor, 1300, 830);
  stipple(g, null, { x: -110, y: hor, w: 1300, h: 830 }, { count: 16000, r: [0.4, 1.1], color: '#3a3934', alpha: 0.35, seed: 603 });
  stipple(g, null, { x: -110, y: hor, w: 1300, h: 830 }, { count: 6000, r: [0.4, 1], color: '#efeee6', alpha: 0.35, seed: 604 });
  g.strokeStyle = 'rgba(245,240,220,0.85)';
  for (let k = 0; k < 9; k++) {
    const y0 = hor + 20 + k * k * 9 + k * 20;
    const w = 6 + k * 3;
    g.lineWidth = 2 + k * 0.6;
    g.beginPath();
    g.moveTo(560 - w * 2, y0);
    g.lineTo(560 + w * 2, y0);
    g.stroke();
  }
  g.strokeStyle = 'rgba(230,190,60,0.9)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-110, 1560);
  g.quadraticCurveTo(500, 1380, 1190, 1300);
  g.stroke();
  // grass strip on the left edge
  g.fillStyle = '#93a56b';
  g.beginPath();
  g.moveTo(-110, hor + 4);
  g.lineTo(140, hor + 4);
  g.lineTo(-110, hor + 160);
  g.fill();
  // control tower
  const tower = new Path2D();
  tower.moveTo(170, 1260);
  tower.lineTo(186, 700);
  tower.lineTo(274, 700);
  tower.lineTo(290, 1260);
  tower.closePath();
  paintShape(L, tower, { fill: '#e2ddcf', light: [-1, -0.3], shadowDepth: 40, hatchSpacing: 2.4, seed: 605, cross: true });
  g.strokeStyle = rgba(INK, 0.4);
  g.lineWidth = 0.8;
  for (let y = 740; y < 1250; y += 46) {
    g.beginPath();
    g.moveTo(180, y);
    g.lineTo(282, y);
    g.stroke();
  }
  // cab: wider glass box with slanted windows, roof and antenna
  const cab = new Path2D();
  cab.moveTo(140, 700);
  cab.lineTo(124, 610);
  cab.lineTo(336, 610);
  cab.lineTo(320, 700);
  cab.closePath();
  paintShape(L, cab, { fill: '#5d7f93', light: [-1, -0.5], shadowDepth: 40, hatchSpacing: 2.4, seed: 606, cross: false });
  g.strokeStyle = 'rgba(230,240,245,0.75)';
  g.lineWidth = 2;
  for (let x = 150; x < 320; x += 34) {
    g.beginPath();
    g.moveTo(x, 690);
    g.lineTo(x - 6, 620);
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(140, 640);
  g.lineTo(186, 616);
  g.stroke();
  const roof = new Path2D();
  roof.rect(112, 588, 236, 24);
  paintShape(L, roof, { fill: '#d9d3c3', light: [-1, -0.5], shadowDepth: 10, hatchSpacing: 2.2, seed: 607, cross: false });
  g.strokeStyle = rgba(INK, 0.9);
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(230, 588);
  g.lineTo(230, 500);
  g.stroke();
  g.fillStyle = RED;
  g.beginPath();
  g.arc(230, 496, 6, 0, TAU);
  g.fill();
  // windsock
  g.strokeStyle = rgba(INK, 0.9);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(980, 1250);
  g.lineTo(980, 1150);
  g.stroke();
  for (let k = 0; k < 4; k++) {
    g.fillStyle = k % 2 ? '#f4efe4' : '#e2763a';
    g.beginPath();
    g.moveTo(980 - k * 20, 1150 + k * 2);
    g.lineTo(960 - k * 20, 1152 + k * 3);
    g.lineTo(960 - k * 20, 1170 - k * 3);
    g.lineTo(980 - k * 20, 1172 - k * 2);
    g.fill();
  }
  return L;
}

// Small high-wing plane seen from the front, parked. Wingspan 560 (wingtip to wingtip at y = -150).
function buildPlane(S) {
  const res = S * 1.3;
  const L = new Layer(640, 300, res, 320, 250);
  const g = L.g;
  // wing (high, straight) with struts
  const wing = new Path2D();
  wing.moveTo(-280, -156);
  wing.lineTo(280, -156);
  wing.lineTo(280, -140);
  wing.lineTo(-280, -140);
  wing.closePath();
  paintShape(L, wing, { fill: '#f1ece0', light: [0, -1], shadowDepth: 8, hatchSpacing: 2, seed: 611, cross: false });
  g.fillStyle = RED;
  g.fillRect(-280, -156, 34, 16);
  g.fillRect(246, -156, 34, 16);
  g.strokeStyle = rgba(INK, 0.9);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-40, -70);
  g.lineTo(-150, -142);
  g.moveTo(40, -70);
  g.lineTo(150, -142);
  g.stroke();
  // fuselage (front view), windscreen, cowling, prop disc
  const body = new Path2D();
  body.ellipse(0, -96, 52, 62, 0, 0, TAU);
  paintShape(L, body, { fill: '#f1ece0', light: [-0.6, -1], shadowDepth: 26, hatchSpacing: 2, seed: 612, cross: true });
  g.fillStyle = '#6e8ea2';
  g.beginPath();
  g.ellipse(0, -122, 40, 22, 0, Math.PI, 0);
  g.fill();
  g.strokeStyle = rgba(INK, 0.8);
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#c9c3b4';
  g.beginPath();
  g.arc(0, -84, 24, 0, TAU);
  g.fill();
  g.stroke();
  g.fillStyle = RED;
  g.beginPath();
  g.arc(0, -84, 8, 0, TAU);
  g.fill();
  g.strokeStyle = rgba('#3a3a3a', 0.5);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, -84 - 70);
  g.lineTo(0, -84 + 70);
  g.stroke();
  // red stripe
  g.strokeStyle = RED;
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(0, -96, 51, 61, 0, 0.15, Math.PI - 0.15);
  g.stroke();
  // gear
  g.strokeStyle = rgba(INK, 0.9);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-30, -50);
  g.lineTo(-70, -18);
  g.moveTo(30, -50);
  g.lineTo(70, -18);
  g.moveTo(0, -40);
  g.lineTo(0, -18);
  g.stroke();
  for (const x of [-70, 0, 70]) {
    g.fillStyle = '#2b2622';
    g.beginPath();
    g.ellipse(x, -8, 9, 12, 0, 0, TAU);
    g.fill();
  }
  g.fillStyle = 'rgba(30,26,20,0.3)';
  g.beginPath();
  g.ellipse(0, 4, 160, 10, 0, 0, TAU);
  g.fill();
  return L;
}

// Pterosaur seen from below, flying "up" the page (toward -y): wings spread along x.
function buildPterosaur(S) {
  const res = S * 1.25;
  const span = 300; // half span
  const wing = (side) => {
    const L = new Layer(span + 80, 300, res, side < 0 ? span + 40 : 40, 120);
    const g = L.g;
    const sx = side;
    // leading edge (arm + long wing finger) and membrane to the ankle
    const lead = [[0, -24], [sx * 70, -46], [sx * 140, -62], [sx * 210, -58], [sx * 270, -42], [sx * span, -18]];
    const trail = [[sx * span, -16], [sx * 260, 6], [sx * 200, 30], [sx * 130, 58], [sx * 70, 90], [sx * 26, 120], [0, 112]];
    const mem = smoothPath([...lead, ...trail], true);
    const g2 = g.createLinearGradient(0, -60, 0, 120);
    g2.addColorStop(0, '#9c6f46');
    g2.addColorStop(1, '#d8b183');
    paintShape(L, mem, {
      fill: '#c49a6c',
      light: [0, 1],
      shadowDepth: 18,
      shadowAlpha: 0.4,
      hatchAlpha: 0.3,
      seed: side > 0 ? 621 : 622,
      before: (Lx) => {
        const gg = Lx.g;
        gg.save();
        gg.clip(mem);
        gg.globalAlpha = 0.5;
        gg.fillStyle = g2;
        gg.fillRect(-span - 50, -100, 2 * span + 100, 260);
        gg.globalAlpha = 1;
        // actinofibrils: fine lines fanning from the leading edge to the trailing edge
        gg.strokeStyle = rgba('#6b4a2c', 0.35);
        gg.lineWidth = 0.5;
        for (let k = 0; k <= 60; k++) {
          const u = k / 60;
          const a = lead[Math.min(lead.length - 1, Math.floor(u * (lead.length - 1)))];
          const b = trail[Math.min(trail.length - 1, Math.floor((1 - u) * (trail.length - 1)))];
          gg.beginPath();
          gg.moveTo(a[0], a[1] + 4);
          gg.lineTo(b[0], b[1]);
          gg.stroke();
        }
        // translucent glow through the membrane
        gg.fillStyle = 'rgba(255,230,190,0.18)';
        gg.fillRect(-span - 50, 0, 2 * span + 100, 140);
        gg.restore();
      },
    });
    // bony leading edge
    g.strokeStyle = '#4a3420';
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.stroke(smoothPath(lead.slice(0, 3), false));
    g.lineWidth = 4;
    g.stroke(smoothPath(lead.slice(2), false));
    // three small fingers at the wrist
    g.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      g.moveTo(sx * 140, -62);
      g.lineTo(sx * (140 - 6 + k * 6), -62 - 14 - k * 2);
      g.stroke();
    }
    return L;
  };
  const body = new Layer(160, 520, res, 80, 360);
  {
    const g = body.g;
    // neck and long beak pointing up the page, crest seen edge-on
    const neck = smoothPath([[-12, -30], [-9, -120], [-14, -170], [0, -180], [14, -170], [9, -120], [12, -30]], true);
    paintShape(body, neck, { fill: '#b78e62', light: [-1, 0], shadowDepth: 8, hatchSpacing: 2, seed: 623, cross: false });
    const head = smoothPath([[-16, -160], [-14, -200], [-7, -280], [0, -350], [7, -280], [14, -200], [16, -160], [0, -150]], true);
    paintShape(body, head, { fill: '#d8c29a', light: [-1, 0], shadowDepth: 7, hatchSpacing: 2, seed: 624, cross: false });
    g.fillStyle = '#b5543e';
    g.beginPath();
    g.ellipse(0, -176, 6, 26, 0, 0, TAU);
    g.fill();
    glossyBall(g, -15, -178, 3.5, { color: '#1a120c' });
    glossyBall(g, 15, -178, 3.5, { color: '#1a120c' });
    // furry body (pycnofibres)
    const torso = smoothPath([[-22, -40], [0, -54], [22, -40], [26, 30], [12, 76], [-12, 76], [-26, 30]], true);
    paintShape(body, torso, { fill: '#9a7048', light: [-1, -0.5], shadowDepth: 14, hatchSpacing: 2, seed: 625, cross: false });
    g.strokeStyle = 'rgba(70,46,26,0.6)';
    g.lineWidth = 0.6;
    const r = makeRng(626);
    for (let i = 0; i < 200; i++) {
      const x = r.range(-22, 22);
      const y = r.range(-46, 72);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + r.range(-2, 2), y + r.range(3, 6));
      g.stroke();
    }
    // legs trailing back
    g.strokeStyle = '#5a3e26';
    g.lineWidth = 5;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 14, 60);
      g.lineTo(s * 26, 120);
      g.lineTo(s * 30, 150);
      g.stroke();
    }
  }
  return { left: wing(-1), right: wing(1), body, span };
}

export async function build(env) {
  const { S } = env;
  const scene = buildScene(S);
  const plane = buildPlane(S);
  const pt = buildPterosaur(S);
  const PLANE = { x: 690, y: 1352, s: 0.85 };

  // glide path (screen design units): enters lower right, crosses past the tower, exits top left
  function pos(t) {
    const u = clamp((t - 29.6) / 7.0);
    const e = u * 0.12 + easeInOut(u) * 0.88; // slows mid-frame for the measurement
    return [lerp(1300, -300, e), lerp(1100, 360, e) - Math.sin(e * Math.PI) * 150, 0.8 + Math.sin(e * Math.PI) * 0.36];
  }
  function flight(t) {
    const [x, y, s] = pos(t);
    const [x2, y2] = pos(t + 0.05);
    // the body's forward axis is -y; turn it to the direction of travel
    const rot = Math.atan2(x2 - x, -(y2 - y));
    return { x, y, s, rot: rot + Math.sin(t * 0.8) * 0.04 };
  }

  function drawPtero(g, t) {
    const f = flight(t);
    // occasional slow flap: wings fold slightly (planform span shrinks) twice
    const flap = Math.max(Math.exp(-Math.pow((t - 31.5) / 0.22, 2)), Math.exp(-Math.pow((t - 34.3) / 0.22, 2)));
    const ws = 1 - 0.25 * flap;
    g.save();
    g.translate(f.x, f.y);
    g.rotate(f.rot);
    g.scale(f.s, f.s);
    // shadow-ish soft halo for readability against the sky
    g.save();
    g.scale(ws, 1);
    g.drawImage(pt.left.c, -pt.left.ox, -pt.left.oy, pt.left.w, pt.left.h);
    g.drawImage(pt.right.c, -pt.right.ox, -pt.right.oy, pt.right.w, pt.right.h);
    g.restore();
    g.drawImage(pt.body.c, -pt.body.ox, -pt.body.oy, pt.body.w, pt.body.h);
    g.restore();
    return { f, ws };
  }

  function measure(g, a, b, k, label, lift = 0) {
    if (k <= 0) return;
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    const ox = (nx / nl) * lift;
    const oy = (ny / nl) * lift;
    const A = [a[0] + ox, a[1] + oy];
    const B = [b[0] + ox, b[1] + oy];
    g.save();
    g.strokeStyle = RED;
    g.lineWidth = 2.6;
    g.setLineDash([3, 9]);
    g.lineCap = 'round';
    strokePartial(g, [A, B], easeInOut(k));
    g.setLineDash([]);
    for (const P of [A, B]) {
      g.beginPath();
      g.moveTo(P[0] - (nx / nl) * 14, P[1] - (ny / nl) * 14);
      g.lineTo(P[0] + (nx / nl) * 14, P[1] + (ny / nl) * 14);
      g.stroke();
    }
    if (k > 0.95) {
      const mx = (A[0] + B[0]) / 2;
      const my = (A[1] + B[1]) / 2;
      g.fillStyle = RED;
      g.font = 'italic 600 40px "EBGaramond"';
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.fillText(label, mx, my - 8);
    }
    g.restore();
  }

  function draw(g, t) {
    const push = smoothstep(29.6, 36.4, t);
    setCam(g, S, 540, 960 - push * 30, 1 + push * 0.04);
    drawLayer(g, scene, 0, 0);
    drawLayer(g, plane, PLANE.x, PLANE.y, 0, PLANE.s);
    const { f, ws } = drawPtero(g, t);
    // wingspan measurement on the pterosaur, then the same on the plane
    const k1 = smoothstep(32.3, 33.0, t) * (1 - smoothstep(34.7, 35.2, t));
    if (k1 > 0) {
      const c = Math.cos(f.rot);
      const s2 = Math.sin(f.rot);
      const half = pt.span * f.s * ws;
      const yoff = -40 * f.s;
      const a = [f.x - c * half - s2 * yoff, f.y - s2 * half + c * yoff];
      const b = [f.x + c * half - s2 * yoff, f.y + s2 * half + c * yoff];
      g.globalAlpha = Math.min(1, k1 * 3);
      measure(g, a, b, clamp((t - 32.3) / 0.6), '10 m', -70);
      g.globalAlpha = 1;
    }
    const k2 = clamp((t - 33.0) / 0.6) * (1 - smoothstep(35.0, 35.5, t));
    if (k2 > 0) {
      const half = 280 * PLANE.s;
      const y = PLANE.y - 150 * PLANE.s;
      g.globalAlpha = Math.min(1, k2 * 3);
      measure(g, [PLANE.x - half, y], [PLANE.x + half, y], k2, '11 m', -40);
      g.globalAlpha = 1;
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    const H = g.canvas.height;
    const vg = g.createLinearGradient(0, H * 0.62, 0, H);
    vg.addColorStop(0, 'rgba(20,14,6,0)');
    vg.addColorStop(1, 'rgba(20,14,6,0.4)');
    g.fillStyle = vg;
    g.fillRect(0, H * 0.62, g.canvas.width, H * 0.38);
  }
  return { draw };
}
