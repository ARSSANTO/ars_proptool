import { useEffect } from 'react';
import { stepTab } from '@/components/Panel/HintStrip';
import { closeEditor, gizmoCancel, gizmoSave, setBonePicking, startGizmo, togglePause } from '@/lib/actions';
import { fetchNui } from '@/lib/nui';
import { useEditorStore } from '@/store/editorStore';

const state = () => useEditorStore.getState();
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'radio', 'button', 'color']);

// a field the player types in (a slider is not one)
const isField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  ((target.tagName === 'INPUT' && !NON_TEXT_INPUTS.has((target as HTMLInputElement).type)) ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable);

// The camera is driven from here, so no key or mouse button reaches the game while the editor has focus.
type CamKey = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down' | 'slow';

const CAMERA_KEYS: Record<string, CamKey> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  Space: 'up',
  ControlLeft: 'down',
  ControlRight: 'down',
  ShiftLeft: 'slow',
  ShiftRight: 'slow',
};

const idle = (): Record<CamKey, boolean> => ({ forward: false, back: false, left: false, right: false, up: false, down: false, slow: false });

/** Keys, the camera, the wheel and the typing flag. One set of window listeners, active only while the editor is open. */
export function useEditorInput(): void {
  useEffect(() => {
    let held = idle();
    let looking = false;
    let lookX = 0;
    let lookY = 0;
    let lookFrame = 0;
    let lastWheel = 0;
    let escArmed = false; // Esc acts on key-up, and only when its key-down reached this handler (a menu may have used it)

    const sendKeys = () => void fetchNui('proptool:camKeys', held);

    const releaseAll = () => {
      looking = false;
      lookX = 0;
      lookY = 0;

      if (Object.values(held).some(Boolean)) {
        held = idle();
        sendKeys();
      }
    };

    const flushLook = () => {
      lookFrame = 0;
      if (lookX === 0 && lookY === 0) return;

      void fetchNui('proptool:camLook', { dx: lookX, dy: lookY });
      lookX = 0;
      lookY = 0;
    };

    // WASD must not move the camera while a field has focus
    const onFocusIn = (e: FocusEvent) => {
      if (!isField(e.target)) return;
      releaseAll();
      void fetchNui('proptool:typing', { value: true });
    };
    const onFocusOut = (e: FocusEvent) => {
      if (isField(e.target)) void fetchNui('proptool:typing', { value: false });
    };

    const cameraActive = () => {
      const s = state();
      return s.visible && !s.test && !s.nativeGizmo;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const s = state();
      if (!s.visible || s.test || e.repeat) return;

      if (isField(e.target)) {
        // typing: only Esc leaves the field
        if (e.code === 'Escape') (e.target as HTMLElement).blur();
        return;
      }

      const camKey = CAMERA_KEYS[e.code];
      if (camKey && cameraActive()) {
        if (e.code === 'Space') e.preventDefault();
        if (!held[camKey]) {
          held = { ...held, [camKey]: true };
          sendKeys();
        }
        return;
      }

      switch (e.code) {
        case 'Escape':
          e.preventDefault();
          escArmed = true;
          break;
        case 'Enter':
          if (s.gizmo) {
            e.preventDefault();
            gizmoSave();
          }
          break;
        case 'KeyR':
          if (s.gizmo) s.setGizmoTool(s.gizmoTool === 'translate' ? 'rotate' : 'translate');
          break;
        case 'KeyQ':
          if (s.gizmo) s.setGizmoSpace(s.gizmoSpace === 'world' ? 'local' : 'world');
          else stepTab(-1);
          break;
        case 'KeyE':
          if (!s.gizmo) stepTab(1);
          break;
        case 'KeyP':
          void togglePause();
          break;
        case 'F11':
          if (s.gizmo) {
            e.preventDefault();
            void startGizmo(true);
          }
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && escArmed) {
        escArmed = false;

        const s = state();
        if (!s.visible || s.test) return;

        if (s.bonePicking) setBonePicking(false);
        else if (s.gizmo) gizmoCancel();
        else closeEditor();
        return;
      }

      const camKey = CAMERA_KEYS[e.code];

      if (camKey && held[camKey]) {
        held = { ...held, [camKey]: false };
        sendKeys();
      }
    };

    // RMB held outside the panel looks around
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2 || !cameraActive()) return;
      if (e.target instanceof HTMLElement && e.target.closest('.panel, .pop, .key-list')) return;

      looking = true;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!looking) return;

      lookX += e.movementX;
      lookY += e.movementY;
      if (!lookFrame) lookFrame = requestAnimationFrame(flushLook);
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) looking = false;
    };

    // The wheel zooms the camera, except over the panel or a menu where it scrolls
    const onWheel = (e: WheelEvent) => {
      if (!cameraActive()) return;
      if (e.target instanceof HTMLElement && e.target.closest('.panel, .pop, .key-list')) return;

      const now = performance.now();
      if (now - lastWheel < 40) return;
      lastWheel = now;

      void fetchNui('proptool:zoom', { delta: e.deltaY > 0 ? 1 : -1 });
    };

    const onContext = (e: MouseEvent) => e.preventDefault();

    // keys and mouse buttons must not stay held when the camera hands over (test mode, native gizmo, close)
    const unsubscribe = useEditorStore.subscribe((s, prev) => {
      if (s.test !== prev.test || s.nativeGizmo !== prev.nativeGizmo || (!s.visible && prev.visible)) releaseAll();
    });

    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('blur', releaseAll);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContext);
    return () => {
      unsubscribe();
      cancelAnimationFrame(lookFrame);
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('blur', releaseAll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContext);
    };
  }, []);
}
