import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, formations } from '../src/simulation.js';

function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function shotAtEnd(match, z = 0) {
  const dir = match.direction(0);
  match.owner = null;
  match.flight = {
    from: 0, target: null, x: 52 * dir, z,
    tx: 54 * dir, tz: z, progress: .99, duration: .1, shot: true,
  };
  match.update(.02);
}

test('full matches finish with finite positions, passes, shots, and one halftime', () => {
  for (const [seed, tactic] of ['balanced', 'possession', 'counter', 'press'].entries()) {
    const events = [];
    const m = new Match(title => events.push(title), seededRandom(seed + 1));
    m.settings[0].tactic = tactic;
    for (let i = 0; i < 42000 && !m.ended; i++) {
      m.update(1 / 60);
      assert.ok(Number.isFinite(m.ball.x) && Number.isFinite(m.ball.z));
    }
    assert.equal(m.players.length, 22);
    assert.equal(m.ended, true, `match using ${tactic} must finish`);
    assert.equal(m.time, 5400);
    assert.equal(m.half, 2);
    assert.equal(events.filter(e => e === 'HALF TIME').length, 1);
    assert.equal(events.filter(e => e === 'FULL TIME').length, 1);
    for (const p of m.players) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
      assert.ok(Math.abs(p.x) <= 52.5 && Math.abs(p.z) <= 34);
    }
    assert.ok(m.passes[0] + m.passes[1] > 0);
    assert.ok(m.shots[0] + m.shots[1] > 0);
    const final = m.time;
    m.update(10);
    assert.equal(m.time, final);
  }
});

test('goal restarts with opposition at centre, and replay pause freezes clock', () => {
  const m = new Match();
  shotAtEnd(m);
  assert.deepEqual(m.score, [1, 0]);
  const time = m.time;
  m.update(1);
  assert.equal(m.time, time);
  assert.equal(m.owner, null);
  assert.ok(m.celebration);
  for (let i = 0; i < 1800 && m.celebration; i++) m.update(1 / 60);
  assert.equal(m.celebration, null);
  assert.equal(m.owner.team, 1);
  assert.equal(m.owner.slot, 9);
  assert.equal(m.flight, null);
  assert.equal(m.ball.x, 0);
});

test('missed shot restarts with goalkeeper instead of centre kickoff', () => {
  const m = new Match();
  shotAtEnd(m, 4.2);
  assert.deepEqual(m.score, [0, 0]);
  assert.equal(m.restart.type, 'goalKick');
  m.update(2);
  assert.equal(m.owner.team, 1);
  assert.equal(m.owner.slot, 0);
  assert.equal(m.ball.x, 47);
});

test('halftime swaps ends and away kicks off; second-half shots target correct goal', () => {
  const m = new Match();
  m.time = 2699.9;
  m.update(.02);
  assert.equal(m.time, 2700);
  assert.equal(m.restart.type, 'halftime');
  m.update(3);
  assert.equal(m.half, 2);
  assert.equal(m.direction(0), -1);
  assert.equal(m.players[0].x, 49);
  assert.equal(m.players[11].x, -49);
  assert.equal(m.owner.team, 1);
  m.owner = m.players[9];
  m.kick(null, true);
  assert.equal(m.flight.tx, -54);
  shotAtEnd(m);
  assert.deepEqual(m.score, [1, 0]);
});

test('outfield shot interception is reported as a block', () => {
  const events = [];
  const m = new Match(title => events.push(title));
  m.owner = null;
  m.flight = { from: 0, target: null, x: 0, z: 0, tx: 10, tz: 0, progress: .4, duration: 1, shot: true, peak: .2, startY: .15 };
  m.players[12].x = 5;
  m.players[12].z = 0;
  m.updateFlight(.1);
  assert.equal(m.owner.id, 12);
  assert.deepEqual(events, ['BLOCKED']);
});

