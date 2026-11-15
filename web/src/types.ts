export interface Vec {
  x: number;
  y: number;
  z: number;
}

export interface PropData {
  id: number;
  model: string;
  bone: number;
  pos: Vec;
  rot: Vec;
  order: number;
  visible: boolean;
}

export interface AnimInfo {
  dict: string;
  name: string;
  flag: number;
  speed: number;
  paused: boolean;
  loaded: boolean; // a clip is set on the ped
  playing: boolean;
  time: number; // 0 to 1 through the clip
}

export interface LightInfo {
  enabled: boolean;
  color: string;
  brightness: number; // 1-60
  spread: number; // cone angle, degrees
  follow: boolean; // from the camera, or from the front
}

export interface CamSpeed {
  look: number; // 0.2 to 2, 1 = the default
  move: number;
}

export interface SceneInfo {
  backdropOn: boolean;
  color: string;
  hour: number; // 0-24
  weather: string | null;
  light: LightInfo;
}

export type Tab = 'attach' | 'animation' | 'scene' | 'history';
export type StepSize = 'fine' | 'normal' | 'coarse';
export type CopyFormat = 'attach' | 'values' | 'emote' | 'lua' | 'json';
export type CopyScope = 'selected' | 'all';

/** What is saved and loaded back: the props and the clip */
export interface Session {
  props: Omit<PropData, 'id'>[];
  anim: { dict: string; name: string; flag: number } | null;
}

export interface HistoryEntry {
  id: string;
  at: number;
  format: CopyFormat;
  scope: CopyScope;
  text: string;
  session: Session;
}

export interface EditorConfig {
  side: 'left' | 'right';
  backdropColor: string;
  defaultModel: string;
  defaultBone: number;
  defaultAnim: { dict: string; name: string; flag: number };
}

/** The first message of a session (client/main.lua stateForPage) */
export interface OpenData {
  props: PropData[];
  selected: number | null;
  anim: { dict?: string; name?: string; flag: number; speed: number; paused: boolean };
  scene: { backdrop: { enabled: boolean; color: string }; hour?: number; weather?: string; light?: Partial<LightInfo> };
  nativeGizmo?: boolean; // the server lets the game's own gizmo run
}

export interface GizmoOpen {
  id: number;
  handle: number;
  position: Vec;
  rotation: Vec;
  fov: number;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
  action?: { label: string; run: () => void };
}
