export interface Rgba {
  r: number; // 0-255
  g: number;
  b: number;
  a: number; // 0-255
}

export interface Hsv {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const byte = (value: number): number => Math.round(clamp(value, 0, 255));
const hex2 = (value: number): string => byte(value).toString(16).padStart(2, '0').toUpperCase();

/** "#RRGGBB" or "#RRGGBBAA" (the # is optional) */
export function parseHex(text: string): Rgba | null {
  const match = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(text.trim());
  if (!match) return null;

  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: match[2] ? parseInt(match[2], 16) : 255 };
}

/** Always "#RRGGBBAA", the form the client reads */
export const toHex8 = ({ r, g, b, a }: Rgba): string => `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`;

/** "#RRGGBB" when solid, "#RRGGBBAA" when not: what the player sees in the field */
export const toHexShown = (c: Rgba): string => (byte(c.a) === 255 ? toHex8(c).slice(0, 7) : toHex8(c));

export function rgbToHsv({ r, g, b }: Rgba): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv, a = 255): Rgba {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return { r: byte((rgb[0] + m) * 255), g: byte((rgb[1] + m) * 255), b: byte((rgb[2] + m) * 255), a: byte(a) };
}
