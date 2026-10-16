import { fromBase64, toBase64 } from '../util/base64';
import { DesignImage } from './types';
import { DESIGN_LIMITS } from './validate';

export function decodeImageBits(image: any): Uint8Array | null {
  if (!image || !Number.isInteger(image.w) || !Number.isInteger(image.h) || image.w < 1 || image.h < 1) return null;
  if (image.w > DESIGN_LIMITS.imageMaxDots || image.h > DESIGN_LIMITS.imageMaxDots || typeof image.bits !== 'string') return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(image.bits) || image.bits.length % 4 !== 0) return null;
  const raw = fromBase64(image.bits);
  return raw.length === Math.ceil(image.w / 8) * image.h ? raw : null;
}

/** RGBA pixels to a design image, transparent pixels as white; `dither` for photos, `threshold` for logos. */
export function imageFromRgba(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, mode: 'dither' | 'threshold'): DesignImage {
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3] / 255;
    lum[i] = (rgba[i * 4] * 0.299 + rgba[i * 4 + 1] * 0.587 + rgba[i * 4 + 2] * 0.114) * a + 255 * (1 - a);
  }
  const rowBytes = Math.ceil(w / 8);
  const bytes = new Uint8Array(rowBytes * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = lum[i];
      const black = old < 128;
      if (black) bytes[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
      if (mode === 'dither') {
        const err = old - (black ? 0 : 255);
        if (x + 1 < w) lum[i + 1] += (err * 7) / 16;
        if (y + 1 < h) {
          if (x > 0) lum[i + w - 1] += (err * 3) / 16;
          lum[i + w] += (err * 5) / 16;
          if (x + 1 < w) lum[i + w + 1] += err / 16;
        }
      }
    }
  }
  return { w, h, bits: toBase64(bytes) };
}