test('formation settings survive reset while all match state resets', () => {
  for (const formation of Object.keys(formations)) {
    const m = new Match(() => {}, seededRandom(42));
    m.settings[0] = { formation, tactic: 'press' };
    m.settings[1] = { formation, tactic: 'possession' };
    for (let i = 0; i < 600; i++) m.update(1 / 60);
    assert.ok(m.players.every(p => Number.isFinite(p.x)));
    m.half = 2;
    m.reset();
    assert.equal(m.time, 0);
    assert.equal(m.half, 1);
    assert.equal(m.restart, null);
    assert.deepEqual(m.score, [0, 0]);
    assert.deepEqual(m.passes, [0, 0]);
    assert.equal(m.settings[0].formation, formation);
  }
});

test('players react at separate times and use distinct local roles', () => {
  const m = new Match(() => {}, seededRandom(7));
  for (let i = 0; i < 120; i++) m.update(1 / 60);
  const roles = new Set(m.players.filter(p => p.team === 0).map(p => p.intent.role));
  assert.ok(roles.size >= 3);
  assert.ok(new Set(m.players.map(p => p.decisionIn.toFixed(2))).size > 10);
  const velocities = m.players.filter(p => p.team === 0).map(p => Math.atan2(p.vx, p.vz));
  assert.ok(Math.max(...velocities) - Math.min(...velocities) > 1);
});

test('a duel has shield and tackle phases before possession is resolved', () => {
  const m = new Match(() => {}, seededRandom(3));
  const carrier = m.owner;
  const opponent = m.players[12];
  opponent.x = carrier.x + 1;
  opponent.z = carrier.z;
  m.startDuel(opponent);
  assert.equal(carrier.action, 'shield');
  assert.equal(opponent.action, 'tackle');
  m.updateDuel(.2);
  assert.ok(m.duel);
  assert.ok(carrier.contest > 0);
  m.random = () => .9;
  m.updateDuel(1);
  assert.equal(m.duel, null);
  assert.equal(m.owner, carrier);
});

test('long passes have higher trajectories than short passes and lead moving targets', () => {
  const m = new Match(() => {}, () => .5);
  const passer = m.players[9], receiver = m.players[6];
  passer.x = 0; passer.z = 0; receiver.x = 10; receiver.z = 0;
  receiver.vx = 3;
  m.owner = passer; m.ball = { x: 0, z: 0, y: .15 };
  m.kick(receiver);
  const shortPeak = m.flight.peak;
  assert.ok(m.flight.tx > receiver.x);
  m.owner = passer; receiver.x = 35;
  m.kick(receiver);
  assert.ok(m.flight.peak > shortPeak + 3);
  assert.equal(m.flight.lofted, true);
});

test('chest control cushions a descending ball and settles it at ground level', () => {
  const m = new Match(() => {}, () => .99);
  const p = m.players[9];
  m.ball = { x: p.x + .3, z: p.z, y: 1.5 };
  m.startControl(p, 'chest');
  m.updateControl(.24);
  assert.ok(m.ball.y > 1.3 && m.ball.y < 1.6);
  m.updateControl(.3);
  assert.ok(m.ball.y > .15 && m.ball.y < 1.43);
  m.updateControl(.3);
  assert.equal(m.ball.y, .15);
  assert.equal(m.control, null);
});

test('a high ball in front of goal can become a header shot', () => {
  const m = new Match(() => {}, () => .5);
  const p = m.players[9];
  p.x = 39; p.z = 0;
  m.ball = { x: 39, z: 0, y: 1.9 };
  const contact = m.tryAerialContact({ from: 0, passer: 8, target: 9, shot: false }, .9);
  assert.equal(contact, true);
  assert.equal(p.action, 'header');
  assert.equal(m.flight.header, true);
  assert.equal(m.flight.shot, true);
  assert.equal(m.shots[0], 1);
});

