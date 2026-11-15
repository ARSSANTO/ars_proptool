import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RiAddLine, RiArrowDownSLine, RiArrowUpSLine, RiCheckLine, RiSearchLine, RiSubtractLine } from 'react-icons/ri';

// ---------------------------------------------------------------------------------------------
// Segmented control: a solid fill slides behind the active option (guide 9)
// ---------------------------------------------------------------------------------------------
interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div className="seg" role="tablist">
      <span
        className="seg-fill"
        style={{ width: `calc((100% - 0.6rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Toggle: the one on/off control (guide 9)
// ---------------------------------------------------------------------------------------------
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`toggle ${on ? 'is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="toggle-fill" />
      <span className="toggle-thumb" />
    </button>
  );
}

// ---------------------------------------------------------------------------------------------
// Number field: − value + , hold a button to repeat, drag the axis letter to scrub, arrows inside the box
// ---------------------------------------------------------------------------------------------
interface NumberFieldProps {
  axis: string;
  value: number;
  step: number;
  decimals?: number;
  onNudge: (delta: number) => void;
  onSet: (value: number) => void;
}

const HOLD_DELAY = 380;
const HOLD_EVERY = 70;
const SCRUB_PIXELS = 5;

export function NumberField({ axis, value, step, decimals = 4, onNudge, onSet }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false); // Esc blurs the field, and the blur must not commit
  const timers = useRef<{ delay?: number; every?: number }>({});
  const scrub = useRef<{ x: number; carry: number } | null>(null);
  const stepRef = useRef(step);
  const nudgeRef = useRef(onNudge);

  stepRef.current = step;
  nudgeRef.current = onNudge;

  const stopHold = useCallback(() => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.every);
  }, []);

  useEffect(() => stopHold, [stopHold]);

  const startHold = (direction: 1 | -1) => {
    nudgeRef.current(direction * stepRef.current);
    stopHold();
    timers.current.delay = window.setTimeout(() => {
      timers.current.every = window.setInterval(() => nudgeRef.current(direction * stepRef.current), HOLD_EVERY);
    }, HOLD_DELAY);
  };

  const text = draft ?? String(Number(value.toFixed(decimals)));

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }

    if (draft === null) return;

    const parsed = Number(draft.replace(',', '.'));
    setDraft(null);
    if (draft.trim() !== '' && Number.isFinite(parsed)) onSet(parsed);
  };

  return (
    <div className="num">
      <span
        className="num-axis"
        data-axis={axis}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          scrub.current = { x: e.clientX, carry: 0 };
        }}
        onPointerMove={(e) => {
          const state = scrub.current;
          if (!state) return;

          state.carry += e.clientX - state.x;
          state.x = e.clientX;

          const steps = Math.trunc(state.carry / SCRUB_PIXELS);
          if (steps !== 0) {
            state.carry -= steps * SCRUB_PIXELS;
            nudgeRef.current(steps * stepRef.current);
          }
        }}
        onPointerUp={() => {
          scrub.current = null;
        }}
        onPointerCancel={() => {
          scrub.current = null;
        }}
        onDoubleClick={() => onSet(0)}
      >
        {axis}
      </span>
      <button
        type="button"
        className="num-step"
        aria-label={`${axis} minus`}
        onPointerDown={() => startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
      >
        <RiSubtractLine size={14} />
      </button>
      <input
        value={text}
        inputMode="decimal"
        aria-label={axis}
        onFocus={(e) => {
          setDraft(String(Number(value.toFixed(decimals))));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            cancelled.current = true;
            e.currentTarget.blur();
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            onNudge((e.key === 'ArrowUp' ? 1 : -1) * step);
            setDraft(null);
          }
        }}
      />
      <button
        type="button"
        className="num-step"
        aria-label={`${axis} plus`}
        onPointerDown={() => startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
      >
        <RiAddLine size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Floating menus. They are drawn in #ui-portal (a .ui root outside the panel, so the panel's transform does not
// move them) and placed from the anchor's box.
// ---------------------------------------------------------------------------------------------
const portalRoot = (): HTMLElement => document.getElementById('ui-portal') ?? document.body;

export function useAnchorBox(anchor: HTMLElement | null, height: number) {
  const [box, setBox] = useState<{ left: number; top: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const top = below >= height + 12 || below >= rect.top ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);

    setBox({ left: rect.left, top, width: rect.width });
  }, [anchor, height]);

  return box;
}

