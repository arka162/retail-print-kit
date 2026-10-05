---
title: Open a cash drawer from Node.js or Electron
description: Kick a cash drawer connected to a receipt printer from Node.js with one call. Works with Epson ESC/POS, Star and compatible printers over USB, network or serial, including pin 2 and pin 5 drawers.
---
# Open a cash drawer from Node.js or Electron

Most cash drawers (APG, MMF, Star, Epson) have no connection to the computer. They plug into the
receipt printer's RJ11/RJ12 "DK" port, and the printer fires the solenoid when it receives a kick
command. So opening the drawer means sending a few bytes to the printer.

```js
const { Printer, profiles } = require('retail-print-kit');
const { NetTransport } = require('retail-print-kit/net');

async function openDrawer() {
  const printer = new Printer(new NetTransport('192.168.1.50'), profiles['epson-tm-t88'], { initOnOpen: false });
  await printer.open();
  printer.cashdraw();      // pin 2, the usual wiring
  await printer.close();
}
```

USB works the same with `new UsbTransport()` from `retail-print-kit/usb`.

## Pin 2 and pin 5

One printer can drive two drawers. `cashdraw()` or `cashdraw(2)` kicks the first, `cashdraw(5)`
the second. If nothing happens on pin 2, the drawer cable may be wired for pin 5.

## The right pulse for the printer

The command differs by printer family, and so does the pulse length a drawer needs. The profile
takes care of it:

| Family | What is sent |
|---|---|
| Epson and ESC/POS compatibles | `ESC p m t1 t2` with the profile's on/off times |
| Star Line Mode and Star raster | `ESC BEL n1 n2` then `BEL` (drawer 1) or `SUB` (drawer 2) |

If a cheap drawer does not open reliably, use the `generic-escpos` profile (longer pulse) or kick
twice: `printer.cashdraw().cashdraw()`.

## Open the drawer after printing

```js
printer.text('Thank you').cut().cashdraw();
await printer.close();
```

## Is the drawer open?

```js
const status = await printer.status();
console.log(status.drawerPinHigh);
```

`drawerPinHigh` is the level of the drawer sensor pin. Whether high means open or closed depends
on the drawer, so check once with yours.

## From the command line

```
npx retail-print-kit drawer --net 192.168.1.50
npx retail-print-kit drawer --usb --pin 5
```

Related: [print a receipt](./print-receipt-nodejs.md), [Electron](./electron-receipt-printing.md).
