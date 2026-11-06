// AR props: face landmarks from MediaPipe (runs on the device), props drawn as vector shapes.
// The MediaPipe code, wasm and model load only when someone picks a prop.

export type PropId = 'none' | 'kacamata' | 'hati' | 'mahkota' | 'kucing' | 'kumis' | 'topi';

export const PROPS: { id: PropId; label: string }[] = [
  { id: 'none', label: 'Tanpa props' },
  { id: 'kacamata', label: 'Kacamata' },
  { id: 'hati', label: 'Kacamata hati' },
  { id: 'mahkota', label: 'Mahkota' },
  { id: 'kucing', label: 'Telinga kucing' },
  { id: 'kumis', label: 'Kumis' },
  { id: 'topi', label: 'Topi pesta' },
];

type P = { x: number; y: number };

/** Face pose in image pixels (camera image, not mirrored). */
export interface Face {
  eyeL: P; // eye on the image's left side
  eyeR: P;
  mid: P; // between the eyes
  top: P; // top of the forehead
  nose: P; // under the nose tip
  lip: P; // top of the upper lip
  angle: number; // head roll, radians
  u: number; // eye-to-eye distance in px, the size unit for every prop
}

const MP_VERSION = '0.10.35';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

type Landmark = { x: number; y: number };
export interface Tracker {
  detect: (video: HTMLVideoElement, now: number) => Landmark[][];
  close: () => void;
}

let loading: Promise<Tracker> | null = null;

/** Load the face tracker once. Tries the GPU first, then the CPU. */
export function loadTracker(): Promise<Tracker> {
  if (!loading) {
    loading = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks(WASM);
      const make = (delegate: 'GPU' | 'CPU') =>
        FaceLandmarker.createFromOptions(files, {
          baseOptions: { modelAssetPath: MODEL, delegate },
          runningMode: 'VIDEO',
          numFaces: 4,
        });
      const fl = await make('GPU').catch(() => make('CPU'));
      let last = -1;
      return {
        detect: (video, now) => {
          // detectForVideo needs strictly increasing timestamps.
          const t = now <= last ? last + 1 : now;
          last = t;
          return fl.detectForVideo(video, t).faceLandmarks;
        },
        close: () => fl.close(),
      };
    })();
    loading.catch(() => (loading = null));
  }
  return loading;
}

const avg = (...ps: P[]): P => ({
  x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
  y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
});

/** Landmark indices follow the MediaPipe face mesh (478 points). */
export function faceFrom(lm: Landmark[], w: number, h: number): Face {
  const p = (i: number): P => ({ x: lm[i].x * w, y: lm[i].y * h });
  const eyeL = avg(p(33), p(133));
  const eyeR = avg(p(362), p(263));
  return {
    eyeL,
    eyeR,
    mid: avg(eyeL, eyeR),
    top: p(10),
    nose: p(2),
    lip: p(0),
    angle: Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x),
    u: Math.hypot(eyeR.x - eyeL.x, eyeR.y - eyeL.y),
  };
}

/** Ease landmarks between frames so props don't jitter. */
export function smooth(prev: Face | undefined, next: Face, k = 0.55): Face {
  if (!prev || Math.hypot(prev.mid.x - next.mid.x, prev.mid.y - next.mid.y) > next.u * 1.5) return next;
  const m = (a: P, b: P): P => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
  return {
    eyeL: m(prev.eyeL, next.eyeL),
    eyeR: m(prev.eyeR, next.eyeR),
    mid: m(prev.mid, next.mid),
    top: m(prev.top, next.top),
    nose: m(prev.nose, next.nose),
    lip: m(prev.lip, next.lip),
    angle: prev.angle + (next.angle - prev.angle) * k,
    u: prev.u + (next.u - prev.u) * k,
  };
}

// ── drawing ── every prop is drawn in a local frame: origin at an anchor point,
// x along the eye line, 1 unit = eye-to-eye distance.

function frame(g: CanvasRenderingContext2D, f: Face, at: P, fn: () => void) {
  g.save();
  g.translate(at.x, at.y);
  g.rotate(f.angle);
  g.scale(f.u, f.u);
  fn();
  g.restore();
}

