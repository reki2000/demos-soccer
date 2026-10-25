// Browser-owned audio. No downloaded or copyrighted sound files required.
// Sound starts only on an explicit user interaction.
export const ANNOUNCE_TYPES=new Set(['shot','score','miss','rebound','steal','foul',
  'freeThrowStart','freeThrowAttempt','freeThrowMade','freeThrowMissed',
  'quarter','violation','fulltime']);
export function commentaryLine(type,details={},teams=[]) {
  const code=n=>teams[n]?.code??(n===0?'ホーム':'アウェー');
  switch(type) {
    case 'shot':return code(details.team)+'がシュート！';
    case 'score':return code(details.team)+'、'+(details.points===3?'スリーポイント':'ツーポイント')+'成功！';
    case 'miss':return 'シュートは外れました。リバウンドの争いです。';
    case 'rebound':return code(details.team)+'がリバウンドを確保！';
    case 'steal':return code(details.team)+'、スティール！';
    case 'foul':return code(details.team)+'にファウル。'+(details.shooting?'シュート中の反則です。':'');
    case 'freeThrowStart':return 'フリースロー、'+details.attempts+'本です。';
    case 'freeThrowAttempt':return 'フリースローを放ちます。';
    case 'freeThrowMade':return 'フリースロー成功！';
    case 'freeThrowMissed':return 'フリースロー失敗です。';
    case 'quarter':return 'クォーター終了です。';
    case 'violation':return 'ショットクロック、バイオレーション。';
    case 'fulltime':return '試合終了！';
    default:return '';
  }
}
export function crowdReaction(type) {
  if(['score','freeThrowMade'].includes(type))return 1;
  if(['shot','steal','rebound'].includes(type))return .55;
  if(['foul','violation','freeThrowMissed'].includes(type))return .25;
  return 0;
}
export class ArenaAudio {
  constructor(env=globalThis) {
    this.env=env;
    this.crowdEnabled=false;
    this.commentaryEnabled=false;
    this.context=null;
    this.speech=null;
    this.lastSpoken=0;
    this.speed=1;
  }
  async setCrowd(enabled) {
    this.crowdEnabled=!!enabled;
    if(!enabled) {
      if(this.crowdGain)this.crowdGain.gain.setTargetAtTime(0,this.context.currentTime,.07);
      return;
    }
    const AudioContext=this.env.AudioContext||this.env.webkitAudioContext;
    if(!AudioContext){this.crowdEnabled=false;return false;}
    try {
      if(!this.context) {
        const ctx=this.context=new AudioContext();
        const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);
        const data=buffer.getChannelData(0);
        let smooth=0;
        for(let i=0;i<data.length;i++) {
          smooth=.965*smooth+(Math.random()*2-1)*.035;
          data[i]=smooth*1.8;
        }
        const source=ctx.createBufferSource();
        source.buffer=buffer;source.loop=true;
        const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=950;
        const crowd=ctx.createGain();crowd.gain.value=0;
        const cheer=ctx.createGain();cheer.gain.value=0;
        source.connect(filter);
        filter.connect(crowd);filter.connect(cheer);
        crowd.connect(ctx.destination);cheer.connect(ctx.destination);
        source.start();
        this.crowdGain=crowd;this.cheerGain=cheer;
      }
      await this.context.resume();
      this.crowdGain.gain.setTargetAtTime(.70,this.context.currentTime,.18);
      return true;
    }catch(error) {
      this.crowdEnabled=false;
      return false;
    }
  }
  setCommentary(enabled) {
    this.commentaryEnabled=!!enabled;
    if(!enabled)this.stopSpeech();
    return !!this.env.speechSynthesis && !!this.env.SpeechSynthesisUtterance;
  }
  setPlaying(playing) {
    if(this.context && this.crowdGain) {
      this.crowdGain.gain.setTargetAtTime(
        playing&&this.crowdEnabled?.70:0,this.context.currentTime,.15
      );
    }
    if(!playing)this.stopSpeech();
  }
  setSpeed(speed){this.speed=speed;}
  stopSpeech() {
    this.speech=null;
    try{this.env.speechSynthesis?.cancel();}catch{}
  }
  onEvent(type,details,teams) {
    if(this.crowdEnabled&&this.context&&this.cheerGain) {
      const intensity=crowdReaction(type);
      if(intensity>0) {
        const now=this.context.currentTime;
        const gain=this.cheerGain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value,now);
        gain.linearRampToValueAtTime(.25+intensity*.95,now+.16);
        gain.exponentialRampToValueAtTime(.001,now+.85+intensity*1.2);
      }
    }
    if(!this.commentaryEnabled || !ANNOUNCE_TYPES.has(type))return;
    // Skip rapid chatter when fast-forwarding, and never let speech queue grow.
    const now=Date.now();
    if(this.speed>1 && !['score','fulltime','foul'].includes(type))return;
    if(now-this.lastSpoken<900 && !['score','fulltime'].includes(type))return;
    const line=commentaryLine(type,details,teams);
    if(!line || !this.env.SpeechSynthesisUtterance)return;
    this.lastSpoken=now;
    this.stopSpeech();
    try {
      const speech=new this.env.SpeechSynthesisUtterance(line);
      speech.lang='ja-JP';speech.rate=1.13;speech.pitch=1.05;speech.volume=.95;
      const voices=this.env.speechSynthesis?.getVoices?.()??[];
      const japanese=voices.find(voice=>voice.lang?.toLowerCase().startsWith('ja'));
      if(japanese)speech.voice=japanese;
      this.speech=speech;
      this.env.speechSynthesis?.speak(speech);
    }catch{}
  }
  dispose() {
    this.setCommentary(false);
    this.crowdEnabled=false;
    if(this.context){this.context.close();this.context=null;}
  }
}
