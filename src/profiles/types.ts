export type CommandSet = 'escpos' | 'star-line' | 'star-graphic';

export interface DrawerPulse {
  /** ESC p t1: on time in units of 2 ms. */
  on: number;
  /** ESC p t2: off time in units of 2 ms. */
  off: number;
}

export interface Profile {
  id: string;
  vendor: string;
  model: string;
  set: CommandSet;
  /** Paper width in millimetres. */
  paper: 58 | 76 | 80;
  /** Printable dots across the paper (8 dots per mm on 203 dpi heads). */
  dots: number;
  /** Characters per line for font A and font B. */
  columns: { a: number; b: number };
  /** iconv-lite encoding name used for text. */
  encoding: string;
  /** ESC t n value selected on open; null leaves the printer default. */
  codepage: number | null;
  /** Full/partial cut using GS V 65/66 with feed (Epson) or GS V 0/1 after LF feed (legacy). */
  cut: 'feed-and-cut' | 'legacy';
  drawer: DrawerPulse;
  features: {
    nativeQr: boolean;
    raster: boolean;
    italic: boolean;
    invert: boolean;
    beep: boolean;
  };
  /** USB vendor and product ids that identify this printer, when known. */
  usb?: Array<{ vendorId: number; productId?: number }>;
}
