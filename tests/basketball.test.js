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
