import { BarcodeType } from '../core/ops';
import { Bitmap } from '../core/bitmap';

export type Rotation = 0 | 90 | 180 | 270;
export type LabelLanguage = 'zpl' | 'tspl' | 'ezpl';

/** Everything is in dots at the label's dpi; (0,0) is the top-left corner. */
export type LabelOp =
  | { kind: 'text'; x: number; y: number; text: string; height: number; width?: number; rotation?: Rotation; bold?: boolean; invert?: boolean }
  | { kind: 'barcode'; x: number; y: number; data: string; type: BarcodeType; height: number; module?: number; rotation?: Rotation; text?: boolean }
  | { kind: 'qr'; x: number; y: number; data: string; module?: number; correction?: 'L' | 'M' | 'Q' | 'H'; rotation?: Rotation }
  | { kind: 'box'; x: number; y: number; width: number; height: number; thickness?: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'image'; x: number; y: number; bitmap: Bitmap };

export interface Label {
  /** Dots across the label. */
  width: number;
  /** Dots down the label. */
  height: number;
  dpi: 203 | 300 | 600;
  /** Gap between labels in millimetres (0 for continuous stock). */
  gap: number;
  copies: number;
  /** Print darkness 0..15 where the language has it. */
  darkness?: number;
  /** Print speed in inches per second where the language has it. */
  speed?: number;
  ops: LabelOp[];
}

export function mmToDots(mm: number, dpi: number): number {
  return Math.round((mm / 25.4) * dpi);
}

export function dotsToMm(dots: number, dpi: number): number {
  return (dots / dpi) * 25.4;
}
