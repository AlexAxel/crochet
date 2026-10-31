import {describe,it,expect} from 'vitest';
import {PhysicalYarn,SEGMENT,initialSlipKnot} from '../src/core/yarnPhysics';

describe('physical yarn: fixed segment lengths and real contact solver',()=>{
 it('starts with a single pre-tied slip loop and >70 material points',()=>{
   const seed=initialSlipKnot();
   expect(seed.points.length).toBeGreaterThan(75);
   const rope=new PhysicalYarn();
   expect(rope.completed).toBe(0);
   expect(rope.frame.yarn.length).toBe(seed.points.length);
 });
 it('produces a real XPBD relaxation without teleporting the strand vertices',()=>{
   const r=new PhysicalYarn();
   const initial=r.positions.map(v=>({...v}));
   for(let i=0;i<35;i++)r.simulate(1/120);
   expect(r.frame.yarn).toHaveLength(initial.length);
   expect(r.positions.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z))).toBe(true);
   expect(r.frame.maxStrain).toBeLessThan(1.2);
 });
 it('uses one existing material vertex as the hook grasp and pulls it through old loop in z',()=>{
   const r=new PhysicalYarn();
   expect(r.begin()).toBe(true);
   r.setPullProgress(.35);
   for(let i=0;i<20;i++)r.simulate(1/120);
   const behind=r.frame.hook.z;
   r.setPullProgress(.68);
   for(let i=0;i<20;i++)r.simulate(1/120);
   expect(r.frame.hook.z).toBeGreaterThan(behind+.2);
   expect(r.frame.moving).toBe(true);
   expect(r.frame.yarn.length).toBeGreaterThan(70);
 });
 it('commits only a completed pull and undo restores the exact particle snapshot',()=>{
   const r=new PhysicalYarn();
   const saved=r.positions.map(p=>({...p}));
   expect(r.begin()).toBe(true);
   r.setPullProgress(.8);
   expect(r.complete()).toBe(false);
   // It is not enough to animate straight to the end: a real bight
   // must attach to the hook and traverse both sides of the loop.
   r.setPullProgress(.35);
   for(let i=0;i<20;i++)r.simulate(1/120);
   r.setPullProgress(.78);
   for(let i=0;i<20;i++)r.simulate(1/120);
   expect(r.frame.passedThrough).toBe(true);
   r.setPullProgress(1);
   for(let i=0;i<30;i++)r.simulate(1/120);
   expect(r.complete()).toBe(true);
   expect(r.completed).toBe(1);
   expect(r.unravel()).toBe(true);
   expect(r.completed).toBe(0);
   expect(r.positions).toEqual(saved);
 });
 it('uses interior edge-edge nearest positions for yarn contacts',()=>{
   const hit=PhysicalYarn.nearestSegments(
     {x:-1,y:0,z:0},{x:1,y:0,z:0},
     {x:0,y:-1,z:.03},{x:0,y:1,z:.03}
   );
   expect(hit.distance).toBeCloseTo(.03,4);
   expect(hit.s).toBeCloseTo(.5);
   expect(hit.t).toBeCloseTo(.5);
 });
 it('pays out additional filament from skein instead of lengthening existing segments',()=>{
   const r=new PhysicalYarn();
   const source=r.positions.map(p=>({...p}));
   const length=(ps:typeof source)=>ps.slice(1).reduce((acc,p,i)=>acc+
     Math.hypot(p.x-ps[i].x,p.y-ps[i].y,p.z-ps[i].z),0);
   const before=length(source);
   expect(r.begin()).toBe(true);
   expect(r.positions.length).toBeGreaterThan(source.length);
   expect(length(r.positions)).toBeGreaterThan(before+.45);
   expect(r.positions.slice(0,source.length-1)).toEqual(source.slice(0,-1));
   expect(r.unravel()).toBe(true);
   expect(r.positions).toEqual(source);
   expect(length(r.positions)).toBeCloseTo(before,6);
 });
 it('forms successive chains by moving the same physical rope rather than recreating it',()=>{
   const physics=new PhysicalYarn();
   for(let round=0;round<2;round++){
     expect(physics.begin()).toBe(true);
     const len=physics.positions.length;
     const trace: unknown[]=[];
     for(let phase=0;phase<=20;phase++){
       physics.setPullProgress(phase/20);
       for(let j=0;j<3;j++)physics.simulate(1/120);
       if(phase%3===0)trace.push({p:phase/20,z:+physics.frame.hook.z.toFixed(3),g:physics.frame.grasped,
         pass:physics.frame.passedThrough,graspIndex:physics.frame.graspIndex,
         cap:physics.frame.graspDistance});
     }
     expect(physics.positions).toHaveLength(len);
     expect(physics.positions.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z))).toBe(true);
     if(!physics.complete())throw new Error('Round '+round+' hook trace '+JSON.stringify(trace));
     expect(physics.completed).toBe(round+1);
   }
   expect(physics.unravel()).toBe(true);
   expect(physics.completed).toBe(1);
 });
 it('the hook cannot drag working yarn before physical capture',()=>{
    const r=new PhysicalYarn();
    expect(r.begin()).toBe(true);
    r.setPullProgress(.12);
    for(let i=0;i<6;i++)r.simulate(1/120);
    expect(r.frame.grasped).toBe(false);
    expect(r.frame.graspDistance).toBeNull();
    expect(r.complete()).toBe(false);
    r.setPullProgress(.26);
    for(let i=0;i<10;i++)r.simulate(1/120);
    expect(r.frame.grasped).toBe(true);
    expect(r.frame.graspIndex).not.toBeNull();
    expect(r.frame.graspDistance).toBeLessThan(.001);
    const material=r.frame.graspIndex!;
    const p=r.positions[material];
    expect(Math.hypot(r.frame.hook.x-p.x,r.frame.hook.y-p.y,r.frame.hook.z-p.z)).toBeLessThan(.001);
 });
 it('no stitch may be committed until captured yarn genuinely crosses the live aperture',()=>{
    const r=new PhysicalYarn();
    expect(r.begin()).toBe(true);
    r.setPullProgress(1);
    for(let i=0;i<15;i++)r.simulate(1/120);
    // Skipping the behind-the-loop phase cannot create a chain.
    expect(r.frame.passedThrough).toBe(false);
    expect(r.complete()).toBe(false);
    expect(r.unravel()).toBe(true);
    expect(r.completed).toBe(0);
    expect(r.begin()).toBe(true);
    for(const p of [.26,.35,.46,.58,.78,1]){
      r.setPullProgress(p);
      for(let i=0;i<12;i++)r.simulate(1/120);
    }
    expect(r.frame.grasped).toBe(true);
    expect(r.frame.passedThrough).toBe(true);
    expect(r.complete()).toBe(true);
    expect(r.completed).toBe(1);
 });
 it('rejects a new stitch before the previous one completes',()=>{
   const r=new PhysicalYarn();
   expect(r.begin()).toBe(true);
   expect(r.begin()).toBe(false);
   expect(r.unravel()).toBe(true);
   expect(r.frame.moving).toBe(false);
 });
});
