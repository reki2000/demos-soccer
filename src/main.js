import {Highlights} from './highlights.js';
import {Commentary} from './commentary.js';
import {assignProfiles,playerPosition} from './roster.js';
import {Match,countries} from './simulation.js';
import {StadiumScene} from './scene.js';
import {ArenaAudio} from '../basketball/audio.js';
const $=id=>document.getElementById(id);
const teams=[countries[0],countries[1]];let activeTeam=0,playing=true,speed=1,toastTimer;
const arenaAudio=new ArenaAudio();
arenaAudio.speechRate=2.14; // 1.5x the previous 1.43 Japanese play-by-play rate.
arenaAudio.voicePreference='male'; // Prefer installed Japanese male voices.
let lastCaptionSpeech=0;
function toast(title,subtitle){
  const el=$('event-toast');
  const central=['KICK OFF','GOAL!','GOAL KICK','CORNER KICK','THROW IN','FOUL','HALF TIME','SECOND HALF','FULL TIME'].includes(title);
  const scoreEvent=title==='GOAL!'||title==='FULL TIME';
  el.classList.toggle('center-event',central);el.classList.toggle('score-event',scoreEvent);
  el.replaceChildren(document.createTextNode(title));
  if(scoreEvent){
    const score=document.createElement('b');score.className='event-score';score.textContent=match.score.join(' : ');el.appendChild(score);
    const names=document.createElement('small');names.className='event-teams';names.textContent=teams[0].name+'  —  '+teams[1].name;el.appendChild(names);
  }
  const sub=document.createElement('span');sub.textContent=subtitle;el.appendChild(sub);el.classList.add('visible');
  if(title==='GOAL!')arenaAudio.react('score');
  if(title==='FOUL')arenaAudio.react('foul');
  if(['HALF TIME','FULL TIME','SECOND HALF'].includes(title))arenaAudio.react('quarter');
  if(['SHOT','SAVED','BLOCKED','GOAL KICK','CORNER KICK'].includes(title))arenaAudio.react('shot');
  if(['GOAL KICK','CORNER KICK'].includes(title))arenaAudio.effect('kick');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),scoreEvent?(title==='FULL TIME'?3500:2300):central?1600:2300);
}
const highlights=new Highlights((clip,index,total)=>{
  $('replay-badge').hidden=false;$('replay-badge').textContent=`REPLAY ${index+1} / ${total} · SLOW MOTION`;
});

