// 0:58.5-1:06 "No new doctors. No engineers. No pilots." Three storybook panels, stacked like a page,
// each arriving on its phrase: an empty hospital hallway (a white coat hangs on a hook, a ceiling
// light flickers, an empty wheelchair), a half-built bridge over a river (the deck stops mid-air,
// a crane's hook sways in the wind), and a parked plane on a windy airfield with a circular inset
// into the cockpit: an empty pilot's seat with a cap resting on it. Nobody anywhere.
import { stipple, hatch, sparkle, INK } from '../kit/paint.js';
import { makeRng, clamp, lerp, smoothstep, easeOut, easeOutBack, TAU, rgba } from '../kit/util.js';
import { setCam } from '../kit/cam.js';
import { ring, ripple, RING_BLUE } from '../kit/rings.js';
import { VO } from '../vo_timing.js';

const BG = '#221a16';
const PW = 980;
const PH = 370;
const T0 = 58.5;
const C = VO[8].chunks; // doctors / engineers / pilots
const PANELS = [
  { id: 'hall', x: 50, y: 112, rot: -0.008, t0: Math.min(58.35, C[0].t - 0.4) },
  { id: 'bridge', x: 50, y: 517, rot: 0.007, t0: C[1].t - 0.12 },
  { id: 'plane', x: 50, y: 922, rot: -0.005, t0: C[2].t - 0.12 },
];
const INSET = { x: 262, y: 900, r: 150, t0: C[2].t + 0.7 };

function poly(g, pts, fill, stroke = INK, lw = 2.5) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.stroke();
  }
}

