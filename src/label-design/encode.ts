import { cleanForPrinter, fitText } from './printer-text';
import { fieldValue, isVisible } from './fields';
import { ElementBitmap, EzplHeader, LabelData, LabelDesign, LabelElement, PrinterLanguage, Rasterize } from './types';
import { mmToDots } from './units';

const EZPL_BARCODES: { [s: string]: string } = { UPC_A: 'H', EAN13: 'E', CODE128: 'C' };
const ZPL_BARCODES: { [s: string]: string } = { UPC_A: 'BU', EAN13: 'BE', CODE128: 'BC' };
const encoder = new TextEncoder();

export function languageForPrinter(printerName: string | undefined | null): PrinterLanguage {
  return String(printerName || '').trim().toLowerCase() === 'zebra' ? 'zpl' : 'ezpl';
}

export function ezplHeader(h: EzplHeader): string[] {
  const lines = [
    '^XSETCUT,DOUBLECUT,0', `^Q${h.q},${h.gap === undefined ? '3' : h.gap}`, `^W${h.w}`, `^H${h.h}`, '^P1', `^S${h.s}`, '^AD', '^C1',
    `^R${h.r === undefined ? '0' : h.r}`, `~Q${h.shift === undefined ? '+0' : h.shift}`, '^O0', '^D0', '^E18', '~R255', '^L'
  ];
  if (h.includeDateTimeLines !== false) {
    lines.push('Dy2-me-dd', 'Th:m:s');
    if (h.addDateTimeTwice) lines.push('Dy2-me-dd', 'Th:m:s');
  }
  return lines;
}

function gapText(gapMm: any): string | undefined {
  const gap = Number(gapMm);
  return Number.isFinite(gap) && gap >= 0 ? String(Math.round(gap * 10) / 10) : undefined;
}

function headerLines(design: LabelDesign, language: PrinterLanguage): string[] {
  const dpi = design.dpi || 203;
  const native = design.nativeHeader && (design.nativeHeader as any)[language];
  if (language === 'zpl') {
    return native ? native.slice() : ['^XA', '^CI28', `^PW${mmToDots(design.widthMm, dpi)}`, `^LL${mmToDots(design.heightMm, dpi)}`, '^LH0,0', '^PR2', '^MD18'];
  }
  return ezplHeader(native || { q: Number(design.heightMm).toFixed(2), w: Number(design.widthMm).toFixed(2), h: '10', s: '3', gap: gapText(design.gapMm), addDateTimeTwice: false });
}

function resolveRaw(template: string | undefined, data: LabelData): string {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (m, key) => String(fieldValue(data, key)));
}

function resolveClean(template: string | undefined, data: LabelData, language: PrinterLanguage): string {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (m, key) => cleanForPrinter(fieldValue(data, key), language));
}

interface Offset { x: number; y: number; }

function nativeLine(el: LabelElement, language: PrinterLanguage, data: LabelData, dpi: number, offset: Offset): string | null {
  const pattern = (el.native as any)[language] as string;
  const bound: string[] = String(el.value || '').match(/\{\{(\w+)\}\}/g) || [];
  if (el.type === 'barcode' && bound.includes('{{barcode}}') && String(fieldValue(data, 'barcode')).trim() === '') return null;
  const value = resolveClean(el.value, data, language);
  let pos: { x: number; y: number; size?: number };
  if (el.nativeFit) {
    const fit = { left: mmToDots(el.x, dpi), right: mmToDots(el.x + el.w, dpi), middle: mmToDots(el.y + el.h / 2, dpi), size: el.nativeFit.size };
    pos = fitText(fit, resolveRaw(el.value, data));
  } else {
    pos = { x: mmToDots(el.x, dpi), y: mmToDots(el.y, dpi) };
  }
  pos = { ...pos, x: Math.max(0, pos.x + offset.x), y: Math.max(0, pos.y + offset.y) };
  return pattern.replace(/\{(x|y|size|value)\}/g, (m, slot) => (slot === 'value' ? value : String((pos as any)[slot])));
}

