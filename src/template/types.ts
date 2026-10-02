import { BarcodeType } from '../core/ops';
import { EscposStyle } from '../core/printer';

export type TAlign = 'left' | 'center' | 'right';
export type TCellAlign = 'LEFT' | 'CENTER' | 'RIGHT';

/** A column of a `table` block. `value` is a template string evaluated per row. */
export interface TableColumn {
  value: string;
  header?: string;
  width?: number;
  align?: TCellAlign;
}

export type Block =
  | { type: 'text'; value: string; align?: TAlign; size?: [number, number]; style?: EscposStyle; font?: 'a' | 'b' }
  | { type: 'line'; char?: string }
  | { type: 'row'; cells: Array<{ value: string; width?: number; align?: TCellAlign }> }
  | { type: 'table'; rows: string; columns: TableColumn[]; header?: boolean }
  | { type: 'feed'; lines?: number }
  | { type: 'newline'; count?: number }
  | { type: 'cut'; partial?: boolean; feed?: number }
  | { type: 'drawer'; pin?: 2 | 5 }
  | { type: 'qr'; value: string; size?: number; align?: TAlign }
  | { type: 'barcode'; value: string; format?: BarcodeType; height?: number; width?: number; align?: TAlign; text?: boolean }
  | { type: 'each'; items: string; blocks: Block[] }
  | { type: 'if'; when: string; blocks: Block[]; else?: Block[] };

export interface Template {
  name: string;
  version: 1;
  blocks: Block[];
}
