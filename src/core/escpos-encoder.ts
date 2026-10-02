import iconv from 'iconv-lite';
import { Op, BarcodeType, QrOptions } from './ops';
import { Profile } from '../profiles/types';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const BARCODE_CODE: Record<BarcodeType, number> = {
  UPC_A: 65, UPC_E: 66, EAN13: 67, EAN8: 68, CODE39: 69, ITF: 70, CODABAR: 71, CODE128: 73,
};

const QR_CORRECTION = { L: 48, M: 49, Q: 50, H: 51 } as const;

class Bytes {
  private chunks: Buffer[] = [];
  push(...parts: Array<number | Buffer | Uint8Array | number[]>): void {
    for (const p of parts) {
      if (typeof p === 'number') this.chunks.push(Buffer.from([p]));
      else if (Array.isArray(p)) this.chunks.push(Buffer.from(p));
      else this.chunks.push(Buffer.from(p));
    }
  }
  toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}

/** Turns ops into ESC/POS bytes for the given profile. Pure: no I/O, no state across calls. */
export function encodeEscPos(ops: Op[], profile: Profile): Buffer {
  const out = new Bytes();
  for (const op of ops) {
    switch (op.kind) {
      case 'init':
        out.push([ESC, 0x40]);
        if (profile.codepage !== null) out.push([ESC, 0x74, profile.codepage]);
        break;
      case 'text':
        out.push(iconv.encode(op.text, profile.encoding));
        break;
      case 'newline':
        for (let i = 0; i < op.count; i++) out.push(LF);
        break;
      case 'feed':
        out.push([ESC, 0x64, clamp(op.lines, 0, 255)]);
        break;
      case 'align':
        out.push([ESC, 0x61, op.align === 'left' ? 0 : op.align === 'center' ? 1 : 2]);
        break;
      case 'font':
        out.push([ESC, 0x4d, op.font === 'a' ? 0 : 1]);
        break;
      case 'size': {
        const w = clamp(op.width, 1, 8) - 1;
        const h = clamp(op.height, 1, 8) - 1;
        out.push([GS, 0x21, (w << 4) | h]);
        break;
      }
      case 'style':
        out.push([ESC, 0x45, op.style.bold ? 1 : 0]);
        out.push([ESC, 0x2d, op.style.underline ?? 0]);
        if (profile.features.italic) out.push([ESC, 0x34, op.style.italic ? 1 : 0]);
        if (profile.features.invert) out.push([GS, 0x42, op.style.invert ? 1 : 0]);
        break;
      case 'lineSpacing':
        if (op.dots === null) out.push([ESC, 0x32]);
        else out.push([ESC, 0x33, clamp(op.dots, 0, 255)]);
        break;
      case 'cut': {
        const feed = clamp(op.feed, 0, 255);
        if (profile.cut === 'feed-and-cut') {
          out.push([GS, 0x56, op.partial ? 66 : 65, feed]);
        } else {
          if (feed > 0) out.push([ESC, 0x64, feed]);
          out.push([GS, 0x56, op.partial ? 1 : 0]);
        }
        break;
      }
      case 'drawer':
        out.push([ESC, 0x70, op.pin === 2 ? 0 : 1, clamp(profile.drawer.on, 0, 255), clamp(profile.drawer.off, 0, 255)]);
        break;
      case 'beep':
        if (profile.features.beep) out.push([ESC, 0x42, clamp(op.times, 1, 9), clamp(op.duration, 1, 9)]);
        break;
      case 'barcode': {
        const o = op.options;
        out.push([GS, 0x68, clamp(o.height ?? 80, 1, 255)]);
        out.push([GS, 0x77, clamp(o.width ?? 3, 2, 6)]);
        const pos = o.position ?? 'below';
        out.push([GS, 0x48, pos === 'none' ? 0 : pos === 'above' ? 1 : pos === 'below' ? 2 : 3]);
        out.push([GS, 0x66, (o.font ?? 'a') === 'a' ? 0 : 1]);
        const data = Buffer.from(op.data, 'ascii');
        const m = BARCODE_CODE[op.type];
        if (op.type === 'CODE128') {
          const body = Buffer.concat([Buffer.from('{B', 'ascii'), data]);
          out.push([GS, 0x6b, m, body.length], body);
        } else {
          out.push([GS, 0x6b, m, data.length], data);
        }
        break;
      }
      case 'qr':
        if (!profile.features.nativeQr) {
          throw new Error(`thermal-print: profile ${profile.id} has no native QR; raster QR is not implemented yet`);
        }
        pushQr(out, op.data, op.options);
        break;
      case 'raster': {
        if (!profile.features.raster) throw new Error(`thermal-print: profile ${profile.id} cannot print raster images`);
        const bytesPerRow = Math.ceil(op.width / 8);
        out.push([GS, 0x76, 0x30, 0, bytesPerRow & 0xff, bytesPerRow >> 8, op.height & 0xff, op.height >> 8], op.bits);
        break;
      }
      case 'raw':
        out.push(op.bytes);
        break;
    }
  }
  return out.toBuffer();
}

function pushQr(out: Bytes, data: string, options: QrOptions): void {
  const payload = Buffer.from(data, 'utf8');
  const model = options.model === 1 ? 49 : 50;
  const size = clamp(options.size ?? 6, 1, 16);
  const ec = QR_CORRECTION[options.correction ?? 'M'];
  out.push([GS, 0x28, 0x6b, 4, 0, 49, 65, model, 0]);
  out.push([GS, 0x28, 0x6b, 3, 0, 49, 67, size]);
  out.push([GS, 0x28, 0x6b, 3, 0, 49, 69, ec]);
  const len = payload.length + 3;
  out.push([GS, 0x28, 0x6b, len & 0xff, len >> 8, 49, 80, 48], payload);
  out.push([GS, 0x28, 0x6b, 3, 0, 49, 81, 48]);
}
