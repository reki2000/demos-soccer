// Knee and ankle angles for an articulated running gait.
// The hip is at y=.99; the sole is kept close to y=0 during stance.
export const LEG_LENGTHS = Object.freeze({ upper: .47, lower: .46, hipHeight: .99 });

const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const smooth = t => t * t * (3 - 2 * t);

// Solve a two-link leg in the forward (Z) / vertical (Y) plane.
// Positive knee flexion folds the shin backward relative to the thigh.
export function solveLeg(z, y) {
  const a = LEG_LENGTHS.upper, b = LEG_LENGTHS.lower;
  const d = Math.hypot(z, y);
  const reach = a + b - .001;
  const scale = Math.min(1, reach / Math.max(d, .001));
  const rz = z * scale, ry = y * scale;
  const cosine = clamp((rz * rz + ry * ry - a * a - b * b) / (2 * a * b), -1, 1);
  const kneeX = Math.acos(cosine);
  const hipX = Math.atan2(-rz, -ry) - Math.atan2(b * Math.sin(kneeX), a + b * Math.cos(kneeX));
  return {hipX, kneeX, ankleX: -hipX - kneeX};
}

export function runningLegPose(phase, speed, isGuard, side, spread = 0) {
  const pace = clamp(speed / 2.1, 0, 1);
  const cycle = (((phase + (side > 0 ? Math.PI : 0)) % TAU) + TAU) % TAU / TAU;
  const stance = cycle < .60;
  const progress = stance ? cycle / .60 : (cycle - .60) / .40;
  const stride = (isGuard ? .10 : .265) * pace;

  // While planted, the foot moves backwards relative to the hips.
  // During recovery, the knee flexes and the ankle lifts over the floor.
  const z = stance
    ? stride * (1 - 2 * progress)
    : stride * (-1 + 2 * smooth(progress));
  const lift = !stance ? (isGuard ? .22 : .34) * pace * Math.sin(Math.PI * progress) : 0;
  const footY = -(.92 - .053 * pace - (isGuard ? .024 : 0)) + lift;
  const angles = solveLeg(z, footY);

  return {
    hipX: angles.hipX,
    kneeX: angles.kneeX,
    // Counter-rotate the ankle so the shoe stays approximately flat.
    ankleX: angles.ankleX + (stance ? -.025 * pace : .08 * pace * Math.sin(Math.PI * progress)),
    hipZ: side * (isGuard ? spread : .025),
    stance,
    lift,
    targetZ: z,
  };
}
