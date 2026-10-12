import gsap from 'gsap';

export const FPS = 30;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Normalised 0..1 progress of t through [a, b], shaped by a GSAP ease.
export function ease(name, a, b, t) {
  return gsap.parseEase(name)(clamp((t - a) / (b - a)));
}
