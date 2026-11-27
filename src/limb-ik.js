import * as THREE from 'three';

const down=new THREE.Vector3(0,-1,0);
const axis=new THREE.Vector3(), pole=new THREE.Vector3(), joint=new THREE.Vector3();
const upper=new THREE.Quaternion(), lower=new THREE.Quaternion();

// Both segments point along local -Y. Solve in the upper joint's parent
// space, including its uniform limb scale in the physical reach.
export function aimLimb(root, hinge, endLength, world, bend, amount) {
  if(amount<=0)return;
  root.parent.worldToLocal(axis.copy(world)).sub(root.position);
  const length=axis.length();
  if(length<.0001)return;
  axis.divideScalar(length);
  const a=-hinge.position.y*root.scale.y, b=endLength*root.scale.y;
  const d=THREE.MathUtils.clamp(length,Math.abs(a-b)+.0001,a+b-.0001);
  const along=(a*a-b*b+d*d)/(2*d);
  pole.copy(bend).addScaledVector(axis,-axis.dot(bend));
  if(pole.lengthSq()<.00001)pole.set(1,0,0).addScaledVector(axis,-axis.x);
  joint.copy(axis).multiplyScalar(along).addScaledVector(pole.normalize(),Math.sqrt(Math.max(0,a*a-along*along)));
  lower.setFromUnitVectors(down,axis.multiplyScalar(d).sub(joint).normalize());
  upper.setFromUnitVectors(down,joint.normalize());
  root.quaternion.slerp(upper,amount);
  hinge.quaternion.slerp(upper.invert().multiply(lower),amount);
}
