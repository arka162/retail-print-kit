const fs = require('node:fs');
const path = require('node:path');

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/gen-label-builtins.js <builtins.json>');
  process.exit(1);
}
const layouts = JSON.parse(fs.readFileSync(source, 'utf8'));
const out = path.join(__dirname, '..', 'src', 'label-design', 'builtins-data.ts');
const body = [
  "import { BuiltinTemplate } from './types';",
  '',
  `export const BUILTIN_TEMPLATES: BuiltinTemplate[] = ${JSON.stringify(layouts, null, 2)};`,
  ''
].join('\n');
fs.writeFileSync(out, body);
console.log(`${layouts.length} built-in templates written to ${path.relative(process.cwd(), out)}`);
