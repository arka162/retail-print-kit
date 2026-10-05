---
title: Print a logo or image on a thermal receipt printer from Node.js
description: Convert a PNG or JPEG logo to a 1-bit bitmap with optional dithering and print it on ESC/POS and Star thermal printers from Node.js, centred and scaled to the paper width.
---
# Print a logo or image on a thermal receipt printer from Node.js

Thermal printers print one colour: each dot is burned or not. A logo has to be scaled to the paper
width in dots and reduced to black and white first. `loadImage` does both.

## Install

```
npm install retail-print-kit @napi-rs/canvas
```

`@napi-rs/canvas` decodes and scales the image. It is only needed for loading image files.

## Print a logo

```js
const { Printer, profiles, loadImage } = require('retail-print-kit');
const { NetTransport } = require('retail-print-kit/net');

const logo = await loadImage('logo.png', { width: 384 });

const printer = new Printer(new NetTransport('192.168.1.50'), profiles['epson-tm-t88']);
await printer.open();
printer.align('ct').image(logo).newLine().text('MY STORE').cut();
await printer.close();
```

`width` is in dots. An 80 mm printer prints 576 dots across, a 58 mm printer 384. A logo about
two thirds of the paper width usually looks right.

## Threshold or dither

| Option | Use for |
|---|---|
| default (threshold) | Line art, text logos, solid shapes: crisp edges |
| `dither: true` | Photos and logos with gradients: Floyd-Steinberg dithering |
| `threshold: 160` | Make a pale logo print darker (0 to 255, default 128) |

```js
const photo = await loadImage('photo.jpg', { width: 576, dither: true });
```

## Load once, print many times

Loading and scaling takes a few milliseconds; do it at start-up and reuse the bitmap. To store a
logo in a database or a template, serialise it:

```js
const { serializeBitmap, deserializeBitmap } = require('retail-print-kit');
const json = serializeBitmap(logo);          // { width, height, data } with base64 bits
printer.image(deserializeBitmap(json));
```

That JSON is exactly a template `image` block:

```js
{ type: 'image', align: 'center', ...serializeBitmap(logo) }
```

The [designer](https://arka162.github.io/retail-print-kit/designer/) has a logo upload that
produces this block in the browser.

## From raw pixels

If you already have RGBA pixels (from a canvas, sharp or a camera):

```js
const { fromRgba, ditherRgba } = require('retail-print-kit');
const bitmap = ditherRgba(pixels, width, height); // or fromRgba(pixels, width, height, 128)
```

## From the command line

```
npx retail-print-kit image --file logo.png --width 384 --net 192.168.1.50
npx retail-print-kit image --file photo.jpg --width 576 --dither --usb
```

## If the image prints as garbage

The printer is probably not an ESC/POS raster printer. Star printers need a Star profile; see
[Star TSP100](./star-tsp100-nodejs.md). Very old impact printers (Epson TM-U220) cannot print
raster images at all.

Related: [print a receipt](./print-receipt-nodejs.md),
[templates and the designer](./receipt-template-designer.md).
