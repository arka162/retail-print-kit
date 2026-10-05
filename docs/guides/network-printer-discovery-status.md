---
title: Find receipt printers on the network and read their status from Node.js
description: Discover ESC/POS printers on the local network, identify the maker and model, and read paper-out, cover-open, cutter-error and cash drawer status from Node.js.
---
# Find receipt printers on the network and read their status from Node.js

## Discover printers

```js
const { discoverNetworkPrinters } = require('retail-print-kit');

const printers = await discoverNetworkPrinters({ identify: true });
for (const p of printers) {
  console.log(p.host, p.identity?.maker, p.identity?.model, p.identity?.profile?.id);
}
// 192.168.1.50 EPSON TM-T88V epson-tm-t88
```

It sweeps every private /24 network the machine is on for hosts that accept connections on port
9100 (raw printing), about two seconds per network. With `identify: true` it asks each one what it
is and suggests a profile. Options: `port`, `timeout`, `concurrency`, `subnets`.

From the command line:

```
npx retail-print-kit discover --identify
```

## Identify one printer

```js
const { identify } = require('retail-print-kit');
const { NetTransport } = require('retail-print-kit/net');

const t = new NetTransport('192.168.1.50');
await t.open();
const id = await identify(t);   // { maker, model, firmware, set, profile }
await t.close();
```

ESC/POS printers answer `GS I` with their maker, model and firmware. A printer that stays silent
but answers a Star status request is reported as Star Line Mode.

For USB, the vendor id is enough to pick a starting profile before sending anything:

```js
const { profileForUsb } = require('retail-print-kit');
profileForUsb(0x04b8).id;          // 'epson-tm-t88'
profileForUsb(0x0519, 0x0001).id;  // 'star-tsp100'
```

## Read status: paper out, cover open, drawer

```js
const printer = new Printer(new NetTransport('192.168.1.50'), profiles['epson-tm-t88']);
await printer.open();
const s = await printer.status();
await printer.close();

if (!s.online) console.log('printer is offline');
if (s.coverOpen) console.log('cover is open');
if (s.paperOut) console.log('out of paper');
if (s.paperNearEnd) console.log('paper is running low');
if (s.cutterError) console.log('cutter jam');
```

| Field | Meaning |
|---|---|
| `online` | The printer is ready to print |
| `coverOpen` | The paper cover is open |
| `paperOut`, `paperNearEnd` | Paper sensors |
| `cutterError` | The auto cutter is jammed |
| `recoverableError`, `unrecoverableError` | Error class reported by the printer |
| `drawerPinHigh` | Level of the cash drawer sensor pin |
| `supported` | `false` when the command set has no status query (Star raster) |

Status uses the ESC/POS real-time commands `DLE EOT 1..4`, and `ESC ACK SOH` on Star Line Mode. It
works over the network, USB and serial. Check status before a long print job rather than after:
a printer with its cover open accepts the bytes and prints nothing.

```
npx retail-print-kit status --net 192.168.1.50
```

Related: [print a receipt](./print-receipt-nodejs.md).