const commentary=new Commentary(caption=>{
  $('commentary-text').textContent=caption?.text??'';
  $('commentary-time').textContent=caption?.clock??'';
  $('commentary').classList.toggle('speaking',!!caption);
  if(caption&&arenaAudio.commentaryEnabled&&playing&&!highlights?.active){
    const now=Date.now();
    if(now-lastCaptionSpeech>2300 && arenaAudio.speak(caption.text))lastCaptionSpeech=now;
  }
});
new ResizeObserver(entries=>{const height=entries[0].contentRect.height;$('viewport').style.setProperty('--caption-offset',Math.ceil(height+40)+'px')}).observe($('commentary'));
const match=new Match((title,subtitle)=>{toast(title,subtitle);commentary.event(title,match,teams);highlights.event(title,match)});assignProfiles(match,teams);let displayMatch=match;let scene;
try{scene=new StadiumScene($('viewport'),match,teams);$('loading').remove()}catch(error){$('loading').textContent='3D表示を開始できませんでした。WebGL対応ブラウザで開いてください。';console.error(error)}
for(const side of ['home','away']){const index=side==='home'?0:1;const select=$(side+'-select');for(const c of countries){const opt=document.createElement('option');opt.value=c.id;opt.textContent=`${c.name} / ${c.code}`;select.appendChild(opt)}select.value=teams[index].id;select.addEventListener('change',()=>{const next=countries.find(c=>c.id===select.value);if(teams[1-index].id===next.id){teams[1-index]=teams[index];$((index===0?'away':'home')+'-select').value=teams[index].id}teams[index]=next;refreshTeams();restart()})}
function refreshTeams(){assignProfiles(match,teams);for(let i=0;i<2;i++){const side=i===0?'home':'away',c=teams[i];$(side+'-flag').textContent=c.flag;$(side+'-select-flag').textContent=c.flag;$(side+'-code').textContent=c.code;$('stat-'+side).textContent=c.english;document.querySelector('.'+side+'-color').style.background='#'+c.shirt.toString(16).padStart(6,'0')}scene?.makePlayers()}
function setPlaying(value){playing=value;arenaAudio.setPlaying(value);$('play').textContent=value?'Ⅱ':'▶';$('play').setAttribute('aria-label',value?'一時停止':'再生');$('play').title=value?'一時停止（Space）':'再生（Space）';$('live-label').textContent=highlights.active?(value?'HIGHLIGHTS':'REPLAY PAUSED'):match.ended?'FULL TIME':value?'LIVE MATCH':'PAUSED'}
function restart(){arenaAudio.stopSpeech();highlights.reset();$('replay-badge').hidden=true;match.reset();displayMatch=match;assignProfiles(match,teams);setPlaying(true);commentary.reset(match,teams);toast('KICK OFF',`${teams[0].name} vs ${teams[1].name}`);updateStats()}
$('commentary-toggle').addEventListener('click',()=>{commentary.setEnabled(!commentary.enabled);$('commentary-toggle').setAttribute('aria-pressed',String(commentary.enabled));$('commentary-toggle').title=commentary.enabled?'実況字幕をオフ':'実況字幕をオン';$('commentary').hidden=!commentary.enabled;$('viewport').classList.toggle('captions-on',commentary.enabled)});
$('play').addEventListener('click',()=>{if(match.ended&&!highlights.active)restart();else setPlaying(!playing)});$('reset').addEventListener('click',restart);$('new-match').addEventListener('click',restart);
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','SELECT','BUTTON','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();if(match.ended&&!highlights.active)restart();else setPlaying(!playing)}});
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>{speed=Number(b.dataset.speed);arenaAudio.setSpeed(speed);document.querySelectorAll('[data-speed]').forEach(btn=>btn.classList.toggle('active',btn===b))}));
const venues={tokyo:['TOKYO NATIONAL','TOKYO, JAPAN','68,000 SEATS · DAYLIGHT','☀'],london:['LONDON PARK','LONDON, ENGLAND','90,000 SEATS · OVERCAST','☁'],rio:['RIO ARENA','RIO DE JANEIRO, BRAZIL','78,000 SEATS · SUNSHINE','☀']};
$('stadium-select').addEventListener('change',e=>{const id=e.target.value,v=venues[id];scene?.setStadium(id);$('venue-label').textContent=v[0];$('stadium-city').textContent=v[1];$('stadium-info').textContent=v[2];updateWeatherLabel();$('stadium-preview').style.background=id==='london'?'linear-gradient(115deg,#64414b,#29343a)':id==='rio'?'linear-gradient(115deg,#727745,#304b38)':''});
function updateWeatherLabel(){
  const weather=$('weather-select').value;
  $('weather').textContent={sunny:'☀',cloudy:'☁',rain:'☂',dusk:'◒'}[weather];
  $('stadium-info').textContent=venues[$('stadium-select').value][2].split('·')[0]+'· '+{sunny:'SUNSHINE',cloudy:'OVERCAST',rain:'RAIN',dusk:'SUNSET'}[weather];
}
$('weather-select').addEventListener('change',e=>{scene?.setWeather(e.target.value);updateWeatherLabel()});

