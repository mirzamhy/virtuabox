import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../types';
import { capture, startCamera, type Cam } from '../camera';
import { STYLES, styleCss } from '../filters';
import { LAYOUTS, cellAspect } from '../layouts';
import { beep, curtain, lightClick, shutter, unlockAudio } from '../sound';
import { reducedMotion, wait } from '../motion';
import { PROPS, drawProp, faceFrom, iconFace, loadTracker, smooth, type Face, type PropId } from '../props';

const SCREEN_AR = 4 / 3; // camera frames are captured at 4:3

// Remembered between booth visits.
let lastProp: PropId = 'none';

type CamState = 'idle' | 'starting' | 'on' | 'error';

function errorText(e: unknown) {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'Izin kamera ditolak. Buka pengaturan situs di browser, izinkan kamera, lalu coba lagi.';
  if (name === 'NotFoundError') return 'Tidak ada kamera yang terdeteksi di perangkat ini.';
  if (name === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasinya lalu coba lagi.';
  return (e as Error)?.message || 'Kamera tidak bisa dinyalakan.';
}

const inAppBrowser = () => /Instagram|FBAN|FBAV|TikTok|Line\//i.test(navigator.userAgent);

function PropIcon({ id }: { id: PropId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const S = 64;
    c.width = S;
    c.height = S;
    const g = c.getContext('2d')!;
    // Hats reach far above the head, so draw a smaller face lower down for them.
    const tall = id === 'topi' ? 0.6 : id === 'mahkota' || id === 'kucing' ? 0.78 : 1;
    const f = iconFace(S * tall);
    g.translate((S - S * tall) / 2, S * (1 - tall) * 0.95 - (tall === 1 ? S * 0.06 : 0));
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath();
    g.ellipse(f.mid.x, f.mid.y + f.u * 0.25, f.u * 1.05, f.u * 1.35, 0, 0, Math.PI * 2);
    g.fill();
    if (id === 'none') {
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(f.mid.x - f.u, f.mid.y + f.u * 1.2);
      g.lineTo(f.mid.x + f.u, f.mid.y - f.u * 0.7);
      g.stroke();
    }
    drawProp(g, id, f);
  }, [id]);
  return <canvas ref={ref} aria-hidden="true" />;
}

