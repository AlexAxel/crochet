import {describe,it,expect} from 'vitest';
import {StableCrochet,makeFrame,CHAIN_SPACING,MAX_CHAIN_LINKS} from '../src/core/stableChain';

describe('frozen, inspectable crocheted chain',()=>{
 it('a click alone does not commit: require finished yarn-over and pull-through',()=>{
  const m=new StableCrochet();
  expect(m.begin()).toBe(true);
  m.setProgress(.5);expect(m.finish()).toBe(false);
  expect(m.count).toBe(0);
  expect(m.frame.phase).toBe('pull-through');
  m.setProgress(1);expect(m.finish()).toBe(true);
  expect(m.count).toBe(1);
 });
 it('10 air chains remain present and frozen during every later stitch',()=>{
  const m=new StableCrochet();
  let first:unknown=null;
  for(let i=0;i<10;i++){
   expect(m.begin()).toBe(true);
   for(const t of [0,.18,.33,.55,.79,.98,1]){
    m.setProgress(t);
    expect(m.frame.completed).toHaveLength(i);
    if(i>0)expect(m.frame.completed[0]).toEqual(first);
    expect(m.frame.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z))).toBe(true);
   }
   expect(m.finish()).toBe(true);
   if(i===0)first=structuredClone(m.stitches[0]);
  }
  expect(m.stitches).toHaveLength(10);
  expect(new Set(m.stitches.map(s=>s.id)).size).toBe(10);
  expect(m.stitches[9].parent).toBe('ch9');
  expect(m.stitches[0]).toEqual(first);
 });
 it('each complete chain is spatially distinct and linked through an opening',()=>{
  const m=new StableCrochet();
  for(let i=0;i<10;i++){m.begin();m.setProgress(1);m.finish();}
  for(let i=0;i<10;i++){
   const s=m.stitches[i];
   expect(s.strand.length).toBeGreaterThan(8);
   if(i)expect(s.center.x-m.stitches[i-1].center.x).toBeCloseTo(CHAIN_SPACING);
   expect(s.crossing.behind.z).toBeLessThan(s.crossing.front.z);
  }
 });
 it('moving loop grows by changing yarn geometry, not revealing a sprite',()=>{
  const m=new StableCrochet();m.begin();
  m.setProgress(.37);const a=m.frame;
  m.setProgress(.75);const b=m.frame;
  expect(a.pending).not.toBeNull();
  expect(b.pending).not.toBeNull();
  expect(a.pending![4].x).not.toBeCloseTo(b.pending![4].x);
  expect(a.grasp).toEqual(a.hook);
  expect(b.grasp).toEqual(b.hook);
 });
 it('unravel removes exactly one committed link and resets unfinished work',()=>{
  const m=new StableCrochet();
  for(let i=0;i<4;i++){m.begin();m.setProgress(1);m.finish();}
  expect(m.unravel()).toBe(true);expect(m.count).toBe(3);
  m.begin();m.setProgress(.9);
  expect(m.unravel()).toBe(true);expect(m.busy).toBe(false);expect(m.count).toBe(3);
  m.reset();expect(m.count).toBe(0);
 });
 it('supports at least ten stitches and has a deterministic capacity',()=>{
  const m=new StableCrochet();
  for(let i=0;i<MAX_CHAIN_LINKS;i++){expect(m.begin()).toBe(true);m.setProgress(1);expect(m.finish()).toBe(true);}
  expect(m.begin()).toBe(false);
 });
});
