import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COURT } from './simulation.js';
import { guardPose } from './guard-pose.js';
import {defenseAnimationState} from './defensive-motion.js';
import {shadowAppearance} from './shadows.js';
import { runningLegPose } from './leg-gait.js';
import {jumpHeight,runningBodyPose} from './athletic-motion.js';
import {makeSidelines} from './sideline.js';
import {buildImportedHead, faceFor, SQUAD_FACE_POOLS} from '../src/face.js';
import {BALL_RADIUS,PASS_GATHER,PASS_CATCH,SHOT_GATHER,blend as ease} from './ball-motion.js';

const material = (color, roughness = .8) => new THREE.MeshStandardMaterial({color, roughness, flatShading: true});
const lineMaterial = new THREE.LineBasicMaterial({color: 0xf9e9c9});
function mesh(parent, geometry, mat, x = 0, y = 0, z = 0) {
  const result = new THREE.Mesh(geometry, mat);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}
function cuboid(parent, dimensions, color, position) {
  return mesh(parent, new THREE.BoxGeometry(...dimensions), material(color), ...position);
}
function trace(parent, coords, color = 0xfff0d3) {
  const geometry = new THREE.BufferGeometry().setFromPoints(coords.map(([x,z]) => new THREE.Vector3(x, .048, z)));
  parent.add(new THREE.Line(geometry, color === 0xfff0d3 ? lineMaterial : new THREE.LineBasicMaterial({color})));
}
function rectangle(parent, x0, x1, z0, z1) {
  trace(parent, [[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]]);
}
function arc(parent, x, z, radius, start = 0, end = Math.PI * 2) {
  const points = [];
  for (let i = 0; i <= 80; i++) {
    const theta = start + (end - start) * i / 80;
    points.push([x + Math.cos(theta) * radius, z + Math.sin(theta) * radius]);
  }
  trace(parent, points);
}
function woodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#bf8c58';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 1249;
  const rand = () => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296};
  for (let y = 0; y < 512; y += 31) {
    for (let x = 0; x < 1024; x += 155) {
      const left = x + (Math.floor(y / 31) % 2) * 75;
      ctx.fillStyle = 'rgba(255,235,179,' + (0.025 + rand() * .08) + ')';
      ctx.fillRect(left, y, 153, 30);
      ctx.strokeStyle = 'rgba(69,45,29,.18)';
      ctx.strokeRect(left + .5, y + .5, 153, 30);
      ctx.strokeStyle = 'rgba(93,65,35,.07)';
      for (let s = 0; s < 4; s++) {
        ctx.beginPath();
        ctx.moveTo(left + 6, y + 4 + s * 6);
        ctx.lineTo(left + 148, y + 3 + s * 6 + rand() * 3);
        ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
const HAIR_STYLES_B = ['short','buzz','mash','sidepart','centerpart','slickback','wavy','curly','ponytail','long','afro'];
const hairColorsB = [0x1b2026, 0x3b2d22, 0x775139, 0x9b7449, 0x7a2e1d, 0x8a8d90];
// Face types (eye/brow shapes, iris, nose/lips, skin) and hairstyles come
// from the shared face.js system, same as the soccer squads.
export function createAthlete(player, team) {
  const group = new THREE.Group();
  // The torso pivots at the hips (y .99), not at the floor: leaning forward
  // while running now rotates the upper body around the waist, so the
  // torso, pelvis and legs stay connected instead of shearing apart.
  const torso = new THREE.Group();
  torso.position.y = .99;
  const main = material(team.color);
  const trim = material(team.trim);
  const faceSeed = [...(team.id ?? 'tokyo')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) + player.id * 31 + player.slot * 7;
  const face = faceFor(SQUAD_FACE_POOLS[team.id] ?? SQUAD_FACE_POOLS.tokyo, faceSeed);
  const skin = material(face.skin);
  const hairColor = hairColorsB[(player.id * 5 + 2) % hairColorsB.length];
  const hair = material(hairColor);
  const shoe = material(player.slot % 2 ? 0xf3f0e6 : 0x27394b);
  group.add(torso);
  // A pelvis mass bridges waist and thighs at the hip line.
  mesh(group, new THREE.SphereGeometry(.16, 10, 8), trim, 0, .985, 0).scale.set(1.15, .62, .85);
  // Slim athletic torso: narrower waist, still wider left/right than
  // front/back, like a jersey on a lean frame. (Y values are hip-relative.)
  mesh(torso,new THREE.CylinderGeometry(.195,.155,.54,8),main,0,.33,0)
    .scale.set(1.12,1,.84);
  mesh(torso,new THREE.CylinderGeometry(.168,.158,.16,8),trim,0,.02,0)
    .scale.set(1.08,1,.84);
  // Jersey detailing: chest stripe and neckline in the trim colour.
  mesh(torso,new THREE.CylinderGeometry(.184,.178,.05,8),trim,0,.45,0)
    .scale.set(1.11,1,.83);
  mesh(torso,new THREE.CylinderGeometry(.088,.098,.045,8),trim,0,.585,0)
    .scale.set(1,1,.9);
  const head = new THREE.Group();
  head.position.set(0, .83, 0);
  torso.add(head);
  // Imported CC0 head (shared with soccer), morphed by face type; its
  // own slimmed neck meets the jersey neckline, jaw clear of the neck.
  buildImportedHead(head, material, {
    face, skinTone: face.skin, hairColor,
    hairstyle: HAIR_STYLES_B[(player.id * 7 + player.slot * 3) % HAIR_STYLES_B.length],
    seed: faceSeed, f: 1.16, seat: -.25,
  });
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(side * .095,.99,0);
    group.add(thigh);
    mesh(thigh, new THREE.CylinderGeometry(.078,.064,.46,7), skin, 0,-.22,0);
    mesh(thigh, new THREE.CylinderGeometry(.092,.078,.21,7), trim, 0,-.055,0);
    // Shorts side stripe in the jersey colour.
    mesh(thigh, new THREE.BoxGeometry(.018,.19,.05), main, side * .088,-.055,0);
    const knee = new THREE.Group();
    knee.position.y = -.47;
    thigh.add(knee);
    mesh(knee, new THREE.IcosahedronGeometry(.07,1), skin, 0,0,0);
    mesh(knee, new THREE.CylinderGeometry(.056,.047,.45,7), skin, 0,-.215,0);
    const ankle = new THREE.Group();
    ankle.position.y = -.46;
    knee.add(ankle);
    mesh(ankle, new THREE.BoxGeometry(.13,.10,.25), shoe, 0,-.055,.07);
    // Light sole under the shoe.
    mesh(ankle, new THREE.BoxGeometry(.135,.025,.255), material(0xf3f0e6), 0,-.112,.07);
    legs.push({hip:thigh, knee, ankle});
    const arm = new THREE.Group();
    arm.position.set(side * .222,.54,0);
    torso.add(arm);
    mesh(arm,new THREE.CylinderGeometry(.07,.06,.14,7),main,0,-.048,0);
    mesh(arm,new THREE.CylinderGeometry(.054,.046,.14,7),skin,0,-.17,0);
    const elbow = new THREE.Group();
    elbow.position.y = -.245;
    arm.add(elbow);
    mesh(elbow,new THREE.IcosahedronGeometry(.062,1),skin,0,0,0);
    mesh(elbow,new THREE.CylinderGeometry(.052,.042,.25,7),skin,0,-.125,0);
    const wrist = new THREE.Group();
    wrist.position.y=-.255;
    elbow.add(wrist);
    const palm=mesh(wrist,new THREE.BoxGeometry(.108,.125,.040),skin,0,-.062,0);
    palm.rotation.x=-.18; // Visible open palm, rather than a spherical fist.
    for(let finger=-1;finger<=1;finger++) {
      mesh(wrist,new THREE.CylinderGeometry(.013,.010,.075,5),skin,finger*.031,-.153,.014);
    }
    const palmPoint=new THREE.Object3D();
    palmPoint.position.set(0,-.17,.02);
    wrist.add(palmPoint);
    arms.push({shoulder:arm, elbow, wrist, palmPoint});
  }
  const plate = document.createElement('canvas');
  plate.width = 128; plate.height = 128;
  const ctx = plate.getContext('2d');
  ctx.fillStyle = '#fff6e6';ctx.textAlign='center';ctx.font='bold 75px Arial';
  ctx.fillText(String(player.number),64,89);
  // Number faces backward (-local Z). It no longer appears on the chest.
  const number=mesh(torso,new THREE.PlaneGeometry(.32,.32),
    new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(plate),
      transparent:true,side:THREE.DoubleSide,depthWrite:false}),0,.36,-.152);
  number.rotation.y=Math.PI;
  group.scale.setScalar(player.height / 1.99);
  return {group, legs, arms, torso, player};
}


