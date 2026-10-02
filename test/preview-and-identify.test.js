const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const zlib = require('node:zlib');
const {
  Printer, OpBuilder, epsonTmT88, starTsp650, bitmapToPng, opsToHtml, opsToPng, emptyBitmap, setPixel,
  parseStarStatus, identify, profileForUsb, profileForModel,
} = require('../dist');
const { NetTransport } = require('../dist/transports/net');

test('PNG encoder writes a valid 1-bit greyscale file', () => {
  const b = emptyBitmap(10, 2);
  setPixel(b, 0, 0, true);
  setPixel(b, 9, 1, true);
  const png = bitmapToPng(b);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 10);
  assert.equal(png.readUInt32BE(20), 2);
  assert.equal(png[24], 1);
  assert.equal(png[25], 0);
  const idatLen = png.readUInt32BE(33);
  assert.equal(png.subarray(37, 41).toString('ascii'), 'IDAT');
  const raw = zlib.inflateSync(png.subarray(41, 41 + idatLen));
  assert.equal(raw.length, 3 * 2);
  assert.equal(raw[1], 0x7f);
  assert.equal(raw[2], 0xc0);
  assert.equal(raw[5], 0x80);
});

test('HTML preview keeps lines, styles and inlines a QR', () => {
  const b = new OpBuilder(epsonTmT88);
  b.align('ct').style('b').size(2, 2).text('STORE').size(1, 1).style('normal').align('lt').text('x'.repeat(60)).qr('abc').cut();
  const html = opsToHtml(b.operations, epsonTmT88);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('text-align:center;transform:scale(2,2)'));
  assert.ok(html.includes('font-weight:bold'));
  assert.ok(html.includes('>STORE<'));
  assert.ok(html.includes('>' + 'x'.repeat(48) + '<'));
  assert.ok(html.includes('>' + 'x'.repeat(12) + '<'));
  assert.ok(html.includes('data:image/png;base64,'));
  assert.ok(html.includes('class="cut"'));
  const bare = opsToHtml(b.operations, epsonTmT88, { document: false });
  assert.ok(bare.startsWith('<div class="paper"'));
  const t = { name: 'mem', open: async () => {}, write: async () => {}, close: async () => {} };
  assert.ok(new Printer(t, epsonTmT88).text('hi').toHtml().includes('>hi<'));
});

test('PNG preview renders through the canvas rasterizer', () => {
  const b = new OpBuilder(epsonTmT88).text('hello');
  const png = opsToPng(b.operations, epsonTmT88);
  assert.equal(png.readUInt32BE(16), 576);
  assert.equal(png.readUInt32BE(20), 24);
});

test('Star status parse', () => {
  const s = parseStarStatus([0x23, 0x28, 0x08, 0x00, 0x0c]);
  assert.equal(s.online, false);
  assert.equal(s.coverOpen, true);
  assert.equal(s.cutterError, true);
  assert.equal(s.paperOut, true);
  assert.equal(s.paperNearEnd, true);
  assert.equal(parseStarStatus([0x23, 0x00, 0x00, 0x00, 0x00]).online, true);
});

test('USB and model profile picks', () => {
  assert.equal(profileForUsb(0x04b8).id, 'epson-tm-t88');
  assert.equal(profileForUsb(0x0519, 0x0001).id, 'star-tsp100');
  assert.equal(profileForUsb(0x0519, 0x0003).id, 'star-tsp650');
  assert.equal(profileForUsb(0x1234).id, 'generic-escpos');
  assert.equal(profileForModel('EPSON', 'TM-T20III').id, 'epson-tm-t20');
  assert.equal(profileForModel('EPSON', 'TM-m30II').id, 'epson-tm-m30');
  assert.equal(profileForModel('EPSON', 'TM-U220').id, 'epson-tm-t88');
  assert.equal(profileForModel('Xprinter', 'XP-80C').id, 'generic-escpos');
});

function fakePrinter(answer) {
  const server = net.createServer((sock) => sock.on('data', (d) => { const r = answer(d); if (r) sock.write(r); }));
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, close: () => server.close() })));
}

test('identify: an Epson answers GS I', async () => {
  const srv = await fakePrinter((d) => {
    if (d[0] === 0x1d && d[1] === 0x49) {
      const n = d[2];
      const s = n === 66 ? 'EPSON' : n === 67 ? 'TM-T88V' : n === 65 ? '1.02 ESC/POS' : '';
      return Buffer.concat([Buffer.from([0x5f]), Buffer.from(s, 'ascii'), Buffer.from([0])]);
    }
    return null;
  });
  try {
    const t = new NetTransport('127.0.0.1', { port: srv.port });
    await t.open();
    const id = await identify(t, 300);
    await t.close();
    assert.equal(id.maker, 'EPSON');
    assert.equal(id.model, 'TM-T88V');
    assert.equal(id.firmware, '1.02 ESC/POS');
    assert.equal(id.set, 'escpos');
    assert.equal(id.profile.id, 'epson-tm-t88');
  } finally {
    srv.close();
  }
});

test('identify: silence on GS I but a Star status reply means Star Line', async () => {
  const srv = await fakePrinter((d) => (d[0] === 0x1b && d[1] === 0x06 ? Buffer.from([0x23, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]) : null));
  try {
    const t = new NetTransport('127.0.0.1', { port: srv.port });
    await t.open();
    const id = await identify(t, 200);
    assert.equal(id.set, 'star-line');
    assert.equal(id.profile.id, 'star-tsp650');
    const p = new Printer(t, starTsp650, { initOnOpen: false });
    p.opened = true;
    const s = await p.status();
    assert.equal(s.supported, true);
    assert.equal(s.online, true);
    await t.close();
  } finally {
    srv.close();
  }
});

test('identify: nothing answers', async () => {
  const srv = await fakePrinter(() => null);
  try {
    const t = new NetTransport('127.0.0.1', { port: srv.port });
    await t.open();
    const id = await identify(t, 100);
    await t.close();
    assert.equal(id.set, 'unknown');
    assert.equal(id.profile, null);
  } finally {
    srv.close();
  }
});
