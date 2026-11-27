import * as THREE from 'three';

// Static vertex colours let clothing, hair and faces share one draw call.
// Keep the former crowd's budget of 400 twenty-triangle silhouettes.
export function createArenaCrowd() {
  const vertices=[], colors=[], indices=[];
  const colour=new THREE.Color();
  let seed=795;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const shirts=[0xc58b64,0x627c88,0x8a555c,0x829877,0xcebea6,0x43516c];
  const skin=[0xc69572,0xd9b094,0xad795e,0x8e624f];
  const hair=[0x372e2b,0x574339,0x595554,0x886547];
  function fan(x,y,z,heading,section){
    const c=Math.cos(heading),s=Math.sin(heading),size=.83+rand()*.25;
    function vertex(dx,dy,dz,tint){
      vertices.push(x+size*(dx*c+dz*s),y+size*dy,z+size*(dz*c-dx*s));
      colour.set(tint);
      colors.push(colour.r,colour.g,colour.b);
    }
    // Tapered rings make a seated lap, shoulders, neck and head in profile.
    function ring(w,h,d,forward,tint){
      for(const [sx,sz] of [[-1,1],[1,1],[1,-1],[-1,-1]])
        vertex(w*sx,h,forward+d*sz,tint);
    }
    function sides(base){
      for(let i=0;i<4;i++){
        const a=base+i,b=base+(i+1)%4;
        indices.push(a,b,b+4,a,b+4,a+4);
      }
    }
    const base=vertices.length/3;
    const shirt=rand()<.45?shirts[section%shirts.length]:shirts[Math.floor(rand()*shirts.length)];
    ring(.16,.02,.15,.09,0x394551);
    ring(.21,.42,.105,0,shirt);
    sides(base);
    indices.push(base+4,base+5,base+6,base+4,base+6,base+7);
    ring(.095,.43,.083,.018,skin[Math.floor(rand()*skin.length)]);
    ring(.108,.65,.092,.006,hair[Math.floor(rand()*hair.length)]);
    sides(base+8);
    indices.push(base+12,base+13,base+14,base+12,base+14,base+15);
  }
  for(const side of [-1,1]){
    for(let row=0;row<7;row++){
      for(let seat=0;seat<25;seat++){
        if(seat===6 || seat===18 || rand()<.07)continue;
        fan((seat-12)*1.27+rand()*.12,.70+row*.57,side*((side>0?11.25:9.1)+row*1.25),
          (side>0?Math.PI:0)+(rand()-.5)*.35,Math.floor(seat/6)+(side+1));
      }
    }
    for(let row=0;row<3;row++){
      for(let seat=0;seat<16;seat++){
        if(seat===8 || rand()<.12)continue;
        fan(side*(17.3+row*1.55),.775+row*.74,(seat-7.5)*1.72,-side*Math.PI/2+(rand()-.5)*.3,row);
      }
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));
}
