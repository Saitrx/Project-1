// Line-art skeletons of a T. rex and a chicken with the same bone list (same ids), so one can morph
// into the other and matching bones can be highlighted together. T. rex bones are authored in the
// T. rex creature's part coordinates (so they follow its pose); chicken bones in a hip-origin frame
// (facing left, ground at y = 330).

const N = 22; // points per bone after resampling

function circle(cx, cy, rx, ry = rx, n = 16) {
  return Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry]);
}

// Closed outline of a long bone between a and b, width w, with knobbed ends.
function longBone(a, b, w) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const nx = -uy;
  const ny = ux;
  const pt = (s, o) => [a[0] + ux * s + nx * o, a[1] + uy * s + ny * o];
  const k = w * 0.75;
  return [
    pt(-k * 0.6, 0), pt(-k * 0.3, k), pt(k * 0.5, k * 0.9), pt(k * 1.4, w * 0.42), pt(l * 0.5, w * 0.36), pt(l - k * 1.4, w * 0.42), pt(l - k * 0.5, k * 0.9), pt(l + k * 0.3, k),
    pt(l + k * 0.6, 0), pt(l + k * 0.3, -k), pt(l - k * 0.5, -k * 0.9), pt(l - k * 1.4, -w * 0.42), pt(l * 0.5, -w * 0.36), pt(k * 1.4, -w * 0.42), pt(k * 0.5, -k * 0.9), pt(-k * 0.3, -k),
  ];
}

// Small vertebra box centred at c, rotated by a, with a spine of length sp.
function vert(c, a, s, sp = 0) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const P = (x, y) => [c[0] + x * ca - y * sa, c[1] + x * sa + y * ca];
  return [P(-s * 0.5, -s * 0.35), P(-s * 0.15, -s * 0.4), P(-s * 0.05, -s * 0.4 - sp), P(s * 0.12, -s * 0.4 - sp), P(s * 0.2, -s * 0.4), P(s * 0.5, -s * 0.35), P(s * 0.55, 0), P(s * 0.5, s * 0.35), P(-s * 0.5, s * 0.35), P(-s * 0.55, 0)];
}

const lerp = (a, b, t) => a + (b - a) * t;
const along = (pts, u) => {
  const m = pts.length - 1;
  const i = Math.min(m - 1, Math.floor(u * m));
  const f = u * m - i;
  return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)];
};

