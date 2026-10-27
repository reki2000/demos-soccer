import { COMMENTARY_BANK } from './commentary-lines.js';

const EVENT_CATEGORIES = {
  'KICK OFF': ['kickoff', 80], 'GOAL!': ['goal', 100], SHOT: ['shot', 65],
  SAVED: ['save', 75], BLOCKED: ['block', 70], 'GOAL KICK': ['goalKick', 80],
  'CORNER KICK': ['corner', 80], 'THROW IN': ['throwIn', 80], FOUL: ['foul', 85],
  'HALF TIME': ['halftime', 90], 'SECOND HALF': ['secondHalf', 90], 'FULL TIME': ['fulltime', 100],
  HEADER: ['headerPass', 60], 'CHEST CONTROL': ['chest', 40], 'HEAVY TOUCH': ['heavyTouch', 60],
};

export class Commentary {
  constructor(onCaption = () => {}, random = Math.random) {
    this.onCaption = onCaption;
    this.random = random;
    this.enabled = true;
    this.clear();
  }

  clear() {
    this.now = 0;
    this.current = null;
    this.pending = [];
    this.used = new Map();
    this.lastOpening = {};
    this.lastPossessionTeam = null;
    this.lastCategory = new Map();
    this.nextAmbient = 0;
    this.previous = {};
    this.lastTurnover = -100;
    this.onCaption(null);
  }

  reset(match, teams) {
    this.clear();
    this.event('KICK OFF', match, teams);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.current = null;
    this.pending = [];
    this.nextAmbient = this.now;
    this.onCaption(null);
  }

  context(match, teams) {
    const player = match.celebration ? match.players[match.celebration.scorer]
      : match.owner ?? (match.flight ? match.players[match.flight.passer] : null)
        ?? match.players[match.lastTouchPlayer];
    const team = match.celebration?.team ?? match.restart?.team ?? match.setPiece?.team ?? player?.team ?? 0;
    const receiver = match.flight?.target != null ? match.players[match.flight.target] : null;
    return {
      player: player?.profile?.displayName ?? player?.profile?.name ?? `${(player?.slot ?? 0) + 1}番の選手`,
      receiver: receiver?.profile?.displayName ?? receiver?.profile?.name ?? '前方の味方',
      team: teams[team].name, opponent: teams[1 - team].name,
      score: `${match.score[0]}対${match.score[1]}`,
      clock: `${String(Math.floor(match.time / 60)).padStart(2, '0')}:${String(Math.floor(match.time % 60)).padStart(2, '0')}`,
    };
  }

  event(title, match, teams) {
    const mapping = EVENT_CATEGORIES[title];
    if (!mapping) return;
    let [category, priority] = mapping;
    if (title === 'GOAL!') {
      const team = match.celebration?.team;
      if (team != null) {
        if (match.score[team] === match.score[1 - team]) category = 'equalizer';
        else if (match.score[team] === match.score[1 - team] + 1) category = 'goalLead';
      }
    }
    if (title === 'HEADER' && (match.flight?.shot || match.owner)) category = 'headerShot';
    this.offer(category, this.context(match, teams), priority);
  }

  offer(category, context, priority = 20) {
    if (!this.enabled) return;
    const since = this.now - (this.lastCategory.get(category) ?? -100);
    if (since < (priority >= 80 ? .6 : 5)) return;
    const item = { category, context, priority, expires: this.now + (priority >= 80 ? 4 : 1.6) };
    if (!this.current || priority > this.current.priority || (this.now >= this.current.until && priority >= this.current.priority)) {
      this.show(item);
    } else if (priority >= 40) {
      this.pending = this.pending.filter(p => p.category !== category && p.expires > this.now);
      this.pending.push(item);
      this.pending.sort((a, b) => b.priority - a.priority);
      this.pending = this.pending.slice(0, 3);
    }
  }

