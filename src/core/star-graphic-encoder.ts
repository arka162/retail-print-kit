import { Op } from './ops';
import { Profile } from '../profiles/types';
import { Rasterizer } from './rasterizer';

const ESC = 0x1b;
const NUL = 0x00;
const FF = 0x0c;
const BEL = 0x07;
const SUB = 0x1a;

/**
 * Star raster mode (TSP100 / TSP143 family, "graphic only" printers). The whole receipt is one
 * bitmap sent line by line with `b nL nH data`; cut happens at end of document per the EOT mode.
 * Drawer kick uses the peripheral commands outside raster mode.
 *
 * Byte values for ESC * r E (EOT cut mode) follow the Star raster spec as read; verify on a real
 * TSP143 before release: 1 = full cut, 2 = partial cut, 0 = no cut.
 */
export function encodeStarGraphic(ops: Op[], profile: Profile, rasterizer: Rasterizer): Buffer {
  const chunks: Buffer[] = [];
  const push = (...parts: Array<number | Buffer | Uint8Array | number[]>) => {
    for (const p of parts) chunks.push(typeof p === 'number' ? Buffer.from([p]) : Buffer.from(p as Uint8Array));
  };
  const cut = ops.find((o): o is Extract<Op, { kind: 'cut' }> => o.kind === 'cut');
  const drawers = ops.filter((o): o is Extract<Op, { kind: 'drawer' }> => o.kind === 'drawer');
  const raws = ops.filter((o): o is Extract<Op, { kind: 'raw' }> => o.kind === 'raw');
  const printable = ops.filter((o) => o.kind !== 'drawer' && o.kind !== 'raw' && o.kind !== 'init');
  const page = printable.length ? rasterizer.render(printable, profile) : null;

  if (page && page.height > 0) {
    push([ESC, 0x2a, 0x72, 0x52]);
    push([ESC, 0x2a, 0x72, 0x41]);
    push([ESC, 0x2a, 0x72, 0x50, 0x30, NUL]);
    push([ESC, 0x2a, 0x72, 0x45, cut ? (cut.partial ? 0x32 : 0x31) : 0x30, NUL]);
    const rowBytes = Math.ceil(page.width / 8);
    for (let y = 0; y < page.height; y++) {
      push([0x62, rowBytes & 0xff, rowBytes >> 8], page.bits.subarray(y * rowBytes, (y + 1) * rowBytes));
    }
    push([ESC, FF, NUL]);
    push([ESC, 0x2a, 0x72, 0x42]);
  }
  for (const d of drawers) {
    const on = Math.max(1, Math.min(127, Math.floor(profile.drawer.on / 5)));
    const off = Math.max(1, Math.min(127, Math.floor(profile.drawer.off / 5)));
    push([ESC, BEL, on, off], d.pin === 2 ? BEL : SUB);
  }
  for (const r of raws) push(r.bytes);
  return Buffer.concat(chunks);
}
