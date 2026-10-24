import test from 'node:test';
import assert from 'node:assert/strict';
import {LEG_LENGTHS, solveLeg, runningLegPose} from '../basketball/leg-gait.js';

function anklePosition(pose) {
  const a = LEG_LENGTHS.upper, b = LEG_LENGTHS.lower;
  return {
    z: -a * Math.sin(pose.hipX) - b * Math.sin(pose.hipX + pose.kneeX),
    y: -a * Math.cos(pose.hipX) - b * Math.cos(pose.hipX + pose.kneeX),
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

test('guarded shuffle keeps knees bent, feet spread and foot lift modest', () => {
  for(const side of [-1,1]){
    const pose=runningLegPose(Math.PI*.8,2,true,side,.16);
    assert.equal(Math.sign(pose.hipZ),side);
    assert.ok(Math.abs(pose.hipZ - side*.16)<1e-9);
    assert.ok(pose.kneeX>.25);
    assert.ok(pose.lift<.25);
  }
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
