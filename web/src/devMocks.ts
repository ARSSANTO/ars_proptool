import { emulateNui } from '@/lib/nui';
import { useEditorStore } from '@/store/editorStore';
import type { Tab } from '@/types';

/** Browser preview only: opens the editor with one prop the way the client would. */
export function seedDevEditor(): void {
  // ?tab=animation|scene|history picks the page, ?bg=0 keeps the page transparent (used to render the README previews)
  const query = new URLSearchParams(window.location.search);

  if (query.get('bg') !== '0') {
    document.body.style.background = 'linear-gradient(180deg, #6fa3d8 0%, #b9d4ea 55%, #7d8f6a 100%)';
  }

  window.setTimeout(() => {
    emulateNui('open', {
      props: [
        {
          id: 1,
          model: 'prop_cs_burger_01',
          bone: 18905,
          pos: { x: 0.0291, y: -0.0074, z: -0.0365 },
          rot: { x: 61.12, y: 6.17, z: -19.99 },
          order: 2,
          visible: true,
        },
      ],
      selected: 1,
      anim: { dict: 'mp_player_inteat@burger', name: 'mp_player_int_eat_burger', flag: 49, speed: 1, paused: false },
      scene: { backdrop: { enabled: false, color: '#0A4BD0' } },
      nativeGizmo: query.get('native') !== '0',
    });

    const tab = query.get('tab') as Tab | null;
    if (tab) useEditorStore.getState().setTab(tab);
  }, 200);
}
