import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function createPitchMarkings() {
  const parts = [];
  const width = .12;
  function place(geometry, x, z) {
    parts.push(geometry.rotateX(-Math.PI/2).translate(x,0,z));
  }
  function stripe(x,z,length,depth) {
    place(new THREE.PlaneGeometry(length,depth),x,z);
  }
  function arc(x,z,r,start=0,end=2*Math.PI) {
    const segments = Math.max(8, Math.ceil((end-start)*r*2));
    place(new THREE.RingGeometry(r-width/2,r+width/2,segments,1,-end,end-start),x,z);
  }
  function spot(x,r) {
    place(new THREE.CircleGeometry(r,24),x,0);
  }
  for (const z of [-34,34]) stripe(0,z,105+width,width);
  stripe(0,0,width,68);
  arc(0,0,9.15);
  spot(0,.15);
  const angle = Math.acos(5.5/9.15);
  for (const side of [-1,1]) {
    stripe(side*52.5,0,width,68);
    for (const [length,halfWidth] of [[16.5,20.16],[5.5,9.16]]) {
      stripe(side*(52.5-length),0,width,2*halfWidth+width);
      for (const z of [-halfWidth,halfWidth]) stripe(side*(52.5-length/2),z,length,width);
    }
    spot(side*41.5,.11);
    const inward = side===1 ? Math.PI : 0;
    arc(side*41.5,0,9.15,inward-angle,inward+angle);
    arc(side*52.5,-34,1,inward/2,inward/2+Math.PI/2);
    arc(side*52.5,34,1,-inward/2-Math.PI/2,-inward/2);
  }
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  const paint = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xeff0db,roughness:.94}));
  paint.position.y=.043;
  paint.receiveShadow=true;
  return paint;
}
