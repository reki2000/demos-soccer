const smooth = n => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };

export function guardShuffle(player, heading) {
  const vx = player.vx || 0, vz = player.vz || 0;
  const lateral = vx * Math.cos(heading) - vz * Math.sin(heading);
  const speed = Math.hypot(vx, vz);
  const share = Math.abs(lateral) / Math.max(speed, .01);
  return { lateral, amount: smooth((share - .35) / .55) * smooth((Math.abs(lateral) - .12) / .60) };
}

// Defenders square up for lateral steps and turn to run when chasing.
export function defenseAnimationState(match,player,pose){
  const moving=Math.hypot(player.vx||0,player.vz||0);
  const speed=Math.max(player.speed||0,moving);
  const contest=pose?.role==='contest' && !!player.jump?.type?.includes('contest');
  const lateral=Number.isFinite(pose?.faceAngle) && !player.jump ? guardShuffle(player,pose.faceAngle).amount : 0;
  const sprinting=player.team!==match.possession && speed>=1.65+1.05*lateral && !contest;
  return {guard:sprinting?null:pose,sprinting,runFacing:sprinting};
}
