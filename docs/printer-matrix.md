# Printer and drawer matrix

As of 2026-10-02. "Set" is the command set the profile speaks. Columns are at the default font on
80 mm paper unless noted. "Tested" is hardware we have run; blank means from the vendor manual only.

## USA, first wave

| Model | Set | Paper | Cols | Interface | Drawer | Notes | Tested |
|---|---|---|---|---|---|---|---|
| Epson TM-T88V / VI / VII | escpos | 80 | 42/48 | USB, Ethernet, serial, BT | DK pin 2 and 5 | Reference profile. Native QR `GS ( k`. | |
| Epson TM-T20III | escpos | 80 | 42/48 | USB, Ethernet, serial | DK | Budget T88; same commands. | |
| Epson TM-m30II / m30III | escpos | 80/58 | 42/48 | USB, Ethernet, BT, Wi-Fi | DK | mPOS style; ePOS also available but not needed. | |
| Epson TM-U220 | escpos (impact) | 76 | 33/40 | USB, Ethernet, serial | DK | Kitchen printer; no raster, no QR, two-colour ribbon. | |
| Star TSP143III / TSP100 series | star-graphic | 80 | n/a | USB, LAN, BT | DK (Star pulse) | Text must be rendered to bitmap. Most common Square/Shopify printer. Profile `star-tsp100`; EOT cut-mode bytes need hardware verification. | |
| Star TSP654II / TSP700II | star-line | 80 | 42/48 | USB, LAN, serial | DK | Star Line Mode; ESC/POS emulation can be switched on by DIP/config. Profile `star-tsp650`. | |
| Star mC-Print3 / mC-Print2 | star-line + escpos | 80/58 | 48/32 | USB, LAN, BT, CloudPRNT | DK | Ships in Star mode, ESC/POS selectable. Profile `star-mc-print3`. | |
| Bixolon SRP-350III / SRP-350plusIII | escpos | 80 | 42/48 | USB, Ethernet, serial | DK | Epson-compatible with Bixolon extras. | |
| Citizen CT-S310II / CT-S4000 | escpos | 80 | 42/48 | USB, Ethernet, serial | DK | Epson-compatible. | |
| SNBC BTP-R880NP | escpos | 80 | 42/48 | USB, Ethernet, serial | DK | Epson-compatible, common in C-stores. | |
| POS-X EVO / Xprinter XP-80C and clones | escpos | 80 | 48 | USB, Ethernet, serial | DK | Cheap clones: wrong `GS V` modes, slow raster, code page quirks. Need a "generic-clone" profile. | |
| Rongta RP80 / RP58 | escpos | 80/58 | 48/32 | USB, Ethernet, BT | DK | Clone class. | |
| HPRT TP806 / TP80K | escpos | 80 | 48 | USB, Ethernet, serial | DK | Clone class. | |
| Network receipt printer "N60" (customer unit) | escpos | 80 | 48 | Ethernet :9100 | DK | Already printing raw bytes from the POS. | yes, over :9100 |

## Cash drawers

Drawers are passive: a solenoid on the printer's RJ11/RJ12 "DK" port. The profile owns the pulse.

| Drawer | Port | Pin | Pulse | Notes |
|---|---|---|---|---|
| APG Vasario / Series 100 | RJ12 to printer DK | 2 (some 5) | 24 V, 50 ms on / 250 ms off | Most common in USA. |
| MMF Val-u Line / Advantage | RJ12 | 2 | 24 V | Same wiring as APG. |
| Star CD3 / CD4 | RJ12 | 2 | Star pulse (`ESC BEL` / `BEL`) | Only on Star printers. |
| Epson DM-D / generic Epson | RJ12 | 2 and 5 | `ESC p m t1 t2` | Two drawers on one printer use pin 2 and pin 5. |
| USB-triggered drawers (APG USBPro) | USB HID | n/a | vendor command | Out of scope for v1. |

## India, second wave (not yet profiled)

Epson TM-T82 / TM-T82X, TVS-E RP 3160 Gold / RP 3200, Xprinter and Everycom 58 mm units, Posiflex
PP-8800, Wep. All ESC/POS; 58 mm paper and Indian Rupee glyphs (code page / UTF-8 handling) are the
work.

## Out of scope

Label printers (Zebra ZPL, TSC TSPL, Brother), kitchen video, PDF/IPP office printing, Bluetooth
Low Energy on mobile.
