import zlib from 'zlib';
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

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Encodes a 1-bit bitmap as a PNG (1-bit greyscale, black = ink). No dependencies. */
export function bitmapToPng(b: Bitmap): Buffer {
  const rowBytes = Math.ceil(b.width / 8);
  const raw = Buffer.alloc((rowBytes + 1) * b.height);
  for (let y = 0; y < b.height; y++) {
    raw[y * (rowBytes + 1)] = 0;
    for (let x = 0; x < b.width; x++) {
      if (!getPixel(b, x, y)) raw[y * (rowBytes + 1) + 1 + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(b.width, 0);
  ihdr.writeUInt32BE(b.height, 4);
  ihdr[8] = 1;
  ihdr[9] = 0;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
