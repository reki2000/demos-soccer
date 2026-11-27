import {createGoalNet} from './goal-net.js';
import { createMatchBall } from './match-ball.js';
import { createPitchMarkings } from './pitch-markings.js';
import {createStandShell} from './stand-shell.js';
import {createSurfaceTextures, StadiumEnvironment, WEATHER} from './environment.js';
import * as THREE from 'three';
import {createSidelines, updateSidelines, disposeSidelines} from './sidelines.js';
import {createCrowd, animateCrowd} from './crowd.js';
import {createPlayer, posePlayer, disposePlayer} from './player.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const mat=(c)=>new THREE.MeshStandardMaterial({color:c,roughness:.85,flatShading:true});
export class StadiumScene{
 constructor(container,match,teams){this.match=match;this.liveMatch=match;this.teams=teams;this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0xafc3c1);this.scene.fog=new THREE.Fog(0xafc3c1,150,650);this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;container.appendChild(this.renderer.domElement);this.camera=new THREE.PerspectiveCamera(47,1,.2,1800);this.camera.position.set(-7,6,10);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,0,0);this.controls.enableDamping=true;this.controls.minDistance=14;this.controls.maxDistance=180;this.controls.maxPolarAngle=Math.PI/2-.06;this.controls.enabled=false;this.mode='follow';this.cameraTarget=new THREE.Vector3();this.ambient=new THREE.HemisphereLight(0xdceff5,0x526742,2.6);this.scene.add(this.ambient);this.sun=new THREE.DirectionalLight(0xffeed4,3.3);this.sun.position.set(-45,90,30);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-90,right:90,top:90,bottom:-90,far:230});this.sun.shadow.bias=-.001;this.scene.add(this.sun);this.world=new THREE.Group();this.scene.add(this.world);this.textures=createSurfaceTextures(this.renderer);this.environment=new StadiumEnvironment(this.scene,this.textures);this.weather='sunny';this.makeField();this.stands=new THREE.Group();this.world.add(this.stands);this.setStadium('tokyo');this.playerGroup=new THREE.Group();this.scene.add(this.playerGroup);this.makePlayers();this.ball=createMatchBall();this.scene.add(this.ball);this.rollAxis=new THREE.Vector3();this.halo=new THREE.Mesh(new THREE.RingGeometry(.8,1,32),new THREE.MeshBasicMaterial({color:0xdafa88,transparent:true,opacity:.8,side:THREE.DoubleSide}));this.halo.rotation.x=-Math.PI/2;this.halo.position.y=.07;this.scene.add(this.halo);this.resizeObserver=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix()});this.resizeObserver.observe(container)}
 mesh(geo,material,parent,x,y,z){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 box(w,h,d,c,parent,x,y,z){return this.mesh(new THREE.BoxGeometry(w,h,d),typeof c==='number'?mat(c):c,parent,x,y,z)}
 line(points,color=0xeaf0d5,parent=this.world){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:.87}));parent.add(l);return l}
 makeField(){this.box(200,.8,160,0x596c59,this.world,0,-.65,0);this.box(124,.18,85,0x477e45,this.world,0,-.1,0);for(let i=0;i<20;i++)this.box(5.25,.08,68,new THREE.MeshStandardMaterial({color:i%2?0x568b4c:0x63994f,map:this.textures.grass,bumpMap:this.textures.grass,bumpScale:.025,roughness:.94}),this.world,-49.875+i*5.25,0,0);this.world.add(createPitchMarkings());for(const dir of [-1,1]){const goal=new THREE.Group();this.world.add(goal);for(const z of [-3.66,3.66]){this.mesh(new THREE.CylinderGeometry(.06,.06,2.44,16),mat(0xfafaf1),goal,dir*52.5,1.22,z)}const bar=this.mesh(new THREE.CylinderGeometry(.06,.06,7.44,16),mat(0xfafaf1),goal,dir*52.5,2.44,0);bar.rotation.x=Math.PI/2;goal.add(createGoalNet(dir));for(const z of [-34,34]){this.mesh(new THREE.CylinderGeometry(.04,.04,1.7,5),mat(0xffffff),this.world,dir*52.5,.85,z);this.box(.7,.45,.025,0xecd777,this.world,dir*52.5+.35,1.45,z)}}
 for(const z of [-38,38]){for(let i=0;i<12;i++){const board=this.box(8.7,1.1,.25,i%3===0?0xd2e6a1:0x24382d,this.world,-48+i*8.7,.55,z);if(i%2===0){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;const c=canvas.getContext('2d');c.fillStyle=i%3===0?'#d2e6a1':'#24382d';c.fillRect(0,0,512,64);c.fillStyle=i%3===0?'#24382d':'#d2e6a1';c.font='bold 34px Arial';c.textAlign='center';c.fillText(i%4===0?'TOUCHLINE':'THE BEAUTIFUL GAME',256,45);const tex=new THREE.CanvasTexture(canvas);const panel=new THREE.Mesh(new THREE.PlaneGeometry(8.6,1.02),new THREE.MeshBasicMaterial({map:tex}));panel.position.set(board.position.x,.57,z+(z>0?-.14:.14));if(z>0)panel.rotation.y=Math.PI;this.world.add(panel)}}}}
 setStadium(id){this.venue=id;this.environment.setVenue(id);while(this.stands.children.length){const obj=this.stands.children[this.stands.children.length-1];this.stands.remove(obj);obj.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}})}const theme=id==='london'?{seat:0x84343b,roof:0x394345,sky:0x607b87}:id==='rio'?{seat:0xc6ad5c,roof:0xc4d1b8,sky:0x9ed0db}:{seat:0x647d6e,roof:0xc6cfb7,sky:0xafc3c1};this.scene.background.set(theme.sky);this.scene.fog.color.set(theme.sky);this.sun.intensity=id==='london'?1.7:3.3;const seatMat=new THREE.MeshStandardMaterial({color:theme.seat,map:this.textures.seats,roughness:.6}),concrete=new THREE.MeshStandardMaterial({color:0x7d887b,map:this.textures.concrete,bumpMap:this.textures.concrete,bumpScale:.045,roughness:.95}),roof=new THREE.MeshStandardMaterial({color:theme.roof,map:this.textures.roof,bumpMap:this.textures.roof,bumpScale:.07,metalness:.3,roughness:.55});for(const end of [-1,1]){for(let tier=0;tier<12;tier++){const y=1.6+tier*.9,z=end*(44+tier*1.2);this.box(143,.85,1.3,tier%4===0?concrete:seatMat,this.stands,0,y,z);this.box(1.3,.85,86,seatMat,this.stands,end*(62+tier*1.2),y,0)}this.box(150,.6,17,roof,this.stands,0,16,end*57);this.box(18,.6,92,roof,this.stands,end*74,16,0);for(let x=-66;x<=66;x+=12)this.box(.4,15,.4,0x536258,this.stands,x,7.5,end*64)}
 this.stands.add(createStandShell(this.textures));
 this.crowd=createCrowd(this.teams);this.stands.add(this.crowd.group);
 for(const x of [-68,68])for(const z of [-48,48]){this.box(.5,28,.5,0x72847b,this.stands,x,14,z);const lamp=this.box(8,2,1,0xe4e9d3,this.stands,x,28,z);lamp.material.emissive=new THREE.Color(0xe8f4d4);lamp.material.emissiveIntensity=.6;for(let i=-3;i<=3;i++)this.box(.65,1.2,1.05,0xffffff,this.stands,x+i,28,z)} this.setWeather(this.weather); }
 makePlayers(){
   this.match=this.liveMatch;
   if(this.sidelines) disposeSidelines(this.sidelines);
   this.sidelines=createSidelines(this.teams);this.scene.add(this.sidelines.group);
   for(const model of this.models ?? []) disposePlayer(model);
   this.models = this.match.players.map(p => {
     const model = createPlayer(p, this.teams[p.team]);
     this.playerGroup.add(model.g);
     return model;
   });
 }
 update(dt,playing=true,view=null){
   this.match=view??this.liveMatch;
   this.environment.update(dt);
   updateSidelines(this.sidelines,this.match,dt,playing && !this.match.ended && !this.match.pause);
   if(playing) animateCrowd(this.crowd,dt);
   for(let i=0;i<this.models.length;i++) posePlayer(this.models[i],this.match.players[i],this.match.ball,this.match.flight);
   const b=this.match.ball;
   this.rollAxis.set(b.z-this.ball.position.z,0,this.ball.position.x-b.x);
   const travel=this.rollAxis.length();
   if(travel>0 && travel<3){
     const spin=travel*(b.y>.25 ? 2.5 : 1/.11);
     this.ball.rotateOnWorldAxis(this.rollAxis.normalize(),spin);
   }
   this.ball.position.set(b.x,b.y,b.z);
   this.halo.visible=!!this.match.owner;if(this.match.owner)this.halo.position.set(this.match.owner.x,.08,this.match.owner.z);
 if(this.mode==='free'&&!this.match.celebration&&!this.match.replay){this.controls.update()}else{let pos,target,fov=47;if(this.match.replay){const p=this.match.players[this.match.replay.shooter],dir=this.match.direction(p.team);pos=new THREE.Vector3(b.x-dir*6,3.6+Math.max(0,b.y-1)*.4,b.z+7);target=new THREE.Vector3(b.x,b.y+.3,b.z);fov=47}else if(this.match.celebration){const c=this.match.celebration,p=this.match.players[c.scorer],dir=this.match.direction(c.team);if(c.phase==='celebrate' && c.elapsed<.75){pos=new THREE.Vector3(b.x-dir*8,3.4,b.z+6);target=new THREE.Vector3(b.x,b.y,b.z);fov=48}else if(c.phase==='celebrate'){pos=new THREE.Vector3(p.x+dir*2.7,2.2,p.z+2.9);target=new THREE.Vector3(p.x,1.3,p.z);fov=45}else{pos=new THREE.Vector3(8,42,58);target=new THREE.Vector3(0,0,0);fov=55}}else if(this.mode==='tactical'){pos=new THREE.Vector3(.01,118,12);target=new THREE.Vector3(0,0,0);fov=57}else if(this.mode==='follow'){const dir=this.match.direction(this.match.owner?.team??this.match.flight?.from??0);pos=new THREE.Vector3(b.x-7*dir,6+Math.max(0,b.y-1)*.35,b.z+10);target=new THREE.Vector3(b.x+dir*.7,b.y+.25,b.z);fov=58}else{const attack=Math.abs(b.x)>33;pos=new THREE.Vector3(b.x+5,attack?26:30,44);target=new THREE.Vector3(b.x,Math.max(.65,b.y*.55),b.z);fov=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2*Math.atan(19/pos.distanceTo(target))),27,55)}const a=1-Math.exp(-dt*2.8);this.camera.position.lerp(pos,a);this.cameraTarget.lerp(target,1-Math.exp(-dt*5));this.camera.lookAt(this.cameraTarget);this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,fov,a);this.camera.updateProjectionMatrix()}this.renderer.render(this.scene,this.camera)}
 setWeather(id){
   this.weather=id;const w=WEATHER[id];this.environment.setWeather(id);
   this.scene.background.set(w.sky);this.scene.fog.color.set(w.fog);this.scene.fog.far=w.far;
   this.sun.intensity=w.sun;this.ambient.intensity=w.ambient;this.renderer.toneMappingExposure=w.exposure;
   this.sun.color.set(id==='dusk'?0xffb474:0xffeed4);this.sun.position.set(-45,id==='dusk'?28:90,30);
   this.world.traverse(o=>{if(o.material?.map===this.textures.grass)o.material.roughness=id==='rain'?.48:.94});
 }
 setCamera(mode){this.mode=mode;this.controls.enabled=mode==='free';if(mode==='free'){this.controls.target.copy(this.cameraTarget);this.controls.update()}}
}