// Point fingertips at the ball with a two-link IK solve in torso space.
// Arm parts remain attached to the skeleton and follow its turning.
const DOWN=new THREE.Vector3(0,-1,0);
const IK_UPPER=.245, IK_LOWER=.425;
function aimPalm(model,armIndex,ball,amount) {
  if(amount<=0)return;
  const part=model.arms[armIndex];
  model.group.updateMatrixWorld(true);
  const target=model.torso.worldToLocal(new THREE.Vector3(ball.x,ball.y+BALL_RADIUS,ball.z));
  const start=part.shoulder.position.clone();
  const direction=target.sub(start);
  const originalDistance=direction.length();
  if(originalDistance<.001)return;
  const distance=THREE.MathUtils.clamp(originalDistance,
    Math.abs(IK_UPPER-IK_LOWER)+.003,IK_UPPER+IK_LOWER-.003);
  direction.normalize();
  const reach=(IK_UPPER**2-IK_LOWER**2+distance**2)/(2*distance);
  const elbowHeight=Math.sqrt(Math.max(0,IK_UPPER**2-reach**2));
  // Bending the elbow downward/backward keeps the dribbling elbow below
  // the shoulder instead of forming an outward-pointing chicken wing.
  const sideways=new THREE.Vector3(armIndex?.12:-.12,-1,-.42);
  sideways.addScaledVector(direction,-sideways.dot(direction));
  if(sideways.lengthSq()<.001)sideways.set(0,0,1);
  sideways.normalize();
  const elbowPoint=start.clone().addScaledVector(direction,reach)
    .addScaledVector(sideways,elbowHeight);
  const reachEnd=start.clone().addScaledVector(direction,distance);
  const upperDirection=elbowPoint.clone().sub(start).normalize();
  const lowerDirection=reachEnd.sub(elbowPoint).normalize();
  const upperQuat=new THREE.Quaternion().setFromUnitVectors(DOWN,upperDirection);
  const lowerGlobalQuat=new THREE.Quaternion().setFromUnitVectors(DOWN,lowerDirection);
  const lowerRelativeQuat=upperQuat.clone().invert().multiply(lowerGlobalQuat);
  part.shoulder.quaternion.slerp(upperQuat,amount);
  part.elbow.quaternion.slerp(lowerRelativeQuat,amount);
  part.wrist.rotation.x*=1-amount;
}
function contactAmount(ball) {
  return ease((ball.y-.78)/.23);
}

