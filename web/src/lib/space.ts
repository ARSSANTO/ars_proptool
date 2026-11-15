import { Euler, MathUtils, Vector3 } from 'three';
import type { Vec } from '@/types';

// Game space is Z-up (x east, y north), three.js is Y-up: game (x, y, z) sits at scene (x, z, -y).
// Rotations are degrees in the game (GetEntityRotation order 2) and radians in the scene, applied in 'YZX' order.
export const SCENE_ROTATION_ORDER = 'YZX';

export function toScenePosition(target: Vector3, position: Vec): void {
  target.set(position.x, position.z, -position.y);
}

export function fromScenePosition(position: Vector3): Vec {
  return { x: position.x, y: -position.z, z: position.y };
}

// Exact inverse of fromSceneRotation, so a rotation sent back unchanged comes out the same
export function toSceneRotation(target: Euler, rotation: Vec): void {
  target.order = SCENE_ROTATION_ORDER;
  target.set(MathUtils.degToRad(rotation.x), MathUtils.degToRad(rotation.z), MathUtils.degToRad(-rotation.y));
}

export function fromSceneRotation(rotation: Euler): Vec {
  return {
    x: MathUtils.radToDeg(rotation.x),
    y: MathUtils.radToDeg(-rotation.z),
    z: MathUtils.radToDeg(rotation.y),
  };
}
