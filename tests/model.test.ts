import { describe, it, expect } from 'vitest';
import { apply, initialModel, replay, validateGraph, makeDemo } from '../src/core/model';
import { buildThread, validateLocalPassages } from '../src/core/geometry';

describe('crochet stitch graph / independent of rendering', () => {
  it('makes one continuous chain with previous-stitch references', () => {
    const m = replay(['chain', 'chain', 'chain']);
    expect(m.rows[0].map(s=>s.parents)).toEqual([[],['s1'],['s2']]);
    expect(validateGraph(m)).toEqual([]);
    expect(buildThread(m).points.length).toBeGreaterThan(20);
  });
  it('works into the SECOND chain from hook, leaving the first as turning height', () => {
    const m = replay([...Array(8).fill('chain'), 'turn', ...Array(7).fill('sc')]);
    expect(m.rows[1]).toHaveLength(7);
    expect(m.cursor).toBe(-1);
    expect(m.rows[1].map(s=>s.parents[0])).toEqual(m.rows[0].slice(0,-1).map(s=>s.id).reverse());
    expect(validateGraph(m)).toEqual([]);
  });
  it('creates two distinct stitch nodes on exactly one anchor when increasing', () => {
    const m = replay(['chain','chain','chain','turn','inc']);
    expect(m.rows[1]).toHaveLength(2);
    expect(m.rows[1][0].parents).toEqual(m.rows[1][1].parents);
    expect(m.cursor).toBe(0);
    expect(validateGraph(m)).toEqual([]);
  });
  it('decrease is one output node across TWO adjacent real loop parents', () => {
    const m = replay(['chain','chain','chain','chain','turn','dec']);
    expect(m.rows[1]).toHaveLength(1);
    expect(m.rows[1][0].kind).toBe('sc2tog');
    expect(m.rows[1][0].parents).toEqual(['s3','s2']);
    expect(m.rows[1][0].trace.filter(x=>x==='drawUpLoop')).toHaveLength(2);
    expect(m.cursor).toBe(0);
    expect(validateGraph(m)).toEqual([]);
    expect(validateLocalPassages(buildThread(m))).toEqual([]);
  });
  it('keeps mistakes (skipped loops) and allows undo through event log', () => {
    const log = ['chain','chain','chain','turn','skip','sc'] as const;
    const m = replay(log);
    expect(m.skipped).toEqual(['s2']);
    expect(m.cursor).toBe(-1);
    const undone = replay(log.slice(0,-1));
    expect(undone.rows[1]).toHaveLength(0);
    expect(undone.cursor).toBe(0);
  });
  it('rejects illegal operations without changing the graph', () => {
    const before = replay(['chain','chain','chain']);
    const after = apply(before,'sc');
    expect(after.error).not.toBeNull();
    expect(after.rows).toEqual(before.rows);
  });
  it('builds a multirow sample with unique stitches, parents and continuous yarn', () => {
    const m = replay(makeDemo());
    const errors = validateGraph(m);
    expect(errors).toEqual([]);
    expect(m.rows).toHaveLength(4);
    const yarn = buildThread(m);
    expect(yarn.segments).toHaveLength(m.rows.flat().length + m.turningChains.length);
    expect(yarn.passages).toHaveLength(13 + 13 + 8);
    expect(m.turningChains).toHaveLength(2);
    expect(yarn.segments).toHaveLength(m.rows.flat().length + 2);
    expect(validateLocalPassages(yarn)).toEqual([]);
    expect(yarn.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z))).toBe(true);
    expect(yarn.segments.every((s,i)=>!i || s.start > yarn.segments[i-1].end)).toBe(true);
  });
});

describe('standard teaching chain semantics', () => {
  it('cannot work into the first foundation chain next to the hook', () => {
    const m=replay(['chain','chain','chain','chain','turn','sc','sc','sc']);
    expect(m.rows[1].map(stitch=>stitch.parents[0])).toEqual(['s3','s2','s1']);
    expect(m.cursor).toBe(-1);
    expect(validateGraph(m)).toEqual([]);
  });
  it('adds a distinct turning-chain operation after the first SC row', () => {
    const m=replay(['chain','chain','chain','turn','sc','sc','turn']);
    expect(m.turningChains).toHaveLength(1);
    expect(m.turningChains[0].parents).toEqual([m.rows[1][1].id]);
    expect(m.rows[2]).toHaveLength(0);
    expect(m.cursor).toBe(1);
    expect(validateGraph(m)).toEqual([]);
    expect(buildThread(m).segments.at(-1)?.stitch.id).toBe(m.turningChains[0].id);
  });
});
