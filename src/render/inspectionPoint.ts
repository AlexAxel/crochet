import type {PhysicsFrame,Vector} from '../core/yarnPhysics';

/**
 * The inspection marker is placed on the *physical yarn particle*, never on
 * a decorative hook position. It is a read-only diagnostic view of the solver.
 */
export function inspectionPoint(frame:PhysicsFrame,hookVisible:boolean):Vector|null{
  if(hookVisible)return null;
  if(frame.grasped && frame.graspIndex!==null)
    return frame.yarn[frame.graspIndex]??null;
  // While idle, show where the existing live loop rests so users can find it
  // even with the 3D hook hidden; during approach there is no false "grasp".
  return frame.moving?null:frame.active;
}
