# retail-print-kit

Receipt printer and cash drawer driver for Node and Electron. ESC/POS and Star command sets,
printer profiles, USB / network / serial transports, no native dependency in the core.

Status: early development. Not published yet.

* Receipt command sets: ESC/POS (Epson and compatibles), Star Line Mode (TSP650 / mC-Print), Star raster (TSP100 / TSP143).
* Label languages: ZPL (Zebra), TSPL (TSC, Xprinter, Rongta), EZPL (Godex).
* Browser bundle (`retail-print-kit/browser`) with templates, previews and label encoders; a designer app in `apps/designer`.
* Transports: `retail-print-kit/net` (raw TCP :9100, no deps), `retail-print-kit/usb` (needs `usb`), `retail-print-kit/serial` (needs `serialport`).
* QR: native where the printer has it, bitmap fallback otherwise. Images: 1-bit `Bitmap` from RGBA.
* Status: `printer.status()` reads ESC/POS DLE EOT (online, cover, paper, cutter, drawer pin).
* Bitmap-only printers render through a canvas (`@napi-rs/canvas`, or pass your own factory in Electron).

```js
const { Printer, profiles } = require('retail-print-kit');
const { NetTransport } = require('retail-print-kit/net');

const printer = new Printer(new NetTransport('192.168.1.50'), profiles.epsonTmT88);
await printer.open();
printer
  .align('ct').style('b').size(2, 2).text('MY STORE')
  .size(1, 1).style('normal').align('lt')
  .tableCustom([{ text: 'Coffee', align: 'LEFT', width: 0.7 }, { text: '$2.50', align: 'RIGHT', width: 0.3 }])
  .drawLine()
  .feed(2).cut().cashdraw();
await printer.close();
```

## Templates

A receipt can be a JSON layout rendered with data, which is what a visual designer will produce:

```js
const { render } = require('retail-print-kit');
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
printer.render(template, data);          // appends to a Printer
const ops = render(template, data, profiles.epsonTmT88); // or just the ops
```

Blocks: `text`, `line`, `row`, `table`, `feed`, `newline`, `cut`, `drawer`, `qr`, `barcode`, `each`, `if`.
Values use `{{path | filter}}`; filters: `upper`, `lower`, `trim`, `money[:prefix]`, `fixed[:n]`,
`pad:n`, `padEnd:n`, `default:x`, `date[:time|datetime]`, `count`. Inside `each`/`table` rows, `this`,
`@index` and `@number` refer to the current item.

## Labels

Labels are positioned elements on a fixed page, encoded for Zebra (ZPL), TSC and clones (TSPL) or
Godex (EZPL). Positions are in dots at the label's dpi; `mm()` converts.

```js
const { LabelBuilder, encodeZpl, encodeTspl, encodeEzpl, labelToSvg, renderLabel } = require('retail-print-kit');
const b = new LabelBuilder({ widthMm: 50.8, heightMm: 25.4, dpi: 203 });
b.text(18, 14, 'Coffee Beans 1lb', 26).text(92, 65, '$12.99', 85, { bold: true })
 .barcode(35, 140, '036000291452', 'UPC_A', 35).qr(330, 20, 'https://x.io/i/1', { module: 3 });
const zpl = encodeZpl(b.label);          // string
const svg = labelToSvg(b.label);         // preview
const label = renderLabel(labelTemplate, data); // from a designer JSON
```

## Designer

`apps/designer/index.html` is a browser app (no build, no server) that edits receipt and label
templates with a live preview, drag-to-position for labels, sample data, and exports the JSON that
`render()` / `renderLabel()` and the CLI's `print --template` consume. Open it after `npm run build`.

## Preview and identify

```js
printer.toHtml();                               // paper-like HTML of the recorded ops
opsToHtml(ops, profile); opsToPng(ops, profile); // same without a Printer (PNG needs a canvas)
const id = await identify(transport);           // { maker, model, firmware, set, profile }
profileForUsb(0x04b8);                          // profile from a USB vendor/product id
```

## CLI

```
npx retail-print-kit test --net 192.168.1.50 --profile epson-tm-t20   # test page + status
npx retail-print-kit drawer --usb                                     # kick the drawer
npx retail-print-kit status --serial /dev/ttyUSB0
npx retail-print-kit identify --net 192.168.1.50                      # maker/model/firmware + suggested profile
npx retail-print-kit preview --profile star-tsp100 --out page.png     # or .html, no printer needed
npx retail-print-kit print --template receipt.json --data sale.json --net 192.168.1.50
npx retail-print-kit print --template shelf.json --data item.json --language zpl --net 192.168.1.60
npx retail-print-kit profiles
npx retail-print-kit test --dry --profile star-tsp100 | head -c 200   # bytes only, no printer
```

Docs: [ADR 0001](docs/adr/0001-replace-escpos.md), [printer matrix](docs/printer-matrix.md).

License: MIT, Arkaprova Majumder.
