import { Op, Align, Font, StyleFlags } from '../core/ops';
import { Profile } from '../profiles/types';
import { qrBitmap } from '../core/bitmap';
import { barcodeBitmap } from '../core/barcode1d';
import { bitmapToPng } from './png';

export interface HtmlPreviewOptions {
  /** Wrap in a full document with the receipt styles. Default true. */
  document?: boolean;
  /** CSS pixels per character cell of font A. Default 8. */
  cellWidth?: number;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Paper-like HTML of the ops: monospaced lines at the profile's column count, with size, style,
 * alignment and font honoured, and QR / barcodes / images inlined as PNG. Meant for on-screen
 * preview and for a designer; not byte-exact with any printer.
 */
export function opsToHtml(ops: Op[], profile: Profile, options: HtmlPreviewOptions = {}): string {
  const cell = options.cellWidth ?? 8;
  const paperPx = profile.columns.a * cell;
  const state = { align: 'left' as Align, font: 'a' as Font, w: 1, h: 1, style: {} as StyleFlags };
  const lines: string[] = [];
  let pending = '';
  const styleAttr = () => {
    const parts = [`text-align:${state.align}`];
    if (state.w !== 1 || state.h !== 1) parts.push(`transform:scale(${state.w},${state.h});transform-origin:${state.align} top`, `height:${state.h}em`);
    if (state.font === 'b') parts.push('font-size:0.78em');
    if (state.style.bold) parts.push('font-weight:bold');
    if (state.style.underline) parts.push(`text-decoration:underline${state.style.underline === 2 ? ' double' : ''}`);
    if (state.style.invert) parts.push('background:#000;color:#fff');
    return parts.join(';');
  };
  const flush = (force: boolean) => {
    if (!pending && !force) return;
    const cols = Math.max(1, Math.floor(profile.columns[state.font] / state.w));
    const parts: string[] = [];
    for (let i = 0; i < pending.length; i += cols) parts.push(pending.slice(i, i + cols));
    if (!parts.length) parts.push('');
    for (const p of parts) lines.push(`<div class="l" style="${styleAttr()}">${esc(p) || '&nbsp;'}</div>`);
    pending = '';
  };
  const img = (png: Buffer, width: number, alt: string) =>
    lines.push(`<div class="l" style="text-align:${state.align}"><img alt="${esc(alt)}" width="${Math.round((width / profile.dots) * paperPx)}" src="data:image/png;base64,${png.toString('base64')}"></div>`);
  for (const op of ops) {
    switch (op.kind) {
      case 'text': {
        const ls = op.text.split('\n');
        for (let i = 0; i < ls.length; i++) {
          pending += ls[i];
          if (i < ls.length - 1) flush(true);
        }
        break;
      }
      case 'newline':
        for (let i = 0; i < op.count; i++) flush(true);
        break;
      case 'feed':
        flush(false);
        for (let i = 0; i < op.lines; i++) lines.push('<div class="l">&nbsp;</div>');
        break;
      case 'align': flush(false); state.align = op.align; break;
      case 'font': flush(false); state.font = op.font; break;
      case 'size': flush(false); state.w = op.width; state.h = op.height; break;
      case 'style': flush(false); state.style = op.style; break;
      case 'qr': { flush(false); const b = qrBitmap(op.data, op.options); img(bitmapToPng(b), b.width, `QR ${op.data}`); break; }
      case 'barcode': {
        flush(false);
        const b = barcodeBitmap(op.type, op.data, op.options.width ?? 2, op.options.height ?? 80);
        img(bitmapToPng(b), b.width, `${op.type} ${op.data}`);
        const pos = op.options.position ?? 'below';
        if (pos === 'below' || pos === 'both') { pending = op.data; flush(true); }
        break;
      }
      case 'raster': { flush(false); img(bitmapToPng({ width: op.width, height: op.height, bits: op.bits }), op.width, 'image'); break; }
      case 'cut': flush(false); lines.push('<div class="cut"></div>'); break;
      case 'drawer': flush(false); lines.push('<div class="note">[drawer kick]</div>'); break;
      default: break;
    }
  }
  flush(false);
  const body = `<div class="paper" style="width:${paperPx}px">${lines.join('')}</div>`;
  if (options.document === false) return body;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(profile.model)} preview</title><style>
body{background:#777;margin:0;padding:16px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:${cell * 1.6}px;line-height:1.25}
.paper{background:#fff;color:#000;padding:12px ${cell}px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,.4);box-sizing:content-box}
.l{white-space:pre;overflow:hidden;min-height:1.25em}
.cut{border-top:2px dashed #999;margin:6px -${cell}px}
.note{color:#999;font-size:.7em;text-align:center}
img{image-rendering:pixelated;vertical-align:top}
</style></head><body>${body}</body></html>`;
}
