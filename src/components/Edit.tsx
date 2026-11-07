import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as RPointerEvent,
  type SetStateAction,
} from 'react';
import { NO_ADJUST, type Adjust, type EditState, type FrameShape, type Pattern } from '../types';
import type { LayoutDef, Slot } from '../layouts';
import { STYLES, applyStyle } from '../filters';
import { coverSize, renderStrip } from '../render';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MAX_ZOOM = 3;
import { Monitor } from './Monitor';

// Frame colours taken from the Kula Studio design wall reference.
const COLORS = [
  { hex: '#F4F1EA', name: 'Putih' },
  { hex: '#161616', name: 'Hitam' },
  { hex: '#C9CDD2', name: 'Silver' },
  { hex: '#7A1F24', name: 'Marun' },
  { hex: '#1F45D6', name: 'Biru' },
  { hex: '#1E5B3F', name: 'Hijau' },
  { hex: '#F2A7C3', name: 'Pink' },
  { hex: '#E8D9B5', name: 'Krem' },
];
const PATTERNS: { id: Pattern; label: string }[] = [
  { id: 'polos', label: 'Polos' },
  { id: 'kotak', label: 'Kotak-kotak' },
  { id: 'titik', label: 'Titik' },
];
const SHAPES: { id: FrameShape; label: string }[] = [
  { id: 'kotak', label: 'Kotak' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'oval', label: 'Oval' },
  { id: 'hati', label: 'Hati' },
];

