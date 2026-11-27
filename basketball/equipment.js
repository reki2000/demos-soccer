import * as THREE from 'three';
import { BALL_RADIUS } from './ball-motion.js';

export function createBasketball() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#bc612e';
  ctx.fillRect(0, 0, 512, 256);
  // Stagger the pebbling on each row like the embossed cover of a game ball.
  for (let y = 0; y < 256; y += 3) {
    for (let x = (y % 2) * 1.5; x < 512; x += 3) {
      ctx.fillStyle = 'rgba(76,32,16,.25)';
      ctx.fillRect(x, y, 1.6, 1.4);
      ctx.fillStyle = 'rgba(255,201,140,.23)';
      ctx.fillRect(x, y + 1.4, 1.4, .8);
    }
  }
  ctx.strokeStyle = '#332821';
  ctx.lineWidth = 3;
  for (const y of [0, 128, 256]) {
    ctx.beginPath();
    for (let x = 0; x <= 512; x += 2) {
      const curve = Math.sin(Math.PI * x / 256) ** 2;
      const offset = y === 128 ? 0 : (y === 0 ? 1 : -1) * (32 + 52 * curve);
      if (x === 0) ctx.moveTo(x, y + offset);
      else ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }
  for (const x of [128, 384]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 32, 24),
    new THREE.MeshStandardMaterial({ map, roughness: .76 }));
  ball.castShadow = ball.receiveShadow = true;
  return ball;
}

export function createHoopNet() {
  const points = [];
  const radii = [.226, .212, .172, .139, .123];
  const at = (row, knot) => {
    const angle = (knot + (row % 2) / 2) * Math.PI / 6;
    return new THREE.Vector3(Math.cos(angle) * radii[row], -row * .108, Math.sin(angle) * radii[row]);
  };
  for (let row = 0; row < radii.length - 1; row++) {
    for (let knot = 0; knot < 12; knot++) {
      points.push(at(row, knot), at(row + 1, knot));
      points.push(at(row, knot), at(row + 1, knot + (row % 2 ? 1 : -1)));
    }
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  // Deform the lower knots while the twelve loops stay attached to the rim.
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(points.flatMap(p => {
    const depth = -p.y / .432;
    return [p.x * (1 + .16 * depth), p.y * (1 + .27 * depth), p.z * (1 + .16 * depth)];
  }), 3)];
  const net = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xf4f1e7 }));
  net.updateMorphTargets();
  return net;
}
