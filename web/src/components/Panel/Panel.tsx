import { RiBox3Fill, RiCloseLine, RiHistoryFill, RiLandscapeFill, RiPauseFill, RiPlayCircleFill, RiPlayFill, RiShapesFill, RiWalkFill } from 'react-icons/ri';
import type { ReactNode } from 'react';
import { AnimationTab } from '@/components/Panel/AnimationTab';
import { AttachTab } from '@/components/Panel/AttachTab';
import { HintStrip, TAB_ORDER } from '@/components/Panel/HintStrip';
import { HistoryTab } from '@/components/Panel/HistoryTab';
import { SceneTab } from '@/components/Panel/SceneTab';
import { closeEditor, startTest, togglePause } from '@/lib/actions';
import { useEditorStore } from '@/store/editorStore';
import type { Tab } from '@/types';

const TABS: Record<Tab, { label: string; icon: ReactNode }> = {
  attach: { label: 'Attach', icon: <RiBox3Fill size={18} /> },
  animation: { label: 'Animation', icon: <RiPlayCircleFill size={18} /> },
  scene: { label: 'Scene', icon: <RiLandscapeFill size={18} /> },
  history: { label: 'History', icon: <RiHistoryFill size={18} /> },
};

export function Panel({ leaving }: { leaving: boolean }) {
  const tab = useEditorStore((s) => s.tab);
  const setTab = useEditorStore((s) => s.setTab);
  const count = useEditorStore((s) => s.props.length);
  const gizmoOn = useEditorStore((s) => s.gizmo !== null);
  const nativeOn = useEditorStore((s) => s.nativeGizmo);
  const running = useEditorStore((s) => s.anim.loaded && s.anim.playing && !s.anim.paused);

  return (
    <section className={`panel ${leaving ? 'is-leaving' : ''} ${nativeOn ? 'is-dim' : ''}`} role="dialog" aria-label="Prop editor">
      <header className="panel-head">
        <span className="head-logo">
          <RiShapesFill size={24} />
        </span>
        <div className="head-text">
          <div className="head-title">Prop editor</div>
          <div className="head-sub">{count} prop(s) attached</div>
        </div>
        <button
          type="button"
          className="icon-btn is-box"
          aria-label={running ? 'Pause the animation' : 'Play the animation'}
          data-tip={running ? 'Pause the animation (P)' : 'Play the animation (P)'}
          onClick={() => void togglePause()}
        >
          {running ? <RiPauseFill size={20} /> : <RiPlayFill size={20} />}
        </button>
        <button
          type="button"
          className="btn is-small"
          data-tip="Walk around with the props on and see how they look in game"
          onClick={() => void startTest()}
        >
          <RiWalkFill size={18} /> Test
        </button>
        <button type="button" className="icon-btn is-box" aria-label="Exit the editor" data-tip="Exit the editor" onClick={closeEditor}>
          <RiCloseLine size={20} />
        </button>
      </header>

      <nav className="tabs" role="tablist">
        <span className="tabs-fill" style={{ transform: `translateX(${TAB_ORDER.indexOf(tab) * 100}%)` }} />
        {TAB_ORDER.map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'is-current' : ''}`} onClick={() => setTab(id)}>
            {TABS[id].icon}
            <span>{TABS[id].label}</span>
          </button>
        ))}
      </nav>

      {gizmoOn && (
        <div className="live">
          <i />
          <b>LIVE</b> Gizmo is on. Enter keeps it, Esc undoes it
        </div>
      )}

      <div className={`pe-scroll ${tab === 'attach' ? 'is-fit' : ''}`} key={tab}>
        {tab === 'attach' && <AttachTab />}
        {tab === 'animation' && <AnimationTab />}
        {tab === 'scene' && <SceneTab />}
        {tab === 'history' && <HistoryTab />}
      </div>

      <HintStrip />
    </section>
  );
}
