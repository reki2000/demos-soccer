import * as THREE from 'three';

export const WEATHER = {
  sunny: { label: '晴れ', sky: 0x99c6df, fog: 0xaac8d4, sun: 3.1, ambient: 2.3, exposure: 1.1, far: 650 },
  cloudy: { label: '曇り', sky: 0x8797a2, fog: 0x9aa6ae, sun: 1.1, ambient: 2.1, exposure: 1, far: 480 },
  rain: { label: '雨', sky: 0x536674, fog: 0x71818b, sun: .55, ambient: 1.65, exposure: 1.05, far: 340 },
  dusk: { label: '夕暮れ', sky: 0xc98c7b, fog: 0xd49a81, sun: 1.7, ambient: 1.6, exposure: 1, far: 620 },
};
const material = (color, extras = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, ...extras });
const mesh = (group, geometry, mat, x, y, z) => {
  const m = new THREE.Mesh(geometry, mat); m.position.set(x,y,z); group.add(m); return m;
};

export function createSurfaceTextures(renderer) {
  const textures = {};
  for (const kind of ['grass','concrete','roof','seats','windows','water']) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const base = { grass:'#b1c092', concrete:'#bbb9b2', roof:'#b3bbc0', seats:'#cecfca', windows:'#8297a3', water:'#90b6be' }[kind];
    ctx.fillStyle = base; ctx.fillRect(0,0,256,256);
    let seed = 701;
    const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    for (let i=0;i<(kind==='grass'?15000:7000);i++) {
      const light = random() > .5;
      ctx.fillStyle = light ? `rgba(255,255,230,${random()*.18})` : `rgba(15,24,16,${random()*.2})`;
      const x=random()*256,y=random()*256;
      if(kind==='grass'){ctx.fillRect(x,y,.8+random(),2+random()*4)}else ctx.fillRect(x,y,1+random()*2,1+random()*2);
    }
    if(kind==='concrete') {
      ctx.strokeStyle='#7a7a7040';ctx.lineWidth=2;ctx.strokeRect(0,0,256,128);
      for(const x of [8,248]) for(const y of [8,120,136,248]){ctx.fillStyle='#6f746e88';ctx.beginPath();ctx.arc(x,y,1.5,0,Math.PI*2);ctx.fill()}
    }
    if(kind==='roof') for(let x=0;x<256;x+=16){ctx.fillStyle='#ffffff44';ctx.fillRect(x,0,2,256);ctx.fillStyle='#1f2a3433';ctx.fillRect(x+3,0,2,256)}
    if(kind==='seats') for(let x=0;x<256;x+=32){ctx.fillStyle='#35463855';ctx.fillRect(x,0,2,256);ctx.fillStyle='#ffffff22';ctx.fillRect(x+5,20,22,90)}
    if(kind==='windows') for(let x=4;x<256;x+=24)for(let y=4;y<256;y+=30){ctx.fillStyle=random()<.2?'#e1cb87':'#2d4c62';ctx.fillRect(x,y,15,20);ctx.fillStyle='#c4d4d644';ctx.fillRect(x,y,2,20)}
    if(kind==='water') for(let y=0;y<256;y+=8){ctx.strokeStyle='#e0f8fa40';ctx.beginPath();for(let x=0;x<=256;x+=8){const h=y+Math.sin(x*.06+y)*2;x?ctx.lineTo(x,h):ctx.moveTo(x,h)}ctx.stroke()}
    const texture = new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    texture.repeat.set(kind==='grass'?4:kind==='roof'?12:kind==='concrete'?6:kind==='seats'?20:1,kind==='grass'?32:kind==='windows'?3:2);
    textures[kind]=texture;
  }
  return textures;
}

export class StadiumEnvironment {
  constructor(scene, textures) {
    this.scene=scene;this.textures=textures;this.group=new THREE.Group();this.group.name='スタジアム周辺';scene.add(this.group);
    this.clouds=new THREE.Group();this.group.add(this.clouds);
    this.rainGeometry=new THREE.BufferGeometry();this.rainPositions=new Float32Array(900*6);
    for(let i=0;i<900;i++){const k=i*6;this.rainPositions[k]=(Math.random()-.5)*135;this.rainPositions[k+1]=Math.random()*45;this.rainPositions[k+2]=(Math.random()-.5)*95;this.rainPositions[k+3]=this.rainPositions[k]+.2;this.rainPositions[k+4]=this.rainPositions[k+1]+1.6;this.rainPositions[k+5]=this.rainPositions[k+2];}
    this.rainGeometry.setAttribute('position',new THREE.BufferAttribute(this.rainPositions,3));
    this.rain=new THREE.LineSegments(this.rainGeometry,new THREE.LineBasicMaterial({color:0xc4dce9,transparent:true,opacity:.38,depthWrite:false}));this.rain.frustumCulled=false;scene.add(this.rain);
    this.weather='sunny';this.time=0;
  }

