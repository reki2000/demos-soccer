import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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

// ---------------------------------------------------------------------------
// Cube-based head construction. Every part — cranium, jaw, sockets, eyes,
// nose, ears and hair — is a box or a softly rounded box, matching the
// blocky low-poly bodies. Base coordinates fit a head about .21 wide;
// f scales them (basketball uses 1.16).
// ---------------------------------------------------------------------------

function part(head, geo, mat, x, y, z, f) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x * f, y * f, z * f);
  m.castShadow = true;
  head.add(m);
  return m;
}
const rbox = (w, h, d, r, f) => new RoundedBoxGeometry(w * f, h * f, d * f, 2, r * f);
const box = (w, h, d, f) => new THREE.BoxGeometry(w * f, h * f, d * f);

// Cranium, lower face/jaw, chin, brow ridge, eye sockets and cheekbones.
export function buildHead(head, material, skinTone, f = 1) {
  const skin = material(skinTone);
  const socket = material(new THREE.Color(skinTone).multiplyScalar(.74).getHex());
  part(head, rbox(.21, .22, .215, .05, f), skin, 0, .02, 0, f);              // cranium
  part(head, rbox(.168, .13, .18, .04, f), skin, 0, -.072, .012, f);         // jaw / lower face
  part(head, box(.075, .03, .05, f), skin, 0, -.142, .042, f);               // chin
  part(head, box(.172, .028, .032, f), skin, 0, .04, .098, f);               // brow ridge
  for (const side of [-1, 1]) {
    part(head, box(.054, .06, .014, f), socket, side * .045, .002, .1, f);   // eye socket
    const cheek = part(head, box(.05, .042, .02, f), skin, side * .07, -.048, .082, f);
    cheek.rotation.y = -side * .25;                                          // cheekbone
  }
}

const EYE_GEOMETRY = {
  almond: { w: .034, h: .038, z: .108 },
  round: { w: .036, h: .042, z: .108 },
  narrow: { w: .037, h: .024, z: .108 },
  hooded: { w: .034, h: .034, z: .108 },
  deep: { w: .034, h: .037, z: .103 },
  wide: { w: .035, h: .038, z: .108 },
};
const BROW_GEOMETRY = {
  straight: { w: .044, h: .009, y: .062, rot: .05 },
  thin: { w: .041, h: .0055, y: .064, rot: .1 },
  thick: { w: .05, h: .015, y: .06, rot: .12 },
  arched: { w: .044, h: .008, y: .069, rot: .33 },
  angled: { w: .046, h: .011, y: .061, rot: -.24 },
};

// Cube eyes (white, iris, pupil), shaped brows, a box nose with bridge,
// tip and base, a mouth and box ears.
export function addFaceFeatures(head, material, face, skin, hairMaterial, f = 1) {
  const dark = material(0x201914);
  const white = material(0xf4efe6);
  const lip = material(0x8a4a3c);
  const irisMaterial = material(face?.iris ?? 0x2a1a10);
  const eye = EYE_GEOMETRY[face?.eyeShape] ?? EYE_GEOMETRY.almond;
  const brow = BROW_GEOMETRY[face?.browShape] ?? BROW_GEOMETRY.straight;
  const eyeX = (face?.eyeShape === 'wide' ? .052 : .045);
  for (const side of [-1, 1]) {
    part(head, box(eye.w, eye.h, .012, f), white, side * eyeX, .002, eye.z, f);
    part(head, box(.016, .02, .006, f), irisMaterial, side * eyeX, .002, eye.z + .008, f);
    part(head, box(.008, .011, .004, f), dark, side * eyeX, .002, eye.z + .012, f);
    if (face?.eyeShape === 'hooded') {
      const lid = part(head, box(.04, .015, .014, f), skin, side * eyeX, .024, .106, f);
      lid.rotation.x = -.12;
    }
    if (face?.eyeShape === 'deep') {
      part(head, box(.052, .014, .02, f), skin, side * eyeX, .032, .1, f);   // brow bone
    }
    const browMesh = part(head, box(brow.w, brow.h, .012, f), hairMaterial, side * eyeX, brow.y, .106, f);
    browMesh.rotation.z = -side * brow.rot;
    part(head, box(.018, .052, .038, f), skin, side * .109, -.012, 0, f);    // ear
  }
  const noseScale = face?.nose ?? 1;
  // Nose bridge from between the brows down to the tip, plus a base.
  const bridge = part(head, box(.02, .082, .02, f), skin, 0, -.002, .108, f);
  bridge.rotation.x = -.06;
  part(head, box(.036 * noseScale, .032, .026, f), skin, 0, -.052, .11, f);  // tip
  part(head, box(.05 * noseScale, .016, .02, f), skin, 0, -.072, .102, f);   // base
  const lipScale = face?.lips ?? 1;
  part(head, box(.042 * lipScale, lipScale > 1.15 ? .014 : .009, .012, f), lip, 0, -.1, .1, f); // mouth
}

