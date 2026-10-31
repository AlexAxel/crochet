/**
 * CHAIN STITCH / foundation chain — reference-aligned geometry, revision 0.6.
 *
 * References:
 *  Craft Yarn Council: https://craftyarncouncil.com/mar06_crochet.html
 *  Annie's: https://www.anniesattic.com/stitch-guide/crochet-guide/crochet-how-tos/how-to-form-a-slip-knot-and-chain-stitch
 *  VeryPink Knits slow motion: https://www.youtube.com/watch?v=DOxxeaELAS4
 *
 * Facts:
 *  - Start with ONE slip knot/live loop on the hook; neither is counted as CH.
 *  - Working yarn is laid OVER hook back-to-front, then the hooked bight is
 *    pulled THROUGH the existing loop; a single live loop stays on the hook.
 *  - Finished chain shows successive V-shaped front loops, NOT stacked
 *    rings; the rear connecting strands pass underneath the front legs.
 *
 * Implementation deliberately uses a fixed crochet topology + keyframed
 * yarn movement, not uncontrolled rope physics. Expert review still needed
 * to confirm exact yarn crossings and handedness.
 */
export type V3={x:number;y:number;z:number};
export type Stitch={id:string;parent:string|null;center:V3;strand:readonly V3[];crossing:{behind:V3;front:V3}};
export type Phase='idle'|'approach'|'yarn-over'|'pull-through'|'tighten';
export type YarnSegment={role:'tail'|'back'|'front'|'active'|'working';points:V3[];stitchId?:string};
export type CrochetFrame={
  points:V3[]; // legacy inspection/compatibility; visualizers should use segments
  segments:YarnSegment[];
  completed:readonly Stitch[];
  live:V3[];
  pending:V3[]|null;
  hook:V3;
  grasp:V3|null;
  phase:Phase;
  count:number;
  progress:number;
};
const p=(x:number,y:number,z:number):V3=>({x,y,z});
const cp=(v:V3):V3=>({...v});
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const blend=(a:V3,b:V3,t:number):V3=>p(lerp(a.x,b.x,t),lerp(a.y,b.y,t),lerp(a.z,b.z,t));
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export const CHAIN_SPACING=.34;
export const MAX_CHAIN_LINKS=14;
const CHAIN_X=-.76;
const CHAIN_START_Y=-1.76;
export const centerOf=(index:number):V3=>p(CHAIN_X,CHAIN_START_Y+index*CHAIN_SPACING,.1);
export const copyPoint=cp;

/** Front of chain: one uninterrupted piece of yarn in the shape of a V. */
function frontV(index:number):V3[]{
  const c=centerOf(index);
  return [
    p(c.x-.18,c.y+.14,.10),
    p(c.x-.151,c.y+.075,.14),
    p(c.x-.092,c.y-.008,.18),
    p(c.x-.047,c.y-.087,.20),
    p(c.x,c.y-.124,.21),
    p(c.x+.048,c.y-.083,.20),
    p(c.x+.094,c.y-.005,.18),
    p(c.x+.150,c.y+.079,.14),
    p(c.x+.18,c.y+.14,.10)
  ];
}
/**
 * Only ONE live loop on the hook, an elongated inverted-U with two legs
 * descending towards the previous stitch. Unlike a finished V, this loop
 * is not counted. The hook sits THROUGH its upper opening.
 */
function liveU(index:number):V3[]{
  const c=centerOf(index);
  return [
    p(c.x-.195,c.y-.07,.12),
    p(c.x-.206,c.y+.075,.12),
    p(c.x-.19,c.y+.22,.12),
    p(c.x-.126,c.y+.32,.12),
    p(c.x-.053,c.y+.36,.16),
    p(c.x,c.y+.365,.18),
    p(c.x+.07,c.y+.36,.17),
    p(c.x+.149,c.y+.297,.17),
    p(c.x+.199,c.y+.20,.15),
    p(c.x+.208,c.y+.045,.15),
    p(c.x+.195,c.y-.075,.13)
  ];
}
function cross(index:number){
  const c=centerOf(index);
  return {behind:p(c.x,c.y+.195,-.13),front:p(c.x,c.y+.195,.19)};
}
export function frozenStitch(index:number):Stitch{
  return {
    id:'ch'+(index+1),parent:index===0?null:'ch'+index,
    center:centerOf(index),strand:frontV(index),
    crossing:cross(index)
  };
}
/**
 * Rear linking strand from right upper arm of one finished V to the lower
 * left leg of the next stitch. Three-dimensional depth gives the rear part
 * its actual ordering behind front V's — it is not a second painted loop.
 */
