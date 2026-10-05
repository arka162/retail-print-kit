---
title: How to print a receipt from Node.js on an ESC/POS thermal printer
description: Print receipts from Node.js to Epson and other ESC/POS thermal printers over network, USB or serial, with text styles, tables, barcodes, QR codes, paper cut and cash drawer kick.
---
# How to print a receipt from Node.js on an ESC/POS thermal printer

`retail-print-kit` prints receipts from Node.js to Epson TM printers and ESC/POS compatibles
(Bixolon, Citizen, SNBC, Xprinter, Rongta, HPRT) over the network, USB or a serial port.

## Install

```
npm install retail-print-kit
```

That is all a network printer needs: 4 packages, no native modules. For USB add `npm install usb`,
for serial add `npm install serialport`.

## Print over the network (port 9100)

```js
const { Printer, profiles } = require('retail-print-kit');
const { NetTransport } = require('retail-print-kit/net');

async function printReceipt() {
  const printer = new Printer(new NetTransport('192.168.1.50'), profiles['epson-tm-t88']);
  await printer.open();
  printer
    .align('ct').style('b').size(2, 2).text('MY STORE')
    .size(1, 1).style('normal').text('1 Main St, Springfield')
    .align('lt').drawLine()
    .tableCustom([
      { text: 'Coffee, large', align: 'LEFT', width: 0.6 },
      { text: '2', align: 'CENTER', width: 0.1 },
      { text: '$5.00', align: 'RIGHT', width: 0.3 },
    ])
    .drawLine()
    .tableCustom([
      { text: 'TOTAL', align: 'LEFT', width: 0.7 },
      { text: '$5.00', align: 'RIGHT', width: 0.3 },
    ])
    .feed(1)
    .align('ct').qr('https://example.com/receipt/1042')
    .cut()
    .cashdraw();
  await printer.close();
}

printReceipt().catch(console.error);
```

Nothing is sent until `close()` (or `flush()`), so one receipt is one write.

## Print over USB

```js
const { UsbTransport } = require('retail-print-kit/usb');
const printer = new Printer(new UsbTransport(), profiles['epson-tm-t20']);
```

`new UsbTransport()` takes the first USB printer-class device. Pass `{ vendorId, productId }` to
pick one, and `UsbTransport.list()` to see what is attached.

## Print over serial

```js
const { SerialTransport } = require('retail-print-kit/serial');
const printer = new Printer(new SerialTransport('COM3', { baudRate: 9600 }), profiles['generic-escpos']);
```

## Which profile do I use?

| Printer | Profile id |
|---|---|
| Epson TM-T88V / VI / VII | `epson-tm-t88` |
| Epson TM-T20III | `epson-tm-t20` |
| Epson TM-m30II / III | `epson-tm-m30` |
| Other 80 mm ESC/POS printers | `generic-escpos` |
| 58 mm ESC/POS printers | `generic-escpos-58` |
| Star TSP650II, mC-Print3 | `star-tsp650`, `star-mc-print3` |
| Star TSP100 / TSP143 | `star-tsp100` |

A profile sets the columns per line, code page, cut command and cash drawer pulse, so the same
code prints correctly on each. Not sure what is attached? See
[finding printers and reading status](./network-printer-discovery-status.md).

## Try it without a printer

```
npx retail-print-kit preview --profile epson-tm-t88 --out receipt.html
npx retail-print-kit test --dry --profile epson-tm-t88
```

`printer.toHtml()` returns the same preview from your own code.

## Next

* [Open a cash drawer](./open-cash-drawer-nodejs.md)
* [QR codes and barcodes](./print-qr-code-barcode-receipt.md)
* [Print a logo](./print-logo-image-thermal-printer.md)
* [Receipt templates and the visual designer](./receipt-template-designer.md)
* [Electron apps](./electron-receipt-printing.md)
