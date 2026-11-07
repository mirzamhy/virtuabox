// Easter egg "foto kita blur": hold a sideways peace sign (V turned ~90°) and the booth
// blurs the picture, ported from the Python tool in Foto_kita_blur (gesture.py).
// Hand landmarks come from MediaPipe and run on the device.

type P = { x: number; y: number };

const WRIST = 0;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

const HORIZONTAL_TOLERANCE_DEG = 20;

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const extended = (lm: P[], tip: number, pip: number) => dist(lm[WRIST], lm[tip]) > dist(lm[WRIST], lm[pip]);

/** Index and middle out, ring and pinky folded, and the hand pointing sideways (±20°). */
export function isSidewaysPeace(lm: P[]): boolean {
  if (lm.length < 21) return false;
  const v =
    extended(lm, INDEX_TIP, INDEX_PIP) &&
    extended(lm, MIDDLE_TIP, MIDDLE_PIP) &&
    !extended(lm, RING_TIP, RING_PIP) &&
    !extended(lm, PINKY_TIP, PINKY_PIP);
  if (!v) return false;
  const w = lm[WRIST];
  const mx = (lm[INDEX_TIP].x + lm[MIDDLE_TIP].x) / 2;
  const my = (lm[INDEX_TIP].y + lm[MIDDLE_TIP].y) / 2;
  const angle = (Math.atan2(my - w.y, mx - w.x) * 180) / Math.PI;
  const fromHorizontal = Math.abs((((angle + 90) % 180) + 180) % 180 - 90);
  return fromHorizontal <= HORIZONTAL_TOLERANCE_DEG;
}

const MP_VERSION = '0.10.35';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export interface HandTracker {
  detect: (video: HTMLVideoElement, now: number) => P[][];
  close: () => void;
}

let loading: Promise<HandTracker> | null = null;

/** Load the hand tracker once. Tries the GPU first, then the CPU. */
export function loadHands(): Promise<HandTracker> {
  if (!loading) {
    loading = (async () => {
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(WASM);
      const make = (delegate: 'GPU' | 'CPU') =>
        HandLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.7,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      const hl = await make('GPU').catch(() => make('CPU'));
      let last = -1;
      return {
        detect: (video, now) => {
          // detectForVideo needs strictly increasing timestamps.
          const t = now <= last ? last + 1 : now;
          last = t;
          return hl.detectForVideo(video, t).landmarks;
        },
        close: () => hl.close(),
      };
    })();
    loading.catch(() => (loading = null));
  }
  return loading;
}

/** Blur strength as a fraction of the image width (close to the Python tool's 51 px kernel at 640 px). */
export const BLUR_FRACTION = 0.014;

/** Blur a captured photo in place. */
export function blurCanvas(c: HTMLCanvasElement): HTMLCanvasElement {
  const copy = document.createElement('canvas');
  copy.width = c.width;
  copy.height = c.height;
  copy.getContext('2d')!.drawImage(c, 0, 0);
  const g = c.getContext('2d')!;
  const r = Math.max(2, Math.round(c.width * BLUR_FRACTION));
  g.save();
  g.filter = `blur(${r}px)`;
  // Draw slightly oversized so the blurred edges don't fade to transparent.
  g.drawImage(copy, -r * 2, -r * 2, c.width + r * 4, c.height + r * 4);
  g.restore();
  return c;
}
