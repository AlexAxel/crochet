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
   if(i)expect(s.center.y-m.stitches[i-1].center.y).toBeCloseTo(CHAIN_SPACING);
   expect(s.crossing.behind.z).toBeLessThan(s.crossing.front.z);
  }
 });
 it('moving loop grows by changing yarn geometry, not revealing a sprite',()=>{
  const m=new StableCrochet();m.begin();
  m.setProgress(.37);const a=m.frame;
  m.setProgress(.75);const b=m.frame;
  expect(a.pending).not.toBeNull();
  expect(b.pending).not.toBeNull();
  expect(Math.hypot(a.pending![4].x-b.pending![4].x,
    a.pending![4].y-b.pending![4].y,
    a.pending![4].z-b.pending![4].z)).toBeGreaterThan(.12);
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

 it('starts with just a slip-knot/live U on hook, not a fake first finished ring',()=>{
  const m=new StableCrochet();
  const f=m.frame;
  expect(m.count).toBe(0);
  expect(f.completed).toHaveLength(0);
  expect(f.live[0].y).toBeLessThan(f.live[5].y);
  expect(f.live[f.live.length-1].y).toBeLessThan(f.live[5].y);
  expect(f.segments.some(x=>x.role==='front')).toBe(false);
  expect(f.segments.some(x=>x.role==='tail')).toBe(true);
  expect(f.hook).toEqual(f.live[5]);
 });
 it('front chain is a vertical sequence of downward Vs and not closed circles',()=>{
  const m=new StableCrochet();
  for(let k=0;k<10;k++){m.begin();m.setProgress(1);m.finish();}
  for(const link of m.stitches){
   const strand=link.strand;
   const bottom=strand[Math.floor(strand.length/2)];
   expect(bottom.y).toBeLessThan(strand[0].y-.18);
   expect(bottom.y).toBeLessThan(strand.at(-1)!.y-.18);
   expect(strand[0].x).toBeLessThan(bottom.x);
   expect(strand.at(-1)!.x).toBeGreaterThan(bottom.x);
   expect(strand[0]).not.toEqual(strand.at(-1)!);
  }
  expect(m.frame.segments.filter(x=>x.role==='front')).toHaveLength(10);
  expect(m.frame.segments.filter(x=>x.role==='back')).toHaveLength(10);
  expect(m.frame.segments.filter(x=>x.role==='active')).toHaveLength(1);
 });
 it('all yarn segments have finite positions and meet adjoining sections at exact endpoints',()=>{
  const m=new StableCrochet();
  for(let i=0;i<5;i++){m.begin();m.setProgress(1);m.finish();}
  for(const t of [null,0,.18,.30,.53,.76,.92,1] as const){
    const f=t===null?m.frame:makeFrame(m.stitches,t);
    for(const segment of f.segments){
      expect(segment.points.length).toBeGreaterThan(1);
      expect(segment.points.every(v=>Object.values(v).every(Number.isFinite))).toBe(true);
    }
    for(let i=0;i<f.segments.length-1;i++){
      const a=f.segments[i].points.at(-1)!;
      const b=f.segments[i+1].points[0];
      expect(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)).toBeLessThan(.000001);
    }
  }
 });
 it('the active loop is excluded from stitch count even after ten commits',()=>{
  const m=new StableCrochet();
  for(let i=0;i<10;i++){m.begin();m.setProgress(1);m.finish();}
  expect(m.frame.count).toBe(10);
  expect(m.frame.completed).toHaveLength(10);
  expect(m.frame.segments.filter(x=>x.role==='active')).toHaveLength(1);
 });
 it('supports at least ten stitches and has a deterministic capacity',()=>{
  const m=new StableCrochet();
  for(let i=0;i<MAX_CHAIN_LINKS;i++){expect(m.begin()).toBe(true);m.setProgress(1);expect(m.finish()).toBe(true);}
  expect(m.begin()).toBe(false);
 });
});
