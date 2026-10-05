---
title: Print ZPL, TSPL and EZPL labels from Node.js
description: Build shelf, price and barcode labels once and print them on Zebra (ZPL), TSC, Xprinter and Rongta (TSPL) or Godex (EZPL) label printers from Node.js, with an SVG preview and JSON label templates.
---
# Print ZPL, TSPL and EZPL labels from Node.js

Label printers each speak their own language: Zebra uses ZPL, TSC and most low-cost units use
TSPL, Godex uses EZPL. `retail-print-kit` lets you describe the label once and encode it for any
of them.

## Build a label

Positions are in dots from the top-left corner. At 203 dpi there are 8 dots per millimetre;
`b.mm(10)` converts.

```js
const { LabelBuilder, encodeZpl, encodeTspl, encodeEzpl, labelToSvg } = require('retail-print-kit');

const b = new LabelBuilder({ widthMm: 50.8, heightMm: 25.4, dpi: 203 }); // 2 x 1 inch
b.text(18, 14, 'Coffee Beans 1lb', 26)
 .text(92, 65, '$12.99', 85, { bold: true })
 .barcode(35, 140, '036000291452', 'UPC_A', 35)
 .qr(330, 20, 'https://example.com/i/1', { module: 3 })
 .box(2, 2, 402, 199, 2);

const zpl = encodeZpl(b.label);    // string, starts with ^XA
const tspl = encodeTspl(b.label);  // bytes, starts with SIZE
const ezpl = encodeEzpl(b.label);  // string, starts with ^Q
const svg = labelToSvg(b.label);   // preview
```

Elements: `text`, `barcode` (CODE128, EAN13, EAN8, UPC_A, UPC_E, CODE39, ITF, CODABAR), `qr`,
`box`, `rect` and `image`. Text, barcodes and QR codes take `rotation: 0 | 90 | 180 | 270`.

## Send it to the printer

Label printers on the network listen on port 9100, like receipt printers.

```js
const { encodeLabel } = require('retail-print-kit');
const { NetTransport } = require('retail-print-kit/net');

const t = new NetTransport('192.168.1.60');
await t.open();
await t.write(Buffer.from(encodeLabel(b.label, 'zpl'))); // 'zpl' | 'tspl' | 'ezpl'
await t.close();
```

Use `b.copies(3)` for several labels.

## Labels from a template

A label can be a JSON layout with data placeholders, which is what the
[designer](https://arka162.github.io/retail-print-kit/designer/?kind=label) exports:

```js
const { renderLabel } = require('retail-print-kit');

const template = {
  name: 'shelf-label', version: 1, kind: 'label', widthMm: 50.8, heightMm: 25.4, dpi: 203,
  elements: [
    { type: 'text', x: 18, y: 14, value: '{{name}}', height: 26 },
    { type: 'text', x: 92, y: 65, value: '{{price | money:$}}', height: 85, bold: true },
    { type: 'barcode', x: 35, y: 140, value: '{{upc}}', format: 'UPC_A', height: 35 },
    { type: 'text', x: 18, y: 70, value: 'SALE', height: 24, invert: true, when: 'sale' },
  ],
};
const label = renderLabel(template, { name: 'Coffee Beans 1lb', price: 12.99, upc: '036000291452', sale: true });
```

## From the command line

```
npx retail-print-kit print --template shelf.json --data item.json --language zpl --net 192.168.1.60
npx retail-print-kit print --template shelf.json --data item.json --out label.svg
npx retail-print-kit verify-label --language tspl --net 192.168.1.60
```

## Which language does my printer use?

| Printer | Language |
|---|---|
| Zebra (ZD, GK, ZT series) | `zpl` |
| TSC, Xprinter, Rongta, HPRT, Gprinter label units | `tspl` |
| Godex (G500, RT700, DT2) | `ezpl` |

Related: [the template designer](./receipt-template-designer.md).
