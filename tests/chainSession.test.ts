import {describe,it,expect} from 'vitest';
import {ChainSession,LIMIT} from '../src/core/chainSession';

describe('real chain workflow',()=>{
 it('starts with slip knot / one working loop, not a finished chain',()=>{
  const m=new ChainSession();
  expect(m.frame.activeLoops).toBe(1);
  expect(m.frame.completed).toBe(0);
  expect(m.frame.stitches).toHaveLength(0);
  expect(m.frame.stage).toBe('rest');
 });
 it('one click performs complete yarn over and pull through before committing',()=>{
  const m=new ChainSession();
  expect(m.press()).toBe(true);
  m.advance(220);expect(m.frame.stage).toBe('approach');
  m.advance(220);expect(m.frame.stage).toBe('yarn-over');
  m.advance(500);expect(m.frame.stage).toBe('draw-through');
  expect(m.count).toBe(0);
  m.advance(610);expect(m.count).toBe(1);
  expect(m.frame.stage).toBe('rest');
  expect(m.frame.activeLoops).toBe(1);
 });
 it('rapid presses queue and make twenty non-destructive stitches',()=>{
  const m=new ChainSession();
  for(let i=0;i<LIMIT;i++)expect(m.press()).toBe(true);
  expect(m.press()).toBe(false);
  expect(m.queued).toBe(LIMIT-1);
  let done=0;
  for(let i=0;i<100;i++)done+=m.advance(320);
  expect(done).toBe(LIMIT);
  expect(m.frame.completed).toBe(LIMIT);
  expect(m.frame.stitches.map(x=>x.number)).toEqual(Array.from({length:LIMIT},(_,i)=>i+1));
  expect(m.frame.stitches[0]).toEqual({kind:'ch',number:1,previous:null});
  expect(m.frame.stitches[LIMIT-1].previous).toBe(LIMIT-1);
  expect(m.frame.activeLoops).toBe(1);
 });
 it('can undo a working operation without destroying prior links',()=>{
  const m=new ChainSession();m.press();m.advance(1600);m.press();m.advance(500);
  expect(m.undo()).toBe(true);
  expect(m.count).toBe(1);expect(m.busy).toBe(false);
  expect(m.undo()).toBe(true);expect(m.count).toBe(0);
  expect(m.undo()).toBe(false);
 });
 it('reset clears queue, work and history, retains one live loop',()=>{
  const m=new ChainSession();m.press();m.press();m.advance(1600);
  m.reset();
  expect(m.count).toBe(0);expect(m.queued).toBe(0);
  expect(m.frame.activeLoops).toBe(1);
  expect(m.frame.drawing).toBe(false);
 });
 it('holds completed links frozen while next bight is being drawn',()=>{
  const m=new ChainSession();m.press();m.advance(1600);
  const first=m.frame.stitches[0];
  m.press();
  for(let i=0;i<12;i++){
    m.advance(90);
    expect(m.frame.stitches[0]).toBe(first);
    expect(m.frame.completed).toBe(1);
  }
 });
});
