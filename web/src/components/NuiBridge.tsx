import { useEffect } from 'react';
import { applyTransform, openEditor, parseCamSpeed, parseCopied, parseSession } from '@/lib/actions';
import { fetchNui, useNuiEvent } from '@/lib/nui';
import { useEditorStore } from '@/store/editorStore';
import type { AnimInfo, EditorConfig, GizmoOpen, OpenData, Vec } from '@/types';

const get = () => useEditorStore.getState();

interface ReadyReply {
  ok?: boolean;
  config?: Partial<EditorConfig>;
  last?: string | null;
  copied?: string | null;
  camera?: string | null;
}

/** Owns every message from the client and the startup handshake; everything else reads the store. */
export function NuiBridge() {
  // The page tells the client when it is ready. The client may not have registered its callbacks yet, so ask again.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      for (let attempt = 0; attempt < 30 && !cancelled; attempt++) {
        const reply = await fetchNui<ReadyReply>('proptool:ready');

        if (reply?.ok) {
          if (reply.config) get().setConfig(reply.config);
          get().setLast(parseSession(reply.last));
          get().setCopied(parseCopied(reply.copied));
          const speed = parseCamSpeed(reply.camera);
          if (speed) get().setCamSpeed(speed);
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useNuiEvent<OpenData>('open', (data) => void openEditor(data));

  useNuiEvent('close', () => {
    const store = get();
    store.setVisible(false);
    store.setGizmo(null);
    store.setNativeGizmo(false);
    store.setBonePicking(false);
    store.setTest(false);
  });

  useNuiEvent<{ test: boolean }>('mode', ({ test }) => get().setTest(test === true));

  useNuiEvent<Partial<AnimInfo> & { loaded?: boolean }>('anim:state', (state) => {
    const { anim, setAnim } = get();

    if (!state.loaded) {
      if (anim.loaded || anim.playing) setAnim({ loaded: false, playing: false, time: 0 });
      return;
    }

    setAnim({ loaded: true, playing: state.playing ?? false, paused: state.paused ?? false, time: state.time ?? 0 });
  });

  useNuiEvent<GizmoOpen>('gizmo:open', (data) => {
    const store = get();
    store.setGizmo(data);
    store.setNativeGizmo(false);
    store.setTab('attach');
  });

  useNuiEvent<{ id: number; saved: boolean; pos?: Vec; rot?: Vec }>('gizmo:close', (data) => {
    if (data.pos && data.rot) applyTransform(data.id, data.pos, data.rot);
    get().setGizmo(null);
    get().setNativeGizmo(false);
  });

  useNuiEvent<{ on: boolean }>('gizmo:native', ({ on }) => {
    const store = get();
    store.setNativeGizmo(on === true);
    if (on) store.setGizmo(null);
  });

  useNuiEvent<{ id: number; pos: Vec; rot: Vec }>('prop:transform', ({ id, pos, rot }) => applyTransform(id, pos, rot));

  return null;
}
