import { Op } from '../core/ops';
import { OpBuilder, TableCell } from '../core/builder';
import { Profile } from '../profiles/types';
import { Block, Template } from './types';
import { Scope, evaluate, interpolate, truthy } from './expr';

const ALIGN = { left: 'lt', center: 'ct', right: 'rt' } as const;

/** Renders a template with data into ops for the given profile. */
export function render(template: Template, data: unknown, profile: Profile): Op[] {
  if (template.version !== 1) throw new Error(`retail-print-kit: unsupported template version ${String(template.version)}`);
  const b = new OpBuilder(profile);
  renderBlocks(template.blocks, { root: data, current: data }, b);
  return b.operations;
}

export function renderBlocks(blocks: Block[], scope: Scope, b: OpBuilder): void {
  for (const block of blocks) renderBlock(block, scope, b);
}

function renderBlock(block: Block, scope: Scope, b: OpBuilder): void {
  switch (block.type) {
    case 'text': {
      if (block.align) b.align(ALIGN[block.align]);
      if (block.font) b.setFont(block.font);
      if (block.size) b.size(block.size[0], block.size[1]);
      if (block.style) b.style(block.style);
      b.text(interpolate(block.value, scope));
      if (block.style) b.style('normal');
      if (block.size) b.size(1, 1);
      if (block.font) b.setFont('a');
      if (block.align && block.align !== 'left') b.align('lt');
      break;
    }
    case 'line':
      b.drawLine(block.char ?? '-');
      break;
    case 'row':
      b.tableCustom(block.cells.map((c) => ({ text: interpolate(c.value, scope), width: c.width, align: c.align ?? 'LEFT' })));
      break;
    case 'table': {
      const rows = evaluate(block.rows, scope);
      if (block.header !== false && block.columns.some((c) => c.header)) {
        b.tableCustom(block.columns.map((c) => ({ text: c.header ?? '', width: c.width, align: c.align ?? 'LEFT' })));
      }
      if (!Array.isArray(rows)) break;
      rows.forEach((row, index) => {
        const rowScope: Scope = { root: scope.root, current: row, index };
        const cells: TableCell[] = block.columns.map((c) => ({ text: interpolate(c.value, rowScope), width: c.width, align: c.align ?? 'LEFT' }));
        b.tableCustom(cells);
      });
      break;
    }
    case 'feed':
      b.feed(block.lines ?? 1);
      break;
    case 'newline':
      b.newLine(block.count ?? 1);
      break;
    case 'cut':
      b.cut(block.partial ?? false, block.feed ?? 3);
      break;
    case 'drawer':
      b.cashdraw(block.pin ?? 2);
      break;
    case 'qr': {
      if (block.align) b.align(ALIGN[block.align]);
      b.qr(interpolate(block.value, scope), { size: block.size });
      if (block.align && block.align !== 'left') b.align('lt');
      break;
    }
    case 'barcode': {
      if (block.align) b.align(ALIGN[block.align]);
      b.barcode(interpolate(block.value, scope), block.format ?? 'CODE128', {
        height: block.height,
        width: block.width,
        position: block.text === false ? 'none' : 'below',
      });
      if (block.align && block.align !== 'left') b.align('lt');
      break;
    }
    case 'each': {
      const items = evaluate(block.items, scope);
      if (!Array.isArray(items)) break;
      items.forEach((item, index) => renderBlocks(block.blocks, { root: scope.root, current: item, index }, b));
      break;
    }
    case 'if':
      if (truthy(block.when, scope)) renderBlocks(block.blocks, scope, b);
      else if (block.else) renderBlocks(block.else, scope, b);
      break;
    default:
      throw new Error(`retail-print-kit: unknown template block "${(block as { type: string }).type}"`);
  }
}
