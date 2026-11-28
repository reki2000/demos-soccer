import { aimLimb } from './limb-ik.js';
import {keeperShape,keeperArmScale} from './keeper.js';
import * as THREE from 'three';
import { getPlayerProfile } from './roster.js';
import { gaitPose, bodyLean, strideTempo } from './gait.js';
import { buildImportedHead } from './face.js';

const material = color => new THREE.MeshStandardMaterial({ color, roughness: .85, flatShading: true });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const smooth = n => { const t = clamp(n, 0, 1); return t * t * (3 - 2 * t); };
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

// Cross-sections run from the lowest point to the highest in joint space.
function shapedSegment(parent, rings, depth, mat) {
  const profile = rings.map(([y, radius]) => new THREE.Vector2(radius, y));
  const part = mesh(parent, new THREE.LatheGeometry(profile, 16), mat, 0, 0);
  part.scale.z = depth;
  return part;
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
  kit.flatShading = sock.flatShading = skin.flatShading = false;
  shapedSegment(torso, [[.01, 0], [.01, .168], [.06, .171], [.15, .153],
    [.28, .173], [.39, .204], [.46, .212], [.49, .19], [.53, .098], [.54, .07]],
    .63, kit);
  shapedSegment(torso, [[.132, .157], [.153, .156]], .64, trim);
  shapedSegment(torso, [[.525, .104], [.545, .078], [.548, .067]], .84, trim);
  const head = joint(torso, 0, .72);
  // The imported head is cut at the jaw line; a slim neck cylinder on
  // the torso bridges the collar to the jaw (the model's own long,
  // slanted neck looked wrong against the stylised body).
  mesh(torso, new THREE.CylinderGeometry(.05, .05, .16, 8), skin, 0, .60, -.04);
  addHead(head, profile);
  const keeper=p.slot===0 && !p.role;
  const legScale=keeper?1:.96+.014*(p.slot%6);
  const shoulders=keeper?1:.91+.033*((p.slot+2)%7);
  torso.scale.set(shoulders,1-(legScale-1)*1.15,1);
  pelvis.position.y+= (legScale-1)*(THIGH+SHIN);
  const glove=keeper ? material(0xe7eddd) : null;
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const hip = joint(pelvis, side * .092, 0);
    hip.scale.setScalar(legScale);
    segment(hip, .095, .08, .23, shorts);
    segment(hip, .078, .055, .23, p.role === 'coach' ? shorts : skin, -.345).scale.z = profile.build;
    const knee = joint(hip, 0, -THIGH);
    mesh(knee, new THREE.IcosahedronGeometry(.06, 1), skin, 0, -.005);
    shapedSegment(knee, [[-SHIN, .039], [-.40, .041], [-.29, .047],
      [-.17, .064], [-.11, .068], [-.045, .058], [0, .053]],
      1.08*profile.build, p.role === 'coach' ? shorts : sock);
    const ankle = joint(knee, 0, -SHIN);
    const shoe = mesh(ankle, new THREE.SphereGeometry(.1, 16, 10), boot, 0, -.04, .065);
    shoe.scale.set(.66, .52, 1.45);
    legs.push({ hip, knee, ankle });
    const shoulder = joint(torso, side * .205, .465);
    shoulder.scale.setScalar(keeper ? keeperArmScale({...p,profile}) : .95+.018*(p.slot%7));
    segment(shoulder, .078, .064, .15, kit);
    segment(shoulder, .056, .042, .15, skin, -.225);
    const elbow = joint(shoulder, 0, -.30);
    segment(elbow, .046, .03, .26, skin);
    const hand = mesh(elbow, new THREE.SphereGeometry(keeper?.075:.052,12,8),glove??skin,0,-.285);
    hand.scale.set(keeper?.97:.8,keeper?1.29:1.25,keeper?.63:.65);
    if(keeper){
      segment(elbow,.046,.053,.06,trim,-.23);
      const thumb=mesh(elbow,new THREE.SphereGeometry(.027,8,6),glove,-side*.056,-.277,.02);
      thumb.scale.set(.72,1.45,.75);
      thumb.rotation.z=-side*.42;
    }
    arms.push({ shoulder, elbow, hand, side });
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
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }), 0, .30, -.128);
    number.rotation.y = Math.PI;
  }
  const heightScale = profile.height / 195.5;
  g.scale.setScalar(heightScale);
  return { g, pelvis, torso, head, legs, arms, heightScale, legScale, profile };
}

