import * as THREE from 'three';
import { HEAD_SKIN, HEAD_EYES, HEAD_HAIR } from './head-model.js';

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
// Imported head (head-model.js: Quaternius Universal Base Characters, CC0)
// reshaped per player. The base mesh is morphed in its source space —
// neck slimming, jaw width and chin, cranium proportions, nose width /
// height / lift and lip fullness on the skin; eye gap and eye size on
// the eye parts; brow thickness / angle and jaw-following on the hair —
// then converted to game space. Morph strength is deliberately strong
// so the six face types read as different people at game distance.
// f scales the finished head (basketball uses 1.16).
// ---------------------------------------------------------------------------

export const HAIRSTYLES = ['short', 'buzz', 'mash', 'sidepart', 'centerpart', 'slickback', 'wavy', 'curly', 'ponytail', 'long', 'afro'];

// Per-type morph parameters (1 = the base model unchanged).
const HEAD_MORPHS = {
  eastAsian:  { jaw: .90, chin: .95, eyeGap: -.008, eyeW: 1.08, eyeH: .68, browThick: .80, browAngle: .08, browLift: .003, noseW: .92, noseH: .92, noseLift: -.007, lips: .92, headW: .99, headL: .98 },
  european:   { jaw: .94, chin: 1.06, eyeGap: .004, eyeW: .90, eyeH: .90, browThick: 1.18, browAngle: -.09, browLift: 0, noseW: .80, noseH: 1.16, noseLift: .007, lips: .85, headW: .93, headL: 1.06 },
  african:    { jaw: 1.09, chin: 1.00, eyeGap: .008, eyeW: 1.02, eyeH: 1.02, browThick: 1.10, browAngle: .03, browLift: .003, noseW: 1.38, noseH: .90, noseLift: -.004, lips: 1.50, headW: 1.04, headL: 1.00 },
  latin:      { jaw: 1.01, chin: 1.01, eyeGap: .002, eyeW: 1.00, eyeH: .86, browThick: 1.25, browAngle: .16, browLift: .005, noseW: 1.00, noseH: 1.03, noseLift: .003, lips: 1.18, headW: .99, headL: 1.00 },
  middleEast: { jaw: 1.04, chin: 1.04, eyeGap: 0, eyeW: 1.03, eyeH: .84, browThick: 1.45, browAngle: -.14, browLift: -.003, noseW: .92, noseH: 1.18, noseLift: .010, lips: 1.02, headW: .96, headL: 1.03 },
  southAsian: { jaw: .93, chin: .98, eyeGap: .002, eyeW: 1.05, eyeH: .94, browThick: 1.32, browAngle: .05, browLift: .003, noseW: .98, noseH: 1.07, noseLift: .005, lips: 1.14, headW: .97, headL: 1.00 },
};
const NECK_SCALE = .55; // the model's neck at about half thickness

function resolveMorph(face, seed) {
  const p = { ...(HEAD_MORPHS[face?.type] ?? HEAD_MORPHS.eastAsian) };
  // The face system's eye/brow shape picks keep their meaning as morphs.
  switch (face?.eyeShape) {
    case 'narrow': p.eyeH *= .85; break;
    case 'round': p.eyeH *= 1.12; p.eyeW *= .96; break;
    case 'hooded': p.eyeH *= .9; p.browLift -= .004; break;
    case 'deep': p.eyeW *= .92; break;
    case 'wide': p.eyeGap += .004; break;
  }
  switch (face?.browShape) {
    case 'arched': p.browAngle += .12; break;
    case 'angled': p.browAngle -= .12; break;
    case 'thick': p.browThick *= 1.15; break;
    case 'thin': p.browThick *= .78; break;
    case 'straight': p.browAngle *= .3; break;
  }
  // Deterministic per-player jitter so a squad is not one cloned face.
  const jit = (off, amt) => (hash(seed + off) / 4294967296 - .5) * 2 * amt;
  for (const k of ['jaw', 'chin', 'eyeW', 'eyeH', 'browThick', 'noseW', 'noseH', 'lips', 'headW', 'headL']) p[k] += jit(k.length * 131 + k.charCodeAt(0), .03);
  p.eyeGap += jit(7331, .002);
  p.noseLift += jit(7337, .002);
  return p;
}

const clamp01 = v => Math.max(0, Math.min(1, v));
const gauss = (x, y, z, cx, cy, cz, s) => Math.exp(-(((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2) / (s * s)));

function morphSkin(P, p) {
  const out = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    let x = P[i], y = P[i + 1], z = P[i + 2];
    if (z < 4.32) { // slim the neck, fading out under the jaw
      const f = clamp01((4.32 - z) / .16);
      const s = 1 - (1 - NECK_SCALE) * f * f;
      x *= s; y = .02 + (y - .02) * s;
    }
    if (z < 4.42) { // jaw width; chin protrusion on the front
      const f = Math.pow(clamp01((4.42 - z) / .34), .7);
      x *= 1 + (p.jaw - 1) * f;
      if (z < 4.24 && y < -.05) y *= 1 + (p.chin - 1) * f;
    }
    if (z > 4.26) { // cranium width / length
      const f = clamp01((z - 4.26) / .2);
      x *= 1 + (p.headW - 1) * f;
      y = -.02 + (y + .02) * (1 + (p.headL - 1) * f);
    }
    const wn = gauss(x, y, z, 0, -.255, 4.365, .088); // nose cluster
    if (wn > .01) {
      x *= 1 + (p.noseW - 1) * wn;
      z = 4.365 + (z - 4.365) * (1 + (p.noseH - 1) * wn) + p.noseLift * wn;
      y = -.255 + (y + .255) * (1 + (p.noseW - 1) * .35 * wn);
    }
    const wl = gauss(x, y, z, 0, -.225, 4.235, .07); // mouth / lips
    if (wl > .01) z = 4.235 + (z - 4.235) * (1 + (p.lips - 1) * wl);
    out[i] = x; out[i + 1] = y; out[i + 2] = z;
  }
  return out;
}

