import { faceFor, COUNTRY_FACE_POOLS } from './face.js';

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
// Japanese annotation for every name: kanji (with kana reading) for the
// Japan squad, katakana transliteration for the other squads.
const namesJa = {
  japan: ['高橋 蓮（タカハシ・レン）','森 海翔（モリ・カイト）','林 悠斗（ハヤシ・ユウト）','中村 颯太（ナカムラ・ソウタ）','石川 春（イシカワ・ハル）','青木 陸（アオキ・リク）','藤田 大地（フジタ・ダイチ）','岡田 勇輝（オカダ・ユウキ）','水野 駿（ミズノ・シュン）','佐藤 晃（サトウ・アキラ）','松田 圭（マツダ・ケイ）'],
  brazil: ['ルーカス・フェレイラ','ラファエル・コスタ','マテウス・リベイロ','ブルーノ・アルメイダ','カイオ・サントス','ペドロ・リマ','チアゴ・ローシャ','ガブリエウ・ヌネス','ダヴィ・モレイラ','フェリペ・アウヴェス','エンゾ・カルヴァーリョ'],
  france: ['ユゴー・モロー','ノア・ローラン','マリク・ディアロ','ルイ・ベルナール','テオ・ガルニエ','アダム・ルフェーヴル','サミ・ベナリ','ジュール・ペラン','エリオット・デュボワ','レオ・マルタン','ノラン・フォール'],
  argentina: ['トマス・モリーナ','ニコラス・ベガ','マテオ・ロハス','ルーカス・アコスタ','ファクンド・シルバ','サンティアゴ・ディアス','エミリアーノ・トーレス','フリアン・ナバーロ','バウティスタ・エレーラ','ラウタロ・ロメロ','フランコ・メディーナ'],
  england: ['オリバー・ブルックス','ハリー・ベネット','アイザック・ウォーカー','イーサン・クラーク','ノア・ミッチェル','アルフィー・ターナー','ジェイコブ・モーガン','テオ・エヴァンス','オスカー・ヘイズ','ジョージ・パーカー','フィンリー・リード'],
  germany: ['ヨナス・ヴェーバー','フェリックス・ヴァーグナー','レオン・リヒター','ルーカス・ブラント','エミール・フィッシャー','ノア・ケラー','マックス・ホフマン','アントン・シュライバー','フィン・ベルガー','パウル・シュナイダー','ベン・アドラー'],
  spain: ['ウーゴ・セラーノ','パブロ・オルテガ','ディエゴ・モリーナ','アドリアン・トーレス','アレックス・ナバーロ','マルコス・ビダル','イサン・ロメロ','ニコ・サントス','レオ・カスティージョ','ダニエル・ベガ','マリオ・ルイス'],
  portugal: ['チアゴ・モレイラ','ディオゴ・コスタ','ゴンサロ・ソウザ','ラファエル・ドゥアルテ','ヌーノ・ペレイラ','ジョアン・メンデス','ミゲル・カルヴァーリョ','アンドレ・ファリア','ペドロ・アゼヴェード','トマス・シルバ','ルイ・テイシェイラ'],
};
const skinTones = [0xf0c6a1,0xe1b18d,0xc9946d,0xb47c53,0x996341,0x7c4f33,0x603d29];
const hairColors = [0x211e1a,0x39291e,0x65452b,0x9b7449,0xc2a56b,0x7a2e1d,0x8a8d90,0xd9d3c3];
const hairstyles = ['short','buzz','mash','sidepart','centerpart','slickback','wavy','curly','ponytail','long','afro'];
const cache = new Map();

export function getPlayerProfile(country, slot) {
  const key = `${country}:${slot}`;
  if (cache.has(key)) return cache.get(key);
  let seed = 2166136261;
  for (const ch of key) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const random = () => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const pool = names[country] ?? names.japan;
  const name = slot < pool.length ? pool[slot] : `${pool[slot % 11].split(' ')[0]} ${pool[(slot + 4) % 11].split(' ').slice(1).join(' ')}`;
  const jaPool = namesJa[country] ?? namesJa.japan;
  const nameJa = slot < jaPool.length ? jaPool[slot] : jaPool[slot % 11];
  const displayName = `${nameJa} / ${name}`;
  const height = slot === 0 ? 184 + Math.floor(random() * 15) : 168 + Math.floor(random() * 25);
  const build = .9 + random() * .25;
  const profile = {
    name, nameJa, displayName, number: slot + 1, height, build,
    weight: Math.round((height - 105) * build),
    age: 19 + Math.floor(random() * 16),
    foot: random() < .24 ? '左' : '右',
    skin: skinTones[Math.floor(random() * skinTones.length)],
    hairColor: hairColors[Math.floor(random() * hairColors.length)],
    hairstyle: hairstyles[Math.floor(random() * hairstyles.length)],
    pace: .92 + random() * .16,
    strength: Math.round(60 + (build - .9) * 100),
  };
  // Face with regional character (eye/brow shapes, iris colour, nose and
  // lip proportions, coherent skin tone), derived from a separate seed so
  // the traits above stay exactly as they were.
  let faceSeed = 2166136261;
  for (const ch of `${key}:face`) faceSeed = Math.imul(faceSeed ^ ch.charCodeAt(0), 16777619) >>> 0;
  profile.face = faceFor(COUNTRY_FACE_POOLS[country] ?? COUNTRY_FACE_POOLS.japan, faceSeed);
  profile.skin = profile.face.skin;
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
