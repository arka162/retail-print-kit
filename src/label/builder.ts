import { BarcodeType } from '../core/ops';
import { Bitmap } from '../core/bitmap';
import { Label, LabelOp, Rotation, mmToDots } from './types';

export interface LabelSize {
  /** Width and height in millimetres. */
  widthMm: number;
  heightMm: number;
  dpi?: 203 | 300 | 600;
  gapMm?: number;
}

/** Records label elements in dots; `mm()` converts millimetres at the label's dpi. */
export class LabelBuilder {
  readonly label: Label;

  constructor(size: LabelSize) {
    const dpi = size.dpi ?? 203;
    this.label = { width: mmToDots(size.widthMm, dpi), height: mmToDots(size.heightMm, dpi), dpi, gap: size.gapMm ?? 3, copies: 1, ops: [] };
  }

  mm(mm: number): number {
    return mmToDots(mm, this.label.dpi);
  }

  copies(n: number): this { this.label.copies = Math.max(1, Math.floor(n)); return this; }
  darkness(n: number): this { this.label.darkness = n; return this; }
  speed(ips: number): this { this.label.speed = ips; return this; }

  push(op: LabelOp): this { this.label.ops.push(op); return this; }

  text(x: number, y: number, text: string, height: number, opts: { width?: number; rotation?: Rotation; bold?: boolean; invert?: boolean } = {}): this {
    return this.push({ kind: 'text', x, y, text, height, ...opts });
  }

  barcode(x: number, y: number, data: string, type: BarcodeType, height: number, opts: { module?: number; rotation?: Rotation; text?: boolean } = {}): this {
    return this.push({ kind: 'barcode', x, y, data, type, height, ...opts });
  }

  qr(x: number, y: number, data: string, opts: { module?: number; correction?: 'L' | 'M' | 'Q' | 'H'; rotation?: Rotation } = {}): this {
    return this.push({ kind: 'qr', x, y, data, ...opts });
  }

  box(x: number, y: number, width: number, height: number, thickness = 2): this {
    return this.push({ kind: 'box', x, y, width, height, thickness });
  }

  rect(x: number, y: number, width: number, height: number): this {
    return this.push({ kind: 'rect', x, y, width, height });
  }

  image(x: number, y: number, bitmap: Bitmap): this {
    return this.push({ kind: 'image', x, y, bitmap });
  }
}
