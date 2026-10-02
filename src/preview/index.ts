import { Op } from '../core/ops';
import { Profile } from '../profiles/types';
import { CanvasRasterizer, Rasterizer } from '../core/rasterizer';
import { bitmapToPng } from './png';

export { bitmapToPng } from './png';
export { opsToHtml } from './html';
export type { HtmlPreviewOptions } from './html';

/** PNG of the ops as a bitmap printer would lay them out (needs a canvas, see CanvasRasterizer). */
export function opsToPng(ops: Op[], profile: Profile, rasterizer: Rasterizer = new CanvasRasterizer()): Buffer {
  return bitmapToPng(rasterizer.render(ops, profile));
}
