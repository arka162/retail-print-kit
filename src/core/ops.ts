export type Align = 'left' | 'center' | 'right';
export type Font = 'a' | 'b';
export type BarcodeType = 'CODE128' | 'EAN13' | 'EAN8' | 'UPC_A' | 'UPC_E' | 'CODE39' | 'ITF' | 'CODABAR';
export type BarcodePosition = 'none' | 'above' | 'below' | 'both';

export interface StyleFlags {
  bold?: boolean;
  underline?: 0 | 1 | 2;
  italic?: boolean;
  invert?: boolean;
}

export interface BarcodeOptions {
  width?: number;
  height?: number;
  position?: BarcodePosition;
  font?: Font;
  includeParity?: boolean;
}

export interface QrOptions {
  size?: number;
  correction?: 'L' | 'M' | 'Q' | 'H';
  model?: 1 | 2;
}

export type Op =
  | { kind: 'init' }
  | { kind: 'text'; text: string }
  | { kind: 'newline'; count: number }
  | { kind: 'feed'; lines: number }
  | { kind: 'align'; align: Align }
  | { kind: 'font'; font: Font }
  | { kind: 'size'; width: number; height: number }
  | { kind: 'style'; style: StyleFlags }
  | { kind: 'lineSpacing'; dots: number | null }
  | { kind: 'cut'; partial: boolean; feed: number }
  | { kind: 'drawer'; pin: 2 | 5 }
  | { kind: 'beep'; times: number; duration: number }
  | { kind: 'barcode'; data: string; type: BarcodeType; options: BarcodeOptions }
  | { kind: 'qr'; data: string; options: QrOptions }
  | { kind: 'raster'; width: number; height: number; bits: Uint8Array }
  | { kind: 'raw'; bytes: Uint8Array };
