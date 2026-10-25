import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BasketballMatch,SQUADS,COURT} from '../basketball/simulation.js';
import {defenseAnimationState} from '../basketball/defensive-motion.js';
import {shadowAppearance} from '../basketball/shadows.js';
import {createBasketballCommentary,commentaryVariants} from '../basketball/commentary.js';
import {ArenaAudio} from '../basketball/audio.js';

const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('defenders run with free arms; nearby contests still raise hands',()=>{
  const match=new BasketballMatch(()=>{},()=>.5);
  const guard=match.players[5];
  guard.vx=3;guard.vz=0;guard.speed=3;
  const pose={role:'contain',arms:[{shoulderX:-2},{shoulderX:-2}]};
  assert.equal(defenseAnimationState(match,guard,pose).guard,null);
  assert.equal(defenseAnimationState(match,guard,pose).runFacing,true);
  guard.speed=.5;guard.vx=.5;
  assert.equal(defenseAnimationState(match,guard,pose).guard,pose);
  guard.speed=2.5;guard.vx=2.5;guard.jump={type:'contest',elapsed:.12,duration:.6};
  assert.equal(defenseAnimationState(match,guard,{role:'contest'}).guard.role,'contest');
});

test('passes and shots face their receiver or rim and stay oriented during gather',()=>{
  const match=new BasketballMatch(()=>{},()=>.5);
  const sender=match.owner;
  match.pass();
  let receiver=match.players[match.flight.to];
  let expected=Math.atan2(receiver.x-sender.x,receiver.z-sender.z);
  assert.ok(Math.abs(sender.heading-expected)<1e-8);
  match.movePlayers(.04);
  assert.ok(Math.abs(sender.heading-expected)<1e-8);
  match.updateFlight(match.flight.duration);
  const shooter=match.owner;
  match.shoot();
  const hoop=match.basket(shooter.team);
  expected=Math.atan2(hoop.x-shooter.x,hoop.z-shooter.z);
  assert.ok(Math.abs(shooter.heading-expected)<1e-8);
  match.movePlayers(.03);
  assert.ok(Math.abs(shooter.heading-expected)<1e-8);
});

test('a tall player beneath the basket can finish with an airborne dunk',()=>{
  const events=[];
  const match=new BasketballMatch((type,details)=>events.push({type,details}),()=>.05);
  const shooter=match.players[3];
  match.owner=shooter;
  shooter.x=match.basket(0).x-1.10;
  shooter.z=0;
  match.ball={x:shooter.x,y:1.16,z:0};
  match.shoot();
  assert.equal(match.flight.dunk,true);
  assert.equal(shooter.jump.type,'dunk');
  assert.equal(match.flight.points,2);
  match.updateFlight(match.flight.duration);
  assert.equal(match.score[0],2);
  assert.ok(events.some(e=>e.type==='dunk'));
  assert.ok(events.some(e=>e.type==='score'&&e.details.dunk));
  assert.ok(match.scoredInbound);
});

test('scored ball actually falls to the floor before the defender picks it up',()=>{
  const match=new BasketballMatch(()=>{},()=>0);
  match.shoot();
  match.updateFlight(match.flight.duration);
  const ring={...match.ball};
  assert.ok(Math.abs(ring.y-COURT.rimHeight)<.02);
  let minHeight=Infinity,sawRun=false,sawPickup=false;
  let last={...match.ball},maxStep=0;
  for(let i=0;i<80&&match.scoredInbound;i++){
    const phase=match.scoredInbound.phase;
    sawRun ||= phase==='approach';
    sawPickup ||= phase==='pickup';
    match.update(.075);
    minHeight=Math.min(minHeight,match.ball.y);
    maxStep=Math.max(maxStep,d(last,match.ball));
    last={...match.ball};
  }
  assert.ok(minHeight<.15);
  assert.ok(sawRun&&sawPickup);
  assert.equal(match.scoredInbound,null);
  assert.equal(match.possession,1);
  assert.ok(maxStep<.6, 'discontinuity '+maxStep);
});

test('every foul sequence produces exactly one animated free throw',()=>{
  const events=[];
  const match=new BasketballMatch((type,data)=>events.push({type,data}),()=>0);
  match.beginFreeThrows(0,3);
  assert.equal(match.freeThrows.total,1);
  match.updateFreeThrows(5);
  match.updateFreeThrows(5);
  assert.equal(match.ftAttempts[0],1);
  assert.equal(events.filter(e=>e.type==='freeThrowAttempt').length,1);
  assert.equal(match.freeThrows,null);
});

test('ball and player shadows soften and spread as height increases',()=>{
  const low=shadowAppearance(.12,.5),high=shadowAppearance(3.2,.5);
  assert.ok(low.opacity>high.opacity);
  assert.ok(high.radius>low.radius);
  assert.ok(low.opacity<=.32&&high.opacity>=.055);
  const scene=readFileSync(new URL('../basketball/scene.js',import.meta.url),'utf8');
  assert.match(scene,/this\.ballShadow\.position\.set\(b\.x/);
  assert.match(scene,/this\.shadows\[p\.id\]/);
  assert.match(scene,/number\.rotation\.y=Math\.PI/);
  assert.match(scene,/\.scale\.set\(1\.12,1,\.84\)/);
});

test('basketball commentary varies on repeated events with real-world-style fictional rosters',()=>{
  const match=new BasketballMatch(()=>{},()=>.5);
  const speak=createBasketballCommentary(()=>0);
  const lines=new Set();
  for(let i=0;i<12;i++)lines.add(speak('score',{team:0,player:0,points:2},match,SQUADS));
  assert.ok(lines.size>=2);
  assert.ok(commentaryVariants.pass.length>=6);
  assert.ok(commentaryVariants.shot.length>=6);
  assert.ok(commentaryVariants.dunk.length>=4);
  for(const team of SQUADS){
    assert.ok(team.name.split(' ').length>=3);
    assert.equal(team.names.length,5);
    assert.ok(team.names.every(name=>name.includes(' ')));
  }
});

test('soccer requests Japanese male voice and 1.5x faster speed',()=>{
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(source,/speechRate=2\.14/);
  assert.match(source,/voicePreference='male'/);
  let utterance;
  class Utterance {constructor(text){this.text=text;utterance=this;}}
  let spoken=null;
  const voices=[{lang:'ja-JP',name:'Kyoko'},{lang:'ja-JP',name:'Takumi Male'}];
  const env={
    SpeechSynthesisUtterance:Utterance,
    speechSynthesis:{getVoices(){return voices},speak(v){spoken=v},cancel(){},resume(){}}
  };
  const audio=new ArenaAudio(env);
  audio.speechRate=2.14;audio.voicePreference='male';
  audio.setCommentary(true);
  assert.equal(audio.speak('ゴールです',true),true);
  assert.equal(spoken.voice,voices[1]);
  assert.equal(spoken.rate,2.14);
});

test('large basketball score flash uses centered score typography',()=>{
  const html=readFileSync(new URL('../basketball/index.html',import.meta.url),'utf8');
  const script=readFileSync(new URL('../basketball/main.js',import.meta.url),'utf8');
  const style=readFileSync(new URL('../basketball/style.css',import.meta.url),'utf8');
  assert.match(html,/id="event-big-score"/);
  assert.match(script,/toast\.classList\.toggle\('score-event'/);
  assert.match(style,/\.event-toast\.score-event/);
});
