// Additional arena personnel: three moving referees, two coaches and
// substitute players seated on twelve individual courtside chairs.
export function sidelineLayout() {
  const seats=[];
  for(let team=0;team<2;team++)for(let i=0;i<6;i++)
    seats.push({team,slot:i,x:(team===0?-10.3:3.1)+i*1.15,z:9.35});
  const coaches=[
    {team:0,x:-2.45,z:8.75},
    {team:1,x:2.45,z:8.75}
  ];
  const referees=[{x:-9,z:-6.8},{x:9,z:6.7},{x:0,z:-6.9}];
  return {seats,coaches,referees};
}

export function makeSidelines(world,THREE,squads) {
  const group=new THREE.Group();
  world.add(group);
  const layout=sidelineLayout();
  const mats={
    steel:new THREE.MeshStandardMaterial({color:0x71818c,roughness:.6}),
    seat:new THREE.MeshStandardMaterial({color:0x354a58,roughness:.8}),
    skin:new THREE.MeshStandardMaterial({color:0xc9a181,roughness:.8}),
    black:new THREE.MeshStandardMaterial({color:0x242933,roughness:.9}),
    white:new THREE.MeshStandardMaterial({color:0xe7e9e4,roughness:.85}),
  };
  function box(parent,w,h,d,mat,x=0,y=0,z=0) {
    const result=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    result.position.set(x,y,z);result.castShadow=true;
    parent.add(result);return result;
  }
  function person({x,z,jersey,mode,seat=false}) {
    const actor=new THREE.Group();
    actor.position.set(x,0,z);
    // Staff and players face the court (negative z).
    actor.rotation.y=Math.PI;
    group.add(actor);
    const y=seat?.75:1.32;
    box(actor,.39,.51,.23,jersey,0,y,0);
    const head=new THREE.Mesh(new THREE.IcosahedronGeometry(.14,1),mats.skin);
    head.position.set(0,y+.40,0);head.castShadow=true;actor.add(head);
    const arms=[];
    for(const side of [-1,1]){
      const arm=new THREE.Group();
      arm.position.set(side*.25,y+.16,0);
      box(arm,.115,.34,.12,mats.skin,0,-.19,0);
      actor.add(arm);arms.push(arm);
      box(actor,.14,seat?.44:.69,.15,mats.black,side*.12,seat?.3:.40,0);
    }
    actor.userData={mode,arms,baseY:actor.position.y};
    return actor;
  }
  const refMaterial=new THREE.MeshStandardMaterial({color:0xeeeeea,roughness:.8});
  const refs=layout.referees.map(r=>{
    const actor=person({...r,jersey:refMaterial,mode:'ref'});
    for(const offset of [-.12,0,.12])box(actor,.035,.43,.24,mats.black,offset,1.33,0);
    return actor;
  });
  const teamMaterials=squads.map(team=>new THREE.MeshStandardMaterial({
    color:team.color,roughness:.8
  }));
  for(const s of layout.seats) {
    // Seat bases, backs and leg posts are visible behind the near sideline.
    box(group,.67,.09,.57,mats.seat,s.x,.47,s.z);
    box(group,.67,.67,.09,mats.seat,s.x,.76,s.z+.28);
    for(const sign of [-1,1])box(group,.07,.49,.07,mats.steel,s.x+sign*.26,.24,s.z);
    if(s.slot<5)person({x:s.x,z:s.z,jersey:teamMaterials[s.team],mode:'reserve',seat:true});
  }
  const coaches=layout.coaches.map(c=>person({
    ...c,jersey:mats.black,mode:'coach'
  }));
  let time=0,prior=[0,0],cheer=0;
  function update(match,dt) {
    time+=Math.max(0,dt);
    if(match.score[0]!==prior[0] || match.score[1]!==prior[1])cheer=2;
    prior=[...match.score];cheer=Math.max(0,cheer-dt);
    refs.forEach((ref,i)=>{
      const destinations=[match.ball.x*.48-5,match.ball.x*.48+5,match.ball.x*.45];
      const goal=Math.max(-12.1,Math.min(12.1,destinations[i]));
      ref.position.x+=(goal-ref.position.x)*(1-Math.exp(-dt*1.7));
      ref.position.y=.035*Math.abs(Math.sin(time*6+i));
      ref.userData.arms[0].rotation.x=Math.sin(time*5+i)*.2;
      ref.userData.arms[1].rotation.x=-Math.sin(time*5+i)*.2;
    });
    coaches.forEach((coach,i)=>{
      coach.userData.arms[0].rotation.x=cheer>0?-1.65:Math.sin(time*1.2+i)*.12;
      coach.userData.arms[1].rotation.x=cheer>0?-1.25:0;
    });
    for(const actor of group.children)if(actor.userData.mode==='reserve'){
      actor.position.y=cheer>0?.12*Math.abs(Math.sin(time*9+actor.position.x)):0;
      actor.userData.arms[0].rotation.x=cheer>0?-1.25:0;
    }
  }
  return {group,layout,update};
}
