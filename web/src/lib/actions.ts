import { fetchNui, type NuiReply } from '@/lib/nui';
import { boneIds } from '@/lib/bones';
import { buildCopy, toSession } from '@/lib/format';
import { copyText } from '@/lib/clipboard';
import { convertRotation } from '@/lib/rotation';
import { DEFAULT_ANIM, DEFAULT_LIGHT, DEFAULT_SCENE, selectedProp, useEditorStore } from '@/store/editorStore';
import type { CamSpeed, HistoryEntry, LightInfo, OpenData, PropData, Session, Vec } from '@/types';

const get = () => useEditorStore.getState();

export const toast = (text: string, kind: 'ok' | 'error' = 'ok', action?: { label: string; run: () => void }) =>
  get().pushToast(text, kind, action);

const clone = (prop: PropData): PropData => ({ ...prop, pos: { ...prop.pos }, rot: { ...prop.rot } });

// ---------------------------------------------------------------------------------------------
// Props. The page changes at once; the client gets the change a moment later (one message per prop per tick) and
// the prop goes back to the last accepted state if the client refuses.
// ---------------------------------------------------------------------------------------------
const confirmed = new Map<number, PropData>();
const pending = new Map<number, Partial<PropData>>();
let flushTimer: number | undefined;

async function flush(): Promise<void> {
  flushTimer = undefined;

  const batch = [...pending.entries()];
  pending.clear();

  for (const [id, patch] of batch) {
    const reply = await fetchNui<NuiReply>('proptool:propSet', { id, ...patch });

    if (reply?.ok) {
      const base = confirmed.get(id);
      if (base) confirmed.set(id, { ...base, ...patch });
      continue;
    }

    toast(reply?.error ?? 'The game did not answer', 'error');

    const back = confirmed.get(id);
    if (back) get().patchProp(id, clone(back));
  }
}

export function editProp(id: number, patch: Partial<PropData>): void {
  get().patchProp(id, patch);
  pending.set(id, { ...pending.get(id), ...patch });

  if (flushTimer === undefined) flushTimer = window.setTimeout(() => void flush(), 50);

  scheduleLastSave();
}

/** Applied by the client while a gizmo moves the prop: the numbers follow, nothing is sent back */
export function applyTransform(id: number, pos: Vec, rot: Vec): void {
  get().patchProp(id, { pos, rot });

  const base = confirmed.get(id);
  if (base) confirmed.set(id, { ...base, pos: { ...pos }, rot: { ...rot } });

  scheduleLastSave();
}

export function nudge(id: number, field: 'pos' | 'rot', axis: keyof Vec, delta: number): void {
  const prop = get().props.find((p) => p.id === id);
  if (!prop) return;

  editProp(id, { [field]: { ...prop[field], [axis]: prop[field][axis] + delta } });
}

export function setAxis(id: number, field: 'pos' | 'rot', axis: keyof Vec, value: number): void {
  const prop = get().props.find((p) => p.id === id);
  if (!prop || !Number.isFinite(value)) return;

  editProp(id, { [field]: { ...prop[field], [axis]: value } });
}

export function resetField(id: number, field: 'pos' | 'rot'): void {
  editProp(id, { [field]: { x: 0, y: 0, z: 0 } });
}

export function setOrder(id: number, order: number): void {
  const prop = get().props.find((p) => p.id === id);
  if (!prop || prop.order === order) return;

  // Keep angle: the same orientation written for the new order, so the prop does not move
  if (get().keepAngle) {
    editProp(id, { order, rot: convertRotation(prop.rot, prop.order, order) });
  } else {
    editProp(id, { order });
  }
}

export function selectProp(id: number): void {
  get().select(id);
}

export async function addProp(model: string, bone?: number): Promise<boolean> {
  const name = model.trim();

  if (!name) {
    toast('Type a prop model', 'error');
    return false;
  }

  const current = selectedProp(get());
  const reply = await fetchNui<NuiReply & { prop?: PropData }>('proptool:propAdd', {
    model: name,
    bone: bone ?? current?.bone ?? get().config.defaultBone,
  });

  if (!reply?.ok || !reply.prop) {
    toast(reply?.error ?? 'The game did not answer', 'error');
    return false;
  }

  confirmed.set(reply.prop.id, clone(reply.prop));
  get().addProp(reply.prop);
  scheduleLastSave();
  return true;
}

export async function removeProp(id: number): Promise<void> {
  const prop = get().props.find((p) => p.id === id);
  if (!prop) return;

  const reply = await fetchNui<NuiReply>('proptool:propRemove', { id });

  if (!reply?.ok) {
    toast(reply?.error ?? 'The game did not answer', 'error');
    return;
  }

  confirmed.delete(id);
  get().removeProp(id);
  scheduleLastSave();

  toast(`${prop.model} removed`, 'ok', {
    label: 'Undo',
    run: () => void addProp(prop.model, prop.bone).then((ok) => ok && restoreLatest(prop)),
  });
}

