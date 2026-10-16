import { FieldOption, LabelData, LabelDesign, LabelElement } from './types';

export const FIELDS: FieldOption[] = [
  { key: 'itemName', label: 'Description', icon: 'text', sample: 'BUDWEISER 12PK 12OZ CAN' },
  { key: 'price', label: 'Price', icon: 'dollar', sample: '$15.99' },
  { key: 'cashPrice', label: 'Cash price', icon: 'dollar', sample: '$15.99' },
  { key: 'creditPrice', label: 'Credit price', icon: 'dollar', sample: '$16.55' },
  { key: 'unit', label: 'Size / unit', icon: 'box', sample: '12 PK' },
  { key: 'brand', label: 'Brand', icon: 'store', sample: 'ANHEUSER-BUSCH' },
  { key: 'department', label: 'Department', icon: 'layers', sample: 'BEER' },
  { key: 'vendor', label: 'Vendor', icon: 'truck', sample: 'SOUTHERN GLAZER' },
  { key: 'reorderId', label: 'Reorder #', icon: 'hash', sample: '100482' },
  { key: 'barcode', label: 'UPC', icon: 'barcode', sample: '018200007712' },
  { key: 'printDate', label: 'Print date', icon: 'calendar', sample: '10/14/2026' },
  { key: 'storeName', label: 'Store name', icon: 'store', sample: 'Main Street Market' }
];

export const FONTS: { key: string; label: string; family: string }[] = [
  { key: 'sans', label: 'Sans', family: '"Arimo", Arial, Helvetica, sans-serif' },
  { key: 'condensed', label: 'Condensed', family: '"Archivo Narrow", "Arial Narrow", sans-serif' },
  { key: 'display', label: 'Display', family: '"Oswald", "Arial Narrow", sans-serif' },
  { key: 'serif', label: 'Serif', family: '"Roboto Slab", Georgia, serif' },
  { key: 'printer', label: 'Printer font', family: '"Arimo", Arial, Helvetica, sans-serif' }
];

export function fontFamily(key?: string): string {
  const f = FONTS.find((x) => x.key === key);
  return (f || FONTS[0]).family;
}

export function formatPrice(value: any): string {
  if (value === undefined || value === null || String(value).trim() === '') return `$${value}`;
  const amount = Number(value);
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : `$${value}`;
}

function trimTo(value: any, max: number): any {
  if (typeof value !== 'string') return value;
  return value.length > max ? value.substring(0, max) : value;
}

function padUpc(raw: any): any {
  if (raw === undefined || raw === null) return raw;
  const s = String(raw).trim();
  if (s === '' || s.length >= 12) return s;
  return s.padStart(12, '0');
}

export interface ItemDataOptions {
  priceType?: string;
  limits?: { itemName?: number; brand?: number };
  storeName?: string;
  date?: Date;
}

/**
 * Label fields from an item record: `posdecs`/`item_name`, `price`, `surcharge_amount`, `brand`, `size_unit`,
 * `re_order`, `upc` (string or list), `department`, `vendor`.
 */
export function labelDataFromItem(item: any, opts: ItemDataOptions = {}): LabelData {
  const limits = { itemName: Infinity, brand: Infinity, ...(opts.limits || {}) };
  const brandRaw = item.brand && item.brand != '' ? item.brand : '--';
  const price = formatPrice(item.price);
  const creditPrice = formatPrice(item.surcharge_amount);
  const upc = Array.isArray(item.upc) ? item.upc[0] : item.upc;
  return {
    itemName: trimTo(item.posdecs && item.posdecs.length ? item.posdecs : item.item_name, limits.itemName as number),
    brand: (limits.brand as number) > 0 ? trimTo(brandRaw, limits.brand as number) : '',
    unit: item.size_unit && item.size_unit != '' ? item.size_unit : '--',
    reorderId: item.re_order && item.re_order != '' ? item.re_order : '--',
    barcode: padUpc(upc),
    price: opts.priceType === 'credit' ? creditPrice : price,
    cashPrice: price,
    creditPrice,
    department: item.department || '',
    vendor: item.vendor || '',
    printDate: (opts.date || new Date()).toLocaleDateString('en-US'),
    storeName: opts.storeName || ''
  };
}

export function templateData(item: any, design: LabelDesign, storeName?: string, date?: Date): LabelData {
  return labelDataFromItem(item, { priceType: 'single', limits: design && design.limits, storeName, date });
}

export function sampleData(): LabelData {
  const d: LabelData = {};
  FIELDS.forEach((f) => (d[f.key] = f.sample));
  return d;
}

export function fieldValue(data: LabelData, key: string): any {
  const v = data[key];
  return v === undefined || v === null ? '' : v;
}

export function resolveValue(template: string | undefined, data: LabelData): string {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (m, key) => String(fieldValue(data, key)));
}

export function boundFields(template: string | undefined): string[] {
  return (String(template || '').match(/\{\{(\w+)\}\}/g) || []).map((m) => m.slice(2, -2));
}

export function isVisible(el: LabelElement, data: LabelData): boolean {
  if (!el.when) return true;
  const v = data[el.when];
  return !(v === undefined || v === null || v === '' || v === false || v === '--');
}

export function fieldsUsed(design: LabelDesign): string[] {
  const used = new Set<string>();
  for (const el of design.elements || []) {
    boundFields(el.value).forEach((f) => used.add(f));
    if (el.when) used.add(el.when);
  }
  return Array.from(used);
}