const limbTarget=new THREE.Vector3(), gloveNormal=new THREE.Vector3();
const elbowPole=new THREE.Vector3(), kneePole=new THREE.Vector3(0,0,1);
const ankleLevel=new THREE.Quaternion();

function poseKickLegs(model, p, side, progress, weight) {
  const { g, pelvis, legs, heightScale } = model;
  const release = p.kickRelease;
  const bearing = release?.angle ?? p.angle;
  const cos = Math.cos(bearing), sin = Math.sin(bearing);
  const lift = (p.jump || 0) * heightScale;
  const plantAcross = -side * .20 * heightScale;
  const plantAhead = .13 * heightScale;
  const plantX = (release?.x ?? p.x) + cos * plantAcross + sin * plantAhead;
  const plantZ = (release?.z ?? p.z) - sin * plantAcross + cos * plantAhead;
  const plant = 1 - smooth((progress - .30) / .47);
  const swing = smooth(progress / .38);
  const strike = legs[side === 1 ? 1 : 0];
  const support = legs[side === 1 ? 0 : 1];

  // The support ankle stays on the release footprint through contact.
  limbTarget.set(plantX, .093 * heightScale + lift, plantZ);
  kneePole.set(-side * .14, 0, 1);
  aimLimb(support.hip, support.knee, SHIN, limbTarget, kneePole, plant);
  ankleLevel.copy(pelvis.quaternion).multiply(support.hip.quaternion).multiply(support.knee.quaternion).invert();
  support.ankle.quaternion.slerp(ankleLevel, plant);

  // Start at the release point, then carry the boot up and across the body.
  limbTarget.set(side * (.11 - swing * .17), .093 + swing * .37, .29 + swing * .13);
  g.localToWorld(limbTarget);
  limbTarget.y = (.093 + swing * .37) * heightScale + lift;
  if (release) {
    const contact = 1 - swing;
    limbTarget.x += (release.ballX + cos * side * .065 - sin * .14 - limbTarget.x) * contact;
    limbTarget.z += (release.ballZ - sin * side * .065 - cos * .14 - limbTarget.z) * contact;
  }
  kneePole.set(side * .20, 0, 1);
  aimLimb(strike.hip, strike.knee, SHIN, limbTarget, kneePole, weight);
  ankleLevel.copy(pelvis.quaternion).multiply(strike.hip.quaternion).multiply(strike.knee.quaternion).invert();
  strike.ankle.quaternion.slerp(ankleLevel, weight);
}

