import { useState } from 'react';
import { RiArrowDownSLine, RiArrowUpSLine, RiCheckLine } from 'react-icons/ri';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { Segmented, Toggle } from '@/components/ui/Controls';
import { parseHex, toHexShown } from '@/lib/color';
import { setBackdrop, setBackdropColor, setCamSpeed, setHour, setLight, setWeather } from '@/lib/actions';
import { useEditorStore } from '@/store/editorStore';

const SWATCHES = ['#1B2430', '#0D1117', '#E6E6E6', '#6E5C4C', '#12B84A', '#0A4BD0', '#7B2FF7'];
const LIGHT_SWATCHES = ['#FFFFFF', '#FFF0DC', '#FFB347', '#FF5A5A', '#4DA6FF', '#B266FF'];

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  shown: string;
  onChange: (value: number) => void;
}

function SliderRow({ label, value, min, max, step, shown, onChange }: SliderRowProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--p' as string]: `${percent}%` }}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="value-chip" style={{ width: '5.2rem', textAlign: 'right', flex: 'none' }}>
        {shown}
      </span>
    </div>
  );
}

const WEATHERS = [
  'EXTRASUNNY', 'CLEAR', 'NEUTRAL',
  'SMOG', 'FOGGY', 'OVERCAST',
  'CLOUDS', 'CLEARING', 'RAIN',
  'THUNDER', 'SNOW', 'BLIZZARD',
  'SNOWLIGHT', 'XMAS', 'HALLOWEEN',
];

const PRESETS: { label: string; hour: number }[] = [
  { label: 'Dawn', hour: 6 },
  { label: 'Noon', hour: 12 },
  { label: 'Sunset', hour: 18.5 },
  { label: 'Night', hour: 23 },
];

const clock = (hour: number): string => {
  const whole = Math.floor(hour);
  const minutes = Math.floor((hour - whole) * 60);
  return `${String(whole % 24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export function SceneTab() {
  const scene = useEditorStore((s) => s.scene);
  const camSpeed = useEditorStore((s) => s.camSpeed);
  const light = scene.light;
  const backdropRgb = scene.color.slice(0, 7).toUpperCase(); // the swatch in use, whatever the opacity
  const [pickerOpen, setPickerOpen] = useState(false);
  const rgba = parseHex(scene.color) ?? { r: 0, g: 0, b: 0, a: 255 };

  return (
    <>
      <section className="card">
        <div className="card-title">
          <span>Backdrop</span>
          <Toggle on={scene.backdropOn} onChange={setBackdrop} label="Backdrop" />
        </div>
        <p className="sub" style={{ margin: 0 }}>
          A solid box around you so the world behind does not get in the way. Props and walls inside the box still show, so stand in the open.
        </p>
        <div className="swatches">
          {SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              className={`swatch ${scene.backdropOn && color.toUpperCase() === backdropRgb ? 'is-on' : ''}`}
              style={{ background: color }}
              aria-label={`Backdrop ${color}`}
              onClick={() => setBackdropColor(`${color}FF`)}
            >
              {scene.backdropOn && color.toUpperCase() === backdropRgb && <RiCheckLine size={18} />}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`pick ${pickerOpen ? 'is-open' : ''}`}
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="swatch-dot" style={{ background: `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a / 255})` }} />
            Custom colour
          </span>
          <em>{toHexShown(rgba)}</em>
          {pickerOpen ? <RiArrowUpSLine size={18} /> : <RiArrowDownSLine size={18} />}
        </button>
        {pickerOpen && (
          <div className="cp-wrap">
            <ColorPicker value={scene.color} onChange={setBackdropColor} />
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-title">
          <span>Time</span>
          <span className="value-chip">{clock(scene.hour)}</span>
        </div>
        <input
          className="slider"
          type="range"
          min={0}
          max={24}
          step={0.25}
          value={scene.hour}
          style={{ ['--p' as string]: `${(scene.hour / 24) * 100}%` }}
          aria-label="Time of day"
          onChange={(e) => setHour(Number(e.target.value))}
        />
        <div className="seg" style={{ marginTop: '1.2rem', gridAutoColumns: '1fr' }}>
          {PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setHour(p.hour)}>
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-title">
          <span>Spotlight</span>
          <Toggle on={light.enabled} onChange={(enabled) => setLight({ enabled })} label="Spotlight" />
        </div>
        <div className="swatches is-small">
          {LIGHT_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              className={`swatch ${color === light.color.toUpperCase() ? 'is-on' : ''}`}
              style={{ background: color }}
              aria-label={`Light ${color}`}
              onClick={() => setLight({ color, enabled: true })}
            />
          ))}
        </div>
        <SliderRow label="Brightness" value={light.brightness} min={1} max={60} step={1} shown={String(light.brightness)} onChange={(brightness) => setLight({ brightness })} />
        <SliderRow label="Spread" value={light.spread} min={5} max={70} step={1} shown={`${light.spread}°`} onChange={(spread) => setLight({ spread })} />
        <div className="field-row">
          <div className="field-label">Position</div>
          <Segmented
            value={light.follow ? 'camera' : 'front'}
            options={[
              { value: 'camera', label: 'Follows the camera' },
              { value: 'front', label: 'Front and above' },
            ]}
            onChange={(position) => setLight({ follow: position === 'camera' })}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-title">Weather</div>
        <div className="weather-grid">
          {WEATHERS.map((w) => (
            <button key={w} type="button" className={scene.weather === w ? 'is-on' : ''} onClick={() => setWeather(w)}>
              {w}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-title">Camera</div>
        <SliderRow label="Look speed" value={Math.round(camSpeed.look * 100)} min={20} max={200} step={5} shown={`${Math.round(camSpeed.look * 100)}%`} onChange={(v) => setCamSpeed({ look: v / 100 })} />
        <SliderRow label="Move speed" value={Math.round(camSpeed.move * 100)} min={20} max={200} step={5} shown={`${Math.round(camSpeed.move * 100)}%`} onChange={(v) => setCamSpeed({ move: v / 100 })} />
      </section>
    </>
  );
}
