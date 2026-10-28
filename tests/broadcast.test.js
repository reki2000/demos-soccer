import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Commentary } from '../src/commentary.js';
import { COMMENTARY_BANK, COMMENTARY_COUNT } from '../src/commentary-lines.js';
import { Highlights } from '../src/highlights.js';
import { Match, countries } from '../src/simulation.js';
import { assignProfiles, getPlayerProfile } from '../src/roster.js';
import { createPlayer, posePlayer } from '../src/player.js';
import { createStandShell } from '../src/stand-shell.js';
import { StadiumEnvironment, WEATHER } from '../src/environment.js';

function game(){const m=new Match(()=>{},()=>.7);assignProfiles(m,countries);return m}

test('Japanese commentary contains exactly 1000 distinct patterns across 40 situations',()=>{
  assert.equal(COMMENTARY_COUNT,1000);assert.equal(Object.keys(COMMENTARY_BANK).length,40);
  const lines=Object.values(COMMENTARY_BANK).flat();
  assert.equal(new Set(lines.map(l=>l.text)).size,1000);
  assert.equal(new Set(lines.map(l=>l.id)).size,1000);
  for(const entries of Object.values(COMMENTARY_BANK))assert.equal(entries.length,25);
});

test('commentary substitutes real teams and names and avoids repeating recent lines',()=>{
  const captions=[],c=new Commentary(x=>{if(x)captions.push(x)},()=>.5),m=game();
  for(let i=0;i<10;i++){c.current=null;c.now+=10;c.offer('pass',c.context(m,countries),25)}
  assert.equal(new Set(captions.map(x=>x.id)).size,10);
  assert.ok(captions.every(x=>x.text.includes(m.owner.profile.name)&&!/[{}]/.test(x.text)));
});

test('goal subtitles preempt normal play and cannot be replaced by a routine pass',()=>{
  const c=new Commentary(),m=game();
  c.offer('dribble',c.context(m,countries),20);
  m.score=[1,0];m.celebration={team:0,scorer:9};
  c.event('GOAL!',m,countries);
  assert.equal(c.current.category,'goalLead');assert.ok(c.current.text.includes('日本'));
  c.offer('pass',c.context(m,countries),25);
  assert.equal(c.current.category,'goalLead');
  c.update(2,m,countries,false);assert.equal(c.now,0);
  c.setEnabled(false);assert.equal(c.current,null);
});

test('stale commentary is discarded and reset clears the previous match',()=>{
  const c=new Commentary(),m=game();
  c.event('GOAL!',m,countries);c.offer('chest',c.context(m,countries),40);
  assert.equal(c.pending.length,1);
  c.update(8,{...m,ended:true},countries,true);
  assert.equal(c.pending.length,0);assert.equal(c.current,null);
  c.reset(m,countries);assert.equal(c.current.category,'kickoff');assert.equal(c.now,0);
});

test('highlight playback interpolates recorded play without mutating live score or player state',()=>{
  const recorder=new Highlights(),m=game();
  for(let i=0;i<40;i++){m.players[9].x=i*.1;recorder.capture(.08,m)}
  m.flight={shot:true,passer:9};recorder.event('SHOT',m);
  for(let i=0;i<30;i++){m.players[9].x=4+i*.1;m.ball.x=i;recorder.capture(.08,m)}
  m.score=[1,0];recorder.event('GOAL!',m);
  for(let i=0;i<20;i++)recorder.capture(.08,m);
  assert.equal(recorder.clips.length,1);assert.equal(recorder.clips[0].outcome,'goal');
  const liveX=m.players[9].x;
  assert.equal(recorder.start(),true);recorder.update(4,m);
  const replay=recorder.update(.1,m);
  assert.ok(replay.replay);assert.notEqual(replay.players[9].x,liveX);
  replay.players[9].x=999;replay.score[0]=99;
  assert.equal(m.players[9].x,liveX);assert.deepEqual(m.score,[1,0]);
  for(let i=0;i<200&&recorder.active;i++)recorder.update(.1,m);
  assert.equal(recorder.active,false);assert.equal(recorder.finished,true);
  recorder.reset();assert.equal(recorder.clips.length,0);assert.equal(recorder.ring.length,0);
});

test('highlights remain memory bounded and preserve goals before routine attempts',()=>{
  const r=new Highlights();
  for(let i=0;i<16;i++){r.pending={frames:[{},{},{}],outcome:i===0?'goal':'shot'};r.finishClip()}
  assert.equal(r.clips.length,10);assert.equal(r.clips[0].outcome,'goal');
});

