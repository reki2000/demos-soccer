import test from 'node:test';
import assert from 'node:assert/strict';
import { BasketballMatch, COURT, SQUADS } from '../basketball/simulation.js';

test('basketball fixture starts with ten players and a 24-second possession', () => {
  const game = new BasketballMatch();
  assert.equal(game.players.length, 10);
  assert.equal(game.players.filter(p => p.team === 0).length, 5);
  assert.equal(game.players.filter(p => p.team === 1).length, 5);
  assert.equal(game.owner.team, 0);
  assert.equal(game.clock, 600);
  assert.equal(game.shotClock, 24);
  assert.equal(SQUADS.length, 4);
});

test('completed pass transfers ownership to a teammate', () => {
  const game = new BasketballMatch(() => {}, () => .5);
  const initial = game.owner;
  game.pass();
  assert.equal(game.owner, null);
  assert.equal(game.flight.kind, 'pass');
  game.updateFlight(game.flight.duration);
  assert.ok(game.owner);
  assert.notEqual(game.owner.id, initial.id);
  assert.equal(game.owner.team, 0);
  assert.equal(game.passes[0], 1);
});

test('three-point make updates the score and starts an inbound', () => {
  const events = [];
  const game = new BasketballMatch((type, data) => events.push({type, data}), () => 0);
  const dir = game.direction(0);
  game.owner.x = dir * (COURT.basketX - 7.3);
  game.owner.z = 0;
  game.shoot();
  assert.equal(game.flight.points, 3);
  game.updateFlight(game.flight.duration);
  assert.deepEqual(game.score, [3,0]);
  assert.deepEqual(game.threes, [1,0]);
  assert.deepEqual(game.makes, [1,0]);
  assert.equal(game.pause, 1.5);
  assert.equal(events.find(e => e.type === 'score').data.points, 3);
  for (let i = 0; i < 11; i++) game.update(.15);
  assert.equal(game.possession, 1);
  assert.equal(game.shotClock, 24);
});

test('missed shot results in a rebound and possession reset', () => {
  const game = new BasketballMatch(() => {}, () => .99);
  game.shoot();
  game.updateFlight(game.flight.duration);
  assert.equal(game.score[0], 0);
  assert.equal(game.flight.kind, 'rebound');
  game.updateFlight(game.flight.duration);
  assert.equal(game.rebounds[0], 1);
  assert.equal(game.possession, 0);
  assert.equal(game.shotClock, 14);
});

test('shot clock expiration records a turnover', () => {
  const events = [];
  const game = new BasketballMatch((type) => events.push(type));
  game.shotClock = .02;
  game.update(.04);
  assert.equal(game.possession, 1);
  assert.equal(game.turnovers[0], 1);
  assert.equal(game.shotClock, 24);
  assert.ok(events.includes('violation'));
});

test('quarters switch ends after four periods and swaps directions at halftime', () => {
  const game = new BasketballMatch();
  for (let quarter = 1; quarter <= 4; quarter++) {
    const sign = game.direction(0);
    assert.equal(sign, quarter > 2 ? -1 : 1);
    game.pause = 0;
    game.clock = .01;
    game.update(.02);
    if (quarter < 4) assert.equal(game.quarter, quarter + 1);
  }
  assert.equal(game.ended, true);
  assert.equal(game.quarter, 4);
  assert.equal(game.clock, 0);
});

test('simulation maintains finite positions and legal ball state', () => {
  const game = new BasketballMatch(() => {}, () => .2);
  for (let i = 0; i < 4000; i++) game.update(.05);
  assert.ok(game.score.every(Number.isFinite));
  assert.ok(game.players.every(p => Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) <= 14 && Math.abs(p.z) <= 7.5));
  assert.ok(['pass','shot','rebound',null].includes(game.flight?.kind ?? null));
  assert.ok(game.ball && Number.isFinite(game.ball.x) && Number.isFinite(game.ball.y) && Number.isFinite(game.ball.z));
  assert.ok(game.possession === 0 || game.possession === 1);
  assert.equal(game.snapshot().players.length, 10);
});


