const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const keeperArmScale = p => 1.02+((p.profile?.height??190)-184)*.004;
export function keeperShape(p) {
  const low=p.keeperLow||0, lean=p.keeperDive||0;
  return {drop:.68*low, shift:.34*lean, roll:-.92*lean, pitch:.14+.58*low};
}

// Same local shoulder frame as the rendered keeper: pelvis, shirt pivot,
// then chest roll/pitch. Distances are in metres, including player height.
export function gloveReach(p,ball) {
  const scale=(p.profile?.height??190)/195.5, build=p.profile?.build??1;
  const dx=ball.x-p.x,dz=ball.z-p.z,s=Math.sin(p.angle),c=Math.cos(p.angle);
  const x=(dx*c-dz*s)/scale/build, z=(dx*s+dz*c)/scale;
  const y=(ball.y-.045)/scale-(p.jump||0);
  const shape=keeperShape(p), cs=Math.cos(shape.roll),sn=Math.sin(shape.roll);
  const handDistance=side=>{
    const sx=side*.205, sy=.465;
    const rotatedY=sx*sn+sy*cs;
    return Math.hypot(x-shape.shift/build-sx*cs+sy*sn,
      y-(1.10-shape.drop+rotatedY*Math.cos(shape.pitch)),
      z-rotatedY*Math.sin(shape.pitch));
  };
  const left=handDistance(-1),right=handDistance(1);
  const reach=keeperArmScale(p);
  return {side:left<right?-1:1,closest:Math.min(left,right)/reach,both:Math.max(left,right)/reach};
}
