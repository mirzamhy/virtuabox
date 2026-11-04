import { NO_ADJUST, type Adjust, type EditState, type FrameShape } from './types';
import type { LayoutDef, Rect } from './layouts';

/** Size of the photo inside a slot: cover-fit times the user's zoom. */
export function coverSize(img: HTMLCanvasElement, r: Rect, zoom: number) {
  const s = Math.max(r.w / img.width, r.h / img.height) * zoom;
  return { w: img.width * s, h: img.height * s };
}

function luminance(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function shapePath(g: CanvasRenderingContext2D, shape: FrameShape, r: Rect) {
  g.beginPath();
  if (shape === 'kotak') {
    g.rect(r.x, r.y, r.w, r.h);
  } else if (shape === 'rounded') {
    const k = Math.min(r.w, r.h) * 0.09;
    g.moveTo(r.x + k, r.y);
    g.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, k);
    g.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, k);
    g.arcTo(r.x, r.y + r.h, r.x, r.y, k);
    g.arcTo(r.x, r.y, r.x + r.w, r.y, k);
    g.closePath();
  } else if (shape === 'oval') {
    g.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
  } else {
    // Heart fitted inside the slot, centred.
    const s = Math.min(r.w, r.h * 1.05);
    const cx = r.x + r.w / 2;
    const top = r.y + (r.h - s * 0.95) / 2;
    g.moveTo(cx, top + s * 0.3);
    g.bezierCurveTo(cx, top + s * 0.02, cx - s * 0.5, top, cx - s * 0.5, top + s * 0.3);
    g.bezierCurveTo(cx - s * 0.5, top + s * 0.6, cx - s * 0.05, top + s * 0.75, cx, top + s * 0.95);
    g.bezierCurveTo(cx + s * 0.05, top + s * 0.75, cx + s * 0.5, top + s * 0.6, cx + s * 0.5, top + s * 0.3);
    g.bezierCurveTo(cx + s * 0.5, top, cx, top + s * 0.02, cx, top + s * 0.3);
    g.closePath();
  }
}

function drawCover(g: CanvasRenderingContext2D, img: HTMLCanvasElement, r: Rect, a: Adjust) {
  const { w, h } = coverSize(img, r, a.zoom);
  const x = r.x + (r.w - w) / 2 + (a.x * (w - r.w)) / 2;
  const y = r.y + (r.h - h) / 2 + (a.y * (h - r.h)) / 2;
  g.drawImage(img, x, y, w, h);
}

export function formatDate(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Draw the finished strip onto `out` at full print resolution. */
export function renderStrip(
  out: HTMLCanvasElement,
  photos: HTMLCanvasElement[],
  layout: LayoutDef,
  e: EditState,
  date: Date,
  /** Preview only: outline the photo being adjusted. */
  highlight?: number,
) {
  out.width = layout.width;
  out.height = layout.height;
  const g = out.getContext('2d')!;
  const W = layout.width;
  const H = layout.height;
  const film = layout.deco === 'film';
  // Film style has its own black base; frame colour and pattern don't apply.
  const base = film ? '#141414' : e.frameColor;
  const light = luminance(base) > 0.55;
  const ink = film ? '#f2efe6' : light ? '#1b1c1e' : '#f6f4f0';
  const tint = light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';

  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  if (film) {
    drawFilm(g, layout.filmBands ?? []);
  } else if (e.pattern === 'kotak') {
    const s = 60;
    g.fillStyle = tint;
    for (let y = 0; y < H; y += s)
      for (let x = 0; x < W; x += s) if (((x + y) / s) % 2 === 1) g.fillRect(x, y, s, s);
  } else if (e.pattern === 'titik') {
    g.fillStyle = tint;
    for (let y = 20; y < H; y += 40)
      for (let x = (y / 40) % 2 ? 40 : 20; x < W; x += 40) {
        g.beginPath();
        g.arc(x, y, 5, 0, Math.PI * 2);
        g.fill();
      }
  }

  for (const slot of layout.rects) {
    const img = photos[slot.src];
    g.save();
    shapePath(g, e.shape, slot);
    g.fillStyle = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
    g.fill();
    if (img) {
      g.clip();
      drawCover(g, img, slot, e.adjust[slot.src] ?? NO_ADJUST);
    }
    g.restore();
  }

  if (highlight !== undefined) {
    g.save();
    g.lineWidth = 8;
    g.strokeStyle = '#3b82f6';
    g.setLineDash([26, 14]);
    for (const slot of layout.rects)
      if (slot.src === highlight) g.strokeRect(slot.x + 4, slot.y + 4, slot.w - 8, slot.h - 8);
    g.restore();
  }

  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const f of layout.footers) {
    if (layout.footerStyle === 'row') {
      drawRowFooter(g, f, e, date, ink);
      continue;
    }
    // A tall, narrow footer (side column) gets its text rotated to read bottom-to-top.
    const vertical = f.h > f.w * 1.6;
    const fw = vertical ? f.h : f.w;
    const fh = vertical ? f.w : f.h;
    g.save();
    if (vertical) {
      g.translate(f.x + f.w / 2, f.y + f.h / 2);
      g.rotate(-Math.PI / 2);
      g.translate(-fw / 2, -fh / 2);
    } else {
      g.translate(f.x, f.y);
    }
    const cx = fw / 2;
    const brand = Math.round(Math.min(fw * 0.085, fh * 0.3));
    const hasCaption = e.caption.trim().length > 0;
    const lines = 1 + (hasCaption ? 1 : 0) + (e.showDate ? 1 : 0);
    let y = fh / 2 - ((lines - 1) * brand * 0.95) / 2;
    g.font = `900 ${brand}px Archivo, Arial, sans-serif`;
    g.fillText('VIRTUA BOX', cx, y);
    if (hasCaption) {
      y += brand * 1.05;
      g.font = `600 ${Math.round(brand * 0.62)}px Archivo, Arial, sans-serif`;
      g.fillText(e.caption.trim(), cx, y, fw * 0.92);
    }
    if (e.showDate) {
      y += brand * 0.9;
      g.font = `500 ${Math.round(brand * 0.46)}px 'JetBrains Mono', monospace`;
      g.fillText(formatDate(date), cx, y);
    }
    g.restore();
  }
}

