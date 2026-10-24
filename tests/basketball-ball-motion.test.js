import test from 'node:test';
import assert from 'node:assert/strict';
import { BasketballMatch } from '../basketball/simulation.js';
import {dribblePoint,releasePoint,receivePoint,localToWorld,DRIBBLE_PERIOD,
  BALL_RADIUS,PASS_GATHER,PASS_CATCH,SHOT_GATHER} from '../basketball/ball-motion.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const xzDistance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const advance=(game,time,step=.01)=>{
  for(let i=0;i<Math.ceil(time/step);i++)game.updateFlight(Math.min(step,time-i*step));
};

test('dribble uses either left or right hand with physically joined floor trajectories',()=>{
  const game=new BasketballMatch(()=>{},()=>.42);
  const p=game.owner;
  p.heading=0;
  const left=dribblePoint(p,-1,0),right=dribblePoint(p,1,0);
  assert.ok(left.x < p.x && right.x > p.x);
  assert.ok(Math.abs(left.x+right.x-2*p.x)<1e-10);
  assert.ok(distance(dribblePoint(p,-1,.5),dribblePoint(p,1,.5))<1e-10);
  assert.ok(Math.abs(dribblePoint(p,-1,.5).y-.125)<1e-10);
  assert.ok(dribblePoint(p,1,0).y>1.14);
});

test('ball stays within articulated-hand reach for the contact part of the bounce',()=>{
  const p={x:0,z:0,heading:0};
  const shoulder={x:.235,y:1.53,z:0};
  for(let phase=0;phase<1;phase+=.005){
    const b=dribblePoint(p,1,phase);
    if(b.y>=.94){
      const target={x:b.x,y:b.y+BALL_RADIUS,z:b.z};
      assert.ok(distance(shoulder,target)<.671, 'palm cannot reach ball at '+phase);
    }
  }
});

test('cross-over changes hand only near the floor and keeps the ball continuous',()=>{
  const game=new BasketballMatch(()=>{},()=>.7);
  const p=game.owner;
  p.heading=0;
  game.players[5].x=p.x+2;
  game.players[5].z=p.z;
  game.ballControl.hand=1;
  game.ballControl.phase=.49;
  game.ballControl.cooldown=-1;
  game.ball=dribblePoint(p,1,.49);
  const before={...game.ball};
  game.syncHeldBall(DRIBBLE_PERIOD*.02);
  assert.equal(game.ballControl.hand,-1);
  assert.ok(distance(before,game.ball)<.08);
});

test('pass gather and release share a continuous position at their boundary',()=>{
  const game=new BasketballMatch(()=>{},()=>.5);
  game.pass();
  const f=game.flight;
  const begin={...game.ball};
  assert.ok(distance(begin,f.start)<1e-9);
  const before=PASS_GATHER-.0001;
  game.updateFlight(before);
  const endGather={...game.ball};
  game.updateFlight(.0002);
  assert.equal(game.flight.stage,'air');
  assert.ok(distance(endGather,game.ball)<.025);
  assert.ok(distance(game.flight.release,releasePoint(game.players[f.from],'pass'))<1e-9);
});

test('pass flight ends in receiving hands and catches without teleportation',()=>{
  const game=new BasketballMatch(()=>{},()=>.5);
  game.pass();
  const receiver=game.players[game.flight.to];
  const f=game.flight;
  let previous={...game.ball};
  let maxJump=0;
  let sawGather=false,sawAir=false,sawCatch=false;
  while(game.flight){
    game.updateFlight(Math.min(.01,game.flight.duration*(1-game.flight.t)));
    maxJump=Math.max(maxJump,distance(previous,game.ball));
    previous={...game.ball};
    sawGather ||= f.stage==='gather';
    sawAir ||= f.stage==='air';
    sawCatch ||= f.stage==='catch';
  }
  assert.ok(sawGather&&sawAir&&sawCatch);
  assert.equal(game.owner,receiver);
  assert.ok(maxJump<.35,'ball jumped by '+maxJump+' metres');
  assert.ok(distance(game.ball,dribblePoint(receiver,game.ballControl.hand,0))<1e-9);
  // The first held/dribble frame also starts at the exact catch endpoint.
  const caught={...game.ball};
  game.syncHeldBall(.001);
  assert.ok(distance(caught,game.ball)<.03);
});

test('shoot begins with the current dribble ball and releases from the hands',()=>{
  const game=new BasketballMatch(()=>{},()=>0);
  const shooter=game.owner;
  const before={...game.ball};
  game.shoot();
  const f=game.flight;
  assert.ok(distance(before,game.ball)<1e-9);
  game.updateFlight(SHOT_GATHER);
  assert.equal(f.stage,'air');
  assert.ok(distance(game.ball,f.release)<1e-7);
  assert.ok(distance(f.release,releasePoint(shooter,'shot'))<1e-10);
});

test('free throw setup returns the ball in a continuous path to the shooter',()=>{
  const game=new BasketballMatch(()=>{},()=>0);
  const previous={...game.ball};
  game.beginFreeThrows(0,2);
  assert.ok(distance(previous,game.ball)<1e-9);
  const ft=game.freeThrows;
  const start={...game.ball};
  game.updateFreeThrows(.1);
  assert.ok(distance(start,game.ball)<1);
  game.updateFreeThrows(3);
  assert.equal(ft.state,'flight');
  assert.ok(distance(game.ball,ft.start)<1e-9);
});

test('receiver animation is active until completion of catch phase',()=>{
  const game=new BasketballMatch(()=>{},()=>.5);
  game.pass();
  const f=game.flight,receiver=game.players[f.to];
  assert.equal(receiver.action,'catch');
  const t=f.duration-PASS_CATCH*.5;
  game.updateFlight(t);
  assert.equal(f.stage,'catch');
  assert.equal(game.owner,null);
  game.updateFlight(f.duration-t);
  assert.equal(game.owner,receiver);
});
