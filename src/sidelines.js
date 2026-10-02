import * as THREE from 'three';
import { strideFrequency } from './gait.js';
import { createPlayer, posePlayer, disposePlayer } from './player.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true, ...options });
function box(parent, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function actor(id, team, kit, role) {
  const state = { id, slot: 1, team, x: 0, z: 0, vx: 0, vz: 0, phase: id, running: 0,
    angle: Math.PI, action: 'idle', contest: 0, jump: 0, role };
  return { state, model: createPlayer(state, kit) };
}

export function createSidelines(teams) {
  const group = new THREE.Group();
  const furniture = new THREE.Group();
  group.add(furniture);
  const actors = [];
  const refs = [];
  const staff = [];
  const reserves = [];
  for (let i = 0; i < 3; i++) {
    const person = actor(40 + i, 0, { id: 'referee', shirt: 0xf2b543, shorts: 0x17232b }, 'referee');
    person.state.x = i === 1 ? -20 : i === 2 ? 20 : -10;
    person.state.z = i === 1 ? -35.4 : i === 2 ? 35.4 : 12;
    person.model.g.name = i === 0 ? '主審' : `副審 ${i}`;
    group.add(person.model.g);
    actors.push(person);
    refs.push(person);
    if (i > 0) {
      const flag = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .6, 5), mat(0x1c2929));
      flag.add(pole);
      box(flag, .29, .25, .01, mat(0xffcf32, { side: THREE.DoubleSide }), .15, .14, 0);
      box(flag, .145, .125, .012, mat(0xf47b2b), .077, .20, 0);
      box(flag, .145, .125, .012, mat(0xf47b2b), .222, .077, 0);
      flag.position.set(0, -.32, 0);
      person.model.arms[1].elbow.add(flag);
    }
  }
  for (let team = 0; team < 2; team++) {
    const centre = team === 0 ? -19 : 19;
    const frame = mat(0x41504e), seat = mat(teams[team].shirt);
    box(furniture, 10, .15, 1, frame, centre, .52, 41.5);
    box(furniture, 10, .62, .14, frame, centre, .86, 42);
    for (const x of [-4.8, 4.8]) {
      box(furniture, .07, 2.3, .07, frame, centre + x, 1.15, 42.5);
      box(furniture, .07, 2.3, .07, frame, centre + x, 1.15, 40.2);
    }
    box(furniture, 10.2, .07, 2.4, mat(0xabc3c7, { transparent: true, opacity: .3 }), centre, 2.3, 41.35);
    // Painted technical area sits between the pitch and advertising boards.
    const points = [[centre - 5, .065, 35], [centre + 5, .065, 35], [centre + 5, .065, 37.5],
      [centre - 5, .065, 37.5], [centre - 5, .065, 35]].map(p => new THREE.Vector3(...p));
    furniture.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xd8e0c9 })));
    for (let i = 0; i < 7; i++) {
      box(furniture, .75, .12, .8, seat, centre - 3.9 + i * 1.3, .63, 41.5);
      const reserve = actor(50 + team * 10 + i, team, teams[team], 'reserve');
      reserve.state.x = centre - 3.9 + i * 1.3;
      reserve.state.z = 41.4;
      reserve.state.angle = Math.PI;
      reserve.model.g.name = `控え選手 ${team + 1}-${i + 1}`;
      group.add(reserve.model.g);
      reserves.push(reserve);
      actors.push(reserve);
      const bib = new THREE.Mesh(new THREE.CylinderGeometry(.24, .171, .37, 8),
        mat(team === 0 ? 0xed8658 : 0x97c654));
      bib.scale.z = .66;
      bib.position.y = .29;
      reserve.model.torso.add(bib);
    }
    const coach = actor(70 + team, team, { id: 'coach', shirt: 0x23333e, shorts: 0x23333e }, 'coach');
    coach.state.x = centre;
    coach.state.z = 36.7;
    coach.model.g.name = team === 0 ? 'ホーム監督' : 'アウェイ監督';
    group.add(coach.model.g);
    staff.push(coach);
    actors.push(coach);
  }
  return { group, furniture, actors, refs, staff, reserves, elapsed: 0 };
}