function barcodeLine(el: LabelElement, language: PrinterLanguage, data: LabelData, dpi: number, offset: Offset): string | null {
  const value = resolveClean(el.value, data, language).trim();
  if (!value) return null;
  const symbology = el.symbology || 'UPC_A';
  const module = Math.max(1, Math.round(el.module || 2));
  const hri = el.hri !== false;
  const height = Math.max(8, mmToDots(el.h * (hri ? 0.78 : 1), dpi));
  const x = Math.max(0, mmToDots(el.x, dpi) + offset.x);
  const y = Math.max(0, mmToDots(el.y, dpi) + offset.y);
  if (language === 'zpl') {
    const code = ZPL_BARCODES[symbology] || 'BU';
    const tail = code === 'BC' ? `${hri ? 'Y' : 'N'},N,N` : code === 'BU' ? `${hri ? 'Y' : 'N'},N,Y` : `${hri ? 'Y' : 'N'},N`;
    return `^FO${x},${y}^BY${module}^${code}N,${height},${tail}^FD${value}^FS`;
  }
  const code = EZPL_BARCODES[symbology] || 'H';
  return `B${code},${x},${y},${module},${module},${height},0,${hri ? 1 : 0},${value}`;
}

function shapeLine(el: LabelElement, language: PrinterLanguage, dpi: number, offset: Offset): string {
  const x = Math.max(0, mmToDots(el.x, dpi) + offset.x);
  const y = Math.max(0, mmToDots(el.y, dpi) + offset.y);
  const w = Math.max(1, mmToDots(el.w, dpi));
  const h = Math.max(1, mmToDots(el.h, dpi));
  const t = el.type === 'box' ? Math.max(1, mmToDots(el.stroke || 0.3, dpi)) : Math.min(w, h);
  if (language === 'zpl') return `^FO${x},${y}^GB${w},${h},${t}^FS`;
  return el.type === 'box' ? `R${x},${y},${x + w},${y + h},${t},${t}` : `R${x},${y},${x + w},${y + h},${w},${h}`;
}

function hex(bits: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bits.length; i++) out += (bits[i] < 16 ? '0' : '') + bits[i].toString(16);
  return out.toUpperCase();
}

function zplGraphic(x: number, y: number, bitmap: ElementBitmap): string {
  const rowBytes = Math.ceil(bitmap.width / 8);
  const total = rowBytes * bitmap.height;
  return `^FO${x},${y}^GFA,${total},${total},${rowBytes},${hex(bitmap.bits)}^FS`;
}

function ezplGraphic(x: number, y: number, bitmap: ElementBitmap): Uint8Array {
  const rowBytes = Math.ceil(bitmap.width / 8);
  return concat([encoder.encode(`Q${x},${y},${rowBytes},${bitmap.height}\r\n`), bitmap.bits]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/**
 * Printer commands for one label. Printer-font elements and barcodes, lines and boxes are native commands;
 * designer fonts, prices, QR codes and images come from `rasterize` as graphics (ZPL ^GFA, EZPL Q).
 */
export function encodeDesignLabel(design: LabelDesign, language: PrinterLanguage, data: LabelData, rasterize: Rasterize, labelOffset?: { x?: number; y?: number } | null): Uint8Array {
  const dpi = design.dpi || 203;
  const offset = { x: Math.round(Number(labelOffset && labelOffset.x) || 0), y: Math.round(Number(labelOffset && labelOffset.y) || 0) };
  const parts: Uint8Array[] = headerLines(design, language).map((line) => encoder.encode(line));
  for (const el of design.elements || []) {
    if (!isVisible(el, data)) continue;
    if (el.native && (el.native as any)[language]) {
      const line = nativeLine(el, language, data, dpi, offset);
      if (line !== null) parts.push(encoder.encode(line));
      continue;
    }
    if (el.type === 'barcode') {
      const line = barcodeLine(el, language, data, dpi, offset);
      if (line !== null) parts.push(encoder.encode(line));
      continue;
    }
    if (el.type === 'box' || el.type === 'fill' || el.type === 'line') {
      parts.push(encoder.encode(shapeLine(el, language, dpi, offset)));
      continue;
    }
    const bitmap = rasterize(el, data, dpi);
    if (!bitmap || !bitmap.width || !bitmap.height) continue;
    const x = Math.max(0, mmToDots(el.x, dpi) + offset.x);
    const y = Math.max(0, mmToDots(el.y, dpi) + offset.y);
    parts.push(language === 'zpl' ? encoder.encode(zplGraphic(x, y, bitmap)) : ezplGraphic(x, y, bitmap));
  }
  parts.push(encoder.encode(language === 'zpl' ? '^XZ' : 'E'));
  const crlf = encoder.encode('\r\n');
  return concat(parts.reduce<Uint8Array[]>((out, part) => out.concat([part, crlf]), []));
}
