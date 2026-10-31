import {describe,it,expect} from 'vitest';
import {PhysicalYarn} from '../src/core/yarnPhysics';
import {inspectionPoint} from '../src/render/inspectionPoint';

describe('hide hook / physical grasp inspection mode',()=>{
  it('shows no diagnostic marker while the 3D hook is visible',()=>{
    const yarn=new PhysicalYarn();
    expect(inspectionPoint(yarn.frame,true)).toBeNull();
    expect(yarn.begin()).toBe(true);
    yarn.setPullProgress(.40);
    for(let i=0;i<12;i++)yarn.simulate(1/120);
    expect(yarn.frame.grasped).toBe(true);
    expect(inspectionPoint(yarn.frame,true)).toBeNull();
  });
  it('shows the existing active loop when idle with the hook hidden',()=>{
    const yarn=new PhysicalYarn();
    const marker=inspectionPoint(yarn.frame,false);
    expect(marker).toEqual(yarn.positions[yarn.activeLoopIndex]);
  });
  it('never pretends the hook has grasped yarn during approach',()=>{
    const yarn=new PhysicalYarn();
    expect(yarn.begin()).toBe(true);
    yarn.setPullProgress(.11);
    for(let i=0;i<8;i++)yarn.simulate(1/120);
    expect(yarn.frame.grasped).toBe(false);
    expect(inspectionPoint(yarn.frame,false)).toBeNull();
  });
  it('tracks the exact physical material vertex after capture, without editing yarn state',()=>{
    const yarn=new PhysicalYarn();
    expect(yarn.begin()).toBe(true);
    yarn.setPullProgress(.32);
    for(let i=0;i<12;i++)yarn.simulate(1/120);
    const frame=yarn.frame;
    expect(frame.grasped).toBe(true);
    const original=frame.yarn.map(p=>({...p}));
    const marker=inspectionPoint(frame,false);
    expect(marker).toBe(frame.yarn[frame.graspIndex!]);
    expect(frame.yarn).toEqual(original);
    const markerZ=marker!.z;
    yarn.setPullProgress(.70);
    for(let i=0;i<12;i++)yarn.simulate(1/120);
    const moved=inspectionPoint(yarn.frame,false)!;
    expect(moved).toBe(yarn.positions[yarn.frame.graspIndex!]);
    expect(Math.abs(moved.z-markerZ)).toBeGreaterThan(.08);
  });
});
