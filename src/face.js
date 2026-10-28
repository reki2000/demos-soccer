import * as THREE from 'three';

// Face variation with regional character. Each face type bundles an eye
// shape, a brow shape, iris colours, nose/lip proportions and a coherent
// skin-tone pool, so a Japanese squad, a French squad and a Brazilian
// squad do not all read as the same face with different paint.
export const FACE_TYPES = {
  eastAsian: {
    eyes: ['almond', 'narrow', 'hooded', 'almond'],
    brows: ['straight', 'thin', 'straight', 'arched'],
    iris: [0x2a1a10, 0x1c1410],
    skins: [0xf0c6a1, 0xe8ba90, 0xe1b18d, 0xc9946d],
    nose: .88, lips: .92,
  },
  european: {
    eyes: ['deep', 'round', 'almond', 'deep'],
    brows: ['thick', 'arched', 'straight'],
    iris: [0x2a1a10, 0x35507a, 0x3f5a36, 0x6b4a2a],
    skins: [0xf0c6a1, 0xe1b18d, 0xdca87e, 0xc9946d],
    nose: 1.12, lips: .95,
  },
  african: {
    eyes: ['round', 'wide', 'almond'],
    brows: ['thick', 'arched', 'straight'],
    iris: [0x1c1008, 0x2a1a10],
    skins: [0xb47c53, 0x996341, 0x7c4f33, 0x603d29],
    nose: 1.28, lips: 1.3,
  },
  latin: {
    eyes: ['almond', 'deep', 'round'],
    brows: ['arched', 'thick', 'straight'],
    iris: [0x2a1a10, 0x6b4a2a],
    skins: [0xe1b18d, 0xc9946d, 0xb47c53, 0x996341],
    nose: 1.05, lips: 1.1,
  },
  middleEast: {
    eyes: ['almond', 'deep', 'almond'],
    brows: ['thick', 'angled', 'arched'],
    iris: [0x2a1a10, 0x3f5a36],
    skins: [0xe1b18d, 0xdca87e, 0xc9946d, 0xb47c53],
    nose: 1.15, lips: 1.0,
  },
  southAsian: {
    eyes: ['almond', 'round', 'almond'],
    brows: ['thick', 'straight', 'arched'],
    iris: [0x241207, 0x2a1a10],
    skins: [0xc9946d, 0xb47c53, 0x996341, 0x8a5a38],
    nose: 1.1, lips: 1.05,
  },
};

// Weighted face-type pools per soccer country (modern national squads are
// mixed; the pool weights keep each squad's overall character distinct).
export const COUNTRY_FACE_POOLS = {
  japan: ['eastAsian', 'eastAsian', 'eastAsian', 'eastAsian'],
  brazil: ['latin', 'latin', 'african', 'european', 'middleEast'],
  france: ['european', 'european', 'african', 'middleEast', 'african'],
  argentina: ['latin', 'latin', 'european', 'latin'],
  england: ['european', 'european', 'european', 'african', 'latin'],
  germany: ['european', 'european', 'european', 'middleEast'],
  spain: ['european', 'european', 'latin', 'middleEast'],
  portugal: ['european', 'european', 'latin', 'african'],
};

// Basketball league squads by club id.
export const SQUAD_FACE_POOLS = {
  tokyo: ['eastAsian', 'eastAsian', 'eastAsian', 'eastAsian'],
  osaka: ['eastAsian', 'eastAsian', 'eastAsian', 'eastAsian'],
  seoul: ['eastAsian', 'eastAsian', 'eastAsian', 'eastAsian'],
  sydney: ['european', 'european', 'european', 'african', 'latin'],
};

function hash(n) {
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  return (n ^ (n >>> 16)) >>> 0;
}

// Deterministically pick a coherent face from a weighted pool of types.
export function faceFor(pool, seed) {
  const types = pool?.length ? pool : ['eastAsian'];
  const type = types[hash(seed) % types.length];
  const def = FACE_TYPES[type];
  return {
    type,
    eyeShape: def.eyes[hash(seed + 101) % def.eyes.length],
    browShape: def.brows[hash(seed + 202) % def.brows.length],
    iris: def.iris[hash(seed + 303) % def.iris.length],
    skin: def.skins[hash(seed + 404) % def.skins.length],
    nose: def.nose, lips: def.lips,
  };
}

const EYE_GEOMETRY = {
  almond: { r: .02, sx: 1, sy: 1.18, sz: .55, z: .104 },
  round: { r: .0215, sx: 1.02, sy: 1.0, sz: .6, z: .104 },
  narrow: { r: .02, sx: 1.2, sy: .7, sz: .5, z: .104 },
  hooded: { r: .02, sx: 1, sy: 1.1, sz: .55, z: .104 },
  deep: { r: .02, sx: 1, sy: 1.15, sz: .5, z: .099 },
  wide: { r: .0205, sx: 1.05, sy: 1.15, sz: .55, z: .104 },
};
const BROW_GEOMETRY = {
  straight: { w: .043, h: .009, y: .052, rot: .05 },
  thin: { w: .04, h: .0055, y: .054, rot: .1 },
  thick: { w: .049, h: .015, y: .05, rot: .12 },
  arched: { w: .043, h: .008, y: .059, rot: .33 },
  angled: { w: .045, h: .011, y: .051, rot: -.24 },
};

