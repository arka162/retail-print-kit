const test = require('node:test');
const assert = require('node:assert/strict');
const { LabelBuilder, encodeZpl, encodeTspl, encodeEzpl, encodeLabel, labelToSvg, renderLabel, mmToDots, emptyBitmap, setPixel } = require('../dist');

function sample() {
  const b = new LabelBuilder({ widthMm: 50.8, heightMm: 25.4 });
  b.text(18, 14, 'Coffee Beans 1lb', 26).text(92, 65, '$12.99', 85, { bold: true })
    .barcode(35, 140, '036000291452', 'UPC_A', 35).text(260, 170, 'RE-4411', 26)
    .box(2, 2, 400, 199, 2).qr(330, 20, 'https://x.io/i/1', { module: 3 });
  return b.label;
}

test('mm to dots at 203 dpi', () => {
  assert.equal(mmToDots(50.8, 203), 406);
  assert.equal(mmToDots(25.4, 203), 203);
  const l = sample();
  assert.equal(l.width, 406);
  assert.equal(l.height, 203);
});

test('ZPL matches the field shape', () => {
  const z = encodeZpl(sample());
  const lines = z.trim().split('\n');
  assert.equal(lines[0], '^XA');
  assert.ok(lines.includes('^PW406'));
  assert.ok(lines.includes('^LL203'));
  assert.ok(lines.includes('^FO18,14^A0N,26,23^FDCoffee Beans 1lb^FS'));
  assert.ok(lines.includes('^FO35,140^BY2,2,35^BUN,35,Y,N^FD036000291452^FS'));
  assert.ok(lines.includes('^FO2,2^GB400,199,2^FS'));
  assert.ok(lines.includes('^FO330,20^BQN,2,3^FDMA,https://x.io/i/1^FS'));
  assert.equal(lines[lines.length - 2], '^PQ1,0,1,Y');
  assert.equal(lines[lines.length - 1], '^XZ');
  assert.ok(encodeZpl(new LabelBuilder({ widthMm: 10, heightMm: 10 }).text(0, 0, 'a^b~c', 20).label).includes('^FDa\\^b\\~c^FS'));
});

test('EZPL matches the field header and element shapes', () => {
  const e = encodeEzpl(sample());
  const lines = e.trim().split('\n');
  assert.deepEqual(lines.slice(0, 5), ['^Q25.40,3', '^W50.80', '^H10', '^P1', '^S2']);
  assert.equal(lines[13], '^L');
  assert.ok(lines.includes('AD,18,14,1,1,0,0E,Coffee Beans 1lb'));
  assert.ok(lines.includes('AH,92,65,1,1,0,0E,$12.99'));
  assert.ok(lines.includes('BH,35,140,2,4,35,0,1,036000291452'));
  assert.ok(lines.includes('R2,2,402,201,2,2'));
  assert.equal(lines[lines.length - 1], 'E');
});

test('TSPL has size/gap/CLS/PRINT and inverts bitmap bits', () => {
  const t = Buffer.from(encodeTspl(sample())).toString('latin1');
  assert.ok(t.startsWith('SIZE 50.80 mm,25.40 mm\nGAP 3.00 mm,0 mm\nDIRECTION 1,0\nREFERENCE 0,0\nCLS\n'));
  assert.ok(t.includes('TEXT 18,14,"0",0,23,26,"Coffee Beans 1lb"'));
  assert.ok(t.includes('BARCODE 35,140,"UPCA",35,1,0,2,4,"036000291452"'));
  assert.ok(t.includes('QRCODE 330,20,M,3,A,0,"https://x.io/i/1"'));
  assert.ok(t.endsWith('PRINT 1,1\n'));
  const bm = emptyBitmap(8, 1);
  setPixel(bm, 0, 0, true);
  const img = Buffer.from(encodeTspl(new LabelBuilder({ widthMm: 10, heightMm: 10 }).image(5, 6, bm).label));
  const i = img.indexOf('BITMAP 5,6,1,1,0,');
  assert.ok(i > 0);
  assert.equal(img[i + 'BITMAP 5,6,1,1,0,'.length], 0x7f);
  assert.equal(Buffer.from(encodeLabel(sample(), 'zpl')).toString().slice(0, 3), '^XA');
});

test('SVG preview holds every element', () => {
  const svg = labelToSvg(sample());
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 406 203"'));
  assert.equal((svg.match(/<text /g) || []).length, 4);
  assert.equal((svg.match(/<image /g) || []).length, 2);
  assert.ok(svg.includes('<rect x="2" y="2" width="400" height="199" fill="none"'));
});

test('label template renders values, conditions and the label size', () => {
  const tpl = {
    name: 'shelf', version: 1, kind: 'label', widthMm: 50.8, heightMm: 25.4,
    elements: [
      { type: 'text', x: 18, y: 14, value: '{{name | upper}}', height: 26 },
      { type: 'text', x: 92, y: 65, value: '{{price | money:$}}', height: 85, bold: true },
      { type: 'text', x: 18, y: 65, value: 'SALE', height: 20, when: 'sale' },
      { type: 'barcode', x: 35, y: 140, value: '{{upc}}', format: 'UPC_A', height: 35 },
    ],
  };
  const l = renderLabel(tpl, { name: 'Coffee', price: 12.99, upc: '036000291452' });
  assert.equal(l.width, 406);
  assert.equal(l.ops.length, 3);
  assert.equal(l.ops[0].text, 'COFFEE');
  assert.equal(l.ops[1].text, '$12.99');
  assert.equal(renderLabel(tpl, { name: 'x', price: 1, upc: '0', sale: true }).ops.length, 4);
  assert.throws(() => renderLabel({ ...tpl, kind: 'receipt' }, {}), /label template/);
});
