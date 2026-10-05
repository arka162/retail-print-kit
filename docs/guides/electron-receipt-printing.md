---
title: Print receipts from an Electron app to a thermal printer
description: Silent receipt printing from Electron to ESC/POS and Star thermal printers without the OS print dialog, using retail-print-kit in the main process with IPC from the renderer.
---
# Print receipts from an Electron app to a thermal printer

`webContents.print()` goes through the operating system's print dialog and driver, which is slow,
cannot kick a cash drawer, and cannot do a partial cut. A point of sale app wants raw printer
commands sent straight to the device. `retail-print-kit` does that from Electron's main process.

## Install

```
npm install retail-print-kit
npm install usb          # only for USB printers
npm install serialport   # only for serial printers
```

The core is pure JavaScript. `usb` and `serialport` are native modules that ship prebuilt N-API
binaries, so they normally load in Electron without a rebuild. If you package with asar, keep them
unpacked (`asarUnpack`) like any other native module.

## Main process

```js
// main.js
const { ipcMain } = require('electron');
const { Printer, profiles } = require('retail-print-kit');
const { NetTransport } = require('retail-print-kit/net');

function transport(settings) {
  if (settings.kind === 'usb') {
    const { UsbTransport } = require('retail-print-kit/usb');
    return new UsbTransport();
  }
  if (settings.kind === 'serial') {
    const { SerialTransport } = require('retail-print-kit/serial');
    return new SerialTransport(settings.port, { baudRate: 9600 });
  }
  return new NetTransport(settings.host);
}

ipcMain.handle('receipt:print', async (event, { settings, template, data }) => {
  const printer = new Printer(transport(settings), profiles[settings.profile]);
  await printer.open();
  printer.render(template, data);
  await printer.close();
  return { ok: true };
});

ipcMain.handle('drawer:open', async (event, settings) => {
  const printer = new Printer(transport(settings), profiles[settings.profile], { initOnOpen: false });
  await printer.open();
  printer.cashdraw();
  await printer.close();
});
```

## Renderer

```js
// preload.js
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pos', {
  printReceipt: (job) => ipcRenderer.invoke('receipt:print', job),
  openDrawer: (settings) => ipcRenderer.invoke('drawer:open', settings),
});
```

```js
// in the page
await window.pos.printReceipt({
  settings: { kind: 'net', host: '192.168.1.50', profile: 'epson-tm-t88' },
  template, // JSON from the designer
  data: { store: { name: 'My Store' }, items: [], total: 12.5 },
});
```

## On-screen receipt preview

The browser build renders the same template to HTML with no printer and no Node APIs:

```js
import { render, opsToHtml, profiles } from 'retail-print-kit/browser';
const ops = render(template, data, profiles['epson-tm-t88']);
previewFrame.srcdoc = opsToHtml(ops, profiles['epson-tm-t88']);
```

## Tips

* Create a `Printer` per job and close it. A USB device left open blocks other processes.
* Catch errors from `open()`: that is where "printer not found" and "connection refused" surface.
* Let the user pick the profile, or suggest one with `identify()`; see
  [finding printers and reading status](./network-printer-discovery-status.md).

Related: [receipt templates and the designer](./receipt-template-designer.md),
[cash drawer](./open-cash-drawer-nodejs.md).
