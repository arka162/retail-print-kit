import { BarcodeType } from '../core/ops';
import { Label, Rotation } from './types';
import { LabelBuilder } from './builder';
import { Scope, interpolate, truthy } from '../template/expr';

export type LabelElement =
  | { type: 'text'; x: number; y: number; value: string; height: number; width?: number; rotation?: Rotation; bold?: boolean; invert?: boolean; when?: string }
  | { type: 'barcode'; x: number; y: number; value: string; format?: BarcodeType; height: number; module?: number; rotation?: Rotation; text?: boolean; when?: string }
  | { type: 'qr'; x: number; y: number; value: string; module?: number; correction?: 'L' | 'M' | 'Q' | 'H'; rotation?: Rotation; when?: string }
  | { type: 'box'; x: number; y: number; width: number; height: number; thickness?: number; when?: string }
  | { type: 'rect'; x: number; y: number; width: number; height: number; when?: string };

/** A label layout: positions in dots at `dpi`, values are `{{path | filter}}` strings. */
export interface LabelTemplate {
  name: string;
  version: 1;
  kind: 'label';
  widthMm: number;
  heightMm: number;
  dpi?: 203 | 300 | 600;
  gapMm?: number;
  elements: LabelElement[];
}

export function renderLabel(template: LabelTemplate, data: unknown): Label {
  if (template.version !== 1 || template.kind !== 'label') throw new Error('thermal-print: not a version 1 label template');
  const b = new LabelBuilder({ widthMm: template.widthMm, heightMm: template.heightMm, dpi: template.dpi, gapMm: template.gapMm });
  const scope: Scope = { root: data, current: data };
  for (const e of template.elements) {
    if (e.when && !truthy(e.when, scope)) continue;
    switch (e.type) {
      case 'text':
        b.text(e.x, e.y, interpolate(e.value, scope), e.height, { width: e.width, rotation: e.rotation, bold: e.bold, invert: e.invert });
        break;
      case 'barcode':
        b.barcode(e.x, e.y, interpolate(e.value, scope), e.format ?? 'CODE128', e.height, { module: e.module, rotation: e.rotation, text: e.text });
        break;
      case 'qr':
        b.qr(e.x, e.y, interpolate(e.value, scope), { module: e.module, correction: e.correction, rotation: e.rotation });
        break;
      case 'box':
        b.box(e.x, e.y, e.width, e.height, e.thickness);
        break;
      case 'rect':
        b.rect(e.x, e.y, e.width, e.height);
        break;
    }
  }
  return b.label;
}