  show(item) {
    const history = this.used.get(item.category) ?? [];
    const lines = COMMENTARY_BANK[item.category];
    // Avoid both recently used complete lines and the same opening on consecutive calls.
    let available = lines.filter(line => !history.includes(line.id)
      && Math.floor(Number(line.id.split('-').at(-1)) / 5) !== this.lastOpening?.[item.category]);
    if (!available.length) available = lines.filter(line => !history.slice(-4).includes(line.id));
    const line = available[Math.floor(this.random() * available.length)];
    history.push(line.id);
    this.used.set(item.category, history.slice(-15));
    this.lastOpening ??= {};
    this.lastOpening[item.category] = Math.floor(Number(line.id.split('-').at(-1)) / 5);
    const text = line.text.replace(/\{(\w+)\}/g, (_, key) => item.context[key] ?? '');
    this.current = { ...item, id: line.id, text, until: this.now + Math.max(3.4, Math.min(7, text.length / 12)) };
    this.lastCategory.set(item.category, this.now);
    this.nextAmbient = this.current.until + .4;
    this.onCaption({ text, clock: item.context.clock, category: item.category, id: line.id });
  }

  update(dt, match, teams, playing) {
    if (!this.enabled || (!playing && !match.ended)) return;
    this.now += dt;
    if (this.current && this.now >= this.current.until) {
      this.current = null;
      this.onCaption(null);
      this.pending = this.pending.filter(p => p.expires > this.now);
      if (this.pending.length) this.show(this.pending.shift());
    }
    const context = this.context(match, teams);
    const state = {
      flight: match.flight, control: match.control, duel: match.duel, loose: !!match.loose,
      ownerTeam: match.owner?.team, piece: match.setPiece, phase: match.setPiece?.phase,
      celebration: match.celebration?.phase,
    };
    const old = this.previous;
    if (state.flight && state.flight !== old.flight && !state.flight.shot && !state.flight.header && !state.flight.throwIn) {
      this.offer(state.flight.speculative ? 'throughPass' : state.flight.lofted ? 'longPass' : 'pass', context, 25);
    }
    if (state.duel && state.duel !== old.duel) this.offer('duel', context, 35);
    if (state.control && state.control !== old.control && match.owner?.action === 'foot') this.offer('footTrap', context, 25);
    if (state.loose && !old.loose) this.offer('loose', context, 25);
    if (old.loose && match.owner) this.offer('recovery', context, 40);
    if (this.lastPossessionTeam != null && state.ownerTeam != null && this.lastPossessionTeam !== state.ownerTeam) {
      this.lastTurnover = this.now;
      this.offer('turnover', context, 45);
    }
    if (state.ownerTeam != null) this.lastPossessionTeam = state.ownerTeam;
    if (state.piece?.type === 'freeKick' && state.piece !== old.piece) this.offer('freeKick', context, 55);
    if (state.phase === 'runup' && old.phase !== 'runup') this.offer('runup', context, 40);
    if (state.celebration === 'return' && old.celebration !== 'return') this.offer('return', context, 35);
    this.previous = state;
    if (match.ended || this.current || this.now < this.nextAmbient) return;
    if (match.celebration) {
      this.offer(match.celebration.phase === 'celebrate' ? 'celebration' : 'return', context);
      return;
    }
    if (match.pause || match.setPiece || !match.owner) return;
    const p = match.owner;
    const options = ['dribble'];
    if (p.slot === 0) options.splice(0, 1, 'goalkeeper');
    else {
      if (p.x * match.direction(p.team) > 25) options.push('attack');
      if (Math.abs(p.z) > 22) options.push('wide');
      if (match.settings[p.team].tactic === 'possession') options.push('possession');
      if (match.settings[p.team].tactic === 'counter' && this.now - this.lastTurnover < 6) options.push('counter');
      if (match.players.filter(q => q.team !== p.team && Math.hypot(q.x - p.x, q.z - p.z) < 7).length >= 2) options.push('press');
      if (match.players.some(q => q.team === p.team && q.intent?.role === 'support' && Math.hypot(q.x - p.x, q.z - p.z) < 18)) options.push('support');
      if (match.players.some(q => q.team !== p.team && q.intent?.role === 'mark')) options.push('marking');
    }
    if (match.time >= 4800) options.push('closing');
    const eligible = options.filter(category => this.now - (this.lastCategory.get(category) ?? -100) > 12);
    if (eligible.length) this.offer(eligible[Math.floor(this.random() * eligible.length)], context);
    this.nextAmbient = Math.max(this.nextAmbient, this.now + 2);
  }
}