test('a heavy touch becomes a recoverable loose ball', () => {
  const m = new Match(() => {}, () => 0);
  const p = m.owner;
  m.ball = { x: p.x + .2, z: p.z, y: .15 };
  m.startControl(p, 'foot');
  m.updateControl(.4);
  assert.equal(m.owner, null);
  assert.ok(m.loose);
  assert.equal(m.miscontrols[0], 1);
  const x = m.ball.x;
  m.updateLoose(.1);
  assert.notEqual(m.ball.x, x);
});

test('passes to empty space are not automatically credited or teleported to receivers', () => {
  const m = new Match();
  m.owner = null;
  m.ball = { x: 0, z: 20, y: .15 };
  m.flight = { from: 0, passer: 9, target: 8, x: 0, z: 20, tx: 10, tz: 20,
    progress: .99, duration: 1, peak: .2, startY: .15, shot: false };
  for (const p of m.players) { p.x = -40; p.z = -25; }
  m.updateFlight(.02);
  assert.equal(m.owner, null);
  assert.ok(m.loose);
  assert.equal(m.passes[0], 0);
  assert.equal(m.ball.x, 10);
});

test('crossing touchline awards throw-in to opposition and releases an overhead throw', () => {
  const m = new Match();
  m.ball = { x: 10, z: 34.3, y: .15 };
  m.lastTouch = 0;
  assert.equal(m.checkBoundary(), true);
  assert.equal(m.restart.type, 'throwIn');
  assert.equal(m.restart.team, 1);
  m.update(2);
  assert.equal(m.owner.action, 'throw');
  assert.ok(m.ball.y > 1.8);
  m.updateSetPiece(1);
  assert.ok(m.flight);
  assert.equal(m.flight.from, 1);
  assert.ok(m.flight.tz < 34);
  assert.equal(m.setPiece, null);
});

test('a foul ends the duel and awards a free kick to the fouled side', () => {
  const m = new Match(() => {}, () => 0);
  const carrier = m.owner, defender = m.players[12];
  defender.x = carrier.x - 1; defender.z = carrier.z;
  m.startDuel(defender);
  m.updateDuel(1);
  assert.equal(m.fouls[1], 1);
  assert.equal(m.restart.type, 'freeKick');
  assert.equal(m.restart.team, 0);
  assert.equal(m.owner, null);
  m.update(4);
  assert.equal(m.setPiece.type, 'freeKick');
});

test('headers lose speed and descend under gravity rather than flying across the pitch', () => {
  const m = new Match(() => {}, () => .5);
  const p = m.players[9], target = m.players[8];
  p.x = 0; p.z = 0; target.x = 30; target.z = 0;
  m.owner = p; m.ball = { x: 0, z: 0, y: 1.9 };
  m.kick(target, false, true, 24);
  assert.ok(Math.hypot(m.flight.vx, m.flight.vz) <= 9);
  for (const player of m.players) { player.x = -40; player.z = -25; }
  for (let i = 0; i < 45 && m.flight; i++) m.updateFlight(1 / 60);
  assert.equal(m.flight, null);
  assert.ok(m.ball.x < 7);
  assert.equal(m.ball.y, .15);
  assert.ok(m.loose);
});

test('throw-ins stay short and point inward even if the receiver is far sideways', () => {
  const m = new Match(() => {}, () => .5);
  for (const player of m.players) { player.x = -35; player.z = -20; }
  m.beginSetPiece('throwIn', 0, { x: 20, z: 34.3 });
  m.updateSetPiece(1);
  assert.equal(m.flight.throwIn, true);
  assert.ok(Math.abs(m.flight.tx - m.flight.x) <= 4.5);
  assert.ok(Math.hypot(m.flight.tx - m.flight.x, m.flight.tz - m.flight.z) < 12);
  assert.ok(m.flight.tz >= 24 && m.flight.tz <= 28);
  assert.equal(m.flight.peak, 1);
});

