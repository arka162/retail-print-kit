import { Op } from './ops';
import { Profile } from '../profiles/types';
import { encodeEscPos } from './escpos-encoder';
import { encodeStarLine } from './star-line-encoder';
import { encodeStarGraphic } from './star-graphic-encoder';
import { Rasterizer, CanvasRasterizer } from './rasterizer';

export interface EncodeContext {
  /** Used by bitmap-only command sets. Defaults to a canvas-backed rasterizer. */
  rasterizer?: Rasterizer;
}

export function encode(ops: Op[], profile: Profile, ctx: EncodeContext = {}): Buffer {
  switch (profile.set) {
    case 'escpos':
      return encodeEscPos(ops, profile);
    case 'star-line':
      return encodeStarLine(ops, profile);
    case 'star-graphic':
      return encodeStarGraphic(ops, profile, ctx.rasterizer ?? new CanvasRasterizer());
  }
}
