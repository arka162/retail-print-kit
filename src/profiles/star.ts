import { Profile } from './types';

const starBase = {
  vendor: 'Star Micronics',
  paper: 80 as const,
  dots: 576,
  columns: { a: 48, b: 64 },
  encoding: 'cp437',
  codepage: 1,
  cut: 'feed-and-cut' as const,
  drawer: { on: 100, off: 100 },
  usb: [{ vendorId: 0x0519 }],
};

/** TSP650II, TSP700II, TSP800II in Star Line Mode (the factory setting). */
export const starTsp650: Profile = {
  ...starBase,
  id: 'star-tsp650',
  model: 'TSP650II / TSP700II (Star Line Mode)',
  set: 'star-line',
  features: { nativeQr: true, raster: true, italic: false, invert: true, beep: false },
};

/** mC-Print3 / mC-Print2 in Star Line Mode. */
export const starMcPrint3: Profile = {
  ...starBase,
  id: 'star-mc-print3',
  model: 'mC-Print3 (Star Line Mode)',
  set: 'star-line',
  features: { nativeQr: true, raster: true, italic: false, invert: true, beep: false },
};

/** TSP100 / TSP143 family: raster only, everything is rendered to a bitmap first. */
export const starTsp100: Profile = {
  ...starBase,
  id: 'star-tsp100',
  model: 'TSP100 / TSP143 (raster)',
  set: 'star-graphic',
  codepage: null,
  features: { nativeQr: false, raster: true, italic: false, invert: true, beep: false },
};
