import { RiCheckLine, RiForbid2Line, RiPauseFill, RiPlayFill } from 'react-icons/ri';
import { Dropdown, Segmented, type Option } from '@/components/ui/Controls';
import { playAnim, seekAnim, setSpeed, stopAnim, togglePause } from '@/lib/actions';
import { useEditorStore } from '@/store/editorStore';

const FLAGS: Option<number>[] = [
  { value: 49, label: 'Flag 49', desc: 'Upper body, loops, the ped can walk' },
  { value: 48, label: 'Flag 48', desc: 'Upper body, plays once, the ped can walk' },
  { value: 50, label: 'Flag 50', desc: 'Upper body, holds the last frame, the ped can walk' },
  { value: 1, label: 'Flag 1', desc: 'Full body, loops' },
  { value: 0, label: 'Flag 0', desc: 'Full body, plays once' },
  { value: 2, label: 'Flag 2', desc: 'Full body, holds the last frame' },
];

const SPEEDS = ['0.25', '0.5', '1', '2'] as const;

export function AnimationTab() {
  const anim = useEditorStore((s) => s.anim);
  const setAnim = useEditorStore((s) => s.setAnim);

  const running = anim.loaded && anim.playing && !anim.paused;
  const percent = Math.round(Math.max(0, Math.min(1, anim.time)) * 1000) / 10;

  return (
    <>
      <section className="card">
        <div className="card-title">Playback</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.4rem' }}>
          <button type="button" className="play-btn" aria-label={running ? 'Pause' : 'Play'} onClick={() => void togglePause()}>
            {running ? <RiPauseFill size={26} /> : <RiPlayFill size={26} />}
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span className="sub" style={{ margin: 0 }}>Frame</span>
              <span className="value-chip">{percent.toFixed(1)}%</span>
            </div>
            <input
              className="slider"
              type="range"
              min={0}
              max={1000}
              value={Math.round(anim.time * 1000)}
              disabled={!anim.loaded}
              style={{ ['--p' as string]: `${percent}%` }}
              aria-label="Frame"
              onChange={(e) => seekAnim(Number(e.target.value) / 1000)}
            />
          </div>
        </div>
        <div className="field-row" style={{ marginTop: '1.4rem' }}>
          <div className="field-label">Speed</div>
          <Segmented
            value={String(anim.speed) as (typeof SPEEDS)[number]}
            options={SPEEDS.map((s) => ({ value: s, label: `${s}x` }))}
            onChange={(s) => void setSpeed(Number(s))}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-title">Animation</div>
        <div className="field-row">
          <div className="field-label">Dictionary</div>
          <label className="input grow">
            <input value={anim.dict} spellCheck={false} onChange={(e) => setAnim({ dict: e.target.value })} />
          </label>
        </div>
        <div className="field-row">
          <div className="field-label">Name</div>
          <label className="input grow">
            <input value={anim.name} spellCheck={false} onChange={(e) => setAnim({ name: e.target.value })} />
          </label>
        </div>
        <div className="field-row">
          <div className="field-label">
            Flag
            <small>How the clip plays on the ped</small>
          </div>
          <div style={{ width: '18rem' }}>
            <Dropdown value={anim.flag} options={FLAGS} onChange={(flag) => setAnim({ flag })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.4rem' }}>
          <button type="button" className="btn is-primary is-wide" onClick={() => void playAnim()}>
            <RiCheckLine size={18} /> Play animation
          </button>
          <button type="button" className="btn" onClick={() => void stopAnim()}>
            <RiForbid2Line size={18} /> No animation
          </button>
        </div>
      </section>
    </>
  );
}