test('ordinary defensive fouls retain possession and reset a short shot clock to fourteen seconds', () => {
  const events = [];
  const game = new BasketballMatch((type, data) => events.push({type, data}));
  game.shotClock = 7;
  assert.equal(game.callFoul(5, 0), true);
  assert.deepEqual(game.teamFouls,[0,1]);
  assert.equal(game.playerFouls[5],1);
  assert.equal(game.possession,0);
  assert.equal(game.shotClock,14);
  assert.equal(game.freeThrows,null);
  assert.equal(events.find(e=>e.type==='foul').data.bonus,false);
});

test('fifth team foul in a quarter awards two free throws', () => {
  const game = new BasketballMatch(()=>{},()=>0);
  for(let i=0;i<4;i++) {
    game.callFoul(5,0);
    assert.equal(game.freeThrows,null);
  }
  game.callFoul(5,0);
  assert.equal(game.teamFouls[1],5);
  assert.equal(game.playerFouls[5],5);
  assert.equal(game.freeThrows.total,2);
  assert.equal(game.freeThrows.shooter,0);
  assert.equal(game.owner,null);
});

test('free throws freeze the game clock and each successful attempt scores one point', () => {
  const events=[];
  const game = new BasketballMatch((type,data)=>events.push({type,data}),()=>0);
  game.beginFreeThrows(0,2);
  const clock=game.clock;
  const shotClock=game.shotClock;
  for(let i=0;i<40;i++) game.update(.15);
  assert.equal(game.clock,clock);
  assert.equal(game.shotClock,shotClock);
  assert.equal(game.ftAttempts[0],1);
  game.updateFreeThrows(7);
  assert.equal(game.ftMakes[0],1);
  assert.deepEqual(game.score,[1,0]);
  assert.equal(game.freeThrows.remaining,1);
  game.updateFreeThrows(5);
  game.updateFreeThrows(7);
  assert.equal(game.ftAttempts[0],2);
  assert.equal(game.ftMakes[0],2);
  assert.deepEqual(game.score,[2,0]);
  assert.equal(game.freeThrows,null);
  assert.equal(game.nextTeam,1);
  assert.ok(events.some(e=>e.type==='freeThrowStart'));
  assert.equal(events.filter(e=>e.type==='freeThrowMade').length,2);
  for(let i=0;i<16;i++) game.update(.15);
  assert.equal(game.possession,1);
});

test('missed two-point shooting foul gives two free throws and a last-shot rebound', () => {
  const sequence=[.01,.99,.0,.99,.5];
  const game = new BasketballMatch(()=>{},()=>sequence.shift() ?? .5);
  const shooter=game.owner;
  shooter.x=game.direction(0)*(COURT.basketX-4);
  shooter.z=0;
  game.players[5].x=shooter.x+.3;
  game.players[5].z=0;
  game.shoot();
  assert.equal(game.flight.points,2);
  assert.equal(game.flight.shootingFoul,true);
  assert.deepEqual(game.teamFouls,[0,1]);
  game.updateFlight(game.flight.duration);
  assert.deepEqual(game.score,[0,0]);
  assert.equal(game.freeThrows.total,2);
  game.updateFreeThrows(5);game.updateFreeThrows(7);
  game.updateFreeThrows(5);game.updateFreeThrows(7);
  assert.equal(game.ftAttempts[0],2);
  assert.equal(game.ftMakes[0],1);
  assert.deepEqual(game.score,[1,0]);
  assert.equal(game.freeThrows,null);
  assert.equal(game.rebounds[1],1);
  assert.equal(game.possession,1);
});

test('missed three-point shooting foul awards three free throws', () => {
  const sequence=[.01,.99,.3,.3,.3];
  const game = new BasketballMatch(()=>{},()=>sequence.shift() ?? .5);
  const shooter=game.owner;
  shooter.x=game.direction(0)*(COURT.basketX-7.3);
  shooter.z=0;
  game.players[5].x=shooter.x+.2;
  game.players[5].z=0;
  game.shoot();
  assert.equal(game.flight.points,3);
  game.updateFlight(game.flight.duration);
  assert.equal(game.freeThrows.total,3);
  for(let i=0;i<3;i++){game.updateFreeThrows(5);game.updateFreeThrows(7);}
  assert.deepEqual(game.score,[3,0]);
  assert.equal(game.ftAttempts[0],3);
  assert.equal(game.ftMakes[0],3);
  assert.equal(game.makes[0],0);
});