  setVenue(id) {
    for(const child of [...this.group.children]){
      child.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});
      this.group.remove(child);
    }
    this.clouds=new THREE.Group();this.group.add(this.clouds);this.water=null;
    const ground=mesh(this.group,new THREE.PlaneGeometry(1200,1200),material(id==='rio'?0x7a9762:0x65776c),0,-1,0);ground.rotation.x=-Math.PI/2;
    let seed=231;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    const buildingMat=material(id==='london'?0x9e7764:0xa9b5b9,{map:this.textures.windows,roughness:.68});
    const roofMat=material(0x4c5660,{map:this.textures.roof});
    for(let i=0;i<(id==='rio'?30:100);i++){
      const a=i/100*Math.PI*2, radius=125+random()*130;
      if(id==='rio' && i>18)continue;
      const height=id==='tokyo'?18+random()*85:id==='london'?9+random()*23:12+random()*45;
      const x=Math.cos(a)*radius,z=Math.sin(a)*radius;
      mesh(this.group,new THREE.BoxGeometry(9+random()*13,height,9+random()*12),buildingMat,x,height/2-1,z);
      if(id==='london'){const roof=mesh(this.group,new THREE.ConeGeometry(10,6,4),roofMat,x,height+1,z);roof.rotation.y=Math.PI/4}
    }
    if(id==='tokyo'){
      const tower=mesh(this.group,new THREE.CylinderGeometry(1.2,4,120,8),material(0xd5d9d4),-150,59,-185);
      mesh(this.group,new THREE.CylinderGeometry(6,6,6,16),material(0x697a83),tower.position.x,94,tower.position.z);
    }
    if(id==='rio') {
      const waterMat=material(0x2b91ae,{map:this.textures.water,roughness:.25,metalness:.28});
      this.water=mesh(this.group,new THREE.PlaneGeometry(650,1050),waterMat,470,-1.1,0);this.water.rotation.x=-Math.PI/2;
      const shore=mesh(this.group,new THREE.PlaneGeometry(30,1050),material(0xcab990),148,-.95,0);shore.rotation.x=-Math.PI/2;
      for(let i=0;i<9;i++){
        const h=55+random()*95;
        const mountain=mesh(this.group,new THREE.ConeGeometry(45+random()*35,h,9,4),material(i%2?0x5e785b:0x768774,{flatShading:true}),-145-random()*120,h/2-1,-260+i*60);
        mountain.rotation.y=random()*Math.PI;mountain.scale.z=.8+random()*.5;
      }
    }else{
      for(let i=0;i<7;i++)mesh(this.group,new THREE.ConeGeometry(90,35+random()*30,8),material(0x81938b,{flatShading:true}),-350+i*110,10,-340);
    }
    const trunkMat=material(0x63553d),leafMat=material(id==='rio'?0x4f794c:0x526c43);
    for(let i=0;i<70;i++){
      const a=random()*Math.PI*2,r=95+random()*20,x=Math.cos(a)*r,z=Math.sin(a)*r;
      mesh(this.group,new THREE.CylinderGeometry(.25,.4,4,5),trunkMat,x,1,z);
      const crown=mesh(this.group,new THREE.IcosahedronGeometry(2.8,1),leafMat,x,4,z);crown.scale.y=id==='rio'?.45:1.2;
    }
    for(let i=0;i<28;i++){
      const cloud=mesh(this.clouds,new THREE.IcosahedronGeometry(1,2),new THREE.MeshBasicMaterial({color:0xe1e7e8,transparent:true,opacity:.82,depthWrite:false}), (random()-.5)*850,125+random()*90,(random()-.5)*850);
      cloud.scale.set(18+random()*38,4+random()*8,10+random()*18);
    }
    this.setWeather(this.weather);
  }

  setWeather(id) {
    this.weather=id;this.rain.visible=id==='rain';
    this.clouds.visible=id!=='sunny';
    for(const c of this.clouds.children)c.material.color.set(id==='rain'?0x70808d:id==='dusk'?0xe9b5a0:0xd9e0e3);
  }

  update(dt) {
    this.time+=dt;
    this.clouds.rotation.y+=dt*.001;
    if(this.water)this.textures.water.offset.x=this.time*.012;
    if(!this.rain.visible)return;
    for(let i=0;i<this.rainPositions.length;i+=6){
      this.rainPositions[i]-=dt*3;this.rainPositions[i+1]-=dt*25;
      if(this.rainPositions[i+1]<.1){this.rainPositions[i+1]=40+Math.random()*5;this.rainPositions[i]=(Math.random()-.5)*135}
      this.rainPositions[i+3]=this.rainPositions[i]+.2;this.rainPositions[i+4]=this.rainPositions[i+1]+1.6;
    }
    this.rainGeometry.attributes.position.needsUpdate=true;
  }
}
