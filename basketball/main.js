import { BasketballMatch, SQUADS, COURT, playerDisplayName } from './simulation.js';
import { ArenaScene } from './scene.js';
import { ArenaAudio } from './audio.js';
import {createBasketballCommentary} from './commentary.js';

const $ = id => document.getElementById(id);
let squads = [SQUADS[0], SQUADS[1]];
let playing = true, speed = 1, scene = null, last = performance.now(), statsElapsed = 0, toastTimer;
let match;
const arenaAudio=new ArenaAudio();
arenaAudio.voicePreference='male'; // Play-by-play and analyst are two different men.
const describePlay=createBasketballCommentary();
let eventSeq=0;
const ANALYSIS_TYPES=['score','dunk','shot','miss','rebound','steal','foul','feint','freeThrowMade','pass'];
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
  foul: 'ディフェンスのファウル。笛が鳴りました。',
  freeThrowStart: 'フリースロー。プレーヤーがラインに立ちます。',
  freeThrowAttempt: 'フリースローのボールが放たれた。',
  freeThrowMade: 'フリースロー成功！ 1点追加。',
  freeThrowMissed: 'フリースロー失敗。',
};
function displayEvent(type, info) {
  const seq=++eventSeq;
  const major = ['score','quarter','fulltime','violation','foul','freeThrowStart','freeThrowMade','freeThrowMissed'].includes(type);
  const title=type==='score'?(info.dunk?'SLAM DUNK!':info.points===3?'THREE POINTS!':'TWO POINTS!')
    : type === 'dunk' ? 'DUNK ATTEMPT'
    : type === 'fulltime' ? 'FULL TIME'
    : type === 'quarter' ? 'END OF Q' + info.completed
    : type === 'foul' ? 'PERSONAL FOUL'
    : type === 'freeThrowStart' ? 'FREE THROWS'
    : type === 'freeThrowAttempt' ? 'AT THE LINE'
    : type === 'freeThrowMade' ? 'FREE THROW GOOD'
    : type === 'freeThrowMissed' ? 'FREE THROW MISSED'
    : type === 'violation' ? 'SHOT CLOCK'
    : type === 'steal' ? 'STEAL!' : type === 'rebound' ? 'REBOUND' : type === 'shot' ? 'SHOT ATTEMPT'
    : type === 'feint' ? 'CROSSOVER!'
    : type === 'pass' ? 'PASS' : 'PLAY ON';
  const narration=describePlay(type,info,match,squads)||captions[type]||'';
  let description=narration;
  if (type === 'score') {
    const player = match.players[info.player];
    description = squads[info.team].code + ' · #' + player.number + ' ' + playerDisplayName(squads[info.team],player.slot) +
      '  /  ' + match.score.join(' : ');
  }
  if (type === 'foul') {
    const defender = match.players[info.player];
    description = squads[info.team].code + ' · #' + defender.number + ' ' + playerDisplayName(squads[info.team],defender.slot) +
      ' / ' + info.playerFouls + ' PF · ' + info.teamFouls + ' TEAM FOULS' +
      (info.shooting ? ' · SHOOTING FOUL' : info.bonus ? ' · BONUS' : '');
  }
  if (type === 'freeThrowStart') description = playerDisplayName(squads[info.team],match.players[info.player].slot) +
    ' · ' + info.attempts + ' FREE THROW' + (info.attempts > 1 ? 'S' : '');
  if (type === 'freeThrowMade' || type === 'freeThrowMissed') {
    description = squads[info.team].code + ' · ' + info.attempt + '/' + info.total +
      ' · ' + match.score.join(' : ');
  }
  $('commentary').textContent=narration;
  arenaAudio.onEvent(type,{...info,commentary:narration},squads);
  // Analyst follow-up: a few seconds later the second voice explains the
  // meaning of the play and the background behind it, unless a newer play
  // has already taken the microphone.
  if (ANALYSIS_TYPES.includes(type)) {
    const analysis=describePlay.analysis(type,info,match,squads);
    if (analysis) setTimeout(()=>{
      if (seq!==eventSeq||!playing)return;
      $('commentary').textContent='【解説】'+analysis;
      if (arenaAudio.commentaryEnabled) arenaAudio.speak(analysis,false,'analysis');
    },3000);
  }
  if (type === 'pass' || type === 'shot' || type === 'rebound') return;
  $('event-title').textContent = title;
  $('event-subtitle').textContent = description;
  const toast = $('event-toast');
  toast.classList.toggle('major',major);
  toast.classList.toggle('score-event',type==='score'||type==='freeThrowMade');
  const large=$('event-big-score');
  large.hidden=!(type==='score'||type==='freeThrowMade');
  if(!large.hidden)large.textContent=match.score.join('  :  ');
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('visible'),type==='score'?2800:major?2000:1100);
}
match = new BasketballMatch(displayEvent);

