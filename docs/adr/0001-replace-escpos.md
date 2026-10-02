# ADR 0001: Build `thermal-print` to replace the `escpos` package

Status: accepted. Date: 2026-10-02. Owner: Arkaprova Majumder.

## Context

The Electron POS prints receipts, closing reports, order tickets and kicks the cash drawer through
`escpos` 2.5.2 and `escpos-usb` 3.0.0-alpha.4. Both have been unmaintained for years, and the USB
package leaks a global `detach` listener that has to be patched after every install. Each print path
builds its own transport, the serial port name is hard-coded, and there is no notion of which printer
model is attached, so cut, drawer pulse and code page are guessed. The POS already has a separate raw
TCP (:9100) path and an IPP path for non-receipt printing.

The next markets add printers that are not ESC/POS at all (Star TSP100 is Star graphic mode) and
printers that need different cut, pulse and code page settings.

## Decision

Write a new package, `thermal-print`, owned and published by Arkaprova Majumder (MIT), with:

1. **A pure-JavaScript core.** A receipt is a list of operations (`Op`). An `Encoder` turns ops into
   bytes using a `Profile`. No native dependency in the core, so it runs in Node, Electron main and
   tests alike, and the bytes can be checked without a printer.
2. **Profiles describe printers, not code paths.** A profile carries the command set
   (`escpos` | `star-line` | `star-graphic`), paper width, columns per font, code page, cut
   command, drawer pins and pulse timing, and which features exist (native QR, raster images,
   status query). Call sites never branch on model names.
3. **Transports only move bytes.** `Transport` has `open`, `write`, `read`/status and `close`.
   Network (raw TCP) is in the core with no dependencies. USB and serial are subpath exports with
   `usb` and `serialport` as optional peer dependencies, so a host that only prints over the
   network never installs native modules.
4. **A compatibility builder.** `Printer` exposes the method names the POS already uses
   (`text`, `style`, `size`, `align`, `font`, `feed`, `cut`, `cashdraw`, `newLine`, `tableCustom`,
   `drawLine`, `qrimage`, `barcode`, `open`, `close`) so migration is a transport swap, not a
   rewrite. The builder records ops; nothing is sent until `close()` or `flush()`.
5. **Golden byte tests.** Every profile has snapshot tests of the exact bytes for a fixed receipt.
   Real hardware is for sign-off only.

## Consequences

* The POS migrates one IPC handler at a time, starting with the smallest (`drawer:open`).
* Star graphic-mode printers need a renderer (text to bitmap). That is a later milestone; the op
  model already allows it because ops are not ESC/POS bytes.
* Windows, Linux and macOS are supported by design in the transports; Linux registers are tested
  first because that is what ships.
* The package contains no POS business logic. Receipt layout stays in the host application.

## Alternatives rejected

* **Fork `escpos`.** Its design mixes transport and commands and has no printer model concept.
* **`node-thermal-printer`.** Closer to what we need, but still a single builder with model `if`s,
  no status, and drags its own transport choices along.
* **Print everything as PDF over IPP.** Works for office printers, not for drawer kick, partial cut
  or the speed a till needs.
