export type Machine = 'silver' | 'red';
export type LayoutId = 'strip4' | 'strip3' | 'grid4' | 'double3' | 'land4' | 'land2' | 'polaroid' | 'corners' | 'film';
export type StyleId = 'asli' | 'bw' | 'sepia' | 'film' | 'soft';
export type TimerSec = 3 | 5 | 10;
export type Takes = 4 | 6 | 8;
export type Phase = 'landing' | 'options' | 'booth' | 'pick' | 'edit' | 'print';

export interface Settings {
  layout: LayoutId;
  timer: TimerSec;
  style: StyleId;
  takes: Takes;
}

export type FrameShape = 'kotak' | 'rounded' | 'oval' | 'hati';
export type Pattern = 'polos' | 'kotak' | 'titik';

/** Per-photo crop: x/y in -1..1 of the spare image area, zoom 1..3 on top of cover-fit. */
export interface Adjust {
  x: number;
  y: number;
  zoom: number;
}
export const NO_ADJUST: Adjust = { x: 0, y: 0, zoom: 1 };

export interface EditState {
  adjust: Adjust[];
  frameColor: string;
  pattern: Pattern;
  shape: FrameShape;
  style: StyleId;
  caption: string;
  showDate: boolean;
}
