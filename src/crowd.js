import * as THREE from 'three';

export function createCrowd(teams) {
  const group = new THREE.Group();
  const people = [];
  let seed = 1931;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  // Seated supporters occupy rows with gaps for the stair aisles.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 12; row++) {
      for (let column = 0; column < 133; column++) {
        if (column % 22 < 2 || random() < .07) continue;
        people.push({ x: column - 66 + random() * .18, y: 2 + row * .9, z: side * (44 + row * 1.2), facing: side === 1 ? Math.PI : 0 });
      }
      for (let column = 0; column < 80; column++) {
        if (column % 20 < 2 || random() < .08) continue;
        people.push({ x: side * (62 + row * 1.2), y: 2 + row * .9, z: column - 40 + random() * .18, facing: side === 1 ? -Math.PI / 2 : Math.PI / 2 });
      }
    }
  }
  const count = people.length;
  const mat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  // The crowd is ~4,300 instanced people and dominates the frame's
  // triangle count, so every part uses the cheapest geometry that
  // still reads at stand distance: open-ended cylinders (caps are
  // never visible on seated people) and a detail-0 head.
  const bodies = new THREE.InstancedMesh(new THREE.CylinderGeometry(.21, .17, .48, 6, 1, true), mat(), count);
  const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.13, 0), mat(), count);
  const hair = new THREE.InstancedMesh(new THREE.SphereGeometry(.135, 5, 2, 0, Math.PI * 2, 0, Math.PI * .48), mat(), count);
  const arms = new THREE.InstancedMesh(new THREE.CylinderGeometry(.052, .04, .40, 4, 1, true), mat(), count * 2);
  arms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const scarves = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .32, .035), mat(), count);
  group.add(bodies, heads, hair, arms, scarves);
  const object = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = [teams[0].shirt, teams[1].shirt, 0xf0e9d3, 0x263e45, 0xab5046, 0x607b9a, 0x839769, 0x343846, 0xd2ae61];
  const skin = [0xe2b88d, 0xb98259, 0x835736, 0xf1cbb0, 0xa66d44];
  const hairstyles = [0x252822, 0x614430, 0xa78653, 0x898d86];
  const waving = [];
  for (let i = 0; i < count; i++) {
    const p = people[i];
    const scale = .8 + random() * .36;
    const leaning = (random() - .5) * .18;
    const shirt = palette[Math.floor(random() * palette.length)];
    object.position.set(p.x, p.y, p.z);
    object.rotation.set(leaning, p.facing, (random() - .5) * .08);
    object.scale.set(scale, scale, scale * .7);
    object.updateMatrix();
    bodies.setMatrixAt(i, object.matrix);
    bodies.setColorAt(i, color.set(shirt));
    object.position.y = p.y + .38 * scale;
    object.scale.setScalar(scale);
    object.updateMatrix();
    heads.setMatrixAt(i, object.matrix);
    heads.setColorAt(i, color.set(skin[Math.floor(random() * skin.length)]));
    object.position.y += .043 * scale;
    object.scale.y *= .6 + random() * .6;
    object.updateMatrix();
    hair.setMatrixAt(i, object.matrix);
    hair.setColorAt(i, color.set(hairstyles[Math.floor(random() * hairstyles.length)]));
    object.position.set(p.x + Math.sin(p.facing) * .16, p.y, p.z + Math.cos(p.facing) * .16);
    object.rotation.set(leaning, p.facing, 0);
    object.scale.setScalar(random() < .3 ? scale : .001);
    object.updateMatrix();
    scarves.setMatrixAt(i, object.matrix);
    scarves.setColorAt(i, color.set(i % 2 ? teams[0].shirt : teams[1].shirt));
    const cheer = random() < .17;
    for (let side = -1; side <= 1; side += 2) {
      const index = i * 2 + (side === 1 ? 1 : 0);
      const raised = cheer ? side * (1.7 + random() * .6) : side * .22;
      const pose = {
        index, x: p.x + Math.cos(p.facing) * side * .2 * scale,
        y: p.y + .17 * scale, z: p.z - Math.sin(p.facing) * side * .2 * scale,
        facing: p.facing, raised, scale, phase: random() * Math.PI * 2,
      };
      setArm(arms, object, pose, raised);
      arms.setColorAt(index, color.set(shirt));
      if (cheer && i % 4 === 0) waving.push(pose);
    }
  }
  return { group, arms, waving, object, elapsed: 0 };
}

function setArm(arms, object, pose, angle) {
  object.rotation.set(0, pose.facing, angle);
  const offset = new THREE.Vector3(0, -.2 * pose.scale, 0).applyEuler(object.rotation);
  object.position.set(pose.x + offset.x, pose.y + offset.y, pose.z + offset.z);
  object.scale.setScalar(pose.scale);
  object.updateMatrix();
  arms.setMatrixAt(pose.index, object.matrix);
}

export function animateCrowd(crowd, dt) {
  crowd.elapsed += dt;
  // The wave is a slow sway; refreshing the arm matrices at 12 Hz is
  // indistinguishable from every frame and avoids re-uploading the
  // whole arms instance buffer (8,500+ matrices) 60 times a second.
  crowd.armAcc = (crowd.armAcc ?? 0) + dt;
  if (crowd.armAcc < 1 / 12) return;
  crowd.armAcc = 0;
  for (const pose of crowd.waving) {
    setArm(crowd.arms, crowd.object, pose, pose.raised + Math.sin(crowd.elapsed * 2 + pose.phase) * .15);
  }
  crowd.arms.instanceMatrix.needsUpdate = true;
}
