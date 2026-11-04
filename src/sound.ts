// All sounds are synthesized with Web Audio, so there are no audio files to load.
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
