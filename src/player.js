import * as THREE from 'three';
import { getPlayerProfile } from './roster.js';
import { gaitPose, bodyLean } from './gait.js';
import { buildImportedHead } from './face.js';

const material = color => new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const THIGH = .46;
const SHIN = .47;
const HIP_HEIGHT = 1.02;

function joint(parent, x, y, z = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function mesh(parent, geometry, mat, x, y, z = 0) {
  const result = new THREE.Mesh(geometry, mat);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function segment(parent, top, bottom, length, mat, y = -length / 2) {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, length, 8), mat, 0, y);
}

// The head is the imported CC0 base model (face.js / head-model.js),
// morphed per player: face type drives jaw, eyes, brows, nose and lips,
// and the hairstyle picks one of the model's hair variants. A stable
// per-player seed keeps each face's jitter identical across rebuilds.
function addHead(head, profile) {
  let seed = 2166136261;
  for (const ch of profile.name ?? '') seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  buildImportedHead(head, material, {
    face: profile.face, skinTone: profile.skin, hairColor: profile.hairColor,
    hairstyle: profile.hairstyle, seed, f: 1,
  });
}

export function createPlayer(p, team) {
  const g = new THREE.Group();
  const profile = p.profile ?? getPlayerProfile(team.id, p.role ? p.id % 18 : p.slot);
  const kit = material(p.slot === 0 ? (p.team === 0 ? 0xef8050 : 0x62c4b5) : team.shirt);
  const shorts = material(p.slot === 0 ? 0x283b34 : team.shorts);
  const skin = material(profile.skin);
  const sock = material(p.slot === 0 ? 0x364c3b : team.shirt);
  const boot = material(p.id % 3 === 0 ? 0xf49b66 : 0x24302b);
  const trim = material(p.slot === 0 ? 0xf4f1e5 : team.shorts);
  const pelvis = joint(g, 0, HIP_HEIGHT);
  pelvis.scale.x = profile.build;
  segment(pelvis, .165, .175, .18, shorts, .035).scale.z = .62;
  const torso = joint(pelvis, 0, .08);
  // Slim, tapered torso: narrower waist and shoulders, a small head, and
  // long articulated legs: ~7.2 heads tall.
  segment(torso, .205, .14, .52, kit, .27).scale.z = .60;
  // Kit detailing: a chest band and collar in the trim colour break up the
  // plain cylinder and read as a designed shirt at broadcast distance.
  segment(torso, .175, .168, .055, trim, .145).scale.z = .615;
  segment(torso, .082, .092, .05, trim, .545).scale.z = .8;
  const head = joint(torso, 0, .72);
  // The imported head brings its own slimmed neck, which overlaps the
  // collar; it seats high enough that the jaw never sinks into it.
  addHead(head, profile);
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const hip = joint(pelvis, side * .092, 0);
    segment(hip, .095, .08, .23, shorts);
    segment(hip, .078, .055, .23, p.role === 'coach' ? shorts : skin, -.345);
    const knee = joint(hip, 0, -THIGH);
    mesh(knee, new THREE.IcosahedronGeometry(.06, 1), skin, 0, -.005);
    segment(knee, .06, .038, SHIN, p.role === 'coach' ? shorts : sock);
    const ankle = joint(knee, 0, -SHIN);
    const shoe = mesh(ankle, new THREE.IcosahedronGeometry(.1, 1), boot, 0, -.04, .065);
    shoe.scale.set(.66, .52, 1.45);
    legs.push({ hip, knee, ankle });
    const shoulder = joint(torso, side * .205, .465);
    segment(shoulder, .078, .064, .15, kit);
    segment(shoulder, .056, .042, .15, skin, -.225);
    const elbow = joint(shoulder, 0, -.30);
    segment(elbow, .046, .03, .26, skin);
    const hand = mesh(elbow, new THREE.IcosahedronGeometry(p.slot===0&&!p.role?.length ? .07 : .052, 1), p.slot===0&&!p.role?.length ? material(0xe7eddd) : skin, 0, -.285);
    hand.scale.set(.8, 1.25, .65);
    arms.push({ shoulder, elbow, side });
  }
  if (typeof document !== 'undefined' && !['coach', 'referee'].includes(p.role)) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = ['brazil', 'argentina', 'england', 'germany'].includes(team.id) && p.slot !== 0 ? '#203048' : '#ffffff';
    ctx.font = 'bold 46px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(p.slot + 1), 32, 48);
    const number = mesh(torso, new THREE.PlaneGeometry(.23, .25),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }), 0, .30, -.112);
    number.rotation.y = Math.PI;
  }
  const heightScale = profile.height / 195.5;
  g.scale.setScalar(heightScale);
  return { g, pelvis, torso, head, legs, arms, heightScale, profile };
}

