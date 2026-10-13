// Shared Earth geometry: land outlines (Natural Earth via world-atlas) and the orthographic view used
// by the asteroid shot and the line-art globe, so the two globes line up for the dissolve.
import { feature } from 'topojson-client';
import { geoOrthographic, geoPath } from 'd3-geo';

// Centred over the Caribbean so the Yucatan (the real impact site) sits left of centre.
export const VIEW = { lon: -72, lat: 14 };
export const EARTH = { x: 540, y: 930, r: 392 }; // screen position in the 1080 x 1920 design frame
export const IMPACT = [-89.5, 21.3];

let landCache = null;
export async function loadLand() {
  if (!landCache) {
    const topo = await (await fetch('node_modules/world-atlas/land-50m.json')).json();
    landCache = feature(topo, topo.objects.land);
  }
  return landCache;
}

export function makeProjection(cx, cy, r, spin = 0) {
  return geoOrthographic()
    .translate([cx, cy])
    .scale(r)
    .rotate([-VIEW.lon - spin, -VIEW.lat])
    .clipAngle(90)
    .precision(0.15);
}

export function landPath(land, proj) {
  const p = new Path2D();
  geoPath(proj, p)(land);
  return p;
}

// Visible runs of each land ring as screen polylines (for draw-on line art).
export function landPolylines(land, cx, cy, r, minLen = 6) {
  const lam0 = (VIEW.lon * Math.PI) / 180;
  const phi0 = (VIEW.lat * Math.PI) / 180;
  const sp0 = Math.sin(phi0);
  const cp0 = Math.cos(phi0);
  const proj = ([lon, lat]) => {
    const l = (lon * Math.PI) / 180 - lam0;
    const p = (lat * Math.PI) / 180;
    const cosc = sp0 * Math.sin(p) + cp0 * Math.cos(p) * Math.cos(l);
    return [cx + r * Math.cos(p) * Math.sin(l), cy - r * (cp0 * Math.sin(p) - sp0 * Math.cos(p) * Math.cos(l)), cosc];
  };
  const runs = [];
  for (const f of land.features ?? [land]) {
    const g = f.geometry ?? f;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        let cur = [];
        for (const pt of ring) {
          const [x, y, c] = proj(pt);
          if (c > 0.02) cur.push([x, y]);
          else if (cur.length) {
            runs.push(cur);
            cur = [];
          }
        }
        if (cur.length) runs.push(cur);
      }
    }
  }
  return runs.filter((r) => r.length > 1 && r.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - r[i - 1][0], p[1] - r[i - 1][1]) : 0), 0) > minLen);
}

// Project a single lon/lat with the same view (returns null when on the far side).
export function projectPoint(lon, lat, cx, cy, r) {
  const l = ((lon - VIEW.lon) * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;
  const phi0 = (VIEW.lat * Math.PI) / 180;
  const cosc = Math.sin(phi0) * Math.sin(p) + Math.cos(phi0) * Math.cos(p) * Math.cos(l);
  if (cosc <= 0) return null;
  return [cx + r * Math.cos(p) * Math.sin(l), cy - r * (Math.cos(phi0) * Math.sin(p) - Math.sin(phi0) * Math.cos(p) * Math.cos(l)), cosc];
}
