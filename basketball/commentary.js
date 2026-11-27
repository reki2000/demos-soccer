import { announcerName } from '../src/announcer-name.js';
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
  'ワンタッチで展開、{team}のリズムが出てきました。',
  '{receiver}の手元へ、正確なパスが通ります。',
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
  '打った、{player}！ ボールがリングへ向かいます！',
  'ドライブからプルアップ。{player}のジャンパー！',
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
 clockShot:['ショットクロックは残り{seconds}秒！ {player}が放った！','時間がない、{player}がここで打つ！','残り{seconds}秒でリリース！ リングに届くか。'],
 tie:['{player}、決めた！ これで{score}、同点です！','追いついた！ {player}の{points}点で並びました。','{team}が試合を振り出しに戻した！ {score}です。'],
 leadChange:['逆転！ {player}の一本で{team}が前に出ます！','入った！ 今度は{team}のリードです、{score}！','{player}がひっくり返した！ スコアは{score}！'],
 score:[
  '{player}が決めた！ {team}、{points}点追加！',
  '入った！ {player}、見事なフィニッシュ！',
  'シュート成功！ {team}がスコアを伸ばします。',
  '{player}、落ち着いて決めました！',
  '得点です！ {team}が勢いに乗ります。',
  'リングを射抜いた！ {player}の一撃！',
  'ナイスシュート！ スコアは{score}です。',
  '{team}、{points}ポイント成功！',
  'ネットを揺らした！ {player}のシュートが決まった！',
  '{team}、{player}の一撃でリードが動きます！',
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
  'リングに嫌われた！ 次に触るのは誰だ。',
 ],
 rebound:[
  '{player}がリバウンドを確保！',
  '跳び上がってボールをつかんだ、{player}！',
  '{team}、リバウンドを押さえました。',
  'セカンドボールの争い、{player}が勝った！',
  'ゴール下の競り合いを制しました！',
  '空中戦を制した！ {player}がボールを収める！',
 ],
 steal:[
  '{player}がスティール！ 一気に攻守交代！',
  '奪った！ {team}の素早い守備です。',
  'パスを読んだ{player}、スティール成功！',
  'ボールを取り返しました。速攻のチャンス！',
  '手を伸ばした{player}がボールを奪取！',
  '読み勝った！ {player}がボールを奪い取る！',
 ],
 foul:[
  'ここで笛！ ファウルの判定です。',
  '接触がありました。ディフェンスのファウル。',
  'レフェリーがプレーを止めました。',
  'ファウルです。{team}に反則が記録されます。',
  '少し強い接触。笛が鳴りました。',
  'ここで笛が鳴った。{team}のファウルです。',
 ],
 freeThrowStart:[
  'フリースロー。{player}がラインに立ちます。',
  '{player}、フリースローラインに立ちました。',
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
// Analyst (解説) lines: the second voice explains what the play means, why
// it was chosen, and adds team/player background (height, position, role).
// Placeholders: {player} {receiver} {team} {score} {points} {height}
// {position} {number}
const ANALYSIS={
 score:[
  '決めた{player}は{position}、{height}センチ。得点だけでなく、相手のヘルプを引き付ける存在感が{team}の攻撃を助けています。',
  'この得点の意味は、スコア以上です。{team}は相手の守備が整う前に攻め切る形を繰り返せています。',
  'シュート前のドライブで相手を一人剥がしたのが決定機でした。守備はローテーションが間に合っていません。',
  '背番号{number}の{player}、今日はタッチが合っています。ベンチも長く使う判断になるでしょう。',
 ],
 dunkScore:[
  'ダンクは2点以上の効果があります。会場の空気と{team}のベンチが一気に熱くなりました。',
  '{height}センチの{player}がリングに叩き込む形は、相手にとって一番止めにくいフィニッシュです。守備はゴール下のポジション争いで負けていました。',
 ],
 shot:[
  'このシュート選択、{position}の{player}にとっては得意な距離です。外れても、打つことで相手の寄せが次から速くなります。',
  '守備が下がったのを見て打った、判断の良い一本。{team}のスペーシングがシュートスペースを作りました。',
 ],
 miss:[
  '外れはしましたが、シュート自体は良い形。リバウンドに入る人数と位置が、次の攻撃権を左右します。',
  'リングへの軌道は悪くありませんでした。{team}は切り替えの速さで相手の速攻を防ぎたいところです。',
 ],
 rebound:[
  '{player}のリバウンド、跳ぶ高さより先に、落ちてくる位置を読んで体を入れていました。これがポジショニングの技術です。',
  'ゴール下の人数配置で{team}が勝っていました。ボックスアウトが機能しています。',
 ],
 steal:[
  'スティールは偶然ではありません。{player}はパスコースを半歩消しながら、相手の目線が切れる瞬間を待っていました。',
  'この奪い方で{team}は速攻の形へ。守備から流れを作るのがこのチームの持ち味です。',
 ],
 foul:[
  'ファウルは止めるための接触ですが、積み重なると後半に効いてきます。{team}はチームファウルの数にも注意が必要です。',
  'シュートを打たせるくらいなら、という判断でもあります。ただし、フリースローを与える場面かどうかは際どいところでした。',
 ],
 feint:[
  'フェイントの肝は、相手の重心を一度横に流すこと。{player}はフェイクの大きさではなく、タイミングで勝ちました。',
  'ディフェンスはボールではなく体に反応してしまいました。クロスオーバーの初速が速い{player}らしい抜き方です。',
 ],
 freeThrowMade:[
  'フリースローは静止した一本ですが、ルーティンの安定がものを言います。{player}は呼吸からリリースまで一定ですね。',
 ],
 pass:[
  'このパス、受ける側が次に何をするかまで計算されています。{team}の連携の成熟度が出ました。',
  '{position}同士の距離感が良いんです。近いようでいて、相手一人では両方を見切れません。',
 ],
};
export const commentaryAnalysis=ANALYSIS;
const POSITIONS=['ポイントガード','シューティングガード','スモールフォワード','パワーフォワード','センター'];
export function createBasketballCommentary(random=Math.random) {
  const previous=new Map();
  const previousAnalysis=new Map();
  const build=(type,details,match,teams,bank,seen)=>{
    let category=type==='score'&&details.dunk?'dunkScore':type;
    const score=details.score??match?.score;
    const margin=score ? score[details.team]-score[1-details.team] : NaN;
    if(type==='score' && bank===CALLS && !details.dunk){
      if(margin===0)category='tie';
      else if(margin>0 && margin<details.points)category='leadChange';
    }
    if(type==='shot' && bank===CALLS && match?.shotClock>0 && match.shotClock<=5)category='clockShot';
    const lines=bank[category];
    if(!lines)return '';
    const name=player=>{
      const squad=teams[player?.team];
      if(!squad)return '選手';
      return announcerName(squad.namesJa?.[player.slot],squad.names?.[player.slot],
        ['tokyo','osaka','seoul'].includes(squad.id));
    };
    const player=match?.players?.[details.player]??null;
    const target=match?.players?.[details.target]??null;
    const team=teams[details.team]?.name??'攻撃側';
    let history=seen.get(category)??[];
    let options=lines.map((_,i)=>i).filter(i=>!history.includes(i));
    if(!options.length){
      const last=history.at(-1);
      options=lines.map((_,i)=>i).filter(i=>lines.length===1 || i!==last);
      history=[];
    }
    const n=options[Math.floor(random()*options.length)];
    seen.set(category,[...history,n]);
    const values={
      player:name(player),receiver:name(target),team,
      score:match?.score?.join('対')??'0対0',
      points:details.points??2,
      seconds:Math.ceil(match?.shotClock??0),
      height:player?Math.round(player.height*100):'',
      position:player?POSITIONS[player.slot]??'':'',
      number:player?.number??'',
    };
    let line=lines[n].replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
    if(bank===ANALYSIS && type==='score' && match?.quarter>=4 && match.clock<=60 && Math.abs(margin)<=3){
      const seconds=Math.ceil(match.clock);
      line=margin===0 ? `残り${seconds}秒、同点です。次の一本と、相手に何秒残すかが勝負になります。` :
        `残り${seconds}秒で${Math.abs(margin)}点差。まだ一度の攻撃で追いつける差です。`;
    } else if(bank===ANALYSIS && type==='foul' && details.teamFouls){
      line=`このクォーター、${team}のチームファウルは${details.teamFouls}つ目。`+
        (details.teamFouls>=5?'ボーナスに入っています。次の守りも接触には注意です。':'第5ファウルからはフリースローを与えます。');
    }
    return line;
  };
  function describe(type,details={},match=null,teams=[]) {
    return build(type,details,match,teams,CALLS,previous);
  }
  // Second voice: analysis for the same event, spoken after the call.
  describe.analysis=(type,details={},match=null,teams=[])=>build(type,details,match,teams,ANALYSIS,previousAnalysis);
  return describe;
}
