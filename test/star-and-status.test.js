const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const {
  Printer, encode, starTsp650, starTsp100, epsonTmT88, genericEscPos,
  qrBitmap, emptyBitmap, setPixel, getPixel, parseEscPosStatus, CanvasRasterizer,
} = require('../dist');
const { NetTransport } = require('../dist/transports/net');

class MemoryTransport {
  constructor() { this.name = 'memory'; this.chunks = []; }
  async open() {}
  async write(b) { this.chunks.push(Buffer.from(b)); }
  async close() {}
}
const hex = (b) => Buffer.from(b).toString('hex');
const noInit = { initOnOpen: false };

test('Star Line: init, align, bold, size, cut and drawer', () => {
  const p = new Printer(new MemoryTransport(), starTsp650, noInit);
  p.push({ kind: 'init' }).align('ct').style('b').size(2, 1).text('HI').cut().cashdraw();
  assert.equal(
    hex(p.toBuffer()),
    '1b40' + '1b1d7401' + '1b1d6101' + '1b451b2d001b35' + '1b690001' + '48490a' + '1b61031b6402' + '1b07141407',
  );
});

test('Star Line: native QR and CODE128 barcode', () => {
  const p = new Printer(new MemoryTransport(), starTsp650, noInit).qr('abc', { size: 4, correction: 'H' }).barcode('123', 'CODE128', { height: 50, width: 2 });
  assert.equal(
    hex(p.toBuffer()),
    '1b1d79533002' + '1b1d79533103' + '1b1d79533204' + '1b1d794431000300' + '616263' + '1b1d7950' +
    '1b62060402' + '32' + '313233' + '1e',
  );
});

test('Star Line raster header carries bytes-per-row and rows', () => {
  const bm = emptyBitmap(16, 2);
  setPixel(bm, 0, 0, true);
  const p = new Printer(new MemoryTransport(), starTsp650, noInit).image(bm);
  assert.equal(hex(p.toBuffer()), '1b1d530102000200' + '00' + '80000000');
});

test('QR fallback becomes a raster op on profiles without native QR', () => {
  const noQr = { ...genericEscPos, id: 'x', features: { ...genericEscPos.features, nativeQr: false } };
  const p = new Printer(new MemoryTransport(), noQr, noInit).qrimage('hello', { size: 1 });
  const h = hex(p.toBuffer());
  assert.ok(h.startsWith('1d7630'));
  const bm = qrBitmap('hello', { size: 1 });
  assert.equal(bm.width, 21);
  assert.ok(getPixel(bm, 0, 0));
});

test('Star graphic: fake rasterizer gives deterministic bytes; drawer after raster exit', () => {
  const fake = { render: () => { const b = emptyBitmap(8, 2); setPixel(b, 7, 1, true); return b; } };
  const p = new Printer(new MemoryTransport(), starTsp100, { ...noInit, rasterizer: fake });
  p.text('x').cut(true).cashdraw();
  assert.equal(
    hex(p.toBuffer()),
    '1b2a7252' + '1b2a7241' + '1b2a72503000' + '1b2a72453200' + '62010000' + '62010001' + '1b0c00' + '1b2a7242' + '1b07141407',
  );
});

test('Star graphic: canvas rasterizer paints text into the page', () => {
  const r = new CanvasRasterizer();
  const bm = r.render([{ kind: 'align', align: 'center' }, { kind: 'text', text: 'HELLO WORLD\n' }], starTsp100);
  assert.equal(bm.width, 576);
  assert.equal(bm.height, 24);
  let black = 0;
  for (let y = 0; y < bm.height; y++) for (let x = 0; x < bm.width; x++) if (getPixel(bm, x, y)) black++;
  assert.ok(black > 100 && black < 576 * 24 / 2, `black=${black}`);
  let leftBlack = 0;
  for (let y = 0; y < bm.height; y++) for (let x = 0; x < 100; x++) if (getPixel(bm, x, y)) leftBlack++;
  assert.equal(leftBlack, 0);
});

test('Star graphic: wraps at columns and honours size', () => {
  const r = new CanvasRasterizer();
  const bm = r.render([{ kind: 'size', width: 2, height: 2 }, { kind: 'text', text: 'A'.repeat(30) + '\n' }], starTsp100);
  assert.equal(bm.height, 24 * 2 * 2);
});

test('status parser reads the DLE EOT bytes', () => {
  const s = parseEscPosStatus([0x16, 0x12, 0x12, 0x72]);
  assert.equal(s.online, true);
  assert.equal(s.drawerPinHigh, true);
  assert.equal(s.coverOpen, false);
  assert.equal(s.paperOut, true);
  assert.equal(s.paperNearEnd, false);
  const t = parseEscPosStatus([0x1e, 0x16, 0x1a, 0x1e]);
  assert.equal(t.online, false);
  assert.equal(t.coverOpen, true);
  assert.equal(t.cutterError, true);
  assert.equal(t.paperNearEnd, true);
});

test('status over TCP: four queries, four replies', async () => {
  const received = [];
  const server = net.createServer((sock) => {
    sock.on('data', (d) => {
      received.push(d);
      for (let i = 0; i + 2 < d.length + 1; i += 3) if (d[i] === 0x10 && d[i + 1] === 0x04) sock.write(Buffer.from([0x12]));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const p = new Printer(new NetTransport('127.0.0.1', { port: server.address().port }), epsonTmT88, noInit);
    await p.open();
    const s = await p.status();
    assert.equal(s.supported, true);
    assert.equal(s.online, true);
    assert.deepEqual(s.raw, [0x12, 0x12, 0x12, 0x12]);
    await p.close();
    assert.equal(hex(Buffer.concat(received)), '100401' + '100402' + '100403' + '100404');
  } finally {
    server.close();
  }
});

test('status on bitmap-only Star profiles reports unsupported', async () => {
  const p = new Printer(new MemoryTransport(), starTsp100, noInit);
  assert.equal((await p.status()).supported, false);
});
