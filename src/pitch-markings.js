import * as THREE from 'three';

export function createPitchMarkings() {
  // Paint in pitch metres, including a margin so boundary lines are complete.
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 2688;
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width / 106, canvas.height / 69);
  ctx.translate(53, 34.5);
  ctx.lineWidth = .12;
  ctx.strokeStyle = ctx.fillStyle = '#eff0db';
  const arc = (x, z, r, start, end) => {
    ctx.beginPath();
    ctx.arc(x, z, r, start, end);
    ctx.stroke();
  };
  const spot = (x, r) => {
    ctx.beginPath();
    ctx.arc(x, 0, r, 0, 2 * Math.PI);
    ctx.fill();
  };
  ctx.strokeRect(-52.5, -34, 105, 68);
  ctx.beginPath();
  ctx.moveTo(0, -34);
  ctx.lineTo(0, 34);
  ctx.stroke();
  arc(0, 0, 9.15, 0, 2 * Math.PI);
  spot(0, .15);
  for (const end of [-1, 1]) {
    ctx.save();
    ctx.scale(end, 1);
    ctx.strokeRect(36, -20.16, 16.5, 40.32);
    ctx.strokeRect(47, -9.16, 5.5, 18.32);
    spot(41.5, .11);
    const angle = Math.acos(5.5 / 9.15);
    arc(41.5, 0, 9.15, Math.PI - angle, Math.PI + angle);
    arc(52.5, -34, 1, Math.PI / 2, Math.PI);
    arc(52.5, 34, 1, Math.PI, 1.5 * Math.PI);
    ctx.restore();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const paint = new THREE.Mesh(new THREE.PlaneGeometry(106, 69),
    new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: .94 }));
  paint.rotation.x = -Math.PI / 2;
  paint.position.y = .043;
  paint.receiveShadow = true;
  return paint;
}
