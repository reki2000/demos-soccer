import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayer, posePlayer, disposePlayer } from '../src/player.js';
import { gaitPose, strideFrequency } from '../src/gait.js';
import { createCrowd, animateCrowd } from '../src/crowd.js';
import { createSidelines, updateSidelines, disposeSidelines } from '../src/sidelines.js';
import { Match, countries } from '../src/simulation.js';

const state = overrides => ({ id: 2, team: 0, slot: 1, x: 0, z: 0, angle: 0, phase: 0,
  speed: 0, running: 0, jump: 0, action: 'idle', contest: 0, ...overrides });

test('player proportions are about seven heads tall with articulated knees and elbows', () => {
  const p = state(), model = createPlayer(p, countries[0]);
  posePlayer(model, p);
  model.g.updateMatrixWorld(true);
  const height = new THREE.Box3().setFromObject(model.g).getSize(new THREE.Vector3()).y;
  const ratio = height / (.25 * 1.08 * model.heightScale);
  assert.ok(ratio > 6.8 && ratio < 7.7, `head-to-height ratio: ${ratio}`);
  assert.equal(model.legs.length, 2);
  assert.ok(model.legs.every(leg => leg.knee.parent === leg.hip && leg.ankle.parent === leg.knee));
  assert.ok(model.arms.every(arm => arm.elbow.parent === arm.shoulder));
  disposePlayer(model);
});

test('planted foot travel cancels body travel over the stance phase', () => {
  for (const speed of [1.2, 3, 5.2]) {
    const phase = .08 * Math.PI * 2;
    const delta = .025;
    const first = gaitPose(phase, speed);
    const second = gaitPose(phase + delta * Math.PI * 2 * strideFrequency(speed), speed);
    assert.equal(first.feet[0].stance, true);
    assert.equal(second.feet[0].stance, true);
    const slip = second.feet[0].z + speed * delta - first.feet[0].z;
    assert.ok(Math.abs(slip) < .00001, `speed ${speed}, slip ${slip}`);
  }
});

test('running has aerial phases, knee recovery, and finite poses through a full stride', () => {
  const p = state({ speed: 5, running: 1 });
  const model = createPlayer(p, countries[0]);
  let maxKnee = 0, flightFrames = 0;
  for (let i = 0; i < 100; i++) {
    p.phase = i / 100 * Math.PI * 2;
    const gait = gaitPose(p.phase, p.speed);
    if (gait.feet.every(f => !f.stance)) flightFrames++;
    posePlayer(model, p);
    maxKnee = Math.max(maxKnee, model.legs[0].knee.rotation.x);
    model.g.updateMatrixWorld(true);
    model.g.traverse(n => assert.ok(n.matrixWorld.elements.every(Number.isFinite)));
  }
  assert.ok(flightFrames > 0);
  assert.ok(maxKnee > 1.4);
  disposePlayer(model);
});

test('crowd has varied clothing, skin tones, accessories, and animated supporters', () => {
  const crowd = createCrowd(countries.slice(0, 2));
  const [bodies, heads] = crowd.group.children;
  assert.ok(bodies.count > 3000);
  assert.equal(heads.count, bodies.count);
  const colors = new Set();
  for (let i = 0; i < 100; i++) colors.add(bodies.instanceColor.array.slice(i * 3, i * 3 + 3).join(','));
  assert.ok(colors.size >= 6);
  assert.ok(crowd.waving.length > 20);
  animateCrowd(crowd, .1);
  assert.ok(crowd.arms.instanceMatrix.array.every(Number.isFinite));
});

test('sidelines contain three officials, two coaches, and fourteen seated substitutes', () => {
  const sidelines = createSidelines(countries.slice(0, 2));
  const match = new Match();
  assert.equal(sidelines.refs.length, 3);
  assert.equal(sidelines.staff.length, 2);
  assert.equal(sidelines.reserves.length, 14);
  updateSidelines(sidelines, match, .1, true);
  for (const reserve of sidelines.reserves) {
    assert.equal(reserve.model.legs[0].knee.rotation.x, Math.PI / 2);
  }
  sidelines.group.updateMatrixWorld(true);
  sidelines.group.traverse(n => assert.ok(n.matrixWorld.elements.every(Number.isFinite)));
  disposeSidelines(sidelines);
});

test('squad identities and appearance vary and remain stable across resets', async () => {
  const { assignProfiles, getPlayerProfile } = await import('../src/roster.js');
  const m = new Match();
  assignProfiles(m, countries.slice(0, 2));
  const squad = m.players.slice(0, 11).map(p => p.profile);
  assert.equal(new Set(squad.map(p => p.name)).size, 11);
  assert.ok(new Set(squad.map(p => p.height)).size > 5);
  assert.ok(new Set(squad.map(p => p.skin)).size > 3);
  assert.ok(new Set(squad.map(p => p.hairstyle)).size > 3);
  const identity = getPlayerProfile('japan', 9);
  m.reset();
  assignProfiles(m, countries.slice(0, 2));
  assert.equal(m.players[9].profile, identity);
});
