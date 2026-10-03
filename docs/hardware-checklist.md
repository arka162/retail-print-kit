# Hardware checklist

Run on each printer and note the result. One row per printer in the table at the bottom.

## Receipt printers

```
npx retail-print-kit discover --identify
npx retail-print-kit identify --net <ip>
npx retail-print-kit verify --net <ip> --profile <id> --drawer
```

Use `--usb` or `--serial <port>` instead of `--net` when the printer is not on the network.

| Check | What to look for |
|---|---|
| V1 | Font A ruler ends at the right edge on one line (no wrap, no gap). |
| V2 | Font B ruler ends at the right edge on one line. |
| V3 | Bold, underline, double width, double height and inverse all visible. |
| V4 | "left", "centre", "right" sit at the left, middle and right. |
| V5 | Rows B0..DF show box-drawing characters (CP437). Anything else: note what appears. |
| V6 | Four barcodes print and scan: UPC-A, EAN-13, CODE128, CODE39. |
| V7 | QR A (native) and QR B (bitmap) both scan to the same URL and are about the same size. |
| V8 | Checkerboard squares are sharp; the diagonal is one clean line. |
| V9 | Paper is cut leaving a small tab (partial cut). |
| V10 | Paper is cut clean through (full cut). |
| V11 | Drawer opens on the first kick (pin 2). Second kick (pin 5) opens a second drawer if wired. |
| Status | The JSON printed in the terminal shows `online: true`; open the cover and run `status` again: `coverOpen: true`. |
| Identify | Maker and model match the unit; the suggested profile is sensible. |

### Known unverified items

* **Star TSP100 / TSP143** (`star-tsp100`): the cut mode bytes at V9 / V10 (`ESC * r E 1` full, `2` partial).
* **Star Line Mode** (`star-tsp650`, `star-mc-print3`): status bit positions (cover, paper, offline).
* **Clones** (`generic-escpos`): whether `GS V 0/1` cuts, and whether the 120 ms drawer pulse opens the drawer.

## Label printers

```
npx retail-print-kit verify-label --language zpl  --net <ip>
npx retail-print-kit verify-label --language tspl --net <ip>
npx retail-print-kit verify-label --language ezpl --net <ip>
```

Add `--width-mm` and `--height-mm` for stock other than 50.8 x 25.4 mm.

| Check | What to look for |
|---|---|
| Frame | A 2-dot box hugs the label edge on all four sides. |
| L1, L2 | Two text lines, the second clearly larger; neither clipped. |
| Barcode | UPC-A scans; digits print under it. |
| QR | Scans to the repository URL. |
| Bar | A solid bar near the bottom edge. |
| Language | The language name prints bold at bottom right. |

### Known unverified items

* **EZPL** (Godex): internal font letter per text height (`A`..`H`), QR command syntax, barcode letters other than UPC-A.
* **TSPL**: scalable font `"0"` sizing, QR syntax on clone firmware.

## Results

| Date | Printer | Connection | Profile / language | Passed | Failed (with notes) | Tester |
|---|---|---|---|---|---|---|
| | | | | | | |
