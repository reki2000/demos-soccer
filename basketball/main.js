import { BasketballMatch, SQUADS, COURT } from './simulation.js';
import { ArenaScene } from './scene.js';

const $ = id => document.getElementById(id);
let squads = [SQUADS[0], SQUADS[1]];
let playing = true, speed = 1, scene = null, last = performance.now(), statsElapsed = 0, toastTimer;
let match;
const captions = {
  pass: 'パスがつながる。オフェンスが展開する。',
  shot: 'リングへ放った！ シュートの行方は…',
  miss: 'シュートは外れた。リバウンド争い！',
  rebound: 'リバウンドを確保。次の攻撃へ。',
  steal: 'ボールを奪った！ 素早い切り替え。',
  violation: '24秒バイオレーション。攻守交代。',
  quarter: 'クォーター終了。次のピリオドへ。',
  inbound: 'インバウンド。プレー再開。',
  fulltime: 'ゲーム終了。両チームのスコアが確定した。',
};
function displayEvent(type, info) {
  const major = ['score','quarter','fulltime','violation'].includes(type);
  const title = type === 'score' ? (info.points === 3 ? 'THREE POINTS!' : 'TWO POINTS!')
    : type === 'fulltime' ? 'FULL TIME'
    : type === 'quarter' ? 'END OF Q' + info.completed
    : type === 'violation' ? 'SHOT CLOCK'
    : type === 'steal' ? 'STEAL!' : type === 'rebound' ? 'REBOUND' : type === 'shot' ? 'SHOT ATTEMPT'
    : type === 'pass' ? 'PASS' : 'PLAY ON';
  let description = captions[type] || '';
  if (type === 'score') {
    const player = match.players[info.player];
    description = squads[info.team].code + ' · #' + player.number + ' ' + squads[info.team].names[player.slot] +
      '  /  ' + match.score.join(' : ');
  }
  $('commentary').textContent = description;
  if (type === 'pass' || type === 'shot' || type === 'rebound') return;
  $('event-title').textContent = title;
  $('event-subtitle').textContent = description;
  const toast = $('event-toast');
  toast.classList.toggle('major', major);
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), major ? 2000 : 1100);
}
match = new BasketballMatch(displayEvent);

function setPlaying(value) {
  playing = value;
  $('play').textContent = value ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-label', value ? '一時停止' : '再生');
  $('live-label').textContent = match.ended ? 'FINAL SCORE' : value ? 'LIVE GAME' : 'PAUSED';
}
function restart() {
  match.reset();
  match.settings.style = $('style-select').value;
  setPlaying(true);
  clearTimeout(toastTimer);
  $('event-toast').classList.remove('visible');
  $('commentary').textContent = 'ティップオフ！ ボールがコートを動き始める。';
  updateUI();
}
for (const side of ['home', 'away']) {
  const select = $(side + '-select');
  for (const item of SQUADS) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    select.add(option);
  }
}
$('home-select').value = squads[0].id;
$('away-select').value = squads[1].id;
function refreshSquads(changed) {
  const index = changed === 'home' ? 0 : 1, other = 1 - index;
  const selected = SQUADS.find(s => s.id === $(changed + '-select').value);
  if (selected.id === squads[other].id) {
    squads[other] = squads[index];
    $((index === 0 ? 'away' : 'home') + '-select').value = squads[other].id;
  }
  squads[index] = selected;
  updateSquadLabels();
  restart();
  scene?.setSquads(squads);
}
function updateSquadLabels() {
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 'home' : 'away';
    $(side + '-code').textContent = squads[i].code;
    $(side + '-name').textContent = squads[i].name;
    document.querySelector('.' + side + '-marker').style.background =
      '#' + squads[i].color.toString(16).padStart(6,'0');
  }
}
$('home-select').addEventListener('change', () => refreshSquads('home'));
$('away-select').addEventListener('change', () => refreshSquads('away'));
$('style-select').addEventListener('change', e => match.settings.style = e.target.value);
$('play').addEventListener('click', () => {
  if (match.ended) restart();
  else setPlaying(!playing);
});
$('reset').addEventListener('click', restart);
$('new-match').addEventListener('click', restart);
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' || ['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName)) return;
  e.preventDefault();
  if (match.ended) restart(); else setPlaying(!playing);
});
document.querySelectorAll('[data-speed]').forEach(button => button.addEventListener('click', () => {
  speed = Number(button.dataset.speed);
  document.querySelectorAll('[data-speed]').forEach(other => other.classList.toggle('active', other === button));
}));
const cameraHints = {
  broadcast: ['BROADCAST CAMERA','コート全体を捉えた中継アングル。'],
  follow: ['BALL FOLLOW','ボールの動きに合わせてカメラが追従。'],
  tactical: ['TACTICAL OVERHEAD','選手配置を上空から確認。'],
  free: ['FREE CAMERA','ドラッグで回転、ホイールでズーム。'],
};
document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => {
  const mode = button.dataset.camera;
  scene?.setCamera(mode);
  document.querySelectorAll('[data-camera]').forEach(other => other.classList.toggle('active', other === button));
  $('camera-label').textContent = cameraHints[mode][0];
  $('camera-help').textContent = cameraHints[mode][1];
}));
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('viewport').requestFullscreen();
  } catch {
    displayEvent('fullscreen', {});
  }
});

