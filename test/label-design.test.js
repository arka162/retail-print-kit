const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const ld = require('../dist/label-design');

const parity = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'label-design-parity.json'), 'utf8'));
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const fakeRaster = (el) => ({ width: 16 + (String(el.id).length % 3) * 8, height: 2, bits: Uint8Array.from([0xff, 0x00, 0x81, 0x7e, 0x3c, 0xc3].slice(0, (2 + (String(el.id).length % 3)) * 2)) });

test('built-in layouts print the same bytes as the register encoder', () => {
  const misses = [];
  for (const c of parity.builtinCases) {
    const t = ld.BUILTIN_TEMPLATES.find((x) => x.id === c.template);
    const data = ld.labelDataFromItem(parity.items[c.item], { priceType: c.priceType, limits: t.printers[c.language].limits });
    if (sha(ld.encodeBuiltinLabel(t, c.language, data)) !== c.sha) misses.push(`${c.template}:${c.language} item ${c.item} ${c.priceType}`);
  }
  assert.equal(parity.builtinCases.length, 512);
  assert.deepEqual(misses, []);
});

test('designs encode the same bytes as the register encoder, with and without a printer offset', () => {
  const misses = [];
  for (const c of parity.designCases) {
    const design = parity.designs[c.design];
    const data = ld.templateData(parity.items[c.item], design, 'Harness Store');
    const bytes = ld.encodeDesignLabel(design, c.language, data, fakeRaster, parity.offsets[c.offset]);
    if (sha(bytes) !== c.sha) misses.push(`${c.design}:${c.language} item ${c.item} offset ${c.offset}`);
  }
  assert.equal(parity.designCases.length, 1296);
  assert.deepEqual(misses.slice(0, 10), []);
});

test('designs copied from every built-in print the same bytes as the built-in itself', () => {
  for (const t of ld.BUILTIN_TEMPLATES) {
    for (const language of ['ezpl', 'zpl']) {
      const variant = t.printers[language];
      if (!variant) continue;
      const design = ld.designFromBuiltin(t, language);
      for (const item of parity.items) {
        const builtin = ld.encodeBuiltinLabel(t, language, ld.labelDataFromItem(item, { priceType: 'single', limits: variant.limits }));
        const copied = Buffer.from(ld.encodeDesignLabel(design, language, ld.templateData(item, design), () => null)).toString('utf8');
        assert.equal(copied, builtin, `${t.id}:${language}`);
      }
    }
  }
});

test('finding a built-in follows the same size and layout fallbacks', () => {
  assert.equal(ld.findBuiltinTemplate('2 X 1', 'single', 'ezpl').id, 'builtin-2x1-single');
  assert.equal(ld.findBuiltinTemplate('1 x 1.25', 'single', 'ezpl').id, 'builtin-1.25x1-single');
  assert.equal(ld.findBuiltinTemplate('9 X 9', 'dual', 'ezpl').id, 'builtin-2x1-dual');
  assert.equal(ld.findBuiltinTemplate('3.5 X 1.25', 'single', 'zpl').id, 'builtin-2x1-single');
  assert.equal(ld.findBuiltinTemplate('1.25 X 1', 'dual', 'ezpl').id, 'builtin-1.25x1-dual');
  assert.equal(ld.findBuiltinTemplate('3.5 X 1.25', 'dual', 'ezpl').id, 'builtin-3.5x1.25-single');
  assert.equal(ld.languageForPrinter('Zebra'), 'zpl');
  assert.equal(ld.languageForPrinter('Godex'), 'ezpl');
  assert.equal(ld.languageForPrinter(null), 'ezpl');
});

test('the designer gap reaches the Godex header and nothing prints at a negative position', () => {
  const base = { version: 1, kind: 'label', widthMm: 50.8, heightMm: 25.4, dpi: 203, printer: 'ezpl', elements: [{ id: 'b', type: 'box', x: -2, y: 1, w: 10, h: 5 }] };
  const text = (d, off) => Buffer.from(ld.encodeDesignLabel(d, d.printer, {}, () => null, off)).toString('latin1');
  assert.ok(text({ ...base, gapMm: 2 }).startsWith('^XSETCUT,DOUBLECUT,0\r\n^Q25.40,2\r\n'));
  assert.ok(text({ ...base, gapMm: 0 }).startsWith('^XSETCUT,DOUBLECUT,0\r\n^Q25.40,0\r\n'));
  assert.ok(text(base).includes('^Q25.40,3'));
  assert.ok(text(base, { x: -50, y: -50 }).includes('\r\nR0,0,'));
  assert.ok(text({ ...base, printer: 'zpl' }, { x: -50, y: -50 }).includes('^FO0,0^GB'));
});

