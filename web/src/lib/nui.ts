import { useEffect, useRef } from 'react';

export const isEnvBrowser = (): boolean =>
  !(window as Window).invokeNative && typeof (window as Window).GetParentResourceName !== 'function';

const getResourceName = (): string =>
  typeof window.GetParentResourceName === 'function' ? window.GetParentResourceName() : 'ars_proptool';

const TIMEOUT_MS = 6000;

/** Calls a Lua callback. Resolves null when the client does not answer in time or fails (callers show it). */
export async function fetchNui<T = unknown>(event: string, data: object = {}): Promise<T | null> {
  if (isEnvBrowser()) {
    return new Promise((resolve) => setTimeout(() => resolve({ ok: true } as T), 20));
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`https://${getResourceName()}/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export interface NuiReply {
  ok?: boolean;
  error?: string;
}

interface NuiMessage<T = unknown> {
  action: string;
  data: T;
}

/** Posts a message to the window the way the client does. */
export function emulateNui(action: string, data: unknown = {}): void {
  window.dispatchEvent(new MessageEvent('message', { data: { action, data } }));
}

/** Runs `handler` for every client message with this action. The latest handler is always used. */
export function useNuiEvent<T = unknown>(action: string, handler: (data: T) => void): void {
  const saved = useRef(handler);

  useEffect(() => {
    saved.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (event: MessageEvent<NuiMessage<T>>) => {
      const msg = event.data;
      if (msg && msg.action === action) saved.current(msg.data);
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [action]);
}
