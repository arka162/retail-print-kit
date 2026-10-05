---
title: An alternative to escpos and node-thermal-printer, and how to migrate
description: retail-print-kit is a maintained alternative to the escpos and node-thermal-printer npm packages, with the same method names plus Star, label printers, templates and previews. Migration steps and a comparison.
---
# An alternative to escpos and node-thermal-printer, and how to migrate

The `escpos` package has not had a stable release in years, and its USB adapter is still an
alpha. `node-thermal-printer` is maintained but stops at ESC/POS and Star Line text. If you need
Star TSP100, label printers, templates, previews or printer status, `retail-print-kit` covers them
in one package.

## Comparison

| | retail-print-kit | escpos | node-thermal-printer |
|---|---|---|---|
| Epson ESC/POS and compatibles | yes | yes | yes |
| Star Line Mode | yes | no | yes |
| Star raster-only (TSP100 / TSP143) | yes | no | no |
| Label printers (ZPL, TSPL, EZPL) | yes | no | no |
| Printer profiles | yes | no | no |
| JSON templates with data binding | yes | no | no |
| HTML / PNG / SVG preview | yes | no | no |
| Printer status and model detection | yes | no | partly |
| TypeScript types | built in | community | built in |
| Packages a plain install adds (measured Oct 2026) | 4 | 66 | 7 |

## Migrating from escpos

The builder keeps the `escpos` method names, so most receipt code does not change.

Before:

```js
const escpos = require('escpos');
escpos.USB = require('escpos-usb');
const device = new escpos.USB();
const printer = new escpos.Printer(device);

device.open(() => {
  printer.align('ct').style('b').size(2, 2).text('MY STORE')
    .tableCustom([{ text: 'Coffee', align: 'LEFT', width: 0.7 }, { text: '$2.50', align: 'RIGHT', width: 0.3 }])
    .cut().cashdraw().close();
});
```

After:

```js
const { Printer, profiles } = require('retail-print-kit');
const { UsbTransport } = require('retail-print-kit/usb');
const printer = new Printer(new UsbTransport(), profiles['epson-tm-t88']);

await printer.open();
printer.align('ct').style('b').size(2, 2).text('MY STORE')
  .tableCustom([{ text: 'Coffee', align: 'LEFT', width: 0.7 }, { text: '$2.50', align: 'RIGHT', width: 0.3 }])
  .cut().cashdraw();
await printer.close();
```

What changes:

| escpos | retail-print-kit |
|---|---|
| `new escpos.USB()`, `escpos.Network(host)`, `escpos.Serial(port)` | `UsbTransport`, `NetTransport`, `SerialTransport` |
| `device.open(callback)` | `await printer.open()` |
| `printer.close()` sends and closes | `await printer.close()` (returns a promise) |
| `font('a')` | `setFont('a')` |
| `qrimage(text, opts, cb)` | `qr(text, { size })`, no callback |
| `image(img, density)` with `escpos.Image.load` | `image(await loadImage(file, { width }))` |
| options `{ encoding }` | the profile's code page |

The global USB `detach` listener that `escpos-usb` leaks is gone: listeners are attached on open
and removed on close.

## Migrating from node-thermal-printer

| node-thermal-printer | retail-print-kit |
|---|---|
| `new ThermalPrinter({ type: PrinterTypes.EPSON, interface: 'tcp://192.168.1.50' })` | `new Printer(new NetTransport('192.168.1.50'), profiles['epson-tm-t88'])` |
| `println(text)` | `text(text)` |
| `alignCenter()`, `alignLeft()`, `alignRight()` | `align('ct')`, `align('lt')`, `align('rt')` |
| `bold(true)` | `style('b')`, back with `style('normal')` |
| `setTextSize(h, w)` | `size(w + 1, h + 1)` |
| `tableCustom([...])` | `tableCustom([...])` |
| `printQR(text)`, `code128(data)` | `qr(text)`, `barcode(data, 'CODE128')` |
| `openCashDrawer()` | `cashdraw()` |
| `cut()`, `partialCut()` | `cut()`, `cut(true)` |
| `await execute()` | `await close()` or `await flush()` |

## Check before you ship

```
npx retail-print-kit test --net 192.168.1.50 --profile epson-tm-t88
```

prints a test page and the printer status.

Related: [print a receipt](./print-receipt-nodejs.md),
[Star TSP100](./star-tsp100-nodejs.md), [labels](./zpl-tspl-ezpl-label-printing-nodejs.md).