function formatClock(time) {
  const t = Math.max(0, Math.ceil(time));
  return String(Math.floor(t / 60)).padStart(2,'0') + ':' + String(t % 60).padStart(2,'0');
}
function updateUI() {
  $('period').textContent = match.ended ? 'FT' : 'Q' + match.quarter;
  $('match-time').textContent = formatClock(match.clock);
  $('shot-clock').textContent = String(Math.ceil(match.shotClock)).padStart(2,'0');
  $('shot-clock').classList.toggle('urgent', match.shotClock <= 5);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 'home' : 'away';
    $(side + '-score').textContent = match.score[i];
    $(side + '-fg').textContent = match.makes[i] + '/' + match.shots[i];
    $(side + '-rebounds').textContent = match.rebounds[i];
    $(side + '-turnovers').textContent = match.turnovers[i];
  }
  const total = match.possessionTime[0] + match.possessionTime[1];
  const pct = total > 0 ? Math.round(100 * match.possessionTime[0] / total) : 50;
  $('home-possession').textContent = pct + '%';
  $('away-possession').textContent = 100 - pct + '%';
  $('possession-fill').style.width = pct + '%';
  const p = match.owner;
  $('player-card').hidden = !p;
  if (p) {
    $('player-number').textContent = p.number;
    $('player-number').style.background = '#' + squads[p.team].color.toString(16).padStart(6,'0');
    $('player-number').style.color = '#' + squads[p.team].trim.toString(16).padStart(6,'0');
    $('player-name').textContent = squads[p.team].names[p.slot];
    $('player-team').textContent = squads[p.team].name + ' · ' + Math.round(p.height * 100) + ' cm';
  }
  if (match.ended) $('live-label').textContent = 'FINAL SCORE';
}
const map = $('minimap');
const ctx = map.getContext('2d');
function drawMap() {
  ctx.clearRect(0,0,map.width,map.height);
  ctx.strokeStyle = 'rgba(255,239,210,.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(12,10,208,112);
  ctx.beginPath();ctx.moveTo(116,10);ctx.lineTo(116,122);ctx.stroke();
  ctx.beginPath();ctx.arc(116,66,15,0,Math.PI*2);ctx.stroke();
  for (const side of [-1,1]) {
    const x = 116 + side * 91;
    ctx.beginPath();ctx.arc(x,66,26,Math.PI*.5,Math.PI*1.5,side < 0);ctx.stroke();
  }
  for (const p of match.players) {
    ctx.fillStyle = '#' + squads[p.team].color.toString(16).padStart(6,'0');
    ctx.beginPath();ctx.arc(116 + p.x / COURT.length * 208,66 + p.z / COURT.width * 112,3.8,0,Math.PI*2);ctx.fill();
    if (p === match.owner) {
      ctx.strokeStyle = '#fff';
      ctx.beginPath();ctx.arc(116+p.x/COURT.length*208,66+p.z/COURT.width*112,6.3,0,Math.PI*2);ctx.stroke();
    }
  }
  ctx.fillStyle='#fff3d2';
  ctx.beginPath();ctx.arc(116+match.ball.x/COURT.length*208,66+match.ball.z/COURT.width*112,2.1,0,Math.PI*2);ctx.fill();
}
try {
  scene = new ArenaScene($('viewport'), match, squads);
  $('loading').remove();
} catch (error) {
  $('loading').textContent = '3D表示を開始できませんでした。WebGL対応ブラウザで開いてください。';
  console.error(error);
}
function animate(now) {
  const dt = Math.min(Math.max(0,(now - last) / 1000), .07);
  last = now;
  if (playing && !match.ended) {
    const gameSeconds = dt * 8 * speed;
    const steps = Math.ceil(gameSeconds / .06);
    for (let i = 0; i < steps; i++) match.update(gameSeconds / steps);
    if (match.ended) setPlaying(false);
  }
  scene?.update(dt);
  statsElapsed += dt;
  if (statsElapsed >= .1) {
    statsElapsed = 0;
    updateUI();
    drawMap();
  }
  requestAnimationFrame(animate);
}
updateSquadLabels();
updateUI();
drawMap();
requestAnimationFrame(animate);
window.courtside = {snapshot: () => match.snapshot()};
