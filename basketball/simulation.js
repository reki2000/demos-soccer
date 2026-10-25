import { updateMovement, resetIntent, chooseReceiver } from './tactics.js';

import { COURT } from './court.js';
import {startJump,advanceJumps,jumpHeight} from './athletic-motion.js';
import {dribblePoint,releasePoint,receivePoint,arcPoint,mixPoint,blend,controllingHand,
  DRIBBLE_PERIOD,PASS_GATHER,PASS_CATCH,SHOT_GATHER,passFlightDuration} from './ball-motion.js';
export { COURT } from './court.js';
export const SQUADS = [
  { id: 'tokyo', name: 'TOKYO BAY HAWKS', code: 'TKY', color: 0x85d6ed, trim: 0x172c43, names: ['Shota Takamura', 'Ryosuke Fujii', 'Kenta Mizuno', 'Yuki Morishita', 'Daichi Nagasawa'] },
  { id: 'osaka', name: 'OSAKA CENTRAL BULLS', code: 'OSK', color: 0xefb969, trim: 0x4d2c22, names: ['Takuma Inoue', 'Keisuke Nishida', 'Masato Fujimoto', 'Hiroki Uemura', 'Naoya Ishibashi'] },
  { id: 'seoul', name: 'SEOUL RIVER LIONS', code: 'SEL', color: 0xeaa8ab, trim: 0x522d44, names: ['Min-jun Park', 'Jae-hyun Kim', 'Ji-hoon Lee', 'Seung-woo Choi', 'Do-yun Kang'] },
  { id: 'sydney', name: 'SYDNEY HARBOUR COMETS', code: 'SYD', color: 0xa6ddaf, trim: 0x244c3c, names: ['Liam Henderson', 'Oliver Mitchell', 'Ethan McKenzie', 'Jack Thompson', 'Noah Campbell'] },
];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const FT_SETUP_SECONDS = 2.2;
const FT_FLIGHT_SECONDS = 1.65;

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
    this.ballReturn = null;
    this.scoredInbound=null;
    this.ended = false;
    this.flight = null;
    this.owner = null;
    this.players = Array.from({length: 10}, (_, id) => {
      const team = Math.floor(id / 5), slot = id % 5;
      return {id, team, slot, number: [7, 11, 23, 34, 55][slot],
        x: 0, z: 0, vx: 0, vz: 0, speed: 0, heading: 0, phase: id * .7,
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
    this.ballControl = {mode:'dribble',hand:1,phase:0,cooldown:.8};
    this.ball = dribblePoint(this.owner,1,0);
    if (resetPositions) {
      for (const p of this.players) {
        const sign = this.direction(p.team);
        p.x = -sign * (8.4 - (p.slot > 2 ? 1.2 : 0));
        p.z = [0, -3.7, 3.7, -1.8, 1.8][p.slot];
        p.vx = p.vz = p.speed = 0;
        p.heading = this.direction(p.team)>0 ? Math.PI/2 : -Math.PI/2;
        p.action = 'idle';
      }
    }
    resetIntent(this);
    this.syncHeldBall();
  }
  syncHeldBall(dt=0) {
    if (!this.owner) return;
    const control=this.ballControl;
    if(control?.mode==='secure') {
      control.elapsed+=dt;
      const t=blend(Math.min(1,control.elapsed/control.duration));
      this.ball=mixPoint(control.from,dribblePoint(this.owner,control.hand,0),t);
      if(control.elapsed<control.duration)return;
      control.mode='dribble';
      control.phase=0;
      control.cooldown=.55;
    }
    if(control?.mode!=='dribble') {
      this.ballControl={mode:'dribble',hand:1,phase:0,cooldown:.75};
    }
    const c=this.ballControl;
    const old=c.phase;
    c.phase=(c.phase+dt/DRIBBLE_PERIOD)%1;
    c.cooldown-=dt;
    // Switch only when the ball is near the floor at the centre of the body.
    // Both left- and right-hand trajectories meet there.
    if(dt>0 && old < .5 && c.phase >= .5 && c.cooldown<=0) {
      const preferred=controllingHand(this,this.owner);
      if(preferred!==c.hand || this.random()<.3) {
        c.hand=-c.hand;
        c.cooldown=.8+this.random()*.8;
      }
    }
    this.ball=dribblePoint(this.owner,c.hand,c.phase);
    this.owner.action='dribble';
  }
  collectBall(player,from=this.ball,duration=.20) {
    this.owner=player;
    const hand=controllingHand(this,player);
    this.ballControl={mode:'secure',from:{...from},hand,phase:0,elapsed:0,duration};
    this.ball={...from};
  }
  // The ball drops *through* the net, bounces on the floor and is
  // collected by the receiving team before its next possession starts.
  startScoredInbound(team) {
    const from={...this.ball};
    const near=this.players.filter(p=>p.team===team)
      .sort((a,b)=>dist(a,from)-dist(b,from))[0];
    const landing={x:from.x,y:.125,z:from.z};
    const approach=Math.max(.42,Math.min(2.9,dist(near,landing)/3.4));
    this.scoredInbound={team,picker:near.id,phase:'fall',time:0,from,landing,
      approach,start:{x:near.x,z:near.z}};
    this.pause=.62+approach+.32;
    this.ballReturn=null;
    this.ballControl={mode:'scoredInbound',phase:'fall'};
    near.action='run';
    this.nextTeam=team;
  }
  updateScoredInbound(dt) {
    const state=this.scoredInbound;
    if(!state)return;
    const player=this.players[state.picker];
    state.time+=dt;
    const t=state.time,fall=.62;
    if(t<fall) {
      state.phase='fall';
      const u=Math.min(1,t/fall);
      const height=u<.72?state.from.y-(state.from.y-.125)*(u/.72)**2:
        .125+.28*Math.sin(Math.PI*(u-.72)/.28);
      this.ball={...state.landing,y:Math.max(.125,height)};
    } else if(t<fall+state.approach) {
      state.phase='approach';
      const u=blend((t-fall)/state.approach);
      player.x=state.start.x+(state.landing.x-state.start.x)*u;
      player.z=state.start.z+(state.landing.z-state.start.z)*u;
      player.vx=(state.landing.x-state.start.x)/state.approach;
      player.vz=(state.landing.z-state.start.z)/state.approach;
      player.speed=Math.hypot(player.vx,player.vz);
      player.heading=Math.atan2(state.landing.x-player.x,state.landing.z-player.z);
      player.phase+=player.speed*dt*5.4;
      this.ball={...state.landing};
    } else {
      state.phase='pickup';
      player.vx=player.vz=player.speed=0;
      player.action='catch';
      player.actionTime=.32;
      const u=blend((t-fall-state.approach)/.32);
      this.ball=mixPoint(state.landing,receivePoint(player,1),u);
    }
    this.ballControl.phase=state.phase;
    if(t>=fall+state.approach+.32) {
      const caught={...this.ball},team=state.team;
      this.startPossession(team);
      this.collectBall(player,caught,.22);
      this.ball={...caught};
      this.scoredInbound=null;
      this.pause=0;
      this.emit('inbound',{team,player:player.id,afterScore:true});
    }
  }
  prepareInbound(team,duration) {
    this.nextTeam=team;
    this.pause=duration;
    const dir=this.direction(team);
    const spawn={x:-dir*8.4,z:0,heading:dir>0?Math.PI/2:-Math.PI/2};
    this.ballReturn={start:{...this.ball},end:dribblePoint(spawn,1,0),duration};
    this.ballControl={mode:'inbound'};
    this.owner=null;
  }
  nearestDefender(player) {
    return this.players.filter(p => p.team !== player.team).reduce((a, b) => dist(player, a) < dist(player, b) ? a : b);
  }
  movePlayers(dt) {
    updateMovement(this, dt);
  }
  pass() {
    if (!this.owner || this.flight) return;
    const from = this.owner;
    const recipient = chooseReceiver(this, from);
    const duration=PASS_GATHER+passFlightDuration(dist(from,recipient))+PASS_CATCH;
    from.heading=Math.atan2(recipient.x-from.x,recipient.z-from.z);
    from.throwHeading=from.heading;
    from.throwTime=duration;
    const hand=this.ballControl?.hand??1;
    this.flight={kind:'pass',team:from.team,from:from.id,to:recipient.id,
      hand,start:{...this.ball},release:releasePoint(from,'pass'),
      end:receivePoint(recipient,hand),t:0,duration,stage:'gather'};
    from.action='pass';from.actionTime=duration;
    recipient.action='catch';recipient.actionTime=duration;
    this.owner=null;
    this.ballControl={mode:'pass',hand,from:from.id,to:recipient.id};
    this.emit('pass', {team: from.team, player: from.id, target: recipient.id});
  }
  shoot() {
    if (!this.owner || this.flight) return;
    const from = this.owner;
    const hoop = this.basket(from.team);
    const distance = dist(from, hoop);
    const points=distance>=6.75?3:2;
    const defenderDistance=dist(from,this.nearestDefender(from));
    const isDunk=points===2&&distance<2.4&&Math.abs(from.z)<1.65&&
      (from.height>=1.95||defenderDistance>2)&&this.random()<.65;
    from.heading=Math.atan2(hoop.x-from.x,hoop.z-from.z);
    from.throwHeading=from.heading;
    from.throwTime=SHOT_GATHER+.15;
    const probability=isDunk?clamp(.93-(defenderDistance<1.5?.2:0),.52,.96):
      clamp((points===3?.39:.66)-Math.max(0,distance-3)*.018
        -(defenderDistance<1.6?.13:0),.15,.83);
    const defender = this.nearestDefender(from);
    const shootingFoul = defenderDistance < 1.65 && this.random() < .23
      && this.callFoul(defender.id, from.id, true, points);
    const duration=SHOT_GATHER+(isDunk?.27:(.85+distance/12));
    this.flight={kind:'shot',dunk:isDunk,team:from.team,from:from.id,points,probability,shootingFoul,
      start:{...this.ball},release:releasePoint(from,'shot'),
      end:{x:hoop.x,y:COURT.rimHeight,z:0},t:0,duration,stage:'gather'};
    from.action='shoot';from.actionTime=duration;
    startJump(from,isDunk?'dunk':'shot',isDunk?1.08:.50,.72);
    const defenders=this.players.filter(p=>p.team!==from.team)
      .filter(p=>dist(p,from)<3.4).sort((a,b)=>dist(a,from)-dist(b,from));
    if(defenders.length)startJump(defenders[0],'contest',.36,.62);
    this.owner=null;
    this.ballControl={mode:'shot',from:from.id};
    this.shots[from.team]++;
    this.emit(isDunk?'dunk':'shot',{team:from.team,player:from.id,points,distance});
  }
  updateFlight(dt) {
    const f = this.flight;
    f.t += dt / f.duration;
    const t=clamp(f.t,0,1);
    const elapsed=t*f.duration;
    // Track the actual jumping shooter's hands during gathering. Once the
    // ball has left the hands, freeze the release point for a stable arc.
    if(f.kind==='shot' && f.stage==='gather') {
      const shooter=this.players[f.from];
      f.release=releasePoint(shooter,'shot');
      f.release.y+=jumpHeight(shooter);
    }
    if(f.kind==='rebound') {
      if(!f.jumpTriggered && f.t>.30) {
        f.jumpTriggered=true;
        for(const team of [0,1]) {
          const rebounder=this.players.filter(p=>p.team===team)
            .sort((a,b)=>dist(a,f.end)-dist(b,f.end))[0];
          startJump(rebounder,'rebound',.37,.65);
        }
      }
      this.ball=arcPoint(f.start,f.end,t,.55);
    } else {
      const gather=f.kind==='pass'?PASS_GATHER:SHOT_GATHER;
      const catchTime=f.kind==='pass'?PASS_CATCH:0;
      const air=f.duration-gather-catchTime;
      if(elapsed<gather) {
        f.stage='gather';
        this.ball=mixPoint(f.start,f.release,blend(elapsed/gather));
      } else if(elapsed<gather+air) {
        f.stage='air';
        if(f.kind==='pass')f.end=receivePoint(this.players[f.to],f.hand);
        this.ball=arcPoint(f.release,f.end,(elapsed-gather)/air,f.kind==='shot'?(f.dunk?0:2.65):.74);
      } else if(f.kind==='pass') {
        f.stage='catch';
        f.end=receivePoint(this.players[f.to],f.hand);
        this.ball=mixPoint(f.end,dribblePoint(this.players[f.to],f.hand,0),
          blend((elapsed-gather-air)/catchTime));
      } else {
        f.stage='air';
        this.ball={...f.end};
      }
    }
    if (f.t < 1) return;
    this.flight = null;
    if (f.kind === 'pass') {
      const recipient = this.players[f.to];
      const closest = this.nearestDefender(recipient);
      if (dist(recipient, closest) < .7 && this.random() < .15) {
        this.steal(closest.team, closest.id);
      } else {
        this.owner=recipient;
        this.ballControl={mode:'dribble',hand:f.hand,phase:0,cooldown:.8};
        this.passes[f.team]++;
        this.decision=.65+this.random()*.75;
        resetIntent(this);
        this.ball=dribblePoint(recipient,f.hand,0);
      }
    } else if (f.kind === 'shot') {
      if (this.random() < f.probability) {
        this.score[f.team] += f.points;
        this.makes[f.team]++;
        if (f.points === 3) this.threes[f.team]++;
        this.ball = {...f.end};
        this.emit('score',{team:f.team,player:f.from,points:f.points,dunk:!!f.dunk});
        this.owner=null;
        if(f.shootingFoul)this.beginFreeThrows(f.from,1);
        else this.startScoredInbound(1-f.team);
      } else {
        this.emit('miss', {team: f.team, player: f.from, points: f.points});
        if (f.shootingFoul) {
          this.beginFreeThrows(f.from,1);
          return;
        }
        this.flight={kind:'rebound',team:f.team,from:f.from,
          start:{...f.end},end:{x:clamp(f.end.x-this.direction(f.team)*2.1,-13.3,13.3),
            y:.18,z:(this.random()-.5)*5},t:0,duration:.75};
        this.ballControl={mode:'rebound'};
      }
    } else {
      const reboundTeam = this.random() < .7 ? 1 - f.team : f.team;
      this.rebounds[reboundTeam]++;
      const near = this.players.filter(p => p.team === reboundTeam).sort((a, b) => dist(a, this.ball) - dist(b, this.ball))[0];
      const caught={...this.ball};
      this.startPossession(reboundTeam);
      this.collectBall(near,caught);
      this.shotClock=reboundTeam===f.team?14:24;
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
      this.beginFreeThrows(attackerId,1);
    } else {
      const retainedClock = Math.max(14, this.shotClock);
      const previous={...this.ball};
      this.startPossession(offense,true);
      this.collectBall(this.owner,previous,.5);
      this.shotClock=retainedClock;
      this.emit('inbound', {team: offense, afterFoul: true});
    }
    return true;
  }
  beginFreeThrows(shooterId, attempts) {
    attempts=1; // One visible attempt per foul in this simulator.
    const shooter = this.players[shooterId];
    if (!shooter || !Number.isInteger(attempts) || attempts < 1) return;
    const sign = this.direction(shooter.team);
    const incoming={...this.ball};
    this.possession = shooter.team;
    this.flight = null;
    this.owner = null;
    this.pause = 0;
    this.scoredInbound=null;
    this.freeThrows = {shooter: shooterId, team: shooter.team, total: attempts, remaining: attempts,
      completed:0,made:0,state:'setup',timer:FT_SETUP_SECONDS,lastMade:false,setupStart:incoming};
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
    this.ball={...incoming};
    this.ballControl={mode:'freeThrow',from:shooterId};
    this.emit('freeThrowStart', {team: shooter.team, player: shooterId, attempts});
  }
  updateFreeThrows(dt) {
    const ft = this.freeThrows;
    if (!ft) return;
    const shooter = this.players[ft.shooter];
    const direction = this.direction(ft.team);
    ft.timer -= dt;
    if (ft.state === 'setup') {
      this.ball=mixPoint(ft.setupStart,releasePoint(shooter,'shot'),
        blend(1-Math.max(0,ft.timer)/FT_SETUP_SECONDS));
      if (ft.timer <= 0) {
        ft.state = 'flight';
        ft.timer = FT_FLIGHT_SECONDS;
        ft.willMake = this.random() < .76;
        shooter.action = 'shoot';
        shooter.actionTime = FT_FLIGHT_SECONDS;
        ft.start = {...this.ball};
        ft.end = {x: direction * COURT.basketX, y: COURT.rimHeight, z: 0};
        this.ftAttempts[ft.team]++;
        this.emit('freeThrowAttempt', {team: ft.team, player: ft.shooter, attempt: ft.completed + 1, total: ft.total});
      }
      return;
    }
    const t = clamp(1 - ft.timer / FT_FLIGHT_SECONDS, 0, 1);
    shooter.actionTime = Math.max(0, ft.timer);
    this.ball = {
      x: ft.start.x + (ft.end.x - ft.start.x) * t,
      y: ft.start.y + (ft.end.y - ft.start.y) * t + Math.sin(Math.PI * t) * 1.4,
      z: ft.start.z + (ft.end.z - ft.start.z) * t,
    };
    if (ft.timer > 0) return;
    shooter.action = 'idle';
    shooter.actionTime = 0;
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
      ft.state='setup';
      ft.timer=FT_SETUP_SECONDS;
      ft.setupStart={...this.ball};
      shooter.action='idle';
      return;
    }
    this.freeThrows = null;
    if (ft.lastMade) {
      this.prepareInbound(1-ft.team,2);
    } else {
      const reboundTeam = this.random() < .7 ? 1 - ft.team : ft.team;
      this.rebounds[reboundTeam]++;
      const rebounder = this.players.filter(p => p.team === reboundTeam)
        .sort((a, b) => dist(a, this.ball) - dist(b, this.ball))[0];
      const caught={...this.ball};
      this.startPossession(reboundTeam);
      this.collectBall(rebounder,caught);
      this.shotClock=reboundTeam===ft.team?14:24;
      this.emit('rebound', {team: reboundTeam, player: rebounder.id, afterFreeThrow: true});
    }
  }
  steal(team, playerId = team * 5) {
    const losingTeam = 1 - team;
    this.turnovers[losingTeam]++;
    this.steals[team]++;
    const caught={...this.ball};
    this.startPossession(team);
    this.collectBall(this.players[playerId],caught);
    this.emit('steal', {team, player: playerId});
  }
  violation() {
    const loser = this.possession;
    this.turnovers[loser]++;
    const previous={...this.ball};
    this.startPossession(1-loser,true);
    this.collectBall(this.owner,previous,.5);
    this.emit('violation',{team:loser});
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
    this.clock=600;
    this.prepareInbound(this.quarter%2===0?1:0,2.3);
  }
  update(dt) {
    if (this.ended || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, .15);
    this.elapsed += dt;
    advanceJumps(this.players,dt);
    if (this.freeThrows) {
      this.updateFreeThrows(dt);
      return;
    }
    if(this.pause>0) {
      if(this.scoredInbound){this.updateScoredInbound(dt);return;}
      this.pause=Math.max(0,this.pause-dt);
      if(this.ballReturn) {
        const r=this.ballReturn;
        this.ball=mixPoint(r.start,r.end,blend(1-this.pause/r.duration));
      }
      if(this.pause===0) {
        this.startPossession(this.nextTeam,true);
        this.ballReturn=null;
        this.emit('inbound',{team:this.possession});
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
    this.syncHeldBall(dt);
    if (!this.owner) return;
    const defender = this.nearestDefender(this.owner);
    if(this.ballControl?.mode==='secure')return;
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
    const carrier = this.owner;
    const range = dist(carrier, this.basket(this.possession));
    const gap = dist(carrier, this.nearestDefender(carrier));
    const urgency = this.shotClock < 5.5;
    const openLook = range < 8.5 && gap > 1.75;
    const inclination = this.settings.style === 'perimeter' ? .59 : .47;
    const mature = this.possessionAge > 4.0;
    const keepDriving=carrier.plan==='drive'&&range>1.55&&range<3.5&&gap>1.45&&!urgency;
    const shouldShoot = !keepDriving&&(urgency || range < 1.85
      || (mature && range < 9 && this.random() <
        (openLook ? inclination + .25 : inclination * .6)));
    if (shouldShoot) {
      this.shoot();
    } else if (range > 4.0 && gap > 1.5 && this.shotClock > 8
        && this.random() < .43) {
      // Keep dribbling for a short, individual drive rather than passing on
      // every decision. Steering will follow the holder's current intention.
      carrier.plan = 'drive';
      carrier.intent = 'drive';
      const sign = this.direction(carrier.team);
      carrier.targetX = sign * (COURT.basketX - Math.max(.78,range-3.5));
      carrier.targetZ = clamp(carrier.z*.45+carrier.variation*.65,-1.5,1.5);
      carrier.thinkIn = 1.5;
      this.decision = 1.1 + this.random() * .75;
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
      freeThrows:this.freeThrows?{...this.freeThrows}:null,
      scoredInbound:this.scoredInbound?{phase:this.scoredInbound.phase,picker:this.scoredInbound.picker}:null,
      jumps:this.players.map(p=>p.jump?{...p.jump}:null),
      ball:{...this.ball},ballControl:this.ballControl?{...this.ballControl}:null,
      players: this.players.map(p => ({id: p.id, team: p.team, x: p.x, z: p.z,
        speed: p.speed, action: p.action, intent: p.intent, targetX: p.targetX, targetZ: p.targetZ}))};
  }
}
