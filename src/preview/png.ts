import { Bitmap, getPixel } from '../core/bitmap';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number): number[] {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = concat([new Uint8Array([...type].map((c) => c.charCodeAt(0))), data]);
  return concat([new Uint8Array(u32(data.length)), body, new Uint8Array(u32(crc32(body)))]);
}

function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const d of data) {
    a = (a + d) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** zlib stream with stored (uncompressed) deflate blocks; used where Node's zlib is unavailable. */
function deflateStored(data: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  const MAX = 65535;
  for (let i = 0; i < data.length || i === 0; i += MAX) {
    const slice = data.subarray(i, Math.min(i + MAX, data.length));
    const last = i + MAX >= data.length ? 1 : 0;
    const len = slice.length;
    blocks.push(new Uint8Array([last, len & 0xff, len >> 8, ~len & 0xff, (~len >> 8) & 0xff]), slice);
    if (data.length === 0) break;
  }
  blocks.push(new Uint8Array(u32(adler32(data))));
  return concat(blocks);
}

function deflate(data: Uint8Array): Uint8Array {
  try {
    const zlib = require('zlib') as typeof import('zlib');
    const out = zlib.deflateSync(data);
    return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  } catch {
    return deflateStored(data);
  }
}

/** Encodes a 1-bit bitmap as a PNG (1-bit greyscale, black = ink). No dependencies; works in browsers. */
export function bitmapToPng(b: Bitmap): Uint8Array {
  const rowBytes = Math.ceil(b.width / 8);
  const raw = new Uint8Array((rowBytes + 1) * b.height);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      if (!getPixel(b, x, y)) raw[y * (rowBytes + 1) + 1 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const ihdr = new Uint8Array([...u32(b.width), ...u32(b.height), 1, 0, 0, 0, 0]);
  const png = concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflate(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
  return typeof Buffer !== 'undefined' ? Buffer.from(png.buffer, png.byteOffset, png.byteLength) : png;
}
