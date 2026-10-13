// 0:34.5-0:42.5 Line-art globe on dark brown (the bee film's diagram style): cream coastlines,
// lavender graticule, gold school dots. "We've had a preview." The globe draws on and the dots pop
// in. "In twenty-twenty, schools closed for over one and a half billion students." A big 2020
// appears, the dots blink off in waves sweeping around the world (each leaves a dim hollow ring),
// a gold arc fills around the globe and the count climbs to 1.5 billion.
import { strokePartial, sparkle, rgba } from '../kit/paint.js';
import { makeRng, clamp, lerp, smoothstep, easeOut, easeOutBack, TAU } from '../kit/util.js';
import { setCam } from '../kit/cam.js';
import { ripple, RING_BLUE } from '../kit/rings.js';
import { loadLand } from '../kit/earth.js';
import { geoContains } from 'd3-geo';
import { VO } from '../vo_timing.js';

const BG = '#180f0b';
const CREAM = '#f1e3c2';
const LAV = '#8e8fd6';
const GOLD = '#e8b04a';
const CX = 540;
const CY = 930;
const R = 335;
const T_YEAR = VO[5].chunks[1].t; // "In twenty-twenty..."
const T0 = 34.5;

function project(lon, lat, lon0, lat0) {
  const l = ((lon - lon0) * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;
  const p0 = (lat0 * Math.PI) / 180;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  return [CX + R * Math.cos(p) * Math.sin(l), CY - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), cosc];
}

