/**
 * After `vite build`, copy the Chrome extension manifest into dist/ so the
 * built `dist/` folder can be loaded directly as an unpacked MV3 extension.
 * Icons already land in dist/icons via Vite's public/ copy.
 *
 * Run:  node scripts/pack-extension.mjs   (or `npm run build:extension`)
 */
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

copyFileSync(join(root, 'manifest.json'), join(dist, 'manifest.json'));
console.log('Copied manifest.json → dist/manifest.json');
console.log('Extension ready. Load `dist/` via chrome://extensions → Load unpacked.');
