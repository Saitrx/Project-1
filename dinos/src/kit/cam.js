// Camera: frames are authored in a 1080 x 1920 design space. setCam maps the design point (cx, cy)
// to the centre of the frame at zoom z (S = device pixels per design unit).
export function setCam(g, S, cx = 540, cy = 960, z = 1, rot = 0) {
  const k = S * z;
  if (!rot) {
    g.setTransform(k, 0, 0, k, S * 540 - k * cx, S * 960 - k * cy);
    return;
  }
  const c = Math.cos(rot) * k;
  const s = Math.sin(rot) * k;
  g.setTransform(c, s, -s, c, S * 540 - (c * cx - s * cy), S * 960 - (s * cx + c * cy));
}

// Parallax: a layer at depth factor f (0 = fixed to screen, 1 = moves with the camera).
export function parallax(g, S, cam, f, base = { x: 540, y: 960 }) {
  setCam(g, S, base.x + (cam.x - base.x) * f, base.y + (cam.y - base.y) * f, 1 + (cam.z - 1) * f, (cam.rot ?? 0) * f);
}

// Deterministic camera shake from a seed; amplitude in design units.
export function shakeOffset(t, amp, seed = 1, freq = 14) {
  if (amp <= 0) return [0, 0];
  const a = Math.sin(t * freq * 6.283 + seed) * 0.6 + Math.sin(t * freq * 2.7 * 6.283 + seed * 3.1) * 0.4;
  const b = Math.cos(t * freq * 5.3 + seed * 1.7) * 0.6 + Math.sin(t * freq * 3.3 * 6.283 + seed * 0.7) * 0.4;
  return [a * amp, b * amp];
}
