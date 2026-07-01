#!/usr/bin/env node
// Brand guardrail — fails if retired branding resurfaces in user-facing files.
// Canonical rules: docs/brand-standard.md. Run: `npm run brand-check`.
//
// Bans (user-visible): "Bidtranslator"/"BidTranslator" (the old brand name) and
// "bidtranslator.com" (the old domain), anywhere in shipped code/assets.
// Allowlist: functional internals that are NEVER shown to a user and must not change —
// the SQLite filename, the dev signing-secret seeds, and the FollowUpBoss X-System key.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIRS = ["public", "src"];
const SCAN_ROOT_FILES = ["server.js"];
const EXTS = new Set([".js", ".mjs", ".html", ".json", ".xml", ".txt", ".css"]);

// Retired terms that must never reach a user (case-insensitive).
// (Note: "Bid Brain" is NOT banned here — the identity system always renders it as the active
//  name (Eden) at runtime, so it can't reach a user; banning it would false-flag that anchor.)
const BANNED = [/bidtranslator\.com/i, /bid\s*translator/i];

// Exact substrings that are allowed (preserved functional internals — see brand-standard.md).
const ALLOW = [
  "bidtranslator.db",        // SQLite filename — renaming = data loss
  "bidtranslator-dev-",      // dev signing-secret seed
  '"bidtranslator"',         // FollowUpBoss X-System-Key default
];

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (EXTS.has(extname(name))) out.push(p);
  }
  return out;
}

const targets = [
  ...SCAN_DIRS.flatMap((d) => files(join(ROOT, d))),
  ...SCAN_ROOT_FILES.map((f) => join(ROOT, f)),
];

let hits = 0;
for (const file of targets) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (ALLOW.some((a) => line.includes(a))) return;             // preserved internal — skip
    for (const re of BANNED) {
      if (re.test(line)) {
        console.error(`  ${file.replace(ROOT, "")}:${i + 1}  ${line.trim().slice(0, 100)}`);
        hits++;
        break;
      }
    }
  });
}

if (hits) {
  console.error(`\n✗ brand-check: ${hits} retired-brand reference(s) found. Fix them (see docs/brand-standard.md).`);
  process.exit(1);
}
console.log("✓ brand-check: clean — no retired branding in user-facing files.");
