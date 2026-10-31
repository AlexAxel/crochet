/**
 * Deterministic crochet CHAIN prototype.
 *
 * Exactly one active loop is movable. Each finished link is frozen as an
 * immutable centreline, with explicit parent, entry and crossover points.
 * The yarn-over and pull-through are formed by moving the working strand,
 * NOT by revealing a pre-existing mesh. The new loop is then committed.
 *
 * The mechanism is deliberately guided rather than an unconstrained rope
 * simulation. Crochet-expert verification of the handedness, path and
 * under/over crossings remains required.
 */
export type V3={x:number;y:number;z:number};
export type Stitch={id:string;parent:string|null;center:V3;strand:readonly V3[];crossing:{behind:V3;front:V3}};
export type Phase='idle'|'approach'|'yarn-over'|'pull-through'|'tighten';
export type CrochetFrame={
  points:V3[];
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
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const blend=(a:V3,b:V3,t:number)=>p(lerp(a.x,b.x,t),lerp(a.y,b.y,t),lerp(a.z,b.z,t));
const smooth=(value:number)=>{const t=Math.min(1,Math.max(0,value));return t*t*(3-2*t)};
const cp=(v:V3)=>({...v});
export const CHAIN_SPACING=.47;
export const MAX_CHAIN_LINKS=14;
export const centerOf=(index:number):V3=>p(-3.65+index*CHAIN_SPACING,.35,.13);
export const copyPoint=cp;

/**
 * One continuous, open U-shaped loop of the working filament.
 * Front arm is above rear arm; the hole is not a solid ring.
 */
function loop(index:number,kind:'live'|'locked'):V3[]{
  const c=centerOf(index),w=kind==='live'?.235:.18,h=kind==='live'?.355:.267;
  const z=kind==='live'?.15:.11;
  return [
    p(c.x-w*.9,c.y-.19,z-.06),
    p(c.x-w*1.06,c.y-.03,z-.10),
    p(c.x-w*.92,c.y+h*.57,z-.12),
    p(c.x-w*.54,c.y+h*.9,z-.10),
    p(c.x,c.y+h,z-.06),
    p(c.x+w*.60,c.y+h*.88,z+.02),
    p(c.x+w*.95,c.y+h*.49,z+.11),
    p(c.x+w,c.y+.012,z+.15),
    p(c.x+w*.90,c.y-.18,z+.15),
    p(c.x+w*.38,c.y-.20,z+.16),
    p(c.x+w*.22,c.y-.10,z+.15),
    p(c.x+w*1.02,c.y-.15,z+.12)
  ];
}
function crossing(index:number){
  const c=centerOf(index);
  return {
    behind:p(c.x+.035,c.y+.02,-.105),
    front:p(c.x+.035,c.y+.02,.33)
  };
}
function connector(index:number,next:V3):V3[]{
  // The new strand makes an observable back-to-front traversal of the
  // existing live opening instead of merely touching its outside.
  const c=centerOf(index),cross=crossing(index);
  return [
    p(c.x+.17,c.y-.11,.22),
    p(c.x+.11,c.y-.10,-.12),
    cp(cross.behind),
    cp(cross.front),
    p(next.x-.17,next.y-.21,.28),
    cp(next)
  ];
}
export function frozenStitch(index:number):Stitch{
  const strand=loop(index,'locked');
  return {
    id:'ch'+(index+1),parent:index===0?null:'ch'+index,
    center:centerOf(index),
    strand:strand.map(cp),
    crossing:crossing(index)
  };
}
function animatedLoop(index:number,progress:number){
  const complete=loop(index,'live');
  const t=smooth((progress-.26)/.70);
  const origin=centerOf(index-1);
  const from=p(origin.x+.025,origin.y+.04,lerp(-.14,.32,smooth((progress-.38)/.31)));
  const shape=complete.map(x=>blend(from,x,t));
  return {shape,hook:cp(shape[4]),grasp:cp(shape[4])};
}
export function makeFrame(stitches:readonly Stitch[],progress:number|null):CrochetFrame{
  const n=stitches.length;
  const moving=progress!==null;
  const t=progress??0;
  const locked=stitches.flatMap(link=>link.strand.map(cp));
  // When a new stitch is being pulled, only the existing LIVE loop
  // tightens; all previously committed links are byte-for-byte stable.
  const compress=moving?smooth((t-.58)/.42):0;
  const stableLive=loop(n,'live'),oldLocked=loop(n,'locked');
  const live=stableLive.map((v,i)=>blend(v,oldLocked[i],compress));
  const path:V3[]=[
    p(-4.45,-.76,.075),p(-4.2,-.51,.08),
    p(-3.92,-.20,.10),p(-3.79,.12,.09)
  ];
  for(const link of stitches){
    path.push(...link.strand.map(cp));
    const next=link.id==='ch'+n?live[0]:loop(Number(link.id.slice(2)),'locked')[0];
    path.push(...connector(Number(link.id.slice(2))-1,next));
  }
  path.push(...live.map(cp));
  let phase:Phase='idle';
  let hook=cp(live[4]);
  let grasp:V3|null=null;
  let pending:V3[]|null=null;
  if(moving){
    phase=t<.18?'approach':t<.30?'yarn-over':t<.80?'pull-through':'tighten';
    const extra=animatedLoop(n+1,t);
    const catching=p(live[11].x+.07,live[11].y-.02,.13);
    if(t<.18){
      hook=blend(live[4],catching,smooth(t/.18));
    }else{
      hook=cp(extra.hook);
      grasp=cp(extra.grasp);
    }
    if(t>=.18){
      pending=extra.shape.map(cp);
      path.push(...connector(n,pending[0]),...pending.map(cp));
    }
  }
  const exit=pending?pending[pending.length-1]:live[live.length-1];
  // A floating, tautable connection to the skein. No solid "drawn-in"
  // new finished loops; the working section morphs while in motion.
  path.push(
    p(exit.x+.12,exit.y-.19,.22),
    p(Math.max(exit.x+.35,1),-1.15,.19),
    p(3.65,-1.72,.22),
    p(4.40,-1.89,.25),
    p(5.13,-2.05,.33)
  );
  return {points:path,completed:stitches,live,pending,hook,grasp,phase,count:n,progress:t};
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
    if(this.busy||this.count===MAX_CHAIN_LINKS)return false;
    this.pendingProgress=0;return true;
  }
  setProgress(t:number){
    if(this.pendingProgress!==null)this.pendingProgress=Math.min(1,Math.max(0,t));
  }
  finish():boolean{
    if(this.pendingProgress===null||this.pendingProgress<1)return false;
    this.links.push(frozenStitch(this.count));
    this.pendingProgress=null;return true;
  }
  unravel():boolean{
    if(this.busy){this.pendingProgress=null;return true;}
    if(!this.count)return false;
    this.links.pop();return true;
  }
  reset(){this.pendingProgress=null;this.links=[];}
}
