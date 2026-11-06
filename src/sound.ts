// Short UI sounds are synthesized with Web Audio; shutter and printer are recorded files.
let ctx: AudioContext | null = null;
let muted = false;

export const setMuted = (m: boolean) => {
  muted = m;
};

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const C =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a click handler: iOS only allows audio after a user gesture. */
export function unlockAudio() {
  ac();
  preloadSfx();
}

export function beep(freq = 880, dur = 0.12, vol = 0.16) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  const t = a.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** Filtered noise burst: curtain rings sliding on the rail. */
export function curtain(dur = 0.75) {
  const a = ac();
  if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    // ring clatter: noise with fast random flutter
    const flutter = 0.55 + 0.45 * Math.sin(i / 90 + Math.sin(i / 1700) * 6);
    d[i] = (Math.random() * 2 - 1) * flutter;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  const t = a.currentTime;
  bp.frequency.setValueAtTime(1800, t);
  bp.frequency.linearRampToValueAtTime(3600, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
  g.gain.setValueAtTime(0.22, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(a.destination);
  src.start(t);
}

/** Light switch click with a faint lamp hum. */
export function lightClick() {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const n = Math.floor(a.sampleRate * 0.03);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = 0.5;
  src.connect(g).connect(a.destination);
  src.start(t);

  const o = a.createOscillator();
  const h = a.createGain();
  o.type = 'sawtooth';
  o.frequency.value = 100;
  h.gain.setValueAtTime(0.0001, t);
  h.gain.exponentialRampToValueAtTime(0.02, t + 0.05);
  h.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(h).connect(a.destination);
  o.start(t);
  o.stop(t + 0.55);
}

// ── recorded SFX (public/sfx) ──
const files: Record<string, HTMLAudioElement> = {};
function file(name: string) {
  if (!files[name]) {
    const a = new Audio(`${import.meta.env.BASE_URL}sfx/${name}.mp3`);
    a.preload = 'auto';
    files[name] = a;
  }
  return files[name];
}

/** Start loading the SFX early so the first shutter is not late. */
export function preloadSfx() {
  file('shutter');
  file('print');
}

function playFile(name: string, vol = 1): () => void {
  if (muted) return () => {};
  const a = file(name).cloneNode(true) as HTMLAudioElement;
  a.volume = vol;
  void a.play().catch(() => {});
  return () => {
    a.pause();
    a.currentTime = 0;
  };
}

export function shutter() {
  playFile('shutter');
}

/**
 * Polaroid printer sound (14 s). Returns a clock in seconds that follows the audio
 * while it plays (wall time otherwise, e.g. when muted), so the print animation
 * stays locked to the sound.
 */
export function printer(): { stop: () => void; time: () => number } {
  const t0 = performance.now();
  const wall = () => (performance.now() - t0) / 1000;
  if (muted) return { stop: () => {}, time: wall };
  const a = file('print').cloneNode(true) as HTMLAudioElement;
  let ok = true;
  void a.play().catch(() => (ok = false));
  return {
    stop: () => {
      a.pause();
    },
    time: () => (ok && !a.paused && a.currentTime > 0 ? a.currentTime : wall()),
  };
}