function backLink(from:V3,to:V3,index:number):V3[]{
  const c=centerOf(index);
  return [
    cp(from),
    p(from.x+.023,from.y+.044,.05),
    p(c.x+.105,c.y+.21,-.055),
    p(c.x+.012,c.y+.24,-.15),
    p(c.x-.12,c.y+.258,-.075),
    p(to.x-.023,to.y-.043,.03),
    cp(to)
  ];
}
function tailTo(point:V3):V3[]{
  return [
    p(-1.58,-2.80,.045),p(-1.43,-2.59,.05),
    p(-1.18,-2.34,.08),p(-.98,-2.03,.09),
    cp(point)
  ];
}
function workingToBall(point:V3):V3[]{
  return [
    cp(point),
    p(point.x+.22,point.y-.085,.22),
    p(point.x+.56,point.y-.22,.24),
    p(1.00,-.78,.18),
    p(2.5,-1.36,.16),
    p(3.87,-1.76,.21),
    p(4.57,-1.94,.24),
    p(5.13,-2.05,.33)
  ];
}
/**
 * Keyframed real crocheting motion:
 * 0–.19: hook approaches working strand; yarn stays in place;
 * .19–.34: yarn over; a new bight forms on the hook;
 * .34–.70: bight moves from rear of OLD loop to its FRONT, through opening;
 * .70–1: old live loop tightens to finished V, new U is drawn clear.
 *
 * Coordinates are guided, not force-driven. The vertex the hook holds is
 * the upper bend of the animated bight, so hook and yarn never separate.
 */
function activeBight(index:number,t:number,old:V3[]){
  const oldCenter=centerOf(index-1);
  const target=liveU(index);
  const start=p(old[10].x+.12,old[10].y+.06,.17);
  const entry=p(oldCenter.x,oldCenter.y+.22,-.19);
  const exit=p(oldCenter.x,oldCenter.y+.22,.31);
  let location:V3;
  if(t<.19)location=cp(start);
  else if(t<.34)location=blend(start,entry,smooth((t-.19)/.15));
  else if(t<.70)location=blend(entry,exit,smooth((t-.34)/.36));
  else location=blend(exit,target[5],smooth((t-.70)/.30));
  const spread=smooth((t-.57)/.43);
  const bight=target.map(v=>blend(location,v,spread));
  return {bight,hook:cp(bight[5]),grasp:cp(bight[5])};
}
export function makeFrame(stitches:readonly Stitch[],progress:number|null):CrochetFrame{
  const count=stitches.length;
  const t=progress??0;
  const moving=progress!==null;
  const oldLive=liveU(count);
  const compression=moving?smooth((t-.64)/.36):0;
  const finishV=frontV(count);
  const live=oldLive.map((v,i)=>blend(v,finishV[Math.min(i,finishV.length-1)],compression));
  const segments:YarnSegment[]=[];
  const append=(role:YarnSegment['role'],points:V3[],stitchId?:string)=>{
    segments.push({role,points:points.map(cp),...(stitchId?{stitchId}:{})});
  };
  const first=stitches.length>0?stitches[0].strand[0]:oldLive[0];
  append('tail',tailTo(first));
  for(let i=0;i<count;i++){
    const stitch=stitches[i];
    append('front',[...stitch.strand],stitch.id);
    const next=i===count-1?live[0]:stitches[i+1].strand[0];
    append('back',backLink(stitch.strand[stitch.strand.length-1],next,i),stitch.id);
  }
  append('active',live);
  let phase:Phase='idle';
  let hook=cp(oldLive[5]);
  let grasp:V3|null=null;
  let pending:V3[]|null=null;
  if(moving){
    phase=t<.19?'approach':t<.34?'yarn-over':t<.83?'pull-through':'tighten';
    const start=p(oldLive[10].x+.12,oldLive[10].y+.06,.17);
    hook=blend(oldLive[5],start,smooth(t/.19));
    if(t>=.19){
      const bight=activeBight(count+1,t,oldLive);
      pending=bight.bight;
      hook=bight.hook;grasp=bight.grasp;
      // The new strand extends directly out of the old loop through its
      // aperture; no instantaneous replacement of completed stitches.
      append('back',backLink(live[live.length-1],pending[0],count));
      append('active',pending);
    }
  }
  const workingEnd=pending?pending[pending.length-1]:live[live.length-1];
  append('working',workingToBall(workingEnd));
  return {
    points:segments.flatMap(s=>s.points.map(cp)),
    segments,completed:stitches,live,pending,hook,grasp,phase,count,progress:t
  };
}
export class StableCrochet{
  private links:Stitch[]=[];
  private pendingProgress:number|null=null;
  get count(){return this.links.length;}
  get busy(){return this.pendingProgress!==null;}
  get capacity(){return MAX_CHAIN_LINKS;}
  get stitches():readonly Stitch[]{return this.links;}
  get frame(){return makeFrame(this.links,this.pendingProgress);}
  begin():boolean{
    if(this.busy||this.count>=MAX_CHAIN_LINKS)return false;
    this.pendingProgress=0;
    return true;
  }
  setProgress(t:number){if(this.busy)this.pendingProgress=Math.max(0,Math.min(1,t));}
  finish():boolean{
    if(this.pendingProgress===null||this.pendingProgress<1)return false;
    this.links.push(frozenStitch(this.count));
    this.pendingProgress=null;
    return true;
  }
  unravel():boolean{
    if(this.busy){this.pendingProgress=null;return true;}
    return this.links.pop()!==undefined;
  }
  reset(){this.pendingProgress=null;this.links=[];}
}