export function posePlayer(model, p) {
  const { g, pelvis, torso, head, legs, arms } = model;
  const speed = p.speed ?? p.running * 4;
  const gait = gaitPose(p.phase, speed, model.heightScale);
  const run = gait.moving;
  const contest = p.contest || 0;
  const phase = p.phase;
  const actionProgress = p.actionDuration ? 1 - (p.actionTime || 0) / p.actionDuration : 0;
  const absorb = Math.sin(clamp(actionProgress, 0, 1) * Math.PI);
  const chestTrap = p.action === 'chest' ? absorb : 0;
  const footTrap = ['foot', 'cushion'].includes(p.action) ? absorb : 0;
  const header = p.action === 'header' ? absorb : 0;
  const kick = p.action === 'kick' ? absorb : 0;
  const stumble = p.action === 'stumble' ? absorb : 0;
  // Lower the hips in a run; two small vertical oscillations per complete stride.
  const bounce = gait.hipOffset;
  // Arm swing trails the thigh by a short phase lag instead of mirroring it
  // exactly, like a real arm swing lagging behind the leg.
  const ARM_LAG = .6;
  const gaitLag = gaitPose(phase - ARM_LAG, speed, model.heightScale);
  const lagHipAngle = i => {
    const lf = gaitLag.feet[i];
    const fz = lf.z * (p.strideDirection ?? 1), fy = lf.y;
    const down = HIP_HEIGHT + bounce - fy;
    const reach = clamp(Math.hypot(down, fz), .15, THIGH + SHIN - .003);
    return Math.atan2(-fz, down) - Math.acos(clamp(
      (THIGH * THIGH + reach * reach - SHIN * SHIN) / (2 * THIGH * reach), -1, 1));
  };
  g.position.set(p.x, .045 + (bounce + (p.jump || 0)) * model.heightScale, p.z);
  g.rotation.set(0, p.angle, 0, 'YXZ');
  pelvis.rotation.y = Math.sin(phase) * .025 * run;
  pelvis.rotation.z = Math.cos(phase) * .012 * run;
  const lean = bodyLean(speed, p.turnRate || 0, p.accel || 0);
  torso.rotation.x = (.055 + gait.sprint * .12) * run + lean.pitch + (p.action === 'shield' ? .12 : .20) * contest - chestTrap * .24 + header * .32 + stumble * .35;
  torso.rotation.y = -Math.sin(phase) * .10 * run + (p.action === 'shield' ? .34 * contest : 0);
  torso.rotation.z = Math.sin(phase) * .015 * run + stumble * .15 + lean.roll;
  head.rotation.x = -torso.rotation.x * .65 + header * .25;
  head.rotation.y = -torso.rotation.y * .5;
  for (let i = 0; i < 2; i++) {
    const foot = gait.feet[i];
    let footZ = foot.z * (p.strideDirection ?? 1);
    let footY = foot.y;
    if (p.action === 'tackle' && i === 1) {
      footZ += contest * .38;
      footY += contest * .075;
    }
    if (i === 1 && footTrap > 0) {
      footZ += footTrap * (.40 - actionProgress * .17);
      footY += footTrap * (p.action === 'cushion' ? .43 : .07);
    }
    if (i === 1 && kick > 0) { footZ += kick * .5; footY += kick * .12; }
    const down = HIP_HEIGHT + bounce - footY;
    const reach = clamp(Math.hypot(down, footZ), .15, THIGH + SHIN - .003);
    // Two-bone inverse kinematics keeps the supporting boot close to the ground.
    const hipAngle = Math.atan2(-footZ, down) - Math.acos(clamp(
      (THIGH * THIGH + reach * reach - SHIN * SHIN) / (2 * THIGH * reach), -1, 1));
    const kneeAngle = Math.PI - Math.acos(clamp(
      (THIGH * THIGH + SHIN * SHIN - reach * reach) / (2 * THIGH * SHIN), -1, 1));
    legs[i].hip.rotation.x = hipAngle;
    legs[i].hip.rotation.y = i === 1 ? footTrap * .65 : 0;
    legs[i].hip.rotation.z = (i === 0 ? -.035 : .035) * contest;
    legs[i].knee.rotation.x = kneeAngle;
    legs[i].ankle.rotation.x = -(hipAngle + kneeAngle) + foot.pitch;
    const armPhase = phase - ARM_LAG + i * Math.PI;
    // Oppose the thigh with a natural lag rather than an unrelated sine wave, preserving natural coordination.
    arms[i].shoulder.rotation.x = -lagHipAngle(i) * (.42 + gait.sprint * .16) * run - .18 * run - contest * .15;
    arms[i].shoulder.rotation.y = arms[i].side * .1 * run;
    arms[i].shoulder.rotation.z = arms[i].side * (.08 + .12 * run + .65 * contest + chestTrap * .48 + header * .28);
    arms[i].elbow.rotation.x = -.12 - (.45 + .6 * gait.sprint + Math.sin(armPhase) * .12) * run - .35 * contest - chestTrap * .5;
    if(p.slot===0&&!p.role&&p.action!=='kick'&&p.action!=='throw'){
      const reach=p.keeperReach||0,dive=p.keeperDive||0;
      arms[i].shoulder.rotation.x=-.35-reach*1.25;
      arms[i].shoulder.rotation.z=arms[i].side*(.32-reach*.22)-dive*.35;
      arms[i].elbow.rotation.x=-.55+reach*.2;
      torso.rotation.z=-dive*.38;
      torso.rotation.x=.12+reach*.12;
    }
    if (p.action === 'celebrate' || p.action === 'highfive') {
      const wave = Math.sin(phase + i * 1.3) * .18;
      arms[i].shoulder.rotation.x = (p.action === 'highfive' && i === 0 ? -.5 : -2.35) + wave;
      arms[i].shoulder.rotation.z = arms[i].side * .28;
      arms[i].elbow.rotation.x = -.35;
    }
    if (p.action === 'throw') {
      arms[i].shoulder.rotation.x = -2.6 + actionProgress * 1.5;
      arms[i].shoulder.rotation.z = arms[i].side * .08;
      arms[i].elbow.rotation.x = -.8 + actionProgress * .5;
    }
  }
  // Idle life: breathing, weight shifting and small arm/head drift so
  // standing players never freeze like mannequins.
  const idleT = p.animTime || 0, idleAmt = 1 - run;
  if (idleAmt > 0) {
    torso.rotation.x += Math.sin(idleT * 1.5) * .008 * idleAmt;
    torso.rotation.z += Math.sin(idleT * .8 + 1.2) * .008 * idleAmt;
    head.rotation.y += Math.sin(idleT * .45 + (p.id || 0) * 1.7) * .06 * idleAmt;
    for (let i = 0; i < 2; i++) {
      arms[i].shoulder.rotation.z += arms[i].side * Math.sin(idleT * 1.1 + i * 2.4) * .025 * idleAmt;
      arms[i].elbow.rotation.x += Math.sin(idleT * 1.3 + i * 1.1) * .03 * idleAmt;
    }
  }
  const fall = p.fallAmount || 0;
  if (fall > 0) {
    g.rotation.z = Math.PI * .5 * fall;
    g.position.y += .27 * fall;
    const rise = Math.sin((p.fallRecover || 0) * Math.PI);
    torso.rotation.x = .15 * fall + .48 * rise;
    head.rotation.z = -.15 * fall;
    for (let i = 0; i < 2; i++) {
      legs[i].hip.rotation.x = -.35 * fall - .6 * rise;
      legs[i].knee.rotation.x = .7 * fall + .7 * rise;
      legs[i].ankle.rotation.x = -.35 * fall;
      arms[i].shoulder.rotation.x = -.6 * fall - .5 * rise;
      arms[i].shoulder.rotation.z = arms[i].side * .5 * fall;
      arms[i].elbow.rotation.x = -.4 * fall - .5 * rise;
    }
  } else head.rotation.z = 0;
}

export function disposePlayer(model) {
  const materials = new Set();
  model.g.traverse(node => {
    node.geometry?.dispose();
    if (node.material) materials.add(node.material);
  });
  for (const mat of materials) { mat.map?.dispose(); mat.dispose(); }
  model.g.removeFromParent();
}
