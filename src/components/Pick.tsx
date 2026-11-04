import { useMemo, useState } from 'react';
import type { StyleId } from '../types';
import { styleCss } from '../filters';
import { Monitor } from './Monitor';
import { downloadRaw } from '../zip';

export function Pick({
  shots,
  need,
  style,
  onNext,
  onRetake,
}: {
  shots: HTMLCanvasElement[];
  need: number;
  style: StyleId;
  onNext: (idx: number[]) => void;
  onRetake: () => void;
}) {
  const thumbs = useMemo(() => shots.map((c) => c.toDataURL('image/jpeg', 0.8)), [shots]);
  const [sel, setSel] = useState<number[]>([]);
  const [zipping, setZipping] = useState(false);

  const toggle = (i: number) =>
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < need ? [...s, i] : s));

  return (
    <Monitor zoom title="Pilih foto" sub={`Pilih ${need} foto. Urutan kamu memilih jadi urutan di strip.`}>
      <div className="pick-grid">
        {thumbs.map((t, i) => {
          const order = sel.indexOf(i);
          return (
            <button
              key={i}
              className={`pick ${order >= 0 ? 'on' : ''}`}
              aria-pressed={order >= 0}
              onClick={() => toggle(i)}
            >
              <img src={t} alt={`Take ${i + 1}`} style={{ filter: styleCss(style) }} />
              {order >= 0 && <span className="badge">{order + 1}</span>}
            </button>
          );
        })}
      </div>
      <div className="monitor-actions">
        <button className="ghost" onClick={onRetake}>
          Foto ulang
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
    </Monitor>
  );
}