function morphEyes(P, p) {
  const out = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    const side = P[i] >= 0 ? 1 : -1;
    out[i] = side * .108 + (P[i] - side * .108) * p.eyeW + side * p.eyeGap;
    out[i + 1] = P[i + 1];
    out[i + 2] = 4.467 + (P[i + 2] - 4.467) * p.eyeH;
  }
  return out;
}

function morphHair(P, p, afro) {
  const out = new Float32Array(P.length);
  for (let i = 0; i < P.length; i += 3) {
    let x = P[i], y = P[i + 1], z = P[i + 2];
    if (z < 4.42) { // beard and sideburns follow the jaw
      const f = Math.pow(clamp01((4.42 - z) / .34), .7);
      x *= 1 + (p.jaw - 1) * f;
    }
    if (z > 4.26) {
      const f = clamp01((z - 4.26) / .2);
      x *= 1 + (p.headW - 1) * f;
      y = -.02 + (y + .02) * (1 + (p.headL - 1) * f);
    }
    if (afro && z > 4.3) { // extra volume reads as an afro silhouette
      x *= 1.16; y = -.02 + (y + .02) * 1.14; z = 4.3 + (z - 4.3) * 1.22;
    }
    if (z > 4.49 && z < 4.64 && y < -.15 && Math.abs(x) > .03) { // brow band
      const side = x >= 0 ? 1 : -1;
      const bx = side * .11, bz = 4.545;
      z = bz + (z - bz) * p.browThick + p.browLift;
      const dx = x - bx, dz = z - bz, a = p.browAngle * side;
      x = bx + dx * Math.cos(a) - dz * Math.sin(a);
      z = bz + dx * Math.sin(a) + dz * Math.cos(a);
    }
    out[i] = x; out[i + 1] = y; out[i + 2] = z;
  }
  return out;
}

// Source space (z up, face towards -y) -> head-group space (y up, face +z).
function partGeometry(part, morphed) {
  const g = new THREE.BufferGeometry();
  const N = part.n, p2 = new Float32Array(morphed.length), n2 = new Float32Array(N.length);
  for (let i = 0; i < morphed.length; i += 3) {
    p2[i] = morphed[i]; p2[i + 1] = morphed[i + 2] - 4.0; p2[i + 2] = -morphed[i + 1];
    n2[i] = N[i]; n2[i + 1] = N[i + 2]; n2[i + 2] = -N[i + 1];
  }
  g.setAttribute('position', new THREE.BufferAttribute(p2, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(n2, 3));
  g.setIndex(part.i);
  return g;
}

const HAIR_VARIANTS = {
  short: 'casual', mash: 'casual', centerpart: 'casual', curly: 'casual', ponytail: 'casual',
  sidepart: 'quiff', wavy: 'quiff', slickback: 'flattop', long: 'flattop',
  buzz: null, afro: 'casual',
};

// Build the imported head into the head group: skin (morphed), dark eyes
// and one of the model's hair variants. About a quarter of short-haired
// players get the bearded variant. `seat` (in f units) drops the head
// so its throat reaches the collar while the jaw still clears it — the
// chin never sinks into the neck, and the neck never floats.
export function buildImportedHead(head, material, { face, skinTone, hairColor, hairstyle, seed = 0, f = 1, seat = -.2 }) {
  const p = resolveMorph(face, seed);
  const smooth = color => { const m = material(color); m.flatShading = false; return m; };
  const grp = new THREE.Group();
  grp.scale.setScalar(.42 * f);
  grp.position.y = seat * f;
  const skin = new THREE.Mesh(partGeometry(HEAD_SKIN, morphSkin(HEAD_SKIN.p, p)), smooth(skinTone));
  skin.castShadow = true;
  grp.add(skin);
  grp.add(new THREE.Mesh(partGeometry(HEAD_EYES, morphEyes(HEAD_EYES.p, p)), smooth(0x14100e)));
  let variant = HAIR_VARIANTS[hairstyle] ?? 'casual';
  if (variant && hairstyle !== 'long' && hash(seed + 777) % 4 === 0) variant = 'beard';
  if (variant) {
    const hair = new THREE.Mesh(
      partGeometry(HEAD_HAIR[variant], morphHair(HEAD_HAIR[variant].p, p, hairstyle === 'afro')),
      smooth(hairColor));
    hair.castShadow = true;
    grp.add(hair);
  } else { // buzz cut: just the brows
    grp.add(new THREE.Mesh(partGeometry(HEAD_HAIR.brows, morphHair(HEAD_HAIR.brows.p, p, false)), smooth(hairColor)));
  }
  head.add(grp);
  return grp;
}