// Builds eyes (white + iris + pupil), brows, nose, mouth and ears on a
// head group whose skull radius is .125 * f (f = 1.16 for basketball).
export function addFaceFeatures(head, material, face, skin, hairMaterial, f = 1) {
  const dark = material(0x201914);
  const white = material(0xf4efe6);
  const lip = material(0x8a4a3c);
  const irisMaterial = material(face?.iris ?? 0x2a1a10);
  const eye = EYE_GEOMETRY[face?.eyeShape] ?? EYE_GEOMETRY.almond;
  const brow = BROW_GEOMETRY[face?.browShape] ?? BROW_GEOMETRY.straight;
  const mesh = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * f, y * f, z * f);
    m.castShadow = true;
    head.add(m);
    return m;
  };
  const eyeX = (face?.eyeShape === 'wide' ? .052 : .0445);
  for (const side of [-1, 1]) {
    const eyeWhite = mesh(new THREE.SphereGeometry(eye.r * f, 8, 6), white, side * eyeX, .018, eye.z);
    eyeWhite.scale.set(eye.sx, eye.sy, eye.sz);
    const iris = mesh(new THREE.SphereGeometry(.0135 * f, 8, 6), irisMaterial, side * eyeX, .018, eye.z + .0105);
    iris.scale.set(1, 1.1, .5);
    const pupil = mesh(new THREE.SphereGeometry(.0072 * f, 8, 6), dark, side * eyeX, .018, eye.z + .0165);
    pupil.scale.set(1, 1.15, .5);
    if (face?.eyeShape === 'hooded') {
      const lid = mesh(new THREE.BoxGeometry(.046 * f, .013 * f, .016 * f), skin, side * eyeX, .034, .106);
      lid.rotation.x = -.15;
    }
    if (face?.eyeShape === 'deep') {
      mesh(new THREE.BoxGeometry(.052 * f, .015 * f, .02 * f), skin, side * eyeX, .05, .098);
    }
    const browMesh = mesh(new THREE.BoxGeometry(brow.w * f, brow.h * f, .012 * f), hairMaterial, side * (eyeX + .0005), brow.y, .11);
    browMesh.rotation.z = -side * brow.rot;
    const ear = mesh(new THREE.SphereGeometry(.026 * f, 8, 6), skin, side * .104, -.006, 0);
    ear.scale.set(.45, 1, .72);
  }
  const noseScale = face?.nose ?? 1;
  // Nose bridge running down from between the brows, then tip and base,
  // so the nose is a structure, not a ball stuck on the face.
  const bridge = mesh(new THREE.BoxGeometry(.02 * f, .078 * f, .017 * f), skin, 0, .006, .107);
  bridge.rotation.x = -.1;
  const nose = mesh(new THREE.SphereGeometry(.024 * f, 8, 6), skin, 0, -.018, .117);
  nose.scale.set(.75 * noseScale, 1.28, noseScale > 1.2 ? .78 : .95);
  const base = mesh(new THREE.SphereGeometry(.021 * f, 8, 6), skin, 0, -.041, .106);
  base.scale.set(1.05 * noseScale, .5, .8);
  const lipScale = face?.lips ?? 1;
  mesh(new THREE.BoxGeometry(.042 * lipScale * f, (lipScale > 1.15 ? .0135 : .009) * f, .012 * f), lip, 0, -.07, .103);
}

