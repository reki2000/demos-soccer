const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const smooth = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };

// Full left/right stride cycles per second, not steps per second.
export function strideFrequency(speed) {
  return speed < .08 ? 0 : .7 + Math.min(speed, 6.5) * .19;
}

// Torso pitch/roll from locomotion state: accelerating leans the body
// forward, braking lets it sit back, and turning banks it into the turn
// (more strongly at speed). Pure and unit-testable; posePlayer applies it.
export function bodyLean(speed, turnRate = 0, accel = 0) {
  const run = smooth(speed / .8);
  return {
    pitch: clamp(accel, -7, 7) * .014 * run,
    roll: -clamp(turnRate, -3, 3) * (.012 + Math.min(speed, 6) * .006) * run,
  };
}

export function gaitPose(phase, speed, scale = 1) {
  const moving = smooth(speed / .8);
  const sprint = smooth((speed - 1.1) / 3.4);
  const duty = .62 - sprint * .29;
  const frequency = strideFrequency(speed);
  // Match the backward travel of the planted foot to the body's forward travel.
  const reach = frequency > 0 ? speed / scale * duty / (2 * frequency) : 0;
  const cycle = ((phase / (Math.PI * 2)) % 1 + 1) % 1;
  const halfCycle = cycle % .5;
  const contact = Math.min(duty, .5);
  const flight = halfCycle > contact ? (halfCycle - contact) / (.5 - contact) : 0;
  const compression = halfCycle < contact ? Math.sin(halfCycle / contact * Math.PI) : 0;
  const hipOffset = moving * (-.07 - .1 * sprint - .022 * compression + .05 * Math.sin(flight * Math.PI));
  const feet = [0, .5].map(offset => {
    const footCycle = (cycle + offset) % 1;
    const stance = footCycle < duty;
    const t = stance ? footCycle / duty : (footCycle - duty) / (1 - duty);
    let z, y, pitch;
    if (stance) {
      z = reach * (1 - 2 * t);
      const toeOff = smooth((t - .72) / .28);
      pitch = (-.12 * (1 - smooth(t / .2)) + .52 * toeOff) * moving;
      // The ankle rises as the heel lifts, leaving the forefoot on the turf.
      y = .095 + Math.max(0, Math.sin(pitch)) * .19 + Math.max(0, -Math.sin(pitch)) * .065;
    } else {
      const u = 1 - t;
      // Heel folds behind the knee, swings through, then retracts before touchdown.
      z = u * u * u * -reach + 3 * u * u * t * (-reach - .1 * moving)
        + 3 * u * t * t * (reach + .18 * moving) + t * t * t * reach;
      y = .095 + Math.pow(Math.sin(t * Math.PI), .9) * (.12 + .25 * sprint) * moving;
      pitch = (.35 * Math.sin(t * Math.PI) - .12 * t) * moving;
    }
    return { z, y, pitch, stance, progress: t };
  });
  return { feet, hipOffset, sprint, moving, duty };
}
