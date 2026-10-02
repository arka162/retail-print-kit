import { Profile } from './types';

const epsonBase = {
  vendor: 'Epson',
  set: 'escpos' as const,
  paper: 80 as const,
  dots: 576,
  columns: { a: 48, b: 64 },
  encoding: 'cp437',
  codepage: 0,
  cut: 'feed-and-cut' as const,
  drawer: { on: 25, off: 250 },
  features: { nativeQr: true, raster: true, italic: false, invert: true, beep: false },
};

export const epsonTmT88: Profile = {
  ...epsonBase,
  id: 'epson-tm-t88',
  model: 'TM-T88V / VI / VII',
  usb: [{ vendorId: 0x04b8 }],
};

export const epsonTmT20: Profile = {
  ...epsonBase,
  id: 'epson-tm-t20',
  model: 'TM-T20III',
  usb: [{ vendorId: 0x04b8 }],
};

export const epsonTmM30: Profile = {
  ...epsonBase,
  id: 'epson-tm-m30',
  model: 'TM-m30II / III',
  usb: [{ vendorId: 0x04b8 }],
};

/**
 * Cheap Epson-compatible units (Xprinter, Rongta, HPRT, POS-X and similar). They answer to the
 * common subset but often mishandle GS V 65/66, so cutting feeds with LF first and uses GS V 0/1.
 */
export const genericEscPos: Profile = {
  ...epsonBase,
  vendor: 'Generic',
  id: 'generic-escpos',
  model: 'ESC/POS compatible 80 mm',
  cut: 'legacy',
  drawer: { on: 60, off: 120 },
  features: { nativeQr: true, raster: true, italic: false, invert: true, beep: true },
};

export const genericEscPos58: Profile = {
  ...genericEscPos,
  id: 'generic-escpos-58',
  model: 'ESC/POS compatible 58 mm',
  paper: 58,
  dots: 384,
  columns: { a: 32, b: 42 },
};
