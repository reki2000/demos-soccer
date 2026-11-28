import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {Match,countries} from '../src/simulation.js';
import {assignProfiles} from '../src/roster.js';
import {createPlayer,posePlayer,disposePlayer} from '../src/player.js';
import {receivePoint} from '../basketball/ball-motion.js';

function setup(id) {
  const m=new Match(()=>{},()=>.99);
  assignProfiles(m,countries);
  const p=m.players[id];
  Object.assign(p,{x:0,z:0,angle:0});
  return {m,p,model:createPlayer(p,countries[p.team])};
}
const worldBall=b=>new Vector3(b.x,b.y,b.z);

test('low saves on either side touch the near glove, a chest catch meets both',()=>{
  for(const side of [-1,0,1]){
    const {m,p,model}=setup(11);
    Object.assign(p,{keeperLow:side?1:.12,keeperDive:side*.72,keeperReach:1});
    const x=side*.72,y=side?.32:1.27;
    m.ball={x,y,z:-.1};
    assert.ok(m.tryGloveContact({from:0},{x,y,z:.95}));
    assert.equal(p.action,side?'parry':'catch');
    posePlayer(model,p,m.ball);
    const gaps=model.arms.map(a=>a.hand.getWorldPosition(new Vector3()).distanceTo(worldBall(m.ball)));
    if(side){
      assert.ok(gaps[side===1?1:0]<.115);
      assert.ok(gaps[side===1?0:1]>.20);
      assert.equal(m.owner,null);
      assert.equal(Math.sign(m.loose.vx*Math.cos(p.angle)-m.loose.vz*Math.sin(p.angle)),side);
    }else{
      assert.ok(gaps.every(g=>g<.115));
      const contact={...m.ball};
      m.updateOwner(0);
      assert.deepEqual(m.ball,contact);
    }
    disposePlayer(model);
  }
});
test('a shot beyond the glove continues past the keeper',()=>{
  const {m,p,model}=setup(11);
  p.keeperReach=1;m.ball={x:1.65,y:.25,z:-.1};
  assert.equal(m.tryGloveContact({from:0},{...m.ball,z:1}),false);
  disposePlayer(model);
});
test('the receiving boot meets the ball on opposite sides for opposite passes',()=>{
  for(const vx of [-14,14]){
    const {m,p,model}=setup(9);
    m.ball={x:-Math.sign(vx)*.75,y:.15,z:.3};
    m.startControl(p,'foot',{vx,vz:0});
    for(let i=0;i<11;i++)m.update(1/60);
    assert.equal(p.receiveSide,-Math.sign(vx));
    posePlayer(model,p,m.ball);
    const ankle=model.legs[p.receiveSide>0?1:0].ankle;
    assert.ok(ankle.localToWorld(new Vector3(0,-.04,.09)).distanceTo(worldBall(m.ball))<.17);
    disposePlayer(model);
  }
});
test('a live pass releases immediately and mirrors the preferred-foot strike and plant',()=>{
  const poses=[];
  for(const [foot,side] of [['左',-1],['右',1]]){
    const {m,p,model}=setup(9);
    p.profile={...p.profile,foot};
    p.speed=p.vz=2.5;
    m.owner=p;
    m.ball={x:0,y:.15,z:.39};
    const receiver=m.players[8];
    Object.assign(receiver,{x:0,z:12});
    m.kick(receiver);
    assert.equal(m.owner,null);
    assert.equal(m.flight.progress,0);
    assert.equal(m.flight.target,receiver.id);
    assert.equal(p.actionTime,p.actionDuration);
    posePlayer(model,p,m.ball,m.flight);
    const strike=model.legs[side===1?1:0].ankle;
    const support=model.legs[side===1?0:1].ankle;
    const contact=strike.localToWorld(new Vector3(0,-.006,.15));
    assert.ok(contact.distanceTo(worldBall(m.ball))<.13);
    const planted=support.getWorldPosition(new Vector3());
    assert.ok(planted.y<.11);

    const progress=.28;
    m.update(p.actionDuration*progress);
    // The release footprint stays fixed while the player moves and the ball is in flight.
    assert.ok(p.z>.12);
    posePlayer(model,p,m.ball,m.flight);
    const raised=strike.getWorldPosition(new Vector3());
    assert.ok(raised.y>planted.y+.24);
    assert.ok(planted.distanceTo(support.getWorldPosition(new Vector3()))<.028);
    m.update(p.actionDuration*.12);
    posePlayer(model,p,m.ball,m.flight);
    poses.push({raised:model.g.worldToLocal(strike.getWorldPosition(raised)),roll:model.torso.rotation.z,yaw:model.torso.rotation.y,
      arms:model.arms.map(a=>({swing:a.shoulder.rotation.x,spread:a.shoulder.rotation.z}))});
    disposePlayer(model);
  }
  const [left,right]=poses;
  assert.ok(Math.abs(left.raised.x+right.raised.x)<.013);
  assert.equal(left.roll,-right.roll);
  assert.equal(left.yaw,-right.yaw);
  assert.equal(left.arms[0].swing,right.arms[1].swing);
  assert.equal(left.arms[1].spread,-right.arms[0].spread);
});
test('a running basketball receiver leads the catch on the incoming side',()=>{
  const p={x:0,z:0,heading:0,height:2,speed:0};
  const still=receivePoint(p,1);
  p.speed=3;
  const run=receivePoint(p,1);
  assert.ok(run.z>still.z && run.x>still.x);
  assert.equal(receivePoint(p,-1).x,-run.x);
});
