import { Keycap, useKeysDown } from '@/components/ui/Keycap';
import { closeEditor, gizmoCancel, togglePause } from '@/lib/actions';
import { useEditorStore } from '@/store/editorStore';
import type { Tab } from '@/types';

export const TAB_ORDER: Tab[] = ['attach', 'animation', 'scene', 'history'];

export function stepTab(delta: number): void {
  const store = useEditorStore.getState();
  const index = TAB_ORDER.indexOf(store.tab);
  store.setTab(TAB_ORDER[(index + delta + TAB_ORDER.length) % TAB_ORDER.length]);
}

/** Only keys that work right now, mouse hints first, Esc alone at the right (guide 8.2) */
export function HintStrip() {
  const down = useKeysDown();
  const gizmoOn = useEditorStore((s) => s.gizmo !== null);
  const running = useEditorStore((s) => s.anim.loaded && s.anim.playing && !s.anim.paused);

  return (
    <footer className="hints">
      <span className="hint">
        <Keycap label="RMB" />
        <Keycap label="Wheel" /> View
      </span>
      <span className="hint">
        <Keycap label="W" code="KeyW" down={down} />
        <Keycap label="A" code="KeyA" down={down} />
        <Keycap label="S" code="KeyS" down={down} />
        <Keycap label="D" code="KeyD" down={down} /> Move
      </span>
      <span className="hint">
        <Keycap label="Space" code="Space" down={down} />
        <Keycap label="Ctrl" code="ControlLeft" down={down} /> Height
      </span>
      <button type="button" className="hint is-click" onClick={() => void togglePause()}>
        <Keycap label="P" code="KeyP" down={down} /> {running ? 'Pause' : 'Play'}
      </button>
      <button type="button" className="hint is-click is-end" onClick={gizmoOn ? gizmoCancel : closeEditor}>
        <Keycap label="Esc" code="Escape" down={down} /> {gizmoOn ? 'Undo' : 'Exit'}
      </button>
    </footer>
  );
}