export async function build(env) {
  const { S } = env;
  const rng = makeRng(909);
  const motes = Array.from({ length: 26 }, () => ({ x: rng.range(380, 640), y: rng.range(60, 330), ph: rng.range(0, TAU), s: rng.range(1.2, 2.4) }));
  const grass = Array.from({ length: 70 }, () => ({ x: rng.range(0, PW), h: rng.range(8, 18), ph: rng.range(0, TAU) }));
  const clouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 230 + rng.range(-40, 40), y: rng.range(30, 110), w: rng.range(120, 200) }));

  // ---------- panel 1: the empty hospital hallway ----------
  function hall(g, t) {
    const VX = 490;
    const top = (x) => (x <= 430 ? lerp(0, 120, x / 430) : lerp(120, 0, (x - 550) / 430));
    const bot = (x) => (x <= 430 ? lerp(PH, 230, x / 430) : lerp(230, PH, (x - 550) / 430));
    // ceiling, walls, floor, far wall
    poly(g, [[0, 0], [PW, 0], [550, 120], [430, 120]], '#dcded4', null);
    poly(g, [[0, 0], [430, 120], [430, 230], [0, PH]], '#c6d2c4', null);
    poly(g, [[PW, 0], [550, 120], [550, 230], [PW, PH]], '#b4c2b4', null);
    poly(g, [[0, PH], [430, 230], [550, 230], [PW, PH]], '#a7b2a2', null);
    poly(g, [[430, 120], [550, 120], [550, 230], [430, 230]], '#d8dccb', null);
    // the far window, cold daylight
    g.fillStyle = '#eef1e6';
    g.fillRect(455, 135, 70, 62);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(455, 135, 70, 62);
    g.beginPath();
    g.moveTo(490, 135);
    g.lineTo(490, 197);
    g.stroke();
    // light spilling down the floor
    const sp = g.createLinearGradient(0, 230, 0, PH);
    sp.addColorStop(0, 'rgba(250,250,235,0.45)');
    sp.addColorStop(1, 'rgba(250,250,235,0)');
    g.fillStyle = sp;
    g.beginPath();
    g.moveTo(455, 230);
    g.lineTo(525, 230);
    g.lineTo(640, PH);
    g.lineTo(340, PH);
    g.closePath();
    g.fill();
    // floor tiles (lines to the vanishing point + perspective rows)
    g.strokeStyle = 'rgba(70,80,70,0.35)';
    g.lineWidth = 1.6;
    for (let k = -6; k <= 6; k++) {
      g.beginPath();
      g.moveTo(VX + k * 20, 230);
      g.lineTo(VX + k * 150, PH);
      g.stroke();
    }
    for (let k = 1; k < 8; k++) {
      const y = 230 + (PH - 230) * (1 - 1 / (1 + k * 0.45)) * 1.35;
      if (y > PH) break;
      const xl = lerp(430, 0, (y - 230) / (PH - 230));
      g.beginPath();
      g.moveTo(xl, y);
      g.lineTo(PW - xl, y);
      g.stroke();
    }
    // wall rail (a handrail line along each wall)
    g.strokeStyle = 'rgba(90,100,90,0.6)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 230);
    g.lineTo(430, 190);
    g.moveTo(PW, 230);
    g.lineTo(550, 190);
    g.stroke();
    // doors along the walls
    const door = (x0, x1, side, col) => {
      const pts = [[x0, lerp(top(x0), bot(x0), 0.28)], [x1, lerp(top(x1), bot(x1), 0.28)], [x1, bot(x1)], [x0, bot(x0)]];
      poly(g, pts, col, INK, 2);
      // a little round window
      const cx = (x0 + x1) / 2;
      const cy = lerp(top(cx), bot(cx), 0.42);
      g.fillStyle = '#e6ecdf';
      g.beginPath();
      g.ellipse(cx, cy, Math.abs(x1 - x0) * 0.16, 9 * (bot(cx) - top(cx)) / 250, 0, 0, TAU);
      g.fill();
      g.stroke();
    };
    door(215, 300, -1, '#8fa59a');
    door(360, 395, -1, '#8fa59a');
    door(765, 680, 1, '#8a9f94');
    door(600, 575, 1, '#8a9f94');
    // a plain plus-sign plaque on the far wall
    g.fillStyle = '#c85a4a';
    g.fillRect(484, 205, 12, 4);
    g.fillRect(488, 201, 4, 12);
    // ceiling lights; the second one flickers, and near the end it goes out
    for (let k = 0; k < 5; k++) {
      const f = 1 / (1 + k * 0.85);
      const y = lerp(118, 10, f);
      const w = lerp(16, 150, f);
      const h = lerp(3, 16, f);
      let on = 1;
      if (k === 1) {
        const fl = Math.sin(t * 37) * Math.sin(t * 13.3 + 1);
        on = fl > 0.55 ? 0.25 : 1;
        if (t > 64.0) on = 0.15;
      }
      if (on > 0.5) {
        const gl = g.createRadialGradient(VX, y + h, 0, VX, y + h, w * 0.9);
        gl.addColorStop(0, 'rgba(255,252,225,0.5)');
        gl.addColorStop(1, 'rgba(255,252,225,0)');
        g.fillStyle = gl;
        g.fillRect(VX - w, y, w * 2, w);
      }
      g.fillStyle = on > 0.5 ? '#fbf8e6' : '#b9bcb2';
      g.fillRect(VX - w / 2, y, w, h);
      g.strokeStyle = INK;
      g.lineWidth = 1.6;
      g.strokeRect(VX - w / 2, y, w, h);
    }
    // the empty wheelchair, right side
    g.save();
    g.translate(800, 300);
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.fillStyle = '#5d6f86';
    g.fillRect(-34, -38, 62, 10); // seat
    g.strokeRect(-34, -38, 62, 10);
    g.fillRect(16, -92, 10, 58); // backrest post
    g.strokeRect(16, -92, 10, 58);
    g.fillStyle = '#7d8fa6';
    g.fillRect(12, -88, 18, 44);
    g.strokeRect(12, -88, 18, 44);
    g.beginPath();
    g.arc(4, 0, 38, 0, TAU); // big wheel
    g.stroke();
    g.lineWidth = 2;
    for (let a = 0; a < 6; a++) {
      g.beginPath();
      g.moveTo(4, 0);
      g.lineTo(4 + Math.cos(a) * 36, Math.sin(a) * 36);
      g.stroke();
    }
    g.lineWidth = 3;
    g.beginPath();
    g.arc(-40, 26, 11, 0, TAU); // caster
    g.stroke();
    g.beginPath();
    g.moveTo(-34, -30);
    g.lineTo(-42, 16);
    g.stroke();
    g.restore();
    // a white coat on a hook, a stethoscope around its collar; it sways a little
    g.save();
    g.translate(118, 112);
    g.rotate(Math.sin(t * 1.3) * 0.03);
    g.fillStyle = '#5a5248';
    g.beginPath();
    g.arc(0, -4, 6, 0, TAU);
    g.fill();
    poly(g, [[-16, 4], [16, 4], [44, 40], [52, 168], [-52, 168], [-44, 40]], '#f6f3ea', INK, 2.5);
    hatch(g, { x: -52, y: 4, w: 104, h: 164 }, { angle: -0.9, spacing: 6, width: 1, color: '#7a8a8a', alpha: 0.12, seed: 91, broken: 0.6 });
    // lapels and the front opening
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-16, 4);
    g.lineTo(0, 60);
    g.lineTo(16, 4);
    g.moveTo(0, 60);
    g.lineTo(0, 168);
    g.stroke();
    // sleeves hanging
    poly(g, [[-44, 40], [-58, 150], [-44, 152], [-34, 60]], '#ebe7dc', INK, 2.5);
    poly(g, [[44, 40], [58, 150], [44, 152], [34, 60]], '#ebe7dc', INK, 2.5);
    // pocket
    g.strokeRect(12, 92, 24, 20);
    // stethoscope
    g.strokeStyle = '#2e3440';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-14, 8);
    g.bezierCurveTo(-30, 50, -22, 90, -8, 100);
    g.moveTo(14, 8);
    g.bezierCurveTo(30, 50, 18, 84, -2, 104);
    g.stroke();
    g.fillStyle = '#9aa3ad';
    g.beginPath();
    g.arc(-4, 108, 7, 0, TAU);
    g.fill();
    g.lineWidth = 2;
    g.stroke();
    g.restore();
    // dust motes drifting in the window light
    for (const m of motes) {
      const x = m.x + Math.sin(t * 0.6 + m.ph) * 14;
      const y = m.y + ((t * 6 + m.ph * 20) % 60) - 30;
      g.fillStyle = 'rgba(255,250,225,0.5)';
      g.beginPath();
      g.arc(x, y, m.s, 0, TAU);
      g.fill();
    }
  }

  // ---------- panel 2: the half-built bridge ----------
  function bridge(g, t) {
    const sk = g.createLinearGradient(0, 0, 0, PH);
    sk.addColorStop(0, '#8fa2b8');
    sk.addColorStop(0.6, '#d6c6b6');
    sk.addColorStop(1, '#e2cdb2');
    g.fillStyle = sk;
    g.fillRect(0, 0, PW, PH);
    for (const c of clouds) {
      const x = ((c.x + (t - T0) * 14) % (PW + 300)) - 150;
      g.fillStyle = 'rgba(245,238,228,0.55)';
      g.beginPath();
      g.ellipse(x, c.y, c.w * 0.5, c.w * 0.14, 0, 0, TAU);
      g.ellipse(x + c.w * 0.18, c.y - c.w * 0.07, c.w * 0.25, c.w * 0.12, 0, 0, TAU);
      g.fill();
    }
    // far hills
    g.fillStyle = 'rgba(110,120,140,0.45)';
    g.beginPath();
    g.moveTo(0, 230);
    g.quadraticCurveTo(250, 170, 520, 215);
    g.quadraticCurveTo(760, 250, PW, 190);
    g.lineTo(PW, PH);
    g.lineTo(0, PH);
    g.fill();
    // river
    const rv = g.createLinearGradient(0, 290, 0, PH);
    rv.addColorStop(0, '#6f8ea2');
    rv.addColorStop(1, '#4e6d84');
    g.fillStyle = rv;
    g.fillRect(0, 290, PW, PH - 290);
    g.strokeStyle = 'rgba(230,240,245,0.55)';
    g.lineWidth = 2.4;
    for (let k = 0; k < 14; k++) {
      const x = ((k * 97 + (t - T0) * 30) % (PW + 80)) - 40;
      const y = 305 + (k % 4) * 16;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 18, y - 4, x + 36, y);
      g.stroke();
    }
    // cliffs
    poly(g, [[0, 168], [190, 168], [215, 220], [240, 300], [240, PH], [0, PH]], '#8d7a62', INK, 2.5);
    poly(g, [[PW, 180], [810, 180], [785, 240], [770, 300], [770, PH], [PW, PH]], '#86735c', INK, 2.5);
    hatch(g, { x: 0, y: 168, w: 245, h: 200 }, { angle: -0.9, spacing: 6, width: 1.3, color: INK, alpha: 0.22, seed: 92, broken: 0.5 });
    hatch(g, { x: 765, y: 180, w: 215, h: 190 }, { angle: 0.9, spacing: 6, width: 1.3, color: INK, alpha: 0.22, seed: 93, broken: 0.5 });
    g.fillStyle = '#6f8a52';
    g.fillRect(0, 160, 192, 10);
    g.fillRect(808, 172, 172, 10);
    // the finished pier and the half-built one (with scaffolding)
    poly(g, [[372, 186], [404, 186], [410, PH], [366, PH]], '#b9b2a4', INK, 2.5);
    poly(g, [[640, 250], [668, 250], [674, PH], [634, PH]], '#b9b2a4', INK, 2.5);
    g.strokeStyle = 'rgba(70,55,40,0.8)';
    g.lineWidth = 2;
    for (let y = 250; y > 205; y -= 15) {
      g.beginPath();
      g.moveTo(630, y);
      g.lineTo(678, y);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(632, 250);
    g.lineTo(632, 200);
    g.moveTo(676, 250);
    g.lineTo(676, 200);
    g.stroke();
    // bridge deck from the left bank, stopping mid-air (beams and rebar sticking out)
    poly(g, [[150, 168], [560, 168], [560, 188], [150, 188]], '#a59f94', INK, 2.5);
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    for (let x = 170; x < 556; x += 34) {
      g.beginPath();
      g.moveTo(x, 168);
      g.lineTo(x, 148);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(150, 148);
    g.lineTo(550, 148);
    g.stroke();
    g.lineWidth = 2;
    for (const [dx, dy] of [[24, -6], [30, 2], [20, 10], [34, 16]]) {
      g.beginPath();
      g.moveTo(560, 172 + dy * 0.6);
      g.lineTo(560 + dx, 172 + dy);
      g.stroke();
    }
    // a short stub from the right bank
    poly(g, [[880, 180], [PW, 180], [PW, 198], [880, 198]], '#a59f94', INK, 2.5);
    g.beginPath();
    g.moveTo(880, 184);
    g.lineTo(860, 180);
    g.moveTo(880, 192);
    g.lineTo(864, 196);
    g.stroke();
    // striped barrier at the end of the deck
    g.save();
    g.translate(520, 150);
    g.fillStyle = '#f2ece0';
    g.fillRect(-26, -16, 52, 12);
    g.fillStyle = '#d8463d';
    for (let k = 0; k < 4; k++) g.fillRect(-26 + k * 14, -16, 7, 12);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(-26, -16, 52, 12);
    g.beginPath();
    g.moveTo(-20, -4);
    g.lineTo(-24, 18);
    g.moveTo(20, -4);
    g.lineTo(24, 18);
    g.stroke();
    g.restore();
    // the idle crane on the left bank, hook swaying in the wind
    g.strokeStyle = '#c99a2e';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(80, 168);
    g.lineTo(80, 34);
    g.moveTo(40, 34);
    g.lineTo(430, 34);
    g.stroke();
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(77, 34, 6, 134);
    g.lineWidth = 1.8;
    for (let y = 44; y < 168; y += 18) {
      g.beginPath();
      g.moveTo(74, y);
      g.lineTo(86, y + 18);
      g.stroke();
    }
    for (let x = 90; x < 430; x += 22) {
      g.beginPath();
      g.moveTo(x, 30);
      g.lineTo(x + 11, 38);
      g.lineTo(x + 22, 30);
      g.stroke();
    }
    g.fillStyle = '#6a5a4a';
    g.fillRect(36, 30, 26, 18);
    g.strokeRect(36, 30, 26, 18);
    const sw = Math.sin((t - T0) * 1.6) * 0.09 + Math.sin((t - T0) * 2.7) * 0.03;
    const hx = 380;
    const L = 92;
    const ex = hx + Math.sin(sw) * L;
    const ey = 38 + Math.cos(sw) * L;
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(hx, 38);
    g.lineTo(ex, ey);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.arc(ex, ey + 6, 6, -Math.PI * 0.2, Math.PI * 1.1);
    g.stroke();
    // wind streaks
    g.strokeStyle = 'rgba(250,245,235,0.55)';
    g.lineWidth = 2.4;
    for (let k = 0; k < 5; k++) {
      const x = ((k * 230 + (t - T0) * 260) % (PW + 300)) - 150;
      const y = 60 + k * 26;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 50, y - 8, x + 110, y);
      g.stroke();
    }
  }

  // ---------- panel 3: the parked plane ----------
  function cockpitXY() {
    return [208, 186];
  }
  function plane(g, t) {
    const sk = g.createLinearGradient(0, 0, 0, PH);
    sk.addColorStop(0, '#aeb8c2');
    sk.addColorStop(1, '#e4dccc');
    g.fillStyle = sk;
    g.fillRect(0, 0, PW, PH);
    for (const c of clouds) {
      const x = ((c.x * 1.3 + (t - T0) * 22) % (PW + 300)) - 150;
      g.fillStyle = 'rgba(240,238,232,0.6)';
      g.beginPath();
      g.ellipse(x, c.y * 0.8, c.w * 0.55, c.w * 0.13, 0, 0, TAU);
      g.fill();
    }
    // terminal and control tower far away
    g.fillStyle = 'rgba(120,125,135,0.55)';
    g.fillRect(560, 205, 300, 48);
    g.fillRect(890, 120, 26, 133);
    g.fillRect(878, 104, 50, 22);
    // grass strip and tarmac
    g.fillStyle = '#8a9a68';
    g.fillRect(0, 246, PW, 16);
    g.fillStyle = '#8b8984';
    g.fillRect(0, 262, PW, PH - 262);
    stipple(g, null, { x: 0, y: 262, w: PW, h: PH - 262 }, { count: 700, r: [0.8, 1.6], color: '#4a4844', alpha: 0.3, seed: 94 });
    g.fillStyle = '#e2c25a';
    for (let x = 0; x < PW; x += 70) g.fillRect(x, 330, 40, 6);
    for (const b of grass) {
      const bend = -(Math.sin(t * 3 + b.ph) * 3 + 6);
      g.strokeStyle = '#5f7244';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(b.x, 254);
      g.quadraticCurveTo(b.x + bend * 0.5, 254 - b.h * 0.6, b.x + bend, 254 - b.h);
      g.stroke();
    }
    // the plane (side view, nose left), parked with its door open and nobody around
    groundShadow2(g, 470, 300, 330, 0.28);
    g.save();
    const body = new Path2D();
    body.moveTo(170, 160);
    body.lineTo(720, 160);
    body.quadraticCurveTo(790, 160, 820, 120);
    body.lineTo(850, 120);
    body.lineTo(830, 200);
    body.lineTo(720, 228);
    body.lineTo(180, 228);
    body.quadraticCurveTo(120, 226, 118, 196);
    body.quadraticCurveTo(122, 164, 170, 160);
    body.closePath();
    g.fillStyle = '#f3f1ea';
    g.fill(body);
    g.save();
    g.clip(body);
    g.fillStyle = '#3f6fa8';
    g.fillRect(100, 200, 800, 12);
    hatch(g, { x: 110, y: 160, w: 760, h: 70 }, { angle: -0.9, spacing: 6, width: 1, color: '#6a7a8a', alpha: 0.12, seed: 95, broken: 0.6 });
    const sh = g.createLinearGradient(0, 160, 0, 228);
    sh.addColorStop(0, 'rgba(60,70,90,0)');
    sh.addColorStop(1, 'rgba(60,70,90,0.22)');
    g.fillStyle = sh;
    g.fillRect(100, 160, 800, 70);
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.stroke(body);
    // tail fin
    poly(g, [[760, 160], [800, 64], [836, 64], [842, 124]], '#3f6fa8', INK, 2.5);
    // wing and engine
    poly(g, [[380, 214], [560, 214], [620, 248], [430, 248]], '#cfcfcc', INK, 2.5);
    g.fillStyle = '#9ea3aa';
    g.beginPath();
    g.roundRect(440, 232, 80, 26, 12);
    g.fill();
    g.stroke();
    // landing gear
    g.fillStyle = '#2e2a28';
    for (const x of [220, 520, 560]) {
      g.beginPath();
      g.arc(x, 272, 11, 0, TAU);
      g.fill();
    }
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(220, 228);
    g.lineTo(220, 262);
    g.moveTo(540, 248);
    g.lineTo(540, 262);
    g.stroke();
    // cabin windows (dark, empty)
    g.fillStyle = '#4d5a6a';
    for (let x = 300; x < 730; x += 26) {
      g.beginPath();
      g.roundRect(x, 176, 12, 16, 5);
      g.fill();
    }
    // cockpit windows: empty
    poly(g, [[150, 178], [168, 166], [212, 166], [214, 182]], '#3f4c5c', INK, 2);
    poly(g, [[218, 166], [246, 166], [246, 182], [218, 182]], '#3f4c5c', INK, 2);
    // open door with boarding stairs
    g.fillStyle = '#2e3440';
    g.fillRect(262, 168, 26, 50);
    g.strokeStyle = INK;
    g.lineWidth = 2;
    g.strokeRect(262, 168, 26, 50);
    g.fillStyle = '#d8d2c4';
    g.beginPath();
    g.moveTo(262, 218);
    g.lineTo(288, 218);
    g.lineTo(352, 300);
    g.lineTo(316, 300);
    g.closePath();
    g.fill();
    g.stroke();
    for (let k = 1; k < 6; k++) {
      const u = k / 6;
      g.beginPath();
      g.moveTo(lerp(262, 316, u), lerp(218, 300, u));
      g.lineTo(lerp(288, 352, u), lerp(218, 300, u));
      g.stroke();
    }
    g.restore();
    // windsock, flapping hard
    const px = 940;
    g.strokeStyle = INK;
    g.lineWidth = 3.5;
    g.beginPath();
    g.moveTo(px, 300);
    g.lineTo(px, 150);
    g.stroke();
    // (it points right, so it stays half out of the panel: that's fine, the panel clips it)
    for (let k = 0; k < 5; k++) {
      const u0 = k / 5;
      const u1 = (k + 1) / 5;
      const wav = (u) => Math.sin(t * 9 - u * 6) * 5 * u;
      const r0 = 14 * (1 - u0 * 0.45);
      const r1 = 14 * (1 - u1 * 0.45);
      const x0 = px - 4 - u0 * 120;
      const x1 = px - 4 - u1 * 120;
      g.fillStyle = k % 2 ? '#f2ece0' : '#e07a2e';
      g.beginPath();
      g.moveTo(x0, 158 - r0 + wav(u0));
      g.lineTo(x1, 158 - r1 + wav(u1) + u1 * 6);
      g.lineTo(x1, 158 + r1 + wav(u1) + u1 * 6);
      g.lineTo(x0, 158 + r0 + wav(u0));
      g.closePath();
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.stroke();
    }
  }
  function groundShadow2(g, x, y, w, a) {
    const gr = g.createRadialGradient(x, y, 0, x, y, w);
    gr.addColorStop(0, `rgba(30,25,20,${a})`);
    gr.addColorStop(1, 'rgba(30,25,20,0)');
    g.fillStyle = gr;
    g.save();
    g.translate(x, y);
    g.scale(1, 0.12);
    g.beginPath();
    g.arc(0, 0, w, 0, TAU);
    g.restore();
    g.fill();
  }

  // inset: inside the cockpit, the pilot's seat is empty; a cap rests on it
  function cockpit(g, t, R) {
    const sk = g.createLinearGradient(0, -R, 0, 0);
    sk.addColorStop(0, '#a9b6c4');
    sk.addColorStop(1, '#e2dccc');
    g.fillStyle = sk;
    g.fillRect(-R, -R, 2 * R, 2 * R);
    // horizon through the windshield
    g.fillStyle = '#8b8984';
    g.fillRect(-R, -10, 2 * R, 40);
    // windshield frame and dashboard
    g.fillStyle = '#3a3f48';
    g.beginPath();
    g.moveTo(-R, -R);
    g.lineTo(R, -R);
    g.lineTo(R, -70);
    g.quadraticCurveTo(0, -112, -R, -70);
    g.closePath();
    g.fill();
    g.fillRect(-8, -100, 16, 110);
    g.fillStyle = '#2e333b';
    g.beginPath();
    g.moveTo(-R, 20);
    g.quadraticCurveTo(0, -4, R, 20);
    g.lineTo(R, R);
    g.lineTo(-R, R);
    g.closePath();
    g.fill();
    // dials (dark, no lights)
    g.strokeStyle = '#9aa3ad';
    g.lineWidth = 3;
    for (const [x, y] of [[-95, 46], [-55, 40], [55, 40], [95, 46]]) {
      g.beginPath();
      g.arc(x, y, 13, 0, TAU);
      g.stroke();
    }
    // the empty seat (back view, a little to the left) with a pilot's cap resting on it
    g.fillStyle = '#5a4a3e';
    g.beginPath();
    g.roundRect(-70, 52, 92, 120, 22);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#6e5c4e';
    g.beginPath();
    g.roundRect(-56, 30, 64, 40, 14);
    g.fill();
    g.stroke();
    // the cap: white crown, black visor, gold badge
    g.save();
    g.translate(-24, 66);
    g.rotate(-0.1);
    g.scale(1.25, 1.25);
    g.fillStyle = '#f4f1e8';
    g.beginPath();
    g.ellipse(0, -6, 34, 13, 0, 0, TAU);
    g.fill();
    g.lineWidth = 2.4;
    g.stroke();
    g.fillStyle = '#1f2a3c';
    g.beginPath();
    g.moveTo(-26, -2);
    g.lineTo(26, -2);
    g.lineTo(24, 8);
    g.lineTo(-24, 8);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#e8c25a';
    g.beginPath();
    g.arc(0, 2, 5, 0, TAU);
    g.fill();
    g.fillStyle = '#141b26';
    g.beginPath();
    g.moveTo(-22, 8);
    g.quadraticCurveTo(4, 26, 30, 10);
    g.lineTo(22, 7);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    // the yoke, untouched
    g.strokeStyle = '#1b1f26';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(70, 140);
    g.lineTo(70, 92);
    g.moveTo(44, 92);
    g.lineTo(96, 92);
    g.stroke();
  }

  function panel(g, P, t, fn) {
    const a = clamp((t - P.t0) / 0.45);
    if (a <= 0) return 0;
    const e = easeOut(a);
    g.save();
    g.translate(P.x + PW / 2, P.y + PH / 2 + (1 - e) * 40);
    g.rotate(P.rot);
    g.scale(0.94 + 0.06 * e, 0.94 + 0.06 * e);
    g.globalAlpha = e;
    g.translate(-PW / 2, -PH / 2);
    // drop shadow and a cream print border
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(10, 14, PW, PH);
    g.fillStyle = '#efe4cc';
    g.fillRect(-12, -12, PW + 24, PH + 24);
    g.save();
    g.beginPath();
    g.rect(0, 0, PW, PH);
    g.clip();
    fn(g, t);
    g.restore();
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.strokeRect(0, 0, PW, PH);
    g.restore();
    return e;
  }

  function inset(g, t) {
    const a = t - INSET.t0;
    if (a < 0) return;
    const pop = a < 0.5 ? easeOutBack(clamp(a / 0.45), 1.6) : 1;
    const R = INSET.r;
    // callout line from the cockpit window to the inset
    const P = PANELS[2];
    const [cx, cy] = cockpitXY();
    const sx = P.x + cx;
    const sy = P.y + cy;
    const la = clamp(a / 0.3);
    g.strokeStyle = rgba('#f1e3c2', 0.85 * la);
    g.lineWidth = 3;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(lerp(sx, INSET.x + R * 0.1, la), lerp(sy, INSET.y + R, la));
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = rgba('#f1e3c2', la);
    g.beginPath();
    g.arc(sx, sy, 6, 0, TAU);
    g.fill();
    g.save();
    g.translate(INSET.x, INSET.y);
    g.scale(pop, pop);
    const sg = g.createRadialGradient(14, 22, R * 0.8, 14, 22, R * 1.12);
    sg.addColorStop(0, 'rgba(0,0,0,0.4)');
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sg;
    g.beginPath();
    g.arc(14, 22, R * 1.12, 0, TAU);
    g.fill();
    g.save();
    g.beginPath();
    g.arc(0, 0, R, 0, TAU);
    g.clip();
    cockpit(g, t, R);
    g.restore();
    ring(g, 0, 0, R, { width: 6, color: RING_BLUE });
    g.restore();
    ripple(g, INSET.x, INSET.y, t, INSET.t0 + 0.05, { rMax: R * 1.8, dur: 1.0, width: 4, count: 1 });
  }

  const DRAW = { hall, bridge, plane };
  function draw(g, t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = BG;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.setTransform(S, 0, 0, S, 0, 0);
    const gl = g.createRadialGradient(540, 700, 80, 540, 700, 900);
    gl.addColorStop(0, 'rgba(110,80,60,0.3)');
    gl.addColorStop(1, 'rgba(110,80,60,0)');
    g.fillStyle = gl;
    g.fillRect(0, 0, 1080, 1920);
    const z = 1 + Math.max(0, t - T0) * 0.004;
    setCam(g, S, 540, 700 + 260 / z, z); // gentle push-in anchored at y 700
    for (const P of PANELS) panel(g, P, t, DRAW[P.id]);
    inset(g, t);
  }
  return { draw };
}
