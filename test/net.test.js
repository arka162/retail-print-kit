const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { Printer, epsonTmT88 } = require('../dist');
const { NetTransport } = require('../dist/transports/net');

function fakePrinter() {
  const received = [];
  const server = net.createServer((sock) => sock.on('data', (d) => received.push(d)));
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ port: server.address().port, received, close: () => server.close() }));
  });
}

test('prints a receipt over raw TCP', async () => {
  const srv = await fakePrinter();
  try {
    const p = new Printer(new NetTransport('127.0.0.1', { port: srv.port }), epsonTmT88);
    await p.open();
    p.text('hello').cut().cashdraw();
    await p.close();
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(Buffer.concat(srv.received).toString('hex'), '1b401b7400' + '68656c6c6f0a' + '1d564103' + '1b700019fa');
  } finally {
    srv.close();
  }
});

test('connect failure rejects with a clear error', async () => {
  const t = new NetTransport('127.0.0.1', { port: 1, timeout: 500 });
  await assert.rejects(() => t.open());
  await assert.rejects(() => t.write(Buffer.from('x')), /not open/);
});
