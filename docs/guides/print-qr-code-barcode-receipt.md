---
title: Print QR codes and barcodes on a receipt from Node.js
description: Print QR codes and UPC-A, EAN-13, CODE128 and CODE39 barcodes on ESC/POS and Star thermal receipt printers from Node.js, using the printer's native commands with an automatic bitmap fallback.
---
# Print QR codes and barcodes on a receipt from Node.js

## QR code

```js
printer.align('ct').qr('https://example.com/receipt/1042', { size: 6, correction: 'M' });
```

`size` is the dot size of one module (1 to 16). `correction` is `L`, `M`, `Q` or `H`.

Printers with a built-in QR command (Epson and most ESC/POS units, Star Line Mode) receive that
command, which is small and fast. Printers without one get the QR as a bitmap automatically, so the
same call works everywhere. To force a bitmap:

```js
const { qrBitmap } = require('retail-print-kit');
printer.image(qrBitmap('https://example.com/receipt/1042', { size: 6 }));
```

## Barcodes

```js
printer.align('ct')
  .barcode('036000291452', 'UPC_A', { height: 60, width: 2 })
  .barcode('5901234123457', 'EAN13')
  .barcode('ORDER-1042', 'CODE128', { height: 80, position: 'below' })
  .barcode('ABC 123', 'CODE39');
```

| Option | Values | Default |
|---|---|---|
| `height` | dots, 1 to 255 | 80 |
| `width` | module width, 2 to 6 | 3 |
| `position` | `none`, `above`, `below`, `both` (the human-readable text) | `below` |

Types: `UPC_A`, `UPC_E`, `EAN13`, `EAN8`, `CODE39`, `CODE128`, `ITF`, `CODABAR`.

For UPC-A and EAN-13 you may pass the code with or without its check digit. CODE128 data is sent
in code set B, which covers letters, digits and punctuation.

## A barcode that does not fit

A barcode wider than the paper is not printed at all by most printers. Lower `width`, or shorten
the data: on 80 mm paper at `width: 2`, CODE128 fits about 30 characters.

## Barcodes on raster-only printers

On the Star TSP100 family, barcodes and QR codes are drawn into the page bitmap by the library, so
the same calls work. See [Star TSP100](./star-tsp100-nodejs.md).

## In a template

```js
{ type: 'qr', value: 'https://example.com/r/{{id}}', align: 'center', size: 5 }
{ type: 'barcode', value: '{{orderNumber}}', format: 'CODE128', height: 60, align: 'center' }
```

See [templates and the designer](./receipt-template-designer.md).

## As an image, without a printer

```js
const { qrBitmap, barcodeBitmap, bitmapToPng } = require('retail-print-kit');
require('fs').writeFileSync('qr.png', bitmapToPng(qrBitmap('hello', { size: 8 })));
require('fs').writeFileSync('upc.png', bitmapToPng(barcodeBitmap('UPC_A', '036000291452', 3, 100)));
```
