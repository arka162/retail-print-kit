# Changelog

## 0.4.0 (2026-10-23)

* `retail-print-kit/label-design`: a **Store spot** field (`{{spot}}`, from the item's `spot`) for the item's main spot in the store, such as `A05-B2-S3`. Empty when the item has none, so `when: 'spot'` hides it. Built-in layouts do not use it and print the same bytes.

## 0.3.1 (2026-10-17)

* `<rpk-label-designer>`: a clearer left bar. The search field keeps its full height and matches the other inputs, item fields and basic elements show icons, sections show their counts, the drag tip sits in its own box and layers show the element icon with an accent bar on the selected one. The left bar is a little wider so field names are not cut.

## 0.3.0 (2026-10-17)

* `retail-print-kit/label-design`: label designs in millimetres (design JSON version 1) with validation, one canvas renderer for screen and print, an EZPL/ZPL encoder (printer-font elements as native commands, designer fonts, QR codes and logos as graphics), printer offsets, eleven built-in shelf-label layouts and the fonts with their licences in `dist/label-fonts/`.
* `retail-print-kit/label-designer`: the `<rpk-label-designer>` Web Component (palette, drag and resize, guides, undo/redo, properties, logo upload, printer view, check against real items) and `<rpk-label-preview>`. Defined only in a browser; requiring it in Node does nothing.
* `typesVersions` so TypeScript projects using `moduleResolution: node` find the types of every subpath.
* Guide on the website: shelf labels from a label design.

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
