// Running is not a guarded stance. The arms pump naturally while chasing,
// and only switch to active hands when a player actually settles to defend.
export function defenseAnimationState(match,player,pose){
  const moving=Math.hypot(player.vx||0,player.vz||0);
  const speed=Math.max(player.speed||0,moving);
  const contest=pose?.role==='contest' && !!player.jump?.type?.includes('contest');
  const sprinting=player.team!==match.possession && speed>=1.65 && !contest;
  return {guard:sprinting?null:pose,sprinting,runFacing:sprinting};
}
