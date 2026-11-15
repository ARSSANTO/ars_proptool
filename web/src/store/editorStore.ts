import { create } from 'zustand';
import type {
  AnimInfo,
  CopyFormat,
  CamSpeed,
  CopyScope,
  EditorConfig,
  GizmoOpen,
  HistoryEntry,
  LightInfo,
  PropData,
  SceneInfo,
  Session,
  StepSize,
  Tab,
  Toast,
  Vec,
} from '@/types';

export type GizmoSpace = 'world' | 'local';
export type GizmoTool = 'translate' | 'rotate';

export const DEFAULT_ANIM: AnimInfo = {
  dict: '',
  name: '',
  flag: 49,
  speed: 1,
  paused: false,
  loaded: false,
  playing: false,
  time: 0,
};

export const DEFAULT_LIGHT: LightInfo = { enabled: false, color: '#FFF0DC', brightness: 20, spread: 35, follow: true };

export const DEFAULT_SCENE: SceneInfo = { backdropOn: false, color: '#0A4BD0', hour: 12, weather: null, light: DEFAULT_LIGHT };

const DEFAULT_CONFIG: EditorConfig = {
  side: 'left',
  backdropColor: '#0A4BD0',
  defaultModel: 'prop_cs_burger_01',
  defaultBone: 18905,
  defaultAnim: { dict: 'mp_player_inteat@burger', name: 'mp_player_int_eat_burger', flag: 49 },
};

interface EditorState {
  config: EditorConfig;
  visible: boolean;
  test: boolean;
  tab: Tab;

  props: PropData[];
  selectedId: number | null;
  invalidBones: number[];

  anim: AnimInfo;
  scene: SceneInfo;
  camSpeed: CamSpeed;

  step: StepSize;
  keepAngle: boolean;
  copyFormat: CopyFormat;
  copyScope: CopyScope;

  last: Session | null;
  copied: HistoryEntry[];

  gizmo: GizmoOpen | null; // the UI gizmo
  gizmoTool: GizmoTool;
  gizmoSpace: GizmoSpace;
  nativeGizmo: boolean; // the game's gizmo is running on the prop
  nativeAvailable: boolean; // the server lets the game's gizmo run, so it is offered
  bonePicking: boolean;

  toasts: Toast[];

  setConfig: (config: Partial<EditorConfig>) => void;
  setVisible: (visible: boolean) => void;
  setTest: (test: boolean) => void;
  setTab: (tab: Tab) => void;
  setProps: (props: PropData[], selectedId: number | null) => void;
  patchProp: (id: number, patch: Partial<PropData>) => void;
  addProp: (prop: PropData) => void;
  removeProp: (id: number) => void;
  select: (id: number | null) => void;
  setInvalidBones: (ids: number[]) => void;
  setAnim: (patch: Partial<AnimInfo>) => void;
  setScene: (patch: Partial<SceneInfo>) => void;
  setCamSpeed: (speed: CamSpeed) => void;
  setStep: (step: StepSize) => void;
  setKeepAngle: (on: boolean) => void;
  setCopyFormat: (format: CopyFormat) => void;
  setCopyScope: (scope: CopyScope) => void;
  setLast: (last: Session | null) => void;
  setCopied: (copied: HistoryEntry[]) => void;
  setGizmo: (gizmo: GizmoOpen | null) => void;
  setGizmoTool: (tool: GizmoTool) => void;
  setGizmoSpace: (space: GizmoSpace) => void;
  setNativeGizmo: (on: boolean) => void;
  setNativeAvailable: (on: boolean) => void;
  setBonePicking: (on: boolean) => void;
  pushToast: (text: string, kind?: Toast['kind'], action?: Toast['action']) => void;
  dropToast: (id: number) => void;
}

let toastId = 1;

export const useEditorStore = create<EditorState>()((set) => ({
  config: DEFAULT_CONFIG,
  visible: false,
  test: false,
  tab: 'attach',

  props: [],
  selectedId: null,
  invalidBones: [],

  anim: DEFAULT_ANIM,
  scene: DEFAULT_SCENE,
  camSpeed: { look: 1, move: 1 },

  step: 'fine',
  keepAngle: true,
  copyFormat: 'attach',
  copyScope: 'selected',

  last: null,
  copied: [],

  gizmo: null,
  gizmoTool: 'translate',
  gizmoSpace: 'world',
  nativeGizmo: false,
  nativeAvailable: false,
  bonePicking: false,

  toasts: [],

  setConfig: (config) => set((s) => ({ config: { ...s.config, ...config } })),
  setVisible: (visible) => set({ visible }),
  setTest: (test) => set({ test }),
  setTab: (tab) => set({ tab }),
  setProps: (props, selectedId) => set({ props, selectedId }),
  patchProp: (id, patch) => set((s) => ({ props: s.props.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
  addProp: (prop) => set((s) => ({ props: [...s.props, prop], selectedId: prop.id })),
  removeProp: (id) =>
    set((s) => {
      const props = s.props.filter((p) => p.id !== id);
      const selectedId = s.selectedId === id ? (props[props.length - 1]?.id ?? null) : s.selectedId;
      return { props, selectedId };
    }),
  select: (selectedId) => set({ selectedId }),
  setInvalidBones: (invalidBones) => set({ invalidBones }),
  setAnim: (patch) => set((s) => ({ anim: { ...s.anim, ...patch } })),
  setScene: (patch) => set((s) => ({ scene: { ...s.scene, ...patch } })),
  setCamSpeed: (camSpeed) => set({ camSpeed }),
  setStep: (step) => set({ step }),
  setKeepAngle: (keepAngle) => set({ keepAngle }),
  setCopyFormat: (copyFormat) => set({ copyFormat }),
  setCopyScope: (copyScope) => set({ copyScope }),
  setLast: (last) => set({ last }),
  setCopied: (copied) => set({ copied }),
  setGizmo: (gizmo) => set({ gizmo }),
  setGizmoTool: (gizmoTool) => set({ gizmoTool }),
  setGizmoSpace: (gizmoSpace) => set({ gizmoSpace }),
  setNativeGizmo: (nativeGizmo) => set({ nativeGizmo }),
  setNativeAvailable: (nativeAvailable) => set({ nativeAvailable }),
  setBonePicking: (bonePicking) => set({ bonePicking }),
  pushToast: (text, kind = 'ok', action) =>
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id: toastId++, text, kind, action }] })),
  dropToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const selectedProp = (s: EditorState): PropData | null =>
  s.props.find((p) => p.id === s.selectedId) ?? null;

export const ZERO: Vec = { x: 0, y: 0, z: 0 };
