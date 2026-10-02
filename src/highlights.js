const PLAYER_FIELDS = ['id','team','slot','x','z','vx','vz','speed','angle','phase','running','jump','contest','action','actionTime','actionDuration','fallAmount','fallRecover','strideDirection','turnRate','keeperReach','keeperDive'];
function frameOf(match, at) {
  return { at, time: match.time, half: match.half, score: [...match.score], ball: {...match.ball},
    owner: match.owner?.id ?? null, flight: match.flight ? {from:match.flight.from,passer:match.flight.passer} : null,
    players: match.players.map(p=>Object.fromEntries(PLAYER_FIELDS.map(key=>[key,p[key]]))) };
}

export class Highlights {
  constructor(onClip = () => {}) { this.onClip=onClip;this.reset(); }
  reset(){this.clock=0;this.sinceFrame=0;this.ring=[];this.clips=[];this.pending=null;this.active=false;this.finished=false;this.elapsed=0;this.index=-1;this.delay=0;}
  event(title,match){
    if(title==='SHOT'||(title==='HEADER'&&match.flight?.shot)){
      if(this.pending)this.finishClip();
      this.pending={frames:[...this.ring],shooter:match.flight?.passer??match.owner?.id??match.lastTouchPlayer,outcome:'shot',until:this.clock+3.6};
    }
    if(this.pending&&['GOAL!','SAVED','BLOCKED','GOAL KICK','CORNER KICK'].includes(title)){
      this.pending.outcome=title==='GOAL!'?'goal':title==='SAVED'?'save':title==='BLOCKED'?'block':'miss';
      this.pending.until=Math.min(this.pending.until,this.clock+1.2);
    }
  }
  capture(dt,match){
    this.clock+=dt;this.sinceFrame+=dt;
    if(this.sinceFrame>=1/15){
      this.sinceFrame%=1/15;
      const frame=frameOf(match,this.clock);this.ring.push(frame);
      while(this.ring.length&&this.ring[0].at<this.clock-2.2)this.ring.shift();
      if(this.pending)this.pending.frames.push(frame);
    }
    if(this.pending&&this.clock>=this.pending.until)this.finishClip();
  }
  finishClip(){
    if(this.pending?.frames.length>=3){
      this.clips.push(this.pending);
      // Bound memory while retaining goals ahead of routine attempts.
      if(this.clips.length>10){const remove=this.clips.findIndex(c=>c.outcome!=='goal');this.clips.splice(remove<0?0:remove,1)}
    }
    this.pending=null;
  }
  start(){
    this.finishClip();this.active=this.clips.length>0;this.finished=false;this.delay=3.6;this.index=-1;this.elapsed=0;
    return this.active;
  }
  update(dt,live){
    if(!this.active)return null;
    if(this.delay>0){this.delay-=dt;return null}
    if(this.index<0){this.index=0;this.onClip(this.clips[0],0,this.clips.length)}
    const clip=this.clips[this.index],frames=clip.frames;
    this.elapsed+=dt*.65;
    const at=frames[0].at+this.elapsed;
    if(at>=frames.at(-1).at){
      this.index++;this.elapsed=0;
      if(this.index>=this.clips.length){this.active=false;this.finished=true;return null}
      this.onClip(this.clips[this.index],this.index,this.clips.length);
      return this.view(this.clips[this.index].frames[0],live,this.clips[this.index]);
    }
    let i=0;while(i<frames.length-2&&frames[i+1].at<at)i++;
    const a=frames[i],b=frames[i+1],t=Math.max(0,Math.min(1,(at-a.at)/Math.max(.001,b.at-a.at)));
    const mixed={...a,ball:{},players:a.players.map((p,n)=>{
      const next=b.players[n],copy={...p};
      for(const key of ['x','z','speed','phase','running','jump','contest','actionTime','fallAmount','fallRecover','keeperReach','keeperDive']){
        if(Number.isFinite(p[key])&&Number.isFinite(next[key]))copy[key]=p[key]+(next[key]-p[key])*t;
      }
      const delta=Math.atan2(Math.sin(next.angle-p.angle),Math.cos(next.angle-p.angle));copy.angle=p.angle+delta*t;
      return copy;
    })};
    for(const key of ['x','y','z'])mixed.ball[key]=a.ball[key]+(b.ball[key]-a.ball[key])*t;
    return this.view(mixed,live,clip);
  }
  view(frame,live,clip){
    const players=frame.players.map((p,i)=>({...p,profile:live.players[i].profile}));
    return {...live,time:frame.time,half:frame.half,score:[...frame.score],ball:{...frame.ball},players,
      owner:frame.owner==null?null:players[frame.owner],flight:frame.flight,celebration:null,pause:0,restart:null,setPiece:null,
      replay:{shooter:clip.shooter,outcome:clip.outcome,index:this.index+1,total:this.clips.length},
      direction(team){return(team===0?1:-1)*(frame.half===1?1:-1)}};
  }
}
