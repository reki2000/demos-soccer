// Browser-only arena sound. Browsers require a user gesture before playback.
export const ANNOUNCE_TYPES = new Set([
  'shot','score','miss','rebound','steal','foul','freeThrowStart',
  'freeThrowAttempt','freeThrowMade','freeThrowMissed','quarter','violation','fulltime',
]);

export function commentaryLine(type, details={}, teams=[]) {
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
    this.crowdGain=null;
    this.cheerGain=null;
    this.playing=true;
    this.speech=null;
    this.speechToken=0;
    this.lastSpoken=0;
    this.speed=1;
    this.onStatus=()=>{};
    this.motionClock=0;
    this.lastBouncePhase=null;
    this.lastBounceOwner=null;
    this.lastSqueak=0;
    this.lastBounce=0;
    this.lastKick=0;
    this.lastMusic=0;
    this.soundEvents=[];
    this.fxGain=null;
  }
  status(channel,message,state='info') {
    this.onStatus({channel,message,state});
  }
  initCrowd() {
    const AudioContext=this.env.AudioContext||this.env.webkitAudioContext;
    if(!AudioContext)throw new Error('Web Audio非対応');
    const ctx=this.context=new AudioContext();
    const sampleRate=ctx.sampleRate;
    // Previously the ambience was smoothed by a very narrow filter *twice*
    // and was almost inaudible. A broad crowd-shaped noise bed has adequate
    // RMS level even on phone speakers.
    const buffer=ctx.createBuffer(1,Math.round(sampleRate*3),sampleRate);
    const samples=buffer.getChannelData(0);
    let low=0;
    for(let i=0;i<samples.length;i++){
      const noise=Math.random()*2-1;
      low=low*.985+noise*.015;
      const t=i/sampleRate;
      const swell=.75+.12*Math.sin(t*1.9)+.11*Math.sin(t*4.13);
      samples[i]=(noise*.38+low*1.65)*swell;
    }
    const source=ctx.createBufferSource();
    source.buffer=buffer;
    source.loop=true;
    const filter=ctx.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.value=2300;
    const crowd=ctx.createGain();
    const cheer=ctx.createGain();
    crowd.gain.value=0;
    cheer.gain.value=0;
    source.connect(filter);
    filter.connect(crowd);
    filter.connect(cheer);
    crowd.connect(ctx.destination);
    cheer.connect(ctx.destination);
    const fx=ctx.createGain();
    fx.gain.value=.55;
    fx.connect(ctx.destination);
    this.fxGain=fx;
    source.start();
    this.crowdGain=crowd;
    this.cheerGain=cheer;
    this.source=source;
  }
  async setCrowd(enabled) {
    if(!enabled) {
      this.crowdEnabled=false;
      if(this.context&&this.crowdGain) {
        this.crowdGain.gain.setTargetAtTime(0,this.context.currentTime,.06);
        this.cheerGain.gain.setTargetAtTime(0,this.context.currentTime,.06);
      }
      this.status('crowd','観客音 OFF','off');
      return true;
    }
    try {
      if(!this.context)this.initCrowd();
      await this.context.resume();
      if(this.context.state && this.context.state!=='running')throw new Error('ブラウザが音声を停止しています');
      this.crowdEnabled=true;
      this.setPlaying(this.playing);
      this.playCue();
      this.status('crowd','観客音 ON。確認音が鳴ります','on');
      return true;
    }catch(error) {
      this.crowdEnabled=false;
      this.status('crowd','観客音を再生できません: '+(error?.message||'音声設定を確認してください'),'error');
      return false;
    }
  }
  // Immediate audible verification after enabling, even before a basket.
  playCue() {
    const ctx=this.context;
    if(!ctx||!ctx.createOscillator||!ctx.createGain)return false;
    const t=ctx.currentTime;
    const osc=ctx.createOscillator();
    const envelope=ctx.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(660,t);
    osc.frequency.setValueAtTime(880,t+.15);
    envelope.gain.setValueAtTime(.0001,t);
    envelope.gain.exponentialRampToValueAtTime(.22,t+.018);
    envelope.gain.exponentialRampToValueAtTime(.001,t+.38);
    osc.connect(envelope);
    envelope.connect(ctx.destination);
    osc.start(t);
    osc.stop(t+.4);
    return true;
  }
  setCommentary(enabled) {
    const supported=!!this.env.speechSynthesis && !!this.env.SpeechSynthesisUtterance;
    this.commentaryEnabled=!!enabled&&supported;
    if(!this.commentaryEnabled) {
      this.stopSpeech();
      this.status('voice',enabled?'このブラウザでは音声読み上げを利用できません':'実況音声 OFF',
        enabled?'error':'off');
    } else {
      this.status('voice','実況音声 ON。読み上げを準備しています','on');
    }
    return supported;
  }
  setPlaying(playing) {
    this.playing=!!playing;
    if(this.context&&this.crowdGain) {
      this.crowdGain.gain.setTargetAtTime(
        (this.playing && this.crowdEnabled) ? .95 : 0,this.context.currentTime,.10);
    }
    if(!playing)this.stopSpeech();
  }
  setSpeed(speed){this.speed=speed;}
  stopSpeech() {
    this.speechToken++;
    this.speech=null;
    try{this.env.speechSynthesis?.cancel();}catch{}
  }
  speak(text,priority=false) {
    if(!this.commentaryEnabled||!this.playing||!this.env.SpeechSynthesisUtterance)return false;
    const synth=this.env.speechSynthesis;
    if(!priority&&(synth?.speaking||synth?.pending))return false;
    // Cancel only an existing utterance. On some mobile engines, calling
    // cancel() just before the *first* speak() suppresses the new speech.
    if(this.speech || synth?.speaking || synth?.pending)this.stopSpeech();
    else this.speechToken++;
    const token=this.speechToken;
    try {
      const speech=new this.env.SpeechSynthesisUtterance(text);
      speech.lang='ja-JP';
      speech.rate=1.43; // Faster, short-form sports commentary.
      speech.pitch=1;
      speech.volume=1;
      const voices=synth?.getVoices?.()??[];
      const japanese=voices.find(voice=>voice.lang?.toLowerCase().startsWith('ja'));
      if(japanese)speech.voice=japanese;
      speech.onstart=()=>{
        if(token===this.speechToken)this.status('voice','日本語実況を再生中','on');
      };
      speech.onend=()=>{
        if(token===this.speechToken) {
          this.speech=null;
          this.status('voice','実況音声 ON','on');
        }
      };
      speech.onerror=event=>{
        if(token!==this.speechToken)return;
        this.speech=null;
        const reason=event?.error||'不明なエラー';
        if(reason==='interrupted'||reason==='canceled')return;
        this.status('voice','読み上げエラー: '+reason+'。端末の日本語音声設定を確認してください','error');
      };
      this.speech=speech;
      synth?.resume?.();
      synth?.speak(speech);
      return true;
    }catch(error) {
      this.status('voice','読み上げを開始できません: '+(error?.message||'ブラウザの設定を確認してください'),'error');
      return false;
    }
  }
  // Call synchronously inside the enable button click to unlock speech.
  testSpeech() {
    if(!this.commentaryEnabled)return false;
    this.lastSpoken=Date.now();
    return this.speak('実況音声を開始します。',true);
  }

  // Short synthesized sports effects. Everything is generated at runtime:
  // no third-party music, files or licensed stadium recordings.
  tone(frequency,duration=.12,volume=.16,type='sine',endFrequency=frequency,startAt=null) {
    const ctx=this.context;
    if(!this.crowdEnabled||!this.playing||!ctx||!this.fxGain)return false;
    if(!ctx.createOscillator||!ctx.createGain)return false;
    const t=startAt??ctx.currentTime;
    const oscillator=ctx.createOscillator();
    const gain=ctx.createGain();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(frequency,t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(25,endFrequency),t+duration);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    oscillator.connect(gain);
    gain.connect(this.fxGain);
    oscillator.start(t);
    oscillator.stop(t+duration+.015);
    return true;
  }
  whistle() {
    if(!this.context)return;
    const t=this.context.currentTime;
    this.tone(1880,.28,.23,'sine',2200,t);
    this.tone(2440,.26,.08,'sine',2600,t+.025);
    this.tone(1840,.20,.18,'sine',2050,t+.31);
  }
  squeak() {
    const pitch=1200+Math.random()*320;
    this.tone(pitch,.115,.11,'sawtooth',pitch*1.65);
    this.tone(pitch*1.52,.09,.038,'sine',pitch*.8);
  }
  bounce() {
    this.tone(165,.15,.26,'sine',59);
    this.tone(320,.07,.045,'triangle',98);
  }
  kick() {
    this.tone(230,.13,.20,'sine',80);
    this.tone(470,.035,.075,'triangle',175);
  }
  // Original short organ motif, played as notes instead of a music file.
  musicCue() {
    if(!this.context||!this.crowdEnabled||!this.playing)return;
    const now=this.context.currentTime;
    const melody=[392,494,587,784,587,659,784,988];
    melody.forEach((note,i)=>{
      this.tone(note,.19,.046,'triangle',note,now+i*.175);
      this.tone(note/2,.19,.022,'sine',note/2,now+i*.175);
    });
    this.lastMusic=this.motionClock;
  }
  effect(kind) {
    if(!this.crowdEnabled||!this.playing)return false;
    switch(kind){
      case 'whistle':this.whistle();break;
      case 'bounce':this.bounce();break;
      case 'squeak':this.squeak();break;
      case 'kick':this.kick();break;
      case 'music':this.musicCue();break;
      default:return false;
    }
    this.soundEvents.push(kind);
    if(this.soundEvents.length>30)this.soundEvents.shift();
    return true;
  }
  // Each render tick drives localized shoe and ball sounds; no per-frame
  // oscillator is created unless a physical step/ball bounce has occurred.
  update(dt,match,kind='basketball') {
    if(!Number.isFinite(dt)||dt<=0)return;
    this.motionClock+=dt;
    if(!this.crowdEnabled||!this.playing)return;
    const players=match.players??[];
    const moving=players.filter(p=>p.speed>1.35).length;
    if(moving>=2&&this.motionClock-this.lastSqueak>.25) {
      this.effect('squeak');
      this.lastSqueak=this.motionClock;
    }
    if(kind==='basketball') {
      const control=match.ballControl;
      const owner=match.owner?.id;
      if(control?.mode==='dribble') {
        const phase=control.phase;
        if(this.lastBounceOwner===owner && this.lastBouncePhase!=null &&
           phase>=.50 && this.lastBouncePhase<.50 &&
           this.motionClock-this.lastBounce>.28) {
          this.effect('bounce');
          this.lastBounce=this.motionClock;
        }
        this.lastBouncePhase=phase;
        this.lastBounceOwner=owner;
      } else {
        this.lastBouncePhase=null;
        this.lastBounceOwner=null;
      }
    } else {
      if(match.flight && match.flight!==this.lastFlight &&
         this.motionClock-this.lastKick>.3) {
        this.effect('kick');
        this.lastKick=this.motionClock;
      }
      this.lastFlight=match.flight;
    }
    if(this.motionClock-this.lastMusic>35){
      this.effect('music');
      this.lastMusic=this.motionClock;
    }
  }

  react(type) {
    if(type==='foul'||type==='violation')this.effect('whistle');
    if(['score','freeThrowMade','quarter'].includes(type))this.effect('music');
    if(this.crowdEnabled&&this.context&&this.cheerGain&&this.playing) {
      const intensity=crowdReaction(type);
      if(intensity>0) {
        const now=this.context.currentTime;
        const gain=this.cheerGain.gain;
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(Math.max(.001,gain.value),now);
        gain.linearRampToValueAtTime(.36+intensity*.55,now+.12);
        gain.exponentialRampToValueAtTime(.001,now+.85+intensity*1.2);
      }
    }
  }
  onEvent(type,details,teams) {
    this.react(type);
    if(!this.commentaryEnabled||!this.playing||!ANNOUNCE_TYPES.has(type))return;
    const now=Date.now();
    const urgent=['score','fulltime'].includes(type);
    if(this.speed>1&&!['score','fulltime','foul'].includes(type))return;
    if(now-this.lastSpoken<1300&&!urgent)return;
    const line=commentaryLine(type,details,teams);
    if(!line)return;
    if(this.speak(line,urgent))this.lastSpoken=now;
  }
  dispose() {
    this.setCommentary(false);
    this.crowdEnabled=false;
    try{this.source?.stop();}catch{}
    if(this.context){this.context.close();this.context=null;}
  }
}
