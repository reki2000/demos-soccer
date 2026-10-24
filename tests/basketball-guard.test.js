import test from 'node:test';
import assert from 'node:assert/strict';
import {BasketballMatch} from '../basketball/simulation.js';
import {guardPose} from '../basketball/guard-pose.js';

test('guard pose is only applied to defenders while the ball is in play', () => {
  const game=new BasketballMatch(()=>{},()=>.45);
  const defender=game.players[5];
  defender.intent='contain';
  assert.equal(guardPose(game,game.players[0]),null);
  assert.ok(guardPose(game,defender));
  game.pause=1;
  assert.equal(guardPose(game,defender),null);
  game.pause=0;
  game.beginFreeThrows(0,2);
  assert.equal(guardPose(game,defender),null);
  game.freeThrows=null;
  game.ended=true;
  assert.equal(guardPose(game,defender),null);
});

test('on-ball guard spreads both hands and bends the elbows', () => {
  const game=new BasketballMatch(()=>{},()=>.2);
  const player=game.players[5], owner=game.owner;
  player.x=owner.x+1.6;
  player.z=owner.z-.4;
  player.intent='contain';
  const pose=guardPose(game,player);
  assert.equal(pose.role,'contain');
  assert.equal(pose.targetId,owner.id);
  assert.ok(pose.crouch>.1);
  assert.ok(pose.arms[0].shoulderZ<-.5);
  assert.ok(pose.arms[1].shoulderZ>.5);
  assert.ok(pose.arms.every(a=>a.shoulderX<-.8 && a.elbowX<-.4));
});

test('passing lane denial reaches with the ball-facing hand', () => {
  const game=new BasketballMatch(()=>{},()=>.3);
  const defender=game.players[6];
  const attacker=game.players[1];
  defender.x=attacker.x+1.5;
  defender.z=-1;
  defender.intent='deny';
  game.owner.z=2;
  const positive=guardPose(game,defender);
  assert.equal(positive.role,'deny');
  assert.equal(positive.targetId,attacker.id);
  assert.ok(positive.arms[1].shoulderX<positive.arms[0].shoulderX-.4);
  game.owner.z=-3;
  const negative=guardPose(game,defender);
  assert.ok(negative.arms[0].shoulderX<negative.arms[1].shoulderX-.4);
});

test('nearby defender raises both hands to contest a shot', () => {
  const game=new BasketballMatch(()=>{},()=>.5);
  const shooter=game.owner, defender=game.players[5];
  shooter.x=-2;
  shooter.z=2;
  defender.x=shooter.x+1.2;
  defender.z=shooter.z;
  defender.intent='help';
  game.shoot();
  const pose=guardPose(game,defender);
  assert.equal(pose.role,'contest');
  assert.equal(pose.targetId,shooter.id);
  assert.ok(pose.arms.every(a=>a.shoulderX<-2.5));
  assert.ok(pose.arms.every(a=>a.elbowX>-.2));
  defender.x=9;
  assert.notEqual(guardPose(game,defender).role,'contest');
});

test('guard direction and hand motion respond to changing positions and time', () => {
  const game=new BasketballMatch(()=>{},()=>.5);
  const defender=game.players[5], owner=game.owner;
  owner.x=0;owner.z=0;
  defender.x=2;defender.z=0;
  defender.intent='contain';
  game.elapsed=1;
  const pose1=guardPose(game,defender);
  game.elapsed=2;
  const pose2=guardPose(game,defender);
  assert.notEqual(pose1.arms[0].shoulderX,pose2.arms[0].shoulderX);
  assert.ok(Math.abs(pose1.faceAngle + Math.PI/2)<1e-9);
  defender.x=-2;
  const pose3=guardPose(game,defender);
  assert.ok(Math.abs(pose3.faceAngle - Math.PI/2)<1e-9);
  for(const arm of pose3.arms) for(const value of Object.values(arm))
    assert.ok(Number.isFinite(value));
});

test('defensive role transitions yield distinct arm gestures', () => {
  const game=new BasketballMatch(()=>{},()=>.5);
  const defender=game.players[5];
  defender.x=game.owner.x+2;
  defender.z=game.owner.z;
  const poses=[];
  for(const role of ['contain','deny','help','mark']){
    defender.intent=role;
    poses.push(guardPose(game,defender));
  }
  assert.equal(new Set(poses.map(p=>p.arms.map(a=>a.shoulderX.toFixed(2)).join(','))).size,4);
});
