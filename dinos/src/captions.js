// Captions on their own full-resolution canvas, composited last (never moved by the camera).
// Timing comes from the narration (vo_timing.js): each chunk fades in as its sentence starts.
import { VO } from './vo_timing.js';
import { clamp } from './kit/util.js';

const SCENE_END = [5, 11, 17, 23, 30, 36, 42, 48, 54, 60];
const FADE_IN = 0.28;
const FADE_OUT = 0.3;
const FONT_PX = 54; // design px on the 1080 x 1920 frame
const LINE_H = 66;
const MAX_W = 740; // keeps lines inside x 170..910 (clear of the right 15%)
const BOTTOM = 1488; // last baseline; text stays above y 1536 (the bottom 20%)

// Flatten to chunks with start and end times.
export const CHUNKS = (() => {
  const list = [];
  VO.forEach((line, li) => line.chunks.forEach((c) => list.push({ text: c.text, t0: c.t - 0.06, line: li })));
  list.forEach((c, i) => {
    const next = list[i + 1];
    const sceneEnd = SCENE_END[c.line];
    // Hold until the next chunk if it follows soon (then hand over without overlapping);
    // otherwise until just before the scene ends.
    if (next && next.t0 - sceneEnd < 0.7) {
      c.t1 = next.t0 - FADE_OUT;
      next.t0 += 0.04;
    } else c.t1 = sceneEnd - 0.12;
    if (!next) c.t1 = 59.55;
  });
  return list;
})();

function wrap(g, text) {
  if (text.includes('|')) return text.split('|');
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (g.measureText(test).width > MAX_W && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  // Balance two-line captions so the lines are similar in length.
  if (lines.length === 2) {
    let best = lines;
    let score = Math.abs(g.measureText(lines[0]).width - g.measureText(lines[1]).width);
    for (let k = 1; k < words.length; k++) {
      const a = words.slice(0, k).join(' ');
      const b = words.slice(k).join(' ');
      const wa = g.measureText(a).width;
      const wb = g.measureText(b).width;
      if (wa <= MAX_W && wb <= MAX_W && Math.abs(wa - wb) < score) {
        score = Math.abs(wa - wb);
        best = [a, b];
      }
    }
    return best;
  }
  return lines;
}

export function drawCaptions(tg, S, t) {
  tg.setTransform(1, 0, 0, 1, 0, 0);
  tg.clearRect(0, 0, tg.canvas.width, tg.canvas.height);
  for (const c of CHUNKS) {
    if (t < c.t0 || t > c.t1 + FADE_OUT) continue;
    const a = clamp((t - c.t0) / FADE_IN) * (1 - clamp((t - c.t1) / FADE_OUT));
    if (a <= 0) continue;
    const rise = (1 - clamp((t - c.t0) / 0.5)) ** 2 * 10; // settles up into place as it fades in
    tg.save();
    tg.setTransform(S, 0, 0, S, 0, 0);
    tg.font = `500 ${FONT_PX}px "EBGaramond"`;
    tg.textAlign = 'center';
    tg.textBaseline = 'alphabetic';
    const lines = wrap(tg, c.text);
    const y0 = BOTTOM - (lines.length - 1) * LINE_H + rise;
    // Soft dark shadow in two passes (wide glow + tight drop), then the cream text. The shadow
    // passes draw the text far off-canvas and offset only its shadow back into place.
    const OFF = 5000;
    for (const [blur, alpha, dy] of [
      [26, 0.6, 0],
      [7, 0.7, 2.5],
    ]) {
      tg.shadowColor = `rgba(18,10,4,${alpha * a})`;
      tg.shadowBlur = blur * S;
      tg.shadowOffsetX = -OFF * S;
      tg.shadowOffsetY = dy * S;
      tg.fillStyle = '#000';
      lines.forEach((l, i) => tg.fillText(l, 540 + OFF, Math.round((y0 + i * LINE_H) * S) / S));
    }
    tg.shadowOffsetX = 0;
    tg.shadowOffsetY = 0;
    tg.shadowColor = 'transparent';
    tg.fillStyle = `rgba(250,242,224,${a})`;
    lines.forEach((l, i) => tg.fillText(l, 540, Math.round((y0 + i * LINE_H) * S) / S));
    tg.restore();
  }
}
