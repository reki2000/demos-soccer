export const COURT = Object.freeze({ length: 28, width: 15, basketX: 12.2, rimHeight: 3.05 });
export const SQUADS = [
  { id: 'tokyo', name: 'TOKYO SPARKS', code: 'TKY', color: 0x85d6ed, trim: 0x172c43, names: ['Kaito Sora', 'Ren Namba', 'Haru Sato', 'Yuto Arai', 'Daiki Mori'] },
  { id: 'osaka', name: 'OSAKA WOLVES', code: 'OSK', color: 0xefb969, trim: 0x4d2c22, names: ['Riku Hayashi', 'Sho Kondo', 'Leo Tanaka', 'Akira Ueda', 'Naoki Tsuji'] },
  { id: 'seoul', name: 'SEOUL FALCONS', code: 'SEL', color: 0xeaa8ab, trim: 0x522d44, names: ['Jun Park', 'Min Lee', 'Jin Kim', 'Tae Choi', 'Woo Han'] },
  { id: 'sydney', name: 'SYDNEY TIDES', code: 'SYD', color: 0xa6ddaf, trim: 0x244c3c, names: ['Eli Walker', 'Noah Cooper', 'Max Turner', 'Leo Hart', 'Finn Baker'] },
];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const formation = [{x: -8.8, z: 0}, {x: -8.1, z: -4.9}, {x: -8.1, z: 4.9}, {x: -4.1, z: -2.9}, {x: -4.1, z: 2.9}];

