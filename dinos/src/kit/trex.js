// Tyrannosaurus rex, side view facing left. Local origin at the hip joint; units are design px at
// scale 1 (about 1380 long, hip about 420 above the ground).
import { buildCreature, drawCreature, glossyBall, rgba, shade, INK } from './creature.js';
import { smoothPath } from './paint.js';

const SKIN = '#7a6f47';
const FAR = '#5f5739';
export const TREX_GROUND = 446;

function teeth(g, x0, x1, y, dir, n, len) {
  g.save();
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    const l = len * (0.7 + 0.3 * Math.sin((i / n) * Math.PI));
    g.fillStyle = '#efe4c8';
    g.beginPath();
    g.moveTo(x - 4.2, y);
    g.quadraticCurveTo(x - 2, y + dir * l * 0.7, x + 1, y + dir * l);
    g.quadraticCurveTo(x + 2, y + dir * l * 0.5, x + 4.2, y);
    g.closePath();
    g.fill();
    g.strokeStyle = rgba(INK, 0.85);
    g.lineWidth = 0.8;
    g.stroke();
  }
  g.restore();
}

export function trexDef(far = false) {
  const leg = (suffix, fill, z0) => [
    { name: 'thigh' + suffix, parent: 'body', at: [-20, 0], z: z0, fill, pts: [[70, -70], [10, -96], [-60, -80], [-92, -10], [-78, 80], [-40, 160], [-4, 190], [30, 172], [56, 110], [80, 20]], shadowDepth: 50, outlineAlpha: 0.5 },
    { name: 'shin' + suffix, parent: 'thigh' + suffix, at: [-2, 176], z: z0 - 0.2, fill, pts: [[30, -14], [-30, -18], [-40, 56], [-28, 130], [-12, 170], [16, 170], [32, 112], [38, 34]] },
    {
      name: 'foot' + suffix,
      parent: 'shin' + suffix,
      at: [2, 164],
      z: z0 - 0.4,
      fill,
      pts: [[16, -8], [-16, -8], [-30, 58], [-56, 78], [-122, 86], [-134, 100], [-60, 106], [12, 106], [30, 92], [24, 40]],
      extra: (g) => {
        // claws on the toes
        for (const [x, y] of [[-134, 98], [-96, 104], [-58, 106]]) {
          g.fillStyle = '#2b2118';
          g.beginPath();
          g.moveTo(x + 10, y - 7);
          g.quadraticCurveTo(x - 6, y - 8, x - 12, y + 3);
          g.quadraticCurveTo(x - 2, y + 2, x + 10, y + 4);
          g.closePath();
          g.fill();
        }
      },
    },
  ];
  const parts = [
    {
      name: 'body',
      z: 1,
      // one continuous outline: base of the tail, back, neck, throat, chest, belly
      pts: [[420, -40], [300, -58], [180, -80], [90, -98], [0, -106], [-100, -108], [-200, -100], [-280, -94], [-336, -116], [-388, -150], [-432, -170], [-462, -150], [-452, -104], [-420, -60], [-384, -18], [-360, 30], [-328, 78], [-268, 112], [-170, 124], [-70, 106], [10, 80], [80, 52], [180, 40], [300, 28], [420, 20]],
      stripes: { color: '#332c1a', gap: 52, w: 18, len: 0.26, alpha: 0.5 },
      shadowDepth: 80,
      belly: '#d2c290',
      bellyFrom: 0.55,
    },
    { name: 'tail2', parent: 'body', at: [404, -10], z: 0.4, pts: [[-12, -32], [120, -24], [240, -13], [340, -3], [352, 3], [240, 11], [120, 21], [-12, 32]], stripes: { color: '#332c1a', gap: 46, w: 14, len: 0.45, alpha: 0.5 }, shadowDepth: 22 },
    { name: 'neck', parent: 'body', at: [-440, -150], z: 0.9, pts: [[0, 0]], hidden: true },
    {
      name: 'head',
      parent: 'neck',
      at: [0, 0],
      z: 1.3,
      pts: [[30, -22], [10, -60], [-30, -72], [-62, -64], [-100, -54], [-160, -48], [-214, -40], [-246, -26], [-252, -2], [-240, 14], [-180, 18], [-110, 22], [-50, 30], [0, 36], [32, 18]],
      shadowDepth: 36,
      extra: (g) => {
        teeth(g, -236, -64, 15, 1, 12, 15);
        // nostril, brow ridge, eye
        g.fillStyle = 'rgba(30,22,14,0.8)';
        g.beginPath();
        g.ellipse(-232, -20, 7, 4, -0.3, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = rgba(INK, 0.9);
        g.lineWidth = 5;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(-66, -58);
        g.quadraticCurveTo(-42, -66, -20, -54);
        g.stroke();
        glossyBall(g, -42, -42, 8.5, { color: '#c8862a', ring: '#3a2412' });
        g.fillStyle = '#120a05';
        g.beginPath();
        g.ellipse(-42, -42, 2.6, 7, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,250,235,0.9)';
        g.beginPath();
        g.arc(-45, -46, 2, 0, Math.PI * 2);
        g.fill();
        // skin folds and scutes along the snout
        g.strokeStyle = rgba(INK, 0.55);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(-10, 6);
        g.quadraticCurveTo(-60, 0, -120, 10);
        g.stroke();
      },
    },
    {
      name: 'jaw',
      parent: 'head',
      at: [-18, 26],
      z: 1.2,
      pts: [[34, -2], [4, 14], [-70, 22], [-150, 24], [-204, 16], [-222, 4], [-200, -6], [-120, -8], [-40, -8], [10, -10]],
      shadowDepth: 18,
      extra: (g) => teeth(g, -206, -50, -6, -1, 10, 11),
    },
    { name: 'arm', parent: 'body', at: [-330, 48], z: 1.5, pts: [[12, -10], [-10, -12], [-20, 26], [-38, 50], [-62, 58], [-66, 48], [-48, 38], [-34, 20], [-12, 12]], shadowDepth: 10, scale: 4 },
    { name: 'armFar', parent: 'body', at: [-312, 44], z: 0.2, fill: FAR, pts: [[12, -10], [-10, -12], [-20, 26], [-38, 50], [-62, 58], [-66, 48], [-48, 38], [-34, 20], [-12, 12]], shadowDepth: 10, scale: 4 },
    ...leg('Far', FAR, 0.3),
    ...leg('', SKIN, 2.2),
  ];
  return { fill: SKIN, belly: '#cdbd8c', bellyFrom: 0.5, scale: 7, seed: 77, light: [-0.4, -1], parts };
}

export function buildTrex(res) {
  return buildCreature(res, trexDef());
}

// Standing pose with breathing, head motion and a little tail sway. extra: { headUp, jaw, lean }.
export function trexPose(t, extra = {}) {
  const br = Math.sin(t * 1.6);
  const sway = Math.sin(t * 0.9) * 0.05;
  return {
    body: (extra.lean ?? 0) + br * 0.01,
    body_s: [1, 1 + br * 0.012],
    tail1: 0.04 + sway,
    tail2: 0.03 + sway * 1.6 + Math.sin(t * 0.9 - 0.8) * 0.04,
    neck: -0.04 + (extra.neck ?? 0) + br * 0.012,
    head: (extra.headUp ?? 0) + Math.sin(t * 0.7) * 0.03,
    jaw: extra.jaw ?? 0,
    thigh: -(extra.lean ?? 0) * 1,
    shin: 0,
    foot: 0,
    thighFar: 0.18 - (extra.lean ?? 0),
    shinFar: -0.05,
    footFar: -0.12,
    arm: Math.sin(t * 1.3) * 0.08,
    armFar: Math.sin(t * 1.3 + 1) * 0.08,
  };
}

export { drawCreature };
