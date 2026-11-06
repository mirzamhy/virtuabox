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

/** Fake camera (two cartoon people in front of a curtain) for testing without a webcam. */
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
    const person = (cx: number, color: string, skin: string, ph: number) => {
      const bob = Math.sin(t * 2 + ph) * 12;
      const sway = Math.sin(t * 1.3 + ph) * 18;
      const hx = cx + sway;
      const hy = 300 + bob;
      // body
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(cx - 160, 720);
      g.quadraticCurveTo(cx - 150, 430 + bob, cx + sway * 0.5, 420 + bob);
      g.quadraticCurveTo(cx + 150, 430 + bob, cx + 160, 720);
      g.fill();
      // neck, hair, face
      g.fillStyle = skin;
      g.fillRect(hx - 26, hy + 60, 52, 60);
      g.fillStyle = '#231a14';
      g.beginPath();
      g.ellipse(hx, hy - 14, 78, 84, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = skin;
      g.beginPath();
      g.ellipse(hx, hy + 8, 64, 80, 0, 0, Math.PI * 2);
      g.fill();
      // eyes, brows, nose, mouth (simple, enough for a face detector to latch on)
      for (const s of [-1, 1]) {
        g.fillStyle = '#fff';
        g.beginPath();
        g.ellipse(hx + s * 24, hy - 4, 12, 7, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#2a1a10';
        g.beginPath();
        g.arc(hx + s * 24, hy - 4, 5.5, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#2a1a10';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(hx + s * 12, hy - 20);
        g.quadraticCurveTo(hx + s * 26, hy - 28, hx + s * 38, hy - 20);
        g.stroke();
      }
      g.strokeStyle = 'rgba(80,40,20,0.45)';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx - 7, hy + 26);
      g.lineTo(hx + 4, hy + 28);
      g.stroke();
      g.fillStyle = '#9b3b3b';
      g.beginPath();
      g.ellipse(hx, hy + 48, 20, 8 + Math.max(0, Math.sin(t * 2 + ph)) * 4, 0, 0, Math.PI);
      g.fill();
    };
    person(330, '#3b3530', '#e0b18e', 0);
    person(640, '#6a5446', '#c58c64', 1.3);
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
 * `overlay` (AR props, drawn at the video's own size) is baked in with the same crop.
 */
export function capture(video: HTMLVideoElement, overlay?: HTMLCanvasElement | null): HTMLCanvasElement {
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
  if (overlay && overlay.width) g.drawImage(overlay, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}
