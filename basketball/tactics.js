// Each player maintains an independent intention. The team shape is a guide,
// not a fixed set of targets; on-ball pressure, cuts, help defense and spacing
// all change where players try to move.
import { COURT } from './simulation.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const SPOTS = [
  {depth: 7.9, z: 0}, {depth: 6.5, z: -5.0},
  {depth: 6.5, z: 5.0}, {depth: 3.9, z: -3.1},
  {depth: 3.9, z: 3.1},
];
const COURT_X = COURT.length / 2 - .7;
const COURT_Z = COURT.width / 2 - .7;

export function resetIntent(match) {
  for (const p of match.players) {
    p.thinkIn = 0;
    p.plan = 'transition';
    p.intent = 'transition';
    p.targetX = p.x;
    p.targetZ = p.z;
    p.variation = ((p.id * .173 + .13) % 1) * 2 - 1;
  }
}

// An opponent is truly open if the passing lane is not occupied, not just if
// the defender assigned to the receiver happens to be far away.
function laneClearance(match, from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const len2 = Math.max(.01, dx * dx + dz * dz);
  let clearance = 10;
  for (const defender of match.players) {
    if (defender.team === from.team) continue;
    const t = clamp(((defender.x - from.x) * dx + (defender.z - from.z) * dz) / len2, 0, 1);
    const px = from.x + t * dx, pz = from.z + t * dz;
    clearance = Math.min(clearance, Math.hypot(defender.x - px, defender.z - pz) + (t < .1 || t > .9 ? .3 : 0));
  }
  return clearance;
}

export function chooseReceiver(match, from) {
  const hoop = match.basket(from.team);
  const choices = match.players.filter(p => p.team === from.team && p !== from);
  return choices.map(p => {
    const closest = match.nearestDefender(p);
    const openness = distance(p, closest);
    const lane = laneClearance(match, from, p);
    const progress = Math.max(0, 10 - distance(p, hoop));
    const reach = distance(from, p);
    const score = Math.min(4, openness) * 1.5 + Math.min(3, lane) * 1.4
      + progress * .3 - Math.abs(reach - 6) * .11
      + Math.sin(match.elapsed * .4 + p.id * 2.3) * .4
      + match.random() * .12;
    return {p, score};
  }).sort((a, b) => b.score - a.score)[0].p;
}

function offensePlan(match, p, holder) {
  const sign = match.direction(p.team);
  const spot = SPOTS[p.slot];
  // Possession of the ball is a role; player identity/slot does not dictate it.
  if (p === match.owner) {
    const gap = distance(p, match.nearestDefender(p));
    const range = distance(p, match.basket(p.team));
    const availableDrive = gap > 1.55 && range > 3.2 && match.shotClock > 4;
    const chance = (match.random() + p.slot * .14) % 1;
    p.plan = availableDrive && chance < .54 ? 'drive' : 'probe';
    if (p.plan === 'drive') {
      p.targetX = sign * (COURT.basketX - Math.max(2.4, range - (2.8 + chance * 2.1)));
      // Advance along one side of the lane rather than all holders taking
      // the same central corridor.
      p.targetZ = clamp(p.z * .62 + p.variation * 1.2, -3.1, 3.1);
    } else {
      p.targetX = sign * (COURT.basketX - clamp(range, 4.5, 7.6));
      p.targetZ = clamp(p.z + Math.sin(match.elapsed * .65 + p.id) * 1.55, -5.25, 5.25);
    }
    p.intent = p.plan;
    p.thinkIn = .9 + chance * .85;
    return;
  }

  const selection = (match.random() + p.slot * .19 + Math.sin(p.id) * .09 + 2) % 1;
  const availableCut = match.players.filter(other => other.team === p.team && other.plan === 'cut').length < 1;
  const ballZ = holder?.z ?? 0;
  if (availableCut && selection < .2 && match.possessionAge > 1.8) {
    p.plan = 'cut';
    p.targetX = sign * (COURT.basketX - 1.6);
    p.targetZ = clamp(p.variation * 1.3, -2.2, 2.2);
    p.thinkIn = 2.8;
  } else if (holder && selection < .34 && p.slot !== 0) {
    p.plan = 'screen';
    p.targetX = clamp(holder.x + sign * 1.8, -COURT_X, COURT_X);
    p.targetZ = clamp(ballZ + (p.slot % 2 ? -2.0 : 2.0), -COURT_Z, COURT_Z);
    p.thinkIn = 2.4;
  } else {
    p.plan = selection < .65 ? 'space' : 'relocate';
    const spread = p.slot === 0 ? 1.7 : p.slot > 2 ? 1.1 : .65;
    p.targetX = sign * (COURT.basketX - spot.depth + (selection - .5) * spread);
    p.targetZ = clamp(spot.z + p.variation * .9
      + (p.plan === 'relocate' ? (p.slot % 2 ? -1.05 : 1.05) : 0), -COURT_Z, COURT_Z);
    // Fill the vacant side instead of crowding the ball carrier.
    if (holder && Math.abs(p.targetZ - holder.z) < 1.5 && Math.abs(p.targetX - holder.x) < 3) {
      p.targetZ = clamp(p.targetZ + (p.slot % 2 ? -2.2 : 2.2), -COURT_Z, COURT_Z);
    }
    p.thinkIn = 1.5 + selection * 2.1;
  }
  p.intent = p.plan;
}

