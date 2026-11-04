import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Machine } from '../types';
import type { LayoutDef } from '../layouts';
import { printer } from '../sound';
import { reducedMotion } from '../motion';
import { downloadRaw } from '../zip';

type Stage = 'printing' | 'released' | 'done' | 'taken';

// Timeline matched to public/sfx/print.mp3 (14 s):
// 0.25 s start click, 0.3–10.2 s steady motor (paper feeds out),
// ~10.25 s clunk (paper drops free), mechanism winds down until 13.3 s.
// The CSS feed/develop durations in styles.css use the same numbers.
const FEED_START = 0.3;
const FEED_END = 10.2;
const RELEASE = 10.25;
const DONE = 13.3;

function fileName() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `virtua-box-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`;
}

export function Print({
  url,
  shots,
  layout,
  machine,
  onAgain,
  onHome,
}: {
  url: string;
  shots: HTMLCanvasElement[];
  layout: LayoutDef;
  machine: Machine;
  onAgain: () => void;
  onHome: () => void;
}) {
  const [stage, setStage] = useState<Stage>('printing');
  const [zipping, setZipping] = useState(false);
  const paperRef = useRef<HTMLButtonElement>(null);

  // Drive the feed from the print sound's own clock so paper and audio never drift.
  useEffect(() => {
    const p = printer();
    const speed = reducedMotion() ? 30 : 1;
    let raf = 0;
    let st: Stage = 'printing';
    const tick = () => {
      const t = p.time() * speed;
      const el = paperRef.current;
      if (st === 'printing' && el) {
        const k = Math.min(1, Math.max(0, (t - FEED_START) / (FEED_END - FEED_START)));
        el.style.transform = `translateY(${-101 + 101 * k}%)`;
      }
      if (st === 'printing' && t >= RELEASE) {
        st = 'released';
        if (el) el.style.transform = '';
        setStage('released');
      }
      if (st === 'released' && t >= DONE) {
        st = 'done';
        setStage('done');
      }
    };
    const loop = () => {
      tick();
      if (st !== 'done') raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    // rAF pauses in a background tab; this keeps the stages moving anyway.
    const iv = window.setInterval(tick, 200);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(iv);
      p.stop();
    };
  }, []);

  const ar = layout.width / layout.height;
  const portrait = ar < 0.8;
  // Landing pose after the drop: silver falls into the recessed bin, red rests in its tray.
  const vars = {
    '--ar': ar,
    '--tilt': machine === 'silver' ? (portrait ? '-22deg' : '-7deg') : '-4deg',
    '--drop': machine === 'silver' ? '34px' : '10px',
    '--ds': machine === 'silver' ? (portrait ? 0.86 : 0.92) : 1,
  } as CSSProperties;

  return (
    <main className="print-wrap" style={vars}>
      <div className={`front-panel fp-${machine}`}>
        <p className="fp-status" aria-live="polite">
          {stage === 'done' || stage === 'taken' ? 'Fotomu sudah jadi. Ambil di bawah.' : 'Mencetak…'}
        </p>

        {machine === 'silver' && (
          <div className="fp-plate" aria-hidden="true">
            PHOTOS
            <br />
            DELIVERED HERE
            <span>↓</span>
          </div>
        )}
        {machine === 'red' && <div className="fp-label" aria-hidden="true">PHOTO OUT</div>}

        <div className="slot" aria-hidden="true">
          {machine === 'red' && <i className="roller r1" />}
        </div>

        <div className={`paper-mask ${stage === 'printing' ? 'feeding' : ''}`}>
          {machine === 'silver' && <i className="bin" aria-hidden="true" />}
          <i className="mouth-shadow" aria-hidden="true" />
          {machine === 'red' && <i className="roller-front" aria-hidden="true" />}
          <button
            ref={paperRef}
            className={`paper ${stage}`}
            disabled={stage === 'printing' || stage === 'released'}
            onClick={() => setStage('taken')}
            aria-label="Ambil strip foto"
          >
            <img src={url} alt="" />
          </button>
        </div>

        {machine === 'red' && <div className="tray" aria-hidden="true" />}
        {stage === 'done' && <p className="take-hint">Klik strip untuk mengambil</p>}
      </div>

      {stage === 'taken' && (
        <div className="taken" role="dialog" aria-modal="true" aria-label="Strip foto kamu">
          <img className="taken-strip" src={url} alt="Strip foto kamu" style={{ aspectRatio: `${layout.width} / ${layout.height}` }} />
          <div className="taken-actions">
            <a className="primary big" href={url} download={fileName()}>
              Unduh PNG
            </a>
            <button
              className="ghost"
              disabled={zipping}
              onClick={async () => {
                setZipping(true);
                try {
                  await downloadRaw(shots, url);
                } finally {
                  setZipping(false);
                }
              }}
            >
              {zipping ? 'Menyiapkan…' : `Foto asli (${shots.length}) .zip`}
            </button>
            <button className="ghost" onClick={onAgain}>
              Foto lagi
            </button>
            <button className="ghost" onClick={onHome}>
              Ganti mesin
            </button>
          </div>
          <button className="close" onClick={() => setStage('done')} aria-label="Tutup">
            ×
          </button>
        </div>
      )}
    </main>
  );
}
