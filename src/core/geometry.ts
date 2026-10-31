import type { Model, Stitch } from './model';

export type P3 = { x: number; y: number; z: number };
export type ThreadGeometry = {
  points: P3[];
  positionById: Map<string, P3>;
  segments: { stitch: Stitch; start: number; end: number }[];
  passages: { childId: string; parentId: string; behind: number; inFront: number }[];
  tip: P3;
  width: number;
  height: number;
};
const P = (x: number, y: number, z: number): P3 => ({ x, y, z });
const copy = (p: P3): P3 => ({ ...p });

/**
 * Deterministic center mapping. The two SC stitches of an increase are
 * separate children of one parent, while a decrease shares two parents.
 * This forms a usable physical stitch graph rather than uniform decoration.
 */
export function stitchCenters(model: Model): Map<string, P3> {
  const result = new Map<string, P3>();
  const base = model.rows[0];
  const pitch = .52;
  base.forEach((s, i) => result.set(s.id, P((i - (base.length - 1) / 2) * pitch, -.58, 0)));

  for (let row = 1; row < model.rows.length; row++) {
    const stitches = model.rows[row];
    const groups = new Map<string, Stitch[]>();
    for (const stitch of stitches) {
      const key = stitch.parents.join('|');
      const same = groups.get(key) ?? [];
      same.push(stitch);
      groups.set(key, same);
    }
    for (const stitch of stitches) {
      const anchors = stitch.parents.map(id => result.get(id)).filter((p): p is P3 => !!p);
      const cx = anchors.reduce((sum, p) => sum + p.x, 0) / Math.max(1, anchors.length);
      const group = groups.get(stitch.parents.join('|')) ?? [stitch];
      const shift = (group.indexOf(stitch) - (group.length - 1) / 2) * .24;
      const direction = row % 2 ? -1 : 1;
      result.set(stitch.id, P(cx + shift * direction, -.58 + row * .46, 0));
    }
  }
  for (const turn of model.turningChains) {
    const parent = result.get(turn.parents[0]);
    if (parent) result.set(turn.id,P(parent.x,parent.y+.29,.05));
  }
  return result;
}

function chainPath(center: P3): P3[] {
  const { x, y } = center;
  // A chain is a small complete oval whose next strand pulls through it.
  return [
    P(x - .26,y - .045,.07), P(x - .17,y - .14,.1),
    P(x - .22,y + .12,.19), P(x - .09,y + .21,.23),
    P(x + .1,y + .2,.12), P(x + .19,y + .095,-.12),
    P(x + .03,y - .1,-.13), P(x - .05,y - .15,.18),
    P(x + .25,y - .045,.12),
  ];
}

/**
 * Stylised geometrical choreography of a single crochet:
 * - travel through the selected parent loop (negative to positive z);
 * - draw up the working loop;
 * - yarn over and pull through two hook loops;
 * - exit to the next stitch.
 *
 * This is a visual approximation of the finished stitch, not a physically
 * solved elastic filament. All references to parent loops are explicit.
 */
function scPath(center: P3, parent: P3, row: number): P3[] {
  const d = row % 2 ? -1 : 1;
  const { x, y } = center;
  const ax = parent.x;
  const ay = parent.y;
  return [
    P(x - d * .27, y - .085,.13),
    P(ax - d * .14,ay + .27,.06),
    P(ax - d * .09,ay + .13,-.23),
    P(ax + d * .015,ay + .115,.24),
    P(x - d * .13,y + .19,.29),
    P(x - d * .19,y + .32,.22),
    P(x - d * .13,y + .365,.13),
    P(x + d * .015,y + .245,.12),
    P(x + d * .075,y + .04,-.1),
    P(x + d * .17,y + .155,-.12),
    P(x + d * .025,y + .375,.28),
    P(x + d * .16,y + .345,.23),
    P(x + d * .24,y + .09,.25),
    P(x + d * .27,y - .085,.13),
  ];
}

