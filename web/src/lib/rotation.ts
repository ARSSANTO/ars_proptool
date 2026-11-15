import { Euler, MathUtils, Quaternion } from 'three';
import type { Vec } from '@/types';

// The game's rotationOrder 0 to 5 as the order the axes are multiplied in (order 2 is Rz * Rx * Ry)
const ORDER_NAMES = ['ZYX', 'YZX', 'ZXY', 'XZY', 'YXZ', 'XYZ'] as const;

export const orderName = (order: number): (typeof ORDER_NAMES)[number] => ORDER_NAMES[order] ?? 'ZXY';

/** The same orientation written for another rotation order (degrees in, degrees out) */
export function convertRotation(rot: Vec, from: number, to: number): Vec {
  if (from === to) return rot;

  const euler = new Euler(
    MathUtils.degToRad(rot.x),
    MathUtils.degToRad(rot.y),
    MathUtils.degToRad(rot.z),
    orderName(from),
  );
  const out = new Euler().setFromQuaternion(new Quaternion().setFromEuler(euler), orderName(to));

  return { x: MathUtils.radToDeg(out.x), y: MathUtils.radToDeg(out.y), z: MathUtils.radToDeg(out.z) };
}
