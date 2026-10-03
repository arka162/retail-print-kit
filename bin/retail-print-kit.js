#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { Printer, profiles, profileById, NetTransport, identify, opsToHtml, opsToPng, OpBuilder, render, renderLabel, encodeLabel, labelToSvg, discoverNetworkPrinters, emptyBitmap, setPixel, qrBitmap, LabelBuilder, loadImage } = require('../dist');

process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

const USAGE = `retail-print-kit <command> [options]

Commands
  test       print a test page (text styles, table, barcode, QR) and show status
  drawer     kick the cash drawer
  status     print the printer status as JSON
  verify     print the numbered hardware verification page (see docs/hardware-checklist.md)
             add --drawer to kick pin 2 then pin 5
  verify-label  print a verification label: --language zpl|tspl|ezpl [--width-mm 50.8 --height-mm 25.4]
  discover   find printers on the local network (port 9100); --identify asks each one its model
  image      print an image file: --file logo.png [--width 384] [--dither]
  identify   ask the printer its maker, model and firmware; suggest a profile
  preview    write the test page as HTML (--out page.html) or PNG (--out page.png)
  print      print a template: --template t.json --data d.json (receipt or label)
             a label needs --language zpl|tspl|ezpl; --out file.svg|.html|.txt previews instead
  profiles   list printer profiles
  list       list USB printers and serial ports

Connection (one of)
  --net <host[:port]>        raw TCP, port 9100 by default
  --usb [<vid:pid>]          first USB printer-class device, or the given ids (hex)
  --serial <path> [--baud n] serial port, 9600 baud by default

Options
  --profile <id>             printer profile (default epson-tm-t88)
  --pin 2|5                  drawer pin for "drawer" (default 2)
  --dry                      print the bytes as hex instead of sending

Examples
  retail-print-kit test --net 192.168.1.50 --profile epson-tm-t20
  retail-print-kit drawer --usb
  retail-print-kit status --serial /dev/ttyUSB0`;

