import { Op, Align, Font, BarcodeType, BarcodeOptions, QrOptions, StyleFlags } from './ops';
import { Profile } from '../profiles/types';
import { Transport } from '../transports/types';
import { encode } from './encode';

export type EscposAlign = 'lt' | 'ct' | 'rt' | Align;
export type EscposStyle = 'normal' | 'b' | 'i' | 'u' | 'u2' | 'bi' | 'biu' | 'biu2' | 'bu' | 'bu2' | 'iu' | 'iu2';

export interface TableCell {
  text: string;
  align?: 'LEFT' | 'CENTER' | 'RIGHT';
  /** Fraction of the line (0..1) or an absolute column count when > 1. */
  width?: number;
  style?: EscposStyle;
  size?: [number, number];
}

export interface TableOptions {
  /** Line width in columns; defaults to the profile's columns for the current font. */
  width?: number;
  /** When false, long cells are cut instead of wrapped. Default true. */
  wrap?: boolean;
}

export interface PrinterOptions {
  /** Send ESC @ and the profile code page on open. Default true. */
  initOnOpen?: boolean;
}

const ALIGN: Record<string, Align> = { lt: 'left', ct: 'center', rt: 'right', left: 'left', center: 'center', right: 'right' };

/**
 * Records print operations and sends them as one buffer. Method names match the `escpos`
 * package so a host can swap the device without rewriting its receipt code.
 */
export class Printer {
  private ops: Op[] = [];
  private font: Font = 'a';
  private opened = false;

  constructor(
    public readonly transport: Transport,
    public readonly profile: Profile,
    private readonly options: PrinterOptions = {},
  ) {}

  async open(): Promise<this> {
    await this.transport.open();
    this.opened = true;
    if (this.options.initOnOpen !== false) this.ops.unshift({ kind: 'init' });
    return this;
  }

  /** Encodes and sends everything recorded so far, keeping the connection open. */
  async flush(): Promise<this> {
    if (!this.opened) throw new Error('thermal-print: call open() before flush()');
    const ops = this.ops;
    this.ops = [];
    if (ops.length) await this.transport.write(encode(ops, this.profile));
    return this;
  }

  /** Flushes, then closes the transport. */
  async close(): Promise<void> {
    try {
      await this.flush();
    } finally {
      this.opened = false;
      await this.transport.close();
    }
  }

  /** The bytes that would be sent for the recorded ops; useful for tests and previews. */
  toBuffer(): Buffer {
    return encode(this.ops, this.profile);
  }

  get columns(): number {
    return this.profile.columns[this.font];
  }

  push(op: Op): this {
    this.ops.push(op);
    return this;
  }

  raw(bytes: Buffer | Uint8Array | number[]): this {
    return this.push({ kind: 'raw', bytes: Buffer.from(bytes as Uint8Array) });
  }

  text(content: string): this {
    return this.push({ kind: 'text', text: `${content}\n` });
  }

  /** Text without a trailing line break. */
  print(content: string): this {
    return this.push({ kind: 'text', text: content });
  }

  newLine(count = 1): this {
    return this.push({ kind: 'newline', count });
  }

  feed(lines = 1): this {
    return this.push({ kind: 'feed', lines });
  }

  align(align: EscposAlign): this {
    const a = ALIGN[align];
    if (!a) throw new Error(`thermal-print: unknown align "${align}"`);
    return this.push({ kind: 'align', align: a });
  }

  setFont(font: Font): this {
    this.font = font;
    return this.push({ kind: 'font', font });
  }

  size(width: number, height: number): this {
    return this.push({ kind: 'size', width, height });
  }

  style(style: EscposStyle | StyleFlags): this {
    const flags = typeof style === 'string' ? parseStyle(style) : style;
    return this.push({ kind: 'style', style: flags });
  }

  lineSpace(dots: number | null = null): this {
    return this.push({ kind: 'lineSpacing', dots });
  }

  cut(partial = false, feed = 3): this {
    return this.push({ kind: 'cut', partial, feed });
  }

  cashdraw(pin: 2 | 5 = 2): this {
    return this.push({ kind: 'drawer', pin });
  }

  beep(times = 1, duration = 1): this {
    return this.push({ kind: 'beep', times, duration });
  }

  barcode(data: string, type: BarcodeType = 'CODE128', options: BarcodeOptions = {}): this {
    return this.push({ kind: 'barcode', data, type, options });
  }

  qr(data: string, options: QrOptions = {}): this {
    return this.push({ kind: 'qr', data, options });
  }

  /** `escpos` name for a QR code; prints a native QR when the profile has one. */
  qrimage(data: string, options: QrOptions = {}): this {
    return this.qr(data, options);
  }

  drawLine(char = '-'): this {
    return this.text(char.repeat(this.columns));
  }

  tableCustom(cells: TableCell[], options: TableOptions = {}): this {
    const total = options.width ?? this.columns;
    const widths = cellWidths(cells, total);
    const wrap = options.wrap !== false;
    const lines = cells.map((c, i) => (wrap ? wrapText(c.text ?? '', widths[i]) : [String(c.text ?? '').slice(0, widths[i])]));
    const rows = Math.max(1, ...lines.map((l) => l.length));
    for (let r = 0; r < rows; r++) {
      let line = '';
      cells.forEach((c, i) => {
        line += pad(lines[i][r] ?? '', widths[i], c.align ?? 'LEFT');
      });
      this.text(line.replace(/\s+$/, ''));
    }
    return this;
  }
}

/** `escpos` style letters: b bold, i italic, u underline, u2 double underline. */
export function parseStyle(style: EscposStyle): StyleFlags {
  if (style === 'normal') return { bold: false, underline: 0, italic: false, invert: false };
  const s = style.toLowerCase();
  return {
    bold: s.includes('b'),
    italic: s.includes('i'),
    underline: s.includes('u2') ? 2 : s.includes('u') ? 1 : 0,
    invert: false,
  };
}

function cellWidths(cells: TableCell[], total: number): number[] {
  const fixed = cells.map((c) => (c.width === undefined ? null : c.width > 1 ? Math.floor(c.width) : Math.floor(c.width * total)));
  const used = fixed.reduce<number>((n, w) => n + (w ?? 0), 0);
  const free = fixed.filter((w) => w === null).length;
  const each = free ? Math.floor(Math.max(0, total - used) / free) : 0;
  const widths = fixed.map((w) => (w === null ? each : w));
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum < total) widths[widths.length - 1] += total - sum;
  return widths;
}

function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [''];
  const out: string[] = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      if (word.length > width) {
        if (line) out.push(line);
        line = '';
        for (let i = 0; i < word.length; i += width) out.push(word.slice(i, i + width));
        continue;
      }
      const next = line ? `${line} ${word}` : word;
      if (next.length > width) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out.length ? out : [''];
}

function pad(text: string, width: number, align: 'LEFT' | 'CENTER' | 'RIGHT'): string {
  const t = text.slice(0, width);
  const gap = width - t.length;
  if (align === 'RIGHT') return ' '.repeat(gap) + t;
  if (align === 'CENTER') {
    const left = Math.floor(gap / 2);
    return ' '.repeat(left) + t + ' '.repeat(gap - left);
  }
  return t + ' '.repeat(gap);
}