test('made field goal through a shooting foul adds one and-one free throw', () => {
  const game = new BasketballMatch(()=>{},()=>0);
  const shooter=game.owner;
  shooter.x=game.direction(0)*(COURT.basketX-3);
  game.players[5].x=shooter.x+.3;
  game.players[5].z=shooter.z;
  game.shoot();
  assert.equal(game.flight.shootingFoul,true);
  game.updateFlight(game.flight.duration);
  assert.deepEqual(game.score,[2,0]);
  assert.equal(game.freeThrows.total,1);
  game.updateFreeThrows(5);game.updateFreeThrows(7);
  assert.deepEqual(game.score,[3,0]);
  assert.equal(game.ftMakes[0],1);
  assert.equal(game.makes[0],1);
});

test('team fouls reset each quarter while player foul totals persist', () => {
  const game = new BasketballMatch();
  game.callFoul(5,0);
  game.clock=.01;
  game.update(.02);
  assert.equal(game.quarter,2);
  assert.deepEqual(game.teamFouls,[0,0]);
  assert.equal(game.playerFouls[5],1);
  assert.equal(game.freeThrows,null);
});


test('off-ball players make distinct individual decisions and avoid stacking up', () => {
  let state = 0x836281;
  const random = () => {state = (Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296;};
  const game = new BasketballMatch(()=>{},random);
  game.possessionAge = 6;
  const seen = new Set();
  const trajectories = game.players.map(()=>[]);
  let minimumSpacing = Infinity;
  for(let tick=0;tick<320;tick++){
    game.elapsed += .05;
    game.movePlayers(.05);
    for(const p of game.players){
      seen.add(p.intent);
      if(tick % 20 === 0) trajectories[p.id].push([p.x,p.z]);
      assert.ok(Math.abs(p.x) <= 13.31 && Math.abs(p.z) <= 6.81);
      assert.ok(Number.isFinite(p.vx) && Number.isFinite(p.vz));
      assert.ok(p.speed <= 3.81);
    }
    for(let i=0;i<10;i++)for(let j=i+1;j<10;j++) {
      const a=game.players[i], b=game.players[j];
      const gap=Math.hypot(a.x-b.x,a.z-b.z);
      minimumSpacing=Math.min(minimumSpacing,gap);
      assert.ok(gap >= 1.02, 'Players '+i+'/'+j+' too close at tick '+tick+': '+gap);
    }
  }
  assert.ok(seen.size >= 5, 'Expected diverse decisions, got '+[...seen]);
  const changedPaths = trajectories.filter(points=>{
    for(let k=2;k<points.length;k++){
      const a=points[k-2], b=points[k-1], c=points[k];
      const abx=b[0]-a[0],abz=b[1]-a[1],bcx=c[0]-b[0],bcz=c[1]-b[1];
      if(Math.abs(abx*bcz-abz*bcx) > .18)return true;
    }
    return false;
  });
  assert.ok(changedPaths.length>=3, 'Too many straight-line trajectories: '+changedPaths.length);
});

test('on-ball handler advances and different teammates respond after receiving a pass', () => {
  const game=new BasketballMatch(()=>{},()=>.35);
  const initial=game.owner;
  for(let i=0;i<140;i++){game.elapsed+=.05;game.movePlayers(.05);}
  assert.ok(game.owner.x > -7.2,'Owner must move rather than stand still');
  const target=game.players[2];
  game.owner=target;
  game.decision=1;
  const prevIntent=target.intent;
  // The next plan belongs to the new ball-handler, not the old slot zero.
  game.movePlayers(.05);
  for(let i=0;i<40;i++){game.elapsed+=.05;game.movePlayers(.05);}
  assert.ok(['drive','probe'].includes(target.intent), 'Receiver never took control of a possession');
  assert.ok(game.players[0].intent !== 'dribble');
  assert.notEqual(game.owner.id,initial.id);
});

test('simulation at 1x advances physical positions and the game clock by the same interval', () => {
  const game=new BasketballMatch(()=>{},()=>.34);
  const x=game.owner.x;
  game.update(.1);
  assert.ok(Math.abs(game.clock-599.9)<1e-8);
  assert.ok(Math.abs(game.owner.x-x)<.45);
});