// the prop an undo brings back keeps its numbers
function restoreLatest(prop: PropData): void {
  const latest = get().props[get().props.length - 1];
  if (latest) editProp(latest.id, { pos: prop.pos, rot: prop.rot, order: prop.order, visible: prop.visible });
}

export function toggleVisible(id: number): void {
  const prop = get().props.find((p) => p.id === id);
  if (prop) editProp(id, { visible: !prop.visible });
}

// ---------------------------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------------------------
export async function openEditor(data: OpenData): Promise<void> {
  const store = get();
  const props = data.props ?? [];

  confirmed.clear();
  props.forEach((prop) => confirmed.set(prop.id, clone(prop)));
  store.setProps(props, data.selected ?? props[0]?.id ?? null);

  const defaults = store.config.defaultAnim;
  const dict = data.anim?.dict;

  store.setAnim({
    ...DEFAULT_ANIM,
    dict: dict ?? defaults.dict,
    name: data.anim?.name ?? defaults.name,
    flag: data.anim?.flag ?? defaults.flag,
    speed: data.anim?.speed ?? 1,
    paused: data.anim?.paused ?? false,
    loaded: Boolean(dict),
    playing: Boolean(dict),
  });
  store.setScene({
    ...DEFAULT_SCENE,
    backdropOn: data.scene?.backdrop?.enabled ?? false,
    color: data.scene?.backdrop?.color ?? store.config.backdropColor,
    hour: data.scene?.hour ?? DEFAULT_SCENE.hour,
    weather: data.scene?.weather ?? null,
    light: { ...DEFAULT_LIGHT, ...data.scene?.light },
  });
  void fetchNui('proptool:camSpeed', get().camSpeed);
  store.setTab('attach');
  store.setTest(false);
  store.setNativeGizmo(false);
  store.setGizmo(null);
  store.setBonePicking(false);
  store.setVisible(true);

  const check = await fetchNui<{ invalid?: number[] }>('proptool:checkBones', { ids: boneIds() });
  store.setInvalidBones(check?.invalid ?? []);
}

export function closeEditor(): void {
  void fetchNui('proptool:close');
  const store = get();
  store.setVisible(false);
  store.setGizmo(null);
  store.setNativeGizmo(false);
  store.setBonePicking(false);
  store.setTest(false);
}

export async function startTest(): Promise<void> {
  const reply = await fetchNui<NuiReply>('proptool:test');
  if (!reply?.ok) toast(reply?.error ?? 'The game did not answer', 'error');
}

// ---------------------------------------------------------------------------------------------
// Gizmo
// ---------------------------------------------------------------------------------------------
export async function startGizmo(native = false): Promise<void> {
  const id = get().selectedId;

  if (id === null) {
    toast('Add a prop first', 'error');
    return;
  }

  const reply = await fetchNui<NuiReply>(native ? 'proptool:gizmoNative' : 'proptool:gizmoStart', { id });
  if (!reply?.ok) toast(reply?.error ?? 'The gizmo could not open', 'error');
}

export const gizmoSave = (): void => void fetchNui('proptool:gizmoSave');
export const gizmoCancel = (): void => void fetchNui('proptool:gizmoCancel');

export function sendGizmoMove(pos: Vec, rot: Vec): void {
  void fetchNui('proptool:gizmoMove', { position: pos, rotation: rot });
}

// ---------------------------------------------------------------------------------------------
// Bone picking in the world
// ---------------------------------------------------------------------------------------------
export function setBonePicking(on: boolean): void {
  const store = get();
  const invalid = new Set(store.invalidBones);

  store.setBonePicking(on);
  void fetchNui('proptool:bonePick', { active: on, ids: boneIds().filter((id) => !invalid.has(id)) });
}

// ---------------------------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------------------------
export async function playAnim(): Promise<void> {
  const { dict, name, flag } = get().anim;
  const reply = await fetchNui<NuiReply>('proptool:animPlay', { dict: dict.trim(), name: name.trim(), flag });

  if (!reply?.ok) {
    toast(reply?.error ?? 'The game did not answer', 'error');
    return;
  }

  get().setAnim({ loaded: true, playing: true, paused: false, time: 0 });
  scheduleLastSave();
}

export async function stopAnim(): Promise<void> {
  await fetchNui('proptool:animStop');
  get().setAnim({ loaded: false, playing: false, paused: false, time: 0 });
  scheduleLastSave();
}

export async function setPaused(paused: boolean): Promise<void> {
  if (!get().anim.loaded) {
    await playAnim();
    return;
  }

  const reply = await fetchNui<NuiReply>('proptool:animPause', { paused });
  if (reply?.ok) get().setAnim({ paused });
  else toast(reply?.error ?? 'The game did not answer', 'error');
}

export const togglePause = (): Promise<void> => setPaused(!get().anim.paused);

export function seekAnim(fraction: number): void {
  const store = get();
  if (!store.anim.loaded) return;

  if (!store.anim.paused) void setPaused(true);

  store.setAnim({ time: fraction });
  void fetchNui('proptool:animSeek', { fraction });
}