function defensePlan(match, p, holder, onBallId, helpId) {
  const attacker = match.players[match.possession * 5 + p.slot];
  const basket = match.basket(match.possession);
  const sign = match.direction(match.possession);
  const choice = (match.random() + p.id * .13) % 1;
  if (holder && p.id === onBallId) {
    p.plan = 'contain';
    const toHoopX = Math.sign(basket.x - holder.x);
    p.targetX = clamp(holder.x + toHoopX * 1.75, -COURT_X, COURT_X);
    p.targetZ = clamp(holder.z + (holder.z > 0 ? -.35 : .35), -COURT_Z, COURT_Z);
    p.thinkIn = .33;
  } else if (holder && p.id === helpId && distance(holder, basket) < 8.5) {
    p.plan = 'help';
    p.targetX = clamp(basket.x - sign * (2.5 + choice), -COURT_X, COURT_X);
    p.targetZ = clamp(holder.z * .45 + p.variation * 1.2, -COURT_Z, COURT_Z);
    p.thinkIn = .6;
  } else {
    // Shade the receiver's passing lane while preserving a gap. Defenders
    // deliberately do not use the same coordinates as their assignments.
    p.plan = choice < .3 ? 'deny' : 'mark';
    const gain = p.plan === 'deny' ? .45 : .75;
    p.targetX = clamp(attacker.x + sign * (1.4 + gain), -COURT_X, COURT_X);
    p.targetZ = clamp(attacker.z + (basket.z - attacker.z) * .12 + p.variation * .65,
      -COURT_Z, COURT_Z);
    p.thinkIn = .65 + choice * .75;
  }
  p.intent = p.plan;
}

