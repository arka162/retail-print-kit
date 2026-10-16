const fs = require('node:fs');
const path = require('node:path');

const from = path.join(__dirname, '..', 'assets', 'label-fonts');
const to = path.join(__dirname, '..', 'dist', 'label-fonts');
fs.mkdirSync(to, { recursive: true });
for (const file of fs.readdirSync(from)) fs.copyFileSync(path.join(from, file), path.join(to, file));
