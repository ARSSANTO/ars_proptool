import { Component, type ReactNode } from 'react';
import { gizmoCancel, toast } from '@/lib/actions';
import { useEditorStore } from '@/store/editorStore';

/** If the three.js canvas cannot start (no WebGL, a bad bundle), the rest of the editor must keep working. */
export class GizmoBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.error('[ars_proptool] the UI gizmo canvas failed', error);
    toast(useEditorStore.getState().nativeAvailable ? 'The UI gizmo could not start, use the native gizmo' : 'The UI gizmo could not start', 'error');
    gizmoCancel();
    useEditorStore.getState().setGizmo(null);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}
