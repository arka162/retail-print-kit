import { Label, LabelOp } from './types';
import { barcodeBitmap } from '../core/barcode1d';
import { qrBitmap } from '../core/bitmap';
import { bitmapToPng } from '../preview/png';
import { toBase64 } from '../util/base64';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function rotate(o: { x: number; y: number; rotation?: number }): string {
  return o.rotation ? ` transform="rotate(${o.rotation} ${o.x} ${o.y})"` : '';
}

function png(b: { width: number; height: number; bits: Uint8Array }): string {
  return `data:image/png;base64,${toBase64(bitmapToPng(b))}`;
}

function op(o: LabelOp): string {
  switch (o.kind) {
    case 'text': {
      const w = o.width ?? o.height * 0.9;
      const len = o.text.length * w * 0.62;
      const bg = o.invert ? `<rect x="${o.x}" y="${o.y}" width="${len}" height="${o.height}" fill="#000"/>` : '';
      return `${bg}<text x="${o.x}" y="${o.y + o.height * 0.82}" font-size="${o.height}" textLength="${len}" lengthAdjust="spacingAndGlyphs" font-family="Helvetica, Arial, sans-serif"${o.bold ? ' font-weight="bold"' : ''} fill="${o.invert ? '#fff' : '#000'}"${rotate(o)}>${esc(o.text)}</text>`;
    }
    case 'barcode': {
      const b = barcodeBitmap(o.type, o.data, o.module ?? 2, Math.round(o.height));
      const hri = o.text === false ? '' : `<text x="${o.x + b.width / 2}" y="${o.y + o.height + 14}" font-size="14" text-anchor="middle" font-family="Helvetica, Arial, sans-serif">${esc(o.data)}</text>`;
      return `<image x="${o.x}" y="${o.y}" width="${b.width}" height="${b.height}" href="${png(b)}" style="image-rendering:pixelated"${rotate(o)}/>${hri}`;
    }
    case 'qr': {
      const b = qrBitmap(o.data, { size: o.module ?? 4, correction: o.correction });
      return `<image x="${o.x}" y="${o.y}" width="${b.width}" height="${b.height}" href="${png(b)}" style="image-rendering:pixelated"${rotate(o)}/>`;
    }
    case 'box':
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="none" stroke="#000" stroke-width="${o.thickness ?? 2}"/>`;
    case 'rect':
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="#000"/>`;
    case 'image':
      return `<image x="${o.x}" y="${o.y}" width="${o.bitmap.width}" height="${o.bitmap.height}" href="${png(o.bitmap)}" style="image-rendering:pixelated"/>`;
  }
}

/** SVG of the label at 1 unit per dot; `viewBox` is the label size so it scales anywhere. */
export function labelToSvg(label: Label): string {
  const body = label.ops.map(op).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${label.width} ${label.height}" width="${label.width}" height="${label.height}"><rect width="${label.width}" height="${label.height}" fill="#fff"/>${body}</svg>`;
}
