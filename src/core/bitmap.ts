import QRCode from 'qrcode';
import { QrOptions } from './ops';

/** 1-bit image, rows packed MSB first, 1 = black. `bits.length === ceil(width/8) * height`. */
export interface Bitmap {
  width: number;
  height: number;
  bits: Uint8Array;
}

export function emptyBitmap(width: number, height: number): Bitmap {
  return { width, height, bits: new Uint8Array(Math.ceil(width / 8) * height) };
}

export function setPixel(b: Bitmap, x: number, y: number, black: boolean): void {
  if (x < 0 || y < 0 || x >= b.width || y >= b.height) return;
  const i = y * Math.ceil(b.width / 8) + (x >> 3);
  const mask = 0x80 >> (x & 7);
  if (black) b.bits[i] |= mask;
  else b.bits[i] &= ~mask;
}

export function getPixel(b: Bitmap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= b.width || y >= b.height) return false;
  return (b.bits[y * Math.ceil(b.width / 8) + (x >> 3)] & (0x80 >> (x & 7))) !== 0;
}

/** RGBA pixels (as from canvas getImageData) to 1-bit by luminance threshold. */
export function fromRgba(data: Uint8ClampedArray | Uint8Array, width: number, height: number, threshold = 128): Bitmap {
  const b = emptyBitmap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] / 255;
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * a + 255 * (1 - a);
      if (lum < threshold) setPixel(b, x, y, true);
    }
  }
  return b;
}

/** Draws `src` into `dst` at (x, y); pixels outside `dst` are dropped. */
export function blit(dst: Bitmap, src: Bitmap, x: number, y: number): void {
  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) {
      if (getPixel(src, sx, sy)) setPixel(dst, x + sx, y + sy, true);
    }
  }
}

/** Pads or crops to `width` dots, aligning the content left, center or right. */
export function fitWidth(src: Bitmap, width: number, align: 'left' | 'center' | 'right' = 'center'): Bitmap {
  if (src.width === width) return src;
  const out = emptyBitmap(width, src.height);
  const x = align === 'left' ? 0 : align === 'right' ? width - src.width : Math.floor((width - src.width) / 2);
  blit(out, src, x, 0);
  return out;
}

/** QR code as a bitmap, each module `options.size` dots square (default 6, like Epson cell size). */
export function qrBitmap(data: string, options: QrOptions = {}): Bitmap {
  const qr = QRCode.create(data, { errorCorrectionLevel: options.correction ?? 'M' });
  const n = qr.modules.size;
  const scale = Math.max(1, Math.min(16, Math.floor(options.size ?? 6)));
  const b = emptyBitmap(n * scale, n * scale);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.modules.get(y, x)) continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) setPixel(b, x * scale + dx, y * scale + dy, true);
    }
  }
  return b;
}