test('fouled player falls, stays down, and stands before the restart', () => {
  const m = new Match(() => {}, () => 0);
  const p = m.owner, opponent = m.players[12];
  opponent.x = p.x - 1; opponent.z = p.z;
  m.startDuel(opponent);
  m.updateDuel(1);
  assert.equal(p.action, 'fall');
  m.update(.3);
  assert.ok(p.fallAmount > .2 && p.fallAmount < 1);
  m.update(.6);
  assert.equal(p.fallAmount, 1);
  assert.ok(m.pause > 0);
  m.update(1.5);
  assert.ok(p.fallRecover > 0);
  m.update(1.2);
  assert.equal(p.fallAmount, 0);
  assert.equal(p.fall, null);
  assert.equal(m.setPiece.type, 'freeKick');
});

test('goal sequence focuses scorer and teammates, then returns players before kickoff', () => {
  const m = new Match(() => {}, seededRandom(33));
  m.lastTouchPlayer = 9;
  shotAtEnd(m);
  assert.equal(m.celebration.scorer, 9);
  assert.equal(m.celebration.friends.length, 3);
  const stoppedTime = m.time;
  for (let i = 0; i < 300; i++) m.update(1 / 60);
  assert.equal(m.celebration.phase, 'celebrate');
  assert.equal(m.players[9].action, 'celebrate');
  assert.ok(m.celebration.friends.some(id => ['celebrate', 'highfive'].includes(m.players[id].action)));
  for (let i = 0; i < 1800 && m.celebration; i++) m.update(1 / 60);
  assert.equal(m.celebration, null);
  assert.equal(m.time, stoppedTime);
  assert.equal(m.owner.team, 1);
  assert.ok(m.players.filter(p => p.team === 0).every(p => p.x <= 0));
  assert.ok(m.players.filter(p => p.team === 1).every(p => p.x >= 0));
});

test('goalkeeper faces the ball while retreating instead of facing backwards', () => {
  const m = new Match(() => {}, () => .9);
  const keeper = m.players[0];
  keeper.x = -45; keeper.z = 0; keeper.angle = Math.PI / 2;
  m.ball = { x: -25, z: 0, y: .15 };
  m.owner = null;
  for (let i = 0; i < 120; i++) m.movePlayers(1 / 60, 1);
  assert.ok(keeper.x < -45);
  const facingBall = Math.sin(keeper.angle) * (m.ball.x - keeper.x) + Math.cos(keeper.angle) * (m.ball.z - keeper.z);
  assert.ok(facingBall > 0);
});

test('goal kicks and free kicks include retreat, preparation, and a run-up before contact', () => {
  for (const type of ['goalKick', 'freeKick']) {
    const m = new Match(() => {}, () => .7);
    const spot = type === 'goalKick' ? { x: -47, z: 0 } : { x: 32, z: 4 };
    m.beginSetPiece(type, 0, spot);
    const taker = m.owner;
    const phases = new Set();
    for (let i = 0; i < 360 && m.setPiece; i++) {
      phases.add(m.setPiece.phase);
      assert.equal(m.ball.x, spot.x);
      assert.equal(m.ball.z, spot.z);
      m.updateSetPiece(1 / 60);
    }
    assert.deepEqual([...phases], ['retreat', 'set', 'runup']);
    assert.equal(m.setPiece, null);
    assert.ok(m.flight);
    assert.ok(Math.hypot(taker.x - spot.x, taker.z - spot.z) < .7);
    assert.equal(taker.action, 'kick');
    assert.equal(taker.strideDirection, 1);
  }
});

test('scorer continues running while teammates join the celebration', () => {
  const m = new Match(() => {}, () => .5);
  shotAtEnd(m);
  const scorer = m.players[m.celebration.scorer];
  for (let i = 0; i < 240; i++) {
    const before = { x: scorer.x, z: scorer.z };
    m.updateCelebration(1 / 60);
    assert.ok(Math.hypot(scorer.x - before.x, scorer.z - before.z) > .015);
    assert.ok(scorer.running > 0);
  }
});