export function posePlayer(model, p, ball, flight) {
  const { g, pelvis, torso, head, legs, arms } = model;
  const speed = p.speed ?? p.running * 4;
  const tempo=strideTempo(p);
  const gait = gaitPose(p.phase, speed, model.heightScale,tempo);
  const keeperActive=ball && p.slot===0 && !p.role && p.action !== 'kick' && (p.keeperReach>.03 || p.action==='parry' || p.action==='catch');
  const keeper=keeperActive?keeperShape(p):null;
  const remaining=flight?.target===p.id && ball && ball.y<1.1 && Math.hypot(ball.x-p.x,ball.z-p.z)<4 ? (1-flight.progress)*flight.duration : Infinity;
  const prepare=clamp(1-remaining/.28,0,1)||0;
  const side=p.receiveSide??1;
  const run = gait.moving;
  const contest = p.contest || 0;
  const phase = p.phase;
  const actionProgress = p.actionDuration ? clamp(1 - (p.actionTime || 0) / p.actionDuration, 0, 1) : 0;
  const absorb = Math.sin(actionProgress * Math.PI);
  const chestTrap = p.action === 'chest' ? absorb : 0;
  const footTrap = ['foot', 'cushion'].includes(p.action) ? absorb : 0;
  const header = p.action === 'header' ? absorb : 0;
  const kick = p.action === 'kick' ? 1 - smooth((actionProgress - .46) / .54) : 0;
  const kickSide = (p.profile ?? model.profile).foot === '左' ? -1 : 1;
  const stumble = p.action === 'stumble' ? absorb : 0;
  // Lower the hips in a run; two small vertical oscillations per complete stride.
  const bounce = keeper ? -keeper.drop : gait.hipOffset-.07*prepare-.095*kick;
  // Arm swing trails the thigh by a short phase lag instead of mirroring it
  // exactly, like a real arm swing lagging behind the leg.
  const ARM_LAG = .6;
  const gaitLag = gaitPose(phase - ARM_LAG, speed, model.heightScale,tempo);
  const thigh=THIGH*model.legScale, shin=SHIN*model.legScale;
  const lagHipAngle = i => {
    const lf = gaitLag.feet[i];
    const fz = lf.z * (p.strideDirection ?? 1), fy = lf.y;
    const down = pelvis.position.y + bounce - fy;
    const reach = clamp(Math.hypot(down, fz), .15, thigh + shin - .003);
    return Math.atan2(-fz, down) - Math.acos(clamp(
      (thigh * thigh + reach * reach - shin * shin) / (2 * thigh * reach), -1, 1));
  };
  g.position.set(p.x, .045 + (bounce + (p.jump || 0)) * model.heightScale, p.z);
  g.rotation.set(0, p.angle, 0, 'YXZ');
  pelvis.position.x=keeper?.shift??(-kickSide * .075 * kick);
  pelvis.rotation.y = Math.sin(phase) * .025 * run * (1-kick) - kickSide * .12 * kick;
  pelvis.rotation.z = Math.cos(phase) * .012 * run * (1-kick);
  const lean = bodyLean(speed, p.turnRate || 0, p.accel || 0);
  torso.rotation.x = (.055 + gait.sprint * .12) * run + lean.pitch + (p.action === 'shield' ? .12 : .20) * contest - chestTrap * .24 + header * .32 + stumble * .35;
  torso.rotation.y = -Math.sin(phase) * .10 * run + (p.action === 'shield' ? .34 * contest : 0);
  torso.rotation.z = Math.sin(phase) * .015 * run + stumble * .15 + lean.roll;
  torso.rotation.x += (.09 - torso.rotation.x) * kick;
  torso.rotation.y += (-kickSide * .28 - torso.rotation.y) * kick + side*(prepare*.18+footTrap*.22);
  torso.rotation.z += (kickSide * .14 - torso.rotation.z) * kick;
  head.rotation.x = -torso.rotation.x * .65 + header * .25;
  head.rotation.y = -torso.rotation.y * .5;
  if (ball && !p.fallAmount && p.action !== 'celebrate' && p.action !== 'highfive') {
    const dx = ball.x-p.x, dz = ball.z-p.z;
    const distance = Math.hypot(dx,dz);
    // A player can glance across a shoulder. Targets directly behind the
    // back fade out so crossing that seam cannot snap the head side to side.
    const bearing = Math.atan2(dx,dz)-p.angle;
    head.rotation.y += .65*Math.sin(bearing)*Math.min(1,distance);
    head.rotation.x -= .38*Math.atan2(ball.y-1.65,Math.max(2,distance));
  }
  for (let i = 0; i < 2; i++) {
    const foot = gait.feet[i];
    let footZ = foot.z * (p.strideDirection ?? 1);
    let footY = foot.y;
    const planted=arms[i].side!==side ? Math.max(footTrap,prepare) : 0;
    footZ+=( -.11-footZ)*planted;
    footY+=( .095-footY)*planted;
    if (p.action === 'tackle' && i === 1) {
      footZ += contest * .38;
      footY += contest * .075;
    }
    if (arms[i].side === side && footTrap > 0) {
      footZ += footTrap * (.40 - actionProgress * .17);
      footY += footTrap * (p.action === 'cushion' ? .43 : .07);
    }
    const down = pelvis.position.y + bounce - footY;
    const reach = clamp(Math.hypot(down, footZ), .15, thigh + shin - .003);
    // Two-bone inverse kinematics keeps the supporting boot close to the ground.
    const hipAngle = Math.atan2(-footZ, down) - Math.acos(clamp(
      (thigh * thigh + reach * reach - shin * shin) / (2 * thigh * reach), -1, 1));
    const kneeAngle = Math.PI - Math.acos(clamp(
      (thigh * thigh + shin * shin - reach * reach) / (2 * thigh * shin), -1, 1));
    legs[i].hip.rotation.x = hipAngle;
    legs[i].hip.rotation.y = arms[i].side === side ? side*footTrap*.65 : 0;
    const cut=clamp(p.turnRate||0,-3,3)*.038*run;
    legs[i].hip.rotation.z = arms[i].side*.035*contest+(foot.stance?cut:0);
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
    if (kick > 0) {
      const arm = arms[i];
      const balance = arm.side === kickSide;
      arm.shoulder.rotation.x += ((balance ? .36 : -.65) - arm.shoulder.rotation.x) * kick;
      arm.shoulder.rotation.y *= 1 - kick;
      arm.shoulder.rotation.z += (arm.side * (balance ? .45 : .82) - arm.shoulder.rotation.z) * kick;
      arm.elbow.rotation.x += ((balance ? -.46 : -.79) - arm.elbow.rotation.x) * kick;
    }
  }
  // Idle life: breathing, weight shifting and small arm/head drift so
  // standing players never freeze like mannequins.
  const idleT = p.animTime || 0, idleAmt = (1 - run) * (1 - kick);
  if (idleAmt > 0) {
    torso.rotation.x += Math.sin(idleT * 1.5) * .008 * idleAmt;
    torso.rotation.z += Math.sin(idleT * .8 + 1.2) * .008 * idleAmt;
    head.rotation.y += Math.sin(idleT * .45 + (p.id || 0) * 1.7) * .06 * idleAmt;
    for (let i = 0; i < 2; i++) {
      arms[i].shoulder.rotation.z += arms[i].side * Math.sin(idleT * 1.1 + i * 2.4) * .025 * idleAmt;
      arms[i].elbow.rotation.x += Math.sin(idleT * 1.3 + i * 1.1) * .03 * idleAmt;
    }
  }
  if (kick > 0) {
    poseKickLegs(model, p, kickSide, actionProgress, kick);
  } else if (keeper) {
    pelvis.rotation.set(0,0,0);
    torso.rotation.set(keeper.pitch,0,keeper.roll);
    const crouch=Math.min(1,(p.keeperLow||0)*1.6);
    for(let i=0;i<2 && crouch>0;i++){
      const side=arms[i].side, leg=legs[i];
      const across=side*(.18+.19*crouch);
      const ahead=.07+side*(p.keeperDive||0)*.12;
      limbTarget.set(p.x+Math.cos(p.angle)*across+Math.sin(p.angle)*ahead,
        .14+(p.jump||0)*model.heightScale,p.z-Math.sin(p.angle)*across+Math.cos(p.angle)*ahead);
      kneePole.set(side*.55,0,1);
      aimLimb(leg.hip,leg.knee,SHIN,limbTarget,kneePole,crouch);
      ankleLevel.copy(leg.hip.quaternion).multiply(leg.knee.quaternion).invert();
      leg.ankle.quaternion.slerp(ankleLevel,crouch);
    }
    const parry=p.action==='parry', caught=p.action==='catch';
    const blend=parry ? Math.min(1,3*p.actionTime/p.actionDuration) : caught?1:p.keeperReach;
    for (const arm of arms) {
      const primary=arm.side===(p.saveSide??Math.sign(p.keeperDive));

      if(parry){
        limbTarget.set(p.saveX,p.saveY,p.saveZ);
      }else limbTarget.set(ball.x,ball.y,ball.z);
      arm.shoulder.getWorldPosition(gloveNormal);
      gloveNormal.sub(limbTarget).normalize();
      limbTarget.addScaledVector(gloveNormal,.10);
      elbowPole.set(arm.side*.65,-1,-.4);
      aimLimb(arm.shoulder,arm.elbow,.285,limbTarget,elbowPole,blend*(parry&&!primary?.18:1));
    }
  } else if(ball && (footTrap>.001 || prepare>0) && !p.fallAmount){
    const localSide=(ball.x-p.x)*Math.cos(p.angle)-(ball.z-p.z)*Math.sin(p.angle);
    const useSide=footTrap>0?side:(Math.sign(localSide)||side);
    const leg=legs[useSide===1?1:0];
    // Contact the inside edge of the boot; the ankle sits just behind it.
    limbTarget.set(ball.x+Math.cos(p.angle)*useSide*.10-Math.sin(p.angle)*.11,
      Math.max(.13,Math.min(.72,ball.y)),ball.z-Math.sin(p.angle)*useSide*.10-Math.cos(p.angle)*.11);
    const touch=footTrap>0 ? Math.min(1,actionProgress/.20,(1-actionProgress)/.18) : .55*prepare;
    kneePole.set(useSide*.12,0,1);
    aimLimb(leg.hip,leg.knee,SHIN,limbTarget,kneePole,touch);
    ankleLevel.copy(leg.hip.quaternion).multiply(leg.knee.quaternion).invert();
    leg.ankle.quaternion.slerp(ankleLevel,touch);
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