// ---------------- T. rex (part coordinates) ----------------
export function trexBones() {
  const B = [];
  const add = (id, part, pts, group, closed = true, far = false) => B.push({ id, part, pts, group, closed, far });
  add('skull', 'head', [[22, -16], [6, -52], [-30, -62], [-62, -56], [-100, -48], [-160, -42], [-210, -34], [-238, -20], [-242, 0], [-230, 11], [-178, 15], [-110, 19], [-50, 25], [0, 28], [24, 14]], 'skull');
  add('orbit', 'head', circle(-42, -38, 11), 'skull');
  add('fen', 'head', circle(-122, -18, 32, 13), 'skull');
  add('naris', 'head', circle(-222, -16, 10, 5), 'skull');
  add('jaw', 'jaw', [[28, -2], [2, 11], [-70, 17], [-150, 19], [-200, 11], [-214, 2], [-196, -4], [-120, -5], [-40, -5], [8, -7]], 'skull');
  const teeth = [];
  for (let i = 0; i <= 12; i++) teeth.push([-232 + i * 14, i % 2 ? 26 : 13]);
  add('teeth', 'head', teeth, 'skull', false);
  // neck vertebrae (body coords, curving up to the head)
  const neck = [[-300, -96], [-340, -112], [-380, -130], [-412, -146], [-436, -156], [-452, -158]];
  neck.forEach((c, i) => add('neck' + i, 'body', vert(c, -0.5, 30, 10), 'spine'));
  // back vertebrae with tall spines
  for (let i = 0; i < 12; i++) {
    const x = -276 + i * 28;
    add('back' + i, 'body', vert([x, -74 + Math.sin((i / 11) * Math.PI) * -6], 0, 24, 22), 'spine');
  }
  // tail vertebrae: body part then tail2
  for (let i = 0; i < 10; i++) add('tail' + i, 'body', vert([70 + i * 36, -40 + i * 3], 0.08, 30 - i * 1.2, 16 - i), 'tail');
  for (let i = 0; i < 12; i++) add('tail' + (10 + i), 'tail2', vert([14 + i * 28, 0], 0.03, 18 - i * 1.1, 6 - i * 0.4), 'tail');
  for (let i = 0; i < 8; i++) add('chev' + i, 'body', [[86 + i * 36, -24 + i * 3], [80 + i * 36, 8 + i * 1.5 - i * 1.5]], 'tail', false);
  // ribs and belly ribs
  for (let i = 0; i < 10; i++) {
    const x = -270 + i * 24;
    const len = 150 - Math.abs(i - 3) * 9;
    add('rib' + i, 'body', [[x, -60], [x - 10, -60 + len * 0.35], [x - 4, -60 + len * 0.75], [x + 10, -60 + len]], 'ribs', false);
  }
  for (let i = 0; i < 7; i++) {
    const x = -250 + i * 30;
    add('gast' + i, 'body', [[x - 14, 104], [x, 112], [x + 14, 104]], 'ribs', false);
  }
  add('furcula', 'body', [[-372, -26], [-356, 32], [-338, -24]], 'furcula', false);
  add('scapula', 'body', [[-312, -70], [-292, -76], [-246, -6], [-266, 2]], 'arm');
  add('humerus', 'arm', longBone([2, -4], [-20, 26], 9), 'arm');
  add('forearm', 'arm', longBone([-20, 26], [-40, 46], 7), 'arm');
  add('finger0', 'arm', [[-40, 46], [-52, 50], [-62, 54]], 'arm', false);
  add('finger1', 'arm', [[-40, 46], [-50, 42], [-60, 40]], 'arm', false);
  add('ilium', 'body', [[-92, -88], [60, -94], [112, -62], [82, -36], [-60, -34], [-104, -58]], 'pelvis');
  add('pubis', 'body', [[-30, -36], [-60, 60], [-78, 118], [-28, 124], [-40, 108], [-14, 40]], 'pelvis');
  add('ischium', 'body', [[30, -36], [52, 40], [74, 76], [62, 84], [28, 30]], 'pelvis');
  for (const [suf, far] of [['Far', true], ['', false]]) {
    add('femur' + suf, 'thigh' + suf, longBone([6, -14], [-4, 174], 30), 'femur', true, far);
    add('tibia' + suf, 'shin' + suf, longBone([0, -8], [2, 160], 24), 'tibia', true, far);
    add('fibula' + suf, 'shin' + suf, [[16, 0], [20, 80], [14, 156]], 'tibia', false, far);
    add('meta' + suf, 'foot' + suf, longBone([0, -4], [-30, 66], 20), 'foot', true, far);
    add('toe0' + suf, 'foot' + suf, [[-30, 66], [-74, 84], [-116, 92], [-134, 98]], 'foot', false, far);
    add('toe1' + suf, 'foot' + suf, [[-28, 68], [-66, 92], [-96, 102]], 'foot', false, far);
    add('toe2' + suf, 'foot' + suf, [[-26, 68], [-46, 96], [-60, 104]], 'foot', false, far);
  }
  return B;
}