export async function build(env) {
  const { S } = env;
  const land = await loadLand();
  // rings of land as lon/lat arrays (simplified: every 2nd point)
  const rings = [];
  for (const f of land.features ?? [land]) {
    const g = f.geometry ?? f;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) for (const ring of poly) if (ring.length > 12) rings.push(ring.filter((_, i) => i % 2 === 0));
  }
  // school dots on land
  const rng = makeRng(606);
  const dots = [];
  while (dots.length < 340) {
    const lon = rng.range(-180, 180);
    const lat = Math.asin(rng.range(-0.62, 0.86)) * (180 / Math.PI);
    if (!geoContains(land, [lon, lat])) continue;
    dots.push({ lon, lat, r: rng.range(3.2, 5.2), on: 0, off: 0, flick: rng.range(0, 1) });
  }
  // they pop on during "We've had a preview", and blink off in waves (east to west, like the
  // closures spreading) during "schools closed for over one and a half billion students"
  dots.forEach((d) => {
    d.on = 35.2 + rng.range(0, 0.9);
    const sweep = (((150 - d.lon) % 360) + 360) % 360 / 360;
    d.off = T_YEAR + 0.9 + sweep * 3.0 + rng.range(-0.15, 0.15);
  });
  const lon0 = (t) => 40 - (t - T0) * 9; // slow spin
  const LAT0 = 18;

  function draw(g, t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = BG;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    const z = 1 + (t - T0) * 0.006;
    setCam(g, S, 540, 960, z);
    const L0 = lon0(t);
    const draw0 = smoothstep(T0 + 0.4, T0 + 1.6, t);
    // construction cross-hairs and rings
    g.lineCap = 'round';
    g.strokeStyle = rgba(LAV, 0.32 * draw0);
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(CX - R * 1.4, CY);
    g.lineTo(CX + R * 1.4, CY);
    g.moveTo(CX, CY - R * 1.35);
    g.lineTo(CX, CY + R * 1.35);
    g.stroke();
    // outer circle draws on like a compass
    g.strokeStyle = rgba(CREAM, 0.95);
    g.lineWidth = 4;
    g.beginPath();
    g.arc(CX, CY, R, -Math.PI / 2, -Math.PI / 2 + TAU * draw0);
    g.stroke();
    if (draw0 < 1 && draw0 > 0) {
      const a = -Math.PI / 2 + TAU * draw0;
      sparkle(g, CX + Math.cos(a) * R, CY + Math.sin(a) * R, 12, '#d6d7ff', 1);
    }
    // graticule (visible half)
    const gr = smoothstep(T0 + 0.8, T0 + 2.0, t);
    g.strokeStyle = rgba(LAV, 0.5 * gr);
    g.lineWidth = 1.6;
    for (let lon = -180; lon < 180; lon += 20) {
      g.beginPath();
      let pen = false;
      for (let lat = -88; lat <= 88; lat += 3) {
        const [x, y, c] = project(lon, lat, L0, LAT0);
        if (c > 0) {
          if (!pen) g.moveTo(x, y);
          else g.lineTo(x, y);
          pen = true;
        } else pen = false;
      }
      g.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 20) {
      g.beginPath();
      let pen = false;
      for (let lon = -180; lon <= 180; lon += 3) {
        const [x, y, c] = project(lon, lat, L0, LAT0);
        if (c > 0) {
          if (!pen) g.moveTo(x, y);
          else g.lineTo(x, y);
          pen = true;
        } else pen = false;
      }
      g.stroke();
    }
    // coastlines draw on
    const co = smoothstep(T0 + 0.9, T0 + 2.2, t);
    g.strokeStyle = rgba(CREAM, 0.9);
    g.lineWidth = 2.6;
    rings.forEach((ring, i) => {
      const n = Math.floor(ring.length * clamp(co * 1.3 - (i % 7) * 0.04));
      if (n < 2) return;
      g.beginPath();
      let pen = false;
      for (let k = 0; k < n; k++) {
        const [x, y, c] = project(ring[k][0], ring[k][1], L0, LAT0);
        if (c > 0.01) {
          if (!pen) g.moveTo(x, y);
          else g.lineTo(x, y);
          pen = true;
        } else pen = false;
      }
      g.stroke();
    });
    // school dots
    let offCount = 0;
    for (const d of dots) {
      if (t >= d.off) offCount++;
      const [x, y, c] = project(d.lon, d.lat, L0, LAT0);
      if (c < 0.06 || t < d.on) continue;
      const pop = easeOutBack(clamp((t - d.on) / 0.35), 2);
      const k = clamp((t - d.off) / 0.25);
      const fade = 0.35 + 0.65 * Math.sqrt(c);
      if (k < 1) {
        // lit gold dot with a soft glow; a quick flicker just before it goes out
        const flick = t > d.off - 0.25 && t < d.off ? (Math.sin((t - d.off) * 90 + d.flick * 10) > 0 ? 1 : 0.4) : 1;
        const a = (1 - k) * fade * flick;
        const gl = g.createRadialGradient(x, y, 0, x, y, d.r * 3.4);
        gl.addColorStop(0, rgba(GOLD, 0.45 * a));
        gl.addColorStop(1, rgba(GOLD, 0));
        g.fillStyle = gl;
        g.beginPath();
        g.arc(x, y, d.r * 3.4, 0, TAU);
        g.fill();
        g.fillStyle = rgba(GOLD, a);
        g.beginPath();
        g.arc(x, y, d.r * pop, 0, TAU);
        g.fill();
      }
      if (k > 0) {
        // the school is out: a dim hollow ring stays
        g.strokeStyle = rgba(CREAM, 0.38 * fade * k);
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(x, y, d.r * 0.9, 0, TAU);
        g.stroke();
      }
    }
    // gold progress arc around the globe = share of schools closed
    const frac = offCount / dots.length;
    if (frac > 0) {
      g.strokeStyle = rgba(GOLD, 0.9);
      g.lineWidth = 7;
      g.beginPath();
      g.arc(CX, CY, R * 1.08, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
      g.stroke();
      const a = -Math.PI / 2 + TAU * frac;
      sparkle(g, CX + Math.cos(a) * R * 1.08, CY + Math.sin(a) * R * 1.08, 12, '#ffe8b0', 1);
    }
    // soft ring pulses as the waves pass
    for (const k of [0, 1, 2]) ripple(g, CX, CY, t, T_YEAR + 1.0 + k * 1.0, { rMax: R * 1.9, dur: 1.4, width: 3, color: LAV, count: 1 });
    // year and count (big type, inside the safe area)
    const ya = smoothstep(T_YEAR - 0.1, T_YEAR + 0.3, t);
    if (ya > 0) {
      g.save();
      g.font = '600 132px "EBGaramond"';
      g.textAlign = 'center';
      g.fillStyle = rgba(CREAM, ya);
      g.fillText('2020', 500, 330 + (1 - ya) * 14);
      g.restore();
    }
    const ca = smoothstep(T_YEAR + 1.15, T_YEAR + 1.45, t);
    if (ca > 0) {
      const billions = 1.5 * smoothstep(T_YEAR + 0.9, T_YEAR + 4.0, t);
      g.save();
      g.font = '500 66px "EBGaramond"';
      g.textAlign = 'center';
      g.fillStyle = rgba(GOLD, ca);
      g.fillText(`${billions.toFixed(1)} billion students`, 500, 425);
      g.restore();
    }
  }
  return { draw };
}
