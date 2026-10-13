// Captions on their own full-resolution canvas, composited last (never moved by the camera or
// blurred). Timing comes from the narration (vo_timing.js): each chunk fades in as its words start.
// A chunk that extends the previous one (the "No homework. No tests. No alarms." lists) reveals
// only its new words, so the line builds up in place instead of flashing.
import { VO } from './vo_timing.js';
import { clamp } from './kit/util.js';

const FADE_IN = 0.25;
const FADE_OUT = 0.3;
const FONT_PX = 58; // design px on the 1080 x 1920 frame
const LINE_H = 70;
const MAX_W = 740; // centred at x 540, so lines stay inside x 170..910 (clear of the right 15%)
const BOTTOM = 1470; // last baseline; descenders stay above y 1536 (the bottom 20%)
const CENTER = 530;
// The opening and closing shots frame the boy big on the right; their captions sit left of him.
const CENTER_BY_LINE = { 1: 300, 11: 300 };

const plain = (s) => s.replace(/\|/g, ' ');

// Groups of chunks shown together: {rows, segs: [{row, from, to, t0}], t0, t1}.
export const GROUPS = (() => {
  const out = [];
  for (const line of VO) {
    const ch = line.chunks;
    let i = 0;
    while (i < ch.length) {
      // extend while the next chunk continues this one
      let j = i;
      while (j + 1 < ch.length && plain(ch[j + 1].text).startsWith(plain(ch[j].text))) j++;
      const finalText = ch[j].text;
      const rows = finalText.split('|');
      const segs = [];
      let prevLen = 0;
      for (let k = i; k <= j; k++) {
        const len = plain(ch[k].text).length;
        // map [prevLen, len) in the plain string onto rows
        let base = 0;
        rows.forEach((r, ri) => {
          const a = Math.max(prevLen, base);
          const b = Math.min(len, base + r.length);
          if (b > a) segs.push({ row: ri, from: a - base, to: b - base, t0: ch[k].t - 0.05 });
          base += r.length + 1;
        });
        prevLen = len;
      }
      const next = ch[j + 1];
      const t0 = ch[i].t - 0.05;
      const t1 = next ? next.t - 0.08 - FADE_OUT : line.sceneEnd - 0.12 - FADE_OUT;
      out.push({ rows, segs, t0, t1, center: CENTER_BY_LINE[line.line] ?? CENTER });
      i = j + 1;
    }
  }
  return out;
})();

export function drawCaptions(tg, S, t) {
  tg.setTransform(1, 0, 0, 1, 0, 0);
  tg.clearRect(0, 0, tg.canvas.width, tg.canvas.height);
  for (const G of GROUPS) {
    if (t < G.t0 || t > G.t1 + FADE_OUT) continue;
    const out = 1 - clamp((t - G.t1) / FADE_OUT);
    tg.save();
    tg.setTransform(S, 0, 0, S, 0, 0);
    tg.font = `500 ${FONT_PX}px "EBGaramond"`;
    tg.textAlign = 'left';
    tg.textBaseline = 'alphabetic';
    const y0 = BOTTOM - (G.rows.length - 1) * LINE_H;
    for (const sg of G.segs) {
      const a = clamp((t - sg.t0) / FADE_IN) * out;
      if (a <= 0) continue;
      const row = G.rows[sg.row];
      const rowW = tg.measureText(row).width;
      if (rowW > MAX_W + 1) console.warn('caption row too wide', row, rowW);
      const x0 = G.center - rowW / 2 + tg.measureText(row.slice(0, sg.from)).width;
      const txt = row.slice(sg.from, sg.to);
      const rise = (1 - clamp((t - sg.t0) / 0.5)) ** 2 * 8;
      const y = Math.round((y0 + sg.row * LINE_H + rise) * S) / S;
      // Soft dark shadow in two passes (wide glow + tight drop), drawn far off-canvas with only
      // the shadow offset back into place, then the cream text.
      const OFF = 5000;
      for (const [blur, alpha, dy] of [
        [24, 0.62, 0],
        [6, 0.72, 2.5],
      ]) {
        tg.shadowColor = `rgba(18,10,4,${alpha * a})`;
        tg.shadowBlur = blur * S;
        tg.shadowOffsetX = -OFF * S;
        tg.shadowOffsetY = dy * S;
        tg.fillStyle = '#000';
        tg.fillText(txt, x0 + OFF, y);
      }
      tg.shadowOffsetX = 0;
      tg.shadowOffsetY = 0;
      tg.shadowColor = 'transparent';
      tg.fillStyle = `rgba(250,243,226,${a})`;
      tg.fillText(txt, x0, y);
    }
    tg.restore();
  }
}
