// Pose library and motion cycles for the person rig. All poses are authored facing +x (right);
// flip: -1 mirrors them. Angles: limbs 0 = hanging down, + swings forward (toward +x).
import { pose, blendPose, KID, ADULT } from './person.js';
import { clamp, lerp, smooth, TAU } from './util.js';

const PI = Math.PI;
const H = PI / 2;

export const LEG = (P) => P.thigh + P.shin + 4.6; // hip height when standing (local units)

// standing, relaxed
export const STAND = { spine: 0, hunch: 0.05, aN: 0.1, eN: 0.15, aF: -0.08, eF: 0.15, hN: 0.04, kN: -0.04, hF: -0.04, kF: -0.03 };
// sitting on a chair (thighs forward, shins down)
export const SIT_CHAIR = { spine: 0.05, hunch: 0.15, hN: H - 0.05, kN: -H + 0.05, hF: H - 0.12, kF: -H + 0.15, aN: 0.5, eN: 0.9, aF: 0.4, eF: 0.8 };
// sitting on the ground, legs out in front, hands resting behind
export const SIT_GROUND = { spine: -0.12, hunch: 0.1, hN: H - 0.15, kN: -0.25, fN: 0.2, hF: H - 0.05, kF: -0.4, fF: 0.2, aN: -0.55, eN: 0.25, aF: -0.45, eF: 0.2 };
// bored: slumped, elbow on the desk / knee, head resting on the hand
export const HEAD_ON_HAND = { spine: 0.32, hunch: 0.65, neck: 0.25, roll: 0.42, turn: 0.75, aN: 0.42, eN: 2.55, aF: 0.6, eF: 1.0 };
// arms up (cheer)
export const ARMS_UP = { aN: 2.75, eN: 0.25, aF: -2.75, eF: -0.25 };
// confused shrug: shoulders up, forearms out, palms up
export const SHRUG = { shrug: 1, aN: 0.45, eN: 1.35, aF: -0.45, eF: -1.35 };
// arms crossed on the chest
export const ARMS_CROSSED = { farArmFront: true, fv: 0.85, aN: 0.18, eN: -2.15, aF: -0.18, eF: 2.15 };
// both hands on the head (elbows out)
export const HANDS_ON_HEAD = { aN: 2.55, eN: 2.35, aF: -2.55, eF: -2.35, shrug: 0.4 };
// holding chalk up (near hand) and a book against the chest (far arm across)
export const HOLD_CHALK = { aN: 0.35, eN: 2.2 };
export const HOLD_BOOKS = { farArmFront: true, aN: 0.25, eN: 1.75, aF: 0.05, eF: 1.75 };
// sad: knees hugged, head down on knees
export const HUG_KNEES = { spine: 0.55, hunch: 0.9, neck: 0.75, roll: 0.25, turn: 0.55, hN: 1.95, kN: -2.75, fN: 0.4, hF: 1.85, kF: -2.6, fF: 0.4, aN: 0.95, eN: 0.55, aF: 0.85, eF: 0.6 };

export function P(o) {
  return pose(o);
}