/** Esc closes the top menu only: this listener runs first and stops the editor's own Esc */
export function useMenuKeys(onClose: () => void, onMove: (delta: number) => void, onPick: () => void) {
  const handlers = useRef({ onClose, onMove, onPick });
  handlers.current = { onClose, onMove, onPick };

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handlers.current.onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handlers.current.onMove(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handlers.current.onMove(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handlers.current.onPick();
      }
    };

    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, []);
}

export interface Option<T> {
  value: T;
  label: string;
  desc?: string;
  meta?: string;
}

interface DropdownProps<T extends string | number> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  searchable?: boolean;
  placeholder?: string;
  shown?: string; // what the closed field shows, when it is not the option's label
  meta?: string;
}

const ROW = 36;
const LIST_MAX = 360;

export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  searchable,
  placeholder,
  shown,
  meta,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`pick ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{shown ?? current?.label ?? placeholder ?? ''}</span>
        {meta !== undefined || current?.meta ? <em>{meta ?? current?.meta}</em> : null}
        {open ? <RiArrowUpSLine size={18} /> : <RiArrowDownSLine size={18} />}
      </button>
      {open &&
        createPortal(
          <DropdownMenu
            anchor={button.current}
            value={value}
            options={options}
            searchable={searchable}
            onPick={(next) => {
              setOpen(false);
              onChange(next);
            }}
            onClose={() => setOpen(false)}
          />,
          portalRoot(),
        )}
    </>
  );
}

interface MenuProps<T extends string | number> {
  anchor: HTMLElement | null;
  value: T;
  options: Option<T>[];
  searchable?: boolean;
  onPick: (value: T) => void;
  onClose: () => void;
}

function DropdownMenu<T extends string | number>({ anchor, value, options, searchable, onPick, onClose }: MenuProps<T>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.meta ?? ''}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const height = Math.min(LIST_MAX, rows.length * (options.some((o) => o.desc) ? 52 : ROW)) + (searchable ? 48 : 8);
  const box = useAnchorBox(anchor, height);

  useEffect(() => {
    const start = rows.findIndex((o) => o.value === value);
    setActive(start >= 0 ? start : 0);
    // only when the list itself changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  useMenuKeys(
    onClose,
    (delta) => setActive((i) => Math.max(0, Math.min(rows.length - 1, i + delta))),
    () => rows[active] && onPick(rows[active].value),
  );

  if (!box) return null;

  return (
    <>
      <div className="pop-backdrop" onMouseDown={onClose} onContextMenu={(e) => e.preventDefault()} />
      <div className="pop" style={{ left: box.left, top: box.top, width: Math.max(box.width, 240) }}>
        {searchable && (
          <label className="pop-search">
            <RiSearchLine size={16} />
            <input
              autoFocus
              value={query}
              placeholder="Search by name or id"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        )}
        <div className="pop-list" ref={list} style={{ maxHeight: LIST_MAX }} role="listbox">
          {rows.length === 0 && <div className="pop-empty">Nothing matches that</div>}
          {rows.map((o, i) => (
            <button
              key={String(o.value)}
              type="button"
              role="option"
              aria-selected={o.value === value}
              data-active={i === active}
              className={`pop-item ${i === active ? 'is-lamp' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(o.value)}
            >
              <span>
                {o.label}
                {o.desc && <small>{o.desc}</small>}
              </span>
              {o.value === value ? <RiCheckLine size={18} /> : o.meta ? <em>{o.meta}</em> : null}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
