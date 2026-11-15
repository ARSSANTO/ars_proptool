import { useEffect, useState } from 'react';

/** The keys that are held right now, by `event.code` */
export function useKeysDown(): Set<string> {
  const [down, setDown] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const press = (e: KeyboardEvent) => {
      if (e.repeat) return;
      setDown((prev) => new Set(prev).add(e.code));
    };
    const lift = (e: KeyboardEvent) => {
      setDown((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };
    const clear = () => setDown(new Set());

    window.addEventListener('keydown', press);
    window.addEventListener('keyup', lift);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', press);
      window.removeEventListener('keyup', lift);
      window.removeEventListener('blur', clear);
    };
  }, []);

  return down;
}

interface KeycapProps {
  label: string;
  code?: string; // lights while this key is held
  down?: Set<string>;
  primary?: boolean;
}

export function Keycap({ label, code, down, primary }: KeycapProps) {
  const pressed = Boolean(code && down?.has(code));

  return <span className={`keycap ${primary ? 'is-primary' : ''} ${pressed ? 'is-down' : ''}`}>{label}</span>;
}
