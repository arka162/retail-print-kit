---
title: Design receipt and label templates visually, then print them from Node.js
description: A free browser-based receipt and label designer that exports JSON templates. Bind data with placeholders, loop over line items, add conditions, logos, QR codes and barcodes, and print with retail-print-kit.
---
# Design receipt and label templates visually, then print them from Node.js

Hard-coding a receipt as a chain of `text()` calls means a code change every time a store wants a
different footer. A template moves the layout into JSON that your app stores and edits.

**[Open the designer](https://arka162.github.io/retail-print-kit/designer/)** to build one in the
browser: add blocks, edit properties, see the live preview against sample data, and export JSON.
It runs entirely in the page; nothing is uploaded.

## A receipt template

```js
const template = {
  name: 'receipt', version: 1,
  blocks: [
    { type: 'text', value: '{{store.name | upper}}', align: 'center', style: 'b', size: [2, 2] },
    { type: 'text', value: '{{date | date:datetime}}   #{{id}}', align: 'center' },
    { type: 'line' },
    { type: 'table', rows: 'items', columns: [
      { value: '{{name}}', header: 'Item', width: 0.6 },
      { value: '{{qty}}', header: 'Qty', width: 0.1, align: 'CENTER' },
      { value: '{{total | money:$}}', header: 'Amount', width: 0.3, align: 'RIGHT' },
    ] },
    { type: 'line' },
    { type: 'row', cells: [{ value: 'TOTAL', width: 0.7 }, { value: '{{total | money:$}}', width: 0.3, align: 'RIGHT' }] },
    { type: 'if', when: 'customer', blocks: [{ type: 'text', value: 'Thank you, {{customer.name}}!' }],
      else: [{ type: 'text', value: 'Thank you!' }] },
    { type: 'each', items: 'notes', blocks: [{ type: 'text', value: '* {{this}}' }] },
    { type: 'qr', value: 'https://example.com/r/{{id}}', align: 'center' },
    { type: 'cut' },
    { type: 'drawer' },
  ],
};
```

## Print it

```js
const { Printer, profiles } = require('retail-print-kit');
const { NetTransport } = require('retail-print-kit/net');

const printer = new Printer(new NetTransport('192.168.1.50'), profiles['epson-tm-t88']);
await printer.open();
printer.render(template, {
  id: 'A1042', date: new Date(), store: { name: 'My Store' },
  items: [{ name: 'Coffee', qty: 2, total: 5 }], total: 5, notes: ['No refunds on food'],
});
await printer.close();
```

The same template fits 80 mm and 58 mm paper, because column widths are fractions of the line and
the profile supplies the column count.

## Blocks

| Block | Purpose |
|---|---|
| `text` | A line with `align`, `style`, `size`, `font` |
| `line` | A rule across the paper |
| `row` | One line split into cells |
| `table` | A header and one row per item of an array |
| `image` | A logo or picture |
| `qr`, `barcode` | Codes with placeholders in the value |
| `each` | Repeat blocks for each item of an array |
| `if` | Show blocks when a value is present, with optional `else` |
| `feed`, `newline`, `cut`, `drawer` | Paper and drawer control |

## Placeholders and filters

`{{path}}` reads from the data, with dots for nesting. Inside `each` and `table`, `{{this}}`,
`{{@index}}` and `{{@number}}` refer to the current item.

| Filter | Example | Result |
|---|---|---|
| `money` | `{{total \| money:$}}` | `$12.50` |
| `fixed` | `{{weight \| fixed:3}}` | `1.250` |
| `upper`, `lower`, `trim` | `{{name \| upper}}` | `COFFEE` |
| `date` | `{{date \| date:datetime}}` | local date and time |
| `default` | `{{note \| default:none}}` | `none` when empty |
| `pad`, `padEnd` | `{{qty \| pad:3}}` | right-aligned in 3 columns |
| `count` | `{{items \| count}}` | number of items |

## Preview in your own app

```js
const { render, opsToHtml, profiles } = require('retail-print-kit');
const html = opsToHtml(render(template, data, profiles['epson-tm-t88']), profiles['epson-tm-t88']);
```

In the browser import from `retail-print-kit/browser`.

## Label templates

The designer has a label mode with drag-to-position:
[open it](https://arka162.github.io/retail-print-kit/designer/?kind=label), and see
[printing labels](./zpl-tspl-ezpl-label-printing-nodejs.md).

## From the command line

```
npx retail-print-kit print --template receipt.json --data sale.json --net 192.168.1.50
npx retail-print-kit print --template receipt.json --data sale.json --out preview.html
```