export function Booth({
  settings,
  onDone,
  onBack,
}: {
  settings: Settings;
  onDone: (shots: HTMLCanvasElement[]) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const camRef = useRef<Cam | null>(null);
  const shotsRef = useRef<HTMLCanvasElement[]>([]);
  const alive = useRef(true);

  const [cam, setCam] = useState<CamState>('idle');
  const [err, setErr] = useState('');
  const [demo, setDemo] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(true);
  const [prop, setProp] = useState<PropId>(lastProp);
  const [propState, setPropState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const propRef = useRef(prop);
  propRef.current = prop;
  lastProp = prop;

  const start = async (useDemo: boolean) => {
    unlockAudio();
    setCam('starting');
    setErr('');
    try {
      const c = await startCamera(useDemo);
      if (!alive.current) return c.stop();
      camRef.current?.stop();
      camRef.current = c;
      setDemo(c.demo);
      const v = videoRef.current!;
      v.srcObject = c.stream;
      await v.play().catch(() => {});
      setCam('on');
    } catch (e) {
      setCam('error');
      setErr(errorText(e));
    }
  };

  useEffect(() => {
    alive.current = true;
    // Entering: the curtain slides shut, then the lights click on (.intro in styles.css).
    const timers: number[] = [];
    if (!reducedMotion()) {
      curtain();
      timers.push(window.setTimeout(lightClick, 1000));
    }
    if (new URLSearchParams(location.search).has('demo')) void start(true);
    return () => {
      alive.current = false;
      timers.forEach(clearTimeout);
      camRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AR props: track faces every frame and draw the chosen prop on the overlay canvas.
  const propOn = prop !== 'none';
  useEffect(() => {
    const cv = overlayRef.current;
    const clear = () => cv?.getContext('2d')?.clearRect(0, 0, cv.width, cv.height);
    if (!propOn || cam !== 'on') {
      clear();
      return;
    }
    let stop = false;
    let raf = 0;
    let faces: Face[] = [];
    setPropState('loading');
    loadTracker()
      .then((tracker) => {
        if (stop) return;
        setPropState('ready');
        const loop = () => {
          if (stop) return;
          const v = videoRef.current;
          if (v && cv && v.readyState >= 2 && v.videoWidth) {
            if (cv.width !== v.videoWidth || cv.height !== v.videoHeight) {
              cv.width = v.videoWidth;
              cv.height = v.videoHeight;
            }
            const g = cv.getContext('2d')!;
            const found = tracker.detect(v, performance.now());
            faces = found.map((lm, i) => smooth(faces[i], faceFrom(lm, cv.width, cv.height)));
            g.clearRect(0, 0, cv.width, cv.height);
            for (const f of faces) drawProp(g, propRef.current, f);
          }
          raf = requestAnimationFrame(loop);
        };
        loop();
      })
      .catch(() => {
        if (!stop) setPropState('error');
      });
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      clear();
    };
  }, [propOn, cam]);

  const takeOne = async () => {
    for (let s: number = settings.timer; s >= 1; s--) {
      if (!alive.current) return;
      setCount(s);
      beep(s === 1 ? 990 : 660, 0.1);
      await wait(1000);
    }
    setCount(null);
    const v = videoRef.current;
    if (!v || !alive.current) return;
    shutter();
    setFlash((f) => f + 1);
    const c = capture(v, propOn ? overlayRef.current : null);
    shotsRef.current = [...shotsRef.current, c];
    setThumbs((t) => [...t, c.toDataURL('image/jpeg', 0.6)]);
    await wait(700);
  };

  const shoot = async () => {
    if (busy || cam !== 'on') return;
    setBusy(true);
    if (auto) {
      while (shotsRef.current.length < settings.takes && alive.current) await takeOne();
    } else {
      await takeOne();
    }
    if (!alive.current) return;
    setBusy(false);
    if (shotsRef.current.length >= settings.takes) {
      await wait(600);
      if (!alive.current) return;
      camRef.current?.stop();
      onDone(shotsRef.current);
    }
  };

  const taken = thumbs.length;
  const styleLabel = STYLES.find((s) => s.id === settings.style)?.label;

  // Box showing the part of the frame that lands in the template's photo cell.
  const ar = cellAspect(LAYOUTS[settings.layout]);
  const showGuide = Math.abs(ar - SCREEN_AR) > 0.03;
  const guide =
    ar < SCREEN_AR
      ? { width: `${(ar / SCREEN_AR) * 100}%`, height: '100%' }
      : { width: '100%', height: `${(SCREEN_AR / ar) * 100}%` };

  return (
    <main className="booth-wrap">
      <div className={`room ${reducedMotion() ? '' : 'intro'}`}>
        <div className="wall w-top">
          <i className="softbox" />
        </div>
        <div className="wall w-left" />
        <div className="wall w-right" />
        <div className="wall w-floor" />

        <div className="back">
          <i className="led led-l" />
          <i className="led led-r" />
          <div className="lens-ring" aria-hidden="true">
            <i className="lens" />
            <span className="lens-label">LOOK HERE · SMILE</span>
          </div>

          <div className="screen-bezel">
            <div className="screen">
              <video
                ref={videoRef}
                muted
                playsInline
                className={cam === 'on' ? 'on' : ''}
                style={{ filter: styleCss(settings.style) }}
              />
              <canvas
                ref={overlayRef}
                className={`prop-layer ${cam === 'on' ? 'on' : ''}`}
                style={{ filter: styleCss(settings.style) }}
                aria-hidden="true"
              />

              {cam === 'on' && showGuide && (
                <div className="crop-guide" style={guide} aria-hidden="true">
                  <span>Area foto</span>
                </div>
              )}

              {cam !== 'on' && (
                <div className="screen-msg">
                  {cam === 'error' ? (
                    <>
                      <p>{err}</p>
                      {inAppBrowser() && (
                        <p className="small">
                          Kamu sepertinya membuka dari aplikasi (Instagram/TikTok). Buka link ini di
                          Chrome atau Safari agar kamera bisa dipakai.
                        </p>
                      )}
                      <div className="row">
                        <button className="primary" onClick={() => start(false)}>
                          Coba lagi
                        </button>
                        <button className="ghost" onClick={() => start(true)}>
                          Pakai kamera demo
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="big-msg">Kamera belum menyala</p>
                      <p className="small">
                        Browser akan minta izin kamera. Video hanya tampil di layar ini, tidak
                        direkam dan tidak dikirim.
                      </p>
                      <div className="row">
                        <button
                          className="primary"
                          disabled={cam === 'starting'}
                          onClick={() => start(false)}
                        >
                          {cam === 'starting' ? 'Menyalakan…' : 'Nyalakan kamera'}
                        </button>
                        <button className="ghost" onClick={() => start(true)}>
                          Kamera demo
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {count !== null && (
                <div className="countdown" key={`${taken}-${count}`}>
                  {count}
                </div>
              )}


              {cam === 'on' && (
                <div className="hud">
                  <span>
                    Take {Math.min(taken + (busy ? 1 : 0), settings.takes)}/{settings.takes}
                  </span>
                  {propOn && propState === 'loading' && <span className="hud-chip">Memuat props…</span>}
                  {propOn && propState === 'error' && (
                    <span className="hud-chip">Props gagal dimuat, cek internet</span>
                  )}
                  <span>
                    {styleLabel}
                    {demo ? ' · demo' : ''}
                  </span>
                </div>
              )}

              {cam === 'on' && (
                <div className="props" role="radiogroup" aria-label="Props">
                  {PROPS.map((p) => (
                    <button
                      key={p.id}
                      role="radio"
                      aria-checked={prop === p.id}
                      aria-label={p.label}
                      title={p.label}
                      className={`prop-btn ${prop === p.id ? 'on' : ''}`}
                      disabled={busy}
                      onClick={() => setProp(p.id)}
                    >
                      <PropIcon id={p.id} />
                    </button>
                  ))}
                </div>
              )}

              <div className="thumbs" aria-label="Hasil sementara">
                {Array.from({ length: settings.takes }, (_, i) => (
                  <span key={i} className="thumb">
                    {thumbs[i] && <img src={thumbs[i]} alt={`Take ${i + 1}`} />}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="controls">
          <button className="ghost" onClick={onBack} disabled={busy}>
            Kembali
          </button>
          <button
            className="shutter"
            onClick={shoot}
            disabled={busy || cam !== 'on'}
            aria-label={busy ? 'Sedang memotret' : 'Ambil foto'}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8.5 5 10 3h4l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3.5Z" />
              <circle cx="12" cy="12" r="3.6" />
            </svg>
          </button>
          <button
            className="ghost mode"
            onClick={() => setAuto((a) => !a)}
            disabled={busy}
            aria-pressed={auto}
          >
            {auto ? 'Beruntun' : 'Manual'}
          </button>
        </div>

        <i className="curtain c-l" aria-hidden="true" />
        <i className="curtain c-r" aria-hidden="true" />
        <i className="room-dark" aria-hidden="true" />
      </div>
      {flash > 0 && <div className="flash" key={flash} aria-hidden="true" />}
    </main>
  );
}
