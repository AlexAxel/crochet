/**
 * One crochet CHAIN action. This module is geometry/state, not pictures.
 *
 * Tail -> (slip knot) -> finished loop(s) -> active hook loop -> working yarn.
 * During the action the hook catches a bight of the SAME working strand and
 * transports it from BEHIND the old live loop, THROUGH its aperture, toward
 * the viewer. The old loop then tightens; the newly drawn bight becomes live.
 *
 * No sprites and no copy-pasted tube per key. The output is ONE ordered yarn
 * centreline, regenerated from the current action state each frame.
 *
 * EXPERIMENTAL: This is a kinematic model. It does not solve yarn friction,
 * yarn-yarn collision, force, elastic strain, or preserve global knot topology
 * as a mathematical invariant. Expert review is still REQUIRED.
 */
export type Vec3={x:number;y:number;z:number};
export type StrandState={
  finished:number;
  progress:number; // 0..1, one pending chain pull-through
};
export type StrandFrame={
  vertices:Vec3[]; // ordered from free tail to the skein
  hook:Vec3;
  passage:Vec3; // bight pulled through previous live loop
  priorLoop:Vec3;
  stage:'ready'|'approach'|'catch'|'pull'|'tighten';
  finished:number;
  lengthEstimate:number;
};
const v=(x:number,y:number,z:number):Vec3=>({x,y,z});
const clamp=(t:number)=>Math.max(0,Math.min(1,t));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const ease=(t:number)=>{const n=clamp(t);return n*n*(3-2*n);};
export const PITCH=.54;
export const FIRST_X=-3.0;
export const MAX_CHAINS=15;
export const WORK_Y=.45;
export const oldPosition=(i:number)=>v(FIRST_X+i*PITCH,WORK_Y,0);

function appendLoop(out:Vec3[],index:number,kind:'locked'|'live',tighten:number){
  const center=oldPosition(index), x=center.x, y=center.y;
  const width=(kind==='locked'?.158:.218)*(1-.13*tighten);
  const height=(kind==='locked'?.186:.27)*(1-.10*tighten);
  const z=kind==='locked'?.015:.075;
  // Enter a loop from below, rise around the left arm, round the crown,
  // exit along its right arm. Left strand is BEHIND right strand.
  out.push(
    v(x-width-.03,y-.20,z-.035),
    v(x-width,y-.025,z-.13),
    v(x-width*.83,y+height*.78,z-.145),
    v(x,y+height,z-.115),
    v(x+width*.83,y+height*.80,z+.115),
    v(x+width,y+.018,z+.155),
    v(x+width*.70,y-.16,z+.12),
    v(x+width+.045,y-.22,z+.025)
  );
}

function connectThroughOldLoop(out:Vec3[],parentIndex:number,swivel:number){
  const p=oldPosition(parentIndex);
  // This is a geometrical penetration of the old loop aperture from -z to
  // +z, not just drawing two overlapping 2D lines.
  out.push(
    v(p.x+.065,p.y+.045,-.245),
    v(p.x+.068,p.y+.047,lerp(-.245,.252,swivel))
  );
}

function addPartiallyPulledBight(out:Vec3[],n:number,p:number){
  const prior=oldPosition(n);
  const draw=ease((p-.22)/.73);
  const x=prior.x+PITCH*draw;
  const y=prior.y+.03;
  const z=lerp(-.29,.07,ease((p-.31)/.48));
  const w=.018+draw*.20;
  const h=.02+draw*.25;
  // The new loop is literally a bight on the working yarn; both legs join
  // the existing centreline, and its tip is carried by the moving hook.
  out.push(
    v(prior.x+.12,prior.y-.12,-.20),
    v(prior.x+.04,prior.y+.035,-.26),
    v(prior.x+.05,prior.y+.035,lerp(-.26,.28,ease((p-.37)/.42))),
    v(x-w,y-.06,z-.08),
    v(x-w,y+h*.6,z-.14),
    v(x,y+h,z-.09),
    v(x+w,y+h*.6,z+.11),
    v(x+w,y-.06,z+.15),
    v(x+w+.04,y-.17,z+.10)
  );
  return {tip:v(x,y+h,z+.20),pass:v(prior.x+.05,prior.y+.035,lerp(-.26,.28,ease((p-.37)/.42)))};
}

