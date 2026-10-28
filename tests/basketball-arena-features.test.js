import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BasketballMatch} from '../basketball/simulation.js';
import {jumpHeight,runningBodyPose,startJump,advanceJumps} from '../basketball/athletic-motion.js';
import {runningLegPose} from '../basketball/leg-gait.js';
import {sidelineLayout} from '../basketball/sideline.js';
import {ArenaAudio,commentaryLine,crowdReaction} from '../basketball/audio.js';

test('running raises the entire body and swings one foot into a lifted recovery',()=>{
  const still=runningBodyPose(.6,0),running=runningBodyPose(.6,3);
  assert.equal(still.bounce,0);
  assert.ok(running.bounce>.07);
  const swing=runningLegPose(Math.PI*1.6,3,false,-1);
  const support=runningLegPose(Math.PI*.2,3,false,-1);
  assert.ok(swing.lift>.27);
  assert.equal(support.lift,0);
  assert.ok(swing.kneeX>support.kneeX+.6);
});

test('jump apex rises above court and lands smoothly without getting stuck',()=>{
  const player={jump:null};
  assert.equal(startJump(player,'shot',.54,.70),true);
  assert.equal(jumpHeight(player),0);
  advanceJumps([player],.35);
  assert.ok(jumpHeight(player)>.53);
  advanceJumps([player],.34);
  assert.ok(jumpHeight(player)<.04);
  advanceJumps([player],.02);
  assert.equal(jumpHeight(player),0);
  assert.equal(player.jump,null);
});

test('shooters and nearby defenders jump; rebounders jump to contest the rebound',()=>{
  const game=new BasketballMatch(()=>{},()=>.95);
  const shooter=game.owner;
  game.players[5].x=shooter.x+1;
  game.players[5].z=shooter.z;
  game.shoot();
  assert.equal(shooter.jump.type,'shot');
  assert.equal(game.players[5].jump.type,'contest');
  game.updateFlight(game.flight.duration);
  assert.equal(game.flight.kind,'rebound');
  game.updateFlight(game.flight.duration*.4);
  assert.ok(game.players.some(p=>p.jump?.type==='rebound'));
});

test('arena contains benches, substitutes, coaches and three distinct referees',()=>{
  const layout=sidelineLayout();
  assert.equal(layout.seats.length,12);
  assert.equal(layout.seats.filter(x=>x.slot<5).length,10);
  assert.equal(layout.coaches.length,2);
  assert.equal(layout.referees.length,3);
  assert.ok(layout.seats.every(x=>Math.abs(x.z)>7.5));
  assert.ok(layout.coaches.every(x=>Math.abs(x.z)>7.5));
  assert.ok(layout.referees.every(x=>Math.abs(x.x)<13 && Math.abs(x.z)<7.5));
});

test('crowd intensity responds to scores and Japanese lines summarize key plays',()=>{
  assert.ok(crowdReaction('score')>crowdReaction('steal'));
  assert.ok(crowdReaction('steal')>crowdReaction('pass'));
  const msg=commentaryLine('score',{team:0,points:3},[{code:'TKY'},{code:'OSK'}]);
  assert.match(msg,/TKY/);
  assert.match(msg,/スリー/);
  assert.match(commentaryLine('foul',{team:1},[{code:'TKY'},{code:'OSK'}]),/ファウル/);
});

test('audio remains off until explicitly enabled and can cancel spoken commentary',()=>{
  let cancelled=0,spoken='';
  class Utterance {constructor(value){this.text=value;}}
  const mock={SpeechSynthesisUtterance:Utterance,speechSynthesis:{
    cancel(){cancelled++;},speak(v){spoken=v.text},getVoices(){return [{lang:'ja-JP'}]}
  }};
  const audio=new ArenaAudio(mock);
  assert.equal(audio.crowdEnabled,false);
  assert.equal(audio.commentaryEnabled,false);
  audio.onEvent('score',{team:0,points:2},[{code:'TKY'}]);
  assert.equal(spoken,'');
  audio.setCommentary(true);
  audio.onEvent('score',{team:0,points:3},[{code:'TKY'}]);
  assert.match(spoken,/スリー/);
  audio.setCommentary(false);
  assert.ok(cancelled>=1);
});

