#!/usr/bin/env node
'use strict';
const fs = require('fs');
const { Printer, profiles, profileById, NetTransport, identify, opsToHtml, opsToPng, OpBuilder } = require('../dist');

process.stdout.on('error', (err) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

const USAGE = `thermal-print <command> [options]

Commands
  test       print a test page (text styles, table, barcode, QR) and show status
  drawer     kick the cash drawer
  status     print the printer status as JSON
  identify   ask the printer its maker, model and firmware; suggest a profile
  preview    write the test page as HTML (--out page.html) or PNG (--out page.png)
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
  thermal-print test --net 192.168.1.50 --profile epson-tm-t20
  thermal-print drawer --usb
  thermal-print status --serial /dev/ttyUSB0`;

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
    .align('ct').style('b').size(2, 2).text('thermal-print').size(1, 1).style('normal')
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
    .qr('https://github.com/arka162/thermal-print', { size: 5 }).newLine()
    .align('lt').text(`${'='.repeat(10)} end of test ${'='.repeat(10)}`)
    .cut();
  await printer.flush();
  await showStatus(printer);
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
