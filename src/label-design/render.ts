import { pattern } from '../core/barcode1d';
import { qrBitmap } from '../core/bitmap';
import { fontFamily, isVisible, resolveValue } from './fields';
import { decodeImageBits, imageFromRgba } from './image';
import { DesignImage, ElementBitmap, LabelData, LabelDesign, LabelElement, LabelWarning, Rasterize, Symbology } from './types';
import { dotsToMm, MM_PER_INCH, PT_PER_INCH } from './units';

export interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: '2d'): any;
}

export type CanvasFactory = (width: number, height: number) => CanvasLike;

export function domCanvasFactory(): CanvasFactory | undefined {
  const doc = (globalThis as any).document;
  if (!doc || typeof doc.createElement !== 'function') return undefined;
  return (width, height) => {
    const canvas = doc.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };
}

function roundPt(pt: number): number {
  return Math.round(pt * 10) / 10;
}

function wrapLines(ctx: any, text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width <= width || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function fontCss(el: LabelElement, px: number): string {
  return `${el.italic ? 'italic ' : ''}${el.weight || 400} ${px}px ${fontFamily(el.font)}`;
}

function drawText(ctx: any, el: LabelElement, data: LabelData, ppm: number, ox: number, oy: number, warn: LabelWarning[]): void {
  let text = resolveValue(el.value, data).replace(/[\r\n]+/g, ' ');
  if (el.upper) text = text.toUpperCase();
  if (!text) return;
  const w = el.w * ppm;
  const h = el.h * ppm;
  let px = ((el.size || 10) / PT_PER_INCH) * MM_PER_INCH * ppm;
  ctx.save();
  if (el.inverse) { ctx.fillStyle = '#000'; ctx.fillRect(ox, oy, w, h); }
  ctx.fillStyle = el.inverse ? '#fff' : '#000';
  ctx.font = fontCss(el, px);
  let lines = [text];
  if (el.fit === 'wrap') {
    lines = wrapLines(ctx, text, w);
    const max = el.lines || 2;
    if (lines.length > max) { lines = lines.slice(0, max); warn.push({ elementId: el.id, kind: 'wrap', message: `Text runs past ${max} lines` }); }
  } else if (ctx.measureText(text).width > w + 0.5) {
    if (el.fit === 'shrink') {
      const fitted = px * (w / ctx.measureText(text).width) * 0.98;
      warn.push({ elementId: el.id, kind: 'shrink', message: `Text shrunk ${roundPt(el.size || 10)} → ${roundPt(((el.size || 10) * fitted) / px)} pt to fit` });
      px = fitted;
      ctx.font = fontCss(el, px);
    } else {
      warn.push({ elementId: el.id, kind: 'cut', message: 'Text is cut at the box edge' });
    }
  }
  ctx.beginPath();
  ctx.rect(ox, oy, w, h);
  ctx.clip();
  const lineH = px * 1.12;
  let ty = oy + (el.fit === 'wrap' ? 0 : Math.max(0, (h - lines.length * lineH) / 2)) + px * 0.86;
  for (const line of lines) {
    const lw = ctx.measureText(line).width;
    const lx = el.align === 'center' ? ox + (w - lw) / 2 : el.align === 'right' ? ox + w - lw : ox;
    ctx.fillText(line, lx, ty);
    ty += lineH;
  }
  ctx.restore();
}

function drawPrice(ctx: any, el: LabelElement, data: LabelData, ppm: number, ox: number, oy: number, warn: LabelWarning[]): void {
  const raw = resolveValue(el.value, data).trim();
  if (!raw) return;
  const amount = Number(raw.replace(/[$,]/g, ''));
  const w = el.w * ppm;
  const h = el.h * ppm;
  let px = ((el.size || 24) / PT_PER_INCH) * MM_PER_INCH * ppm;
  const weight = el.weight || 700;
  let parts: { t: string; s: number; up?: boolean }[];
  if (!Number.isFinite(amount)) {
    parts = [{ t: raw, s: 1 }];
  } else {
    const [d, c] = Math.abs(amount).toFixed(2).split('.');
    const dollars = d.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (el.format === 'super') parts = [{ t: '$', s: 0.5, up: true }, { t: dollars, s: 1 }, { t: c, s: 0.5, up: true }];
    else if (el.format === 'nosign') parts = [{ t: `${dollars}.${c}`, s: 1 }];
    else parts = [{ t: `$${dollars}.${c}`, s: 1 }];
  }
  const family = fontFamily(el.font);
  const measure = (size: number) => parts.reduce((a, p) => {
    ctx.font = `${weight} ${size * p.s}px ${family}`;
    return a + ctx.measureText(p.t).width + (p.up ? size * 0.04 : 0);
  }, 0);
  let width = measure(px);
  if (width > w) {
    const fitted = px * (w / width) * 0.98;
    warn.push({ elementId: el.id, kind: 'shrink', message: `Price shrunk ${roundPt(el.size || 24)} → ${roundPt(((el.size || 24) * fitted) / px)} pt to fit` });
    px = fitted;
    width = measure(px);
  }
  let cx = el.align === 'center' ? ox + (w - width) / 2 : el.align === 'right' ? ox + w - width : ox;
  const base = oy + (h + px * 0.72) / 2;
  ctx.save();
  ctx.fillStyle = '#000';
  for (const p of parts) {
    const s = px * p.s;
    ctx.font = `${weight} ${s}px ${family}`;
    const py = p.up ? base - px * 0.72 + s * 0.72 : base;
    ctx.fillText(p.t, cx, py);
    const tw = ctx.measureText(p.t).width;
    if (el.strike) ctx.fillRect(cx, base - px * 0.32, tw, Math.max(1, px * 0.07));
    cx += tw + (p.up ? px * 0.04 : 0);
  }
  ctx.restore();
}

function checkDigitOk(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length - 1; i++) sum += Number(digits[digits.length - 2 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

export function barcodeProblem(symbology: Symbology, value: string): string | null {
  if (symbology === 'CODE128') return /^[\x20-\x7e]+$/.test(value) ? null : 'needs printable ASCII';
  const [min, max] = symbology === 'EAN13' ? [12, 13] : [11, 12];
  if (!/^\d+$/.test(value) || value.length < min || value.length > max) return `needs ${min} or ${max} digits`;
  if (value.length === max && !checkDigitOk(value)) return 'has a wrong check digit';
  return null;
}

const moduleCache = new Map<string, number[] | null>();

function barcodeRuns(symbology: Symbology, value: string): number[] | null {
  const key = `${symbology}|${value}`;
  if (moduleCache.has(key)) return moduleCache.get(key) as number[] | null;
  let runs: number[] | null = null;
  if (!barcodeProblem(symbology, value)) {
    try { runs = pattern(symbology, value); } catch (e) { runs = null; }
  }
  if (moduleCache.size > 2000) moduleCache.clear();
  moduleCache.set(key, runs);
  return runs;
}

export function barcodeWidthMm(el: LabelElement, value: string, dpi: number): number {
  const runs = barcodeRuns(el.symbology || 'UPC_A', value);
  return runs ? dotsToMm(runs.reduce((a, b) => a + b, 0) * (el.module || 2), dpi) : 0;
}

function drawBarcode(ctx: any, el: LabelElement, data: LabelData, ppm: number, dpi: number, ox: number, oy: number, warn: LabelWarning[]): void {
  const value = resolveValue(el.value, data).trim();
  const symbology = el.symbology || 'UPC_A';
  if (!value) { warn.push({ elementId: el.id, kind: 'missing', message: 'No UPC, barcode left off' }); return; }
  const runs = barcodeRuns(symbology, value);
  if (!runs) { warn.push({ elementId: el.id, kind: 'barcode', message: `"${value}" is not a valid ${symbology} code` }); return; }
  const hri = el.hri !== false;
  const barsH = el.h * (hri ? 0.78 : 1) * ppm;
  const modulePx = dotsToMm(el.module || 2, dpi) * ppm;
  const widthPx = runs.reduce((a, b) => a + b, 0) * modulePx;
  ctx.save();
  ctx.fillStyle = '#000';
  let x = ox;
  let bar = true;
  for (const run of runs) {
    if (bar) ctx.fillRect(x, oy, run * modulePx, barsH);
    x += run * modulePx;
    bar = !bar;
  }
  if (widthPx > el.w * ppm + 0.5) warn.push({ elementId: el.id, kind: 'cut', message: 'Barcode is wider than its box' });
  if (hri) {
    const px = el.h * 0.18 * ppm;
    ctx.font = `500 ${px}px ${fontFamily('sans')}`;
    const tw = ctx.measureText(value).width;
    ctx.fillText(value, ox + (widthPx - tw) / 2, oy + el.h * ppm - px * 0.1);
  }
  ctx.restore();
}

function drawQr(ctx: any, el: LabelElement, data: LabelData, ppm: number, ox: number, oy: number, warn: LabelWarning[]): void {
  const value = resolveValue(el.value, data).trim();
  if (!value) { warn.push({ elementId: el.id, kind: 'missing', message: 'QR code has no data' }); return; }
  const q = qrBitmap(value, { size: 1, correction: 'M' });
  const cell = (Math.min(el.w, el.h) * ppm) / q.width;
  const rowBytes = Math.ceil(q.width / 8);
  ctx.save();
  ctx.fillStyle = '#000';
  for (let y = 0; y < q.height; y++) {
    for (let x = 0; x < q.width; x++) {
      if (q.bits[y * rowBytes + (x >> 3)] & (0x80 >> (x & 7))) {
        ctx.fillRect(ox + Math.floor(x * cell), oy + Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
      }
    }
  }
  ctx.restore();
}

function drawImage(ctx: any, el: LabelElement, ppm: number, ox: number, oy: number, factory: CanvasFactory | undefined, warn: LabelWarning[]): void {
  const image = el.image;
  if (!image || !image.bits) { warn.push({ elementId: el.id, kind: 'missing', message: 'No image uploaded yet' }); return; }
  const raw = decodeImageBits(image);
  if (!raw) return;
  const width = Math.max(1, Math.round(el.w * ppm));
  const height = Math.max(1, Math.round(el.h * ppm));
  const target = ox === 0 && oy === 0 && !factory ? ctx : null;
  const off = target ? null : factory ? factory(width, height) : null;
  const g = target || (off && off.getContext('2d'));
  if (!g) return;
  const out = g.createImageData(width, height);
  const px = out.data;
  const rowBytes = Math.ceil(image.w / 8);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(image.h - 1, Math.floor((y * image.h) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(image.w - 1, Math.floor((x * image.w) / width));
      const v = raw[sy * rowBytes + (sx >> 3)] & (0x80 >> (sx & 7)) ? 0 : 255;
      const i = (y * width + x) * 4;
      px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  if (off) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, ox, oy);
    ctx.restore();
  }
}

function drawShape(ctx: any, el: LabelElement, ppm: number, ox: number, oy: number): void {
  if (el.type === 'box') {
    const t = Math.max(1, (el.stroke || 0.3) * ppm);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = t;
    ctx.strokeRect(ox + t / 2, oy + t / 2, el.w * ppm - t, el.h * ppm - t);
    return;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(ox, oy, Math.max(1, el.w * ppm), Math.max(1, el.h * ppm));
}

export interface DrawOptions {
  ppm: number;
  stock?: boolean;
  background?: string;
  canvasFactory?: CanvasFactory;
}

/** Draws the whole label on `canvas` at `ppm` pixels per millimetre and returns what does not fit. */
export function drawLabel(canvas: CanvasLike, design: LabelDesign, data: LabelData, opts: DrawOptions): LabelWarning[] {
  const ppm = opts.ppm;
  canvas.width = Math.max(1, Math.round(design.widthMm * ppm));
  canvas.height = Math.max(1, Math.round(design.heightMm * ppm));
  const ctx = canvas.getContext('2d');
  const factory = opts.canvasFactory || domCanvasFactory();
  ctx.fillStyle = opts.background || '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (design.stock && opts.stock !== false) {
    ctx.fillStyle = design.stock.color;
    ctx.fillRect(design.stock.x * ppm, design.stock.y * ppm, design.stock.w * ppm, design.stock.h * ppm);
  }
  const warn: LabelWarning[] = [];
  for (const el of design.elements || []) {
    try {
      if (!isVisible(el, data)) continue;
      const ox = el.x * ppm;
      const oy = el.y * ppm;
      if (el.type === 'text') drawText(ctx, el, data, ppm, ox, oy, warn);
      else if (el.type === 'price') drawPrice(ctx, el, data, ppm, ox, oy, warn);
      else if (el.type === 'barcode') drawBarcode(ctx, el, data, ppm, design.dpi, ox, oy, warn);
      else if (el.type === 'qr') drawQr(ctx, el, data, ppm, ox, oy, warn);
      else if (el.type === 'image') drawImage(ctx, el, ppm, ox, oy, factory, warn);
      else if (el.type === 'fill' || el.type === 'line' || el.type === 'box') drawShape(ctx, el, ppm, ox, oy);
    } catch (e) {
      continue;
    }
  }
  return warn;
}

/** The label as the printer prints it: drawn at the printer's dots, then black or white. */
export function drawPrinterView(canvas: CanvasLike, design: LabelDesign, data: LabelData, opts: { canvasFactory?: CanvasFactory } = {}): LabelWarning[] {
  const warn = drawLabel(canvas, design, data, { ppm: design.dpi / MM_PER_INCH, stock: false, canvasFactory: opts.canvasFactory });
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const l = img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114;
    const v = l < 150 ? 0 : 255;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return warn;
}

function toBitmap(ctx: any, width: number, height: number): ElementBitmap {
  const img = ctx.getImageData(0, 0, width, height).data;
  const rowBytes = Math.ceil(width / 8);
  const bits = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114;
      if (img[i + 3] > 0 && l < 150) bits[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { width, height, bits };
}

function isStatic(el: LabelElement): boolean {
  return el.type === 'image' || !/\{\{\w+\}\}/.test(String(el.value || ''));
}

/**
 * Draws one text, price, QR or image element at printer resolution for `encodeDesignLabel`.
 * Elements without placeholders are drawn once per design object and reused.
 */
export function createRasterizer(options: { canvasFactory?: CanvasFactory } = {}): Rasterize {
  const factory = options.canvasFactory || domCanvasFactory();
  if (!factory) throw new Error('retail-print-kit: createRasterizer needs a canvasFactory outside a browser');
  const cache = new WeakMap<LabelElement, { dpi: number; bitmap: ElementBitmap | null }>();
  const draw = (el: LabelElement, data: LabelData, dpi: number): ElementBitmap | null => {
    if (el.type !== 'text' && el.type !== 'price' && el.type !== 'qr' && el.type !== 'image') return null;
    const ppm = dpi / MM_PER_INCH;
    const width = Math.max(1, Math.round(el.w * ppm));
    const height = Math.max(1, Math.round(el.h * ppm));
    const canvas = factory(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    const warn: LabelWarning[] = [];
    if (el.type === 'text') drawText(ctx, el, data, ppm, 0, 0, warn);
    else if (el.type === 'price') drawPrice(ctx, el, data, ppm, 0, 0, warn);
    else if (el.type === 'qr') drawQr(ctx, el, data, ppm, 0, 0, warn);
    else drawImage(ctx, el, ppm, 0, 0, undefined, warn);
    return toBitmap(ctx, width, height);
  };
  return (el, data, dpi) => {
    if (!isStatic(el)) return draw(el, data, dpi);
    const hit = cache.get(el);
    if (hit && hit.dpi === dpi) return hit.bitmap;
    const bitmap = draw(el, data, dpi);
    cache.set(el, { dpi, bitmap });
    return bitmap;
  };
}

export function imageFromSource(source: any, srcW: number, srcH: number, w: number, h: number, mode: 'dither' | 'threshold', canvasFactory?: CanvasFactory): DesignImage {
  const factory = canvasFactory || domCanvasFactory();
  if (!factory) throw new Error('retail-print-kit: imageFromSource needs a canvasFactory outside a browser');
  const canvas = factory(w, h);
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  const scale = Math.min(w / srcW, h / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  g.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return imageFromRgba(g.getImageData(0, 0, w, h).data, w, h, mode);
}
