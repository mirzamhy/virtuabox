import { useEffect, useMemo, useState } from 'react';
import type { StyleId } from '../types';
import { styleCss } from '../filters';
import { Monitor } from './Monitor';
import { downloadRaw } from '../zip';

export function Pick({
  shots,
  need,
  style,
  sel,
  setSel,
  onNext,
  onRetake,
  onRetakeOne,
}: {
  shots: HTMLCanvasElement[];
  need: number;
  style: StyleId;
  sel: number[];
  setSel: (f: (s: number[]) => number[]) => void;
  onNext: (idx: number[]) => void;
  onRetake: () => void;
  onRetakeOne: (index: number) => void;
}) {
  const thumbs = useMemo(() => shots.map((c) => c.toDataURL('image/jpeg', 0.8)), [shots]);
  const [zipping, setZipping] = useState(false);
  const [view, setView] = useState<number | null>(null);

  const toggle = (i: number) =>
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < need ? [...s, i] : s));

  useEffect(() => {
    if (view === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setView(null);
      if (e.key === 'ArrowRight') setView((v) => (v === null ? v : (v + 1) % shots.length));
      if (e.key === 'ArrowLeft') setView((v) => (v === null ? v : (v - 1 + shots.length) % shots.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, shots.length]);

  const viewOrder = view === null ? -1 : sel.indexOf(view);
  const full = sel.length >= need;

  return (
    <Monitor zoom title="Pilih foto" sub={`Pilih ${need} foto. Ketuk foto untuk melihat besar atau mengulanginya.`}>
      <div className="pick-grid">
        {thumbs.map((t, i) => {
          const order = sel.indexOf(i);
          return (
            <div key={i} className={`pick ${order >= 0 ? 'on' : ''}`}>
              <button className="pick-open" onClick={() => setView(i)} aria-label={`Lihat take ${i + 1}`}>
                <img src={t} alt={`Take ${i + 1}`} style={{ filter: styleCss(style) }} />
              </button>
              <button
                className={`pick-check ${order >= 0 ? 'on' : ''}`}
                aria-pressed={order >= 0}
                aria-label={order >= 0 ? `Batal pilih take ${i + 1}` : `Pilih take ${i + 1}`}
                disabled={order < 0 && full}
                onClick={() => toggle(i)}
              >
                {order >= 0 ? order + 1 : '+'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="monitor-actions">
        <button className="ghost" onClick={onRetake}>
          Foto ulang semua
        </button>
        <button
          className="ghost"
          disabled={zipping}
          onClick={async () => {
            setZipping(true);
            try {
              await downloadRaw(shots);
            } finally {
              setZipping(false);
            }
          }}
          title="Semua take tanpa filter dan bingkai, resolusi penuh kamera"
        >
          {zipping ? 'Menyiapkan…' : 'Unduh foto asli'}
        </button>
        <span className="counter">
          {sel.length}/{need} dipilih
        </span>
        <button className="primary" disabled={sel.length !== need} onClick={() => onNext(sel)}>
          Lanjut hias
        </button>
      </div>

      {view !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Take ${view + 1}`} onClick={() => setView(null)}>
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-photo">
              <img src={thumbs[view]} alt={`Take ${view + 1}`} style={{ filter: styleCss(style) }} />
              <span className="lightbox-num">
                Take {view + 1}/{shots.length}
              </span>
              <button
                className="lb-nav prev"
                aria-label="Foto sebelumnya"
                onClick={() => setView((view - 1 + shots.length) % shots.length)}
              >
                ‹
              </button>
              <button
                className="lb-nav next"
                aria-label="Foto berikutnya"
                onClick={() => setView((view + 1) % shots.length)}
              >
                ›
              </button>
            </div>
            <div className="lightbox-actions">
              <button
                className="primary"
                disabled={viewOrder < 0 && full}
                onClick={() => {
                  toggle(view);
                  setView(null);
                }}
              >
                {viewOrder >= 0 ? `Batal pilih (no. ${viewOrder + 1})` : full ? `Sudah ${need} dipilih` : 'Pilih foto ini'}
              </button>
              <button className="ghost" onClick={() => onRetakeOne(view)}>
                Ulangi foto ini
              </button>
              <button className="ghost" onClick={() => setView(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </Monitor>
  );
}
