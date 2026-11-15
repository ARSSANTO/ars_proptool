import { useState } from 'react';
import { editProp, setBonePicking } from '@/lib/actions';
import { boneName } from '@/lib/bones';
import { useNuiEvent } from '@/lib/nui';
import { useEditorStore } from '@/store/editorStore';

interface Dot {
  id: number;
  x: number; // 0 to 1 across the screen
  y: number;
}

/** Dots on the ped's bones: click one to put the prop on it (Esc cancels) */
export function BonePicker() {
  const picking = useEditorStore((s) => s.bonePicking);
  const [dots, setDots] = useState<Dot[]>([]);
  const [hover, setHover] = useState<{ id: number; left: number; top: number } | null>(null);

  useNuiEvent<{ points: Dot[] }>('bones:frame', ({ points }) => {
    if (useEditorStore.getState().bonePicking) setDots(points);
  });

  if (!picking) return null;

  const pick = (id: number) => {
    const selected = useEditorStore.getState().selectedId;

    if (selected !== null) editProp(selected, { bone: id });
    setBonePicking(false);
    setDots([]);
    setHover(null);
  };

  return (
    <>
      <div className="bone-banner">
        Click a bone on the ped
        <button type="button" className="btn is-small" onClick={() => setBonePicking(false)}>
          Cancel
        </button>
      </div>
      <div className="bone-layer">
        {dots.map((dot) => (
          <button
            key={dot.id}
            type="button"
            className="bone-dot"
            aria-label={boneName(dot.id)}
            style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%` }}
            onMouseEnter={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setHover({ id: dot.id, left: box.right + 8, top: box.top - 6 });
            }}
            onMouseLeave={() => setHover(null)}
            onClick={() => pick(dot.id)}
          />
        ))}
      </div>
      {hover && (
        <div className="bone-label" style={{ left: hover.left, top: hover.top }}>
          {boneName(hover.id)} <span style={{ opacity: 0.5 }}>{hover.id}</span>
        </div>
      )}
    </>
  );
}
