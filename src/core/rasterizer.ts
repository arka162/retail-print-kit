import { Op, Align, Font } from './ops';
import { Profile } from '../profiles/types';
import { Bitmap, blit, emptyBitmap, fitWidth, fromRgba, qrBitmap } from './bitmap';
import { barcodeBitmap } from './barcode1d';

/** Turns text ops into a page image for printers that only accept bitmaps (Star TSP100). */
export interface Rasterizer {
  render(ops: Op[], profile: Profile): Bitmap;
}

interface Canvas2D {
  width: number;
  height: number;
  getContext(kind: '2d'): any;
}

export interface CanvasFactory {
  (width: number, height: number): Canvas2D;
}

const LINE_DOTS = 24;

interface State {
  align: Align;
  font: Font;
  w: number;
  h: number;
  bold: boolean;
  underline: 0 | 1 | 2;
  invert: boolean;
}

type Item =
  | { type: 'line'; text: string; state: State; y: number; height: number }
  | { type: 'bitmap'; bitmap: Bitmap; align: Align; y: number; height: number }
  | { type: 'gap'; y: number; height: number };

/**
 * Lays text out the way a line printer would (hard wrap at the column count, character cells of
 * dots/columns width, 24-dot lines, size multipliers), then paints it with a monospace font on a
 * canvas and thresholds to 1 bit. The canvas comes from `@napi-rs/canvas` or `canvas` unless a
 * factory is given; Electron hosts can pass a factory that wraps `document.createElement('canvas')`.
 */
export class CanvasRasterizer implements Rasterizer {
  constructor(private readonly factory: CanvasFactory = loadCanvasFactory(), private readonly fontFamily = 'monospace') {}

  render(ops: Op[], profile: Profile): Bitmap {
    const width = profile.dots;
    const items = layout(ops, profile);
    const height = items.reduce((h, it) => Math.max(h, it.y + it.height), 0);
    if (height === 0) return emptyBitmap(width, 0);
    const canvas = this.factory(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'top';
    const page = emptyBitmap(width, height);
    for (const it of items) {
      if (it.type === 'gap') continue;
      if (it.type === 'bitmap') {
        const x = it.align === 'left' ? 0 : it.align === 'right' ? width - it.bitmap.width : Math.floor((width - it.bitmap.width) / 2);
        blit(page, it.bitmap, x, it.y);
        continue;
      }
      const s = it.state;
      const cell = Math.floor(width / profile.columns[s.font]);
      const cw = cell * s.w;
      const ch = LINE_DOTS * s.h;
      const textWidth = it.text.length * cw;
      const x0 = s.align === 'left' ? 0 : s.align === 'right' ? width - textWidth : Math.floor((width - textWidth) / 2);
      if (s.invert) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x0, it.y, textWidth, ch);
        ctx.fillStyle = '#fff';
      } else {
        ctx.fillStyle = '#000';
      }
      const weight = s.bold ? 'bold ' : '';
      ctx.font = `${weight}100px ${this.fontFamily}`;
      const advance = (ctx.measureText('M').width || 60) / 100;
      const fontSize = Math.floor(Math.min(cw / advance, ch * 0.92));
      ctx.font = `${weight}${fontSize}px ${this.fontFamily}`;
      const glyphWidth = ctx.measureText('M').width;
      const scaleY = Math.max(1, (ch * 0.92) / fontSize);
      const baseline = it.y + Math.floor((ch - fontSize * scaleY) / 2);
      for (let i = 0; i < it.text.length; i++) {
        const chr = it.text[i];
        if (chr === ' ') continue;
        ctx.save();
        ctx.translate(x0 + i * cw + Math.floor((cw - glyphWidth) / 2), baseline);
        ctx.scale(1, scaleY);
        ctx.fillText(chr, 0, 0);
        ctx.restore();
      }
      if (s.underline) {
        const t = s.underline === 2 ? 2 : 1;
        ctx.fillRect(x0, it.y + ch - t - 1, textWidth, t);
      }
    }
    const img = ctx.getImageData(0, 0, width, height);
    const text = fromRgba(img.data, width, height, 170);
    for (let i = 0; i < page.bits.length; i++) page.bits[i] |= text.bits[i];
    return page;
  }
}

