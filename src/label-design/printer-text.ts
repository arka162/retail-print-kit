import { PrinterLanguage } from './types';

export function cleanForPrinter(value: any, language: PrinterLanguage): string {
  const text = String(value).replace(/[\r\n]+/g, ' ');
  return language === 'zpl' ? text.replace(/[\^~]/g, '') : text;
}

export function fitText(fit: { left: number; right: number; middle: number; size: number }, text: string): { x: number; y: number; size: number } {
  const units = Array.from(String(text)).reduce((sum, ch) => sum + (ch === '.' || ch === ',' ? 0.26 : 0.52), 0) || 1;
  const room = fit.right - fit.left;
  const size = Math.max(8, Math.min(fit.size, Math.floor(room / units)));
  return {
    x: fit.left + Math.max(0, Math.round((room - size * units) / 2)),
    y: Math.max(0, Math.round(fit.middle - size * 0.5)),
    size
  };
}
