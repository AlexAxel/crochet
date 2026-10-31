/**
 * Physical filament (particle rod) driven by a crochet hook.
 *
 * The render layer reads ONLY positions produced by the solver.
 * During a stitch the crochet hook grasps a material point on the supply
 * strand and drags it through the existing live loop. The geometry is never
 * replaced by a pre-shaped stitch template.
 *
 * XPBD stretch and bending, substrate contact, segment/segment contact and
 * Verlet velocities are evaluated at fixed substeps. A small seed slip knot
 * is the necessary initial condition (as it would be when starting by hand).
 *
 * Scope: experimentally correct LOCAL dynamics, not verified textile
 * mechanics. Unmodelled: twisting, exact hook/strand surface contact,
 * continuous collision detection, real yarn friction and spool payout.
 */
export type Vector={x:number;y:number;z:number};
export type Phase='idle'|'approach'|'catch'|'draw'|'tighten';
export const CAPTURE_AT=.24;
export const DRAW_START=.36;
export const DRAW_END=.78;
export type PhysicsSnapshot={
  positions:Vector[];
  previous:Vector[];
  active:number;
  outlet:number;
  count:number;
  contactFreeze:number;
  rest:number[];
  bends:number[];
  heldLoop:Vector;
};
export type PhysicsFrame={
  yarn:readonly Vector[];
  hook:Vector;
  active:Vector;
  phase:Phase;
  completed:number;
  moving:boolean;
  contacts:number;
  maxStrain:number;
  // Contact is true ONLY after the hook has actually attached to the physical strand.
  grasped:boolean;
  graspIndex:number|null;
  graspDistance:number|null;
  passedThrough:boolean;
};
export const SEGMENT=.075;
export const RADIUS=.052;
const FLOOR=-.34;
const stepLen=(a:Vector,b:Vector)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const vec=(x:number,y:number,z:number):Vector=>({x,y,z});
const copy=(v:Vector)=>({...v});
const add=(a:Vector,b:Vector)=>vec(a.x+b.x,a.y+b.y,a.z+b.z);
const mul=(a:Vector,s:number)=>vec(a.x*s,a.y*s,a.z*s);
const mix=(a:Vector,b:Vector,t:number)=>vec(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};

/**
 * Controlled bight path. The path controls the hook, NOT the mesh.
 * Each rod particle moves through physics: neighbours follow due to
 * inextensibility, bend, collision and hand-held anchors.
 */
function hookTrack(progress:number,grasp:Vector,entry:Vector,rest:Vector):Vector{
  const p=clamp(progress);
  // Hook arrives at the working strand WITHOUT moving that strand.
  if(p<CAPTURE_AT)
    return mix(rest,grasp,smooth(p/CAPTURE_AT));
  // AFTER hooking the yarn, move the captured material point to the
  // back side of the old loop's opening (not through its solid strands).
  const rear=vec(entry.x+.015,entry.y,entry.z-.24);
  if(p<DRAW_START)return mix(grasp,rear,smooth((p-CAPTURE_AT)/(DRAW_START-CAPTURE_AT)));
  const front=vec(entry.x+.015,entry.y,entry.z+.36);
  if(p<DRAW_END)return mix(rear,front,smooth((p-DRAW_START)/(DRAW_END-DRAW_START)));
  // Pull the new bight clear, leaving it on the hook and the old
  // opening behind it. The yarn is still the *same physical material*.
  return mix(front,vec(entry.x+.40,entry.y+.13,entry.z+.30),smooth((p-DRAW_END)/(1-DRAW_END)));
}

