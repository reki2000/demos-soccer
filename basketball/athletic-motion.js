// Independent movement profiles shared by player animation and tests.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function jumpHeight(player) {
  const jump=player.jump;
  if(!jump || jump.elapsed>=jump.duration || jump.elapsed<0)return 0;
  const u=jump.elapsed/jump.duration;
  return Math.max(0,jump.height*4*u*(1-u));
}
export function runningBodyPose(phase,speed,guarding=false) {
  const fast=clamp((speed-1.15)/1.6,0,1);
  const shuffle=guarding? .28 : 1;
  // The airborne step lifts the *whole* player, not just the torso;
  // legs and hips now leave the floor together at running speed.
  // Symmetric vertical oscillation: the body dips as well as rises with each
  // step, instead of only hopping upward on a half-rectified sine.
  const bounce=fast*shuffle*(.055+.05*Math.sin(phase*2));
  const lean=fast*(guarding?.045:.115);
  return {bounce,lean,fast};
}
export function startJump(player,type='shot',height=.46,duration=.68) {
  if(player.jump && player.jump.elapsed<player.jump.duration*.85)return false;
  player.jump={type,height,duration,elapsed:0};
  return true;
}
export function advanceJumps(players,dt) {
  for(const player of players) {
    if(!player.jump)continue;
    player.jump.elapsed=Math.min(player.jump.duration,player.jump.elapsed+Math.max(0,dt));
    if(player.jump.elapsed>=player.jump.duration)player.jump=null;
  }
}