function parse(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function transportFor(args) {
  if (args.dry) {
    const chunks = [];
    return {
      name: 'dry',
      chunks,
      async open() {},
      async write(b) { chunks.push(Buffer.from(b)); },
      async close() { process.stdout.write(Buffer.concat(chunks).toString('hex') + '\n'); },
    };
  }
  if (args.net) {
    const [host, port] = String(args.net).split(':');
    return new NetTransport(host, { port: port ? Number(port) : undefined });
  }
  if (args.usb !== undefined) {
    const { UsbTransport } = require('../dist/transports/usb');
    if (args.usb === true) return new UsbTransport();
    const [vid, pid] = String(args.usb).split(':');
    return new UsbTransport({ vendorId: parseInt(vid, 16), productId: pid ? parseInt(pid, 16) : undefined });
  }
  if (args.serial) {
    const { SerialTransport } = require('../dist/transports/serial');
    return new SerialTransport(String(args.serial), { baudRate: args.baud ? Number(args.baud) : undefined });
  }
  throw new Error('give a connection: --net, --usb or --serial (or --dry)');
}

async function withPrinter(args, fn) {
  const profile = profileById(String(args.profile || 'epson-tm-t88'));
  const printer = new Printer(transportFor(args), profile);
  await printer.open();
  try {
    await fn(printer, profile);
  } finally {
    await printer.close();
  }
}

async function testPage(printer, profile) {
  const now = new Date();
  printer
    .align('ct').style('b').size(2, 2).text('retail-print-kit').size(1, 1).style('normal')
    .text(`${profile.vendor} ${profile.model}`)
    .text(`profile ${profile.id} / ${profile.set} / ${profile.columns.a} cols`)
    .text(now.toLocaleString())
    .align('lt').drawLine()
    .text('normal text')
    .style('b').text('bold text').style('normal')
    .style('u').text('underlined text').style('normal')
    .size(2, 1).text('double width').size(1, 1)
    .size(1, 2).text('double height').size(1, 1)
    .setFont('b').text('font B: ' + '0123456789'.repeat(5)).setFont('a')
    .drawLine()
    .tableCustom([{ text: 'Item', width: 0.6 }, { text: 'Qty', width: 0.1, align: 'CENTER' }, { text: 'Amount', width: 0.3, align: 'RIGHT' }])
    .tableCustom([{ text: 'Coffee, large, oat milk', width: 0.6 }, { text: '2', width: 0.1, align: 'CENTER' }, { text: '$5.00', width: 0.3, align: 'RIGHT' }])
    .tableCustom([{ text: 'Bagel', width: 0.6 }, { text: '1', width: 0.1, align: 'CENTER' }, { text: '$7.50', width: 0.3, align: 'RIGHT' }])
    .drawLine()
    .tableCustom([{ text: 'TOTAL', width: 0.7, style: 'b' }, { text: '$12.50', width: 0.3, align: 'RIGHT' }])
    .newLine()
    .align('ct').barcode('036000291452', 'UPC_A', { height: 60, width: 2 }).newLine()
    .qr('https://github.com/arka162/retail-print-kit', { size: 5 }).newLine()
    .align('lt').text(`${'='.repeat(10)} end of test ${'='.repeat(10)}`)
    .cut();
  await printer.flush();
  await showStatus(printer);
}

function section(p, id, title) {
  p.align('lt').style('b').text(`[${id}] ${title}`).style('normal');
}

async function verifyPage(printer, profile, args) {
  const cols = profile.columns.a;
  const ruler = (n) => '1234567890'.repeat(Math.ceil(n / 10)).slice(0, n);
  printer.align('ct').style('b').size(2, 2).text('VERIFY').size(1, 1).style('normal')
    .text(`${profile.id} / ${profile.set}`).text(new Date().toLocaleString()).align('lt').drawLine();
  section(printer, 'V1', `Font A ruler: last digit must be ${ruler(cols).slice(-1)} at the right edge (${cols} cols)`);
  printer.text(ruler(cols));
  section(printer, 'V2', `Font B ruler (${profile.columns.b} cols)`);
  printer.setFont('b').text(ruler(profile.columns.b)).setFont('a');
  section(printer, 'V3', 'Styles: bold, underline, double width, double height, inverse');
  printer.style('b').text('bold').style('u').text('underline').style('normal').size(2, 1).text('wide').size(1, 2).text('tall').size(1, 1)
    .style({ invert: true }).text(' inverse ').style('normal');
  section(printer, 'V4', 'Alignment: left, centre, right');
  printer.align('lt').text('left').align('ct').text('centre').align('rt').text('right').align('lt');
  section(printer, 'V5', 'Code page: bytes 80..FF (expect CP437 box drawing in B0..DF)');
  for (let row = 0x80; row < 0x100; row += 16) {
    printer.print(row.toString(16).toUpperCase() + ' ').raw(Array.from({ length: 16 }, (_, i) => row + i)).newLine();
  }
  section(printer, 'V6', 'Barcodes: UPC-A, EAN-13, CODE128, CODE39');
  printer.align('ct')
    .barcode('036000291452', 'UPC_A', { height: 50 }).newLine()
    .barcode('5901234123457', 'EAN13', { height: 50 }).newLine()
    .barcode('RPK-12345', 'CODE128', { height: 50 }).newLine()
    .barcode('RPK 123', 'CODE39', { height: 50 }).newLine().align('lt');
  section(printer, 'V7', 'QR A = printer native, QR B = bitmap; both must scan to the same URL');
  printer.align('ct').text('A');
  if (profile.features.nativeQr || profile.set === 'star-graphic') printer.qr('https://github.com/arka162/retail-print-kit', { size: 5 });
  else printer.text('(no native QR on this profile)');
  printer.newLine().text('B').image(qrBitmap('https://github.com/arka162/retail-print-kit', { size: 5 })).newLine().align('lt');
  section(printer, 'V8', 'Raster: checkerboard, then a diagonal line, edges sharp');
  const bm = emptyBitmap(256, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 256; x++) if (x < 128 ? ((x >> 3) + (y >> 3)) % 2 === 0 : Math.abs(x - 128 - y * 2) < 2) setPixel(bm, x, y, true);
  printer.align('ct').image(bm).newLine().align('lt');
  section(printer, 'V9', 'Partial cut follows this line');
  printer.cut(true);
  section(printer, 'V10', 'Full cut follows this line');
  printer.text('End of verification page. Fill in docs/hardware-checklist.md.').cut(false);
  await printer.flush();
  if (args.drawer) {
    printer.cashdraw(2);
    await printer.flush();
    await new Promise((r) => setTimeout(r, 1500));
    printer.cashdraw(5);
    await printer.flush();
    console.log('V11 drawer: kicked pin 2, then pin 5 after 1.5 s');
  }
  await showStatus(printer);
}

function verifyLabel(args) {
  const b = new LabelBuilder({ widthMm: Number(args['width-mm'] || 50.8), heightMm: Number(args['height-mm'] || 25.4), dpi: Number(args.dpi || 203) });
  const w = b.label.width;
  const h = b.label.height;
  b.box(2, 2, w - 4, h - 4, 2)
    .text(10, 8, 'L1 text 20', 20).text(10, 32, 'L2 text 32', 32)
    .barcode(10, 72, '036000291452', 'UPC_A', 40)
    .qr(w - 110, 8, 'https://github.com/arka162/retail-print-kit', { module: 3 })
    .rect(10, h - 14, w - 20, 4)
    .text(w - 150, h - 60, String(args.language || 'zpl').toUpperCase(), 40, { bold: true });
  return b.label;
}

async function showStatus(printer) {
  if (!printer.transport.read) return;
  try {
    const s = await printer.status();
    console.log(JSON.stringify(s));
  } catch (err) {
    console.log(`status: ${err.message}`);
  }
}

async function main() {
  const args = parse(process.argv.slice(2));
  const cmd = args._[0];
  switch (cmd) {
    case 'test':
      return withPrinter(args, testPage);
    case 'drawer':
      return withPrinter(args, async (p) => { p.cashdraw(args.pin === '5' ? 5 : 2); });
    case 'status':
      return withPrinter(args, showStatus);
    case 'verify':
      return withPrinter(args, (p, profile) => verifyPage(p, profile, args));
    case 'verify-label': {
      const label = verifyLabel(args);
      const language = String(args.language || 'zpl');
      if (args.out) {
        const out = String(args.out);
        fs.writeFileSync(out, out.endsWith('.svg') ? labelToSvg(label) : Buffer.from(encodeLabel(label, language)));
        console.log(`wrote ${out}`);
        return;
      }
      const t = transportFor(args);
      await t.open();
      try { await t.write(Buffer.from(encodeLabel(label, language))); } finally { await t.close(); }
      return;
    }
    case 'discover': {
      const found = await discoverNetworkPrinters({ port: args.port ? Number(args.port) : undefined, identify: !!args.identify });
      if (!found.length) console.log('no hosts answered on the printing port');
      for (const p of found) {
        const id = p.identity;
        console.log(`${p.host}:${p.port}` + (id ? `  ${id.maker || '?'} ${id.model || ''}  -> ${id.profile ? id.profile.id : 'unknown'}` : ''));
      }
      return;
    }
    case 'image': {
      const bm = await loadImage(String(args.file), { width: args.width ? Number(args.width) : undefined, dither: !!args.dither });
      return withPrinter(args, async (p) => { p.align('ct').image(bm).newLine().cut(); });
    }
    case 'identify': {
      const t = transportFor(args);
      await t.open();
      try {
        const id = await identify(t);
        console.log(JSON.stringify({ ...id, profile: id.profile ? id.profile.id : null }));
      } finally {
        await t.close();
      }
      return;
    }
    case 'print': {
      const tpl = JSON.parse(fs.readFileSync(String(args.template), 'utf8'));
      const data = args.data ? JSON.parse(fs.readFileSync(String(args.data), 'utf8')) : {};
      if (tpl.kind === 'label') {
        const label = renderLabel(tpl, data);
        const language = String(args.language || 'zpl');
        if (args.out) {
          const out = String(args.out);
          fs.writeFileSync(out, out.endsWith('.svg') ? labelToSvg(label) : Buffer.from(encodeLabel(label, language)));
          console.log(`wrote ${out}`);
          return;
        }
        const t = transportFor(args);
        await t.open();
        try { await t.write(Buffer.from(encodeLabel(label, language))); } finally { await t.close(); }
        return;
      }
      const profile = profileById(String(args.profile || 'epson-tm-t88'));
      if (args.out) {
        const out = String(args.out);
        const ops = render(tpl, data, profile);
        fs.writeFileSync(out, out.endsWith('.png') ? opsToPng(ops, profile) : opsToHtml(ops, profile));
        console.log(`wrote ${out}`);
        return;
      }
      return withPrinter(args, async (p) => { p.render(tpl, data); });
    }
    case 'preview': {
      const profile = profileById(String(args.profile || 'epson-tm-t88'));
      const out = String(args.out || 'preview.html');
      const b = new OpBuilder(profile);
      await testPage(Object.assign(b, { flush: async () => {}, transport: {} }), profile);
      const ops = b.operations;
      fs.writeFileSync(out, out.endsWith('.png') ? opsToPng(ops, profile) : opsToHtml(ops, profile));
      console.log(`wrote ${out}`);
      return;
    }
    case 'profiles':
      for (const p of Object.values(profiles)) console.log(`${p.id.padEnd(20)} ${p.set.padEnd(13)} ${p.paper}mm ${String(p.columns.a).padStart(3)} cols  ${p.vendor} ${p.model}`);
      return;
    case 'list': {
      try {
        const { UsbTransport } = require('../dist/transports/usb');
        for (const d of UsbTransport.list()) console.log(`usb    ${d.vendorId.toString(16).padStart(4, '0')}:${d.productId.toString(16).padStart(4, '0')}`);
      } catch (err) { console.log(`usb    ${err.message}`); }
      try {
        const { SerialTransport } = require('../dist/transports/serial');
        for (const p of await SerialTransport.list()) console.log(`serial ${p}`);
      } catch (err) { console.log(`serial ${err.message}`); }
      return;
    }
    default:
      console.log(USAGE);
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
