import type { StyleId } from './types';

export const STYLES: { id: StyleId; label: string; css: string }[] = [
  { id: 'asli', label: 'Warna asli', css: 'none' },
  { id: 'bw', label: 'Hitam putih', css: 'grayscale(1) contrast(1.15)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.85) contrast(1.05)' },
  { id: 'film', label: 'Film grain', css: 'contrast(1.12) saturate(0.75) sepia(0.18)' },
  { id: 'soft', label: 'Soft', css: 'brightness(1.08) contrast(0.9) saturate(1.05)' },
];

export const styleCss = (id: StyleId) => STYLES.find((s) => s.id === id)?.css ?? 'none';

/**
 * Pixel-level version of each style. CSS `ctx.filter` is missing on older Safari,
 * so the exported strip does the math itself.
 */
export function applyStyle(src: HTMLCanvasElement, style: StyleId): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0);
  if (style === 'asli') return c;

  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const W = c.width;
  const cx = W / 2;
  const cy = c.height / 2;
  const maxR = Math.hypot(cx, cy);

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let gr = d[i + 1];
    let b = d[i + 2];
    if (style === 'bw') {
      const l = (0.299 * r + 0.587 * gr + 0.114 * b - 128) * 1.15 + 128;
      r = gr = b = l;
    } else if (style === 'sepia') {
      const nr = 0.393 * r + 0.769 * gr + 0.189 * b;
      const ng = 0.349 * r + 0.686 * gr + 0.168 * b;
      const nb = 0.272 * r + 0.534 * gr + 0.131 * b;
      r = nr * 0.92;
      gr = ng * 0.92;
      b = nb * 0.92;
    } else if (style === 'film') {
      const l = 0.299 * r + 0.587 * gr + 0.114 * b;
      r = ((l + (r - l) * 0.7 + 8) - 128) * 1.12 + 128;
      gr = ((l + (gr - l) * 0.7 + 2) - 128) * 1.12 + 128;
      b = ((l + (b - l) * 0.7 - 6) - 128) * 1.12 + 128;
      const n = (Math.random() - 0.5) * 34;
      const p = i / 4;
      const x = p % W;
      const y = (p / W) | 0;
      const v = 1 - 0.35 * Math.pow(Math.hypot(x - cx, y - cy) / maxR, 2);
      r = (r + n) * v;
      gr = (gr + n) * v;
      b = (b + n) * v;
    } else if (style === 'soft') {
      r = (r - 128) * 0.88 + 142;
      gr = (gr - 128) * 0.88 + 138;
      b = (b - 128) * 0.88 + 140;
    }
    // Uint8ClampedArray clamps to 0..255 on write.
    d[i] = r;
    d[i + 1] = gr;
    d[i + 2] = b;
  }
  g.putImageData(img, 0, 0);
  return c;
}
