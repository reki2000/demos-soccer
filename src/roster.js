// Fictional squads; stable identities survive match resets and formation changes.
const names = {
  japan: ['Ren Takahashi','Kaito Mori','Yuto Hayashi','Sota Nakamura','Haru Ishikawa','Riku Aoki','Daichi Fujita','Yuki Okada','Shun Mizuno','Akira Sato','Kei Matsuda'],
  brazil: ['Lucas Ferreira','Rafael Costa','Mateus Ribeiro','Bruno Almeida','Caio Santos','Pedro Lima','Thiago Rocha','Gabriel Nunes','Davi Moreira','Felipe Alves','Enzo Carvalho'],
  france: ['Hugo Moreau','Noah Laurent','Malik Diallo','Louis Bernard','Theo Garnier','Adam Lefevre','Sami Benali','Jules Perrin','Eliott Dubois','Leo Martin','Nolan Faure'],
  argentina: ['Tomas Molina','Nicolas Vega','Mateo Rojas','Lucas Acosta','Facundo Silva','Santiago Diaz','Emiliano Torres','Julian Navarro','Bautista Herrera','Lautaro Romero','Franco Medina'],
  england: ['Oliver Brooks','Harry Bennett','Isaac Walker','Ethan Clarke','Noah Mitchell','Alfie Turner','Jacob Morgan','Theo Evans','Oscar Hayes','George Parker','Finley Reed'],
  germany: ['Jonas Weber','Felix Wagner','Leon Richter','Lukas Brandt','Emil Fischer','Noah Keller','Max Hoffmann','Anton Schreiber','Finn Berger','Paul Schneider','Ben Adler'],
  spain: ['Hugo Serrano','Pablo Ortega','Diego Molina','Adrian Torres','Alex Navarro','Marcos Vidal','Izan Romero','Nico Santos','Leo Castillo','Daniel Vega','Mario Ruiz'],
  portugal: ['Tiago Moreira','Diogo Costa','Goncalo Sousa','Rafael Duarte','Nuno Pereira','Joao Mendes','Miguel Carvalho','Andre Faria','Pedro Azevedo','Tomas Silva','Rui Teixeira'],
};
const skinTones = [0xf0c6a1,0xe1b18d,0xc9946d,0xb47c53,0x996341,0x7c4f33,0x603d29];
const hairColors = [0x211e1a,0x39291e,0x65452b,0x9b7449,0xc2a56b];
const hairstyles = ['crop','buzz','curls','sidepart','tied','shaved'];
const cache = new Map();

export function getPlayerProfile(country, slot) {
  const key = `${country}:${slot}`;
  if (cache.has(key)) return cache.get(key);
  let seed = 2166136261;
  for (const ch of key) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const random = () => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pool = names[country] ?? names.japan;
  const name = slot < pool.length ? pool[slot] : `${pool[slot % 11].split(' ')[0]} ${pool[(slot + 4) % 11].split(' ').slice(1).join(' ')}`;
  const height = slot === 0 ? 184 + Math.floor(random() * 15) : 168 + Math.floor(random() * 25);
  const build = .9 + random() * .25;
  const profile = {
    name, number: slot + 1, height, build,
    weight: Math.round((height - 105) * build),
    age: 19 + Math.floor(random() * 16),
    foot: random() < .24 ? '左' : '右',
    skin: skinTones[Math.floor(random() * skinTones.length)],
    hairColor: hairColors[Math.floor(random() * hairColors.length)],
    hairstyle: hairstyles[Math.floor(random() * hairstyles.length)],
    pace: .92 + random() * .16,
    strength: Math.round(60 + (build - .9) * 100),
  };
  cache.set(key, profile);
  return profile;
}

export function assignProfiles(match, teams) {
  for (const p of match.players) {
    p.profile = getPlayerProfile(teams[p.team].id, p.slot);
    p.pace = p.profile.pace;
  }
}

export function playerPosition(slot, formation) {
  if (slot === 0) return 'GK';
  const defenders = formation === '3-5-2' ? 3 : 4;
  if (slot <= defenders) return 'DF';
  const forwards = formation === '4-3-3' ? 3 : 2;
  return slot >= 11 - forwards ? 'FW' : 'MF';
}
