import { RiEraserFill, RiFileCopyFill, RiHistoryLine, RiRestartLine } from 'react-icons/ri';
import { clearCopied, copyAgain, loadSession } from '@/lib/actions';
import { useEditorStore } from '@/store/editorStore';
import type { HistoryEntry, Session } from '@/types';

const FORMAT_LABEL = { attach: 'Attach', values: 'Values', emote: 'Emote', lua: 'Lua', json: 'JSON' } as const;

const describe = (session: Session): string => {
  if (session.props.length === 0) return 'No props';
  const names = session.props.map((p) => p.model);
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
};

const ago = (at: number): string => {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
};

function Entry({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="history-row">
      <div className="meta">
        <b>{describe(entry.session)}</b>
        <span className="sub" style={{ margin: 0 }}>
          <span className="chip">{FORMAT_LABEL[entry.format]}</span> {ago(entry.at)}
        </span>
      </div>
      <button type="button" className="icon-btn" aria-label="Copy again" data-tip="Copy it again" onClick={() => void copyAgain(entry)}>
        <RiFileCopyFill size={18} />
      </button>
      <button type="button" className="icon-btn" aria-label="Load back" data-tip="Load it back onto the ped" onClick={() => void loadSession(entry.session)}>
        <RiRestartLine size={18} />
      </button>
    </div>
  );
}

export function HistoryTab() {
  const last = useEditorStore((s) => s.last);
  const copied = useEditorStore((s) => s.copied);

  return (
    <>
      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '1.5rem' }}>Last session</div>
            <div className="sub" style={{ margin: 0 }}>{last ? describe(last) : 'Nothing saved yet'}</div>
          </div>
          <button type="button" className="btn is-small" disabled={!last} onClick={() => last && void loadSession(last)}>
            <RiRestartLine size={16} /> Load
          </button>
        </div>
      </section>

      <div className="card-title" style={{ margin: '0.4rem 0 0' }}>
        <span>Copied ({copied.length})</span>
        <button type="button" className="btn is-small" disabled={copied.length === 0} onClick={clearCopied} style={{ background: 'transparent' }}>
          <RiEraserFill size={16} /> Clear
        </button>
      </div>

      {copied.length === 0 ? (
        <div className="empty">
          <RiHistoryLine size={40} />
          <div>Everything you copy shows up here, you can copy it again or load it back</div>
        </div>
      ) : (
        copied.map((entry) => <Entry key={entry.id} entry={entry} />)
      )}
    </>
  );
}
