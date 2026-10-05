# Changelog

## 0.2.3 (2026-10-05)

* Website with a landing page and ten task guides (receipts, Electron, cash drawer, Star TSP100, labels, templates, QR and barcodes, logos, discovery and status, migration from escpos / node-thermal-printer).
* The designer moved to `/designer/` on the site; `sitemap.xml`, `robots.txt`, `llms.txt` and `llms-full.txt` are published.
* README: guides and FAQ sections. Package description leads with the printer families.

## 0.2.2 (2026-10-05)

* A plain install is now 4 packages and under 2 MB with no native modules (was 34 packages and 30 MB).
* `@napi-rs/canvas` is an optional peer, as intended; it was being installed for everyone.
* QR codes are generated with the dependency-free `qrcode-generator`; text is encoded as UTF-8.

## 0.2.1 (2026-10-03)

* The repository and the designer address were renamed to `retail-print-kit`; all links follow.

## 0.2.0 (2026-10-03)

* Images and logos: `loadImage` with optional Floyd-Steinberg dithering, `ditherRgba`, `serializeBitmap`, a template `image` block, logo upload in the designer.
* `discoverNetworkPrinters` finds raw-printing hosts on the local networks and can identify each.
* CLI: `verify`, `verify-label`, `discover`, `image`. A hardware checklist documents what to confirm on real units.

## 0.1.0 (2026-10-03)

First release.

* ESC/POS, Star Line Mode and Star raster encoders with printer profiles.
* Network, USB and serial transports; printer status and `identify`.
* Receipt templates, HTML and PNG previews.
* Label printing in ZPL, TSPL and EZPL with an SVG preview and label templates.
* Browser bundle and the template designer.
* CLI: `test`, `drawer`, `status`, `identify`, `preview`, `print`, `profiles`, `list`.
