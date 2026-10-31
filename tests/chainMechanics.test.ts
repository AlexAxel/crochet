import {describe,it,expect} from 'vitest';
import {ChainMachine,strandFrame,MAX_CHAINS,oldPosition} from '../src/core/chainMechanics';
describe('kinematic yarn pull-through, not sprite spawning',()=>{
 it('has a single ordered continuous filament connected to the skein at all stages',()=>{
  for(const p of [0,.05,.22,.3,.44,.55,.7,.88,.999]){
   const f=strandFrame({finished:3,progress:p});
   expect(f.vertices.length).toBeGreaterThan(20);
   expect(f.vertices.every(v=>Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z))).toBe(true);
   expect(f.vertices.at(-1)!.x).toBeCloseTo(5.12);
   expect(f.lengthEstimate).toBeGreaterThan(5);
  }
 });
 it('pulls a bight through the parent loop along the depth axis',()=>{
  const behind=strandFrame({finished:2,progress:.42});
  const inFront=strandFrame({finished:2,progress:.79});
  expect(behind.passage.z).toBeLessThan(0);
  expect(inFront.passage.z).toBeGreaterThan(0);
  const center=oldPosition(2);
  expect(Math.abs(behind.passage.x-center.x)).toBeLessThan(.14);
  expect(Math.abs(inFront.passage.y-center.y)).toBeLessThan(.15);
 });
 it('the hook point travels with the new bight, not an unrelated ornament',()=>{
  const frames=[.31,.49,.7,.91].map(progress=>strandFrame({finished:1,progress}));
  expect(frames[3].hook.x).toBeGreaterThan(frames[0].hook.x);
  expect(frames[3].hook.y).toBeGreaterThan(frames[0].hook.y);
 });
 it('finishes exactly one chain per completed pull-through; undo restores it',()=>{
  const m=new ChainMachine();
  expect(m.count).toBe(0);
  expect(m.begin()).toBe(true);
  m.setProgress(.7); expect(m.finish()).toBe(false);
  expect(m.count).toBe(0);
  m.setProgress(1); expect(m.finish()).toBe(true);
  expect(m.count).toBe(1);
  expect(m.undo()).toBe(true);expect(m.count).toBe(0);
 });
 it('does not exceed practical table capacity',()=>{
  const m=new ChainMachine();
  for(let i=0;i<MAX_CHAINS;i++){expect(m.begin()).toBe(true);m.setProgress(1);expect(m.finish()).toBe(true);}
  expect(m.begin()).toBe(false);
  expect(m.count).toBe(MAX_CHAINS);
 });
});
