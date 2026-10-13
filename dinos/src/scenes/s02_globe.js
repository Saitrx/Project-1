// 0:05-0:11 The illustrated Earth dissolves into its line-art twin on dark brown: cream coastlines,
// lavender graticule with sparkle nodes, then gold "life" dots. Everything follows the narration
// ("About seventy-five percent of all species would have survived", words at 5.3-9.5 s): the dots
// pop on during "About seventy-five", the donut fills to 75% as he says "seventy-five percent", a
// glow wave runs over all the dots on "all species", three in four then dim as if about to go out
// (the species that died) and flare back gold on "survived".
import { canvas, strokePartial, sparkle, rgba, smoothPath } from '../kit/paint.js';
import { makeRng, clamp, lerp, smoothstep, easeOutBack, easeInOut, TAU } from '../kit/util.js';
import { setCam } from '../kit/cam.js';
import { EARTH, VIEW, loadLand, landPolylines, projectPoint, makeProjection } from '../kit/earth.js';
import { geoContains } from 'd3-geo';

const BG = '#180f0b';
const CREAM = '#f1e3c2';
const LAV = '#8e8fd6';
const GOLD = '#e8b04a';

export async function build(env) {
  const { S } = env;
  const land = await loadLand();
  const R = EARTH.r * 1.0115;
  const cx = EARTH.x;
  const cy = EARTH.y;
  const coast = landPolylines(land, cx, cy, R, 4);
  // Graticule: meridians every 20 deg, parallels every 20 deg, visible parts only.
  const grat = [];
  for (let lon = -180; lon < 180; lon += 20) {
    const run = [];
    for (let lat = -88; lat <= 88; lat += 2) {
      const p = projectPoint(lon, lat, cx, cy, R);
      if (p) run.push([p[0], p[1]]);
    }
    if (run.length > 2) grat.push(run);
  }
  for (let lat = -60; lat <= 60; lat += 20) {
    const run = [];
    for (let lon = -180; lon <= 180; lon += 2) {
      const p = projectPoint(lon, lat, cx, cy, R);
      if (p) run.push([p[0], p[1]]);
      else if (run.length) {
        grat.push(run.splice(0));
      }
    }
    if (run.length > 2) grat.push(run);
  }
  // Life dots: on land and in the sea, spread over the visible hemisphere.
  const rng = makeRng(201);
  const dots = [];
  while (dots.length < 230) {
    const lon = rng.range(VIEW.lon - 88, VIEW.lon + 88);
    const lat = Math.asin(rng.range(-0.95, 0.95)) * (180 / Math.PI);
    const p = projectPoint(lon, lat, cx, cy, R);
    if (!p || p[2] < 0.18) continue;
    const onLand = geoContains(land, [lon, lat]);
    if (!onLand && rng.chance(0.55)) continue;
    // keep dots apart a little
    if (dots.some((d) => Math.hypot(d.x - p[0], d.y - p[1]) < 15)) continue;
    dots.push({ x: p[0], y: p[1], depth: p[2], land: onLand, t: 0, doomed: false, r: rng.range(2.6, 4.4) });
  }
  // Appearance order: a quick sweep from the upper left, with jitter (5.3-6.4 s).
  const sweep = (d) => clamp((d.x - 150 + (d.y - 540) * 0.6) / 1250);
  dots.forEach((d) => (d.t = 5.3 + sweep(d) * 0.95 + rng.range(-0.08, 0.08)));
  dots.forEach((d) => (d.wave = 6.95 + sweep(d) * 0.7)); // the "all species" glow wave
  dots.forEach((d) => (d.doomed = rng.chance(0.75)));
  dots.forEach((d) => (d.flick = rng.range(0, 0.5)));
  // The dot the forest opens from: a land dot in Central America.
  const focusP = projectPoint(-84, 12, cx, cy, R);
  const focus = { x: focusP[0], y: focusP[1] };
  dots.push({ x: focus.x, y: focus.y, depth: 1, land: true, t: 5.6, wave: 7.15, doomed: false, flick: 0, r: 4.4 });
  // Coast draw order: longest first so continents read early.
  const coastLen = coast.map((r) => r.length);

  // Camera: still, then a gentle push toward the focus dot before the iris opens.
  const cam = (t) => {
    const z = smoothstep(9.5, 11.4, t);
    return { x: lerp(540, focus.x, z * 0.85), y: lerp(960, focus.y, z * 0.85), z: 1 + z * z * 0.9 };
  };

  function draw(g, t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = BG;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    const c = cam(t);
    setCam(g, S, c.x, c.y, c.z);
    // faint construction frame
    const k0 = smoothstep(4.6, 5.6, t);
    g.lineCap = 'round';
    g.strokeStyle = rgba(LAV, 0.35 * k0);
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(cx - R * 1.35, cy);
    g.lineTo(cx + R * 1.35, cy);
    g.moveTo(cx, cy - R * 1.3);
    g.lineTo(cx, cy + R * 1.3);
    g.stroke();
    // outer circle, already complete as the illustration dissolves; a second ring draws on
    g.strokeStyle = rgba(CREAM, 0.95);
    g.lineWidth = 3.2;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.stroke();
    const ring = smoothstep(5.0, 6.3, t);
    if (ring > 0) {
      g.strokeStyle = rgba(LAV, 0.7);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, R * 1.06, -Math.PI / 2, -Math.PI / 2 + TAU * ring);
      g.stroke();
      const a = -Math.PI / 2 + TAU * ring;
      if (ring < 1) sparkle(g, cx + Math.cos(a) * R * 1.06, cy + Math.sin(a) * R * 1.06, 7, '#d6d7ff', 1);
    }
    // graticule draws on
    const gr = smoothstep(5.2, 6.6, t);
    g.strokeStyle = rgba(LAV, 0.55);
    g.lineWidth = 1;
    grat.forEach((run, i) => strokePartial(g, run, clamp(gr * 1.4 - (i / grat.length) * 0.4)));
    // sparkle nodes at a few graticule crossings
    if (gr > 0.4) {
      for (let lon = -140; lon <= 0; lon += 40) {
        for (let lat = -40; lat <= 40; lat += 40) {
          const p = projectPoint(lon, lat, cx, cy, R);
          if (p && p[2] > 0.3) sparkle(g, p[0], p[1], 5, '#d6d7ff', smoothstep(0.4, 0.8, gr) * 0.8);
        }
      }
    }
    // coastlines: complete from the start of the dissolve
    g.strokeStyle = rgba(CREAM, 0.92);
    g.lineWidth = 1.7;
    coast.forEach((run) => strokePartial(g, run, 1));
    // a light hatch fill on land reads like the reference's dotted forms
    // life dots
    for (const d of dots) {
      const a = clamp((t - d.t) / 0.25);
      if (a <= 0) continue;
      // the "all species" wave: a soft swell of light passing over every dot
      const wv = Math.max(0, 1 - Math.abs(t - d.wave) / 0.2);
      const pulse = wv * wv * (3 - 2 * wv);
      let r = d.r * easeOutBack(a, 2.2) * (1 + pulse * 0.35);
      let col = GOLD;
      let glow = 0.5 + pulse * 0.6;
      if (d.doomed) {
        // flicker toward a dim red ("would have"), then flare back gold on "survived" and stay lit
        const back0 = 8.55 + d.flick * 0.16;
        const dim = smoothstep(7.7 + d.flick * 0.3, 8.05 + d.flick * 0.3, t) * (1 - smoothstep(back0, back0 + 0.25, t));
        const fl = dim * (0.6 + 0.4 * Math.sin(t * 38 + d.x));
        col = `rgb(${lerp(232, 120, fl) | 0},${lerp(176, 46, fl) | 0},${lerp(74, 40, fl) | 0})`;
        glow *= 1 - fl;
        const flare = smoothstep(back0, back0 + 0.25, t) * (1 - smoothstep(back0 + 0.4, back0 + 1.1, t));
        r *= 1 + flare * 0.6;
        glow += flare * 0.9;
        if (flare > 0) {
          g.strokeStyle = rgba('#ffe0a0', 0.6 * flare);
          g.lineWidth = 1;
          g.beginPath();
          g.arc(d.x, d.y, r * (1.8 + 2 * (1 - flare)), 0, TAU);
          g.stroke();
        }
      }
      const gl = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, r * 3.2);
      gl.addColorStop(0, `rgba(255,214,140,${0.45 * glow})`);
      gl.addColorStop(1, 'rgba(255,214,140,0)');
      g.fillStyle = gl;
      g.fillRect(d.x - r * 3.2, d.y - r * 3.2, r * 6.4, r * 6.4);
      g.fillStyle = col;
      g.beginPath();
      g.arc(d.x, d.y, r, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,250,235,0.85)';
      g.beginPath();
      g.arc(d.x - r * 0.3, d.y - r * 0.32, r * 0.3, 0, TAU);
      g.fill();
    }
    // donut chart: fills to 75% while he says "seventy-five percent" (5.76-6.88 s), glows on "survived"
    const dc = smoothstep(5.5, 5.75, t);
    if (dc > 0) {
      const ox = 228;
      const oy = 330;
      const rr = 96;
      const fill = easeInOut(clamp((t - 5.72) / 0.85)) * 0.75;
      const glowArc = smoothstep(8.6, 8.8, t) * (1 - smoothstep(9.0, 9.7, t));
      g.globalAlpha = dc;
      g.strokeStyle = rgba(CREAM, 0.5);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(ox, oy, rr + 16, 0, TAU);
      g.arc(ox, oy, rr - 16, 0, TAU, true);
      g.stroke();
      if (glowArc > 0) {
        g.strokeStyle = rgba('#ffe0a0', 0.35 * glowArc);
        g.lineWidth = 30 + 22 * glowArc;
        g.lineCap = 'butt';
        g.beginPath();
        g.arc(ox, oy, rr, -Math.PI / 2, -Math.PI / 2 + TAU * fill);
        g.stroke();
      }
      g.strokeStyle = GOLD;
      g.lineWidth = 30;
      g.lineCap = 'butt';
      g.beginPath();
      g.arc(ox, oy, rr, -Math.PI / 2, -Math.PI / 2 + TAU * fill);
      g.stroke();
      g.lineCap = 'round';
      // tick marks around the ring
      g.strokeStyle = rgba(LAV, 0.7);
      g.lineWidth = 0.8;
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * TAU - Math.PI / 2;
        const l = i % 10 === 0 ? 10 : 5;
        g.beginPath();
        g.moveTo(ox + Math.cos(a) * (rr + 22), oy + Math.sin(a) * (rr + 22));
        g.lineTo(ox + Math.cos(a) * (rr + 22 + l), oy + Math.sin(a) * (rr + 22 + l));
        g.stroke();
      }
      const pct = Math.round(fill * 100);
      g.fillStyle = CREAM;
      g.font = 'italic 500 50px "EBGaramond"';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`${pct}%`, ox, oy + 2);
      sparkle(g, ox + Math.cos(-Math.PI / 2 + TAU * fill) * rr, oy + Math.sin(-Math.PI / 2 + TAU * fill) * rr, 9, '#fff2c8', fill < 0.75 ? 1 : 0.6);
      g.globalAlpha = 1;
    }
  }

  // The iris into the forest opens from the focus dot (screen design coords).
  function irisFrom(t) {
    const c = cam(t);
    return [540 + (focus.x - c.x) * c.z, 960 + (focus.y - c.y) * c.z, 4 * c.z];
  }

  return { draw, irisFrom };
}
