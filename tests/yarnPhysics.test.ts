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
 it('rejects a new stitch before the previous one completes',()=>{
   const r=new PhysicalYarn();
   expect(r.begin()).toBe(true);
   expect(r.begin()).toBe(false);
   expect(r.unravel()).toBe(true);
   expect(r.frame.moving).toBe(false);
 });
});