test('validation follows the server rules', () => {
  const good = { version: 1, kind: 'label', widthMm: 50.8, heightMm: 25.4, dpi: 203, printer: 'ezpl', gapMm: 3, elements: [{ id: 'a', type: 'text', x: 2, y: 1.5, w: 46, h: 4, value: '{{itemName}}' }] };
  assert.equal(ld.validateDesign(good), null);
  assert.equal(ld.validateDesign({ ...good, printer: null, gapMm: 0, elements: [] }), null);
  const bad = [
    null, [], { ...good, version: 2 }, { ...good, kind: 'receipt' }, { ...good, widthMm: 2 }, { ...good, heightMm: 301 }, { ...good, widthMm: '50' },
    { ...good, dpi: 150 }, { ...good, printer: 'tspl' }, { ...good, gapMm: -1 }, { ...good, elements: 'x' },
    { ...good, elements: [{ type: 'circle', x: 0, y: 0, w: 1, h: 1 }] }, { ...good, elements: [{ type: 'text', x: 0, y: 0, w: 1 }] },
    { ...good, elements: [{ type: 'text', x: true, y: 0, w: 1, h: 1 }] }, { ...good, elements: [{ type: 'box', x: 0, y: 0, w: -1, h: 1 }] },
    { ...good, elements: [{ type: 'text', x: 0, y: 0, w: 1, h: 1, value: 5 }] }, { ...good, elements: [{ type: 'text', x: 60, y: 0, w: 1, h: 1 }] },
    { ...good, elements: [{ type: 'image', x: 0, y: 0, w: 100000, h: 1 }] },
    { ...good, elements: [{ type: 'image', x: 0, y: 0, w: 10, h: 10, image: { w: 17, h: 2, bits: 'AAAAAA==' } }] },
    { ...good, elements: [{ type: 'image', x: 0, y: 0, w: 10, h: 10, image: { w: 16, h: 2, bits: '***' } }] },
    { ...good, elements: Array.from({ length: 301 }, () => ({ type: 'line', x: 0, y: 0, w: 1, h: 0.2 })) },
    { ...good, note: 'x'.repeat(256 * 1024) }
  ];
  for (const design of bad) assert.notEqual(ld.validateDesign(design), null, JSON.stringify(design).slice(0, 80));
  assert.equal(ld.validateDesign({ ...good, elements: [{ type: 'image', x: 0, y: 0, w: 10, h: 10, image: { w: 16, h: 2, bits: 'AAAAAA==' } }] }), null);
});

test('label fields from an item', () => {
  const d = ld.labelDataFromItem({ posdecs: 'Tito\'s', price: '19.5', surcharge_amount: 20.1, brand: '', upc: ['12345'], re_order: 0, department: 'LIQUOR' }, { date: new Date(2026, 9, 16), storeName: 'Main' });
  assert.equal(d.itemName, 'Tito\'s');
  assert.equal(d.price, '$19.50');
  assert.equal(d.creditPrice, '$20.10');
  assert.equal(d.brand, '--');
  assert.equal(d.barcode, '000000012345');
  assert.equal(d.reorderId, '--');
  assert.equal(d.department, 'LIQUOR');
  assert.equal(d.printDate, '10/16/2026');
  assert.equal(ld.labelDataFromItem({ price: '5', surcharge_amount: 6 }, { priceType: 'credit' }).price, '$6.00');
  assert.deepEqual(ld.fieldsUsed({ elements: [{ value: '{{a}} {{b}}', when: 'c' }, { value: '{{a}}' }] }).sort(), ['a', 'b', 'c']);
});

test('barcode checks catch what the printer would reject', () => {
  assert.equal(ld.barcodeProblem('UPC_A', '036000291452'), null);
  assert.equal(ld.barcodeProblem('UPC_A', '03600029145'), null);
  assert.notEqual(ld.barcodeProblem('UPC_A', '036000291453'), null);
  assert.notEqual(ld.barcodeProblem('UPC_A', '12AB'), null);
  assert.equal(ld.barcodeProblem('EAN13', '4006381333931'), null);
  assert.notEqual(ld.barcodeProblem('EAN13', '4006381333932'), null);
  assert.equal(ld.barcodeProblem('CODE128', 'R-100482'), null);
  assert.notEqual(ld.barcodeProblem('CODE128', 'Café'), null);
});

test('images', () => {
  assert.equal(ld.decodeImageBits({ w: 16, h: 2, bits: 'AAAAAA==' }).length, 4);
  assert.equal(ld.decodeImageBits({ w: 17, h: 2, bits: 'AAAAAA==' }), null);
  assert.equal(ld.decodeImageBits({ w: 16, h: 2, bits: '%%%%' }), null);
  const rgba = new Uint8Array(4 * 4 * 1);
  rgba.set([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 10, 10, 10, 255]);
  assert.deepEqual(ld.imageFromRgba(rgba, 4, 1, 'threshold'), { w: 4, h: 1, bits: Buffer.from([0x90]).toString('base64') });
});

test('the core loads and encodes without a DOM', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(ld.domCanvasFactory(), undefined);
  assert.throws(() => ld.createRasterizer(), /canvasFactory/);
  return ld.ensureLabelFonts().then((v) => assert.equal(v, undefined));
});

test('the root entry does not carry the label designer', () => {
  const root = require('../dist');
  assert.equal(root.encodeDesignLabel, undefined);
  assert.equal(root.BUILTIN_TEMPLATES, undefined);
});

test('the designer entry can be required outside a browser', () => {
  const designer = require('../dist/label-designer');
  assert.equal(typeof designer.defineLabelDesigner, 'function');
  assert.equal(typeof designer.defineLabelPreview, 'function');
  designer.defineLabelDesigner();
});
