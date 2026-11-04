import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../types';
import { capture, startCamera, type Cam } from '../camera';
import { STYLES, styleCss } from '../filters';
import { LAYOUTS, cellAspect } from '../layouts';

const SCREEN_AR = 4 / 3; // camera frames are captured at 4:3
import { beep, shutter, unlockAudio } from '../sound';
import { wait } from '../motion';

type CamState = 'idle' | 'starting' | 'on' | 'error';

function errorText(e: unknown) {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError') return 'Izin kamera ditolak. Buka pengaturan situs di browser, izinkan kamera, lalu coba lagi.';
  if (name === 'NotFoundError') return 'Tidak ada kamera yang terdeteksi di perangkat ini.';
  if (name === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasinya lalu coba lagi.';
  return (e as Error)?.message || 'Kamera tidak bisa dinyalakan.';
}

const inAppBrowser = () => /Instagram|FBAN|FBAV|TikTok|Line\//i.test(navigator.userAgent);

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
    if (new URLSearchParams(location.search).has('demo')) void start(true);
    return () => {
      alive.current = false;
      camRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const c = capture(v);
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
      <div className="room">
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
                  <span>
                    {styleLabel}
                    {demo ? ' · demo' : ''}
                  </span>
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
      </div>
      {flash > 0 && <div className="flash" key={flash} aria-hidden="true" />}
    </main>
  );
}
