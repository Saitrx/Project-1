// 2D text drawn at the full internal resolution (4K) so it stays razor sharp after downscaling.
// Layout numbers are in 1080x1920 units and scaled by k.
import { clamp, smoothstep } from './util.js';
import { CAPTIONS, CAPTION_FADE, HUD_LABEL, TITLE, TITLE_CARD, END_CARD, CODE_LINE } from './timeline.js';

function fadeAlpha(t, a, b, f) {
  return clamp(Math.min((t - a) / f, (b - t) / f));
}

function softPatch(ctx, x, y, rx, ry, alpha) {
  // Soft dark patch behind text for legibility, like the reference HUD/captions.
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(0,0,0,${0.26 * alpha})`);
  g.addColorStop(0.55, `rgba(0,0,0,${0.13 * alpha})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawHUD(ctx, k, { value, sub, alpha }) {
  if (alpha <= 0) return;
  const x = 64 * k;
  softPatch(ctx, 230 * k, 370 * k, 330 * k, 150 * k, alpha);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10 * k;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${19 * k}px PlexSans`;
  ctx.letterSpacing = `${3.4 * k}px`;
  ctx.fillText(HUD_LABEL, x, 312 * k);
  ctx.font = `400 ${66 * k}px Serif4`;
  ctx.letterSpacing = '0px';
  ctx.fillText(value, x - 3 * k, 384 * k);
  if (sub) {
    ctx.font = `600 ${19 * k}px PlexSans`;
    ctx.letterSpacing = `${3 * k}px`;
    ctx.globalAlpha = alpha * 0.92;
    ctx.fillText(sub, x, 428 * k);
  }
  ctx.restore();
}

export function drawCaption(ctx, k, text, alpha, { y = 1290, size = 50 } = {}) {
  if (alpha <= 0) return;
  const lines = text.split('\n');
  const lh = size * 1.28 * k;
  const cy = y * k;
  const top = cy - ((lines.length - 1) * lh) / 2;
  ctx.save();
  ctx.font = `italic 400 ${size * k}px Serif4`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  softPatch(ctx, 540 * k, cy, widest * 0.62 + 60 * k, lh * lines.length * 0.75 + 40 * k, alpha);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 16 * k;
  ctx.shadowOffsetY = 2 * k;
  lines.forEach((l, i) => ctx.fillText(l, 540 * k, top + i * lh));
  ctx.restore();
}

export function drawTitle(ctx, k, alpha) {
  if (alpha <= 0) return;
  const lines = ['What if AI decided', 'we were the problem?'];
  ctx.save();
  ctx.font = `400 ${74 * k}px Serif4`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  softPatch(ctx, 540 * k, 560 * k, 520 * k, 170 * k, alpha);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18 * k;
  lines.forEach((l, i) => ctx.fillText(l, 540 * k, (514 + i * 94) * k));
  ctx.restore();
}

export function drawEndCard(ctx, k, alpha) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f4f2ee';
  ctx.font = `400 ${68 * k}px Serif4`;
  ctx.fillText('Would you still give', 540 * k, 880 * k);
  ctx.fillText('AI the job?', 540 * k, 968 * k);
  ctx.globalAlpha = alpha * 0.55;
  ctx.font = `600 ${17 * k}px PlexSans`;
  ctx.letterSpacing = `${3.2 * k}px`;
  ctx.fillStyle = '#c9c6c0';
  ctx.fillText(TITLE.toUpperCase(), 540 * k, 1060 * k);
  ctx.restore();
}

export function drawCode(ctx, k, t) {
  const { start, typeEnd, text } = CODE_LINE;
  if (t < start - 0.3) return;
  const n = Math.floor(clamp((t - start) / (typeEnd - start)) * text.length);
  const shown = text.slice(0, n);
  ctx.save();
  ctx.font = `500 ${34 * k}px PlexMono`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const full = ctx.measureText(text).width;
  const x0 = 540 * k - full / 2;
  const y = 900 * k;
  const appear = smoothstep(start - 0.3, start, t);
  ctx.globalAlpha = appear;
  ctx.fillStyle = '#ff4136';
  ctx.shadowColor = 'rgba(255,40,30,0.75)';
  ctx.shadowBlur = 22 * k;
  ctx.fillText(shown, x0, y);
  // Block cursor: solid while typing, then a slow 1 Hz blink (well under 3 flashes/s).
  const typing = t < typeEnd;
  const on = typing || Math.floor((t - typeEnd) * 2) % 2 === 0;
  if (on) {
    const cx = x0 + ctx.measureText(shown).width + 4 * k;
    ctx.fillRect(cx, y - 20 * k, 18 * k, 40 * k);
  }
  ctx.restore();
}

export function drawCaptions(ctx, k, t) {
  for (const [a, b, text] of CAPTIONS) {
    if (t < a || t > b) continue;
    drawCaption(ctx, k, text, fadeAlpha(t, a, b, CAPTION_FADE));
  }
}

export function titleAlpha(t) {
  return fadeAlpha(t, TITLE_CARD.start - 1, TITLE_CARD.end, 0.45);
}

export function endAlpha(t) {
  return clamp((t - END_CARD.start) / 0.6);
}
