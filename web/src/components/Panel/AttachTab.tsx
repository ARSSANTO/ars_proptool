import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  RiAddLine,
  RiCursorFill,
  RiDeleteBin6Fill,
  RiDragMove2Fill,
  RiEyeFill,
  RiEyeOffFill,
  RiFileCopyFill,
  RiFocus3Line,
  RiRestartLine,
  RiShapesFill,
} from 'react-icons/ri';
import { Dropdown, NumberField, Segmented, Toggle, useAnchorBox, useMenuKeys, type Option } from '@/components/ui/Controls';
import {
  addProp,
  copyCurrent,
  editProp,
  nudge,
  removeProp,
  resetField,
  selectProp,
  setAxis,
  setBonePicking,
  setOrder,
  startGizmo,
  toggleVisible,
} from '@/lib/actions';
import { BONES, boneName } from '@/lib/bones';
import { buildCopy, emoteOverflow, EMOTE_MAX_PROPS } from '@/lib/format';
import { selectedProp, useEditorStore } from '@/store/editorStore';
import type { CopyFormat, CopyScope, PropData, StepSize } from '@/types';

const POS_STEP: Record<StepSize, number> = { fine: 0.001, normal: 0.01, coarse: 0.05 };
const ROT_STEP: Record<StepSize, number> = { fine: 0.5, normal: 5, coarse: 15 };

const ORDERS: Option<number>[] = [
  { value: 0, label: 'Order 0', desc: 'Rarely used, pick it only if your script does' },
  { value: 1, label: 'Order 1', desc: 'The emote menu attaches its props with this one' },
  { value: 2, label: 'Order 2', desc: 'GTA default, most scripts use this' },
  { value: 3, label: 'Order 3', desc: 'Rarely used, pick it only if your script does' },
  { value: 4, label: 'Order 4', desc: 'Rarely used, pick it only if your script does' },
  { value: 5, label: 'Order 5', desc: 'Rarely used, pick it only if your script does' },
];

const FORMATS: { value: CopyFormat; label: string }[] = [
  { value: 'attach', label: 'Attach' },
  { value: 'values', label: 'Values' },
  { value: 'emote', label: 'Emote' },
  { value: 'lua', label: 'Lua' },
  { value: 'json', label: 'JSON' },
];

const STEPS: { value: StepSize; label: string }[] = [
  { value: 'fine', label: 'Fine' },
  { value: 'normal', label: 'Normal' },
  { value: 'coarse', label: 'Coarse' },
];

const SCOPES: { value: CopyScope; label: string }[] = [
  { value: 'selected', label: 'Selected' },
  { value: 'all', label: 'All props' },
];

// ---------------------------------------------------------------------------------------------
function AddSheet({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) {
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);
  const box = useAnchorBox(anchor, 150);

  const add = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await addProp(model);
    setBusy(false);
    if (ok) onClose();
  };

  useMenuKeys(onClose, () => undefined, () => void add());

  if (!box) return null;

  return (
    <>
      <div className="pop-backdrop" onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div className="pop add-sheet" style={{ left: box.left, top: box.top }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Add prop</div>
        <label className="input">
          <input autoFocus value={model} placeholder={useEditorStore.getState().config.defaultModel} onChange={(e) => setModel(e.target.value)} />
        </label>
        <p className="sub">It goes on the same bone as the selected prop</p>
        <button type="button" className="btn is-primary" disabled={busy} onClick={() => void add()}>
          <RiAddLine size={18} /> Add
        </button>
      </div>
    </>
  );
}