test('both games place the camera deck inside the fullscreen viewport and not the sidebar',()=>{
  for(const path of ['index.html','basketball/index.html']){
    const html=readFileSync(new URL('../'+path,import.meta.url),'utf8');
    const viewport=html.indexOf('id="viewport"');
    const deck=html.indexOf('class="overlay-camera arena-controls"');
    const sidebar=html.indexOf('<aside');
    assert.ok(deck>viewport && deck<sidebar,path+' camera deck must be part of viewport');
    assert.equal((html.match(/id="camera-help"/g)||[]).length,1);
    assert.equal((html.match(/id="fullscreen-inview"/g)||[]).length,1);
    assert.equal((html.match(/data-camera="/g)||[]).length,4);
  }
});

test('neither sport retains the removed in-motion hero area',()=>{
  for(const path of ['index.html','basketball/index.html']) {
    const html=readFileSync(new URL('../'+path,import.meta.url),'utf8');
    assert.doesNotMatch(html,/class="page-heading"/);
    assert.doesNotMatch(html,/<h1>/);
    assert.doesNotMatch(html,/>MATCHDAY</);
    assert.ok(html.indexOf('<main>') < html.indexOf('class="workspace"'));
  }
});

test('unsupported speech keeps the narration switch disabled',()=>{
  const audio=new ArenaAudio({});
  assert.equal(audio.setCommentary(true),false);
  assert.equal(audio.commentaryEnabled,false);
});

test("shot release rises with the shooter's jump instead of staying at ground height",()=>{
  const match=new BasketballMatch(()=>{},()=>.5);
  match.shoot();
  const baseline=match.flight.release.y;
  let maxJumpY=0;
  for(let i=0;i<24;i++){
    match.update(.01);
    maxJumpY=Math.max(maxJumpY,match.flight?.release?.y??0);
  }
  assert.ok(maxJumpY>baseline+.32, 'shot release never followed the elevated hands');
  assert.ok(match.flight && match.flight.stage==='gather');
});

test('both games offer compact sound and camera controls in the fullscreen viewport',()=>{
  for(const path of ['index.html','basketball/index.html']){
    const html=readFileSync(new URL('../'+path,import.meta.url),'utf8');
    const camera=html.indexOf('class="overlay-camera arena-controls"');
    const viewport=html.indexOf('id="viewport"');
    const sidebar=html.indexOf('<aside');
    assert.ok(camera>viewport&&camera<sidebar);
    for(const id of ['fullscreen-inview','audio-enable-inview','crowd-toggle','voice-toggle','audio-status']){
      assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,path+' '+id);
    }
    assert.match(html,/縮小/);
    assert.equal((html.match(/data-camera="/g)||[]).length,4);
  }
});

test('audio test cue and referee and court effects synthesize sound after user opt-in',async()=>{
  let oscillators=0,starts=0,stops=0;
  class Param {
    value=0;
    setValueAtTime(v){this.value=v;}
    linearRampToValueAtTime(v){this.value=v;}
    exponentialRampToValueAtTime(v){this.value=v;}
    setTargetAtTime(v){this.value=v;}
    cancelScheduledValues(){}
  }
  class Node {connect(){return this;}}
  class AudioContext {
    state='running';currentTime=0;sampleRate=120;
    destination=new Node();
    createBuffer(channels,count){return {getChannelData:()=>new Float32Array(count)};}
    createBufferSource(){return Object.assign(new Node(),{start(){},stop(){}});}
    createBiquadFilter(){return Object.assign(new Node(),{frequency:new Param()});}
    createGain(){return Object.assign(new Node(),{gain:new Param()});}
    createOscillator(){oscillators++;return Object.assign(new Node(),{
      frequency:new Param(),start(){starts++},stop(){stops++}
    });}
    async resume(){}
    close(){}
  }
  const audio=new ArenaAudio({AudioContext});
  assert.equal(audio.effect('whistle'),false);
  assert.equal(await audio.setCrowd(true),true);
  assert.equal(audio.crowdEnabled,true);
  const initial=oscillators;
  assert.ok(initial>0,'activation emits test beep');
  for(const kind of ['whistle','squeak','bounce','kick','music']) {
    assert.equal(audio.effect(kind),true,kind);
  }
  assert.ok(oscillators>initial+8);
  const match={players:[{id:0,speed:3},{id:1,speed:2}],owner:{id:0},ballControl:{mode:'dribble',phase:.45}};
  audio.update(.17,match);
  match.ballControl.phase=.55;
  audio.update(.17,match);
  assert.ok(audio.soundEvents.includes('bounce'));
  assert.ok(audio.soundEvents.includes('squeak'));
  audio.setPlaying(false);
  assert.equal(audio.effect('whistle'),false);
  assert.equal(starts,stops);
});

test('basketball default progression is 30 percent faster',()=>{
  const source=readFileSync(new URL('../basketball/main.js',import.meta.url),'utf8');
  assert.match(source,/gameSeconds\s*=\s*dt\s*\*\s*speed\s*\*\s*1\.3/);
});

test('basketball default camera is the ball-follow mode',()=>{
  const scene=readFileSync(new URL('../basketball/scene.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../basketball/index.html',import.meta.url),'utf8');
  assert.match(scene,/this\.mode = 'follow'/);
  assert.match(html,/<button data-camera="follow" class="active"/);
  assert.match(html,/id="camera-label">BALL FOLLOW</);
});

test('basketball athletes have faces, varied hair and a hip-pivot torso',()=>{
  const scene=readFileSync(new URL('../basketball/scene.js',import.meta.url),'utf8');
  assert.match(scene,/buildImportedHead/);
  assert.match(scene,/HAIR_STYLES_B = \[[^\]]*'sidepart'[^\]]*'afro'/);
  assert.match(scene,/torso\.position\.y = \.99/);
  assert.match(scene,/\.99\+\(guard\?/);
});

test('basketball heads use the shared imported head at 1.02 scale',()=>{
  const scene=readFileSync(new URL('../basketball/scene.js',import.meta.url),'utf8');
  assert.match(scene,/buildImportedHead\(head, material, \{/);
  assert.match(scene,/f: 1\.02/);
});

test('basketball play-by-play speaks faster than the default rate',()=>{
  const main=readFileSync(new URL('../basketball/main.js',import.meta.url),'utf8');
  assert.match(main,/arenaAudio\.speechRate=2\.0/);
});
