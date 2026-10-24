// Guard poses are derived from the same tactical roles as movement.
// Returned angles are renderer-independent so role transitions can be tested.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function guardPose(match, player) {
  if (player.team === match.possession || match.freeThrows || match.pause > 0 || match.ended) return null;
  const flight = match.flight;
  const shot = flight?.kind === 'shot' ? match.players[flight.from] : null;
  const handler = match.owner ?? (flight?.kind === 'pass' ? match.players[flight.to] : null);
  const assigned = match.players[match.possession * 5 + player.slot];
  const role = player.intent ?? player.plan ?? 'mark';
  const threat = shot ?? (role === 'contain' || role === 'help' ? handler : assigned) ?? assigned;
  if (!threat) return null;

  const separation = distance(player, threat);
  const close = clamp((5.0 - separation) / 3.5, 0, 1);
  const guarding = ['contain','help','deny','mark'].includes(role);
  const contestingShot = !!shot && separation < 3.8;
  const clock = match.elapsed ?? 0;
  const sway = Math.sin(clock * 3.1 + player.id * 1.9) * .09;
  const ballSide = (handler ?? shot)?.z >= player.z ? 1 : -1;
  const activeHand = ballSide < 0 ? 0 : 1;
  // Arms have independent shoulder/elbow pivots; a raised arm has shoulder X
  // near -PI while a straight-forward hand reaches near -PI/2.
  const arms = [-1, 1].map((side, i) => ({
    shoulderX: -.52 - close * .33 + sway * (i ? -1 : 1),
    shoulderZ: side * (.38 + close * .16),
    elbowX: -.42 - close * .16,
    elbowZ: side * -.08,
    wristX: -.18,
  }));

  if (role === 'contain') {
    // Wide stance and two active hands prevent a constant T-pose.
    for (const [i, arm] of arms.entries()) {
      arm.shoulderX = -.95 - close * .35 + (i === activeHand ? -.24 : 0) + sway;
      arm.shoulderZ = (i ? 1 : -1) * (.67 + .07 * Math.sin(clock * 2.7 + player.id));
      arm.elbowX = -.55;
    }
  } else if (role === 'deny') {
    // Reach across the passing lane with the ball-side hand.
    const arm = arms[activeHand];
    arm.shoulderX = -1.48 + sway;
    arm.shoulderZ = (activeHand ? 1 : -1) * .34;
    arm.elbowX = -.22;
  } else if (role === 'help') {
    arms[activeHand].shoulderX = -1.48 - close * .38 + sway;
    arms[activeHand].shoulderZ = (activeHand ? 1 : -1) * .31;
    arms[activeHand].elbowX = -.32;
  } else if (role === 'mark') {
    arms[activeHand].shoulderX -= close * .3;
    arms[activeHand].elbowX -= .18;
  }

  if (contestingShot) {
    // Both hands up for a nearby shot, independent of which defender was
    // assigned to the shooter. One arm reacts slightly before the other.
    arms[0].shoulderX = -2.60 + sway;
    arms[1].shoulderX = -2.80 - sway;
    arms[0].shoulderZ = -.17;
    arms[1].shoulderZ = .18;
    arms[0].elbowX = -.13;
    arms[1].elbowX = -.12;
    arms[0].wristX = -.12;
    arms[1].wristX = -.12;
  }

  return {
    role: contestingShot ? 'contest' : (guarding ? role : 'mark'),
    targetId: threat.id,
    faceAngle: Math.atan2(threat.x - player.x, threat.z - player.z),
    crouch: contestingShot ? .18 : .08 + (role === 'contain' ? .08 : .03) + close * .04,
    footSpread: contestingShot ? .06 : .1 + close * .08,
    arms,
  };
}
