import { Bitmap, ditherRgba, fromRgba } from './bitmap';

export interface LoadImageOptions {
  /** Target width in dots; the height keeps the aspect ratio. Defaults to the image's own width. */
  width?: number;
  /** Floyd-Steinberg dithering (photos, gradients). Default false: plain threshold. */
  dither?: boolean;
  threshold?: number;
}

/**
 * Loads a PNG / JPEG / WebP / GIF file or buffer and converts it to a 1-bit bitmap, scaled to
 * `width` dots. Node only; needs the optional `@napi-rs/canvas` (or `canvas`) package.
 */
export async function loadImage(source: string | Uint8Array, options: LoadImageOptions = {}): Promise<Bitmap> {
  let mod: any = null;
  for (const name of ['@napi-rs/canvas', 'canvas']) {
    try {
      mod = require(name);
      break;
    } catch {
      /* try the next */
    }
  }
  if (!mod) throw new Error('retail-print-kit: loadImage needs @napi-rs/canvas; run `npm install @napi-rs/canvas`');
  const img = await mod.loadImage(source);
  const width = Math.max(1, Math.round(options.width ?? img.width));
  const height = Math.max(1, Math.round((img.height * width) / img.width));
  const canvas = mod.createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  return options.dither ? ditherRgba(data, width, height) : fromRgba(data, width, height, options.threshold ?? 128);
}
