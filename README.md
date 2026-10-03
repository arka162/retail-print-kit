# retail-print-kit

[![npm](https://img.shields.io/npm/v/retail-print-kit.svg)](https://www.npmjs.com/package/retail-print-kit)
[![ci](https://github.com/arka162/retail-print-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/arka162/retail-print-kit/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/retail-print-kit.svg)](LICENSE)

**Receipt printers, cash drawers and label printers for Node.js and Electron, in one package.**

A modern replacement for `escpos` / `node-thermal-printer`: ESC/POS **and** Star printers, USB /
network / serial, printer profiles instead of model `if`s, receipt and label **templates**, live
**previews**, a visual **designer**, and a CLI for testing hardware in the field.

**[Open the designer](https://arka162.github.io/retail-print-kit/)** · [Printer matrix](docs/printer-matrix.md) · [Hardware checklist](docs/hardware-checklist.md)

![Receipt designer](https://raw.githubusercontent.com/arka162/retail-print-kit/main/docs/images/designer-receipt.png)

## Why

| | retail-print-kit | escpos | node-thermal-printer |
|---|---|---|---|
| Epson ESC/POS and compatibles | yes | yes | yes |
| Star Line Mode (TSP650, mC-Print) | yes | no | yes |
| Star raster-only (TSP100 / TSP143) | yes | no | no |
| Label printers (ZPL, TSPL, EZPL) | yes | no | no |
| Printer profiles (cut, drawer pulse, code page, columns) | yes | no | no |
| Templates with data binding | yes | no | no |
| HTML / PNG / SVG preview without a printer | yes | no | no |
| Status (paper, cover, drawer) and model detection | yes | no | partly |
| Native dependencies in the core | none | none | none |
| TypeScript types | built in | community | built in |

## Install

```
npm install retail-print-kit
```

The core is pure JavaScript. Add a transport only if you need it:

```
npm install usb            # USB printers
npm install serialport     # RS-232 / USB-serial printers
npm install @napi-rs/canvas  # PNG preview, image files, Star TSP100
```

Node 18 or newer, including Electron's main process. CI runs on Linux, Windows and macOS.

## Quick start

```js
const { Printer, profiles } = require('retail-print-kit');
const { NetTransport } = require('retail-print-kit/net');

const printer = new Printer(new NetTransport('192.168.1.50'), profiles['epson-tm-t88']);
await printer.open();
printer
  .align('ct').style('b').size(2, 2).text('MY STORE')
  .size(1, 1).style('normal').align('lt')
  .tableCustom([
    { text: 'Coffee', align: 'LEFT', width: 0.7 },
    { text: '$2.50', align: 'RIGHT', width: 0.3 },
  ])
  .drawLine()
  .qr('https://example.com/receipt/1042')
  .feed(2).cut().cashdraw();
await printer.close();
```

The method names match the `escpos` package (`text`, `align`, `style`, `size`, `feed`, `cut`,
`cashdraw`, `tableCustom`, `drawLine`, `barcode`, `qrimage`), so existing receipt code moves over
with a device swap. Other transports:

```js
const { UsbTransport } = require('retail-print-kit/usb');       // new UsbTransport() or { vendorId, productId }
const { SerialTransport } = require('retail-print-kit/serial'); // new SerialTransport('COM3', { baudRate: 9600 })
```

## Supported printers

| Family | Profile ids | Command set |
|---|---|---|
| Epson TM-T88 V/VI/VII, TM-T20III, TM-m30 | `epson-tm-t88`, `epson-tm-t20`, `epson-tm-m30` | ESC/POS |
| Bixolon, Citizen, SNBC, Xprinter, Rongta, HPRT, POS-X | `generic-escpos`, `generic-escpos-58` | ESC/POS |
| Star TSP650II, TSP700II, mC-Print3 | `star-tsp650`, `star-mc-print3` | Star Line Mode |
| Star TSP100 / TSP143 | `star-tsp100` | Star raster |
| Zebra, TSC and clones, Godex (labels) | `encodeZpl`, `encodeTspl`, `encodeEzpl` | ZPL, TSPL, EZPL |

A profile carries paper width, columns, code page, cut command, drawer pulse and features, so the
same receipt code prints correctly on each. `identify()` and `profileForUsb()` pick one for you.
See the [printer matrix](docs/printer-matrix.md) for what has been run on real hardware.

## Cash drawer and status

```js
printer.cashdraw();        // pin 2; cashdraw(5) for the second drawer
await printer.flush();

const s = await printer.status();
// { online, coverOpen, paperOut, paperNearEnd, cutterError, drawerPinHigh, ... }
```

## Templates

A receipt can be a JSON layout rendered with data. This is what the designer produces.

```js
const template = {
  name: 'receipt', version: 1,
  blocks: [
    { type: 'text', value: '{{store.name | upper}}', align: 'center', style: 'b', size: [2, 2] },
    { type: 'table', rows: 'items', columns: [
      { value: '{{name}}', header: 'Item', width: 0.6 },
      { value: '{{qty}}', header: 'Qty', width: 0.1, align: 'CENTER' },
      { value: '{{total | money:$}}', header: 'Amount', width: 0.3, align: 'RIGHT' },
    ] },
    { type: 'row', cells: [{ value: 'TOTAL', width: 0.7 }, { value: '{{total | money:$}}', width: 0.3, align: 'RIGHT' }] },
    { type: 'if', when: 'customer', blocks: [{ type: 'text', value: 'Thanks {{customer.name}}' }] },
    { type: 'qr', value: 'https://example.com/r/{{id}}', align: 'center' },
    { type: 'cut' }, { type: 'drawer' },
  ],
};
printer.render(template, data);
```

Blocks: `text`, `line`, `row`, `table`, `image`, `feed`, `newline`, `cut`, `drawer`, `qr`,
`barcode`, `each`, `if`. Values use `{{path | filter}}` with `upper`, `lower`, `trim`,
`money[:prefix]`, `fixed[:n]`, `pad:n`, `padEnd:n`, `default:x`, `date[:time|datetime]`, `count`.
Inside `each` and table rows, `this`, `@index` and `@number` refer to the current item.

## Images and logos

```js
const { loadImage } = require('retail-print-kit');
const logo = await loadImage('logo.png', { width: 384, dither: true }); // needs @napi-rs/canvas
printer.align('ct').image(logo);
```

`fromRgba` and `ditherRgba` convert raw pixels; `serializeBitmap` stores a bitmap as JSON for the
template `image` block.

## Labels

Labels are positioned elements on a fixed page, encoded for Zebra (ZPL), TSC and clones (TSPL) or
Godex (EZPL). Positions are in dots at the label's dpi; `mm()` converts.

```js
const { LabelBuilder, encodeZpl, encodeTspl, encodeEzpl, labelToSvg, renderLabel } = require('retail-print-kit');
const b = new LabelBuilder({ widthMm: 50.8, heightMm: 25.4, dpi: 203 });
b.text(18, 14, 'Coffee Beans 1lb', 26).text(92, 65, '$12.99', 85, { bold: true })
 .barcode(35, 140, '036000291452', 'UPC_A', 35).qr(330, 20, 'https://x.io/i/1', { module: 3 });
const zpl = encodeZpl(b.label);                 // send to the printer on port 9100
const svg = labelToSvg(b.label);                // preview
const label = renderLabel(labelTemplate, data); // from a designer JSON
```

![Label designer](https://raw.githubusercontent.com/arka162/retail-print-kit/main/docs/images/designer-label.png)

## Designer

**https://arka162.github.io/retail-print-kit/** edits receipt and label templates in the browser:
block palette, nested `each` / `if`, property editor, sample data, live preview, drag-to-position
on labels, logo upload with dithering, JSON import and export. It runs entirely in the page from
the browser bundle (`retail-print-kit/browser`); nothing is uploaded.

## Preview without a printer

```js
printer.toHtml();                                 // paper-like HTML of the recorded ops
opsToHtml(ops, profile); opsToPng(ops, profile);  // same without a Printer
```

<img src="https://raw.githubusercontent.com/arka162/retail-print-kit/main/docs/images/test-page.png" width="300" alt="PNG preview of the test page">

## Find and identify printers

```js
const { discoverNetworkPrinters, identify, profileForUsb } = require('retail-print-kit');
await discoverNetworkPrinters({ identify: true }); // [{ host, port, identity: { maker, model, profile } }]
await identify(transport);                         // GS I for ESC/POS, status probe for Star
profileForUsb(0x04b8);                             // profile from a USB vendor id
```

## CLI

```
npx retail-print-kit discover --identify                              # printers on this network
npx retail-print-kit test --net 192.168.1.50 --profile epson-tm-t20   # test page + status
npx retail-print-kit verify --net 192.168.1.50 --drawer               # numbered hardware checks
npx retail-print-kit drawer --usb                                     # kick the drawer
npx retail-print-kit status --serial /dev/ttyUSB0
npx retail-print-kit identify --net 192.168.1.50
npx retail-print-kit image --file logo.png --width 384 --dither --net 192.168.1.50
npx retail-print-kit print --template receipt.json --data sale.json --net 192.168.1.50
npx retail-print-kit print --template shelf.json --data item.json --language zpl --net 192.168.1.60
npx retail-print-kit verify-label --language tspl --net 192.168.1.60
npx retail-print-kit preview --profile star-tsp100 --out page.png     # no printer needed
npx retail-print-kit profiles
```

Add `--dry` to any printing command to dump the bytes as hex instead of sending them.

## Status of hardware verification

Encoders are covered by byte-exact tests. Items still to be confirmed on real units are listed in
the [hardware checklist](docs/hardware-checklist.md): Star raster cut modes, Star status bits,
Godex font sizes, and QR syntax on EZPL and TSPL. Reports from the field are welcome as issues.

## License

MIT, Arkaprova Majumder.
