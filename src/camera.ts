export interface Cam {
  stream: MediaStream;
  demo: boolean;
  stop: () => void;
}

export async function startCamera(demo: boolean): Promise<Cam> {
  if (demo) return demoCamera();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Browser ini tidak memberi akses kamera. Coba buka di Chrome atau Safari.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
    audio: false,
  });
  return { stream, demo: false, stop: () => stream.getTracks().forEach((t) => t.stop()) };
}

/** Fake camera (two silhouettes in front of a curtain) for testing without a webcam. */
function demoCamera(): Cam {
  const c = document.createElement('canvas');
  c.width = 960;
  c.height = 720;
  const g = c.getContext('2d')!;
  let raf = 0;
  const t0 = performance.now();
  const draw = () => {
    const t = (performance.now() - t0) / 1000;
    const grd = g.createLinearGradient(0, 0, 0, 720);
    grd.addColorStop(0, '#e2ddd5');
    grd.addColorStop(1, '#a9a196');
    g.fillStyle = grd;
    g.fillRect(0, 0, 960, 720);
    g.fillStyle = 'rgba(0,0,0,0.06)';
    for (let x = 0; x < 960; x += 48) g.fillRect(x, 0, 22, 720);
    const person = (cx: number, color: string, ph: number) => {
      const bob = Math.sin(t * 2 + ph) * 12;
      const sway = Math.sin(t * 1.3 + ph) * 18;
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(cx + sway, 300 + bob, 70, 86, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(cx - 160, 720);
      g.quadraticCurveTo(cx - 150, 430 + bob, cx + sway * 0.5, 420 + bob);
      g.quadraticCurveTo(cx + 150, 430 + bob, cx + 160, 720);
      g.fill();
    };
    person(330, '#3b3530', 0);
    person(640, '#6a5446', 1.3);
    raf = requestAnimationFrame(draw);
  };
  draw();
  const stream = c.captureStream(30);
  return {
    stream,
    demo: true,
    stop: () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

const MAX_W = 1920;

/**
 * Grab a mirrored 4:3 frame (same crop the booth screen shows) at the camera's
 * own resolution, capped at 1920 px wide. This is also the "raw" photo users can download.
 */
export function capture(video: HTMLVideoElement): HTMLCanvasElement {
  const srcW = video.videoWidth || 960;
  const srcH = video.videoHeight || 720;
  let w = srcW / srcH > 4 / 3 ? Math.round((srcH * 4) / 3) : srcW;
  if (w > MAX_W) w = MAX_W;
  const h = Math.round((w * 3) / 4);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const vw = video.videoWidth || w;
  const vh = video.videoHeight || h;
  const s = Math.max(w / vw, h / vh);
  const dw = vw * s;
  const dh = vh * s;
  g.translate(w, 0);
  g.scale(-1, 1);
  g.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}
