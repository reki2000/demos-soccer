import { strideFrequency } from './gait.js';

export const countries = [
 {id:'japan',name:'日本',english:'JAPAN',code:'JPN',flag:'🇯🇵',shirt:0x245cde,shorts:0xf4f1e5},
 {id:'brazil',name:'ブラジル',english:'BRAZIL',code:'BRA',flag:'🇧🇷',shirt:0xf4d44b,shorts:0x234faf},
 {id:'france',name:'フランス',english:'FRANCE',code:'FRA',flag:'🇫🇷',shirt:0x253875,shorts:0xf4f1e5},
 {id:'argentina',name:'アルゼンチン',english:'ARGENTINA',code:'ARG',flag:'🇦🇷',shirt:0x9edbf0,shorts:0x222c36},
 {id:'england',name:'イングランド',english:'ENGLAND',code:'ENG',flag:'🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',shirt:0xf1f0e6,shorts:0x24365e},
 {id:'germany',name:'ドイツ',english:'GERMANY',code:'GER',flag:'🇩🇪',shirt:0xeeeade,shorts:0x20252a},
 {id:'spain',name:'スペイン',english:'SPAIN',code:'ESP',flag:'🇪🇸',shirt:0xb52c37,shorts:0x233464},
 {id:'portugal',name:'ポルトガル',english:'PORTUGAL',code:'POR',flag:'🇵🇹',shirt:0xb63737,shorts:0x29634c}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const formations={
 '4-3-3':[[-49,0],[-32,-24],[-34,-8],[-34,8],[-32,24],[-12,-18],[-17,0],[-12,18],[10,-24],[16,0],[10,24]],
 '4-4-2':[[-49,0],[-32,-24],[-34,-8],[-34,8],[-32,24],[-10,-25],[-14,-8],[-14,8],[-10,25],[14,-11],[14,11]],
 '3-5-2':[[-49,0],[-33,-20],[-36,0],[-33,20],[-9,-28],[-14,-13],[-18,0],[-14,13],[-9,28],[14,-10],[14,10]]
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Match {
  constructor(onEvent = () => {}, random = Math.random) {
    this.onEvent = onEvent;
    this.random = random;
    this.settings = [
      { formation: '4-3-3', tactic: 'balanced' },
      { formation: '4-3-3', tactic: 'balanced' },
    ];
    this.reset();
  }

  direction(team) {
    return (team === 0 ? 1 : -1) * (this.half === 1 ? 1 : -1);
  }

  reset() {
    this.time = 0;
    this.half = 1;
    this.score = [0, 0];
    this.shots = [0, 0];
    this.passes = [0, 0];
    this.possession = [.1, .1];
    this.ended = false;
    this.celebration = null;
    this.lastTouchPlayer = 9;
    this.pause = 0;
    this.restart = null;
    this.duel = null;
    this.control = null;
    this.aerials = [0, 0];
    this.fouls = [0, 0];
    this.miscontrols = [0, 0];
    this.throwIns = [0, 0];
    this.loose = null;
    this.setPiece = null;
    this.lastTouch = 0;
    this.duels = [0, 0];
    this.cooldown = 1;
    this.ball = { x: 0, z: 0, y: .15 };
    this.flight = null;
    this.players = Array.from({ length: 22 }, (_, id) => ({
      id, team: id < 11 ? 0 : 1, slot: id % 11,
      x: 0, z: 0, vx: 0, vz: 0, speed: 0, turnRate: 0, angle: 0, running: 0, phase: id * .8,
      decisionIn: this.random() * 1.4, intent: null,
      pace: .91 + this.random() * .18, personality: this.random(),
      tackleCooldown: 0, action: 'idle', contest: 0,
      actionTime: 0, actionDuration: 0, jump: 0, fall: null, fallAmount: 0, fallRecover: 0, keeperReach: 0, keeperDive: 0,
    }));
    this.kickoff(0);
  }

  kickoff(team) {
    for (const p of this.players) {
      const f = formations[this.settings[p.team].formation][p.slot];
      const dir = this.direction(p.team);
      p.x = (p.slot === 0 ? f[0] : Math.min(-3, f[0] - 12)) * dir;
      p.z = f[1] * dir;
      // Defending players must start outside the centre circle.
      if (p.team !== team && p.slot !== 0 && Math.hypot(p.x, p.z) < 9.15) {
        p.x = -9.5 * dir;
      }
      p.angle = Math.atan2(dir, 0);
      p.running = 0;
      p.speed = 0;
      p.vx = p.vz = 0;
      p.intent = { x: p.x, z: p.z, role: 'hold' };
      p.decisionIn = .15 + this.random() * 1.25;
      p.action = 'idle';
      p.fall = null; p.fallAmount = 0; p.fallRecover = 0;
      p.actionTime = 0;
      p.jump = 0;
      p.contest = 0;
      p.tackleCooldown = 0;
    }
    this.duel = null;
    this.control = null;
    this.loose = null;
    this.setPiece = null;
    this.lastTouch = team;
    this.owner = this.players[team * 11 + 9];
    this.lastTouchPlayer = this.owner.id;
    this.owner.x = -.8 * this.direction(team);
    this.owner.z = 0;
    this.ball = { x: 0, z: 0, y: .15 };
    this.flight = null;
    this.cooldown = 1.2;
  }

  stopForRestart(type, team, seconds, spot = null) {
    this.pause = seconds;
    this.restart = { type, team, spot };
    this.loose = null;
    this.setPiece = null;
    this.owner = null;
    this.flight = null;
    this.duel = null;
    this.control = null;
    this.players.forEach(p => { p.running = 0; p.speed = 0; p.vx = p.vz = 0; p.action = 'idle'; p.actionTime = 0; p.jump = 0; p.contest = 0; p.fall = null; p.fallAmount = 0; p.fallRecover = 0; });
  }

  resumeRestart() {
    const { type, team, spot } = this.restart;
    this.restart = null;
    if (type === 'halftime') {
      this.half = 2;
      this.kickoff(1);
      this.onEvent('SECOND HALF', '陣地を交代して、後半キックオフ');
    } else if (type === 'kickoff') {
      this.kickoff(team);
    } else if (['throwIn', 'freeKick', 'corner'].includes(type)) {
      this.beginSetPiece(type, team, spot);
    } else {
      this.beginSetPiece('goalKick', team, { x: -47 * this.direction(team), z: 0 });
    }
  }

  kick(target, shot = false, header = false, incomingSpeed = 18) {
    const p = this.owner;
    if (!p) return;
    const dir = this.direction(p.team);
    const range = shot ? 0 : distance(p, target);
    const lead = header ? 0 : Math.min(1.1, range / 24);
    const through = !shot && !header && (target.slot >= 8 || this.settings[p.team].tactic === 'counter')
      && this.random() < .55 ? 3 + this.random() * 5 : 0;
    const error = header ? .6 : .35 + range * .055;
    const tx = shot ? dir * 54 : target.x + (target.vx || 0) * lead + dir * through + (this.random() - .5) * error;
    const tz = shot ? (this.random() - .5) * 9 : target.z + (target.vz || 0) * lead + (this.random() - .5) * error;
    this.lastTouch = p.team;
    this.lastTouchPlayer = p.id;
    this.loose = null;
    if (!header && p.action !== 'throw') this.animateAction(p, 'kick', .35);
    const length = Math.hypot(tx - this.ball.x, tz - this.ball.z);
    const peak = header ? .15 : shot ? .7 + length * .035 : length > 20 ? Math.min(9, 1.8 + (length - 20) * .25) : .3 + length * .025;
    this.flight = {
      from: p.team, passer: p.id, target: shot ? null : target.id,
      x: this.ball.x, z: this.ball.z, tx, tz, progress: 0,
      duration: length / (shot ? (header ? 21 : 31) : peak > 2.5 ? 18 : 24),
      startY: this.ball.y, peak, lofted: peak > 2.5, shot, header, speculative: through > 0,
    };
    if (header) {
      // A header redirects only part of the incoming energy; gravity then brings it down.
      const outgoingSpeed = clamp((Number.isFinite(incomingSpeed) ? incomingSpeed : 18) * .38, 4, 9);
      this.flight.vx = (tx - this.ball.x) / Math.max(length, .1) * outgoingSpeed;
      this.flight.vz = (tz - this.ball.z) / Math.max(length, .1) * outgoingSpeed;
      this.flight.vy = .4;
      this.flight.elapsed = 0;
      this.flight.duration = (.4 + Math.sqrt(.16 + 19.6 * Math.max(.01, this.ball.y - .15))) / 9.8;
    }
    if (shot) {
      this.shots[p.team]++;
      this.onEvent(header ? 'HEADER' : 'SHOT', header ? 'ヘディングシュート！' : 'シュート！');
    }
    this.owner = null;
    this.cooldown = .6;
  }

  update(dt) {
    if (this.ended || !Number.isFinite(dt) || dt <= 0) return;
    this.updateFalls(dt);
    if (this.celebration) { this.updateCelebration(dt); return; }
    if (this.pause > 0) {
      this.pause = Math.max(0, this.pause - dt);
      if (this.pause === 0) this.resumeRestart();
      return;
    }
    this.time += dt * 12;
    if (this.half === 1 && this.time >= 2700) {
      this.time = 2700;
      this.stopForRestart('halftime', 1, 3);
      this.onEvent('HALF TIME', '前半終了 · まもなく後半へ');
      return;
    }
    if (this.time >= 5400) {
      this.time = 5400;
      this.ended = true;
      this.duel = null;
    this.control = null;
    this.players.forEach(p => { p.running = 0; p.speed = 0; p.vx = p.vz = 0; p.action = 'idle'; p.actionTime = 0; p.jump = 0; p.contest = 0; p.fall = null; p.fallAmount = 0; p.fallRecover = 0; });
      this.onEvent('FULL TIME', '試合終了');
      return;
    }
    this.cooldown -= dt;
    if (this.setPiece) { this.updateSetPiece(dt); return; }
    const controlling = this.owner?.team ?? this.flight?.from ?? this.lastTouch;
    if (!this.loose) this.possession[controlling] += dt;
    this.movePlayers(dt, controlling);
    if (this.control) this.updateControl(dt);
    else if (this.duel) this.updateDuel(dt);
    else if (this.owner) this.updateOwner(dt);
    else if (this.flight) this.updateFlight(dt);
    else if (this.loose) this.updateLoose(dt);
    if (!this.pause) this.checkBoundary();
  }

  updateFalls(dt) {
    const smooth = n => { const x = clamp(n, 0, 1); return x * x * (3 - 2 * x); };
    for (const p of this.players) {
      if (!p.fall) continue;
      p.fall.elapsed += dt;
      const t = p.fall.elapsed;
      p.fallAmount = t < .55 ? smooth(t / .55) : t < 1.8 ? 1 : 1 - smooth((t - 1.8) / 1.4);
      p.fallRecover = clamp((t - 1.8) / 1.4, 0, 1);
      p.speed = p.running = 0;
      if (t >= 3.2) {
        p.fall = null;
        p.fallAmount = p.fallRecover = 0;
        p.action = 'idle';
      }
    }
  }

  restartPosition(p, restartingTeam) {
    const f = formations[this.settings[p.team].formation][p.slot];
    const dir = this.direction(p.team);
    let x = (p.slot === 0 ? f[0] : Math.min(-3, f[0] - 12)) * dir;
    const z = f[1] * dir;
    if (p.id === restartingTeam * 11 + 9) return { x: -.8 * dir, z: 0 };
    if (p.team !== restartingTeam && p.slot !== 0 && Math.hypot(x, z) < 9.15) x = -9.5 * dir;
    return { x, z };
  }

  startCelebration(team, restartingTeam) {
    const scorer = this.players[this.lastTouchPlayer]?.team === team
      ? this.players[this.lastTouchPlayer] : this.players[team * 11 + 9];
    const friends = this.players.filter(p => p.team === team && p !== scorer && p.slot !== 0)
      .sort((a, b) => distance(a, scorer) - distance(b, scorer)).slice(0, 3).map(p => p.id);
    this.stopForRestart('kickoff', restartingTeam, 0);
    const laneSide = scorer.z >= 0 ? 1 : -1;
    // One fixed destination: the corner arc on the scorer's side. The old
    // code re-aimed at a point relative to the scorer every frame, so the
    // "target" kept escaping sideways and scorers drifted diagonally
    // toward the touchline instead of running a celebration line.
    const target = { x: this.direction(team) * 46.5, z: laneSide * 29 };
    this.celebration = { team, restartingTeam, scorer: scorer.id, friends, elapsed: 0, phase: 'celebrate', laneSide, target };
    scorer.action = 'celebrate';
  }

  walkTo(p, target, speed, dt) {
    const dx = target.x - p.x, dz = target.z - p.z, gap = Math.hypot(dx, dz);
    const move = Math.min(gap, speed * dt);
    p.speed = dt > 0 ? move / dt : 0;
    p.running = clamp(p.speed / 4, 0, 1);
    if (gap > .001) {
      p.x += dx / gap * move;
      p.z += dz / gap * move;
      p.angle = Math.atan2(dx, dz);
    }
    p.phase += dt * Math.PI * 2 * strideFrequency(p.speed);
    p.animTime = (p.animTime || 0) + dt;
    return gap < .25;
  }

  updateCelebration(dt) {
    const c = this.celebration;
    c.elapsed += dt;
    const scorer = this.players[c.scorer];
    if (c.phase === 'celebrate') {
      const arrived = this.walkTo(scorer, c.target ?? { x: this.direction(c.team) * 46.5, z: c.laneSide * 29 }, 2.6, dt);
      if (arrived) { scorer.speed = 0; scorer.running = 0; }
      scorer.action = 'celebrate';
      scorer.jump = 0;
      for (const p of this.players) {
        if (p === scorer) continue;
        const index = c.friends.indexOf(p.id);
        if (index >= 0) {
          const side = index === 0 ? 1.05 : index === 1 ? -1.1 : 1.6;
          const behind = index === 0 ? .05 : index === 1 ? -.4 : -1.3;
          const target = {
            x: scorer.x + Math.cos(scorer.angle) * side + Math.sin(scorer.angle) * behind,
            z: scorer.z - Math.sin(scorer.angle) * side + Math.cos(scorer.angle) * behind,
          };
          this.walkTo(p, target, 6.2, dt);
          if (distance(p, scorer) < 2.4) {
            p.angle = scorer.angle;
            p.action = index === 0 ? 'highfive' : 'celebrate';
          }
        } else if (p.team !== c.team) {
          this.walkTo(p, this.restartPosition(p, c.restartingTeam), 3, dt);
        }
      }
      if (c.elapsed >= 5.5) {
        c.phase = 'return';
        c.elapsed = 0;
        this.ball = { x: 0, z: 0, y: .15 };
        this.players.forEach(p => { p.action = 'idle'; p.jump = 0; });
      }
      return;
    }
    let allReady = true;
    for (const p of this.players) {
      const ready = this.walkTo(p, this.restartPosition(p, c.restartingTeam), 5.8 * p.pace, dt);
      if (!ready) allReady = false;
      if (p.slot === 0) p.angle = Math.atan2(this.direction(p.team), 0);
    }
    if (allReady) {
      const team = c.restartingTeam;
      this.celebration = null;
      this.restart = null;
      this.kickoff(team);
      this.onEvent('KICK OFF', '両チームが陣地に戻り、試合再開');
    }
  }

  releaseLoose(vx, vz, vy, team) {
    this.owner = null;
    this.flight = null;
    this.control = null;
    this.duel = null;
    this.lastTouch = team;
    this.loose = { vx, vz, vy, age: 0 };
    for (const p of this.players) p.decisionIn = Math.min(p.decisionIn, .2);
  }

  updateLoose(dt) {
    const loose = this.loose;
    loose.age += dt;
    this.ball.x += loose.vx * dt;
    this.ball.z += loose.vz * dt;
    loose.vy -= 9.8 * dt;
    this.ball.y += loose.vy * dt;
    if (this.ball.y < .15) {
      this.ball.y = .15;
      loose.vy = Math.abs(loose.vy) > .9 ? -loose.vy * .38 : 0;
    }
    const drag = Math.exp(-dt * (this.ball.y <= .16 ? 1.1 : .1));
    loose.vx *= drag;
    loose.vz *= drag;
    if (this.checkBoundary()) return;
    if (loose.age < .22 || this.ball.y > .9) return;
    const winner = this.players.filter(p => distance(p, this.ball) < 1.15)
      .sort((a, b) => distance(a, this.ball) - distance(b, this.ball))[0];
    if (winner) this.startControl(winner, this.ball.y > .65 ? 'cushion' : 'foot');
  }

  checkBoundary() {
    if (this.pause || this.setPiece || this.celebration) return false;
    const b = this.ball;
    // The whole ball must cross the line.
    if (Math.abs(b.z) > 34.11) {
      const team = 1 - this.lastTouch;
      this.throwIns[team]++;
      this.stopForRestart('throwIn', team, 1.2, { x: clamp(b.x, -51, 51), z: Math.sign(b.z) * 34.3 });
      this.onEvent('THROW IN', 'タッチラインを割ってスローイン');
      return true;
    }
    if (Math.abs(b.x) <= 52.61) return false;
    const end = Math.sign(b.x);
    const attacking = this.direction(0) === end ? 0 : 1;
    const defending = 1 - attacking;
    if (Math.abs(b.z) < 3.55 && b.y < 2.33) {
      this.score[attacking]++;
      this.startCelebration(attacking, defending);
      this.onEvent('GOAL!', `${attacking === 0 ? 'HOME' : 'AWAY'} のゴール！`);
    } else if (this.lastTouch === defending) {
      this.stopForRestart('corner', attacking, 1.5, { x: end * 52, z: (b.z < 0 ? -1 : 1) * 33.5 });
      this.onEvent('CORNER KICK', 'コーナーキック');
    } else {
      this.stopForRestart('goalKick', defending, 1.5);
      this.onEvent('GOAL KICK', 'ゴールキック');
    }
    return true;
  }

  beginSetPiece(type, team, spot) {
    const taker = type === 'goalKick' ? this.players[team * 11] : this.players.filter(p => p.team === team && p.slot !== 0)
      .sort((a, b) => distance(a, spot) - distance(b, spot))[0];
    taker.x = spot.x;
    taker.z = spot.z;
    taker.vx = taker.vz = 0;
    const targets = this.players.filter(p => p.team === team && p !== taker && p.slot !== 0)
      .sort((a, b) => type === 'goalKick' ? Math.abs(distance(a, spot) - 27) - Math.abs(distance(b, spot) - 27)
        : distance(a, spot) - distance(b, spot));
    const target = targets[0];
    const shoot = type === 'freeKick' && 52.5 - spot.x * this.direction(team) < 30 && Math.abs(spot.z) < 22;
    const aim = shoot ? { x: 54 * this.direction(team), z: 0 } : target;
    const dx = aim.x - spot.x, dz = aim.z - spot.z, length = Math.max(.01, Math.hypot(dx, dz));
    const direction = { x: dx / length, z: dz / length };
    taker.angle = type === 'throwIn' ? (spot.z > 0 ? Math.PI : 0) : Math.atan2(direction.x, direction.z);
    this.owner = taker;
    this.lastTouch = team;
    this.lastTouchPlayer = taker.id;
    this.ball = { x: spot.x, z: spot.z, y: type === 'throwIn' ? 1.95 : .15 };
    this.setPiece = { type, team, player: taker.id, elapsed: 0, duration: .8, target: target.id, shoot,
      spot: { ...spot }, direction, phase: type === 'throwIn' ? 'throw' : 'retreat',
      back: { x: spot.x - direction.x * (type === 'goalKick' ? 3 : 2.5),
        z: spot.z - direction.z * (type === 'goalKick' ? 3 : 2.5) } };
    if (type === 'throwIn') this.animateAction(taker, 'throw', .8);
    const clearance = type === 'throwIn' ? 2 : 9.15;
    for (const p of this.players) {
      if (p.team === team || distance(p, taker) >= clearance) continue;
      const dx = p.x - taker.x, dz = p.z - taker.z, gap = Math.hypot(dx, dz);
      p.x = clamp(taker.x + (gap > .01 ? dx / gap : -this.direction(team)) * clearance, -50, 50);
      p.z = clamp(taker.z + (gap > .01 ? dz / gap : 0) * clearance, -32, 32);
    }
  }

  updateSetPiece(dt) {
    const piece = this.setPiece;
    const p = this.players[piece.player];
    piece.elapsed += dt;
    p.actionTime = Math.max(0, piece.duration - piece.elapsed);
    if (piece.type !== 'throwIn') {
      this.ball = { x: piece.spot.x, z: piece.spot.z, y: .15 };
      p.action = 'idle';
      if (piece.phase === 'retreat') {
        const ready = this.walkTo(p, piece.back, 1.6, dt);
        p.angle = Math.atan2(piece.direction.x, piece.direction.z);
        p.strideDirection = -1;
        if (ready) { piece.phase = 'set'; piece.elapsed = 0; }
        return;
      }
      p.strideDirection = 1;
      if (piece.phase === 'set') {
        p.speed = p.running = 0;
        if (piece.elapsed >= .3) { piece.phase = 'runup'; piece.elapsed = 0; }
        return;
      }
      const plant = { x: piece.spot.x - piece.direction.x * .38, z: piece.spot.z - piece.direction.z * .38 };
      const ready = this.walkTo(p, plant, 3.6, dt);
      if (!ready) return;
    }
    if (piece.type === 'throwIn') {
      const t = clamp(piece.elapsed / piece.duration, 0, 1);
      const reach = -.15 + t * .45;
      this.ball.x = p.x + Math.sin(p.angle) * reach;
      this.ball.z = p.z + Math.cos(p.angle) * reach;
      this.ball.y = 1.98 + Math.sin(t * Math.PI) * .16;
    }
    if (piece.type === 'throwIn' && piece.elapsed < piece.duration) return;
    const targets = this.players.filter(q => q.team === p.team && q !== p && q.slot !== 0)
      .sort((a, b) => distance(a, p) - distance(b, p));
    const target = this.players[piece.target] ?? targets[0];
    const shot = piece.type === 'freeKick' && 52.5 - p.x * this.direction(p.team) < 30 && Math.abs(p.z) < 22;
    this.setPiece = null;
    this.kick(shot ? null : target, shot);
    if (piece.type === 'throwIn') {
      const side = Math.sign(p.z);
      this.flight.tx = clamp(p.x + clamp(target.x - p.x, -4.5, 4.5), -50, 50);
      const inward = clamp(34 - target.z * side, 6, 10);
      this.flight.tz = side * (34 - inward);
      this.flight.duration = Math.max(.9, Math.hypot(this.flight.tx - this.ball.x, this.flight.tz - this.ball.z) / 8);
      this.flight.peak = 1;
      this.flight.lofted = true;
      this.flight.speculative = false;
      this.flight.throwIn = true;
    }
    if (piece.type === 'corner') { this.flight.peak = Math.max(3.5, this.flight.peak); this.flight.lofted = true; }
    this.animateAction(p, piece.type === 'throwIn' ? 'throw' : 'kick', .3);
    p.decisionIn = 0;
    p.strideDirection = 1;
  }

  chooseIntent(p, controlling, nearest) {
    const dir = this.direction(p.team);
    const s = this.settings[p.team];
    const f = formations[s.formation][p.slot];
    const attacking = p.team === controlling;
    const ball = this.ball;
    if (this.loose && p.slot !== 0 && nearest[p.team].indexOf(p) < 2) {
      return { x: ball.x + this.loose.vx * .25, z: ball.z + this.loose.vz * .25, role: 'recover' };
    }
    if (this.flight?.target === p.id) {
      return { x: this.flight.tx, z: this.flight.tz, role: 'receive' };
    }
    if (p.slot === 0) {
      return { x: -49 * dir, z: clamp(ball.z * .25, -5, 5), role: 'keeper' };
    }
    if (p === this.owner) {
      const opponent = this.players.filter(q => q.team !== p.team)
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      // Turn into space instead of dribbling straight through a defender.
      const evade = distance(opponent, p) < 6
        ? (p.z >= opponent.z ? 1 : -1) * 4 : 0;
      return { x: p.x + dir * 10, z: p.z * .94 + evade, role: 'carry' };
    }
    const rank = nearest[p.team].indexOf(p);
    const pressCount = s.tactic === 'press' ? 3 : 1;
    if (!attacking && rank >= 0 && rank < pressCount) {
      // The second presser covers the passing lane rather than piling onto the ball.
      return {
        x: ball.x - dir * (rank === 0 ? 0 : 2.5),
        z: ball.z + (rank === 0 ? 0 : rank === 1 ? 3.5 : -3.5),
        role: rank === 0 ? 'press' : 'cover',
      };
    }
    if (attacking && rank >= 0 && rank < 2) {
      const side = p.z < ball.z ? -1 : 1;
      return {
        x: ball.x - dir * (s.tactic === 'counter' ? -7 : 5 + p.personality * 4),
        z: ball.z + side * (7 + p.personality * 5), role: 'support',
      };
    }
    // Defenders hold their line; midfielders and forwards advance by different amounts.
    const depth = clamp(ball.x * dir + 18, -8, 40);
    const push = p.slot <= 4 ? depth * .2 : p.slot <= 7 ? depth * .48 : depth * .7;
    let x = (f[0] + push + (attacking ? 3 : -3)) * dir;
    let z = f[1] * dir;
    let role = 'hold';
    if (!attacking && p.slot <= 8) {
      const threat = this.players.filter(q => q.team !== p.team && q.slot !== 0)
        .sort((a, b) => distance(a, { x, z }) - distance(b, { x, z }))[0];
      if (distance(threat, { x, z }) < 18 && threat.x * dir < 22) {
        x = threat.x - dir * (3 + p.personality * 2);
        z = threat.z + (z - threat.z) * .25;
        role = 'mark';
      }
    } else if (attacking && p.slot >= 8 && p.personality > .3) {
      x += dir * (s.tactic === 'counter' ? 12 : 5);
      z += Math.sin(this.time / 105 + p.id * 1.9) * 4;
      role = 'run';
    }
    // Possession support is local: distant players retain width and shape.
    if (attacking && s.tactic === 'possession' && distance(p, ball) < 25 && p.slot > 4) {
      x += (ball.x - x) * .15;
      z += (ball.z - z) * .12;
    }
    return { x, z, role };
  }

  movePlayers(dt, controlling) {
    const nearest = [0, 1].map(team => this.players
      .filter(p => p.team === team && p.slot !== 0 && p !== this.owner)
      .sort((a, b) => distance(a, this.ball) - distance(b, this.ball)));
    // Compute velocities from the same snapshot so array order gives no player an advantage.
    const velocities = this.players.map(p => {
      p.decisionIn -= dt;
      if (p.actionTime > 0) {
        p.actionTime = Math.max(0, p.actionTime - dt);
        if (p.actionTime === 0 && !this.control) p.action = 'idle';
      }
      const airborne = this.flight?.lofted && this.flight.progress > .5
        && distance(p, this.ball) < 4 && this.ball.y > 1.75;
      const jumpTarget = airborne ? clamp(this.ball.y - 1.9, 0, .55) : 0;
      p.jump += (jumpTarget - p.jump) * (1 - Math.exp(-dt * 9));
      p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
      if(p.slot===0){
        const threat=this.flight?.shot&&this.flight.from!==p.team;
        const gap=distance(p,this.ball);
        const reach=threat&&gap<12?clamp((12-gap)/8,0,1):p.action==='catch'?1:0;
        p.keeperReach+=(reach-p.keeperReach)*(1-Math.exp(-dt*10));
        const lateral=threat&&gap<8?clamp((this.ball.z-p.z)*this.direction(p.team)/4,-1,1):0;
        p.keeperDive+=(lateral-p.keeperDive)*(1-Math.exp(-dt*8));
      }
      const immediate = (this.loose && p.intent?.role !== 'recover' && nearest[p.team].indexOf(p) < 2) || (this.flight?.target === p.id && p.intent?.role !== 'receive')
        || (p === this.owner && p.intent?.role !== 'carry');
      if (!p.intent || p.decisionIn <= 0 || immediate) {
        p.intent = this.chooseIntent(p, controlling, nearest);
        p.decisionIn = p === this.owner ? .18 + this.random() * .2 : .4 + this.random() * 1.1;
      }
      const tx = clamp(p.intent.x, -50, 50), tz = clamp(p.intent.z, -31, 31);
      const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz);
      const participating = this.duel && (this.duel.attacker === p.id || this.duel.defender === p.id);
      let speed = (p.slot === 0 ? 4 : p === this.owner ? 4.3 : 5.2) * p.pace;
      if (p.intent.role === 'hold' || p.intent.role === 'mark') speed *= .65;
      if (this.settings[p.team].tactic === 'press' && p.intent.role === 'press') speed += .6;
      if (participating || this.control?.player === p.id) speed = .75;
      const arrival = clamp((dist - .55) / 2, 0, 1);
      let vx = dist > .01 ? dx / dist * speed * arrival : 0;
      let vz = dist > .01 ? dz / dist * speed * arrival : 0;
      for (const q of this.players) {
        if (q === p) continue;
        const gap = distance(p, q);
        const radius = q.team === p.team ? 2.2 : 1.2;
        if (gap < radius) {
          const angle = (p.id < q.id ? 1 : -1);
          const awayX = gap > .01 ? (p.x - q.x) / gap : angle;
          const awayZ = gap > .01 ? (p.z - q.z) / gap : 0;
          const force = (radius - gap) * 2.7;
          vx += awayX * force;
          vz += awayZ * force;
        }
      }
      const magnitude = Math.hypot(vx, vz);
      if (magnitude > speed) { vx *= speed / magnitude; vz *= speed / magnitude; }
      return { vx, vz };
    });
    this.players.forEach((p, i) => {
      const blend = 1 - Math.exp(-dt * 7);
      p.vx += (velocities[i].vx - p.vx) * blend;
      p.vz += (velocities[i].vz - p.vz) * blend;
      p.x = clamp(p.x + p.vx * dt, -50, 50);
      p.z = clamp(p.z + p.vz * dt, -31, 31);
      const actualSpeed = Math.hypot(p.vx, p.vz);
      // Smoothed acceleration drives the torso pitch in the renderer, so
      // players visibly lean into starts and settle back when braking.
      const rawAccel = dt > 0 ? (actualSpeed - (p.speed || 0)) / dt : 0;
      p.accel = (p.accel || 0) + (clamp(rawAccel, -9, 9) - (p.accel || 0)) * (1 - Math.exp(-dt * 6));
      p.speed = actualSpeed;
      p.running = clamp(actualSpeed / 4, 0, 1);
      p.turnRate = 0;
      if (actualSpeed > .2 && !p.contest) {
        const angle = Math.atan2(p.vx, p.vz);
        const delta = Math.atan2(Math.sin(angle - p.angle), Math.cos(angle - p.angle));
        const turn = delta * (1 - Math.exp(-dt * 8));
        p.angle += turn;
        p.turnRate = turn / dt;
      }
      if (p.slot === 0) {
        // Keep the chest facing play even while the keeper retreats or shuffles sideways.
        const facing = p === this.owner ? Math.atan2(this.direction(p.team), 0)
          : Math.atan2(this.ball.x - p.x, this.ball.z - p.z);
        const delta = Math.atan2(Math.sin(facing - p.angle), Math.cos(facing - p.angle));
        p.angle += delta * (1 - Math.exp(-dt * 12));
      }
      p.phase += dt * Math.PI * 2 * strideFrequency(actualSpeed);
      p.animTime = (p.animTime || 0) + dt;
    });
  }

  startDuel(defender) {
    const attacker = this.owner;
    this.duel = { attacker: attacker.id, defender: defender.id, elapsed: 0, duration: .45 + this.random() * .45 };
    attacker.action = 'shield';
    defender.action = 'tackle';
    attacker.contest = defender.contest = .1;
    defender.tackleCooldown = 2;
    this.cooldown = 1;
  }

  updateDuel(dt) {
    const duel = this.duel;
    const attacker = this.players[duel.attacker], defender = this.players[duel.defender];
    duel.elapsed += dt;
    const progress = clamp(duel.elapsed / duel.duration, 0, 1);
    attacker.contest = defender.contest = Math.sin(progress * Math.PI);
    // Shield on the side away from the defender, while the challenger reaches for it.
    const away = Math.atan2(attacker.x - defender.x, attacker.z - defender.z);
    attacker.angle = away;
    defender.angle = away;
    this.ball.x = attacker.x + Math.sin(away) * .65;
    this.ball.z = attacker.z + Math.cos(away) * .65;
    this.ball.y = .15;
    if (progress < 1 && distance(attacker, defender) < 3) return;
    const fromBehind = (defender.x - attacker.x) * this.direction(attacker.team) < -.3;
    const foulRisk = (fromBehind ? .2 : .06) + (this.settings[defender.team].tactic === 'press' ? .06 : 0);
    if (distance(attacker, defender) < 2.5 && this.random() < foulRisk) {
      this.fouls[defender.team]++;
      this.stopForRestart('freeKick', attacker.team, 3.5, { x: attacker.x, z: attacker.z });
      attacker.action = 'fall';
      attacker.fall = { elapsed: 0 };
      attacker.fallAmount = 0;
      this.onEvent('FOUL', '接触によるファウル · フリーキック');
      return;
    }
    const front = (defender.x - attacker.x) * this.direction(attacker.team) > 0;
    const strength = ((defender.profile?.strength ?? 75) - (attacker.profile?.strength ?? 75)) * .003;
    const chance = .36 + (front ? .13 : 0) + (this.settings[defender.team].tactic === 'press' ? .08 : 0) + strength;
    const won = distance(attacker, defender) < 2.7 && this.random() < chance;
    this.owner = won ? defender : attacker;
    this.lastTouch = this.owner.team;
    this.lastTouchPlayer = this.owner.id;
    this.duels[this.owner.team]++;
    this.cooldown = .8;
    attacker.action = defender.action = 'idle';
    attacker.contest = defender.contest = 0;
    attacker.tackleCooldown = defender.tackleCooldown = 1.5;
    attacker.decisionIn = defender.decisionIn = 0;
    this.duel = null;
  }

  updateOwner(dt) {
    const p = this.owner;
    const dir = this.direction(p.team);
    this.ball.x = p.x + Math.sin(p.angle) * .8;
    this.ball.z = p.z + Math.cos(p.angle) * .8;
    this.ball.y = .15 + Math.abs(Math.sin(p.phase)) * .06;
    if(p.slot===0&&p.action==='catch'){
      const hold=clamp(p.actionTime/.25,0,1);
      this.ball.x=p.x+Math.sin(p.angle)*.42;
      this.ball.z=p.z+Math.cos(p.angle)*.42;
      this.ball.y=.15+1.05*hold;
    }
    const defender = this.players.filter(q => q.team !== p.team && q.slot !== 0 && q.tackleCooldown <= 0 && distance(q, p) < 1.9)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (p.slot !== 0 && defender && this.cooldown <= 0 && this.random() < dt * 3.5) {
      this.startDuel(defender);
      return;
    }
    if (this.cooldown > 0) return;
    const goalDistance = 52.5 - p.x * dir;
    if (p.slot !== 0 && goalDistance < 23 && Math.abs(p.z) < 23 && this.random() < dt * 2) {
      this.kick(null, true);
      return;
    }
    const tactic = this.settings[p.team].tactic;
    const rate = tactic === 'possession' ? 1.2 : tactic === 'counter' ? .38 : .65;
    if (this.random() >= dt * rate && Math.abs(p.z) <= 30 && goalDistance >= 4) return;
    const candidates = this.players
      .filter(q => q.team === p.team && q !== p && q.slot !== 0 && distance(q, p) > 5 && distance(q, p) < 38)
      .map(q => {
        const space = Math.min(...this.players.filter(o => o.team !== p.team).map(o => distance(o, q)));
        return { q, score: space * .7 + (q.x - p.x) * dir * .6 + this.random() * 9 };
      })
      .sort((a, b) => b.score - a.score);
    if (candidates.length) this.kick(candidates[0].q);
  }

  animateAction(p, action, duration) {
    p.action = action;
    p.actionTime = p.actionDuration = duration;
  }

  tryAerialContact(f, progress) {
    if (progress < .52 || this.ball.y < .85 || this.ball.y > 2.8) return false;
    const candidates = this.players.filter(p => p.id !== f.passer && p.slot !== 0
      && (p.team !== f.from || p.id === f.target) && distance(p, this.ball) < 1.7)
      .sort((a, b) => distance(a, this.ball) - distance(b, this.ball));
    const p = candidates[0];
    if (!p) return false;
    const headHeight = 1.88 + p.jump;
    if (this.ball.y > headHeight + .25) return false;
    const heading = this.ball.y > 1.65;
    const incomingSpeed = f.header ? Math.hypot(f.vx, f.vz)
      : Math.hypot(f.tx - f.x, f.tz - f.z) / Math.max(f.duration || 1, .1);
    const teamPass = p.team === f.from && !f.shot;
    this.flight = null;
    this.owner = p;
    this.lastTouch = p.team;
    this.lastTouchPlayer = p.id;
    this.aerials[p.team]++;
    if (teamPass) this.passes[f.from]++;
    if (heading) {
      this.animateAction(p, 'header', .5);
      const dir = this.direction(p.team);
      p.angle = Math.atan2(dir, 0);
      const goalDistance = 52.5 - p.x * dir;
      if (goalDistance < 24 && Math.abs(p.z) < 22) {
        this.kick(null, true, true, incomingSpeed);
      } else {
        const target = this.players.filter(q => q.team === p.team && q !== p && q.slot !== 0
          && distance(p, q) > 2 && distance(p, q) < 14)
          .sort((a, b) => (b.x - a.x) * dir - (distance(p, b) - distance(p, a)) * .35)[0];
        if (target) {
          this.kick(target, false, true, incomingSpeed);
          this.onEvent('HEADER', teamPass ? 'ヘディングで味方へつなぐ' : 'ヘディングでクリア');
        } else this.startControl(p, 'chest');
      }
    } else {
      this.startControl(p, this.ball.y > 1.1 ? 'chest' : 'cushion');
    }
    return true;
  }

  startControl(p, action) {
    this.owner = p;
    this.lastTouch = p.team;
    this.lastTouchPlayer = p.id;
    this.loose = null;
    const pressure = this.players.some(q => q.team !== p.team && distance(p, q) < 3.5);
    const errorRate = (action === 'chest' ? .15 : action === 'cushion' ? .12 : .055) + (pressure ? .13 : 0);
    this.control = { player: p.id, elapsed: 0, duration: action === 'chest' ? .8 : .55, height: this.ball.y,
      x: this.ball.x, z: this.ball.z, miscontrol: this.random() < errorRate };
    p.angle = Math.atan2(this.ball.x - p.x, this.ball.z - p.z);
    this.animateAction(p, action, this.control.duration);
    this.cooldown = .85;
    if (action === 'chest') this.onEvent('CHEST CONTROL', '胸で受けて足元に収める');
  }

  updateControl(dt) {
    const c = this.control;
    const p = this.players[c.player];
    c.elapsed += dt;
    const t = Math.min(c.elapsed / c.duration, 1);
    const chest = p.action === 'chest';
    // First meet the incoming ball, then withdraw the contact surface to absorb its speed.
    const contact = chest ? .22 : .43;
    const settle = .45;
    const contactX = p.x + Math.sin(p.angle) * contact;
    const contactZ = p.z + Math.cos(p.angle) * contact;
    if (t < .3) {
      const approach = 1 - Math.pow(1 - t / .3, 2);
      this.ball.x = c.x + (contactX - c.x) * approach;
      this.ball.z = c.z + (contactZ - c.z) * approach;
      this.ball.y = c.height + ((chest ? 1.43 : c.height) - c.height) * approach;
    } else {
      const drop = (t - .3) / .7;
      const reach = contact + (settle - contact) * drop;
      this.ball.x = p.x + Math.sin(p.angle) * reach;
      this.ball.z = p.z + Math.cos(p.angle) * reach;
      this.ball.y = .15 + ((chest ? 1.43 : c.height) - .15) * (1 - drop * drop);
    }
    if (c.miscontrol && t > .6) {
      const angle = p.angle + (this.random() - .5) * 1.2;
      this.miscontrols[p.team]++;
      this.animateAction(p, 'stumble', .45);
      this.releaseLoose(Math.sin(angle) * 5.5, Math.cos(angle) * 5.5, .7, p.team);
      this.onEvent('HEAVY TOUCH', 'トラップが流れる · ルーズボール');
      return;
    }
    if (t === 1) this.control = null;
  }

  updateFlight(dt) {
    const f = this.flight;
    let t;
    if (f.header) {
      f.elapsed += dt;
      f.progress = f.elapsed / f.duration;
      t = Math.min(f.progress, 1);
      this.ball.x = f.x + f.vx * f.elapsed;
      this.ball.z = f.z + f.vz * f.elapsed;
      this.ball.y = Math.max(.15, f.startY + f.vy * f.elapsed - 4.9 * f.elapsed * f.elapsed);
      if (this.ball.y <= .15) t = 1;
    } else {
      f.progress += dt / Math.max(.1, f.duration);
      t = Math.min(f.progress, 1);
      this.ball.x = f.x + (f.tx - f.x) * t;
      this.ball.z = f.z + (f.tz - f.z) * t;
      this.ball.y = (f.startY ?? .15) * (1 - t) + .15 * t + 4 * t * (1 - t) * (f.peak ?? (f.shot ? 1.3 : 1.5));
    }
    if (this.checkBoundary()) return;
    if (this.tryAerialContact(f, t)) return;
    const interceptor = this.players.find(p => p.team !== f.from
      && distance(p, this.ball) < (p.slot === 0 ? (f.shot ? 1.15 : 2.2) : 1.1)
      && this.ball.y < (p.slot === 0 ? 2.4 : .85) && t > .12);
    if (interceptor) {
      this.owner = interceptor;
      this.lastTouch = interceptor.team;
      this.lastTouchPlayer = interceptor.id;
      this.flight = null;
      this.cooldown = .55;
      if(interceptor.slot===0){this.animateAction(interceptor,'catch',.85);interceptor.keeperReach=1;this.cooldown=1}
      if (f.shot) this.onEvent(interceptor.slot === 0 ? 'SAVED' : 'BLOCKED',
        interceptor.slot === 0 ? 'ゴールキーパーがセーブ' : 'ディフェンダーがブロック');
      return;
    }
    if (t < 1) return;
    this.flight = null;
    const receiver = this.players.filter(p => distance(p, this.ball) < 1.25)
      .sort((a, b) => distance(a, this.ball) - distance(b, this.ball))[0];
    if (receiver) {
      if (!f.shot && receiver.team === f.from) this.passes[f.from]++;
      this.startControl(receiver, 'foot');
    } else {
      const duration = Math.max(f.duration, .1);
      this.releaseLoose(f.header ? f.vx * .55 : (f.tx - f.x) / duration * .32,
        f.header ? f.vz * .55 : (f.tz - f.z) / duration * .32, f.header ? .25 : .6, f.from);
    }
  }
}