/**
 * Build one continuous current filament. Vertex order is physical yarn order.
 * During a chain insertion the bight changes z across the old-loop plane.
 */
export function strandFrame(input:StrandState):StrandFrame{
  const n=Math.min(MAX_CHAINS,Math.max(0,Math.floor(input.finished)));
  const p=clamp(input.progress);
  const pulling=p>.22&&p<1;
  const out:Vec3[]=[];
  const first=oldPosition(0);
  out.push(
    v(first.x-.83,first.y-.59,.025),
    v(first.x-.65,first.y-.38,.025),
    v(first.x-.43,first.y-.19,.055),
    v(first.x-.31,first.y-.13,-.04),
    v(first.x-.20,first.y-.18,.05)
  );
  for(let i=0;i<=n;i++){
    if(i>0)connectThroughOldLoop(out,i-1,1);
    appendLoop(out,i,i===n?'live':'locked',i===n?ease((p-.72)/.26):1);
  }
  const prior=oldPosition(n);
  let hook=v(prior.x,prior.y+.27,.36);
  let pass=v(prior.x+.05,prior.y+.035,-.26);
  if(pulling){
    const bight=addPartiallyPulledBight(out,n,p);
    hook=bight.tip;
    pass=bight.pass;
  }else if(p>=1){
    // A 100% frame is equivalent to the settled next chain; callers commit
    // it as finished+1. Both representations reference the same n+1 loop.
    const bight=addPartiallyPulledBight(out,n,.999999);
    hook=bight.tip;
    pass=bight.pass;
  }else if(p>0){
    // approach and yarn-over: hook moves to the strand without changing the
    // number of completed chain links.
    hook=v(prior.x+lerp(.48,.22,ease(p/.22)),prior.y+lerp(.62,.32,ease(p/.22)),.32);
  }
  const last=out[out.length-1];
  // The same continuous working strand travels from the loop to the skein.
  // The control points move as the new bight is pulled, rather than appending
  // a separate floating yarn mesh.
  out.push(
    v(last.x+.18,last.y-.20,.08),
    v(Math.max(last.x+.30,.9),-1.28,.17),
    v(4.28,-1.80,.18),
    v(5.12,-2.13,.30)
  );
  let distance=0;
  for(let i=1;i<out.length;i++){
    const a=out[i-1],b=out[i];
    distance+=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);
  }
  const stage:pStage = p===0?'ready':p<.22?'approach':p<.4?'catch':p<.78?'pull':'tighten';
  return {vertices:out,hook,passage:pass,priorLoop:prior,stage,finished:n,lengthEstimate:distance};
}
type pStage=StrandFrame['stage'];

/** State machine with deterministic cancel, commit, and unravel semantics. */
export class ChainMachine{
  private n=0;
  private progress=0;
  get count(){return this.n;}
  get isMoving(){return this.progress>0&&this.progress<1;}
  get frame(){return strandFrame({finished:this.n,progress:this.progress});}
  begin(){if(this.n>=MAX_CHAINS||this.isMoving)return false;this.progress=.000001;return true;}
  setProgress(t:number){this.progress=clamp(t);}
  finish(){
    if(this.progress<.999)return false;
    if(this.n>=MAX_CHAINS)return false;
    this.n++;this.progress=0;
    return true;
  }
  undo(){if(this.isMoving){this.progress=0;return true;}if(this.n>0){this.n--;this.progress=0;return true;}return false;}
  reset(){this.n=0;this.progress=0;}
}
