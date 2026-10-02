import * as THREE from 'three';

export function createStandShell(textures = {}) {
  const group = new THREE.Group();group.name='スタンドの壁・床下・コーナー';
  const concrete=new THREE.MeshStandardMaterial({color:0x738077,map:textures.concrete??null,roughness:.95,side:THREE.DoubleSide});
  const box=(w,h,d,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),concrete);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh};
  // A continuous perimeter meets the roof and seals all four corners.
  for(const side of [-1,1]){
    box(166,16.5,.8,0,7.75,side*65.2);
    box(.8,16.5,131.2,side*82.6,7.75,0);
  }
  function wedge(width,depth){
    const w=width/2;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      -w,-.5,0,w,-.5,0,w,-.5,depth,-w,-.5,depth,
      -w,.8,0,w,.8,0,w,13.1,depth,-w,13.1,depth,
    ],3));
    geometry.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]);
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,concrete);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  for(const side of [-1,1]){
    const long=wedge(143,17);long.position.z=side*43;long.rotation.y=side===1?0:Math.PI;
    const end=wedge(86,17);end.position.x=side*61;end.rotation.y=side*Math.PI/2;
  }
  // Corner concourses close the gaps between the independent seating sections.
  for(const x of [-1,1])for(const z of [-1,1]){
    box(11,12.5,22,x*77,5.75,z*54);
    box(12,.5,23,x*77,12.1,z*54);
  }
  return group;
}
