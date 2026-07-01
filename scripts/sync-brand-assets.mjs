#!/usr/bin/env node
// Single-source-of-truth sync: copy every master in brand/masters/ to the surfaces
// that consume it, per brand/manifest.json. Run after replacing a master (e.g. the
// official logo). No image processing happens here — masters must already be sized
// to match their destinations (this environment has no image resizer).
//
//   npm run brand-sync           # write destinations from masters
//   npm run brand-sync -- --check  # verify only (non-zero exit if drift), writes nothing
//
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_DIR = resolve(ROOT, "brand");           // master paths are relative to brand/
const manifest = JSON.parse(readFileSync(resolve(BRAND_DIR, "manifest.json"), "utf8"));
const checkOnly = process.argv.includes("--check");
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 12);

let wrote = 0, drift = 0, missing = 0;
for (const a of manifest.assets) {
  const master = resolve(BRAND_DIR, a.master);
  if (!existsSync(master)) { console.error(`✗ missing master: ${a.master}`); missing++; continue; }
  const mh = hash(master);
  for (const dest of a.destinations) {
    const d = resolve(ROOT, dest);
    const same = existsSync(d) && hash(d) === mh;
    if (checkOnly) {
      if (!same) { console.error(`✗ drift: ${dest} != ${a.master}`); drift++; }
    } else if (!same) {
      writeFileSync(d, readFileSync(master));
      console.log(`→ ${a.master}  →  ${dest}  (${statSync(master).size} B)`);
      wrote++;
    }
  }
}

if (missing) process.exit(2);
if (checkOnly) {
  if (drift) { console.error(`\nbrand-sync --check: ${drift} destination(s) out of sync. Run \`npm run brand-sync\`.`); process.exit(1); }
  console.log("✓ brand-sync: every destination matches its master.");
} else {
  console.log(wrote ? `\n✓ brand-sync: wrote ${wrote} file(s) from masters.` : "✓ brand-sync: already in sync — nothing to write.");
}
