const test = require('node:test');
const assert = require('node:assert/strict');
const { render, interpolate, epsonTmT88, genericEscPos58, Printer, barcodeBitmap, code128, ean13, upcA, getPixel, CanvasRasterizer, starTsp100 } = require('../dist');

const receipt = {
  name: 'receipt',
  version: 1,
  blocks: [
    { type: 'text', value: '{{store.name | upper}}', align: 'center', style: 'b', size: [2, 2] },
    { type: 'text', value: '{{store.address}}', align: 'center' },
    { type: 'line' },
    { type: 'table', rows: 'items', columns: [
      { value: '{{@number}}. {{name}}', header: 'Item', width: 0.6 },
      { value: '{{qty}}', header: 'Qty', width: 0.1, align: 'CENTER' },
      { value: '{{total | money:$}}', header: 'Amount', width: 0.3, align: 'RIGHT' },
    ] },
    { type: 'line' },
    { type: 'row', cells: [{ value: 'TOTAL', width: 0.7 }, { value: '{{total | money:$}}', width: 0.3, align: 'RIGHT' }] },
    { type: 'if', when: 'customer', blocks: [{ type: 'text', value: 'Thanks {{customer.name}}' }], else: [{ type: 'text', value: 'Thanks!' }] },
    { type: 'each', items: 'notes', blocks: [{ type: 'text', value: '* {{this}}' }] },
    { type: 'qr', value: 'https://x.io/r/{{id}}', align: 'center', size: 4 },
    { type: 'cut' },
    { type: 'drawer' },
  ],
};
const data = {
  id: 'A1', store: { name: 'My Store', address: '1 Main St' }, total: 12.5,
  items: [{ name: 'Coffee', qty: 2, total: 5 }, { name: 'Bagel', qty: 1, total: 7.5 }],
  notes: ['no refunds'],
};

const textOf = (ops) => ops.filter((o) => o.kind === 'text').map((o) => o.text).join('');

test('interpolate: paths, filters and missing values', () => {
  const scope = { root: { a: { b: 'x' }, n: -3.14159, list: [1, 2] }, current: { c: 'y' }, index: 4 };
  assert.equal(interpolate('{{a.b}}{{c}}{{zzz}}|{{@number}}', scope), 'xy|5');
  assert.equal(interpolate('{{n | money:$}} {{n | fixed:1}} {{list | count}} {{zzz | default:none}}', scope), '-$3.14 -3.1 2 none');
  assert.throws(() => interpolate('{{a | nope}}', scope), /unknown template filter/);
});

test('render: a full receipt template produces the expected lines and ops', () => {
  const ops = render(receipt, data, epsonTmT88);
  const lines = textOf(ops).split('\n');
  assert.equal(lines[0], 'MY STORE');
  assert.equal(lines[1], '1 Main St');
  assert.equal(lines[2], '-'.repeat(48));
  assert.equal(lines[3].replace(/\s+/g, ' '), 'Item Qty Amount');
  assert.equal(lines[4].replace(/\s+/g, ' '), '1. Coffee 2 $5.00');
  assert.equal(lines[5].replace(/\s+/g, ' '), '2. Bagel 1 $7.50');
  assert.equal(lines[7].replace(/\s+/g, ' '), 'TOTAL $12.50');
  assert.equal(lines[8], 'Thanks!');
  assert.equal(lines[9], '* no refunds');
  assert.ok(ops.some((o) => o.kind === 'qr' && o.data === 'https://x.io/r/A1'));
  assert.ok(ops.some((o) => o.kind === 'cut'));
  assert.ok(ops.some((o) => o.kind === 'drawer'));
  const withCustomer = render(receipt, { ...data, customer: { name: 'Ana' } }, epsonTmT88);
  assert.ok(textOf(withCustomer).includes('Thanks Ana'));
});

test('render follows the profile columns and Printer.render appends', () => {
  const ops = render(receipt, data, genericEscPos58);
  assert.equal(textOf(ops).split('\n')[2], '-'.repeat(32));
  const t = { name: 'mem', open: async () => {}, write: async () => {}, close: async () => {} };
  const p = new Printer(t, epsonTmT88, { initOnOpen: false }).text('pre').render(receipt, data);
  assert.ok(p.operations.length > 10);
  assert.equal(p.operations[0].text, 'pre\n');
});

test('CODE128 switches to subset C for digit runs and checks out', () => {
  const p = code128('AB1234');
  assert.equal(p.reduce((a, b) => a + b, 0), 11 * 7 + 13);
  assert.equal(code128('1234').reduce((a, b) => a + b, 0), 11 * 4 + 13);
  assert.throws(() => code128('é'), /printable ASCII/);
});

test('EAN13 / UPC-A compute the check digit and are 95 modules wide', () => {
  const e = ean13('590123412345');
  assert.equal(e.reduce((a, b) => a + b, 0), 95);
  assert.deepEqual(ean13('5901234123457'), e);
  assert.throws(() => ean13('59012341234'), /12 or 13/);
  const u = upcA('03600029145');
  assert.equal(u.reduce((a, b) => a + b, 0), 95);
  assert.deepEqual(upcA('036000291452'), u);
});

test('barcode bitmap has quiet zones and bars of the module width', () => {
  const b = barcodeBitmap('EAN13', '5901234123457', 2, 10);
  assert.equal(b.width, 95 * 2 + 40);
  assert.equal(b.height, 10);
  assert.equal(getPixel(b, 0, 0), false);
  assert.equal(getPixel(b, 19, 0), false);
  assert.equal(getPixel(b, 20, 0), true);
  assert.equal(getPixel(b, 21, 0), true);
  assert.equal(getPixel(b, 22, 0), false);
});

test('rasterizer prints 1D barcodes with the human readable line below', () => {
  const r = new CanvasRasterizer();
  const bm = r.render([{ kind: 'barcode', data: '12345678', type: 'CODE128', options: { height: 30 } }], starTsp100);
  assert.equal(bm.height, 30 + 24);
});
