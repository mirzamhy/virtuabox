import type { LayoutId } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Slot extends Rect {
  /** Index into the picked photos. */
  src: number;
}
export interface LayoutDef {
  id: LayoutId;
  label: string;
  desc: string;
  slots: number;
  width: number;
  height: number;
  rects: Slot[];
  footers: Rect[];
  /** 'row': caption left, date right on one line (default: centred stack). */
  footerStyle?: 'row';
  /** 'film': black film base with sprocket holes along each band. */
  deco?: 'film';
  filmBands?: Rect[];
}

// Sizes are 300 dpi print sizes: 2x6 in strip = 600x1800, 4x6 in = 1200x1800.
function column(x0: number, n: number, footer: number) {
  const pad = 40;
  const gap = 28;
  const w = 600 - pad * 2;
  const h = (1800 - pad - footer - gap * (n - 1)) / n;
  const rects: Slot[] = Array.from({ length: n }, (_, i) => ({
    x: x0 + pad,
    y: pad + i * (h + gap),
    w,
    h,
    src: i,
  }));
  return { rects, footer: { x: x0 + pad, y: 1800 - footer, w, h: footer - 24 } };
}

const s4 = column(0, 4, 180);
const s3 = column(0, 3, 210);
const dL = column(0, 3, 210);
const dR = column(600, 3, 210);

const gridPad = 50;
const gridGap = 28;
const gridFooter = 230;
const gw = (1200 - gridPad * 2 - gridGap) / 2;
const gh = (1800 - gridPad - gridFooter - gridGap) / 2;

// Landscape entries are added below; the assertion lets them be filled in after.
export const LAYOUTS = {
  strip4: {
    id: 'strip4',
    label: '1×4',
    desc: 'Strip klasik, 4 foto',
    slots: 4,
    width: 600,
    height: 1800,
    rects: s4.rects,
    footers: [s4.footer],
  },
  strip3: {
    id: 'strip3',
    label: '1×3',
    desc: 'Strip, 3 foto lebih besar',
    slots: 3,
    width: 600,
    height: 1800,
    rects: s3.rects,
    footers: [s3.footer],
  },
  grid4: {
    id: 'grid4',
    label: '2×2',
    desc: 'Kartu 4×6, 4 foto',
    slots: 4,
    width: 1200,
    height: 1800,
    rects: Array.from({ length: 4 }, (_, i) => ({
      x: gridPad + (i % 2) * (gw + gridGap),
      y: gridPad + Math.floor(i / 2) * (gh + gridGap),
      w: gw,
      h: gh,
      src: i,
    })),
    footers: [{ x: gridPad, y: 1800 - gridFooter, w: 1200 - gridPad * 2, h: gridFooter - 30 }],
  },
  double3: {
    id: 'double3',
    label: '2×3',
    desc: 'Dua strip kembar, bisa dibagi dua',
    slots: 3,
    width: 1200,
    height: 1800,
    rects: [...dL.rects, ...dR.rects],
    footers: [dL.footer, dR.footer],
  },
} as Record<LayoutId, LayoutDef>;

// ── Landscape cards (6×4 in = 1800×1200, 300 dpi). Photo cells are exactly 4:3,
// the camera's own shape, so nothing gets cut off. ──
const L_PAD = 50;
const L_GAP = 28;
const l4h = (1200 - L_PAD * 2 - L_GAP) / 2; // 536
const l4w = (l4h * 4) / 3; // 715
const l2w = (1800 - L_PAD * 2 - L_GAP) / 2; // 836
const l2h = (l2w * 3) / 4; // 627

LAYOUTS.land4 = {
  id: 'land4',
  label: '2×2 lebar',
  desc: 'Kartu melebar, 4 foto utuh',
  slots: 4,
  width: 1800,
  height: 1200,
  rects: Array.from({ length: 4 }, (_, i) => ({
    x: L_PAD + (i % 2) * (l4w + L_GAP),
    y: L_PAD + Math.floor(i / 2) * (l4h + L_GAP),
    w: l4w,
    h: l4h,
    src: i,
  })),
  // Narrow column on the right: text is drawn rotated.
  footers: [{ x: L_PAD + 2 * l4w + L_GAP + 24, y: L_PAD, w: 1800 - L_PAD - (L_PAD + 2 * l4w + L_GAP + 24), h: 1200 - L_PAD * 2 }],
};
LAYOUTS.land2 = {
  id: 'land2',
  label: '1×2 lebar',
  desc: 'Dua foto besar berdampingan',
  slots: 2,
  width: 1800,
  height: 1200,
  rects: [0, 1].map((i) => ({ x: L_PAD + i * (l2w + L_GAP), y: L_PAD, w: l2w, h: l2h, src: i })),
  footers: [{ x: L_PAD, y: L_PAD + l2h + 40, w: 1800 - L_PAD * 2, h: 1200 - (L_PAD + l2h + 40) - L_PAD }],
};
LAYOUTS.polaroid = {
  id: 'polaroid',
  label: 'Polaroid',
  desc: 'Satu foto besar',
  slots: 1,
  width: 1200,
  height: 1200,
  rects: [{ x: 50, y: 50, w: 1100, h: 825, src: 0 }],
  footers: [{ x: 50, y: 905, w: 1100, h: 250 }],
};

// 4 Corners: four photos at the corners, a name/date band across the middle.
{
  const pad = 40;
  const band = 150;
  const gap = 30;
  const w = (1800 - pad * 2 - gap) / 2; // 845
  const h = (1200 - pad * 2 - band) / 2; // 485
  LAYOUTS.corners = {
    id: 'corners',
    label: '4 Corners',
    desc: 'Empat sudut, pita nama di tengah',
    slots: 4,
    width: 1800,
    height: 1200,
    rects: [
      { x: pad, y: pad, w, h, src: 0 },
      { x: pad + w + gap, y: pad, w, h, src: 1 },
      { x: pad, y: pad + h + band, w, h, src: 2 },
      { x: pad + w + gap, y: pad + h + band, w, h, src: 3 },
    ],
    footers: [{ x: pad, y: pad + h, w: 1800 - pad * 2, h: band }],
    footerStyle: 'row',
  };
}

// Film: two identical horizontal film strips (cut in half to share), 3 frames each.
{
  const ph = 380;
  const pw = (ph * 4) / 3; // 507
  const x0 = 50;
  const gap = 24;
  const textX = x0 + 3 * pw + 2 * gap + 20;
  const bands = [0, 600].map((y) => ({ x: 0, y, w: 1800, h: 600 }));
  LAYOUTS.film = {
    id: 'film',
    label: 'Film',
    desc: 'Roll film hitam, 2 strip kembar',
    slots: 3,
    width: 1800,
    height: 1200,
    rects: bands.flatMap((b) =>
      [0, 1, 2].map((i) => ({ x: x0 + i * (pw + gap), y: b.y + 110, w: pw, h: ph, src: i })),
    ),
    footers: bands.map((b) => ({ x: textX, y: b.y + 110, w: 1800 - textX - 30, h: ph })),
    deco: 'film',
    filmBands: bands,
  };
}

export const LAYOUT_LIST = Object.values(LAYOUTS);

/** Width / height of a layout's photo cell. */
export const cellAspect = (l: LayoutDef) => l.rects[0].w / l.rects[0].h;
