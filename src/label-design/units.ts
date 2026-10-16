export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;

export function mmToDots(mm: number, dpi: number): number {
  return Math.round((Number(mm) / MM_PER_INCH) * dpi);
}

export function dotsToMm(dots: number, dpi: number): number {
  return (dots / dpi) * MM_PER_INCH;
}

export function snapToDot(mm: number, dpi: number): number {
  return dotsToMm(mmToDots(mm, dpi), dpi);
}