function PropTabs({ props, selectedId }: { props: PropData[]; selectedId: number | null }) {
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);

  return (
    <div className="prop-tabs">
      {props.map((prop) => (
        <button
          key={prop.id}
          type="button"
          className={`prop-tab ${prop.id === selectedId ? 'is-lamp' : ''}`}
          onClick={() => selectProp(prop.id)}
        >
          <b>
            {!prop.visible && <RiEyeOffFill size={14} />}
            {prop.model}
          </b>
          <small>{boneName(prop.bone)}</small>
        </button>
      ))}
      <button ref={addButton} type="button" className="prop-add" aria-label="Add prop" data-tip="Add another prop" data-tip-align="start" onClick={() => setAdding(true)}>
        <RiAddLine size={20} />
      </button>
      {adding && createPortal(<AddSheet anchor={addButton.current} onClose={() => setAdding(false)} />, document.getElementById('ui-portal') ?? document.body)}
    </div>
  );
}

function ModelField({ prop }: { prop: PropData }) {
  const [draft, setDraft] = useState(prop.model);
  const cancelled = useRef(false); // Esc blurs the field, and the blur must not commit

  useEffect(() => setDraft(prop.model), [prop.id, prop.model]);

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(prop.model);
      return;
    }

    const next = draft.trim();
    if (!next || next === prop.model) {
      setDraft(prop.model);
      return;
    }
    editProp(prop.id, { model: next });
  };

  return (
    <label className="input">
      <input
        value={draft}
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function BoneField({ prop }: { prop: PropData }) {
  const invalid = useEditorStore((s) => s.invalidBones);
  const picking = useEditorStore((s) => s.bonePicking);

  const options = useMemo<Option<number>[]>(() => {
    const skip = new Set(invalid);
    const list = BONES.filter((b) => !skip.has(b.id)).map((b) => ({ value: b.id, label: b.name, meta: String(b.id) }));

    if (!list.some((o) => o.value === prop.bone)) {
      list.unshift({ value: prop.bone, label: boneName(prop.bone), meta: String(prop.bone) });
    }

    return list;
  }, [invalid, prop.bone]);

  return (
    <div style={{ display: 'flex', gap: '0.8rem' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Dropdown value={prop.bone} options={options} searchable onChange={(bone) => editProp(prop.id, { bone })} />
      </div>
      <button
        type="button"
        className={`icon-btn is-box ${picking ? 'is-on' : ''}`}
        aria-label="Pick the bone on the ped"
        data-tip="Pick the bone on the ped"
        onClick={() => setBonePicking(!picking)}
      >
        <RiFocus3Line size={20} />
      </button>
    </div>
  );
}

function Placement({ prop }: { prop: PropData }) {
  const step = useEditorStore((s) => s.step);
  const setStep = useEditorStore((s) => s.setStep);
  const keepAngle = useEditorStore((s) => s.keepAngle);
  const setKeepAngle = useEditorStore((s) => s.setKeepAngle);

  const group = (field: 'pos' | 'rot', title: string, size: number, decimals: number) => (
    <div>
      <div className="axis-head">
        <span>{title}</span>
        <button type="button" className="icon-btn" style={{ width: '2.6rem', height: '2.6rem' }} aria-label={`Reset ${title}`} data-tip={`Reset ${title.toLowerCase()} to zero`} onClick={() => resetField(prop.id, field)}>
          <RiRestartLine size={16} />
        </button>
      </div>
      <div className="axis-stack">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <NumberField
            key={axis}
            axis={axis.toUpperCase()}
            value={prop[field][axis]}
            step={size}
            decimals={decimals}
            onNudge={(delta) => nudge(prop.id, field, axis, delta)}
            onSet={(value) => setAxis(prop.id, field, axis, value)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <section className="card">
      <div className="card-title">
        <span>Placement</span>
        <Segmented value={step} options={STEPS} onChange={setStep} />
      </div>
      <div className="axis-grid">
        {group('pos', 'Position (m)', POS_STEP[step], 4)}
        {group('rot', 'Rotation (°)', ROT_STEP[step], 3)}
      </div>
      <div className="order-row">
        <span className="field-label" style={{ width: 'auto' }} data-tip="Must match the script you paste into" data-tip-align="start">
          Rotation order
        </span>
        <div style={{ width: '14rem' }}>
          <Dropdown value={prop.order} options={ORDERS} onChange={(order) => setOrder(prop.id, order)} />
        </div>
        <span className="order-gap" />
        <span className="field-label" style={{ width: 'auto' }} data-tip="On: the angles are recalculated so the prop stays put. Off: only the order changes">
          Keep angle
        </span>
        <Toggle on={keepAngle} onChange={setKeepAngle} label="Keep angle" />
      </div>
    </section>
  );
}

function CopyCard() {
  const props = useEditorStore((s) => s.props);
  const selected = useEditorStore(selectedProp);
  const format = useEditorStore((s) => s.copyFormat);
  const scope = useEditorStore((s) => s.copyScope);
  const anim = useEditorStore((s) => s.anim);
  const setFormat = useEditorStore((s) => s.setCopyFormat);
  const setScope = useEditorStore((s) => s.setCopyScope);

  const text = buildCopy(format, scope, props, selected, anim.loaded ? { dict: anim.dict, name: anim.name, flag: anim.flag } : null);
  const overflow = format === 'emote' ? emoteOverflow(scope, props) : 0;

  return (
    <section className="card is-grow">
      <div className="card-title">
        <span>Copy</span>
        {props.length > 1 && <Segmented value={scope} options={SCOPES} onChange={setScope} />}
      </div>
      <Segmented value={format} options={FORMATS} onChange={setFormat} />
      <pre className="code">{text || 'Add a prop to see its code here'}</pre>
      {overflow > 0 && <p className="note">The emote menu takes {EMOTE_MAX_PROPS} props, {overflow} left out</p>}
      <button type="button" className="btn is-primary" style={{ width: '100%' }} onClick={() => void copyCurrent()}>
        <RiFileCopyFill size={18} /> Copy
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
export function AttachTab() {
  const props = useEditorStore((s) => s.props);
  const selectedId = useEditorStore((s) => s.selectedId);
  const prop = useEditorStore(selectedProp);
  const nativeAvailable = useEditorStore((s) => s.nativeAvailable);

  return (
    <>
      <PropTabs props={props} selectedId={selectedId} />

      {!prop ? (
        <div className="empty">
          <RiShapesFill size={40} />
          <div>No prop on the ped yet. Add one with the + above, type a model like prop_cs_burger_01.</div>
        </div>
      ) : (
        <>
          <section className="card">
            <div className="card-title">Prop</div>
            <div className="field-row">
              <div className="field-label">Model</div>
              <div className="grow">
                <ModelField prop={prop} />
              </div>
            </div>
            <div className="field-row">
              <div className="field-label">Bone</div>
              <div className="grow">
                <BoneField prop={prop} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.4rem' }}>
              <button type="button" className="btn is-primary is-wide" onClick={() => void startGizmo(false)}>
                <RiDragMove2Fill size={18} /> Edit with gizmo
              </button>
              {nativeAvailable && (
                <button type="button" className="icon-btn is-box" aria-label="Edit with the native gizmo" data-tip="Edit with the game's own gizmo" onClick={() => void startGizmo(true)}>
                  <RiCursorFill size={18} />
                </button>
              )}
              <button type="button" className="icon-btn is-box" aria-label={prop.visible ? 'Hide prop' : 'Show prop'} data-tip={prop.visible ? 'Hide the prop' : 'Show the prop'} onClick={() => toggleVisible(prop.id)}>
                {prop.visible ? <RiEyeFill size={18} /> : <RiEyeOffFill size={18} />}
              </button>
              <button type="button" className="icon-btn is-box is-danger" aria-label="Remove prop" data-tip="Remove the prop" onClick={() => void removeProp(prop.id)}>
                <RiDeleteBin6Fill size={18} />
              </button>
            </div>
          </section>

          <Placement prop={prop} />
        </>
      )}

      <CopyCard />
    </>
  );
}
