import { Label, LabelOp } from './types';
import { dotsToMm } from './types';

/**
 * Godex internal fonts by approximate cap height in dots at 203 dpi. Used when a text op does not
 * name a font; sizes between entries round down. Approximate: check against a printed sample.
 */
const FONTS: Array<[string, number]> = [['A', 12], ['B', 16], ['C', 20], ['D', 24], ['E', 32], ['F', 40], ['G', 48], ['H', 64]];

/** Godex barcode letters; H (UPC-A) is field-proven, the rest follow the EZPL manual. */
const BARCODE: Record<string, string> = {
  CODE39: 'A', CODE128: 'C', EAN13: 'E', EAN8: 'F', UPC_E: 'G', UPC_A: 'H', ITF: 'I', CODABAR: 'J',
};

function fontFor(height: number): { font: string; mul: number } {
  let font = FONTS[0][0];
  let size = FONTS[0][1];
  for (const [f, h] of FONTS) if (h <= height) { font = f; size = h; }
  const mul = Math.max(1, Math.min(9, Math.floor(height / size)));
  return { font, mul };
}

function op(o: LabelOp): string {
  const x = Math.round(o.x);
  const y = Math.round(o.y);
  const rot = (o as { rotation?: number }).rotation ?? 0;
  switch (o.kind) {
    case 'text': {
      const { font, mul } = fontFor(o.height);
      return `A${font},${x},${y},${mul},${mul},${rot / 90},0${o.invert ? 'R' : 'E'},${o.text}`;
    }
    case 'barcode': {
      const code = BARCODE[o.type];
      if (!code) throw new Error(`thermal-print: EZPL has no ${o.type}`);
      const narrow = o.module ?? 2;
      return `B${code},${x},${y},${narrow},${narrow * 2},${Math.round(o.height)},${rot / 90},${o.text === false ? 0 : 1},${o.data}`;
    }
    case 'qr': {
      const ec = { L: 'L', M: 'M', Q: 'Q', H: 'H' }[o.correction ?? 'M'];
      return `W${x},${y},5,2,${ec},${o.module ?? 4},${rot / 90},${o.data.length}\n${o.data}`;
    }
    case 'box':
      return `R${x},${y},${x + Math.round(o.width)},${y + Math.round(o.height)},${o.thickness ?? 2},${o.thickness ?? 2}`;
    case 'rect':
      return `R${x},${y},${x + Math.round(o.width)},${y + Math.round(o.height)},${Math.round(o.width)},${Math.round(o.height)}`;
    case 'image':
      throw new Error('thermal-print: EZPL images are not implemented yet');
  }
}

/**
 * Godex EZPL. The header and text/barcode shapes match the field format the POS sends to Godex
 * units (^Q/^W/^H/^P/^S/^L ... E). Text uses internal fonts chosen by height.
 */
export function encodeEzpl(label: Label): string {
  const lines = [
    `^Q${dotsToMm(label.height, label.dpi).toFixed(2)},${label.gap.toFixed(0)}`,
    `^W${dotsToMm(label.width, label.dpi).toFixed(2)}`,
    `^H${label.darkness ?? 10}`,
    `^P${label.copies}`,
    `^S${label.speed ?? 2}`,
    '^AD',
    '^C1',
    '^R0',
    '~Q+0',
    '^O0',
    '^D0',
    '^E18',
    '~R255',
    '^L',
  ];
  for (const o of label.ops) lines.push(op(o));
  lines.push('E');
  return lines.join('\n') + '\n';
}