// ---------------- chicken (hip origin) ----------------
export function chickenBones() {
  const C = {};
  const add = (id, pts) => (C[id] = pts);
  add('skull', [[-128, -232], [-146, -254], [-178, -262], [-204, -250], [-214, -230], [-250, -216], [-212, -206], [-182, -202], [-150, -208], [-128, -218]]);
  add('orbit', circle(-180, -236, 14));
  add('fen', circle(-206, -224, 8, 4));
  add('naris', circle(-228, -218, 5, 2.5));
  add('jaw', [[-150, -206], [-170, -200], [-240, -212], [-246, -210], [-200, -198], [-160, -200]]);
  const teeth = [];
  for (let i = 0; i <= 12; i++) teeth.push([-246 + i * 4, -213]);
  add('teeth', teeth);
  const neckC = [[-84, -112], [-104, -128], [-110, -152], [-104, -174], [-112, -194], [-128, -206]];
  neckC.forEach((c, i) => add('neck' + i, vert(c, -1.4 + i * 0.25, 16, 4)));
  for (let i = 0; i < 12; i++) add('back' + i, vert([-74 + i * 9, -112 + Math.sin(i * 0.3) * 2], 0, 9, 8));
  // a few free tail vertebrae, the rest fused into the pygostyle
  for (let i = 0; i < 22; i++) {
    if (i < 5) add('tail' + i, vert([42 + i * 15, -122 - i * 4], -0.3, 13, 7));
    else add('tail' + i, vert([128 + (i - 5) * 1.6, -144 - (i - 5) * 1.4], -0.6, 6, 2));
  }
  for (let i = 0; i < 8; i++) add('chev' + i, [[130, -140], [134, -136]]);
  for (let i = 0; i < 10; i++) {
    const x = -70 + i * 9;
    add('rib' + i, [[x, -104], [x - 6, -80], [x - 8, -50], [x - 12, -20]]);
  }
  // T. rex belly ribs become the chicken's breastbone keel
  const keel = [[-112, -24], [-80, 34], [-30, 46], [10, 10], [-20, -18]];
  for (let i = 0; i < 7; i++) {
    const a = along(keel, i / 7);
    const b = along(keel, (i + 0.5) / 7);
    const c = along(keel, (i + 1) / 7);
    add('gast' + i, [a, b, c]);
  }
  add('furcula', [[-108, -108], [-98, -58], [-88, -106]]);
  add('scapula', [[-74, -112], [-66, -116], [20, -104], [14, -98]]);
  add('humerus', longBone([-78, -82], [-12, -64], 9));
  add('forearm', longBone([-12, -64], [-90, -54], 7));
  add('finger0', [[-90, -54], [-112, -56], [-132, -58]]);
  add('finger1', [[-90, -54], [-108, -48], [-122, -46]]);
  add('ilium', [[-42, -122], [100, -130], [132, -106], [112, -82], [-30, -86], [-52, -102]]);
  add('pubis', [[0, -86], [62, -42], [134, -20], [138, -28], [62, -52], [12, -90]]);
  add('ischium', [[40, -86], [90, -62], [122, -62], [102, -76], [50, -90]]);
  for (const [suf, dx, dy] of [['Far', 12, -4], ['', 0, 0]]) {
    const o = (p) => [p[0] + dx, p[1] + dy];
    add('femur' + suf, longBone(o([0, -92]), o([-44, -20]), 18));
    add('tibia' + suf, longBone(o([-44, -20]), o([14, 170]), 15));
    add('fibula' + suf, [o([-36, -16]), o([-16, 40]), o([-6, 90])]);
    add('meta' + suf, longBone(o([14, 170]), o([-10, 300]), 13));
    add('toe0' + suf, [o([-10, 300]), o([-60, 318]), o([-96, 326]), o([-110, 330])]);
    add('toe1' + suf, [o([-10, 302]), o([-44, 322]), o([-68, 330])]);
    add('toe2' + suf, [o([-8, 302]), o([-22, 322]), o([-30, 330])]);
  }
  return C;
}

// Resample a polyline (closed or open) to N points by arc length.
export function resample(pts, closed, n = N) {
  const P = closed ? [...pts, pts[0]] : pts;
  const seg = [];
  let total = 0;
  for (let i = 1; i < P.length; i++) {
    const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    seg.push(l);
    total += l;
  }
  const out = [];
  const m = closed ? n : n - 1;
  for (let k = 0; k < n; k++) {
    let d = (k / m) * total;
    let i = 0;
    while (i < seg.length - 1 && d > seg[i]) {
      d -= seg[i];
      i++;
    }
    const f = seg[i] ? Math.min(1, d / seg[i]) : 0;
    out.push([lerp(P[i][0], P[i + 1][0], f), lerp(P[i][1], P[i + 1][1], f)]);
  }
  return out;
}

export const GLOW_ORDER = [
  ['skull', 50.95],
  ['furcula', 51.4],
  ['femur', 51.85],
  ['tibia', 52.25],
  ['foot', 52.65],
  ['pelvis', 53.05],
];