export function Edit({
  photos,
  layout,
  edit,
  setEdit,
  onPrint,
  onBack,
}: {
  photos: HTMLCanvasElement[];
  layout: LayoutDef;
  edit: EditState;
  setEdit: Dispatch<SetStateAction<EditState>>;
  onPrint: (url: string) => void;
  onBack: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fonts, setFonts] = useState(0);
  const styled = useMemo(() => photos.map((p) => applyStyle(p, edit.style)), [photos, edit.style]);
  const date = useMemo(() => new Date(), []);

  // Canvas text only uses fonts that are already loaded; redraw once they are.
  useEffect(() => {
    if (!document.fonts) return;
    Promise.all([
      document.fonts.load('900 40px Archivo'),
      document.fonts.load('600 40px Archivo'),
      document.fonts.load("500 40px 'JetBrains Mono'"),
    ])
      .catch(() => {})
      .then(() => setFonts((f) => f + 1));
  }, []);

  const [sel, setSel] = useState(0);
  const drag = useRef<{ slot: Slot; px: number; py: number; ax: number; ay: number } | null>(null);

  useEffect(() => {
    if (canvasRef.current) renderStrip(canvasRef.current, styled, layout, edit, date, sel);
  }, [styled, layout, edit, date, fonts, sel]);

  const set = <K extends keyof EditState>(k: K, v: EditState[K]) => setEdit((e) => ({ ...e, [k]: v }));

  const adjOf = (i: number): Adjust => edit.adjust[i] ?? NO_ADJUST;
  const setAdj = useCallback(
    (src: number, f: (a: Adjust) => Adjust) =>
      setEdit((e) => {
        const adjust = photos.map((_, i) => e.adjust[i] ?? NO_ADJUST);
        adjust[src] = f(adjust[src]);
        return { ...e, adjust };
      }),
    [photos, setEdit],
  );

  // Screen point -> strip canvas coordinates, plus the slot under it.
  const locate = useCallback(
    (clientX: number, clientY: number) => {
      const c = canvasRef.current!;
      const r = c.getBoundingClientRect();
      const x = ((clientX - r.left) * c.width) / r.width;
      const y = ((clientY - r.top) * c.height) / r.height;
      const slot = layout.rects.find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
      return { x, y, slot };
    },
    [layout],
  );

  /** Zoom where the whole photo fits inside its cell (below 1 = smaller than cover). */
  const minZoomOf = useCallback(
    (src: number) => {
      const img = styled[src];
      const r = layout.rects.find((s) => s.src === src);
      if (!img || !r) return 1;
      const cover = Math.max(r.w / img.width, r.h / img.height);
      const contain = Math.min(r.w / img.width, r.h / img.height);
      return Math.min(1, contain / cover);
    },
    [styled, layout],
  );

  const onDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    const { x, y, slot } = locate(e.clientX, e.clientY);
    if (!slot) return;
    setSel(slot.src);
    e.currentTarget.setPointerCapture(e.pointerId);
    const a = adjOf(slot.src);
    drag.current = { slot, px: x, py: y, ax: a.x, ay: a.y };
  };

  const onMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return;
    const { x, y } = locate(e.clientX, e.clientY);
    const img = styled[d.slot.src];
    if (!img) return;
    const { w, h } = coverSize(img, d.slot, adjOf(d.slot.src).zoom);
    const spareX = w - d.slot.w;
    const spareY = h - d.slot.h;
    setAdj(d.slot.src, (a) => ({
      ...a,
      x: Math.abs(spareX) > 1 ? clamp(d.ax + (2 * (x - d.px)) / spareX, -1, 1) : 0,
      y: Math.abs(spareY) > 1 ? clamp(d.ay + (2 * (y - d.py)) / spareY, -1, 1) : 0,
    }));
  };

  const onUp = () => {
    drag.current = null;
  };

  // Mouse wheel zooms the photo under the cursor. Needs a non-passive listener to stop page scroll.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (ev: WheelEvent) => {
      const { slot } = locate(ev.clientX, ev.clientY);
      if (!slot) return;
      ev.preventDefault();
      setSel(slot.src);
      const k = ev.deltaY < 0 ? 1.08 : 1 / 1.08;
      const lo = minZoomOf(slot.src);
      setAdj(slot.src, (a) => ({ ...a, zoom: clamp(a.zoom * k, lo, MAX_ZOOM) }));
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, [locate, setAdj, minZoomOf]);

  const nudge = (dx: number, dy: number) =>
    setAdj(sel, (a) => ({ ...a, x: clamp(a.x + dx, -1, 1), y: clamp(a.y + dy, -1, 1) }));

  const cur = adjOf(sel);
  const minZoom = minZoomOf(sel);
  const canFit = minZoom < 0.99;

  return (
    <Monitor title="Hias strip" sub="Atur bingkai, lalu tekan Cetak.">
      <div className={`edit ${layout.width > layout.height ? 'land' : ''}`}>
        <div className={`edit-preview ${layout.width > layout.height ? 'land' : ''}`}>
          <canvas
            ref={canvasRef}
            aria-label="Pratinjau strip. Klik foto lalu geser untuk mengatur posisi."
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>

        <div className="edit-controls">
          <fieldset className="group">
            <legend>Atur foto</legend>
            <p className="hint tight">
              Klik foto di pratinjau lalu geser. Scroll di atas foto atau pakai slider untuk zoom. “Muat utuh” menampilkan seluruh foto tanpa terpotong.
            </p>
            <div className="keys">
              {photos.map((_, i) => (
                <button key={i} className="key" aria-pressed={sel === i} onClick={() => setSel(i)}>
                  <b>Foto {i + 1}</b>
                </button>
              ))}
            </div>
            <div className="adjust-row">
              <label className="slider">
                <span>Zoom</span>
                <input
                  type="range"
                  min={Math.floor(minZoom * 100) / 100}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={cur.zoom}
                  onChange={(e) => setAdj(sel, (a) => ({ ...a, zoom: Number(e.target.value) }))}
                  aria-label={`Zoom foto ${sel + 1}`}
                />
                <output>{cur.zoom.toFixed(1)}×</output>
              </label>
              <div className="dpad" aria-label="Geser foto">
                <button className="dp up" onClick={() => nudge(0, -0.1)} aria-label="Geser ke atas">↑</button>
                <button className="dp left" onClick={() => nudge(-0.1, 0)} aria-label="Geser ke kiri">←</button>
                <button className="dp right" onClick={() => nudge(0.1, 0)} aria-label="Geser ke kanan">→</button>
                <button className="dp down" onClick={() => nudge(0, 0.1)} aria-label="Geser ke bawah">↓</button>
              </div>
              {canFit && (
                <button
                  className="ghost small"
                  onClick={() => setAdj(sel, () => ({ x: 0, y: 0, zoom: minZoom }))}
                  title="Perkecil sampai seluruh foto masuk, sisa ruang diisi warna bingkai"
                >
                  Muat utuh
                </button>
              )}
              <button className="ghost small" onClick={() => setAdj(sel, () => NO_ADJUST)}>
                Reset
              </button>
            </div>
          </fieldset>

          {layout.deco === 'film' ? (
            <p className="hint">Template Film memakai bingkai film hitam sendiri, jadi warna dan pola tidak dipakai.</p>
          ) : (
          <>
          <fieldset className="group">
            <legend>Warna bingkai</legend>
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c.hex}
                  className="color"
                  style={{ background: c.hex }}
                  aria-pressed={edit.frameColor === c.hex}
                  aria-label={c.name}
                  title={c.name}
                  onClick={() => set('frameColor', c.hex)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Pola</legend>
            <div className="keys">
              {PATTERNS.map((p) => (
                <button key={p.id} className="key" aria-pressed={edit.pattern === p.id} onClick={() => set('pattern', p.id)}>
                  <b>{p.label}</b>
                </button>
              ))}
            </div>
          </fieldset>
          </>
          )}

          <fieldset className="group">
            <legend>Bentuk foto</legend>
            <div className="keys">
              {SHAPES.map((s) => (
                <button key={s.id} className="key" aria-pressed={edit.shape === s.id} onClick={() => set('shape', s.id)}>
                  <span className={`shape shape-${s.id}`} aria-hidden="true" />
                  <b>{s.label}</b>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Style</legend>
            <div className="keys">
              {STYLES.map((s) => (
                <button key={s.id} className="key" aria-pressed={edit.style === s.id} onClick={() => set('style', s.id)}>
                  <span className={`swatch swatch-${s.id}`} aria-hidden="true" />
                  <b>{s.label}</b>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="group">
            <legend>Teks</legend>
            <input
              className="text-input"
              value={edit.caption}
              maxLength={28}
              placeholder="Contoh: D-Fest 2026"
              onChange={(e) => set('caption', e.target.value)}
              aria-label="Teks di bawah strip"
            />
            <label className="check">
              <input type="checkbox" checked={edit.showDate} onChange={(e) => set('showDate', e.target.checked)} />
              Tampilkan tanggal
            </label>
          </fieldset>
        </div>
      </div>

      <div className="monitor-actions">
        <button className="ghost" onClick={onBack}>
          Pilih ulang
        </button>
        <span />
        <button
          className="primary big"
          onClick={() => {
            // Re-render without the selection outline for the final print.
            const out = document.createElement('canvas');
            renderStrip(out, styled, layout, edit, date);
            onPrint(out.toDataURL('image/png'));
          }}
        >
          Cetak
        </button>
      </div>
    </Monitor>
  );
}
