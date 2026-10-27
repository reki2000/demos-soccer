// Contextual, non-repeating play calls; rendering and speech use the same line.
const CALLS={
 pass:[
  '{player}から{receiver}へ、鋭いパス！',
  '{team}、テンポよくつないでいます。',
  '{player}がボールをさばいた。次の攻撃へ。',
  '空いたスペースへパスが通る！',
  '{player}のパス、{receiver}が受けに動きます。',
  'ここは無理をせず、パスで展開。',
  'ディフェンスを揺さぶる、{team}のパスワーク。',
  'ボールを動かす{team}。チャンスをうかがいます。',
 ],
 shot:[
  '{player}、思い切ってシュート！',
  'ここで打った！ {player}がリングを狙う！',
  'シュートを放ちました。決まるか！',
  '{team}の{player}、得点を狙います。',
  'ディフェンス越しにシュートを選択！',
  '迷わずシュート。軌道に注目です。',
  '{player}、ここは自分で狙ってきました。',
  'フリーになった{player}、シュート！',
 ],
 feint:[
  '{player}、フェイントからクロスオーバー！ 抜いた！',
  '左右に揺さぶった！ {player}がディフェンスを振り切る！',
  '{player}のフェイクにディフェンスがつられた！ そのままドライブ！',
  '鋭いクロスオーバー！ {player}が一歩先へ出た！',
 ],
 dunk:[
  'リング下まで切り込んだ！ {player}、ダンク！',
  '{player}が高く跳ぶ！ 豪快なダンクを狙う！',
  '一気にゴール下へ！ ダンクシュート！',
  '{team}、強烈なフィニッシュを狙います！',
  'ディフェンスを突破、{player}がリングへ！',
 ],
 score:[
  '{player}が決めた！ {team}、{points}点追加！',
  '入った！ {player}、見事なフィニッシュ！',
  'シュート成功！ {team}がスコアを伸ばします。',
  '{player}、落ち着いて決めました！',
  '得点です！ {team}が勢いに乗ります。',
  'リングを射抜いた！ {player}の一撃！',
  'ナイスシュート！ スコアは{score}です。',
  '{team}、{points}ポイント成功！',
 ],
 dunkScore:[
  '叩き込んだ！ {player}のダンク成功！',
  '豪快なダンク！ {team}の会場が沸きます！',
  '見事なダンク、{player}が決めました！',
  'リングに直接押し込んだ！ 2点追加！',
 ],
 miss:[
  '惜しい！ リングに嫌われました。',
  'シュートは外れた！ リバウンドの争いです。',
  '決まりません。こぼれ球はどちらへ？',
  '今のシュートはノーゴール。次のプレーへ。',
  '{team}、このシュートは惜しくも外れました。',
 ],
 rebound:[
  '{player}がリバウンドを確保！',
  '跳び上がってボールをつかんだ、{player}！',
  '{team}、リバウンドを押さえました。',
  'セカンドボールの争い、{player}が勝った！',
  'ゴール下の競り合いを制しました！',
 ],
 steal:[
  '{player}がスティール！ 一気に攻守交代！',
  '奪った！ {team}の素早い守備です。',
  'パスを読んだ{player}、スティール成功！',
  'ボールを取り返しました。速攻のチャンス！',
  '手を伸ばした{player}がボールを奪取！',
 ],
 foul:[
  'ここで笛！ ファウルの判定です。',
  '接触がありました。ディフェンスのファウル。',
  'レフェリーがプレーを止めました。',
  'ファウルです。{team}に反則が記録されます。',
  '少し強い接触。笛が鳴りました。',
 ],
 freeThrowStart:[
  'フリースロー。{player}がラインに立ちます。',
  '{player}、一本のフリースローです。',
  'ここはフリースローで得点を狙います。',
  '{team}、フリースローの場面です。',
 ],
 freeThrowAttempt:[
  '{player}がフリースローを放った。',
  '一本のフリースロー。リングへ向かいます。',
  '静かな会場。フリースローを投じます。',
 ],
 freeThrowMade:[
  'フリースロー成功！ 確実に1点追加。',
  '{player}が決めました。フリースロー成功。',
  '落ち着いて決めた！ {team}に1点。',
 ],
 freeThrowMissed:[
  'フリースローは外れました。',
  '惜しい！ フリースロー失敗。',
  'リングに嫌われました。リバウンドへ。',
 ],
 violation:[
  'ショットクロックがゼロ！ 攻守交代。',
  '24秒バイオレーション。ここで攻撃終了。',
  '時間切れです。{team}がボールを失います。',
 ],
 inbound:[
  'エンドラインから再開です。',
  'ボールを拾った選手がスローイン。',
  '再びコート上の攻防が始まります。',
  '{team}、攻撃を組み立て直します。',
 ],
 quarter:['クォーター終了。次のピリオドへ。','ここで一度ブレイクです。','クォーター終了のブザーが鳴りました。'],
 fulltime:['試合終了です！ 最終スコアは{score}！','ゲームセット。熱戦に幕が下りました。','フルタイム、試合終了！'],
};
export const commentaryVariants=CALLS;
export function createBasketballCommentary(random=Math.random) {
  const previous=new Map();
  return function describe(type,details={},match=null,teams=[]) {
    const category=type==='score'&&details.dunk?'dunkScore':type;
    const lines=CALLS[category];
    if(!lines)return '';
    const name=player=>{
      if(!player||!teams[player.team])return '選手';
      // Commentary uses the Japanese form (kanji surname / katakana) when
      // the squad provides one, falling back to the Roman surname.
      const ja=teams[player.team].namesJa?.[player.slot];
      if(ja)return ja.replace(/（.*$/,'').split(/[ ・]/)[0]||'選手';
      return teams[player.team].names[player.slot]?.split(' ').slice(-1)[0]||'選手';
    };
    const player=match?.players?.[details.player]??null;
    const target=match?.players?.[details.target]??null;
    const team=teams[details.team]?.name??'攻撃側';
    const last=previous.get(category)??-1;
    const options=lines.map((_,i)=>i).filter(i=>i!==last);
    const n=options[Math.min(options.length-1,Math.floor(random()*options.length))];
    previous.set(category,n);
    const values={
      player:name(player),receiver:name(target),team,
      score:match?.score?.join('対')??'0対0',
      points:details.points??2,
    };
    return lines[n].replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
  };
}
