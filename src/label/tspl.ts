import { Label, LabelOp, Rotation } from './types';
import { dotsToMm } from './types';
import { Bitmap } from '../core/bitmap';

const BARCODE: Record<string, string> = {
  CODE128: '128', EAN13: 'EAN13', EAN8: 'EAN8', UPC_A: 'UPCA', UPC_E: 'UPCE', CODE39: '39', ITF: 'ITF', CODABAR: 'CODA',
};

function q(text: string): string {
  return `"${text.replace(/"/g, '\\["]')}"`;
}

function mm(dots: number, dpi: number): string {
  return dotsToMm(dots, dpi).toFixed(2);
}

/** TSPL BITMAP data: 1 bits are white, so the bitmap is inverted. */
function bitmapBytes(b: Bitmap): Uint8Array {
  const out = new Uint8Array(b.bits.length);
  for (let i = 0; i < b.bits.length; i++) out[i] = ~b.bits[i] & 0xff;
  return out;
}

function op(o: LabelOp, dpi: number): Uint8Array | string {
  const x = Math.round(o.x);
  const y = Math.round(o.y);
  const rot = (r: Rotation | undefined) => r ?? 0;
  switch (o.kind) {
    case 'text': {
      const h = Math.round(o.height);
      const w = Math.round(o.width ?? o.height * 0.9);
      const line = `TEXT ${x},${y},"0",${rot(o.rotation)},${w},${h},${q(o.text)}`;
      return o.invert ? `${line}\nREVERSE ${x},${y},${Math.round(w * o.text.length * 0.6)},${h}` : line;
    }
    case 'barcode': {
      const code = BARCODE[o.type];
      if (!code) throw new Error(`retail-print-kit: TSPL has no ${o.type}`);
      const narrow = o.module ?? 2;
      return `BARCODE ${x},${y},"${code}",${Math.round(o.height)},${o.text === false ? 0 : 1},${rot(o.rotation)},${narrow},${narrow * 2},${q(o.data)}`;
    }
    case 'qr':
      return `QRCODE ${x},${y},${o.correction ?? 'M'},${o.module ?? 4},A,${rot(o.rotation)},${q(o.data)}`;
    case 'box':
      return `BOX ${x},${y},${x + Math.round(o.width)},${y + Math.round(o.height)},${o.thickness ?? 2}`;
    case 'rect':
      return `BAR ${x},${y},${Math.round(o.width)},${Math.round(o.height)}`;
    case 'image': {
      const rowBytes = Math.ceil(o.bitmap.width / 8);
      const head = `BITMAP ${x},${y},${rowBytes},${o.bitmap.height},0,`;
      const bytes = bitmapBytes(o.bitmap);
      const out = new Uint8Array(head.length + bytes.length + 1);
      for (let i = 0; i < head.length; i++) out[i] = head.charCodeAt(i);
      out.set(bytes, head.length);
      out[out.length - 1] = 0x0a;
      return out;
    }
  }
  void dpi;
}

/** TSC / TSPL2 (TSC, Xprinter and Rongta label units). Images are binary, so the result is bytes. */
export function encodeTspl(label: Label): Uint8Array {
  const parts: Array<Uint8Array | string> = [
    `SIZE ${mm(label.width, label.dpi)} mm,${mm(label.height, label.dpi)} mm`,
    `GAP ${label.gap.toFixed(2)} mm,0 mm`,
    'DIRECTION 1,0',
    'REFERENCE 0,0',
  ];
  if (label.speed !== undefined) parts.push(`SPEED ${label.speed}`);
  if (label.darkness !== undefined) parts.push(`DENSITY ${Math.round(label.darkness)}`);
  parts.push('CLS');
  for (const o of label.ops) parts.push(op(o, label.dpi));
  parts.push(`PRINT ${label.copies},1`);
  const chunks = parts.map((p) => (typeof p === 'string' ? new TextEncoder().encode(p + '\n') : p));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