test('goalkeeper hands change from ready stance to reach and catch',()=>{
  const m=game(),p=m.players[0],model=createPlayer(p,countries[0]);
  posePlayer(model,p);const ready=model.arms[0].shoulder.rotation.x;
  p.keeperReach=1;p.action='catch';p.actionTime=.7;p.actionDuration=.85;
  posePlayer(model,p);assert.ok(model.arms[0].shoulder.rotation.x<ready-.8);
  m.owner=p;m.updateOwner(.01);assert.ok(m.ball.y>1);
  model.g.updateMatrixWorld(true);model.g.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
});

test('stand shell blocks field-level views through seating and all four corners',()=>{
  const shell=createStandShell();shell.updateMatrixWorld(true);
  for(const y of [1.6,7,14])for(let i=0;i<32;i++){
    const angle=i/32*Math.PI*2;
    const ray=new THREE.Raycaster(new THREE.Vector3(0,y,0),new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),0,110);
    assert.ok(ray.intersectObject(shell,true).length>0,`unsealed stand at angle ${angle}, height ${y}`);
  }
  const skyRay=new THREE.Raycaster(new THREE.Vector3(0,1.6,0),new THREE.Vector3(0,1,0));
  assert.equal(skyRay.intersectObject(shell,true).length,0);
});

test('venue landscape and weather switches maintain finite geometry without accumulating old scenery',()=>{
  const scene=new THREE.Scene(),textures=Object.fromEntries(['windows','roof','water'].map(k=>[k,new THREE.Texture()]));
  const environment=new StadiumEnvironment(scene,textures);
  environment.setVenue('tokyo');const tokyoCount=environment.group.children.length;
  environment.setVenue('rio');assert.ok(environment.water);
  for(const weather of Object.keys(WEATHER)){
    environment.setWeather(weather);environment.update(.1);
    assert.equal(environment.rain.visible,weather==='rain');
    assert.ok(environment.rainPositions.every(Number.isFinite));
  }
  environment.setVenue('london');assert.equal(environment.water,null);
  environment.setVenue('tokyo');assert.equal(environment.group.children.length,tokyoCount);
  environment.group.updateMatrixWorld(true);environment.group.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
});

test('faces have eyes nose mouth and ears, and hairstyles vary widely',()=>{
  const m=game();
  const styles=new Set(m.players.map(p=>p.profile.hairstyle));
  assert.ok(styles.size>=8,`expected >=8 hairstyles, got ${[...styles]}`);
  const model=createPlayer(m.players[9],countries[0]);
  // skull + hair + 2 eyes (white+pupil) + 2 brows + 2 ears + nose + mouth
  assert.ok(model.head.children.length>=11,`head children: ${model.head.children.length}`);
  model.g.updateMatrixWorld(true);
  model.g.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
});

test('analyst follows major calls with a second-voice explanation',()=>{
  const captions=[],c=new Commentary(x=>{if(x)captions.push(x)},()=>0),m=game();
  m.score=[1,0];m.celebration={team:0,scorer:9};
  c.event('GOAL!',m,countries);
  assert.equal(c.current.role,'play');
  for(let i=0;i<40&&c.current?.role!=='analysis';i++)c.update(.5,m,countries,true);
  assert.equal(c.current?.role,'analysis');
  const analysis=captions.find(x=>x.role==='analysis');
  assert.ok(analysis&&!/[{}]/.test(analysis.text),analysis?.text);
});

test('faces carry regional character: eye, brow, iris and skin vary by country',()=>{
  const countriesIds=['japan','brazil','france','argentina','england','germany','spain','portugal'];
  const types=new Set(),eyes=new Set(),brows=new Set(),iris=new Set();
  for(const id of countriesIds)for(let s=0;s<11;s++){
    const p=getPlayerProfile(id,s);
    types.add(p.face.type);eyes.add(p.face.eyeShape);brows.add(p.face.browShape);iris.add(p.face.iris);
    assert.equal(p.skin,p.face.skin);
  }
  assert.ok(types.size>=4,[...types]);
  assert.ok(eyes.size>=5,[...eyes]);
  assert.ok(brows.size>=4,[...brows]);
  assert.ok(iris.size>=4);
  const japan=[...Array(11)].map((_,s)=>getPlayerProfile('japan',s));
  assert.ok(japan.every(p=>p.face.type==='eastAsian'));
  const france=[...Array(11)].map((_,s)=>getPlayerProfile('france',s));
  assert.ok(new Set(france.map(p=>p.face.type)).size>=2);
});

test('head is a composite shape with sockets, brow ridge, jaw and chin',()=>{
  const m=game();
  const model=createPlayer(m.players[9],countries[0]);
  // buildHead parts (cranium, face base, jaw, chin, brow ridge, 2 sockets,
  // 2 cheeks) + hair + face features (eyes x3 parts, brows, ears, nose
  // bridge/tip/base, mouth) put well over twenty meshes on the head.
  assert.ok(model.head.children.length>=20,`head children: ${model.head.children.length}`);
});