export async function setSpeed(speed: number): Promise<void> {
  const reply = await fetchNui<NuiReply>('proptool:animSpeed', { speed });
  if (reply?.ok) get().setAnim({ speed });
}

// ---------------------------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------------------------
export function setBackdrop(on: boolean): void {
  get().setScene({ backdropOn: on });
  void fetchNui('proptool:scene', { backdrop: { enabled: on } });
}

export function setBackdropColor(color: string): void {
  get().setScene({ color, backdropOn: true });
  void fetchNui('proptool:scene', { backdrop: { enabled: true, color } });
}

export function setHour(hour: number): void {
  get().setScene({ hour });
  void fetchNui('proptool:scene', { hour });
}

export function setLight(patch: Partial<LightInfo>): void {
  get().setScene({ light: { ...get().scene.light, ...patch } });
  void fetchNui('proptool:scene', { light: patch });
}

// camera speed: the client scales its look and move speeds, and the choice is kept per client
let camTimer: number | undefined;

export function setCamSpeed(patch: Partial<CamSpeed>): void {
  const next = { ...get().camSpeed, ...patch };

  get().setCamSpeed(next);
  void fetchNui('proptool:camSpeed', next);

  window.clearTimeout(camTimer);
  camTimer = window.setTimeout(() => void fetchNui('proptool:store', { key: 'camera', value: JSON.stringify(next) }), 800);
}

export function parseCamSpeed(text: string | null | undefined): CamSpeed | null {
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as Partial<CamSpeed>;
    const look = Number(parsed.look);
    const move = Number(parsed.move);

    return look >= 0.2 && look <= 2 && move >= 0.2 && move <= 2 ? { look, move } : null;
  } catch {
    return null;
  }
}

export function setWeather(weather: string): void {
  get().setScene({ weather });
  void fetchNui('proptool:scene', { weather });
}

// ---------------------------------------------------------------------------------------------
// History: the last session saves itself, everything copied is kept
// ---------------------------------------------------------------------------------------------
const MAX_COPIED = 30;
let lastTimer: number | undefined;

export function currentSession(): Session {
  const { props, anim } = get();
  return toSession(props, anim.loaded ? { dict: anim.dict, name: anim.name, flag: anim.flag } : null);
}

export function scheduleLastSave(): void {
  window.clearTimeout(lastTimer);

  lastTimer = window.setTimeout(() => {
    if (!get().visible) return;

    const session = currentSession();
    get().setLast(session);
    void fetchNui('proptool:store', { key: 'last', value: JSON.stringify(session) });
  }, 1200);
}

export function parseSession(text: string | null | undefined): Session | null {
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as Session;
    return Array.isArray(parsed?.props) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseCopied(text: string | null | undefined): HistoryEntry[] {
  if (!text) return [];

  try {
    const parsed = JSON.parse(text) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry?.text === 'string') : [];
  } catch {
    return [];
  }
}

function saveCopied(list: HistoryEntry[]): void {
  void fetchNui('proptool:store', { key: 'copied', value: JSON.stringify(list) });
}

export async function copyCurrent(): Promise<boolean> {
  const store = get();
  const { props, copyFormat, copyScope, anim } = store;
  const text = buildCopy(
    copyFormat,
    copyScope,
    props,
    selectedProp(store),
    anim.loaded ? { dict: anim.dict, name: anim.name, flag: anim.flag } : null,
  );

  if (!text) {
    toast('There is nothing to copy yet', 'error');
    return false;
  }

  const ok = await copyText(text);

  if (!ok) {
    toast('The clipboard is not available', 'error');
    return false;
  }

  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    format: copyFormat,
    scope: copyScope,
    text,
    session: currentSession(),
  };
  const list = [entry, ...store.copied].slice(0, MAX_COPIED);

  store.setCopied(list);
  saveCopied(list);
  toast('Copied');
  return true;
}

export async function copyAgain(entry: HistoryEntry): Promise<void> {
  const ok = await copyText(entry.text);
  toast(ok ? 'Copied' : 'The clipboard is not available', ok ? 'ok' : 'error');
}

export function clearCopied(): void {
  get().setCopied([]);
  saveCopied([]);
}

/** Replaces what is on the ped with a saved session */
export async function loadSession(session: Session): Promise<void> {
  for (const prop of [...get().props]) {
    await fetchNui('proptool:propRemove', { id: prop.id });
  }

  confirmed.clear();
  get().setProps([], null);

  for (const prop of session.props) {
    const reply = await fetchNui<NuiReply & { prop?: PropData }>('proptool:propAdd', prop);

    if (reply?.ok && reply.prop) {
      confirmed.set(reply.prop.id, clone(reply.prop));
      get().addProp(reply.prop);
    } else {
      toast(`${prop.model}: ${reply?.error ?? 'The game did not answer'}`, 'error');
    }
  }

  const first = get().props[0];
  if (first) get().select(first.id);

  if (session.anim) {
    get().setAnim({ ...session.anim });
    await playAnim();
  } else {
    await stopAnim();
  }

  get().setTab('attach');
  toast('Loaded');
}
