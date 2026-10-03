const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { ditherRgba, fromRgba, serializeBitmap, deserializeBitmap, emptyBitmap, setPixel, getPixel, render, epsonTmT88, encode, loadImage, bitmapToPng, discoverNetworkPrinters, fromBase64, toBase64 } = require('../dist');

test('dithering turns mid grey into a roughly half-black pattern; threshold does not', () => {
  const w = 32, h = 32;
  const grey = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) grey.set([135, 135, 135, 255], i * 4);
  const count = (b) => { let n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (getPixel(b, x, y)) n++; return n; };
  const d = count(ditherRgba(grey, w, h));
  assert.ok(d > w * h * 0.4 && d < w * h * 0.6, `dither black=${d}`);
  assert.equal(count(fromRgba(grey, w, h)), 0);
});

test('bitmap serialises to JSON and back; base64 round trip', () => {
  const b = emptyBitmap(10, 3);
  setPixel(b, 9, 2, true);
  const s = serializeBitmap(b);
  assert.deepEqual(Object.keys(s), ['width', 'height', 'data']);
  const back = deserializeBitmap(JSON.parse(JSON.stringify(s)));
  assert.ok(getPixel(back, 9, 2));
  assert.throws(() => deserializeBitmap({ width: 10, height: 4, data: s.data }), /expected 8/);
  assert.deepEqual(Array.from(fromBase64(toBase64(new Uint8Array([1, 2, 3, 250, 0])))), [1, 2, 3, 250, 0]);
});

test('template image block becomes a centred raster op', () => {
  const b = emptyBitmap(16, 2);
  setPixel(b, 0, 0, true);
  const ops = render({ name: 'r', version: 1, blocks: [{ type: 'image', align: 'center', ...serializeBitmap(b) }] }, {}, epsonTmT88);
  assert.deepEqual(ops.map((o) => o.kind), ['align', 'raster', 'align']);
  assert.equal(Buffer.from(encode(ops, epsonTmT88)).toString('hex'), '1b6101' + '1d7630000200' + '0200' + '80000000' + '1b6100');
});

test('loadImage scales a PNG to the requested width', async () => {
  const src = emptyBitmap(40, 20);
  for (let x = 0; x < 20; x++) for (let y = 0; y < 20; y++) setPixel(src, x, y, true);
  const bm = await loadImage(Buffer.from(bitmapToPng(src)), { width: 80 });
  assert.equal(bm.width, 80);
  assert.equal(bm.height, 40);
  assert.ok(getPixel(bm, 10, 10));
  assert.equal(getPixel(bm, 70, 10), false);
});

test('discover finds a raw-printing host and identifies it', async () => {
  const server = net.createServer((sock) => sock.on('data', (d) => {
    if (d[0] === 0x1d && d[1] === 0x49) sock.write(Buffer.concat([Buffer.from([0x5f]), Buffer.from(d[2] === 66 ? 'EPSON' : d[2] === 67 ? 'TM-T20III' : 'x'), Buffer.from([0])]));
  }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const found = await discoverNetworkPrinters({ subnets: ['127.0.0'], port: server.address().port, timeout: 300, identify: true });
    const me = found.find((p) => p.host === '127.0.0.1');
    assert.ok(me, 'localhost not found');
    assert.equal(me.identity.model, 'TM-T20III');
    assert.equal(me.identity.profile.id, 'epson-tm-t20');
  } finally {
    server.close();
  }
});
