import test from 'node:test';
import assert from 'node:assert/strict';
import {LEG_LENGTHS, solveLeg, runningLegPose} from '../basketball/leg-gait.js';
import {guardShuffle} from '../basketball/defensive-motion.js';

function anklePosition(pose) {
  const a = LEG_LENGTHS.upper, b = LEG_LENGTHS.lower;
  const y = -a * Math.cos(pose.hipX) - b * Math.cos(pose.hipX + pose.kneeX);
  const roll = pose.hipZ ?? 0;
  return {
    z: -a * Math.sin(pose.hipX) - b * Math.sin(pose.hipX + pose.kneeX),
    x: -y * Math.sin(roll),
    y: y * Math.cos(roll),
  };
}

test('two-bone solver produces finite knee and ankle angles', () => {
  for (const z of [-.22,-.14,0,.14,.22]) for(const y of [-.85,-.8,-.67]) {
    const p=solveLeg(z,y);
    assert.ok(Object.values(p).every(Number.isFinite));
    assert.ok(p.kneeX > 0 && p.kneeX < 2.5);
    const joint=anklePosition(p);
    const d=Math.hypot(z,y);
    if(d < LEG_LENGTHS.upper + LEG_LENGTHS.lower - .001)
      assert.ok(Math.hypot(joint.z-z,joint.y-y) < 1e-9);
  }
});

test('both legs alternate between planted support and flexed-knee recovery', () => {
  const left=runningLegPose(.8,3,false,-1);
  const right=runningLegPose(.8,3,false,1);
  assert.notEqual(left.stance,right.stance);
  assert.ok(left.kneeX > .10 && right.kneeX > .10);
  assert.ok([left,right].some(p=>p.lift>0));
  assert.ok([left,right].some(p=>p.stance && p.lift===0));
});

test('swinging leg raises its ankle and bends its knee more than stance leg', () => {
  const standing=runningLegPose(.18*Math.PI*2,3,false,-1);
  const recovery=runningLegPose(.80*Math.PI*2,3,false,-1);
  assert.ok(standing.stance);
  assert.equal(recovery.stance,false);
  assert.ok(recovery.lift>.18);
  assert.ok(recovery.kneeX > standing.kneeX + .6);
  assert.ok(anklePosition(recovery).y > anklePosition(standing).y + .12);
});

test('stance foot stays near the court while traversing from forward to back', () => {
  let first, last;
  for(let i=0;i<=20;i++){
    const phase=Math.PI*2*.6*i/20;
    const pose=runningLegPose(phase,3,false,-1);
    const ankle=anklePosition(pose);
    const sole=LEG_LENGTHS.hipHeight + ankle.y - .055 - .055;
    assert.ok(Math.abs(sole)<.055, 'Planted sole above/below floor: '+sole);
    if(i===0)first=ankle.z;
    if(i===20)last=ankle.z;
  }
  assert.ok(first>.12);
  assert.ok(last<-.12);
});

test('idle returns small knee bend without running or sliding', () => {
  for(const phase of [0,1,4,9]){
    const pose=runningLegPose(phase,0,false,-1);
    assert.ok(Math.abs(pose.targetZ)<1e-9);
    assert.equal(pose.lift,0);
    assert.ok(pose.kneeX<.4);
  }
});

test('stationary guard keeps knees bent and feet spread', () => {
  for(const side of [-1,1]){
    const still=guardShuffle({vx:0,vz:0},0);
    const pose=runningLegPose(Math.PI*.8,0,true,side,.16,0,0,still);
    assert.equal(Math.sign(pose.hipZ),side);
    assert.ok(Math.abs(pose.hipZ - side*.16)<1e-9);
    assert.ok(pose.kneeX>.25);
    assert.equal(pose.lift,0);
  }
});

test('lateral guard steps mirror the lead, close-step and planted sweep in either heading', () => {
  const heading = Math.PI/3;
  const poses = [];
  for (const direction of [-1,1]) {
    const shuffle = guardShuffle({vx:direction*1.3*Math.cos(heading),vz:-direction*1.3*Math.sin(heading)},heading);
    assert.equal(shuffle.amount,1);
    const groundOffset = -.081;
    const phaseAt = cycle => cycle*Math.PI*2/1.5;
    const leg = (cycle,side) => runningLegPose(phaseAt(cycle),1.3,true,side,.16,0,0,{...shuffle,groundOffset});
    const lead = leg(.32,direction), support = leg(.32,-direction);
    assert.ok(lead.lift>.17);
    assert.ok(!lead.stance && support.stance);
    assert.equal(support.lift,0);
    const close = leg(.82,-direction);
    assert.ok(close.lift>.08 && close.lift<lead.lift);
    assert.ok(leg(.82,direction).stance);
    const before = anklePosition(leg(.16,-direction)), after = anklePosition(support);
    const bodyTravel = direction * phaseAt(.32-.16) / 5.4;
    assert.ok(Math.abs(after.x-before.x+bodyTravel)<.01);
    assert.ok(Math.abs(LEG_LENGTHS.hipHeight + groundOffset + after.y - .112)<.001);
    assert.ok(Math.abs(support.hipZ + support.ankleZ)<1e-10);
    poses.push({lead:anklePosition(lead),support:after});
  }
  for(const role of ['lead','support']){
    assert.ok(Math.abs(poses[0][role].x+poses[1][role].x)<1e-10);
    assert.ok(Math.abs(poses[0][role].y-poses[1][role].y)<1e-10);
  }
});

test('forward guard keeps its regular gait and diagonal motion blends in lateral travel', () => {
  const phase = Math.PI*.64;
  const forward = guardShuffle({vx:0,vz:1.3},0);
  const diagonal = guardShuffle({vx:.9,vz:.9},0);
  const base = runningLegPose(phase,1.3,true,1,.16);
  assert.deepEqual(runningLegPose(phase,1.3,true,1,.16,0,0,forward),base);
  assert.ok(diagonal.amount>0 && diagonal.amount<1);
  const mixed = runningLegPose(phase,1.3,true,1,.16,0,0,diagonal);
  assert.ok(Math.abs(mixed.targetZ-.074)<Math.abs(base.targetZ-.074));
  assert.ok(Math.abs(mixed.hipZ-base.hipZ)>.05);
  const stopped = guardShuffle({vx:-.08,vz:0},0);
  assert.equal(stopped.amount,0);
});

test('the gait is continuous across support/swing transition and wraps', () => {
  for(const point of [0,.6,1]){
    const earlier=runningLegPose(2*Math.PI*(point-.00001),2.5,false,-1);
    const later=runningLegPose(2*Math.PI*(point+.00001),2.5,false,-1);
    for(const key of ['hipX','kneeX','ankleX']){
      assert.ok(Math.abs(earlier[key]-later[key])<.035,key+' jumps at '+point);
    }
  }
});
