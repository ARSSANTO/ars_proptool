import { PerspectiveCamera, TransformControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { MathUtils, type Mesh } from 'three';
import { sendGizmoMove } from '@/lib/actions';
import { useNuiEvent } from '@/lib/nui';
import {
  SCENE_ROTATION_ORDER,
  fromScenePosition,
  fromSceneRotation,
  toScenePosition,
  toSceneRotation,
} from '@/lib/space';
import { useEditorStore } from '@/store/editorStore';
import type { Vec } from '@/types';

interface FrameData {
  camera: { position: Vec; rotation?: Vec };
  entity: { position: Vec; rotation: Vec };
}

// Heading as the scene's yaw; a pitch past straight up / down turns it around
function sceneYaw(pitch: number, heading: number): number {
  if (pitch > 0 && pitch < 90) return heading;
  if ((pitch > -180 && pitch < -90) || pitch > 0) return -heading;
  return heading;
}

// Follows the game camera: the client sends where it draws from every frame while the gizmo is open
function GameCamera({ fov }: { fov: number }) {
  const camera = useThree((state) => state.camera);

  useNuiEvent<FrameData>('gizmo:frame', ({ camera: view }) => {
    toScenePosition(camera.position, view.position);
    camera.rotation.order = SCENE_ROTATION_ORDER;

    if (view.rotation) {
      camera.rotation.set(
        MathUtils.degToRad(view.rotation.x),
        MathUtils.degToRad(sceneYaw(view.rotation.x, view.rotation.z)),
        MathUtils.degToRad(view.rotation.y),
      );
    }

    camera.updateProjectionMatrix();
  });

  return <PerspectiveCamera makeDefault fov={fov} position={[0, 0, 10]} onUpdate={(self) => self.updateProjectionMatrix()} />;
}

// Move / rotate arrows on the prop. The arrows follow the prop until the mouse takes hold of one; every change
// goes to the client as a world pose, which it turns into bone offsets.
function PropGizmo({ position, rotation }: { position: Vec; rotation: Vec }) {
  // a callback ref into state: TransformControls must not mount before the mesh exists
  const [target, setTarget] = useState<Mesh | null>(null);
  const dragging = useRef(false);
  const tool = useEditorStore((s) => s.gizmoTool);
  const space = useEditorStore((s) => s.gizmoSpace);

  useEffect(() => {
    if (!target) return;
    toScenePosition(target.position, position);
    toSceneRotation(target.rotation, rotation);
    // the first pose only; later poses come from gizmo:frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useNuiEvent<FrameData>('gizmo:frame', ({ entity }) => {
    if (!target || dragging.current) return;
    toScenePosition(target.position, entity.position);
    toSceneRotation(target.rotation, entity.rotation);
  });

  const send = () => {
    if (!target) return;
    sendGizmoMove(fromScenePosition(target.position), fromSceneRotation(target.rotation));
  };

  return (
    <>
      {target && (
        <TransformControls
          size={0.5}
          object={target}
          mode={tool}
          space={space}
          onMouseDown={() => {
            dragging.current = true;
          }}
          onMouseUp={() => {
            dragging.current = false;
          }}
          onObjectChange={send}
        />
      )}
      <mesh ref={setTarget} />
    </>
  );
}

/**
 * Transparent full-screen canvas over the game; only the arrows draw. Once loaded it stays mounted: tearing a WebGL
 * context down and up again on every session can end in "context lost". While no gizmo is open the render loop is
 * paused, clicks pass through and the canvas is hidden (a paused loop would keep painting its last frame).
 */
export default function GizmoCanvas() {
  const gizmo = useEditorStore((s) => s.gizmo);
  // a lost context cannot be used again, so the canvas is built anew (a few times at most)
  const [epoch, setEpoch] = useState(0);

  return (
    <div className="gizmo-canvas" style={{ pointerEvents: gizmo ? 'auto' : 'none', visibility: gizmo ? 'visible' : 'hidden' }}>
      <Canvas
        key={epoch}
        frameloop={gizmo ? 'always' : 'never'}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            console.error('[ars_proptool] the gizmo canvas lost its WebGL context, building it again');
            setEpoch((n) => (n < 5 ? n + 1 : n));
          });
        }}
      >
        <GameCamera fov={gizmo?.fov ?? 40} />
        {gizmo && <PropGizmo key={gizmo.handle} position={gizmo.position} rotation={gizmo.rotation} />}
      </Canvas>
    </div>
  );
}
