import { useEffect, useState } from 'react';
import { BonePicker } from '@/components/BonePicker';
import { GizmoLayer } from '@/components/Gizmo/GizmoLayer';
import { NuiBridge } from '@/components/NuiBridge';
import { Panel } from '@/components/Panel/Panel';
import { Toasts } from '@/components/Toasts';
import { Keycap } from '@/components/ui/Keycap';
import { useEditorInput } from '@/hooks/useEditorInput';
import { useEditorStore } from '@/store/editorStore';

const EXIT_MS = 180; // --t-exit: the panel slides back to its edge before it unmounts

export default function App() {
  const visible = useEditorStore((s) => s.visible);
  const test = useEditorStore((s) => s.test);
  const side = useEditorStore((s) => s.config.side);
  const shown = visible && !test;
  const [mounted, setMounted] = useState(false);

  useEditorInput();

  useEffect(() => {
    if (shown) {
      setMounted(true);
      return;
    }

    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);

  return (
    <>
      <div className="ui">
        <NuiBridge />
        <div className={`pe-root ${side === 'left' ? 'pe-left' : 'pe-right'}`}>{(shown || mounted) && <Panel leaving={!shown} />}</div>
        {visible && <GizmoLayer />}
        {visible && <BonePicker />}
        {visible && test && (
          <div className="test-hint">
            <Keycap label="Backspace" primary /> Back to the editor
          </div>
        )}
        <Toasts />
      </div>
      <div id="ui-portal" className="ui" />
    </>
  );
}