function decreasePath(center: P3, a: P3, b: P3, row: number): P3[] {
  const d = row % 2 ? -1 : 1;
  const { x,y } = center;
  const pts: P3[] = [P(x - d * .29,y - .085,.14)];
  // Two base insertions, two drawn-up loops, one last yarn-over through three.
  for (const [i, anchor] of [a,b].entries()) {
    const ax = anchor.x, ay = anchor.y;
    pts.push(P(ax - d * .1, ay + .24,.08));
    pts.push(P(ax - d * .07, ay + .12,-.2));
    pts.push(P(ax + d * .02, ay + .12,.24));
    pts.push(P(x + d * (i ? .03 : -.12),y + .21,.28));
    pts.push(P(x + d * (i ? .12 : -.04),y + .29,.15));
  }
  pts.push(P(x - d * .07,y + .37,.25));
  pts.push(P(x + d * .18,y + .35,.24));
  pts.push(P(x + d * .25,y + .06,.23));
  pts.push(P(x + d * .29,y - .085,.14));
  return pts;
}

/** Generate one continuous polyline, laid down in the true execution order. */
export function buildThread(model: Model): ThreadGeometry {
  const positions = stitchCenters(model);
  const points: P3[] = [];
  const segments: ThreadGeometry['segments'] = [];
  const passages: ThreadGeometry['passages'] = [];

  const ordered = model.rows.flatMap((row,i)=>[
    ...row,
    ...model.turningChains.filter(chain=>chain.row===i)
  ]);
  for (const stitch of ordered) {
    const c = positions.get(stitch.id);
    if (!c) continue;
    const parents = stitch.parents.map(id => positions.get(id)).filter((p): p is P3 => !!p);
    const local = stitch.kind === 'chain'
      ? chainPath(c)
      : stitch.kind === 'sc2tog'
        ? decreasePath(c, parents[0], parents[1], stitch.row)
        : scPath(c, parents[0], stitch.row);
    // The yarn coming off the previous operation IS the yarn in this operation.
    // Connect ends without spawning a new isolated segment.
    if (points.length) {
      const last = points[points.length - 1];
      const first = local[0];
      points.push(P((last.x+first.x)/2,(last.y+first.y)/2 + .065,.23));
    }
    const start = points.length;
    points.push(...local);
    segments.push({stitch,start,end:points.length-1});
    if(stitch.kind==='sc') passages.push({childId:stitch.id,parentId:stitch.parents[0],behind:start+2,inFront:start+3});
    if(stitch.kind==='sc2tog') {
      passages.push({childId:stitch.id,parentId:stitch.parents[0],behind:start+2,inFront:start+3});
      passages.push({childId:stitch.id,parentId:stitch.parents[1],behind:start+7,inFront:start+8});
    }
  }

  const tip = points.length ? copy(points[points.length - 1]) : P(0,-.58,.2);
  const bounds = [...positions.values()];
  const width = bounds.length ? Math.max(4.7, Math.max(...bounds.map(p=>p.x)) - Math.min(...bounds.map(p=>p.x)) + 1.7) : 6;
  const height = bounds.length ? Math.max(2.2, Math.max(...bounds.map(p=>p.y)) - Math.min(...bounds.map(p=>p.y)) + 1.9) : 3.2;
  return { points, positionById: positions, segments, passages, tip, width, height };
}

/**
 * Check the *local* pass from behind to front of each referenced base loop.
 * This proves the intended 3D insertion waypoints are present, NOT that
 * continuous tube geometry is globally non-self-intersecting.
 */
export function validateLocalPassages(thread:ThreadGeometry):string[] {
  const issues:string[]=[];
  for(const p of thread.passages){
    const center=thread.positionById.get(p.parentId);
    const behind=thread.points[p.behind];
    const inFront=thread.points[p.inFront];
    if(!center||!behind||!inFront){issues.push('Missing anchor for '+p.childId);continue;}
    if(!(behind.z<0&&inFront.z>0))issues.push('No depth crossing for '+p.childId);
    if(Math.abs(behind.x-center.x)>.25 || Math.abs(inFront.x-center.x)>.25)
      issues.push('Insertion misses base stitch '+p.parentId);
    if(Math.abs(behind.y-center.y)>.35||Math.abs(inFront.y-center.y)>.35)
      issues.push('Insertion at wrong height '+p.parentId);
  }
  return issues;
}
