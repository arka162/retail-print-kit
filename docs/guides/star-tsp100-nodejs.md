---
title: Print to a Star TSP100 or TSP143 from Node.js
description: The Star TSP100 and TSP143 are raster-only printers that ignore ESC/POS text commands. retail-print-kit renders the receipt to a bitmap and prints it, and also supports Star Line Mode printers such as the TSP650II and mC-Print3.
---
# Print to a Star TSP100 or TSP143 from Node.js

The Star TSP100 family (TSP143, TSP143III, TSP100IV) is one of the most common receipt printers,
and it does not understand ESC/POS. It is a raster printer: it prints bitmaps, not text commands.
That is why `escpos` and similar libraries print garbage or nothing on it.

`retail-print-kit` has a Star raster profile. You write the receipt the usual way; the library lays
the text out, renders it to a bitmap, and sends Star raster commands.

## Install

```
npm install retail-print-kit @napi-rs/canvas
npm install usb     # for a USB TSP143
```

`@napi-rs/canvas` draws the text. It ships prebuilt binaries; no compiler is needed.

## Print

```js
const { Printer, profiles } = require('retail-print-kit');
const { UsbTransport } = require('retail-print-kit/usb');

async function main() {
  const printer = new Printer(new UsbTransport({ vendorId: 0x0519 }), profiles['star-tsp100']);
  await printer.open();
  printer
    .align('ct').style('b').size(2, 2).text('MY STORE')
    .size(1, 1).style('normal').align('lt')
    .text('Coffee, large            $5.00')
    .qr('https://example.com/r/1042')
    .barcode('036000291452', 'UPC_A', { height: 60 })
    .cut()
    .cashdraw();
  await printer.close();
}
main().catch(console.error);
```

For a LAN model (TSP143IIILAN) use `new NetTransport('192.168.1.60')` from `retail-print-kit/net`.

## Star Line Mode printers

The TSP650II, TSP700II and mC-Print3 accept text commands in Star Line Mode, which is still not
ESC/POS. Use their profiles and no canvas is needed:

```js
const printer = new Printer(new NetTransport('192.168.1.61'), profiles['star-tsp650']);
// or profiles['star-mc-print3']
```

## Which Star profile?

| Printer | Profile | Needs canvas |
|---|---|---|
| TSP100, TSP143 (all generations) | `star-tsp100` | yes |
| TSP650II, TSP700II, TSP800II | `star-tsp650` | no |
| mC-Print3, mC-Print2 | `star-mc-print3` | no |

`profileForUsb(0x0519, productId)` picks between them from the USB ids.

## Preview what will print

```
npx retail-print-kit preview --profile star-tsp100 --out page.png
```

## Verification status

The Star encoders are covered by byte-exact tests. The raster end-of-page cut bytes and the Line
Mode status bits are still being confirmed on physical units; see the
[hardware checklist](https://github.com/arka162/retail-print-kit/blob/main/docs/hardware-checklist.md).
If you have one of these printers, `npx retail-print-kit verify --usb --profile star-tsp100` prints
a numbered test page, and a report is very welcome.

Related: [print a receipt](./print-receipt-nodejs.md), [cash drawer](./open-cash-drawer-nodejs.md).
