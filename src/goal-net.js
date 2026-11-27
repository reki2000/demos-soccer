import * as THREE from 'three';

// Share knots between mesh cells. All four net panels draw together.
export function createGoalNet(direction) {
  const points = [], lines = [];
  function panel(columns, rows, knot) {
    const base = points.length / 3;
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col <= columns; col++) {
        const index = base + row * (columns + 1) + col;
        points.push(...knot(col / columns, row / rows));
        if (col) lines.push(index - 1, index);
        if (row) lines.push(index - columns - 1, index);
      }
    }
  }
  const back = y => 2.4 - .65 * y;
  panel(36, 12, (u,v) => [back(v), 2.44*v, 7.32*(u-.5)]);
  panel(36, 9, (u,v) => [back(1)*v, 2.44-.08*Math.sin(v*Math.PI), 7.32*(u-.5)]);
  for (const side of [-1,1])
    panel(10, 12, (u,v) => [back(v)*u, 2.44*v, side*3.66]);
  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(lines);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points,3));
  const net = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0xd4ddd7, transparent: true, opacity: .66,
  }));
  net.position.x = direction*52.5;
  net.scale.x = direction;
  return net;
}