/** Sprocket holes and amber edge print, like 35 mm film. */
function drawFilm(g: CanvasRenderingContext2D, bands: Rect[]) {
  for (const b of bands) {
    for (const yc of [b.y + 32, b.y + b.h - 32]) {
      g.fillStyle = '#d8d3c6';
      for (let x = 22; x < b.x + b.w - 30; x += 56) {
        const w = 30;
        const h = 20;
        const k = 5;
        const y = yc - h / 2;
        g.beginPath();
        g.moveTo(x + k, y);
        g.arcTo(x + w, y, x + w, y + h, k);
        g.arcTo(x + w, y + h, x, y + h, k);
        g.arcTo(x, y + h, x, y, k);
        g.arcTo(x, y, x + w, y, k);
        g.fill();
      }
    }
    g.fillStyle = '#e0a526';
    g.font = "700 20px 'JetBrains Mono', monospace";
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    let n = 12;
    for (let x = 60; x < b.w - 200; x += 420) {
      g.fillText(`▸ ${n}A   VIRTUA 400`, x, b.y + 80);
      g.fillText(`${n + 1}`, x + 210, b.y + b.h - 80);
      n += 2;
    }
  }
  // Cut line between the two strips.
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  g.setLineDash([18, 12]);
  for (const b of bands.slice(1)) {
    g.beginPath();
    g.moveTo(0, b.y);
    g.lineTo(b.x + b.w, b.y);
    g.stroke();
  }
  g.setLineDash([]);
}

/** One-line footer: caption (or brand) on the left, date on the right. */
function drawRowFooter(g: CanvasRenderingContext2D, f: Rect, e: EditState, date: Date, ink: string) {
  const size = Math.round(f.h * 0.34);
  const cy = f.y + f.h / 2;
  const caption = e.caption.trim();
  g.save();
  g.fillStyle = ink;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.font = `800 ${size}px Archivo, Arial, sans-serif`;
  g.fillText((caption || 'VIRTUA BOX').toUpperCase(), f.x + 24, cy, f.w * 0.6);
  g.textAlign = 'right';
  if (e.showDate) {
    g.font = `500 ${Math.round(size * 0.62)}px 'JetBrains Mono', monospace`;
    g.fillText(formatDate(date), f.x + f.w - 24, cy);
  } else if (caption) {
    g.font = `900 ${Math.round(size * 0.55)}px Archivo, Arial, sans-serif`;
    g.fillText('VIRTUA BOX', f.x + f.w - 24, cy);
  }
  g.restore();
}
