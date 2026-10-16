import { fromBase64 } from '../util/base64';

export const DESIGN_LIMITS = {
  maxBytes: 256 * 1024,
  maxElements: 300,
  valueMax: 1000,
  sizeMm: [5, 300] as [number, number],
  dpis: [203, 300, 600],
  printers: ['ezpl', 'zpl'],
  elementTypes: ['text', 'price', 'barcode', 'qr', 'box', 'fill', 'line', 'image'],
  gapMm: [0, 20] as [number, number],
  imageMaxDots: 2400
};

function isNumber(value: any): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBase64(text: string): boolean {
  return text.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(text);
}

export function imageError(image: any): string | null {
  if (!image || typeof image !== 'object' || Array.isArray(image)) return 'must be an object';
  const { w, h } = image;
  for (const side of [w, h]) {
    if (!Number.isInteger(side) || side < 1 || side > DESIGN_LIMITS.imageMaxDots) return `must be 1 to ${DESIGN_LIMITS.imageMaxDots} dots wide and high`;
  }
  const bits = String(image.bits ?? '');
  if (!isBase64(bits)) return 'has bits that are not base64';
  if (fromBase64(bits).length !== Math.ceil(w / 8) * h) return 'has bits that do not match its size';
  return null;
}

export function elementError(element: any, index: number, widthMm: number, heightMm: number): string | null {
  const where = `element ${index + 1}`;
  if (!element || typeof element !== 'object' || Array.isArray(element)) return `${where} must be an object`;
  if (!DESIGN_LIMITS.elementTypes.includes(element.type)) return `${where} has an unknown type`;
  for (const key of ['x', 'y', 'w', 'h']) {
    if (!isNumber(element[key])) return `${where} needs a number for ${key}`;
  }
  if (element.w < 0 || element.h < 0) return `${where} cannot have a negative size`;
  if (element.x < -widthMm || element.x > widthMm || element.y < -heightMm || element.y > heightMm) return `${where} is placed outside the label`;
  if (element.w > 2 * widthMm || element.h > 2 * heightMm) return `${where} is larger than the label`;
  const value = element.value;
  if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > DESIGN_LIMITS.valueMax)) return `${where} has a value that is not text or is too long`;
  if ('image' in element) {
    const problem = imageError(element.image);
    if (problem) return `${where} has an image that ${problem}`;
  }
  return null;
}

/** The first reason a design cannot be saved or printed, or null when it is fine. */
export function validateDesign(design: any): string | null {
  if (!design || typeof design !== 'object' || Array.isArray(design)) return 'design must be an object';
  if (design.version !== 1 || design.kind !== 'label') return 'design must be a version 1 label';
  const [minMm, maxMm] = DESIGN_LIMITS.sizeMm;
  for (const key of ['widthMm', 'heightMm']) {
    const size = design[key];
    if (!isNumber(size) || size < minMm || size > maxMm) return `${key} must be between ${minMm} and ${maxMm} mm`;
  }
  if (!DESIGN_LIMITS.dpis.includes(design.dpi)) return `dpi must be one of ${DESIGN_LIMITS.dpis.join(', ')}`;
  if (design.printer !== undefined && design.printer !== null && !DESIGN_LIMITS.printers.includes(design.printer)) return 'printer must be ezpl or zpl';
  const gap = design.gapMm === undefined ? 0 : design.gapMm;
  if (!isNumber(gap) || gap < DESIGN_LIMITS.gapMm[0] || gap > DESIGN_LIMITS.gapMm[1]) return 'gapMm must be between 0 and 20';
  if (!Array.isArray(design.elements)) return 'design elements must be a list';
  if (design.elements.length > DESIGN_LIMITS.maxElements) return `a label can have at most ${DESIGN_LIMITS.maxElements} elements`;
  for (let i = 0; i < design.elements.length; i++) {
    const problem = elementError(design.elements[i], i, design.widthMm, design.heightMm);
    if (problem) return problem;
  }
  if (JSON.stringify(design).length > DESIGN_LIMITS.maxBytes) return 'design is too large';
  return null;
}