const descriptions={balanced:'攻守のバランスを保ち、空いたスペースへ展開。',possession:'近い味方へのパスを増やし、ボールを保持。',counter:'奪った瞬間に前進し、素早くゴールを狙う。',press:'複数の選手がボールに寄せ、高い位置で奪う。'};
function refreshTactics(){$('formation').value=match.settings[activeTeam].formation;$('tactic').value=match.settings[activeTeam].tactic;$('tactic-description').textContent=descriptions[$('tactic').value]}
document.querySelectorAll('[data-team]').forEach(b=>b.addEventListener('click',()=>{activeTeam=Number(b.dataset.team);document.querySelectorAll('[data-team]').forEach(btn=>btn.classList.toggle('active',btn===b));refreshTactics()}));
$('formation').addEventListener('change',e=>match.settings[activeTeam].formation=e.target.value);$('tactic').addEventListener('change',e=>{match.settings[activeTeam].tactic=e.target.value;refreshTactics()});
const cameras={broadcast:['BROADCAST CAMERA','ボールを追う、テレビ中継スタイル。'],tactical:['TACTICAL CAMERA','ピッチ全体を俯瞰して、選手の配置を確認。'],follow:['PLAYER FOLLOW','ボールの近くを、低い位置から追従。'],free:['FREE CAMERA','ドラッグで回転・スクロールでズーム。']};
document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>{scene?.setCamera(b.dataset.camera);document.querySelectorAll('[data-camera]').forEach(btn=>btn.classList.toggle('active',btn===b));$('camera-label').textContent=cameras[b.dataset.camera][0];$('camera-help').textContent=cameras[b.dataset.camera][1]}));
async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewport').requestFullscreen()}catch{toast('FULLSCREEN','このブラウザでは全画面表示を利用できません')}}
$('fullscreen').addEventListener('click',toggleFullscreen);
$('fullscreen-inview').addEventListener('click',toggleFullscreen);
function updateAudioButtons() {
  const crowd=arenaAudio.crowdEnabled,voice=arenaAudio.commentaryEnabled;
  $('crowd-toggle').textContent='効果音 '+(crowd?'ON':'OFF');
  $('voice-toggle').textContent='実況 '+(voice?'ON':'OFF');
  $('crowd-toggle').setAttribute('aria-pressed',String(crowd));
  $('voice-toggle').setAttribute('aria-pressed',String(voice));
  $('audio-enable-inview').textContent=crowd&&voice?'♪ 音声テスト':'♪ 音声開始';
}
arenaAudio.onStatus=({message,state})=>{
  $('audio-status').textContent=message;
  $('audio-status').dataset.state=state;
  updateAudioButtons();
};
$('audio-enable-inview').addEventListener('click',async()=>{
  // Speech synthesis must be started within the actual user click.
  if(arenaAudio.setCommentary(true))arenaAudio.testSpeech();
  await arenaAudio.setCrowd(true);
  arenaAudio.setPlaying(playing);
  updateAudioButtons();
});
$('crowd-toggle').addEventListener('click',async()=>{
  await arenaAudio.setCrowd(!arenaAudio.crowdEnabled);
  arenaAudio.setPlaying(playing);
  updateAudioButtons();
});
$('voice-toggle').addEventListener('click',()=>{
  const enabled=!arenaAudio.commentaryEnabled;
  if(arenaAudio.setCommentary(enabled)&&enabled)arenaAudio.testSpeech();
  updateAudioButtons();
});
updateAudioButtons();
function updateStats(){updatePlayerCard();const t=match.time;$('match-time').textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;$('period').textContent=match.ended?'FT':match.restart?.type==='halftime'?'HT':match.half===1?'1ST':'2ND';for(let i=0;i<2;i++){const side=i===0?'home':'away';$(side+'-score').textContent=match.score[i];$(side+'-shots').textContent=match.shots[i];$(side+'-passes').textContent=match.passes[i]}const possession=Math.round(match.possession[0]/(match.possession[0]+match.possession[1])*100);$('home-possession').innerHTML=possession+'<span>%</span>';$('away-possession').innerHTML=(100-possession)+'<span>%</span>';$('possession-fill').style.width=possession+'%'}
function updatePlayerCard(){
  const view=displayMatch;const player=view.celebration?view.players[view.celebration.scorer]:view.owner??(view.flight?view.players[view.flight.passer]:null);
  const card=$('player-card');
  card.hidden=!player;
  if(!player)return;
  const profile=player.profile;
  $('player-status').textContent=match.celebration?'GOAL SCORER':match.flight?'LAST TOUCH':'ON THE BALL';
  $('player-name').textContent=profile.name;
  $('player-role').textContent=`${teams[player.team].flag} ${teams[player.team].code} · ${playerPosition(player.slot,match.settings[player.team].formation)} · ${profile.age}歳`;
  $('player-shirt').textContent=profile.number;
  $('player-shirt').style.background='#'+(player.slot===0?0xef8050:teams[player.team].shirt).toString(16).padStart(6,'0');
  $('player-height').textContent=profile.height+' cm';
  $('player-foot').textContent=profile.foot;
  $('player-speed').textContent=((player.speed||0)*3.6).toFixed(1)+' km/h';
}
const map=$('minimap').getContext('2d');function drawMap(){const view=displayMatch;map.clearRect(0,0,240,150);map.strokeStyle='#becdb366';map.lineWidth=1;map.strokeRect(10,8,220,134);map.beginPath();map.moveTo(120,8);map.lineTo(120,142);map.stroke();map.beginPath();map.arc(120,75,18,0,Math.PI*2);map.stroke();map.strokeRect(10,40,34,70);map.strokeRect(196,40,34,70);for(const p of view.players){map.fillStyle=p.team===0?'#a6bfff':'#efe088';map.beginPath();map.arc(120+p.x*2.07,75+p.z*1.95,3.1,0,Math.PI*2);map.fill()}map.fillStyle='#fff';map.beginPath();map.arc(120+view.ball.x*2.07,75+view.ball.z*1.95,2.5,0,Math.PI*2);map.fill()}
let last=performance.now(),statElapsed=0;
function animate(now){
  const dt=Math.min((now-last)/1000,.08);last=now;
  if(playing&&!match.ended){
    const simulated=dt*(match.celebration?1:speed),steps=Math.ceil(simulated/(1/60));
    for(let i=0;i<steps;i++){match.update(simulated/steps);highlights.capture(simulated/steps,match)}
    if(match.ended){highlights.start();setPlaying(highlights.active);updateStats()}
  }
  if(highlights.active&&playing){
    displayMatch=highlights.update(dt,match)??match;
    if(!highlights.active){displayMatch=match;$('replay-badge').hidden=true;setPlaying(false);toast('FULL TIME','ダイジェスト終了')}
  }else if(!highlights.active)displayMatch=match;
  commentary.update(dt,match,teams,playing);
  if(playing)arenaAudio.update(dt,match,'soccer');
  scene?.update(dt,playing,displayMatch);
  statElapsed+=dt;if(statElapsed>.15){updateStats();drawMap();statElapsed=0}
  requestAnimationFrame(animate);
}
refreshTeams();drawMap();commentary.reset(match,teams);requestAnimationFrame(animate);setTimeout(()=>toast('KICK OFF','ピッチに、可能性を。'),600);
// Read-only snapshots for diagnostics without exposing mutable simulation state.
window.touchline={snapshot:()=>({time:match.time,celebration:match.celebration?structuredClone(match.celebration):null,half:match.half,duels:[...match.duels],aerials:[...match.aerials],fouls:[...match.fouls],miscontrols:[...match.miscontrols],throwIns:[...match.throwIns],loose:!!match.loose,restart:match.restart?.type??null,score:[...match.score],players:match.players.map(p=>({x:p.x,z:p.z,team:p.team,role:p.intent?.role,action:p.action,running:p.running})),shots:[...match.shots],passes:[...match.passes],camera:scene?.mode,playing,settings:structuredClone(match.settings)})};
