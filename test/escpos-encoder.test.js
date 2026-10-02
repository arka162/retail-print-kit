const test = require('node:test');
const assert = require('node:assert/strict');
const { Printer, encode, epsonTmT88, genericEscPos, genericEscPos58 } = require('../dist');

class MemoryTransport {
  constructor() { this.name = 'memory'; this.chunks = []; this.opened = false; this.closed = false; }
  async open() { this.opened = true; }
  async write(b) { this.chunks.push(Buffer.from(b)); }
  async close() { this.closed = true; }
  get bytes() { return Buffer.concat(this.chunks); }
}

const hex = (b) => Buffer.from(b).toString('hex');

test('init selects code page on open', async () => {
  const t = new MemoryTransport();
  const p = new Printer(t, epsonTmT88);
  await p.open();
  await p.close();
  assert.equal(hex(t.bytes), '1b401b7400');
  assert.ok(t.closed);
});

test('text, align, style, size, font map to ESC/POS', () => {
  const p = new Printer(new MemoryTransport(), epsonTmT88, { initOnOpen: false });
  p.align('ct').style('b').size(2, 2).text('HI').style('normal').size(1, 1).align('lt').setFont('b');
  assert.equal(
    hex(p.toBuffer()),
    '1b6101' + '1b45011b2d001d4200' + '1d2111' + '48490a' + '1b45001b2d001d4200' + '1d2100' + '1b6100' + '1b4d01',
  );
});

test('cut: feed-and-cut on Epson, legacy on clones', () => {
  const a = new Printer(new MemoryTransport(), epsonTmT88, { initOnOpen: false }).cut();
  assert.equal(hex(a.toBuffer()), '1d564103');
  const b = new Printer(new MemoryTransport(), genericEscPos, { initOnOpen: false }).cut(true, 2);
  assert.equal(hex(b.toBuffer()), '1b64021d5601');
});

test('drawer pulse comes from the profile', () => {
  const a = new Printer(new MemoryTransport(), epsonTmT88, { initOnOpen: false }).cashdraw();
  assert.equal(hex(a.toBuffer()), '1b700019fa');
  const b = new Printer(new MemoryTransport(), genericEscPos, { initOnOpen: false }).cashdraw(5);
  assert.equal(hex(b.toBuffer()), '1b70013c78');
});

test('CODE128 barcode gets the {B prefix and length', () => {
  const p = new Printer(new MemoryTransport(), epsonTmT88, { initOnOpen: false }).barcode('12345', 'CODE128', { height: 60, width: 2 });
  assert.equal(hex(p.toBuffer()), '1d683c' + '1d7702' + '1d4802' + '1d6600' + '1d6b4907' + Buffer.from('{B12345').toString('hex'));
});

test('native QR on Epson, error on a profile without it', () => {
  const p = new Printer(new MemoryTransport(), epsonTmT88, { initOnOpen: false }).qrimage('https://x.io', { size: 4 });
  const h = hex(p.toBuffer());
  assert.ok(h.startsWith('1d286b040031413200' + '1d286b0300314304' + '1d286b0300314531'));
  assert.ok(h.endsWith('1d286b0300315130'));
  const noQr = { ...epsonTmT88, id: 'x', features: { ...epsonTmT88.features, nativeQr: false } };
  assert.throws(() => encode([{ kind: 'qr', data: 'a', options: {} }], noQr), /no native QR/);
});

test('drawLine uses the columns of the current font', () => {
  const p = new Printer(new MemoryTransport(), genericEscPos58, { initOnOpen: false }).drawLine();
  assert.equal(Buffer.from(p.toBuffer()).toString('latin1'), '-'.repeat(32) + '\n');
});

test('tableCustom pads, aligns and wraps', () => {
  const p = new Printer(new MemoryTransport(), epsonTmT88, { initOnOpen: false });
  p.tableCustom([
    { text: 'Coffee large with oat milk and an extra shot', align: 'LEFT', width: 0.5 },
    { text: '2', align: 'CENTER', width: 0.1 },
    { text: '$12.50', align: 'RIGHT', width: 0.4 },
  ]);
  const lines = Buffer.from(p.toBuffer()).toString('latin1').split('\n').filter(Boolean);
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'Coffee large with oat   ' + ' 2  ' + ' '.repeat(14) + '$12.50');
  assert.equal(lines[1], 'milk and an extra shot');
});

test('cp437 encoding for box and currency characters', () => {
  const p = new Printer(new MemoryTransport(), epsonTmT88, { initOnOpen: false }).print('é');
  assert.equal(hex(p.toBuffer()), '82');
});

test('flush sends and clears, close without open fails', async () => {
  const t = new MemoryTransport();
  const p = new Printer(t, epsonTmT88, { initOnOpen: false });
  await assert.rejects(() => p.flush(), /open\(\)/);
  await p.open();
  p.text('a');
  await p.flush();
  assert.equal(hex(t.bytes), '610a');
  await p.flush();
  assert.equal(t.chunks.length, 1);
});
