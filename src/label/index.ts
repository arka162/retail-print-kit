import { Label, LabelLanguage } from './types';
import { encodeZpl } from './zpl';
import { encodeTspl } from './tspl';
import { encodeEzpl } from './ezpl';

export * from './types';
export { LabelBuilder } from './builder';
export type { LabelSize } from './builder';
export { encodeZpl } from './zpl';
export { encodeTspl } from './tspl';
export { encodeEzpl } from './ezpl';
export { labelToSvg } from './svg';
export { renderLabel } from './template';
export type { LabelTemplate, LabelElement } from './template';

/** Bytes for the label in the given language; ZPL and EZPL are plain text, TSPL may carry binary images. */
export function encodeLabel(label: Label, language: LabelLanguage): Uint8Array {
  switch (language) {
    case 'zpl': return new TextEncoder().encode(encodeZpl(label));
    case 'ezpl': return new TextEncoder().encode(encodeEzpl(label));
    case 'tspl': return encodeTspl(label);
  }
}
