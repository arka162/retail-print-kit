---
title: Design shelf labels in millimetres and print them on Godex or Zebra
description: Keep shelf and price labels as one JSON design in millimetres, preview it exactly as it prints, and print it on Godex (EZPL) or Zebra (ZPL) label printers from Node.js, Electron or the browser.
---
# Design shelf labels in millimetres and print them on Godex or Zebra

`retail-print-kit/label-design` is for apps where people design their own labels: a store owner
lays out a shelf tag once, and every register prints it the same way.

## The design

A design is plain JSON. Positions and sizes are millimetres from the top-left corner; `{{field}}`
placeholders take values from the item being printed.

```json
{
  "version": 1, "kind": "label", "widthMm": 50.8, "heightMm": 25.4, "dpi": 203, "printer": "ezpl", "gapMm": 3,
  "elements": [
    { "id": "name", "type": "text", "x": 2, "y": 1.5, "w": 46, "h": 4, "value": "{{itemName}}", "font": "sans", "size": 10, "weight": 700 },
    { "id": "price", "type": "price", "x": 20, "y": 7, "w": 28, "h": 11, "value": "{{price}}", "size": 30, "format": "super" },
    { "id": "upc", "type": "barcode", "x": 2, "y": 17, "w": 25, "h": 7, "value": "{{barcode}}", "symbology": "UPC_A", "module": 2 }
  ]
}
```

Check it before saving: `validateDesign(design)` returns `null` or the first problem, using the
same limits a server should enforce (size 5 to 300 mm, 203/300/600 dpi, at most 300 elements,
elements near the label, logos that match their size).

## Preview is the print

```js
const ld = require('retail-print-kit/label-design');
await ld.ensureLabelFonts('/assets/label-fonts/');       // where you serve dist/label-fonts
const data = ld.labelDataFromItem(item, { storeName: 'Main Street Market' });
const warnings = ld.drawLabel(canvas, design, data, { ppm: 8 }); // text cut, shrunk, missing UPC
ld.drawPrinterView(canvas, design, data);                 // black and white, at the printer's dots
```

`drawLabel` and the print path share the same drawing code, so what the screen shows in printer
view is what the printer gets, dot for dot.

## Print

```js
const rasterize = ld.createRasterizer();                  // in Node pass { canvasFactory } from @napi-rs/canvas
const language = ld.languageForPrinter('Zebra');          // 'zpl'; anything else is 'ezpl'
const bytes = ld.encodeDesignLabel(design, language, data, rasterize, { x: 0, y: 0 });
// send bytes to port 9100, a CUPS queue or USB
```

Barcodes, lines and boxes go as the printer's own commands. Text in designer fonts, prices, QR
codes and logos are drawn and sent as graphics. A printer offset in dots moves the whole label when
a printer cuts off an edge.

## Built-in layouts

Eleven classic shelf-label layouts (2 x 1, 2.25 x 1.25, 2.5 x 1, 1.25 x 1, 1.2 x 0.85, single and
dual price, and 3.5 x 1.25) print with the printer's own fonts:

```js
const t = ld.findBuiltinTemplate('2.25 X 1.25', 'dual', 'zpl');
ld.encodeBuiltinLabel(t, 'zpl', ld.labelDataFromItem(item, { limits: t.printers.zpl.limits }));
const editable = ld.designFromBuiltin(t, 'zpl');         // prints the same until someone changes it
```