// Plausible everyday hairstyles, built from caps, swept fringe boxes and
// rounded volumes — no spikes or cone tufts. Base coordinates match a
// .125-radius head; f scales them (basketball uses 1.16).
export const HAIRSTYLES = ['short', 'buzz', 'mash', 'sidepart', 'centerpart', 'slickback', 'wavy', 'curly', 'ponytail', 'long', 'afro'];
export function addHairStyle(head, material, style, hairColor, f = 1) {
  const hair = material(hairColor);
  const mesh = (geo, x, y, z) => {
    const m = new THREE.Mesh(geo, hair);
    m.position.set(x * f, y * f, z * f);
    m.castShadow = true;
    head.add(m);
    return m;
  };
  const cap = (theta, r = .129, y = .028, z = -.008) =>
    mesh(new THREE.SphereGeometry(r * f, 10, 6, 0, Math.PI * 2, 0, Math.PI * theta), 0, y, z);
  switch (style) {
    case 'buzz': {
      const c = cap(.48, .127); c.scale.set(.87, .8, .94); break;
    }
    case 'mash': {
      const c = cap(.68, .133); c.scale.set(.9, 1, .97); break;
    }
    case 'sidepart': {
      const c = cap(.54); c.scale.set(.88, .96, .95);
      const fringe = mesh(new THREE.BoxGeometry(.115 * f, .03 * f, .05 * f), -.018, .098, .098);
      fringe.rotation.set(0, .12, -.16);
      break;
    }
    case 'centerpart': {
      const c = cap(.54); c.scale.set(.88, .96, .95);
      for (const side of [-1, 1]) {
        const fringe = mesh(new THREE.BoxGeometry(.056 * f, .028 * f, .046 * f), side * .033, .098, .1);
        fringe.rotation.z = -side * .24;
      }
      break;
    }
    case 'slickback': {
      const c = cap(.5, .129, .03, -.024); c.scale.set(.88, .96, .95);
      const sweep = mesh(new THREE.BoxGeometry(.1 * f, .026 * f, .115 * f), 0, .122, -.012);
      sweep.rotation.x = .16;
      break;
    }
    case 'wavy': {
      const c = cap(.56); c.scale.set(.88, .96, .95);
      const spots = [[-.048, .01], [-.024, -.018], [0, .015], [.024, -.01], [.048, .005]];
      for (const [x, z] of spots) {
        const puff = mesh(new THREE.SphereGeometry(.04 * f, 8, 6), x, .118, z);
        puff.scale.set(1, .55, 1);
      }
      break;
    }
    case 'curly': {
      const c = cap(.46); c.scale.set(.88, .9, .95);
      mesh(new THREE.SphereGeometry(.037 * f, 8, 6), 0, .14, 0);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        mesh(new THREE.SphereGeometry(.036 * f, 8, 6), Math.cos(a) * .045, .12, Math.sin(a) * .043);
      }
      break;
    }
    case 'ponytail': {
      const c = cap(.56); c.scale.set(.88, .96, .95);
      mesh(new THREE.SphereGeometry(.042 * f, 8, 6), 0, .055, -.128);
      const tail = mesh(new THREE.BoxGeometry(.052 * f, .14 * f, .032 * f), 0, -.045, -.15);
      tail.rotation.x = .1;
      break;
    }
    case 'long': {
      const c = cap(.62, .131); c.scale.set(.89, .98, .96);
      const back = mesh(new THREE.BoxGeometry(.172 * f, .19 * f, .042 * f), 0, -.055, -.104);
      back.rotation.x = .05;
      for (const side of [-1, 1]) mesh(new THREE.BoxGeometry(.032 * f, .13 * f, .1 * f), side * .104, -.035, -.005);
      break;
    }
    case 'afro': {
      const c = cap(.42); c.scale.set(.88, .9, .95);
      const volume = mesh(new THREE.SphereGeometry(.104 * f, 10, 8), 0, .07, -.004);
      volume.scale.set(1.06, .94, 1.06);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        mesh(new THREE.SphereGeometry(.048 * f, 8, 6), Math.cos(a) * .07, .128, Math.sin(a) * .066);
      }
      break;
    }
    default: { // 'short' and anything unknown: a clean short cut.
      const c = cap(.52); c.scale.set(.88, .95, .95);
    }
  }
}

// Composite head shape instead of a single sphere: cranium, a lower face
// mass, jaw and chin, a brow ridge, shaded eye sockets and cheekbones, so
// the face has structure the features can sit in.
export function buildHead(head, material, skinTone, f = 1) {
  const skin = material(skinTone);
  const socketTone = new THREE.Color(skinTone).multiplyScalar(.74).getHex();
  const socket = material(socketTone);
  const mesh = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x * f, y * f, z * f);
    m.castShadow = true;
    head.add(m);
    return m;
  };
  const cranium = mesh(new THREE.SphereGeometry(.125 * f, 14, 12), skin, 0, 0, 0);
  cranium.scale.set(.84, 1.05, .92);
  const faceBase = mesh(new THREE.SphereGeometry(.104 * f, 12, 10), skin, 0, -.036, .02);
  faceBase.scale.set(.8, .84, .86);
  const jaw = mesh(new THREE.SphereGeometry(.082 * f, 10, 8), skin, 0, -.098, .02);
  jaw.scale.set(.8, .52, .8);
  const chin = mesh(new THREE.SphereGeometry(.046 * f, 8, 6), skin, 0, -.117, .05);
  chin.scale.set(.58, .36, .5);
  const browRidge = mesh(new THREE.SphereGeometry(.092 * f, 10, 8), skin, 0, .05, .052);
  browRidge.scale.set(1.06, .34, .6);
  for (const side of [-1, 1]) {
    const socketDisc = mesh(new THREE.SphereGeometry(.03 * f, 8, 6), socket, side * .0445, .015, .094);
    socketDisc.scale.set(1.05, 1.2, .42);
    const cheek = mesh(new THREE.SphereGeometry(.036 * f, 8, 6), skin, side * .066, -.032, .062);
    cheek.scale.set(1, .72, .55);
  }
}
