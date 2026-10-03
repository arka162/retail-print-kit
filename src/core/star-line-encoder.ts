import iconv from 'iconv-lite';
import { Op, BarcodeType, QrOptions } from './ops';
import { Profile } from '../profiles/types';

const ESC = 0x1b;
const GS = 0x1d;
const RS = 0x1e;
const LF = 0x0a;
const BEL = 0x07;
const SUB = 0x1a;

/** Star barcode type numbers for ESC b. */
const BARCODE_CODE: Record<BarcodeType, number> = {
  UPC_E: 0, UPC_A: 1, EAN8: 2, EAN13: 3, CODE39: 4, ITF: 5, CODE128: 6, CODABAR: 8,
};

const QR_CORRECTION = { L: 0, M: 1, Q: 2, H: 3 } as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

/**
 * Star Line Mode (TSP650II, TSP700II, mC-Print, SP700). Text is printed by the printer, like
 * ESC/POS, but every command byte differs. Drawer kick is BEL (drawer 1) or SUB (drawer 2) after
 * ESC BEL sets the pulse.
 */
export function encodeStarLine(ops: Op[], profile: Profile): Buffer {
  const chunks: Buffer[] = [];
  const push = (...parts: Array<number | Buffer | Uint8Array | number[]>) => {
    for (const p of parts) chunks.push(typeof p === 'number' ? Buffer.from([p]) : Buffer.from(p as Uint8Array));
  };
  for (const op of ops) {
    switch (op.kind) {
      case 'init':
        push([ESC, 0x40]);
        if (profile.codepage !== null) push([ESC, GS, 0x74, profile.codepage]);
        break;
      case 'text':
        push(iconv.encode(op.text, profile.encoding));
        break;
      case 'newline':
        for (let i = 0; i < op.count; i++) push(LF);
        break;
      case 'feed':
        push([ESC, 0x61, clamp(op.lines, 0, 255)]);
        break;
      case 'align':
        push([ESC, GS, 0x61, op.align === 'left' ? 0 : op.align === 'center' ? 1 : 2]);
        break;
      case 'font':
        push([ESC, RS, 0x46, op.font === 'a' ? 0 : 1]);
        break;
      case 'size':
        push([ESC, 0x69, clamp(op.height, 1, 6) - 1, clamp(op.width, 1, 6) - 1]);
        break;
      case 'style':
        push([ESC, op.style.bold ? 0x45 : 0x46]);
        push([ESC, 0x2d, op.style.underline ? 1 : 0]);
        if (profile.features.invert) push([ESC, op.style.invert ? 0x34 : 0x35]);
        break;
      case 'lineSpacing':
        push(op.dots === null ? [ESC, 0x7a, 1] : [ESC, 0x30]);
        break;
      case 'cut': {
        const feed = clamp(op.feed, 0, 255);
        if (feed > 0) push([ESC, 0x61, feed]);
        push([ESC, 0x64, op.partial ? 3 : 2]);
        break;
      }
      case 'drawer': {
        const on = clamp(profile.drawer.on / 5, 1, 127);
        const off = clamp(profile.drawer.off / 5, 1, 127);
        push([ESC, BEL, on, off], op.pin === 2 ? BEL : SUB);
        break;
      }
      case 'beep':
        break;
      case 'barcode': {
        const o = op.options;
        const pos = o.position ?? 'below';
        const hri = pos === 'none' || pos === 'above' ? 3 : 4;
        const code = BARCODE_CODE[op.type];
        if (code === undefined) throw new Error(`retail-print-kit: Star Line has no barcode type ${op.type}`);
        push([ESC, 0x62, code, hri, clamp(o.width ?? 2, 1, 9), clamp(o.height ?? 80, 1, 255)], Buffer.from(op.data, 'ascii'), RS);
        break;
      }
      case 'qr':
        if (!profile.features.nativeQr) throw new Error(`retail-print-kit: profile ${profile.id} has no native QR`);
        pushQr(push, op.data, op.options);
        break;
      case 'raster': {
        if (!profile.features.raster) throw new Error(`retail-print-kit: profile ${profile.id} cannot print raster images`);
        const xBytes = Math.ceil(op.width / 8);
        push([ESC, GS, 0x53, 1, xBytes & 0xff, xBytes >> 8, op.height & 0xff, op.height >> 8, 0], op.bits);
        break;
      }
      case 'raw':
        push(op.bytes);
        break;
    }
  }
  return Buffer.concat(chunks);
}

function pushQr(push: (...p: Array<number | Buffer | Uint8Array | number[]>) => void, data: string, options: QrOptions): void {
  const payload = Buffer.from(data, 'utf8');
  push([ESC, GS, 0x79, 0x53, 0x30, options.model === 1 ? 1 : 2]);
  push([ESC, GS, 0x79, 0x53, 0x31, QR_CORRECTION[options.correction ?? 'M']]);
  push([ESC, GS, 0x79, 0x53, 0x32, clamp(options.size ?? 6, 1, 8)]);
  push([ESC, GS, 0x79, 0x44, 0x31, 0, payload.length & 0xff, payload.length >> 8], payload);
  push([ESC, GS, 0x79, 0x50]);
}