export function updateSidelines(sidelines, match, dt, playing) {
  if (playing) sidelines.elapsed += dt;
  const time = sidelines.elapsed;
  const b = match.ball;
  for (let i = 0; i < sidelines.refs.length; i++) {
    const { state: p, model } = sidelines.refs[i];
    let tx, tz;
    if (i === 0) {
      const dir = match.direction(match.owner?.team ?? match.flight?.from ?? 0);
      tx = clamp(b.x - 10 * dir, -44, 44);
      tz = clamp(b.z + (b.z > 0 ? -9 : 9), -27, 27);
      for (const player of match.players) {
        const dx = tx - player.x, dz = tz - player.z, gap = Math.hypot(dx, dz);
        if (gap < 3 && gap > .01) { tx += dx / gap * (3 - gap); tz += dz / gap * (3 - gap); }
      }
    } else {
      const dir = i === 1 ? -1 : 1;
      const defence = match.players.filter(p => match.direction(p.team) === -dir)
        .map(p => p.x * dir).sort((a, b) => b - a);
      tx = clamp(Math.max(defence[1], b.x * dir) * dir, i === 1 ? -51 : 0, i === 1 ? 0 : 51);
      tz = i === 1 ? -35.4 : 35.4;
    }
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    const speed = playing ? Math.min(5.2, Math.max(0, d - .4) * 1.4) : 0;
    if (d > .01) { p.x += dx / d * speed * dt; p.z += dz / d * speed * dt; }
    p.speed = speed;
    p.running = speed / 5.2;
    if (speed > .2) p.angle = Math.atan2(dx, dz);
    else p.angle = Math.atan2(b.x - p.x, b.z - p.z);
    if (playing) p.phase += dt * Math.PI * 2 * strideFrequency(speed);
    posePlayer(model, p);
    if (match.restart?.type === 'freeKick' && i === 0) {
      model.arms[0].shoulder.rotation.x = -1.4;
      model.arms[0].elbow.rotation.x = 0;
    }
    if (match.restart?.type === 'throwIn' && ((i === 1 && b.z < 0) || (i === 2 && b.z > 0))) {
      model.arms[1].shoulder.rotation.x = -2.6;
      model.arms[1].elbow.rotation.x = 0;
    }
  }
  for (let i = 0; i < sidelines.staff.length; i++) {
    const { state: p, model } = sidelines.staff[i];
    p.x = (i === 0 ? -19 : 19) + Math.sin(time * .27 + i * 2) * 1.4;
    p.running = playing ? Math.abs(Math.cos(time * .27 + i * 2)) * .08 : 0;
    p.angle = Math.atan2(b.x - p.x, b.z - p.z);
    p.speed = p.running * 4;
    if (playing) p.phase += dt * Math.PI * 2 * strideFrequency(p.speed);
    posePlayer(model, p);
    const gesture = Math.max(0, Math.sin(time * .75 + i * 3));
    model.arms[1].shoulder.rotation.x = -1.2 * gesture;
    model.arms[1].elbow.rotation.x = -.2 - .3 * gesture;
  }
  for (const { state: p, model } of sidelines.reserves) {
    posePlayer(model, p);
    model.g.position.y = -.45 * model.heightScale;
    model.torso.rotation.x = .13 + Math.sin(time * .4 + p.id) * .03;
    model.head.rotation.y = Math.sin(time * .23 + p.id) * .2;
    for (const leg of model.legs) {
      leg.hip.rotation.x = -Math.PI / 2;
      leg.knee.rotation.x = Math.PI / 2;
      leg.ankle.rotation.x = 0;
    }
    for (const arm of model.arms) {
      arm.shoulder.rotation.x = -.3;
      arm.elbow.rotation.x = -1.05;
    }
  }
}

export function disposeSidelines(sidelines) {
  sidelines.actors.forEach(actor => disposePlayer(actor.model));
  sidelines.furniture.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  sidelines.group.removeFromParent();
}
