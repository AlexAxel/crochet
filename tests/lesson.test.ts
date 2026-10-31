import {describe,it,expect} from 'vitest';
import {lessonFor,studyDiagram} from '../src/learn/lesson';
import {initialModel,replay} from '../src/core/model';
describe('expert teaching stages',()=>{
 it('chain has 4 stages and one live loop',()=>{
  const steps=lessonFor('chain',initialModel()).steps;
  expect(steps.map(s=>s.phase)).toEqual(['start','over','pull','finish']);
  expect(steps.map(s=>s.hooks)).toEqual([1,1,1,1]);
 });
 it('SC models 1→2→1 loop count and second foundation chain',()=>{
  const steps=lessonFor('sc',replay(['chain','chain','chain','turn'])).steps;
  expect(steps.map(s=>s.hooks)).toEqual([1,1,2,2,1]);
  expect(steps[0].detail).toContain('вторую');
 });
 it('increase repeats SC and SC2TOG works on two parents',()=>{
  const m=replay(['chain','chain','chain','chain','turn']);
  expect(lessonFor('inc',m).steps).toHaveLength(10);
  expect(lessonFor('dec',m).steps.map(s=>s.hooks)).toEqual([1,2,2,3,1]);
 });
 it('macro schematic renders hook, live loop and working yarn',()=>{
  const lesson=lessonFor('chain',initialModel());
  const markup=studyDiagram('chain',lesson.steps[2],2,4,2);
  expect(markup).toContain('<svg');
  expect(markup).toContain('Бежевый');
  expect(markup).toContain('Бирюзовый');
 });
});