function heart(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.beginPath();
  g.moveTo(cx, cy + s * 0.55);
  g.bezierCurveTo(cx - s * 1.1, cy - s * 0.05, cx - s * 0.55, cy - s * 0.85, cx, cy - s * 0.3);
  g.bezierCurveTo(cx + s * 0.55, cy - s * 0.85, cx + s * 1.1, cy - s * 0.05, cx, cy + s * 0.55);
  g.closePath();
}

function glasses(g: CanvasRenderingContext2D, f: Face) {
  frame(g, f, f.mid, () => {
    const r = 0.36;
    g.lineWidth = 0.075;
    g.strokeStyle = '#141414';
    for (const cx of [-0.5, 0.5]) {
      const grd = g.createLinearGradient(0, -r, 0, r);
      grd.addColorStop(0, 'rgba(40,40,46,0.92)');
      grd.addColorStop(1, 'rgba(10,10,12,0.8)');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(cx, 0.02, r * 1.08, r, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      // glare
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.beginPath();
      g.ellipse(cx - 0.12, -0.12, 0.1, 0.05, -0.5, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.moveTo(-0.13, -0.05);
    g.quadraticCurveTo(0, -0.15, 0.13, -0.05);
    g.stroke();
    // temples
    g.beginPath();
    g.moveTo(-0.88, -0.04);
    g.lineTo(-1.05, -0.08);
    g.moveTo(0.88, -0.04);
    g.lineTo(1.05, -0.08);
    g.stroke();
  });
}

function heartGlasses(g: CanvasRenderingContext2D, f: Face) {
  frame(g, f, f.mid, () => {
    g.lineWidth = 0.07;
    g.strokeStyle = '#c2185b';
    for (const cx of [-0.5, 0.5]) {
      g.fillStyle = 'rgba(255, 64, 129, 0.72)';
      heart(g, cx, 0.02, 0.5);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.ellipse(cx - 0.17, -0.12, 0.08, 0.045, -0.6, 0, Math.PI * 2);
      g.fill();
    }
    g.beginPath();
    g.moveTo(-0.12, -0.08);
    g.quadraticCurveTo(0, -0.17, 0.12, -0.08);
    g.stroke();
  });
}

function crown(g: CanvasRenderingContext2D, f: Face) {
  frame(g, f, f.top, () => {
    const y0 = -0.25; // band bottom sits just above the forehead point
    const w = 1.05;
    const grd = g.createLinearGradient(0, y0 - 0.8, 0, y0);
    grd.addColorStop(0, '#ffe27a');
    grd.addColorStop(0.6, '#f2b632');
    grd.addColorStop(1, '#b8801a');
    g.fillStyle = grd;
    g.strokeStyle = '#8a5a0c';
    g.lineWidth = 0.04;
    g.beginPath();
    g.moveTo(-w, y0);
    g.lineTo(-w, y0 - 0.45);
    g.lineTo(-w * 0.55, y0 - 0.2);
    g.lineTo(-w * 0.28, y0 - 0.72);
    g.lineTo(0, y0 - 0.28);
    g.lineTo(w * 0.28, y0 - 0.72);
    g.lineTo(w * 0.55, y0 - 0.2);
    g.lineTo(w, y0 - 0.45);
    g.lineTo(w, y0);
    g.closePath();
    g.fill();
    g.stroke();
    // band + jewels
    g.fillStyle = '#d99a22';
    g.fillRect(-w, y0 - 0.16, w * 2, 0.16);
    const jewels: [number, string][] = [
      [-0.6, '#e53950'],
      [0, '#2f7de1'],
      [0.6, '#2bb673'],
    ];
    for (const [x, c] of jewels) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y0 - 0.08, 0.06, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#fff6c9';
    for (const x of [-w, -w * 0.28, w * 0.28, w]) {
      g.beginPath();
      g.arc(x, x === -w || x === w ? y0 - 0.47 : y0 - 0.74, 0.06, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function catEars(g: CanvasRenderingContext2D, f: Face) {
  frame(g, f, f.top, () => {
    for (const s of [-1, 1]) {
      g.save();
      g.translate(s * 0.78, -0.35);
      g.rotate(s * 0.28);
      g.fillStyle = '#2b2b2f';
      g.beginPath();
      g.moveTo(-0.38, 0.12);
      g.quadraticCurveTo(-0.12, -0.75, 0, -0.78);
      g.quadraticCurveTo(0.12, -0.75, 0.38, 0.12);
      g.closePath();
      g.fill();
      g.fillStyle = '#ff9eb5';
      g.beginPath();
      g.moveTo(-0.2, 0.05);
      g.quadraticCurveTo(-0.06, -0.5, 0, -0.52);
      g.quadraticCurveTo(0.06, -0.5, 0.2, 0.05);
      g.closePath();
      g.fill();
      g.restore();
    }
    // headband
    g.strokeStyle = '#2b2b2f';
    g.lineWidth = 0.1;
    g.beginPath();
    g.ellipse(0, 0.2, 1.05, 0.5, 0, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
  });
}

function mustache(g: CanvasRenderingContext2D, f: Face) {
  const at = avg(f.nose, f.nose, f.lip);
  frame(g, f, at, () => {
    g.fillStyle = '#1d1712';
    g.beginPath();
    g.moveTo(0, -0.04);
    for (const s of [1, -1]) {
      g.moveTo(0, -0.05);
      g.bezierCurveTo(s * 0.2, -0.16, s * 0.42, -0.12, s * 0.52, 0.02);
      g.bezierCurveTo(s * 0.6, 0.12, s * 0.72, 0.06, s * 0.74, -0.06);
      g.bezierCurveTo(s * 0.78, 0.14, s * 0.56, 0.24, s * 0.4, 0.12);
      g.bezierCurveTo(s * 0.28, 0.06, s * 0.12, 0.1, 0, 0.06);
      g.closePath();
    }
    g.fill();
  });
}

function partyHat(g: CanvasRenderingContext2D, f: Face) {
  frame(g, f, f.top, () => {
    g.save();
    g.translate(0.3, -0.15);
    g.rotate(0.2);
    const w = 0.72;
    const h = 1.85;
    g.beginPath();
    g.moveTo(-w, 0);
    g.lineTo(0, -h);
    g.lineTo(w, 0);
    g.closePath();
    g.save();
    g.clip();
    g.fillStyle = '#4fc3f7';
    g.fillRect(-w, -h, w * 2, h);
    g.strokeStyle = '#ffeb3b';
    g.lineWidth = 0.14;
    for (let i = -3; i < 6; i++) {
      g.beginPath();
      g.moveTo(-w, -i * 0.32);
      g.lineTo(w, -i * 0.32 - 0.5);
      g.stroke();
    }
    g.fillStyle = '#ff4081';
    for (const [x, y] of [
      [-0.2, -0.3],
      [0.15, -0.65],
      [-0.05, -1.0],
      [0.25, -0.2],
    ]) {
      g.beginPath();
      g.arc(x, y, 0.05, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // rim + pompom
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(0, 0, w * 1.05, 0.09, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ff4081';
    g.beginPath();
    g.arc(0, -h, 0.15, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

const DRAW: Record<Exclude<PropId, 'none'>, (g: CanvasRenderingContext2D, f: Face) => void> = {
  kacamata: glasses,
  hati: heartGlasses,
  mahkota: crown,
  kucing: catEars,
  kumis: mustache,
  topi: partyHat,
};

export function drawProp(g: CanvasRenderingContext2D, id: PropId, f: Face) {
  if (id !== 'none') DRAW[id](g, f);
}

/** A made-up front-facing face, used to draw the picker icons. */
export function iconFace(size: number): Face {
  const u = size * 0.24;
  const cx = size / 2;
  const ey = size * 0.56;
  return {
    eyeL: { x: cx - u / 2, y: ey },
    eyeR: { x: cx + u / 2, y: ey },
    mid: { x: cx, y: ey },
    top: { x: cx, y: ey - u * 0.95 },
    nose: { x: cx, y: ey + u * 0.62 },
    lip: { x: cx, y: ey + u * 0.82 },
    angle: 0,
    u,
  };
}
