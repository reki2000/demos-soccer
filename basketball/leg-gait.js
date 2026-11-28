// Knee and ankle angles for an articulated running gait.
// The hip is at y=.99; the sole is kept close to y=0 during stance.
export const LEG_LENGTHS = Object.freeze({ upper: .47, lower: .46, hipHeight: .99 });

const TAU = Math.PI * 2;
const SHUFFLE_TEMPO = 1.5;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const smooth = t => t * t * (3 - 2 * t);
const cycleAt = phase => ((phase % TAU + TAU) % TAU) / TAU;

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

export function runningLegPose(phase, speed, isGuard, side, spread = 0, accel=0, turnRate=0, shuffle) {
  const pace = clamp(speed / 2.1, 0, 1);
  const cycle = (cycleAt(phase) + (side > 0 ? .5 : 0)) % 1;
  const stance = cycle < .60;
  const progress = stance ? cycle / .60 : (cycle - .60) / .40;
  const stride = (isGuard ? .10 : .265) * pace / (1+clamp(accel,-5,6)*.018);

  // While planted, the foot moves backwards relative to the hips.
  // During recovery, the knee flexes and the ankle lifts over the floor.
  const z = stance
    ? stride * (1 - 2 * progress)
    : stride * (-1 + 2 * smooth(progress));
  const lift = !stance ? (isGuard ? .22 : .34) * pace * Math.sin(Math.PI * progress) : 0;
  const footY = -(.92 - .053 * pace - (isGuard ? .024 : 0)) + lift;
  const angles = solveLeg(z, footY);

  const running = {
    hipX: angles.hipX,
    kneeX: angles.kneeX,
    // Counter-rotate the ankle so the shoe stays approximately flat.
    ankleX: angles.ankleX + (stance ? -.025 * pace : .08 * pace * Math.sin(Math.PI * progress)),
    hipZ: side * (isGuard ? spread : .025) + (stance ? clamp(turnRate,-3,3)*pace*.038 : 0),
    stance,
    lift,
    targetZ: z,
  };
  if (!isGuard || !shuffle?.amount) return running;

  const { lateral, amount, groundOffset = 0 } = shuffle;
  const direction = Math.sign(lateral);
  const leading = side === direction;
  const step = (cycleAt(phase * SHUFFLE_TEMPO) + (leading ? .5 : 0)) % 1;
  const duty = .56;
  const planted = step < duty;
  const t = planted ? step / duty : (step - duty) / (1 - duty);
  // Each foot sweeps against travel while on the ground. Run the leading
  // foot's recovery half a cycle ahead of the trailing foot's close-step.
  const phaseRate = 5.4 * SHUFFLE_TEMPO * Math.max(speed, .12) * (1 + clamp(accel,-5,6)*.018);
  const travel = Math.min(.225, Math.abs(lateral) * duty * TAU / (2 * phaseRate));
  const sweep = direction * travel * (planted ? 1 - 2 * t : 2 * smooth(t) - 1);
  const sideLift = planted ? 0 : (leading ? .19 : .105) * Math.sin(Math.PI * t);
  const x = -footY * Math.sin(running.hipZ) * (1 - amount) + (side * (.16 + spread * .45) + sweep) * amount;
  const y = footY * Math.cos(running.hipZ) * (1 - amount) + (.112 - LEG_LENGTHS.hipHeight - groundOffset + sideLift) * amount;
  const targetZ = z * (1 - amount) + (leading ? .074 : -.045) * amount;
  const hipZ = Math.atan2(x, -y);
  const guard = solveLeg(targetZ, -Math.hypot(x, y));
  return {
    ...guard,
    ankleX: guard.ankleX + (running.ankleX - angles.ankleX) * (1 - amount),
    ankleZ: -hipZ * amount,
    hipZ,
    stance: amount >= .5 ? planted : stance,
    lift: lift * (1 - amount) + sideLift * amount,
    targetZ,
  };
}
