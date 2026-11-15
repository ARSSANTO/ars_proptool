import { Suspense, lazy, useEffect, useState } from 'react';
import { GizmoBoundary } from '@/components/Gizmo/GizmoBoundary';
import { Keycap, useKeysDown } from '@/components/ui/Keycap';
import { gizmoCancel, gizmoSave, startGizmo, togglePause } from '@/lib/actions';
import { useEditorStore } from '@/store/editorStore';

// three.js only loads when the first gizmo opens
const GizmoCanvas = lazy(() => import('@/components/Gizmo/GizmoCanvas'));

interface Row {
  keys: { label: string; code?: string }[];
  label: string;
  onClick?: () => void;
}

function KeyList({ rows, side }: { rows: Row[]; side: 'left' | 'right' }) {
  const down = useKeysDown();

  return (
    <div className={`key-list ${side === 'left' ? 'is-left' : ''}`}>
      {rows.map((row) => {
        const content = (
          <>
            <span className="keys">
              {row.keys.map((key) => (
                <Keycap key={key.label} label={key.label} code={key.code} down={down} />
              ))}
            </span>
            {row.label}
          </>
        );

        return row.onClick ? (
          <button key={row.label} type="button" className="key-row is-click" onClick={row.onClick}>
            {content}
          </button>
        ) : (
          <div key={row.label} className="key-row">
            {content}
          </div>
        );
      })}
    </div>
  );
}

const WASD = [
  { label: 'W', code: 'KeyW' },
  { label: 'A', code: 'KeyA' },
  { label: 'S', code: 'KeyS' },
  { label: 'D', code: 'KeyD' },
];

const HEIGHT = [
  { label: 'Space', code: 'Space' },
  { label: 'Ctrl', code: 'ControlLeft' },
];

/** The editor's gizmo and the keys that go with it (UI gizmo and the game's own) */
export function GizmoLayer() {
  const gizmoOpen = useEditorStore((s) => s.gizmo !== null);
  const nativeOn = useEditorStore((s) => s.nativeGizmo);
  const tool = useEditorStore((s) => s.gizmoTool);
  const space = useEditorStore((s) => s.gizmoSpace);
  const side = useEditorStore((s) => s.config.side);
  const setTool = useEditorStore((s) => s.setGizmoTool);
  const setSpace = useEditorStore((s) => s.setGizmoSpace);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (gizmoOpen) setLoaded(true);
  }, [gizmoOpen]);

  // the key list sits on the side away from the panel
  const listSide = side === 'left' ? 'right' : 'left';

  return (
    <>
      {loaded && (
        <GizmoBoundary>
          <Suspense fallback={null}>
            <GizmoCanvas />
          </Suspense>
        </GizmoBoundary>
      )}

      {gizmoOpen && !nativeOn && (
        <KeyList
          side={listSide}
          rows={[
            { keys: [{ label: 'LMB' }], label: 'Drag to move / rotate' },
            { keys: [{ label: 'R', code: 'KeyR' }], label: tool === 'translate' ? 'Rotate mode' : 'Move mode', onClick: () => setTool(tool === 'translate' ? 'rotate' : 'translate') },
            { keys: [{ label: 'Q', code: 'KeyQ' }], label: `Toggle world / local (${space === 'world' ? 'World' : 'Local'})`, onClick: () => setSpace(space === 'world' ? 'local' : 'world') },
            { keys: WASD, label: 'Move camera' },
            { keys: HEIGHT, label: 'Camera up / down' },
            { keys: [{ label: 'Shift', code: 'ShiftLeft' }], label: 'Hold for precision' },
            { keys: [{ label: 'RMB' }], label: 'Rotate camera' },
            { keys: [{ label: 'F11', code: 'F11' }], label: 'Switch to native gizmo', onClick: () => void startGizmo(true) },
            { keys: [{ label: '↵', code: 'Enter' }], label: 'Finish editing', onClick: gizmoSave },
            { keys: [{ label: 'Esc', code: 'Escape' }], label: 'Cancel editing', onClick: gizmoCancel },
            { keys: [{ label: 'P', code: 'KeyP' }], label: 'Play / pause animation', onClick: () => void togglePause() },
          ]}
        />
      )}

      {nativeOn && (
        <KeyList
          side={listSide}
          rows={[
            { keys: [{ label: 'LMB' }], label: 'Drag to move / rotate' },
            { keys: [{ label: 'R', code: 'KeyR' }], label: 'Rotate mode' },
            { keys: [{ label: 'Q', code: 'KeyQ' }], label: 'Toggle world / local' },
            { keys: WASD, label: 'Move camera' },
            { keys: HEIGHT, label: 'Camera up / down' },
            { keys: [{ label: 'Shift', code: 'ShiftLeft' }], label: 'Hold for precision' },
            { keys: [{ label: 'RMB' }], label: 'Rotate camera' },
            { keys: [{ label: 'F11', code: 'F11' }], label: 'Switch to UI gizmo' },
            { keys: [{ label: '↵', code: 'Enter' }], label: 'Finish editing' },
            { keys: [{ label: 'Esc', code: 'Escape' }], label: 'Cancel editing' },
          ]}
        />
      )}
    </>
  );
}
