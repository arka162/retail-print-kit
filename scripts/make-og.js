#!/usr/bin/env node
'use strict';
/* Draws site/og.png (1200x630), used for link previews and as the GitHub social preview. */
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

const c = createCanvas(1200, 630);
const x = c.getContext('2d');
x.fillStyle = '#111827';
x.fillRect(0, 0, 1200, 630);
x.fillStyle = '#ffffff';
x.font = 'bold 84px sans-serif';
x.fillText('retail-print-kit', 70, 170);
x.fillStyle = '#d1d5db';
x.font = '38px sans-serif';
x.fillText('Receipt, cash drawer and label printing', 70, 250);
x.fillText('for Node.js and Electron', 70, 300);
x.fillStyle = '#f87171';
x.font = '30px sans-serif';
x.fillText('ESC/POS  ·  Star  ·  ZPL  ·  TSPL  ·  EZPL', 70, 390);
x.fillStyle = '#9ca3af';
x.font = '28px monospace';
x.fillText('npm install retail-print-kit', 70, 540);

x.fillStyle = '#ffffff';
x.fillRect(820, 90, 300, 450);
x.fillStyle = '#111827';
x.font = 'bold 30px monospace';
x.textAlign = 'center';
x.fillText('MY STORE', 970, 145);
x.font = '18px monospace';
x.textAlign = 'left';
const rows = [['Coffee, large', '$5.00'], ['Bagel', '$7.50'], ['Tax', '$1.03']];
rows.forEach((r, i) => { x.fillText(r[0], 845, 200 + i * 30); x.textAlign = 'right'; x.fillText(r[1], 1095, 200 + i * 30); x.textAlign = 'left'; });
x.fillRect(845, 300, 250, 2);
x.font = 'bold 22px monospace';
x.fillText('TOTAL', 845, 335);
x.textAlign = 'right';
x.fillText('$13.53', 1095, 335);
for (let i = 0; i < 60; i++) if ((i * 7 + (i >> 2)) % 3 !== 0) x.fillRect(850 + i * 4, 380, 3, 80);
x.textAlign = 'center';
x.font = '16px monospace';
x.fillText('036000291452', 970, 485);

fs.writeFileSync(path.join(__dirname, '..', 'site', 'og.png'), c.toBuffer('image/png'));
console.log('wrote site/og.png');