export class BasketballMatch {
  constructor(onEvent = () => {}, random = Math.random) {
    this.onEvent = onEvent;
    this.random = random;
    this.settings = { style: 'balanced' };
    this.reset();
  }
  direction(team) { return (team === 0 ? 1 : -1) * (this.quarter > 2 ? -1 : 1); }
  basket(team) { return {x: this.direction(team) * COURT.basketX, z: 0}; }
  reset() {
    this.quarter = 1;
    this.clock = 600;
    this.shotClock = 24;
    this.score = [0, 0];
    this.shots = [0, 0];
    this.makes = [0, 0];
    this.threes = [0, 0];
    this.passes = [0, 0];
    this.rebounds = [0, 0];
    this.steals = [0, 0];
    this.turnovers = [0, 0];
    this.teamFouls = [0, 0];
    this.playerFouls = Array(10).fill(0);
    this.ftAttempts = [0, 0];
    this.ftMakes = [0, 0];
    this.freeThrows = null;
    this.possessionTime = [0, 0];
    this.possession = 0;
    this.elapsed = 0;
    this.possessionAge = 0;
    this.pause = 0;
    this.ended = false;
    this.flight = null;
    this.owner = null;
    this.players = Array.from({length: 10}, (_, id) => {
      const team = Math.floor(id / 5), slot = id % 5;
      return {id, team, slot, number: [7, 11, 23, 34, 55][slot],
        x: 0, z: 0, vx: 0, vz: 0, speed: 0, phase: id * .7,
        action: 'idle', actionTime: 0, height: [1.89, 1.94, 1.97, 2.05, 2.11][slot]};
    });
    this.startPossession(0, true);
  }
  emit(type, details = {}) { this.onEvent(type, {...details, score: [...this.score], quarter: this.quarter}); }
  startPossession(team, resetPositions = false) {
    this.possession = team;
    this.owner = this.players[team * 5];
    this.shotClock = 24;
    this.possessionAge = 0;
    this.decision = 1.7;
    this.flight = null;
    this.ball = {x: this.owner.x, y: 1.1, z: this.owner.z};
    if (resetPositions) {
      for (const p of this.players) {
        const sign = this.direction(p.team);
        p.x = -sign * (8.4 - (p.slot > 2 ? 1.2 : 0));
        p.z = [0, -3.7, 3.7, -1.8, 1.8][p.slot];
        p.vx = p.vz = p.speed = 0;
        p.action = 'idle';
      }
    }
    this.syncHeldBall();
  }
  syncHeldBall() {
    if (!this.owner) return;
    const p = this.owner;
    this.ball.x = p.x + this.direction(p.team) * .32;
    this.ball.z = p.z + .28;
    this.ball.y = .35 + .70 * Math.abs(Math.sin(this.elapsed * 10));
  }
  nearestDefender(player) {
    return this.players.filter(p => p.team !== player.team).reduce((a, b) => dist(player, a) < dist(player, b) ? a : b);
  }
  movePlayers(dt) {
    for (const p of this.players) {
      const offense = p.team === this.possession;
      const sign = this.direction(p.team);
      const basket = this.basket(p.team);
      let tx, tz;
      if (offense) {
        const f = formation[p.slot];
        tx = sign * (COURT.basketX + f.x);
        tz = f.z + Math.sin(this.elapsed * .8 + p.id) * .5;
        if (p === this.owner) {
          tx = sign * (COURT.basketX - 6.25);
          tz = clamp(p.z + Math.sin(this.elapsed * .7) * .5, -5.3, 5.3);
        }
      } else {
        const attacker = this.players[this.possession * 5 + p.slot];
        tx = attacker.x + this.direction(this.possession) * 1.15;
        tz = attacker.z + (p.slot % 2 ? .35 : -.35);
        if (this.owner && dist(attacker, this.owner) < 2.5) {
          tx = (tx + this.owner.x + this.direction(this.possession) * .8) / 2;
          tz = (tz + this.owner.z) / 2;
        }
      }
      if (p === this.owner && Math.abs(basket.x - p.x) < 5.4) tx = p.x;
      const dx = clamp(tx, -13.2, 13.2) - p.x;
      const dz = clamp(tz, -6.6, 6.6) - p.z;
      const length = Math.hypot(dx, dz);
      const pace = offense ? (p === this.owner ? 3.25 : 3.65) : 3.4;
      const movement = Math.min(length, pace * dt);
      p.vx = length > .01 ? dx / length * movement / dt : 0;
      p.vz = length > .01 ? dz / length * movement / dt : 0;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.speed = Math.hypot(p.vx, p.vz);
      p.phase += p.speed * dt * 6;
      p.actionTime = Math.max(0, p.actionTime - dt);
      if (p.actionTime === 0) p.action = p === this.owner ? 'dribble' : 'idle';
    }
  }
  pass() {
    if (!this.owner || this.flight) return;
    const from = this.owner;
    const options = this.players.filter(p => p.team === from.team && p !== from);
    const recipient = options[Math.floor(this.random() * options.length)];
    this.flight = {kind: 'pass', team: from.team, from: from.id, to: recipient.id,
      start: {x: this.ball.x, y: 1.55, z: this.ball.z},
      end: {x: recipient.x, y: 1.45, z: recipient.z},
      t: 0, duration: .38 + dist(from, recipient) / 10};
    from.action = 'pass'; from.actionTime = .45;
    this.owner = null;
    this.emit('pass', {team: from.team, player: from.id, target: recipient.id});
  }
  shoot() {
    if (!this.owner || this.flight) return;
    const from = this.owner;
    const hoop = this.basket(from.team);
    const distance = dist(from, hoop);
    const points = distance >= 6.75 ? 3 : 2;
    const defenderDistance = dist(from, this.nearestDefender(from));
    const probability = clamp((points === 3 ? .39 : .66) - Math.max(0, distance - 3) * .018
      - (defenderDistance < 1.6 ? .13 : 0), .15, .83);
    const defender = this.nearestDefender(from);
    const shootingFoul = defenderDistance < 1.65 && this.random() < .23
      && this.callFoul(defender.id, from.id, true, points);
    this.flight = {kind: 'shot', team: from.team, from: from.id, points, probability, shootingFoul,
      start: {x: this.ball.x, y: 1.9, z: this.ball.z},
      end: {x: hoop.x, y: COURT.rimHeight, z: 0},
      t: 0, duration: .85 + distance / 12};
    from.action = 'shoot'; from.actionTime = .8;
    this.owner = null;
    this.shots[from.team]++;
    this.emit('shot', {team: from.team, player: from.id, points, distance});
  }
  updateFlight(dt) {
    const f = this.flight;
    f.t += dt / f.duration;
    const t = clamp(f.t, 0, 1);
    this.ball.x = f.start.x + (f.end.x - f.start.x) * t;
    this.ball.z = f.start.z + (f.end.z - f.start.z) * t;
    this.ball.y = f.start.y + (f.end.y - f.start.y) * t + Math.sin(Math.PI * t) * (f.kind === 'shot' ? 2.65 : 1.0);
    if (f.t < 1) return;
    this.flight = null;
    if (f.kind === 'pass') {
      const recipient = this.players[f.to];
      const closest = this.nearestDefender(recipient);
      if (dist(recipient, closest) < .7 && this.random() < .15) {
        this.steal(closest.team, closest.id);
      } else {
        this.owner = recipient;
        this.passes[f.team]++;
        this.decision = .8 + this.random() * 1.2;
        this.syncHeldBall();
      }
    } else if (f.kind === 'shot') {
      if (this.random() < f.probability) {
        this.score[f.team] += f.points;
        this.makes[f.team]++;
        if (f.points === 3) this.threes[f.team]++;
        this.ball = {...f.end};
        this.emit('score', {team: f.team, player: f.from, points: f.points});
        this.owner = null;
        if (f.shootingFoul) this.beginFreeThrows(f.from, 1);
        else {this.pause = 1.5; this.nextTeam = 1 - f.team;}
      } else {
        this.emit('miss', {team: f.team, player: f.from, points: f.points});
        if (f.shootingFoul) {
          this.beginFreeThrows(f.from, f.points);
          return;
        }
        this.flight = {kind: 'rebound', team: f.team, from: f.from,
          start: {...f.end}, end: {x: clamp(f.end.x - this.direction(f.team) * 2.1, -13.3, 13.3),
            y: .18, z: (this.random() - .5) * 5}, t: 0, duration: .75};
      }
    } else {
      const reboundTeam = this.random() < .7 ? 1 - f.team : f.team;
      this.rebounds[reboundTeam]++;
      const near = this.players.filter(p => p.team === reboundTeam).sort((a, b) => dist(a, this.ball) - dist(b, this.ball))[0];
      this.startPossession(reboundTeam);
      this.owner = near;
      this.shotClock = reboundTeam === f.team ? 14 : 24;
      this.syncHeldBall();
      this.emit('rebound', {team: reboundTeam, player: near.id});
    }
  }