/** arclength resampling prevents one physical link from being much longer. */
export function sampleSeed(path:readonly Vector[],spacing=SEGMENT):Vector[]{
  const out=[copy(path[0])];
  let travel=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    const len=stepLen(a,b);
    if(len<1e-8)continue;
    for(let d=spacing-travel;d<len-1e-7;d+=spacing){
      out.push(mix(a,b,d/len));
    }
    travel=(travel+len)%spacing;
  }
  out.push(copy(path[path.length-1]));
  return out;
}
/** One pre-tied slip knot, WITHOUT any manufactured chain stitches. */
export function initialSlipKnot():{points:Vector[];crown:number;outlet:number}{
  const s=vec(-2.6,.2,.035);
  const shape=[
    vec(-3.8,-1.04,.07),vec(-3.4,-.70,.05),vec(-3.05,-.31,.025),
    vec(-2.83,.00,-.08),vec(-2.67,.08,-.11),
    // strand round the live aperture held by the crochet hook
    vec(-2.80,.35,-.09),vec(-2.68,.59,-.03),
    vec(-2.46,.58,.08),vec(-2.40,.31,.13),
    vec(-2.56,.04,.11),vec(-2.62,-.10,.14),
    // the working side of the same yarn emerges toward the skein
    vec(-2.22,-.23,.10),vec(-1.72,-.44,.12),
    vec(-1.20,-.56,.11),vec(-.65,-.73,.13),vec(-.08,-.92,.12),
    vec(.52,-1.12,.12),vec(1.14,-1.32,.13),vec(1.8,-1.45,.14),
    vec(2.48,-1.58,.14),vec(3.12,-1.72,.16),
    vec(3.75,-1.85,.14),vec(4.42,-1.95,.17),vec(5.05,-2.05,.18)
  ];
  const points=sampleSeed(shape);
  const nearest=(p:Vector)=>points.reduce((acc,q,i)=>stepLen(p,q)<stepLen(p,points[acc])?i:acc,0);
  return {points,crown:nearest(vec(-2.68,.59,-.03)),outlet:nearest(vec(-2.62,-.10,.14))};
}