// Alpha-textured discs give soft visible contact shadows even on GPUs with
// limited real-time shadow resolution. Geometry is shared across ten players.
function shadowTexture() {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');
  const gradient=ctx.createRadialGradient(64,64,3,64,64,63);
  gradient.addColorStop(0,'rgba(9,18,25,.78)');
  gradient.addColorStop(.28,'rgba(9,18,25,.60)');
  gradient.addColorStop(.67,'rgba(9,18,25,.25)');
  gradient.addColorStop(1,'rgba(9,18,25,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  return new THREE.CanvasTexture(canvas);
}
function contactShadow(parent,texture,size) {
  const material=new THREE.MeshBasicMaterial({
    map:texture,transparent:true,opacity:.32,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide
  });
  const circle=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
  circle.rotation.x=-Math.PI/2;
  circle.position.y=-.041;
  circle.scale.set(size,size,1);
  circle.renderOrder=2;
  parent.add(circle);
  return circle;
}

export class ArenaScene {
  constructor(container, match, squads) {
    this.container = container;
    this.match = match;
    this.squads = squads;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141c29);
    this.scene.fog = new THREE.Fog(0x141c29, 48, 95);
    this.renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(43, 1, .15, 240);
    this.camera.position.set(0, 18, 25);
    this.target = new THREE.Vector3();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 58;
    this.controls.maxPolarAngle = Math.PI * .49;
    this.controls.enabled = false;
    this.mode = 'follow';
    this.scene.add(new THREE.HemisphereLight(0xeaf5ff, 0x483326, 2.2));
    for (const x of [-11, 11]) for (const z of [-9, 9]) {
      const light = new THREE.SpotLight(0xffffff, 180, 75, Math.PI / 3.5, .65);
      light.position.set(x, 20, z);
      light.target.position.set(0, 0, 0);
      light.castShadow = x === -11 && z === -9;
      light.shadow.mapSize.set(1024, 1024);
      this.scene.add(light, light.target);
    }
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.makeCourt();
    this.makeArena();
    this.sideline=makeSidelines(this.world,THREE,this.squads);
    this.shadowTexture=shadowTexture();
    this.shadows=[];
    this.ballShadow=contactShadow(this.scene,this.shadowTexture,.49);
    this.playersGroup = new THREE.Group();
    this.scene.add(this.playersGroup);
    this.models = [];
    this.makePlayers();
    this.ball = mesh(this.scene, new THREE.SphereGeometry(.119, 16, 12), material(0xdf853e),0,1,0);
    const seams = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8),
      new THREE.MeshBasicMaterial({color:0x40251b,wireframe:true,transparent:true,opacity:.55}));
    this.ball.add(seams);
    this.halo = new THREE.Mesh(new THREE.RingGeometry(.36,.47,36),
      new THREE.MeshBasicMaterial({color:0xbdf7d8,side:THREE.DoubleSide,transparent:true,opacity:.8}));
    this.halo.rotation.x = -Math.PI / 2;
    this.halo.position.y = .065;
    this.scene.add(this.halo);
    this.resize = new ResizeObserver(() => {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
      this.renderer.setSize(w,h,false);
      this.camera.aspect = w/h;
      this.camera.updateProjectionMatrix();
    });
    this.resize.observe(container);
  }
  makeCourt() {
    cuboid(this.world,[45,.55,29],0x1b252f,[0,-.37,0]);
    mesh(this.world,new THREE.PlaneGeometry(COURT.length,COURT.width),
      new THREE.MeshStandardMaterial({map:woodTexture(),roughness:.49,metalness:.04}),0,-.067,0).rotation.x = -Math.PI/2;
    for (const side of [-1,1]) {
      mesh(this.world,new THREE.PlaneGeometry(3.5,COURT.width),new THREE.MeshBasicMaterial({color:0x456071,transparent:true,opacity:.24}),
        side*12.25,-.059,0).rotation.x=-Math.PI/2;
    }
    rectangle(this.world,-14,14,-7.5,7.5);
    trace(this.world,[[0,-7.5],[0,7.5]]);
    arc(this.world,0,0,1.8);
    for (const dir of [-1,1]) {
      rectangle(this.world,dir<0?-14:8.2,dir<0?-8.2:14,-2.45,2.45);
      arc(this.world,dir*8.2,0,1.8);
      const points=[];
      for(let i=0;i<=80;i++){
        const z=-6.75+i*13.5/80;
        const x=dir*(COURT.basketX-Math.sqrt(Math.max(0,6.75**2-z**2)));
        points.push([x,z]);
      }
      trace(this.world,points);
      trace(this.world,[[dir*COURT.basketX,-7.5],[dir*COURT.basketX,-6.75]]);
      trace(this.world,[[dir*COURT.basketX,6.75],[dir*COURT.basketX,7.5]]);
      cuboid(this.world,[.16,3.35,.18],0x677987,[dir*14.4,1.55,0]);
      const board = cuboid(this.world,[.14,1.05,1.8],0xf2f6f4,[dir*13.17,3.35,0]);
      board.material.transparent=true;board.material.opacity=.68;board.material.roughness=.12;
      const square=new THREE.Group();this.world.add(square);
      traceBoard(square,dir*13.04);
      const ring = mesh(this.world,new THREE.TorusGeometry(.23,.025,9,35),material(0xec6d37,.36),dir*COURT.basketX,COURT.rimHeight,0);
      ring.rotation.x = -Math.PI/2;
      for(let j=0;j<12;j++){
        const a=j*Math.PI/6, b=(j+.5)*Math.PI/6;
        const x=dir*COURT.basketX;
        const segments=[[x+Math.cos(a)*.23,COURT.rimHeight,Math.sin(a)*.23],
          [x+Math.cos(b)*.16,2.63,Math.sin(b)*.16],
          [x+Math.cos(a)*.13,2.43,Math.sin(a)*.13]];
        const geo=new THREE.BufferGeometry().setFromPoints(segments.map(p=>new THREE.Vector3(...p)));
        this.world.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xdcebe4,transparent:true,opacity:.68})));
      }
    }
    function traceBoard(group,x) {
      const pts = [[x,3.12,-.32],[x,3.55,-.32],[x,3.55,.32],[x,3.12,.32],[x,3.12,-.32]];
      const geometry=new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p)));
      group.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xd96b39})));
    }
  }
  makeArena() {
    for(const side of [-1,1]){
      for(let row=0;row<7;row++){
        const z=side*((side>0?11.25:9.1)+row*1.25);
        cuboid(this.world,[35,.5,1.35],row%2?0x263346:0x36445a,[0,.45+row*.57,z]);
      }
      for(let row=0;row<3;row++){
        const x=side*(17.3+row*1.55);
        cuboid(this.world,[1.45,.75,30],row%2?0x233044:0x35465b,[x,.4+row*.74,0]);
      }
    }
    const spectator = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.23,0),material(0x8796a2),400);
    const dummy = new THREE.Object3D();
    for(let i=0;i<400;i++){
      const side = i%2 ? 1 : -1, row = Math.floor(i/50)%7, seat = Math.floor(i/2)%25;
      const color = new THREE.Color([0x8bacc1,0xc2b69a,0xbd7873,0x748b80,0x617184][(i*7+row)%5]);
      spectator.setColorAt(i,color);
      dummy.position.set(-15+seat*1.25,.95+row*.58,side*((side>0?11.25:9.1)+row*1.25));
      dummy.scale.set(.72,1.4,.88);
      dummy.updateMatrix();spectator.setMatrixAt(i,dummy.matrix);
    }
    spectator.castShadow=false;
    this.world.add(spectator);
    for(const x of [-15.6,15.6]) {
      cuboid(this.world,[.7,7,.7],0x233044,[x,10,-16]);
      cuboid(this.world,[.7,7,.7],0x233044,[x,10,16]);
    }
  }
  makePlayers() {
    for (const model of this.models) {
      model.group.traverse(node => {node.geometry?.dispose();if(node.material){node.material.map?.dispose();node.material.dispose();}});
      model.group.removeFromParent();
    }
    this.shadows.forEach(shadow=>{shadow.material.dispose();shadow.removeFromParent();});
    this.shadows=this.match.players.map(()=>contactShadow(this.scene,this.shadowTexture,.78));
    this.models = this.match.players.map(p => {
      const model = createAthlete(p,this.squads[p.team]);
      this.playersGroup.add(model.group);
      return model;
    });
  }
  setSquads(squads) {
    this.squads=squads;this.makePlayers();
    this.sideline.group.removeFromParent();
    this.sideline=makeSidelines(this.world,THREE,this.squads);
  }
  setCamera(mode) {
    this.mode=mode;
    this.controls.enabled=mode==='free';
    if(mode==='free'){this.controls.target.copy(this.target);this.controls.update();}
  }
  update(dt) {
    for (const model of this.models) {
      const p = model.player;
      const motion=defenseAnimationState(this.match,p,guardPose(this.match,p));
      const guard=motion.guard;
      const sprinting=!!guard;
      const body=runningBodyPose(p.phase,p.speed,sprinting,p.turnRate||0,p.accel||0);
      const jumping=jumpHeight(p);
      model.group.position.set(p.x,body.bounce+jumping,p.z);
      const floorShadow=this.shadows[p.id];
      const shadow=shadowAppearance(body.bounce+jumping,.84);
      floorShadow.position.set(p.x,-.038,p.z);
      floorShadow.scale.set(shadow.radius,shadow.radius,1);
      floorShadow.material.opacity=shadow.opacity;
      // Defense faces the assigned player/ball while shuffling sideways.
      // Offense continues to face its movement direction.
      if((!guard && p.team===this.match.possession && Number.isFinite(p.heading)) || motion.runFacing) {
        const facing=motion.runFacing?Math.atan2(p.vx,p.vz):p.heading;
        const turn=Math.atan2(Math.sin(facing-model.group.rotation.y),Math.cos(facing-model.group.rotation.y));
        model.group.rotation.y+=turn*(1-Math.exp(-dt*24));
      } else {
        const facing=guard?.faceAngle ?? (p.speed>.1?Math.atan2(p.vx,p.vz):model.group.rotation.y);
        const turn=Math.atan2(Math.sin(facing-model.group.rotation.y),Math.cos(facing-model.group.rotation.y));
        model.group.rotation.y+=turn*(1-Math.exp(-dt*(guard?5.5:6)));
      }
      const running=Math.min(1,p.speed/3.5);
      const wave=Math.sin(p.phase)*.67*running;
      const crouch=guard?.crouch ?? 0;
      // Hip, knee and ankle are separate joints. Each leg alternates between
      // planted support and bent-knee recovery, with a small guarded shuffle.
      const legBlend=1-Math.exp(-Math.min(dt,.08)*12);
      for(let i=0;i<2;i++){
        const side=i?1:-1;
        const pose=runningLegPose(p.phase,p.speed,sprinting,side,guard?.footSpread ?? 0);
        const leg=model.legs[i];
        const inAir=jumping>.03;
        const hipTarget=pose.hipX+(inAir ? (i===0?.20:-.16):0);
        const kneeTarget=pose.kneeX+(inAir?.36:0);
        leg.hip.rotation.x += (hipTarget-leg.hip.rotation.x)*legBlend;
        leg.hip.rotation.z += (pose.hipZ-leg.hip.rotation.z)*legBlend;
        leg.knee.rotation.x += (kneeTarget-leg.knee.rotation.x)*legBlend;
        leg.ankle.rotation.x += (pose.ankleX-leg.ankle.rotation.x)*legBlend;
      }
      const ft=this.match.freeThrows;
      const isFreeThrow=ft?.shooter===p.id && ft.state==='flight';
      const isShooting=p.action==='shoot';
      const shotProgress=isFreeThrow ? 1-ft.timer/1.65 : 1-p.actionTime/.8;
      const hop=isShooting && isFreeThrow ? .025*
        Math.sin(Math.PI*Math.max(0,Math.min(1,shotProgress))) : 0;
      const naturalBounce=.025*Math.abs(Math.sin(p.phase))*running;
      model.torso.position.y=.99+(guard?-crouch*.5:naturalBounce*.30)+hop;
      model.torso.rotation.x=guard?.10:body.lean;
      model.torso.rotation.z=guard?0:-body.bank;
      const blend=1-Math.exp(-dt*11);
      for(let i=0;i<2;i++){
        const side=i?1:-1;
        const arm=model.arms[i];
        let x=(i?wave:-wave)*.65, z=side*.08, ex=-.15, ez=0, wx=-.12;
        if(p.jump?.type==='dunk'){
          x=-2.7;z=side*.18;ex=-.05;wx=0;
        }else if(guard){
          const target=guard.arms[i];
          x=target.shoulderX;z=target.shoulderZ;
          ex=target.elbowX;ez=target.elbowZ;wx=target.wristX;
        }else if(isShooting){
          x=-2.55;z=side*.22;ex=-.20;wx=-.1;
        }else if(p.action==='dribble'){
          const active=this.match.ballControl?.hand===side;
          x=active?-.65:-.18;ex=active?-.53:-.32;
        }else if(p.action==='pass'||p.action==='catch'){
          x=-1.18;z=side*.18;ex=-.4;
        }
        arm.shoulder.rotation.x += (x-arm.shoulder.rotation.x)*blend;
        arm.shoulder.rotation.z += (z-arm.shoulder.rotation.z)*blend;
        arm.elbow.rotation.x += (ex-arm.elbow.rotation.x)*blend;
        arm.elbow.rotation.z += (ez-arm.elbow.rotation.z)*blend;
        arm.wrist.rotation.x += (wx-arm.wrist.rotation.x)*blend;
      }
      const flight=this.match.flight,control=this.match.ballControl;
      const active=this.match.owner===p && control?.mode==='dribble';
      const securing=this.match.owner===p && control?.mode==='secure';
      if(active) {
        aimPalm(model,control.hand===-1?0:1,this.match.ball,contactAmount(this.match.ball));
      } else if(securing) {
        for(let i=0;i<2;i++)aimPalm(model,i,this.match.ball,.92);
      } else if(flight?.from===p.id && flight.stage==='gather') {
        const gather=flight.kind==='pass'?PASS_GATHER:SHOT_GATHER;
        const progress=ease((flight.t*flight.duration)/gather);
        for(let i=0;i<2;i++)aimPalm(model,i,this.match.ball,.55+progress*.45);
      } else if(flight?.kind==='pass' && flight.to===p.id) {
        const remaining=flight.duration*(1-flight.t);
        if(flight.stage==='catch'||remaining<PASS_CATCH+.22) {
          const approach=Math.max(0,remaining-PASS_CATCH);
          const reach=flight.stage==='catch'?1:ease(1-approach/.22);
          for(let i=0;i<2;i++)aimPalm(model,i,this.match.ball,reach);
        }
      } else if(this.match.freeThrows?.shooter===p.id && this.match.freeThrows.state==='setup') {
        for(let i=0;i<2;i++)aimPalm(model,i,this.match.ball,.93);
      }
    }
    this.sideline.update(this.match,dt);
    const b=this.match.ball;
    this.ball.position.set(b.x,b.y,b.z);
    const ballShade=shadowAppearance(b.y,.54);
    this.ballShadow.position.set(b.x,-.034,b.z);
    this.ballShadow.material.opacity=ballShade.opacity;
    this.ballShadow.scale.set(ballShade.radius,ballShade.radius,1);
    this.ball.rotation.z+=dt*3;
    this.ball.rotation.x+=dt*1.4;
    this.halo.visible=!!this.match.owner;
    if(this.match.owner) this.halo.position.set(this.match.owner.x,.06,this.match.owner.z);
    if(this.mode==='free') this.controls.update();
    else {
      const p=this.match.owner;
      const ball=this.match.ball;
      const dir=this.match.direction(this.match.possession);
      let target, cameraPos, fov;
      if(this.mode==='tactical'){
        target=new THREE.Vector3(0,0,0);
        cameraPos=new THREE.Vector3(.01,37,.01);
        fov=46;
      }else if(this.mode==='follow'){
        target=new THREE.Vector3(ball.x,.8,ball.z);
        cameraPos=new THREE.Vector3(ball.x-dir*5,8,ball.z+12);
        fov=48;
      }else {
        target=new THREE.Vector3(ball.x*.27,.3,ball.z*.20);
        cameraPos=new THREE.Vector3(ball.x*.27,17.2,24);
        fov=44;
      }
      const factor=1-Math.exp(-Math.min(dt,.08)*1.55);
      this.camera.position.lerp(cameraPos,factor);
      this.target.lerp(target,factor);
      this.camera.lookAt(this.target);
      this.camera.fov=THREE.MathUtils.lerp(this.camera.fov,fov,factor);
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene,this.camera);
  }
  dispose() {
    this.resize.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
