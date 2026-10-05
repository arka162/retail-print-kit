#!/usr/bin/env node
'use strict';
/* Builds the static site (landing page, guides, designer, sitemap, llms.txt) into site-dist/. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'site-dist');
const BASE = 'https://arka162.github.io/retail-print-kit';
const REPO = 'https://github.com/arka162/retail-print-kit';
const pkg = require(path.join(ROOT, 'package.json'));
const today = new Date().toISOString().slice(0, 10);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');

function inline(text) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s)
    .replace(/\\\|/g, '|')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${attr(href.replace(/^\.\/([\w-]+)\.md/, '$1.html'))}">${label}</a>`);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)].replace(/\\\|/g, '|'))}</code>`);
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
}

function markdown(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(`<pre><code${lang ? ` class="language-${attr(lang)}"` : ''}>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const id = h[2].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${h[1].length} id="${id}">${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (/^\|/.test(line) && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(splitRow(lines[i++]));
      out.push(`<table><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`);
      continue;
    }
    const list = /^(\*|-|\d+\.)\s+/.exec(line);
    if (list) {
      const tag = /\d/.test(list[1]) ? 'ol' : 'ul';
      const items = [];
      while (i < lines.length && /^(\*|-|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i].replace(/^(\*|-|\d+\.)\s+/, '');
        i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(`<li>${inline(item)}</li>`);
      }
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|\||(\*|-|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

function frontMatter(src) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(src);
  const meta = {};
  if (m) for (const l of m[1].split('\n')) { const k = l.indexOf(':'); if (k > 0) meta[l.slice(0, k).trim()] = l.slice(k + 1).trim(); }
  return { meta, body: m ? src.slice(m[0].length) : src };
}

function page({ title, description, urlPath, body, depth, jsonLd }) {
  const up = '../'.repeat(depth);
  const url = `${BASE}/${urlPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="retail-print-kit">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="${up}site.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<header class="site"><div class="in">
  <a class="brand" href="${up || './'}">retail-print-kit</a>
  <nav><a href="${up}guides/">Guides</a><a href="${up}designer/">Designer</a><a href="https://www.npmjs.com/package/retail-print-kit">npm</a><a href="${REPO}">GitHub</a></nav>
</div></header>
<main>
${body}
</main>
<footer class="site"><div class="in">retail-print-kit ${pkg.version} · MIT license · <a href="${REPO}">source</a> · <a href="${REPO}/issues">issues</a> · <a href="${up}llms.txt">llms.txt</a></div></footer>
</body>
</html>
`;
}

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

fs.rmSync(OUT, { recursive: true, force: true });

const guideDir = path.join(ROOT, 'docs', 'guides');
const ORDER = [
  'print-receipt-nodejs', 'electron-receipt-printing', 'open-cash-drawer-nodejs', 'star-tsp100-nodejs',
  'zpl-tspl-ezpl-label-printing-nodejs', 'receipt-template-designer', 'print-qr-code-barcode-receipt',
  'print-logo-image-thermal-printer', 'network-printer-discovery-status', 'escpos-node-thermal-printer-alternative',
];
const guides = fs.readdirSync(guideDir).filter((f) => f.endsWith('.md')).map((f) => {
  const slug = f.replace(/\.md$/, '');
  const { meta, body } = frontMatter(fs.readFileSync(path.join(guideDir, f), 'utf8'));
  if (!meta.title || !meta.description) throw new Error(`${f}: title and description are required`);
  return { slug, title: meta.title, description: meta.description, body };
}).sort((a, b) => (ORDER.indexOf(a.slug) + 100) % 100 - (ORDER.indexOf(b.slug) + 100) % 100 || a.slug.localeCompare(b.slug));

const cards = (prefix) => `<ul class="cards">${guides.map((g) => `<li><a href="${prefix}${g.slug}.html">${esc(g.title)}</a><span>${esc(g.description)}</span></li>`).join('')}</ul>`;

for (const g of guides) {
  write(`guides/${g.slug}.html`, page({
    title: `${g.title} | retail-print-kit`,
    description: g.description,
    urlPath: `guides/${g.slug}.html`,
    depth: 1,
    body: markdown(g.body) + `\n<h2>Install</h2>\n<pre><code>npm install retail-print-kit</code></pre>\n<p><a href="./">All guides</a> · <a href="../designer/">Designer</a> · <a href="https://www.npmjs.com/package/retail-print-kit">npm</a> · <a href="${REPO}">GitHub</a></p>`,
    jsonLd: { '@context': 'https://schema.org', '@type': 'TechArticle', headline: g.title, description: g.description, url: `${BASE}/guides/${g.slug}.html`, dateModified: today, author: { '@type': 'Person', name: 'Arkaprova Majumder' }, about: { '@type': 'SoftwareSourceCode', name: 'retail-print-kit', codeRepository: REPO, programmingLanguage: 'TypeScript' } },
  }));
}

write('guides/index.html', page({
  title: 'Guides: thermal receipt, cash drawer and label printing from Node.js | retail-print-kit',
  description: 'How-to guides for printing receipts, opening cash drawers and printing labels from Node.js and Electron with retail-print-kit: ESC/POS, Star, ZPL, TSPL, EZPL.',
  urlPath: 'guides/',
  depth: 1,
  body: `<h1>Guides</h1>\n<p class="lead">Task-by-task instructions for receipt printers, cash drawers and label printers from Node.js and Electron.</p>\n${cards('')}`,
  jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'retail-print-kit guides', url: `${BASE}/guides/` },
}));

write('index.html', page({
  title: 'retail-print-kit: ESC/POS thermal receipt, cash drawer and label printing for Node.js and Electron',
  description: pkg.description,
  urlPath: '',
  depth: 0,
  body: fs.readFileSync(path.join(ROOT, 'site', 'landing.html'), 'utf8').replace('<!--GUIDES-->', cards('guides/')),
  jsonLd: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'retail-print-kit', applicationCategory: 'DeveloperApplication', operatingSystem: 'Windows, macOS, Linux', softwareVersion: pkg.version, description: pkg.description, url: BASE + '/', downloadUrl: 'https://www.npmjs.com/package/retail-print-kit', codeRepository: REPO, license: 'https://opensource.org/licenses/MIT', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: { '@type': 'Person', name: 'Arkaprova Majumder' } },
}));

const verification = fs.readdirSync(path.join(ROOT, 'site')).filter((f) => /^google[0-9a-f]+\.html$/.test(f));
for (const f of ['site.css', 'robots.txt', 'og.png', ...verification]) {
  const src = path.join(ROOT, 'site', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, f));
}

const designerSrc = path.join(ROOT, 'apps', 'designer');
for (const target of ['designer', 'apps/designer']) {
  for (const f of fs.readdirSync(designerSrc)) {
    let content = fs.readFileSync(path.join(designerSrc, f));
    if (f === 'index.html' && target === 'designer') content = Buffer.from(content.toString().replace('../../dist/browser/', '../dist/browser/'));
    write(`${target}/${f}`, content);
  }
}
const bundleDir = path.join(ROOT, 'dist', 'browser');
if (!fs.existsSync(bundleDir)) throw new Error('run `npm run build` first: dist/browser is missing');
for (const f of fs.readdirSync(bundleDir)) write(`dist/browser/${f}`, fs.readFileSync(path.join(bundleDir, f)));

const indexNowKey = fs.readFileSync(path.join(ROOT, 'site', 'indexnow-key.txt'), 'utf8').trim();
write(`${indexNowKey}.txt`, indexNowKey);

const urls = ['', 'guides/', ...guides.map((g) => `guides/${g.slug}.html`), 'designer/'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${BASE}/${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);

const RAW = 'https://raw.githubusercontent.com/arka162/retail-print-kit/main';
write('llms.txt', `# retail-print-kit

> Open source npm package (MIT) for printing from Node.js and Electron to ESC/POS thermal receipt printers (Epson and compatibles), Star printers (Line Mode and the raster-only TSP100 / TSP143), cash drawers, and ZPL / TSPL / EZPL label printers, over USB, network (TCP 9100) or serial. Includes JSON receipt and label templates, HTML / PNG / SVG previews, printer status and discovery, a browser-based designer and a CLI. Install with \`npm install retail-print-kit\`. Current version ${pkg.version}.

Key facts:
- Import: \`const { Printer, profiles } = require('retail-print-kit')\`; transports from \`retail-print-kit/net\`, \`/usb\`, \`/serial\`; browser build from \`retail-print-kit/browser\`.
- Builder methods match the \`escpos\` package: text, align, style, size, feed, cut, cashdraw, tableCustom, drawLine, barcode, qr.
- Profile ids: epson-tm-t88, epson-tm-t20, epson-tm-m30, generic-escpos, generic-escpos-58, star-tsp650, star-mc-print3, star-tsp100.
- A plain install adds 4 packages and no native modules; \`usb\`, \`serialport\` and \`@napi-rs/canvas\` are optional.

## Guides

${guides.map((g) => `- [${g.title}](${RAW}/docs/guides/${g.slug}.md): ${g.description}`).join('\n')}

## Reference

- [README with API overview](${RAW}/README.md): install, quick start, templates, labels, CLI
- [Printer and drawer matrix](${RAW}/docs/printer-matrix.md): models, command sets and what has been run on hardware
- [Hardware checklist](${RAW}/docs/hardware-checklist.md): verification steps and known unverified items
- [Changelog](${RAW}/CHANGELOG.md)

## Links

- [npm package](https://www.npmjs.com/package/retail-print-kit)
- [Source on GitHub](${REPO})
- [Receipt and label designer](${BASE}/designer/)
`);
write('llms-full.txt', `# retail-print-kit ${pkg.version}: full documentation\n\n` + fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8') + '\n\n' + guides.map((g) => g.body.trim()).join('\n\n---\n\n') + '\n');

console.log(`site-dist: ${urls.length} pages, ${guides.length} guides`);