function layout(ops: Op[], profile: Profile): Item[] {
  const items: Item[] = [];
  let y = 0;
  const state: State = { align: 'left', font: 'a', w: 1, h: 1, bold: false, underline: 0, invert: false };
  let pending = '';
  const flushLine = (force: boolean) => {
    if (!pending && !force) return;
    const cols = Math.max(1, Math.floor(profile.columns[state.font] / state.w));
    const text = pending;
    pending = '';
    const parts: string[] = [];
    for (let i = 0; i < text.length; i += cols) parts.push(text.slice(i, i + cols));
    if (!parts.length) parts.push('');
    for (const p of parts) {
      const height = LINE_DOTS * state.h;
      items.push({ type: 'line', text: p, state: { ...state }, y, height });
      y += height;
    }
  };
  for (const op of ops) {
    switch (op.kind) {
      case 'text': {
        const lines = op.text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          pending += lines[i];
          if (i < lines.length - 1) flushLine(true);
        }
        break;
      }
      case 'newline':
        for (let i = 0; i < op.count; i++) flushLine(true);
        break;
      case 'feed':
        flushLine(false);
        items.push({ type: 'gap', y, height: LINE_DOTS * op.lines });
        y += LINE_DOTS * op.lines;
        break;
      case 'align':
        flushLine(false);
        state.align = op.align;
        break;
      case 'font':
        flushLine(false);
        state.font = op.font;
        break;
      case 'size':
        flushLine(false);
        state.w = Math.max(1, Math.min(8, Math.floor(op.width)));
        state.h = Math.max(1, Math.min(8, Math.floor(op.height)));
        break;
      case 'style':
        flushLine(false);
        state.bold = !!op.style.bold;
        state.underline = op.style.underline ?? 0;
        state.invert = !!op.style.invert;
        break;
      case 'qr': {
        flushLine(false);
        const bm = qrBitmap(op.data, op.options);
        items.push({ type: 'bitmap', bitmap: bm, align: state.align, y, height: bm.height });
        y += bm.height;
        break;
      }
      case 'raster': {
        flushLine(false);
        const bm = fitWidth({ width: op.width, height: op.height, bits: op.bits }, Math.min(op.width, profile.dots), 'left');
        items.push({ type: 'bitmap', bitmap: bm, align: state.align, y, height: bm.height });
        y += bm.height;
        break;
      }
      case 'barcode': {
        flushLine(false);
        const bm = barcodeBitmap(op.type, op.data, op.options.width ?? 2, op.options.height ?? 80);
        items.push({ type: 'bitmap', bitmap: bm, align: state.align, y, height: bm.height });
        y += bm.height;
        const pos = op.options.position ?? 'below';
        if (pos === 'below' || pos === 'both') {
          pending = op.data;
          flushLine(true);
        }
        break;
      }
      case 'cut':
        flushLine(false);
        if (op.feed > 0) {
          items.push({ type: 'gap', y, height: LINE_DOTS * op.feed });
          y += LINE_DOTS * op.feed;
        }
        break;
      default:
        break;
    }
  }
  flushLine(false);
  return items;
}

export function loadCanvasFactory(): CanvasFactory {
  for (const name of ['@napi-rs/canvas', 'canvas']) {
    try {
      const mod = require(name);
      return (w, h) => mod.createCanvas(w, h);
    } catch {
      /* try the next */
    }
  }
  return () => {
    throw new Error('retail-print-kit: bitmap printers need a canvas; install @napi-rs/canvas or pass a CanvasFactory');
  };
}
