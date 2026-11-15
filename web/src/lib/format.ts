import type { CopyFormat, CopyScope, PropData, Session, Vec } from '@/types';
import { convertRotation } from '@/lib/rotation';

// emote scripts commonly attach every prop with rotation order 1, so the Emote format is always written for that order
export const EMOTE_ORDER = 1;
export const EMOTE_MAX_PROPS = 2;

/** 0.0291 → "0.0291", 2 → "2.0", -0 → "0.0" */
export function num(value: number): string {
  const rounded = Number(value.toFixed(4));
  if (Object.is(rounded, -0) || rounded === 0) return '0.0';
  const text = String(rounded);
  return text.includes('.') ? text : `${text}.0`;
}

const six = (pos: Vec, rot: Vec): string => [pos.x, pos.y, pos.z, rot.x, rot.y, rot.z].map(num).join(', ');

function attachCall(prop: PropData): string {
  return (
    `AttachEntityToEntity(prop, PlayerPedId(), GetPedBoneIndex(PlayerPedId(), ${prop.bone}), ` +
    `${six(prop.pos, prop.rot)}, true, true, false, true, ${prop.order}, true)`
  );
}

function emoteBlock(props: PropData[]): string {
  const lines: string[] = [];

  props.slice(0, EMOTE_MAX_PROPS).forEach((prop, index) => {
    const key = index === 0 ? 'Prop' : 'SecondProp';
    const rot = convertRotation(prop.rot, prop.order, EMOTE_ORDER);

    lines.push(`${key} = "${prop.model}",`);
    lines.push(`${key}Bone = ${prop.bone},`);
    lines.push(`${key}Placement = { ${six(prop.pos, rot)} },`);
  });

  return lines.join('\n');
}

function luaEntry(prop: PropData): string {
  return (
    `{ model = "${prop.model}", bone = ${prop.bone}, ` +
    `pos = vec3(${num(prop.pos.x)}, ${num(prop.pos.y)}, ${num(prop.pos.z)}), ` +
    `rot = vec3(${num(prop.rot.x)}, ${num(prop.rot.y)}, ${num(prop.rot.z)}), rotationOrder = ${prop.order} },`
  );
}

export function toSession(props: PropData[], anim: { dict: string; name: string; flag: number } | null): Session {
  return { props: props.map(({ id: _id, ...rest }) => rest), anim };
}

function jsonBlock(props: PropData[], anim: Session['anim']): string {
  return JSON.stringify({
    props: props.map((prop) => ({
      model: prop.model,
      bone: prop.bone,
      pos: { x: Number(prop.pos.x.toFixed(4)), y: Number(prop.pos.y.toFixed(4)), z: Number(prop.pos.z.toFixed(4)) },
      rot: { x: Number(prop.rot.x.toFixed(4)), y: Number(prop.rot.y.toFixed(4)), z: Number(prop.rot.z.toFixed(4)) },
      rotOrder: prop.order,
      visible: prop.visible,
    })),
    anim: anim ?? undefined,
  });
}

/** The text a Copy button puts on the clipboard */
export function buildCopy(
  format: CopyFormat,
  scope: CopyScope,
  props: PropData[],
  selected: PropData | null,
  anim: Session['anim'],
): string {
  const list = scope === 'all' || !selected ? props : [selected];

  if (list.length === 0) return '';

  switch (format) {
    case 'attach':
      return list.map(attachCall).join('\n');
    case 'values':
      return list.map((prop) => six(prop.pos, prop.rot)).join('\n');
    case 'emote':
      return emoteBlock(list);
    case 'lua':
      return list.map(luaEntry).join('\n');
    case 'json':
      return jsonBlock(list, anim);
  }
}

/** Props the Emote format has to leave out */
export function emoteOverflow(scope: CopyScope, props: PropData[]): number {
  return scope === 'all' ? Math.max(0, props.length - EMOTE_MAX_PROPS) : 0;
}
