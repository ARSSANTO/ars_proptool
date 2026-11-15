import { useEffect, useRef, useState } from 'react';
import { hsvToRgb, parseHex, rgbToHsv, toHex8, toHexShown, type Hsv, type Rgba } from '@/lib/color';

/** A text field that commits on Enter or blur and goes back on Esc */
function Box({ label, value, width, onCommit }: { label: string; value: string; width?: string; onCommit: (text: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const cancelled = useRef(false); // Esc blurs the field, and the blur must not commit

  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(null);
      return;
    }

    if (draft !== null) onCommit(draft);
    setDraft(null);
  };

  return (
    <label className="cp-box" style={width ? { width } : { flex: 1 }}>
      <span>{label}</span>
      <input
        value={draft ?? value}
        spellCheck={false}
        onFocus={(e) => {
          setDraft(value);
          e.currentTarget.select();
        }}
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

interface ColorPickerProps {
  value: string; // "#RRGGBB" or "#RRGGBBAA"
  onChange: (hex8: string) => void;
}

/** RGBA picker: saturation / value square, hue bar, alpha bar, hex and R G B A fields. No native picker (guide 9). */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const incoming = parseHex(value) ?? { r: 0, g: 0, b: 0, a: 255 };
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(incoming));
  const [alpha, setAlpha] = useState(incoming.a);
  const frame = useRef(0);
  const latest = useRef<Rgba>(incoming);
  const area = useRef<HTMLDivElement>(null);

  // the colour changed from outside (a swatch): follow it, but keep the hue when the colour has none
  useEffect(() => {
    const next = parseHex(value);
    if (!next || toHex8(next) === toHex8(latest.current)) return;

    latest.current = next;
    const converted = rgbToHsv(next);
    setHsv((prev) => (converted.s === 0 || converted.v === 0 ? { ...converted, h: prev.h } : converted));
    setAlpha(next.a);
  }, [value]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // one message per frame while dragging
  const emit = (next: Rgba) => {
    latest.current = next;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => onChange(toHex8(latest.current)));
  };

  const setColor = (nextHsv: Hsv, nextAlpha: number) => {
    setHsv(nextHsv);
    setAlpha(nextAlpha);
    emit(hsvToRgb(nextHsv, nextAlpha));
  };

  const setFromRgba = (rgba: Rgba) => {
    const converted = rgbToHsv(rgba);
    const nextHsv = converted.s === 0 || converted.v === 0 ? { ...converted, h: hsv.h } : converted;

    setHsv(nextHsv);
    setAlpha(rgba.a);
    emit(rgba);
  };

  const dragSquare = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = area.current?.getBoundingClientRect();
    if (!box) return;

    const s = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const v = 1 - Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    setColor({ h: hsv.h, s, v }, alpha);
  };

  const rgb = hsvToRgb(hsv, alpha);
  const solid = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  const num = (text: string, max: number): number | null => {
    const n = Number(text);
    return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : null;
  };

  return (
    <div className="cp">
      <div
        ref={area}
        className="cp-square"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragSquare(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) dragSquare(e);
        }}
      >
        <span className="cp-knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
      </div>

      <input
        className="slider is-bar is-hue"
        type="range"
        min={0}
        max={360}
        value={Math.round(hsv.h)}
        aria-label="Hue"
        onChange={(e) => setColor({ ...hsv, h: Number(e.target.value) }, alpha)}
      />
      <input
        className="slider is-bar is-alpha"
        type="range"
        min={0}
        max={255}
        value={alpha}
        style={{ ['--cp-rgb' as string]: solid }}
        aria-label="Opacity"
        onChange={(e) => setColor(hsv, Number(e.target.value))}
      />

      <div className="cp-row">
        <span className="swatch-dot" style={{ background: `rgba(${solid}, ${alpha / 255})` }} />
        <Box
          label="Hex"
          value={toHexShown(rgb)}
          onCommit={(text) => {
            const parsed = parseHex(text);
            if (parsed) setFromRgba(parsed);
          }}
        />
      </div>
      <div className="cp-row">
        {(['r', 'g', 'b'] as const).map((channel) => (
          <Box
            key={channel}
            label={channel.toUpperCase()}
            value={String(rgb[channel])}
            onCommit={(text) => {
              const n = num(text, 255);
              if (n !== null) setFromRgba({ ...rgb, [channel]: n });
            }}
          />
        ))}
        <Box
          label="A %"
          value={String(Math.round((alpha / 255) * 100))}
          onCommit={(text) => {
            const n = num(text, 100);
            if (n !== null) setFromRgba({ ...rgb, a: Math.round((n / 100) * 255) });
          }}
        />
      </div>
    </div>
  );
}