export function updateMovement(match, dt) {
  const holder = match.owner || (match.flight?.kind === 'pass' ? match.players[match.flight.from] : null);
  const defenders = match.players.filter(p => p.team !== match.possession);
  const onBallId = holder ? [...defenders].sort((a,b) => distance(a,holder) - distance(b,holder))[0].id : -1;
  const helpId = holder ? [...defenders].filter(p => p.id !== onBallId)
    .sort((a,b) => distance(a,match.basket(match.possession)) - distance(b,match.basket(match.possession)))[0].id : -1;

  for (const p of match.players) {
    p.thinkIn -= dt;
    // The defender containing the ball continuously adjusts, others have
    // asynchronous, player-specific decision intervals.
    if (p.thinkIn <= 0 || (p.team !== match.possession && p.plan === 'contain' && p.id !== onBallId)) {
      if (p.team === match.possession) offensePlan(match, p, holder);
      else defensePlan(match, p, holder, onBallId, helpId);
    }
  }

  // Accelerated steering rather than teleporting to straight-line waypoints.
  // Repulsion is evaluated before integration so it changes the movement path.
  const next = [];
  for (const p of match.players) {
    let dx = p.targetX - p.x, dz = p.targetZ - p.z;
    const gap = Math.hypot(dx,dz);
    if (gap > .02) {dx /= gap; dz /= gap;}
    else {dx = dz = 0;}
    let sx = 0, sz = 0;
    for (const other of match.players) {
      if (other === p) continue;
      const deltaX = p.x - other.x, deltaZ = p.z - other.z;
      const length = Math.hypot(deltaX, deltaZ);
      const preferred = other.team === p.team ? 1.85 : 1.35;
      if (length >= preferred) continue;
      const strength = ((preferred - length) / preferred) ** 2;
      const deterministicAngle = (p.id * 2.53 + other.id * .41);
      sx += (length > .01 ? deltaX / length : Math.cos(deterministicAngle)) * strength * 2.8;
      sz += (length > .01 ? deltaZ / length : Math.sin(deterministicAngle)) * strength * 2.8;
    }
    // Per-player speed and acceleration make some sprint, some shuffle and
    // others pause to present for the pass.
    const pace = 2.5 + (p.slot === 0 ? .23 : 0) + (p.id % 3) * .23;
    const speedCap = p === match.owner ? 2.35 : p.plan === 'cut' ? pace + .65 : pace;
    const desiredSpeed = Math.min(speedCap, Math.sqrt(2 * 4.2 * gap));
    let wantX = dx * desiredSpeed + sx * 2.0;
    let wantZ = dz * desiredSpeed + sz * 2.0;
    const wantLength = Math.hypot(wantX,wantZ);
    if (wantLength > speedCap) {wantX *= speedCap/wantLength;wantZ *= speedCap/wantLength;}
    const ax = wantX - p.vx, az = wantZ - p.vz;
    const amount = Math.min(1, 5.1 * dt / Math.max(.001, Math.hypot(ax,az)));
    const vx = p.vx + ax * amount, vz = p.vz + az * amount;
    next.push({x: clamp(p.x + vx*dt,-COURT_X,COURT_X),
      z: clamp(p.z + vz*dt,-COURT_Z,COURT_Z),vx,vz});
  }
  for (let i=0;i<match.players.length;i++) {
    const p=match.players[i], n=next[i];
    p.x=n.x;p.z=n.z;p.vx=n.vx;p.vz=n.vz;
  }
  // Guarantee personal space. Both teammates and opponents are kept apart
  // even when their tactical targets cross in a congested lane.
  for (let round=0;round<2;round++) for(let i=0;i<match.players.length;i++) {
    const a=match.players[i];
    for(let j=i+1;j<match.players.length;j++) {
      const b=match.players[j];
      const minGap=a.team===b.team?1.38:1.17;
      const dx=b.x-a.x,dz=b.z-a.z;
      const d=Math.hypot(dx,dz);
      if(d>=minGap)continue;
      const theta=(i*1.9+j*2.7), nx=d>.001?dx/d:Math.cos(theta),nz=d>.001?dz/d:Math.sin(theta);
      const push=(minGap-d)*.505;
      a.x=clamp(a.x-nx*push,-COURT_X,COURT_X);
      a.z=clamp(a.z-nz*push,-COURT_Z,COURT_Z);
      b.x=clamp(b.x+nx*push,-COURT_X,COURT_X);
      b.z=clamp(b.z+nz*push,-COURT_Z,COURT_Z);
    }
  }
  for(const p of match.players) {
    // Use final displacement rather than requested speed to animate the feet.
    // Collision correction is generally small; apply a smoothed speed cap.
    p.speed = Math.min(3.8, Math.hypot(p.vx,p.vz));
    p.phase += p.speed * dt * 5.4;
    p.actionTime=Math.max(0,p.actionTime-dt);
    if(p.actionTime===0)p.action=p===match.owner?'dribble':'idle';
  }
}