export const HAIRSTYLES = ['short', 'buzz', 'mash', 'sidepart', 'centerpart', 'slickback', 'wavy', 'curly', 'ponytail', 'long', 'afro'];

// Cube-based plausible hairstyles: hair is assembled from top, back, side
// and fringe boxes (slightly rounded), like a low-poly haircut.
export function addHairStyle(head, material, style, hairColor, f = 1) {
  const hair = material(hairColor);
  const top = (w, h, d, y, z = 0, r = .03) => part(head, rbox(w, h, d, r, f), hair, 0, y, z, f);
  const back = (w, h, d, y) => part(head, rbox(w, h, d, .025, f), hair, 0, y, -.1, f);
  const sides = (w, h, d, y) => {
    for (const side of [-1, 1]) part(head, rbox(w, h, d, .02, f), hair, side * .101, y, 0, f);
  };
  const fringe = (w, h, d, x, y, z, rotZ = 0) => {
    const m = part(head, box(w, h, d, f), hair, x, y, z, f);
    m.rotation.z = rotZ;
    return m;
  };
  const shortBase = () => { top(.226, .075, .236, .108); back(.226, .13, .05, .01); sides(.046, .09, .19, .015); };
  switch (style) {
    case 'buzz':
      top(.218, .042, .228, .122); back(.218, .085, .045, .028); sides(.04, .055, .18, .038);
      break;
    case 'mash':
      top(.233, .09, .243, .102); back(.233, .2, .055, -.028); sides(.05, .17, .196, -.018);
      fringe(.21, .055, .05, 0, .032, .102);
      break;
    case 'sidepart':
      shortBase();
      fringe(.13, .034, .055, -.034, .064, .104, -.14);
      break;
    case 'centerpart':
      shortBase();
      fringe(.075, .034, .05, -.046, .064, .104, .2);
      fringe(.075, .034, .05, .046, .064, .104, -.2);
      break;
    case 'slickback': {
      const t = top(.226, .07, .24, .11, -.02); t.rotation.x = .1;
      back(.226, .18, .05, -.008); sides(.046, .11, .19, .005);
      break;
    }
    case 'wavy':
      shortBase();
      for (const [x, z, r] of [[-.06, .01, .12], [0, -.015, -.06], [.06, .008, .1]]) {
        const m = part(head, rbox(.072, .036, .095, .016, f), hair, x, .148, z, f);
        m.rotation.y = r;
      }
      break;
    case 'curly':
      top(.226, .05, .236, .118); back(.226, .11, .05, .02); sides(.046, .07, .19, .028);
      part(head, rbox(.08, .062, .08, .026, f), hair, 0, .152, 0, f);
      for (const [x, z] of [[-.052, -.045], [.052, -.045], [-.052, .048], [.052, .048]]) {
        part(head, rbox(.07, .055, .07, .024, f), hair, x, .146, z, f);
      }
      break;
    case 'ponytail':
      top(.228, .08, .238, .106); back(.228, .14, .05, .005); sides(.047, .1, .19, .01);
      part(head, box(.06, .06, .06, f), hair, 0, .028, -.138, f);
      part(head, box(.055, .15, .04, f), hair, 0, -.062, -.152, f);
      break;
    case 'long':
      top(.23, .085, .24, .104); back(.23, .3, .05, -.088); sides(.05, .24, .196, -.058);
      break;
    case 'afro':
      part(head, rbox(.272, .235, .272, .085, f), hair, 0, .062, 0, f);
      break;
    default: // 'short'
      shortBase();
  }
}