  // Simplified FIBA-style bonus: team fouls 1–4 give an inbound;
  // starting with the fifth team foul in the quarter, two free throws.
  callFoul(defenderId, attackerId = this.owner?.id, shooting = false, points = 2) {
    const defender = this.players[defenderId];
    const attacker = this.players[attackerId];
    if (!defender || !attacker || defender.team === attacker.team || this.ended || this.freeThrows) return false;
    this.teamFouls[defender.team]++;
    this.playerFouls[defenderId]++;
    this.emit('foul', {
      team: defender.team, player: defenderId, victim: attackerId, shooting,
      teamFouls: this.teamFouls[defender.team], playerFouls: this.playerFouls[defenderId],
      bonus: this.teamFouls[defender.team] >= 5,
    });
    if (shooting) return true; // Shot outcome decides the attempts (and-one vs two/three).
    const offense = attacker.team;
    if (this.teamFouls[defender.team] >= 5) {
      this.beginFreeThrows(attackerId, 2);
    } else {
      const retainedClock = Math.max(14, this.shotClock);
      this.startPossession(offense, true);
      this.shotClock = retainedClock;
      this.emit('inbound', {team: offense, afterFoul: true});
    }
    return true;
  }
  beginFreeThrows(shooterId, attempts) {
    const shooter = this.players[shooterId];
    if (!shooter || !Number.isInteger(attempts) || attempts < 1) return;
    const sign = this.direction(shooter.team);
    this.possession = shooter.team;
    this.flight = null;
    this.owner = null;
    this.pause = 0;
    this.freeThrows = {shooter: shooterId, team: shooter.team, total: attempts, remaining: attempts,
      completed: 0, made: 0, state: 'setup', timer: 4.5, lastMade: false};
    // Arrange shooter at the stripe, teammates and opponents along the lane.
    for (const p of this.players) {
      p.speed = p.vx = p.vz = 0;
      p.action = 'idle';
      p.actionTime = 0;
      if (p.id === shooterId) {p.x = sign * (COURT.basketX - 4.55); p.z = 0;}
      else {
        const slot = p.slot, offset = p.team === shooter.team ? 1 : 0;
        p.x = sign * (COURT.basketX - 1.9 - .9 * (slot % 3));
        p.z = (slot % 2 ? -1 : 1) * (2.4 + offset + Math.floor(slot / 2) * .8);
      }
    }
    this.ball = {x: shooter.x + sign * .22, y: 1.75, z: 0};
    this.emit('freeThrowStart', {team: shooter.team, player: shooterId, attempts});
  }
  updateFreeThrows(dt) {
    const ft = this.freeThrows;
    if (!ft) return;
    const shooter = this.players[ft.shooter];
    const direction = this.direction(ft.team);
    ft.timer -= dt;
    if (ft.state === 'setup') {
      this.ball = {x: shooter.x + direction * .23, y: 1.65, z: shooter.z};
      if (ft.timer <= 0) {
        ft.state = 'flight';
        ft.timer = 6.8;
        ft.willMake = this.random() < .76;
        shooter.action = 'shoot';
        shooter.actionTime = .8;
        ft.start = {...this.ball};
        ft.end = {x: direction * COURT.basketX, y: COURT.rimHeight, z: 0};
        this.ftAttempts[ft.team]++;
        this.emit('freeThrowAttempt', {team: ft.team, player: ft.shooter, attempt: ft.completed + 1, total: ft.total});
      }
      return;
    }
    const t = clamp(1 - ft.timer / 6.8, 0, 1);
    this.ball = {
      x: ft.start.x + (ft.end.x - ft.start.x) * t,
      y: ft.start.y + (ft.end.y - ft.start.y) * t + Math.sin(Math.PI * t) * 1.4,
      z: ft.start.z + (ft.end.z - ft.start.z) * t,
    };
    if (ft.timer > 0) return;
    ft.completed++;
    ft.remaining--;
    ft.lastMade = ft.willMake;
    if (ft.willMake) {
      this.score[ft.team]++;
      this.ftMakes[ft.team]++;
      ft.made++;
    }
    this.emit(ft.willMake ? 'freeThrowMade' : 'freeThrowMissed', {
      team: ft.team, player: ft.shooter, attempt: ft.completed, total: ft.total,
      remaining: ft.remaining, made: ft.made,
    });
    if (ft.remaining > 0) {
      ft.state = 'setup';
      ft.timer = 4.6;
      shooter.action = 'idle';
      return;
    }
    this.freeThrows = null;
    if (ft.lastMade) {
      this.nextTeam = 1 - ft.team;
      this.owner = null;
      this.pause = 2;
    } else {
      const reboundTeam = this.random() < .7 ? 1 - ft.team : ft.team;
      this.rebounds[reboundTeam]++;
      this.startPossession(reboundTeam, true);
      if (reboundTeam === ft.team) this.shotClock = 14;
      this.emit('rebound', {team: reboundTeam, player: this.owner.id, afterFreeThrow: true});
    }
  }
  steal(team, playerId = team * 5) {
    const losingTeam = 1 - team;
    this.turnovers[losingTeam]++;
    this.steals[team]++;
    this.startPossession(team);
    this.owner = this.players[playerId];
    this.syncHeldBall();
    this.emit('steal', {team, player: playerId});
  }
  violation() {
    const loser = this.possession;
    this.turnovers[loser]++;
    this.startPossession(1 - loser, true);
    this.emit('violation', {team: loser});
  }
  endQuarter() {
    this.clock = 0;
    this.flight = null;
    this.owner = null;
    this.freeThrows = null;
    if (this.quarter === 4) {
      this.ended = true;
      this.emit('fulltime');
      return;
    }
    this.emit('quarter', {completed: this.quarter});
    this.quarter++;
    this.teamFouls = [0, 0];
    this.clock = 600;
    this.pause = 2.3;
    this.nextTeam = this.quarter % 2 === 0 ? 1 : 0;
  }
  update(dt) {
    if (this.ended || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .15);
    this.elapsed += dt;
    if (this.freeThrows) {
      this.updateFreeThrows(dt);
      return;
    }
    if (this.pause > 0) {
      this.pause = Math.max(0, this.pause - dt);
      if (this.pause === 0) {
        this.startPossession(this.nextTeam, true);
        this.emit('inbound', {team: this.possession});
      }
      return;
    }
    this.clock = Math.max(0, this.clock - dt);
    this.shotClock = Math.max(0, this.shotClock - dt);
    this.possessionTime[this.possession] += dt;
    this.possessionAge += dt;
    if (this.clock <= 0) { this.endQuarter(); return; }
    if (this.shotClock <= 0) { this.violation(); return; }
    this.movePlayers(dt);
    if (this.flight) { this.updateFlight(dt); return; }
    this.syncHeldBall();
    if (!this.owner) return;
    const defender = this.nearestDefender(this.owner);
    if (dist(defender, this.owner) < 1.55 && this.random() < dt * .12) {
      this.callFoul(defender.id, this.owner.id);
      return;
    }
    if (dist(defender, this.owner) < .76 && this.random() < dt * .045) {
      this.steal(defender.team, defender.id);
      return;
    }
    this.decision -= dt;
    if (this.decision > 0) return;
    const range = dist(this.owner, this.basket(this.possession));
    const urgency = this.shotClock < 5;
    if (urgency || (range < 8.3 && this.possessionAge > 3.8 && this.random() < (this.settings.style === 'perimeter' ? .62 : .46))) {
      this.shoot();
    } else {
      this.pass();
    }
  }
  snapshot() {
    return {quarter: this.quarter, clock: this.clock, shotClock: this.shotClock, score: [...this.score],
      possession: this.possession, owner: this.owner?.id ?? null, flight: this.flight?.kind ?? null,
      ended: this.ended, shots: [...this.shots], makes: [...this.makes], threes: [...this.threes],
      passes: [...this.passes], rebounds: [...this.rebounds], steals: [...this.steals], turnovers: [...this.turnovers],
      teamFouls: [...this.teamFouls], playerFouls: [...this.playerFouls],
      ftAttempts: [...this.ftAttempts], ftMakes: [...this.ftMakes],
      freeThrows: this.freeThrows ? {...this.freeThrows} : null,
      players: this.players.map(p => ({id: p.id, team: p.team, x: p.x, z: p.z, action: p.action}))};
  }
}
