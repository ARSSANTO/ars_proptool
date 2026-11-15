import { useEffect } from 'react';
import { RiCheckLine, RiErrorWarningFill } from 'react-icons/ri';
import { useEditorStore } from '@/store/editorStore';
import type { Toast } from '@/types';

// ok toasts 3.5 s, undo 6 s, errors stay long enough to read (guide 8.6, 9)
const lifetime = (toast: Toast): number => (toast.kind === 'error' ? 8000 : toast.action ? 6000 : 3500);

function ToastRow({ toast }: { toast: Toast }) {
  const drop = useEditorStore((s) => s.dropToast);

  useEffect(() => {
    const timer = window.setTimeout(() => drop(toast.id), lifetime(toast));
    return () => window.clearTimeout(timer);
  }, [toast, drop]);

  return (
    <div className={`toast is-${toast.kind}`} role="status" onClick={() => !toast.action && drop(toast.id)}>
      {toast.kind === 'ok' ? <RiCheckLine size={18} /> : <RiErrorWarningFill size={18} />}
      <span>{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.run();
            drop(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export function Toasts() {
  const toasts = useEditorStore((s) => s.toasts);

  return (
    <div className="toasts">
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