type Pull={
  material:number;
  entry:Vector;
  start:Vector;
  progress:number;
  before:PhysicsSnapshot;
  oldLoop:number;
  restHook:Vector;
  support:[{index:number;point:Vector},{index:number;point:Vector}];
  caught:boolean;
  visitedBack:boolean;
  passedThrough:boolean;
};
export class PhysicalYarn{
  readonly spacing=SEGMENT;
  readonly radius=RADIUS;
  readonly maxCompleted=5;
  positions:Vector[]=[];
  previous:Vector[]=[];
  private rest:number[]=[];
  private bends:number[]=[];
  private fixedStart=0;
  private fixedEnd=0;
  private lastFreeze=0;
  private crown=0;
  private outlet=0;
  private stitches=0;
  private pull:Pull|null=null;
  private saved:PhysicsSnapshot[]=[];
  private contacts=0;
  private lastStrain=0;
  private hook:Vector=vec(-2.68,.58,.3);
  private heldLoop:Vector=vec(-2.68,.58,.3);
  private accumulated=0;
  constructor(){this.reset();}
  get completed(){return this.stitches;}
  get moving(){return this.pull!==null;}
  get contactCount(){return this.contacts;}
  get maxStrain(){return this.lastStrain;}
  get activeLoopIndex(){return this.crown;}
  get frame():PhysicsFrame{
    let phase:Phase='idle';
    const p=this.pull?.progress;
    if(p!==undefined)phase=p<CAPTURE_AT?'approach':p<DRAW_START?'catch':p<DRAW_END?'draw':'tighten';
    const index=this.pull?.caught?this.pull.material:null;
    const strand=index!==null?this.positions[index]:null;
    return {yarn:this.positions,hook:copy(this.hook),active:copy(this.positions[this.crown]),phase,
      completed:this.stitches,moving:!!this.pull,contacts:this.contacts,maxStrain:this.lastStrain,
      grasped:index!==null,graspIndex:index,
      graspDistance:strand?stepLen(this.hook,strand):null,
      passedThrough:this.pull?.passedThrough??false};
  }
  reset(){
    const knot=initialSlipKnot();
    this.positions=knot.points.map(copy);
    this.previous=knot.points.map(copy);
    this.rest=this.positions.slice(1).map((v,i)=>stepLen(v,this.positions[i]));
    this.bends=this.positions.slice(2).map((v,i)=>stepLen(v,this.positions[i]));
    this.fixedStart=0;this.fixedEnd=this.positions.length-1;
    this.crown=knot.crown;this.outlet=knot.outlet;
    this.lastFreeze=Math.max(1,knot.outlet-7);
    this.stitches=0;this.saved=[];this.pull=null;this.contacts=0;this.lastStrain=0;this.accumulated=0;
    this.heldLoop=copy(this.positions[this.crown]);
    this.hook=copy(this.heldLoop);
  }
  private snapshot():PhysicsSnapshot{
    return {positions:this.positions.map(copy),previous:this.previous.map(copy),
      active:this.crown,outlet:this.outlet,count:this.stitches,contactFreeze:this.lastFreeze,
      rest:[...this.rest],bends:[...this.bends],heldLoop:copy(this.heldLoop)};
  }
  private restore(s:PhysicsSnapshot){
    this.positions=s.positions.map(copy);this.previous=s.previous.map(copy);
    this.crown=s.active;this.outlet=s.outlet;this.stitches=s.count;this.lastFreeze=s.contactFreeze;
    this.rest=[...s.rest];this.bends=[...s.bends];this.fixedEnd=this.positions.length-1;
    this.heldLoop=copy(s.heldLoop);
    this.pull=null;this.hook=copy(this.heldLoop);
  }
  private aperture():Vector {
    // The *hole* lies between the arms of the LIVE loop, not on its crown.
    const l=this.positions[Math.max(0,this.crown-4)];
    const r=this.positions[Math.min(this.positions.length-1,this.crown+4)];
    return mix(l,r,.5);
  }
  /**
   * Physically pay out extra material from a loose winding hidden within
   * the skein instead of stretching the existing yarn to make a new loop.
   * The free-standing part of the rope keeps all its original material IDs.
   */
  private feedFromSkein(){
    const last=this.positions.length-1;
    const end=copy(this.positions[last]);
    const before=copy(this.positions[last-1]);
    const guide:Vector[]=[
      before,
      vec(4.98,-1.85,.09),vec(5.22,-1.82,.07),
      vec(5.34,-2.03,.07),vec(5.16,-2.24,.08),
      vec(4.92,-2.16,.07),vec(4.92,-1.97,.10),
      vec(5.14,-1.93,.10),end
    ];
    const extra=sampleSeed(guide).slice(1,-1);
    this.positions.splice(last,0,...extra.map(copy));
    this.previous.splice(last,0,...extra.map(copy));
    const replacement=[before,...extra,end];
    const newLengths=replacement.slice(1).map((p,i)=>stepLen(p,replacement[i]));
    this.rest.splice(last-1,1,...newLengths);
    this.bends=this.positions.slice(2).map((p,i)=>stepLen(p,this.positions[i]));
    this.fixedEnd=this.positions.length-1;
  }
  begin():boolean{
    if(this.pull||this.stitches>=this.maxCompleted)return false;
    // The hook catches a material point on the WORKING strand, rather than
    // selecting a fabricated path for the resulting loop.
    const material=Math.min(this.fixedEnd-18,this.outlet+Math.max(7,Math.round(.53/SEGMENT)));
    if(material<=this.outlet)return false;
    const entry=this.aperture();
    // The hook holds the loop ABOVE the tabletop, leaving an actual
    // passage underneath. The two loop arms move up under constraints.
    entry.z=Math.max(.19,entry.z);
    const start=copy(this.positions[material]);
    const before=this.snapshot();
    const rimLeft=Math.max(0,this.crown-4);
    const rimRight=Math.min(this.fixedEnd-1,this.crown+4);
    const support:[{index:number;point:Vector},{index:number;point:Vector}]=[
      {index:rimLeft,point:{...this.positions[rimLeft],z:Math.max(.15,this.positions[rimLeft].z)}},
      {index:rimRight,point:{...this.positions[rimRight],z:Math.max(.15,this.positions[rimRight].z)}}
    ];
    const restHook=copy(this.heldLoop);
    this.feedFromSkein();
    this.pull={material,entry,start,progress:0,before,oldLoop:this.crown,
      restHook,support,caught:false,visitedBack:false,passedThrough:false};
    this.hook=copy(restHook);
    return true;
  }
  setPullProgress(progress:number){
    if(!this.pull)return;
    this.pull.progress=clamp(progress);
  }
  /**
   * Commit ONLY after hook pulls the bight all the way through.
   * The same rope particles persist; the captured material vertex becomes
   * the new active loop and the old loop joins the finished chain.
   */
  complete():boolean{
    const p=this.pull;
    // A completed stroke is not automatically a stitch. The SAME captured
    // material must first travel behind the old loop and then through it.
    if(!p || p.progress<.999 || !p.caught || !p.passedThrough)return false;
    this.saved.push(p.before);
    this.stitches++;
    this.lastFreeze=Math.max(this.lastFreeze,p.oldLoop-4);
    this.crown=p.material;
    this.outlet=p.material+Math.max(4,Math.round(.32/SEGMENT));
    this.pull=null;
    this.heldLoop=copy(this.positions[this.crown]);
    this.hook=copy(this.heldLoop);
    return true;
  }
  unravel():boolean{
    if(this.pull){this.restore(this.pull.before);return true;}
    const old=this.saved.pop();
    if(!old)return false;
    this.restore(old);return true;
  }
  /**
   * 1/120-second substep. Inertial Verlet integration + XPBD distance and
   * bending + segment/segment collision + table and hook constraints.
   * Time is clamped by caller. Finished yarn is slowed by static table friction.
   */
  simulate(seconds=1/120){
    const dt=Math.min(1/45,Math.max(1/400,seconds));
    this.accumulated+=dt;
    const h=1/120;
    let passes=0;
    while(this.accumulated>=h&&passes<6){
      this.tick(h);this.accumulated-=h;passes++;
    }
    if(passes===6)this.accumulated=Math.min(this.accumulated,h);
  }
  private invMass(i:number){
    if(i===this.fixedStart||i===this.fixedEnd)return 0;
    // Work already laid on the table moves under moderate friction,
    // but cannot be completely teleport-fixed. The active area is light.
    return i <= this.lastFreeze ? .18 : 1;
  }
  private hookTarget(){
    if(!this.pull)return this.heldLoop;
    // During approach, aim at the LIVE working strand. It can move under
    // gravity/tension; aiming at the location from begin() would miss it.
    if(this.pull.progress<CAPTURE_AT)
      return hookTrack(this.pull.progress,this.positions[this.pull.material],
        this.pull.entry,this.pull.restHook);
    // Lock the grasp to the exact current material position at the moment
    // the hook reaches it. No hidden teleport to an earlier screenshot.
    if(!this.pull.caught)this.pull.start=copy(this.positions[this.pull.material]);
    return hookTrack(this.pull.progress,this.pull.start,this.pull.entry,this.pull.restHook);
  }
  private tick(dt:number){
    const n=this.positions.length;
    const target=this.hookTarget();
    const grip=!!this.pull && this.pull.progress>=CAPTURE_AT;
    const handle=grip?this.pull!.material:this.crown;
    const atRest=!this.pull;
    if(this.pull && grip)this.pull.caught=true;
    // Before yarn-over, move the hook only. The strand remains free.
    // Once attached, the exact same material particle follows the hook.
    this.hook=copy(target);
    // Apply previous-frame velocities; drag damps motion on a table.
    for(let i=1;i<n-1;i++){
      const p=this.positions[i],last=this.previous[i];
      const vx=(p.x-last.x)*.86,vy=(p.y-last.y)*.86,vz=(p.z-last.z)*.88;
      this.previous[i]=copy(p);
      const friction=i <= this.lastFreeze ? .72 : 1;
      p.x+=vx*friction;p.y+=vy*friction;
      p.z+=vz-.65*dt*dt;
    }
    const fixedFirst=copy(this.positions[this.fixedStart]);
    const fixedLast=copy(this.positions[this.fixedEnd]);
    const lambda=new Float64Array(this.rest.length);
    for(let iteration=0;iteration<12;iteration++){
      this.positions[0]=copy(fixedFirst);
      this.positions[n-1]=copy(fixedLast);
      // Hook contact/grasp is a genuinely kinematic boundary condition.
      const hold=this.positions[handle];
      if(grip || atRest){
        hold.x=target.x;hold.y=target.y;hold.z=target.z;
      }
      // Existing live loop stays supported while the new bight is pulled
      // through it. This is a temporary tool/hand anchor, not a new stitch.
      if(this.pull){
        // The old loop must stay OPEN until the bight has cleared it.
        // Pin two material points on opposing loop arms as temporary
        // tool/hand constraints. A pinch on the crown alone collapses the hole.
        const supportWeight=this.pull.progress<DRAW_END?.92:.15;
        for(const support of this.pull.support){
          const old=this.positions[support.index];
          if(support.index!==handle){
            old.x+=supportWeight*(support.point.x-old.x);
            old.y+=supportWeight*(support.point.y-old.y);
            old.z+=supportWeight*(support.point.z-old.z);
          }
        }
        const crown=this.positions[this.pull.oldLoop];
        if(this.pull.oldLoop!==handle&&this.pull.progress<DRAW_END){
          crown.x+=.45*(this.pull.restHook.x-crown.x);
          crown.y+=.45*(this.pull.restHook.y-crown.y);
          crown.z+=.45*(this.pull.restHook.z-crown.z);
        }
      }
      // XPBD stretch: C=|xi-xj|-L; lambda integrates within substep.
      for(let i=0;i<this.rest.length;i++){
        const a=this.positions[i],b=this.positions[i+1];
        const dist=stepLen(a,b);
        if(dist<1e-9)continue;
        const wi=i===handle?0:this.invMass(i);
        const wj=i+1===handle?0:this.invMass(i+1);
        const alpha=2e-8/(dt*dt);
        const denom=wi+wj+alpha;
        if(denom===0)continue;
        const C=dist-this.rest[i];
        const dLambda=(-C-alpha*lambda[i])/denom;
        lambda[i]+=dLambda;
        const nx=(b.x-a.x)/dist,ny=(b.y-a.y)/dist,nz=(b.z-a.z)/dist;
        a.x-=wi*dLambda*nx;a.y-=wi*dLambda*ny;a.z-=wi*dLambda*nz;
        b.x+=wj*dLambda*nx;b.y+=wj*dLambda*ny;b.z+=wj*dLambda*nz;
      }
      // Flexible bend radius regularisation; no hidden stitch target shapes.
      // This is a 2-point bending surrogate, not a Cosserat twist rod.
      for(let i=0;i<this.bends.length;i++){
        const a=this.positions[i],b=this.positions[i+2];
        const d=stepLen(a,b);if(d<1e-8)continue;
        const wa=i===handle?0:this.invMass(i),wb=i+2===handle?0:this.invMass(i+2);
        const c=d-this.bends[i];
        const correction=clamp(c*.075,-.012,.012)/(wa+wb+1e-8);
        const dx=(b.x-a.x)/d*correction,dy=(b.y-a.y)/d*correction,dz=(b.z-a.z)/d*correction;
        a.x+=wa*dx;a.y+=wa*dy;a.z+=wa*dz;
        b.x-=wb*dx;b.y-=wb*dy;b.z-=wb*dz;
      }
      for(let i=1;i<n-1;i++)if(this.positions[i].z<FLOOR+RADIUS){
        this.positions[i].z=FLOOR+RADIUS;
      }
      if(iteration===3||iteration===8)this.resolveEdgeContacts(handle);
    }
    this.positions[0]=fixedFirst;this.positions[n-1]=fixedLast;
    if(grip){
      // Rendering uses the actual grasp point, never an offset / decorative
      // hook trajectory that could visibly lose the yarn.
      const grabbed=this.positions[handle];
      this.hook=copy(grabbed);
      const relativeDepth=grabbed.z-this.pull!.entry.z;
      if(relativeDepth<-.10)this.pull!.visitedBack=true;
      if(this.pull!.visitedBack && relativeDepth>.13)this.pull!.passedThrough=true;
    }else if(atRest){
      this.hook=copy(this.positions[this.crown]);
    }
    let worst=0;
    for(let i=0;i<this.rest.length;i++){
      const e=Math.abs(stepLen(this.positions[i],this.positions[i+1])-this.rest[i])/Math.max(.001,this.rest[i]);
      if(e>worst)worst=e;
    }
    this.lastStrain=worst;
  }
  /** Closest pair of two 3D line segments, including interior crossings. */
  static nearestSegments(a:Vector,b:Vector,c:Vector,d:Vector):
    {s:number;t:number;distance:number;normal:Vector}{
    const u=vec(b.x-a.x,b.y-a.y,b.z-a.z);
    const v=vec(d.x-c.x,d.y-c.y,d.z-c.z);
    const w=vec(a.x-c.x,a.y-c.y,a.z-c.z);
    const uu=u.x*u.x+u.y*u.y+u.z*u.z;
    const vv=v.x*v.x+v.y*v.y+v.z*v.z;
    const uv=u.x*v.x+u.y*v.y+u.z*v.z;
    const uw=u.x*w.x+u.y*w.y+u.z*w.z;
    const vw=v.x*w.x+v.y*w.y+v.z*w.z;
    let s=0,t=0;
    const D=uu*vv-uv*uv;
    if(D>1e-9)s=clamp((uv*vw-vv*uw)/D);
    t=vv>1e-9?clamp((uv*s+vw)/vv):0;
    s=uu>1e-9?clamp((uv*t-uw)/uu):0;
    const x=vec(a.x+u.x*s-c.x-v.x*t,a.y+u.y*s-c.y-v.y*t,a.z+u.z*s-c.z-v.z*t);
    const distance=Math.hypot(x.x,x.y,x.z);
    return {s,t,distance,normal:distance>1e-8?mul(x,1/distance):vec(0,0,1)};
  }
  private resolveEdgeContacts(handle:number){
    const n=this.positions.length;
    let contacts=0;
    // Full edge-edge test, not endpoint-only contacts. n is deliberately
    // small (< 150) for this first constrained research experiment.
    const minDist=RADIUS*2;
    for(let i=0;i<n-1;i++){
      const a=this.positions[i],b=this.positions[i+1];
      for(let j=i+4;j<n-1;j++){
        const c=this.positions[j],d=this.positions[j+1];
        // Stored winding material inside the skein is allowed to overlap
        // because the solid skein hides it; once drawn out, contacts apply.
        if(i>this.lastFreeze && j>this.lastFreeze &&
          Math.hypot(a.x-5.05,a.y+2.05)<.65 &&
          Math.hypot(c.x-5.05,c.y+2.05)<.65)continue;
        if(Math.min(a.x,b.x)>Math.max(c.x,d.x)+minDist||
          Math.min(c.x,d.x)>Math.max(a.x,b.x)+minDist||
          Math.min(a.y,b.y)>Math.max(c.y,d.y)+minDist||
          Math.min(c.y,d.y)>Math.max(a.y,b.y)+minDist||
          Math.min(a.z,b.z)>Math.max(c.z,d.z)+minDist||
          Math.min(c.z,d.z)>Math.max(a.z,b.z)+minDist)continue;
        const hit=PhysicalYarn.nearestSegments(a,b,c,d);
        if(hit.distance>=minDist||hit.distance<1e-8)continue;
        const weights=[
          (i===handle?0:this.invMass(i))*(1-hit.s),
          (i+1===handle?0:this.invMass(i+1))*hit.s,
          (j===handle?0:this.invMass(j))*(1-hit.t),
          (j+1===handle?0:this.invMass(j+1))*hit.t
        ];
        const total=weights.reduce((x,y)=>x+y,0);
        if(total<1e-9)continue;
        contacts++;
        const depth=(minDist-hit.distance)/total*.78;
        const ids=[i,i+1,j,j+1];
        ids.forEach((idx,k)=>{
          const sign=k<2?1:-1;
          const p=this.positions[idx],w=weights[k];
          p.x+=hit.normal.x*depth*w*sign;
          p.y+=hit.normal.y*depth*w*sign;
          p.z+=hit.normal.z*depth*w*sign;
        });
      }
    }
    this.contacts=contacts;
  }
}
