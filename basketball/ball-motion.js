// Renderer-independent ball and hand coordinates. Three.js and simulation
// consume the same trajectory, so the visible palm follows the actual ball.
export const BALL_RADIUS = .119;
export const DRIBBLE_PERIOD = .56;
export const PASS_GATHER = .17;
export const PASS_CATCH = .18;
export const SHOT_GATHER = .27;
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export const lerp = (a,b,t) => a+(b-a)*t;
export const blend = t => { const u=clamp(t,0,1);return u*u*(3-2*u); };
export function mixPoint(a,b,t) {
  return {x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z:lerp(a.z,b.z,t)};
}
export function localToWorld(player,x,y,z) {
  const heading=player.heading ?? 0, c=Math.cos(heading), s=Math.sin(heading);
  return {x:player.x+c*x+s*z,y,z:player.z-s*x+c*z};
}
export function dribblePoint(player, hand, phase) {
  const u=((phase%1)+1)%1;
  const vertical=(1+Math.cos(u*2*Math.PI))/2;
  // Both hands bring the ball towards the middle at the floor bounce.
  // Crossing hands at the floor therefore never causes a sideways teleport.
  return localToWorld(player,hand*.43*vertical,.125+1.035*vertical,.32);
}
export function releasePoint(player,kind) {
  return kind==='shot'
    ? localToWorld(player,0,2.00,.29)
    : localToWorld(player,0,1.45,.43);
}
export function receivePoint(player,hand) {
  return localToWorld(player,hand*.20,1.28,.39);
}
export function arcPoint(from,to,t,height) {
  const p=mixPoint(from,to,t);
  p.y+=Math.sin(Math.PI*clamp(t,0,1))*height;
  return p;
}
export function controllingHand(match, player) {
  // The shoulder on the side away from the closest defender keeps the ball
  // sheltered. The comparison is in the player's local coordinate system.
  const foe=match.nearestDefender(player);
  const h=player.heading??0;
  const across=Math.cos(h)*(foe.x-player.x)-Math.sin(h)*(foe.z-player.z);
  return across>0?-1:1;
}
