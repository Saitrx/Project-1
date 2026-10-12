// Text layer, drawn at the full internal resolution (4K) on its own canvas and composited after
// every image effect. Layout is authored in 1080x1920 units and every position is snapped to a
// whole 1080p pixel. Text only ever animates opacity (plus a tiny whole-pixel slide).
import { clamp } from './util.js';
import { BEATS, TITLE_LINES, TITLE_TIME, HUD_IN, END_SOURCES, beatAt, carScale, formatScale } from './timeline.js';

const SERIF = 'EBGaramond';
const SANS = 'InterUI';
const MONO = 'JBMono';

// Safe area (1080 units): nothing below y=1536 (bottom 20%) or right of x=918 (right 15%).
export const SAFE = { right: 918, bottom: 1536 };

const L = {
  hudX: 64,
  hudLabelY: 878,
  hudValueY: 958,
  hudFactY: 1004,
  capY: 1190, // 62% of 1920
  capMaxW: 740,
  capSize: 52,
  titleY: [430, 508],
  titleSize: 64,
};

function fade(t, a, b, f = 0.35) {
  return clamp(Math.min((t - a) / f, (b - t) / f));
}

function softPatch(ctx, k, cx, cy, rx, ry, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(cx * k, cy * k);
  ctx.scale(rx * k, ry * k);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(0,0,0,${0.26 * alpha})`);
  g.addColorStop(0.6, `rgba(0,0,0,${0.13 * alpha})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Draw text at a whole 1080p pixel position with a soft dark shadow.
function text(ctx, k, str, x, y, { font, size, align = 'left', spacing = 0, alpha = 1, color = '#ffffff', shadow = 0.6 }) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${font.replace('{s}', `${size * k}px`)}`;
  ctx.letterSpacing = `${spacing * k}px`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.shadowColor = `rgba(0,0,0,${shadow})`;
  ctx.shadowBlur = 12 * k;
  ctx.shadowOffsetY = 2 * k;
  ctx.fillText(str, Math.round(x) * k, Math.round(y) * k);
  ctx.restore();
}

function measure(ctx, k, str, font, size, spacing = 0) {
  ctx.save();
  ctx.font = font.replace('{s}', `${size * k}px`);
  ctx.letterSpacing = `${spacing * k}px`;
  const w = ctx.measureText(str).width / k;
  ctx.restore();
  return w;
}

// Greedy wrap into lines no wider than maxW (1080 units), then balance two-line captions.
export function wrapCaption(ctx, k, str, size = L.capSize, maxW = L.capMaxW) {
  const font = `italic 400 {s} ${SERIF}`;
  if (measure(ctx, k, str, font, size) <= maxW) return [str];
  const words = str.split(' ');
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const wa = measure(ctx, k, a, font, size);
    const wb = measure(ctx, k, b, font, size);
    if (wa > maxW || wb > maxW) continue;
    const score = Math.abs(wa - wb) + (/[,.]$/.test(a) ? -80 : 0);
    if (!best || score < best.score) best = { lines: [a, b], score };
  }
  return best ? best.lines : [str];
}

function drawHUD(ctx, k, t) {
  const b = beatAt(t);
  if (b.id === 'end') return;
  let alpha = clamp((t - HUD_IN) / 0.5);
  if (alpha <= 0) return;
  softPatch(ctx, k, 210, 945, 260, 135, alpha);
  if (b.id === 'crack') {
    const a = alpha * clamp((t - b.start) / 0.3) * (1 - clamp((t - (b.end - 0.25)) / 0.25));
    text(ctx, k, 'CAR SIZE: TOO BIG', L.hudX, L.hudLabelY, { font: `600 {s} ${SANS}`, size: 22, spacing: 3, alpha: a });
    text(ctx, k, 'HERE', L.hudX - 2, L.hudValueY, { font: `500 {s} ${SERIF}`, size: 72, alpha: a });
    return;
  }
  // Fade out with the space beat into the crack ending.
  text(ctx, k, 'CAR SIZE', L.hudX, L.hudLabelY, { font: `600 {s} ${SANS}`, size: 22, spacing: 3, alpha });
  text(ctx, k, formatScale(carScale(t)), L.hudX - 2, L.hudValueY, { font: `500 {s} ${SERIF}`, size: 72, alpha });
  // Fact line: the current beat's fact, crossfading at beat changes.
  for (const bb of BEATS) {
    if (!bb.fact) continue;
    const a = alpha * fade(t, bb.start, bb.end, 0.25) * (bb.start === 0 ? 1 : 1);
    if (a <= 0) continue;
    text(ctx, k, bb.fact, L.hudX, L.hudFactY, { font: `600 {s} ${SANS}`, size: 22, spacing: 2.6, alpha: a });
  }
}

function drawCaption(ctx, k, t) {
  for (const b of BEATS) {
    if (!b.caption) continue;
    const a0 = b.start + 0.35;
    const a1 = b.end - 0.3;
    if (t < a0 || t > a1) continue;
    const alpha = fade(t, a0, a1, 0.4);
    const lines = wrapCaption(ctx, k, b.caption);
    const lh = Math.round(L.capSize * 1.22);
    // Tiny whole-pixel slide up while fading in.
    const slide = Math.round(6 * (1 - clamp((t - a0) / 0.4)));
    const top = L.capY - ((lines.length - 1) * lh) / 2 + slide;
    softPatch(ctx, k, 540, L.capY, 400, 60 + 30 * lines.length, alpha);
    lines.forEach((ln, i) => {
      text(ctx, k, ln, 540, Math.round(top + i * lh + L.capSize * 0.32), {
        font: `italic 400 {s} ${SERIF}`,
        size: L.capSize,
        align: 'center',
        alpha,
        shadow: 0.65,
      });
    });
  }
}

function drawTitle(ctx, k, t) {
  const alpha = fade(t, TITLE_TIME.in, TITLE_TIME.out, 0.5);
  if (alpha <= 0) return;
  softPatch(ctx, k, 540, 470, 420, 140, alpha);
  TITLE_LINES.forEach((ln, i) => {
    text(ctx, k, ln, 540, L.titleY[i], { font: `500 {s} ${SERIF}`, size: L.titleSize, align: 'center', alpha, shadow: 0.6 });
  });
}

function drawEndCard(ctx, k, t) {
  const b = BEATS.find((x) => x.id === 'end');
  if (t < b.start) return;
  // Near-black card (#111) rising out of the black ending.
  ctx.fillStyle = `rgba(17,17,17,${clamp((t - b.start) / 0.3).toFixed(3)})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const a = clamp((t - b.start - 0.25) / 0.6);
  text(ctx, k, 'What if cars kept', 540, 812, { font: `500 {s} ${SERIF}`, size: 66, align: 'center', alpha: a, shadow: 0.3 });
  text(ctx, k, 'getting bigger?', 540, 892, { font: `500 {s} ${SERIF}`, size: 66, align: 'center', alpha: a, shadow: 0.3 });
  const a2 = clamp((t - b.start - 0.7) / 0.6);
  END_SOURCES.forEach((ln, i) => {
    text(ctx, k, ln, 540, 986 + i * 34, {
      font: `400 {s} ${MONO}`,
      size: 20,
      align: 'center',
      spacing: 1.2,
      alpha: a2,
      color: '#b4b4b4',
      shadow: 0.3,
    });
  });
}

export function drawOverlay(ctx, W, H, t) {
  const k = W / 1080;
  ctx.clearRect(0, 0, W, H);
  drawTitle(ctx, k, t);
  drawHUD(ctx, k, t);
  drawCaption(ctx, k, t);
  drawEndCard(ctx, k, t);
}

export const FONTS = [
  `500 100px ${SERIF}`,
  `italic 400 100px ${SERIF}`,
  `600 100px ${SANS}`,
  `400 100px ${MONO}`,
];
