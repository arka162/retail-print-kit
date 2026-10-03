import QRCode from 'qrcode';
import { QrOptions } from './ops';
import { toBase64, fromBase64 } from '../util/base64';

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

/**
 * RGBA pixels to 1-bit with Floyd-Steinberg error diffusion. Use for photos and logos with
 * gradients; `fromRgba` (plain threshold) is sharper for line art and text.
 */
export function ditherRgba(data: Uint8ClampedArray | Uint8Array, width: number, height: number): Bitmap {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3] / 255;
    lum[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) * a + 255 * (1 - a);
  }
  const b = emptyBitmap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const old = lum[i];
      const black = old < 128;
      if (black) setPixel(b, x, y, true);
      const err = old - (black ? 0 : 255);
      if (x + 1 < width) lum[i + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) lum[i + width - 1] += (err * 3) / 16;
        lum[i + width] += (err * 5) / 16;
        if (x + 1 < width) lum[i + width + 1] += err / 16;
      }
    }
  }
  return b;
}

/** A bitmap as plain JSON (`{ width, height, data }`, bits in base64), for templates and storage. */
export interface SerializedBitmap {
  width: number;
  height: number;
  data: string;
}

export function serializeBitmap(b: Bitmap): SerializedBitmap {
  return { width: b.width, height: b.height, data: toBase64(b.bits) };
}

export function deserializeBitmap(s: SerializedBitmap): Bitmap {
  const bits = fromBase64(s.data);
  const expected = Math.ceil(s.width / 8) * s.height;
  if (bits.length !== expected) throw new Error(`retail-print-kit: bitmap data is ${bits.length} bytes, expected ${expected}`);
  return { width: s.width, height: s.height, bits };
}