// Smooth piecewise blend through a list of [t, poseObj] keys (with easing between keys).
export function keyPose(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1];
      const [t1, b] = keys[i];
      return blendPose(a, b, smooth((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}

export const mixPose = (a, b, k) => blendPose(a, b, clamp(k));

// Idle life: breathing and a slow weight shift, layered on any pose.
export function idle(p, t, seed = 0, amt = 1) {
  const b = Math.sin(t * TAU / 3.4 + seed);
  return {
    ...p,
    breath: b * amt,
    spine: p.spine + Math.sin(t * 0.7 + seed * 1.3) * 0.02 * amt,
    neck: (p.neck ?? 0) + Math.sin(t * 0.5 + seed) * 0.03 * amt,
    aN: p.aN + b * 0.02 * amt,
    aF: p.aF - b * 0.02 * amt,
  };
}

// Jump cycle with arms up. ph in [0,1): 0-0.2 crouch, 0.2-0.75 airborne, 0.75-1 land/absorb.
// Returns { dy (upward offset, local units), pose }.
export function jumpCycle(ph, height = 34) {
  ph = ((ph % 1) + 1) % 1;
  let dy = 0;
  let crouch = 0;
  if (ph < 0.2) crouch = Math.sin((ph / 0.2) * PI) * 0.8;
  else if (ph < 0.75) {
    const u = (ph - 0.2) / 0.55;
    dy = height * 4 * u * (1 - u);
  } else crouch = Math.sin(((ph - 0.75) / 0.25) * PI) * 0.9;
  const air = ph >= 0.2 && ph < 0.75 ? Math.sin(((ph - 0.2) / 0.55) * PI) : 0;
  const k = crouch;
  return {
    dy,
    crouch: k,
    pose: {
      spine: 0.18 * k - 0.05 * air,
      hunch: 0.1 + 0.2 * k,
      hN: 0.55 * k + 0.35 * air,
      kN: -1.0 * k - 0.6 * air,
      hF: 0.45 * k + 0.2 * air,
      kF: -0.9 * k - 0.75 * air,
      fN: 0.3 * air,
      fF: 0.3 * air,
      aN: lerp(2.75, 1.2, k),
      eN: lerp(0.25, 0.6, k),
      aF: lerp(-2.75, -1.0, k),
      eF: lerp(-0.25, -0.5, k),
      neck: -0.2 * air,
      sqy: 1 - 0.06 * k + 0.04 * air,
      sqx: 1 + 0.04 * k,
    },
  };
}

// How much the hip drops when the knees bend by `crouch` (approx, local units).
export const crouchDrop = (P, crouch) => P.thigh * (1 - Math.cos(0.55 * crouch)) + P.shin * (1 - Math.cos(0.45 * crouch)) + crouch * 4;

// Walk cycle: legs swing opposite, arms counter-swing, small bob. ph in [0,1) per stride pair.
export function walkCycle(ph, { amp = 0.42, arm = 0.45, sad = 0 } = {}) {
  const a = ph * TAU;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const kneeN = -Math.max(0, Math.sin(a + 0.6)) * 0.9 - 0.08;
  const kneeF = -Math.max(0, Math.sin(a + PI + 0.6)) * 0.9 - 0.08;
  return {
    bob: Math.abs(c) * 2.2,
    pose: {
      hN: s * amp,
      kN: kneeN,
      hF: -s * amp,
      kF: kneeF,
      fN: Math.max(0, -s) * 0.25,
      fF: Math.max(0, s) * 0.25,
      aN: -s * arm * (1 - sad * 0.6),
      eN: 0.25 + Math.max(0, -s) * 0.3,
      aF: s * arm * (1 - sad * 0.6),
      eF: 0.25 + Math.max(0, s) * 0.3,
      spine: 0.05 + sad * 0.12,
      hunch: 0.1 + sad * 0.5,
      neck: sad * 0.5,
    },
  };
}
// stride length per full cycle for a leg length L and swing amp
export const strideLen = (P, amp = 0.42) => 4 * P.thigh * Math.sin(amp) * 1.05;

// Dance: side step + hip sway + arm swings on a beat (clapping on beats).
export function danceCycle(ph, style = 0) {
  const a = ph * TAU;
  const s = Math.sin(a);
  const b = Math.sin(a * 2);
  if (style === 0) {
    // step-touch with alternating raised arms
    return {
      dx: s * 10,
      dy: Math.abs(Math.sin(a)) * 5,
      pose: {
        spine: s * 0.12,
        hN: 0.15 + s * 0.25,
        kN: -0.3 - Math.max(0, s) * 0.5,
        hF: -0.1 - s * 0.25,
        kF: -0.3 - Math.max(0, -s) * 0.5,
        aN: s > 0 ? lerp(0.5, 2.8, s) : 0.6,
        eN: 0.4,
        aF: s < 0 ? lerp(-0.5, -2.8, -s) : -0.6,
        eF: -0.4,
        roll: s * 0.12,
      },
    };
  }
  // clap and stomp: hands meet in front on the beat, knees pump
  const clap = Math.max(0, Math.cos(a * 2)) ** 3;
  return {
    dx: 0,
    dy: Math.max(0, b) * 4,
    pose: {
      spine: 0.08,
      hN: 0.1 + Math.max(0, s) * 0.55,
      kN: -0.15 - Math.max(0, s) * 0.9,
      hF: -0.05 + Math.max(0, -s) * 0.55,
      kF: -0.15 - Math.max(0, -s) * 0.9,
      aN: lerp(1.35, 1.0, clap),
      eN: lerp(1.0, 0.35, clap),
      aF: lerp(-0.2, 0.75, clap),
      eF: lerp(0.4, 0.75, clap),
      fv: 0.55,
      roll: Math.sin(a) * 0.1,
    },
  };
}

export { KID, ADULT };