function setPlaying(value) {
  playing = value;
  arenaAudio.setPlaying(value);
  $('play').textContent = value ? 'Ⅱ' : '▶';
  $('play').setAttribute('aria-label', value ? '一時停止' : '再生');
  $('live-label').textContent = match.ended ? 'FINAL SCORE' : value ? 'LIVE GAME' : 'PAUSED';
}
function restart() {
  arenaAudio.stopSpeech();
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
  arenaAudio.setSpeed(speed);
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
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $('viewport').requestFullscreen();
  } catch {
    displayEvent('fullscreen', {});
  }
}
$('fullscreen').addEventListener('click',toggleFullscreen);
$('fullscreen-inview').addEventListener('click',toggleFullscreen);
function refreshAudioButtons() {
  const crowd=arenaAudio.crowdEnabled,voice=arenaAudio.commentaryEnabled;
  $('crowd-toggle').setAttribute('aria-pressed',String(crowd));
  $('voice-toggle').setAttribute('aria-pressed',String(voice));
  $('crowd-toggle').textContent='観客音 '+(crowd?'ON':'OFF');
  $('voice-toggle').textContent='実況音声 '+(voice?'ON':'OFF');
  const title=crowd&&voice?'♪ 音声テスト':'♪ 音声を開始';
  $('audio-enable-inview').textContent=title;
  $('voice-toggle').textContent='実況 '+(voice?'ON':'OFF');
  $('crowd-toggle').textContent='効果音 '+(crowd?'ON':'OFF');
}
arenaAudio.onStatus=({channel,message,state})=>{
  const status=$('audio-status');
  status.textContent=message;
  status.dataset.state=state;
  refreshAudioButtons();
};
async function enableAudio() {
  // Speech must be called synchronously from the click, not after await.
  const supported=arenaAudio.setCommentary(true);
  if(supported)arenaAudio.testSpeech();
  const crowdReady=await arenaAudio.setCrowd(true);
  arenaAudio.setPlaying(playing);
  refreshAudioButtons();
  if(!crowdReady && supported) {
    $('audio-status').textContent='実況音声を有効にしました。観客音はブラウザの音声設定を確認してください。';
  } else if(!supported && crowdReady) {
    $('audio-status').textContent='観客音を有効にしました。実況には端末の日本語読み上げ機能が必要です。';
  }
}
$('audio-enable-inview').addEventListener('click',enableAudio);
$('crowd-toggle').addEventListener('click',async()=>{
  const enabled=!arenaAudio.crowdEnabled;
  await arenaAudio.setCrowd(enabled);
  arenaAudio.setPlaying(playing);
  refreshAudioButtons();
});
$('voice-toggle').addEventListener('click',()=>{
  const enabled=!arenaAudio.commentaryEnabled;
  const supported=arenaAudio.setCommentary(enabled);
  if(enabled&&supported)arenaAudio.testSpeech();
  refreshAudioButtons();
});
refreshAudioButtons();


function formatClock(time) {
  const t = Math.max(0, Math.ceil(time));
  return String(Math.floor(t / 60)).padStart(2,'0') + ':' + String(t % 60).padStart(2,'0');
}
function updateUI() {
  $('period').textContent = match.ended ? 'FT' : 'Q' + match.quarter;
  $('match-time').textContent = formatClock(match.clock);
  $('shot-clock').textContent = match.freeThrows ? 'FT' : String(Math.ceil(match.shotClock)).padStart(2,'0');
  $('shot-clock').classList.toggle('urgent', match.shotClock <= 5);
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 'home' : 'away';
    $(side + '-score').textContent = match.score[i];
    $(side + '-fg').textContent = match.makes[i] + '/' + match.shots[i];
    $(side + '-rebounds').textContent = match.rebounds[i];
    $(side + '-turnovers').textContent = match.turnovers[i];
    $(side + '-fouls').textContent = match.teamFouls[i];
    $(side + '-ft').textContent = match.ftMakes[i] + '/' + match.ftAttempts[i];
  }
  const total = match.possessionTime[0] + match.possessionTime[1];
  const pct = total > 0 ? Math.round(100 * match.possessionTime[0] / total) : 50;
  $('home-possession').textContent = pct + '%';
  $('away-possession').textContent = 100 - pct + '%';
  $('possession-fill').style.width = pct + '%';
  const p = match.freeThrows ? match.players[match.freeThrows.shooter] : match.owner;
  document.querySelector('.mini-label').textContent = match.freeThrows ? 'AT THE LINE' : 'ON THE BALL';
  $('player-card').hidden = !p;
  if (p) {
    $('player-number').textContent = p.number;
    $('player-number').style.background = '#' + squads[p.team].color.toString(16).padStart(6,'0');
    $('player-number').style.color = '#' + squads[p.team].trim.toString(16).padStart(6,'0');
    $('player-name').textContent = playerDisplayName(squads[p.team],p.slot);
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
    const gameSeconds = dt * speed * 1.3;
    const steps = Math.ceil(gameSeconds / .06);
    for (let i = 0; i < steps; i++) match.update(gameSeconds / steps);
    if (match.ended) setPlaying(false);
  }
  if(playing)arenaAudio.update(dt,match,'basketball');
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
