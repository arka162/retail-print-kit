import { BUILTIN_TEMPLATES } from './builtins-data';
import { ezplHeader } from './encode';
import { fieldValue } from './fields';
import { cleanForPrinter, fitText } from './printer-text';
import { BuiltinTemplate, LabelData, LabelDesign, LabelElement, PrinterLanguage } from './types';
import { dotsToMm, MM_PER_INCH, PT_PER_INCH } from './units';

export { BUILTIN_TEMPLATES };

const DEFAULT_SIZE = '2 X 1';
const SIZE_ALIASES: { [size: string]: string } = { '1 X 1.25': '1.25 X 1' };
const EZPL_FONT_PT: { [letter: string]: number } = { A: 6, B: 8, C: 10, D: 12, E: 14, F: 18, G: 24, H: 30 };

export function normalizeSize(size: string | undefined | null): string {
  const key = String(size || '').toUpperCase().replace(/["”]/g, '').replace(/\s+/g, ' ').trim();
  return SIZE_ALIASES[key] || key;
}

/** The built-in layout a printer uses for a size and price type, with the same fallbacks the layouts always had. */
export function findBuiltinTemplate(size: string | undefined | null, labelType: string | undefined | null, language: PrinterLanguage): BuiltinTemplate | undefined {
  const printable = BUILTIN_TEMPLATES.filter((t) => t.printers[language]);
  const requested = normalizeSize(size);
  const chosenSize = printable.some((t) => t.size === requested) ? requested : DEFAULT_SIZE;
  const layout = labelType === 'dual' && printable.some((t) => t.size === chosenSize && t.layout === 'dual') ? 'dual' : 'single';
  return printable.find((t) => t.size === chosenSize && t.layout === layout);
}

export function encodeBuiltinLabel(template: BuiltinTemplate, language: PrinterLanguage, data: LabelData): string {
  const variant = template.printers[language];
  if (!variant) throw new Error(`retail-print-kit: label template ${template.id} has no ${language} layout`);
  const lines: string[] = language === 'zpl' ? variant.header.slice() : ezplHeader(variant.header);
  for (const el of variant.elements) {
    const bound = String(el.value).match(/\{\{(\w+)\}\}/g) || [];
    if (el.type === 'barcode' && bound.some((b) => b === '{{barcode}}') && String(fieldValue(data, 'barcode')).trim() === '') continue;
    const raw = el.value.replace(/\{\{(\w+)\}\}/g, (m, key) => String(fieldValue(data, key)));
    const value = el.value.replace(/\{\{(\w+)\}\}/g, (m, key) => cleanForPrinter(fieldValue(data, key), language));
    const pos: any = el.fit ? fitText(el.fit, raw) : { x: el.x, y: el.y };
    lines.push(el.native.replace(/\{(x|y|size|value)\}/g, (m, slot) => (slot === 'value' ? value : String(pos[slot]))));
  }
  lines.push(language === 'zpl' ? '^XZ' : 'E');
  return lines.join('\r\n') + '\r\n';
}

let idCounter = 0;

export function newId(): string {
  idCounter += 1;
  return `e${Date.now().toString(36)}${idCounter}`;
}

function nativeText(pattern: string, x: number, y: number, dpi: number, fieldValueText: string, labelWidthMm: number): LabelElement {
  const parts = pattern.split(',');
  const letter = parts[0].charAt(1);
  const ymul = Number(parts[4]) || 1;
  const pt = (EZPL_FONT_PT[letter] || 10) * ymul;
  const xMm = dotsToMm(x, dpi);
  const hMm = (pt / PT_PER_INCH) * MM_PER_INCH * 1.25;
  return { id: newId(), type: 'text', x: xMm, y: dotsToMm(y, dpi), w: Math.max(2, labelWidthMm - xMm - 0.5), h: hMm, value: fieldValueText, font: 'printer', size: pt, weight: 700, align: 'left', fit: 'cut' };
}

/** An editable design that prints exactly like the built-in layout until it is changed. */
export function designFromBuiltin(builtin: BuiltinTemplate, language: PrinterLanguage): LabelDesign {
  const variant = builtin.printers[language];
  if (!variant) throw new Error(`retail-print-kit: label template ${builtin.id} has no ${language} layout`);
  const dpi = builtin.dpi || 203;
  const elements: LabelElement[] = [];
  for (const el of variant.elements) {
    const native: any = { [language]: el.native };
    if (el.fit) {
      const fit = el.fit;
      elements.push({
        id: newId(), type: 'text', x: dotsToMm(fit.left, dpi), y: dotsToMm(fit.middle - fit.size / 2, dpi),
        w: dotsToMm(fit.right - fit.left, dpi), h: dotsToMm(fit.size, dpi), value: el.value, font: 'printer',
        size: (fit.size / dpi) * PT_PER_INCH, weight: 700, align: 'center', fit: 'shrink', native, nativeFit: fit
      });
      continue;
    }
    if (el.type === 'barcode') {
      const m: any = language === 'zpl' ? el.native.match(/\^BY(\d+)/) : el.native.split(',');
      const module = language === 'zpl' ? Number(m ? m[1] : 2) : Number(m[3]) || 2;
      const hDots = language === 'zpl' ? Number((el.native.match(/\^BU[NRIB],(\d+)/) || [])[1] || 40) : Number(m[5]) || 40;
      elements.push({
        id: newId(), type: 'barcode', x: dotsToMm(el.x as number, dpi), y: dotsToMm(el.y as number, dpi), w: dotsToMm(113 * module, dpi), h: dotsToMm(hDots * 1.3, dpi),
        value: el.value, symbology: 'UPC_A', module, hri: true, native
      });
      continue;
    }
    if (language === 'zpl') {
      const f = el.native.match(/\^A0[NRIB],(\d+),(\d+)/);
      const hDots = f ? Number(f[1]) : 24;
      const xMm = dotsToMm(el.x as number, dpi);
      elements.push({
        id: newId(), type: 'text', x: xMm, y: dotsToMm(el.y as number, dpi), w: Math.max(2, builtin.widthMm - xMm - 0.5), h: dotsToMm(hDots, dpi),
        value: el.value, font: 'printer', size: (hDots / dpi) * PT_PER_INCH, weight: 700, align: 'left', fit: 'cut', native
      });
      continue;
    }
    const t = nativeText(el.native, el.x as number, el.y as number, dpi, el.value, builtin.widthMm);
    t.native = native;
    elements.push(t);
  }
  return {
    version: 1, kind: 'label', widthMm: builtin.widthMm, heightMm: builtin.heightMm, dpi, printer: language, gapMm: 3,
    source: builtin.id, nativeHeader: { [language]: variant.header } as any, limits: variant.limits, stock: null, elements
  };
}

export function blankDesign(widthMm: number, heightMm: number, dpi: number, printer: PrinterLanguage, gapMm: number): LabelDesign {
  return { version: 1, kind: 'label', widthMm, heightMm, dpi, printer, gapMm, stock: null, elements: [] };
}

/** The same layout stretched to a new size; printer-font elements become designer text. */
export function scaleDesign(design: LabelDesign, widthMm: number, heightMm: number): LabelDesign {
  const sx = widthMm / design.widthMm;
  const sy = heightMm / design.heightMm;
  return {
    ...design, widthMm, heightMm, source: design.source, nativeHeader: undefined,
    elements: design.elements.map((e) => {
      const { native, nativeFit, ...rest } = e;
      return { ...rest, id: newId(), x: e.x * sx, y: e.y * sy, w: e.w * sx, h: e.h * sy, font: e.font === 'printer' ? 'sans' : e.font };
    })
  };
}
