export type ElementType = 'text' | 'price' | 'barcode' | 'qr' | 'box' | 'fill' | 'line' | 'image';
export type PrinterLanguage = 'ezpl' | 'zpl';
export type Symbology = 'UPC_A' | 'EAN13' | 'CODE128';

export interface DesignImage {
  w: number;
  h: number;
  bits: string;
}

export interface NativeFit {
  left: number;
  right: number;
  middle: number;
  size: number;
}

export interface LabelElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  value?: string;
  font?: string;
  size?: number;
  weight?: number;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  fit?: 'cut' | 'wrap' | 'shrink';
  lines?: number;
  upper?: boolean;
  inverse?: boolean;
  format?: 'super' | 'plain' | 'nosign';
  strike?: boolean;
  symbology?: Symbology;
  hri?: boolean;
  module?: number;
  stroke?: number;
  when?: string;
  native?: { ezpl?: string; zpl?: string };
  nativeFit?: NativeFit;
  image?: DesignImage;
}

export interface EzplHeader {
  q: string;
  w: string;
  h: string;
  s: string;
  r?: string;
  shift?: string;
  gap?: string;
  includeDateTimeLines?: boolean;
  addDateTimeTwice?: boolean;
}

/** A label design, version 1. Saved as JSON; every app that renders or prints it reads the same shape. */
export interface LabelDesign {
  version: 1;
  kind: 'label';
  widthMm: number;
  heightMm: number;
  dpi: number;
  printer?: PrinterLanguage;
  gapMm?: number;
  stock?: { color: string; x: number; y: number; w: number; h: number } | null;
  source?: string;
  nativeHeader?: { ezpl?: EzplHeader; zpl?: string[] };
  limits?: { itemName?: number; brand?: number };
  elements: LabelElement[];
}

export interface LabelData {
  [field: string]: any;
}

export interface LabelWarning {
  elementId: string;
  kind: 'cut' | 'wrap' | 'shrink' | 'missing' | 'barcode';
  message: string;
}

export interface FieldOption {
  key: string;
  label: string;
  icon: string;
  sample: string;
}

export interface BuiltinElement {
  type: 'text' | 'barcode';
  x?: number;
  y?: number;
  value: string;
  native: string;
  fit?: NativeFit;
}

export interface BuiltinVariant {
  limits: { itemName: number; brand: number };
  header: any;
  elements: BuiltinElement[];
}

/** A fixed layout printed with the printer's own fonts, kept byte for byte as it always printed. */
export interface BuiltinTemplate {
  id: string;
  name: string;
  version: number;
  kind: 'label';
  builtin: true;
  size: string;
  layout: 'single' | 'dual';
  priceTypes: string[];
  widthMm: number;
  heightMm: number;
  dpi: number;
  printers: { ezpl?: BuiltinVariant; zpl?: BuiltinVariant };
}

export interface ElementBitmap {
  width: number;
  height: number;
  bits: Uint8Array;
}

export type Rasterize = (el: LabelElement, data: LabelData, dpi: number) => ElementBitmap | null;
