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
  assert.ok(cancelled>=2);
});

test('both games place the camera deck inside the fullscreen viewport and not the sidebar',()=>{
  for(const path of ['index.html','basketball/index.html']){
    const html=readFileSync(new URL('../'+path,import.meta.url),'utf8');
    const viewport=html.indexOf('id="viewport"');
    const deck=html.indexOf('class="overlay-camera"');
    const sidebar=html.indexOf('<aside');
    assert.ok(deck>viewport && deck<sidebar,path+' camera deck must be part of viewport');
    assert.equal((html.match(/id="camera-help"/g)||[]).length,1);
    assert.equal((html.match(/id="fullscreen-inview"/g)||[]).length,1);
    assert.equal((html.match(/data-camera="/g)||[]).length,4);
  }
});
