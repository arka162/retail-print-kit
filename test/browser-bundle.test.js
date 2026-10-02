const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('browser bundle runs without Node globals and renders both kinds', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'dist', 'browser', 'thermal-print.js'), 'utf8');
  const ctx = { TextEncoder, TextDecoder, console };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const T = ctx.ThermalPrint;
  assert.ok(T.render && T.renderLabel && T.opsToHtml && T.labelToSvg && T.encodeZpl && T.encodeTspl && T.encodeEzpl);
  const ops = T.render({ name: 'r', version: 1, blocks: [{ type: 'text', value: '{{a}}' }, { type: 'qr', value: 'x' }] }, { a: 'hi' }, T.epsonTmT88);
  const html = T.opsToHtml(ops, T.epsonTmT88);
  assert.ok(html.includes('>hi<'));
  assert.ok(html.includes('data:image/png;base64,iVBOR'));
  const label = T.renderLabel({ name: 'l', version: 1, kind: 'label', widthMm: 50.8, heightMm: 25.4, elements: [{ type: 'text', x: 1, y: 1, value: '{{a}}', height: 20 }] }, { a: 'yo' });
  assert.ok(T.labelToSvg(label).includes('>yo<'));
  assert.ok(T.encodeZpl(label).startsWith('^XA'));
});
