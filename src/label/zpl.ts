import { Label, LabelOp, Rotation } from './types';
import { Bitmap } from '../core/bitmap';

const ROT: Record<Rotation, string> = { 0: 'N', 90: 'R', 180: 'I', 270: 'B' };

const BARCODE: Record<string, string> = {
  CODE128: 'BC', EAN13: 'BE', EAN8: 'B8', UPC_A: 'BU', UPC_E: 'B9', CODE39: 'B3', ITF: 'B2', CODABAR: 'BK',
};

function fd(text: string): string {
  return text.replace(/[\^~\\]/g, (c) => `\\${c}`);
}

function hexRows(b: Bitmap): string {
  const rowBytes = Math.ceil(b.width / 8);
  let out = '';
  for (let i = 0; i < b.bits.length; i++) out += b.bits[i].toString(16).padStart(2, '0').toUpperCase();
  return `${rowBytes * b.height},${rowBytes * b.height},${rowBytes},${out}`;
}

function op(o: LabelOp): string {
  const at = `^FO${Math.round(o.x)},${Math.round(o.y)}`;
  switch (o.kind) {
    case 'text': {
      const w = Math.round(o.width ?? o.height * 0.9);
      const rev = o.invert ? '^FR' : '';
      return `${at}${rev}^A0${ROT[o.rotation ?? 0]},${Math.round(o.height)},${w}^FD${fd(o.text)}^FS`;
    }
    case 'barcode': {
      const code = BARCODE[o.type];
      if (!code) throw new Error(`retail-print-kit: ZPL has no ${o.type}`);
      const hri = o.text === false ? 'N' : 'Y';
      const extra = o.type === 'CODE128' ? `,${hri},N,N` : `,${hri},N`;
      return `${at}^BY${o.module ?? 2},2,${Math.round(o.height)}^${code}${ROT[o.rotation ?? 0]},${Math.round(o.height)}${extra}^FD${fd(o.data)}^FS`;
    }
    case 'qr': {
      const ec = o.correction ?? 'M';
      return `${at}^BQ${ROT[o.rotation ?? 0]},2,${o.module ?? 4}^FD${ec}A,${fd(o.data)}^FS`;
    }
    case 'box':
      return `${at}^GB${Math.round(o.width)},${Math.round(o.height)},${o.thickness ?? 2}^FS`;
    case 'rect':
      return `${at}^GB${Math.round(o.width)},${Math.round(o.height)},${Math.round(Math.min(o.width, o.height))}^FS`;
    case 'image':
      return `${at}^GFA,${hexRows(o.bitmap)}^FS`;
  }
}

/** Zebra ZPL II. Verified against the field format the POS sends to Zebra units (^A0N text, ^BUN barcodes). */
export function encodeZpl(label: Label): string {
  const lines = ['^XA', '^CI28', `^PW${label.width}`, `^LL${label.height}`, '^LH0,0'];
  if (label.speed !== undefined) lines.push(`^PR${Math.round(label.speed)}`);
  if (label.darkness !== undefined) lines.push(`^MD${Math.round(label.darkness * 2 - 15)}`);
  for (const o of label.ops) lines.push(op(o));
  lines.push(`^PQ${label.copies},0,1,Y`, '^XZ');
  return lines.join('\n') + '\n';
}
