import * as THREE from 'three';

export function createMatchBall() {
  // Each icosahedron face contributes one ivory hexagon and three parts of
  // neighbouring pentagons. All twenty faces can share the same texture.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#20282c';
  ctx.fillRect(0, 0, 256, 256);
  const corners = [[8, 240], [248, 240], [128, 24]];
  ctx.beginPath();
  corners.forEach(([x, y], i) => {
    const [nx, ny] = corners[(i + 1) % 3];
    for (const t of [1 / 3, 2 / 3]) {
      ctx.lineTo(x + (nx - x) * t, y + (ny - y) * t);
    }
  });
  ctx.closePath();
  ctx.fillStyle = '#f4f1e7';
  ctx.fill();
  ctx.strokeStyle = '#94958d';
  ctx.lineWidth = 2;
  ctx.stroke();

  const geometry = new THREE.IcosahedronGeometry(.11, 5);
  const base = new THREE.IcosahedronGeometry(1, 0);
  const face = new THREE.Triangle();
  const point = new THREE.Vector3(), weights = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const vertices = geometry.attributes.position;
  const faceSize = vertices.count / 20;
  for (let i = 0; i < 20; i++) {
    [face.a, face.b, face.c].forEach((v, j) => v.fromBufferAttribute(base.attributes.position, 3 * i + j));
    face.getNormal(normal);
    for (let j = i * faceSize; j < (i + 1) * faceSize; j++) {
      point.fromBufferAttribute(vertices, j);
      point.multiplyScalar(normal.dot(face.a) / normal.dot(point));
      face.getBarycoord(point, weights);
      const u = weights.x * 8 + weights.y * 248 + weights.z * 128;
      const v = (weights.x + weights.y) * 240 + weights.z * 24;
      geometry.attributes.uv.setXY(j, u / 256, 1 - v / 256);
    }
  }
  base.dispose();
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, roughness: .56 }));
  ball.castShadow = ball.receiveShadow = true;
  return ball;
}
