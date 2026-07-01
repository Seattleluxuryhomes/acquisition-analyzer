#!/usr/bin/env node
// Brand audit — the automated half of Brand Stewardship (see docs/brand-steward.md).
// Fails CI when the customer-facing brand regresses. High-precision by design: every rule
// here is unambiguous, so a red result always means a real problem, never noise.
//
// Rules:
//   1. Retired brand name/domain ("BidTranslator" / "bidtranslator.com") reaching a user.
//   2. Wordmark misspelling: "Bid Voice" (space) or "BidVOICE" (caps) — it is one word: BidVoice.
// Canonical rules: docs/brand-standard.md + brand/BRAND.md. Run: `npm run brand-check`.
//
// NOT banned: "Bid Brain" — the identity system renders it as the active name (Eden) at
// runtime, so it can't reach a user; lowercase "bidvoice" — legit in domains/emails/ids.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIRS = ["public", "src"];
const SCAN_ROOT_FILES = ["server.js"];
const EXTS = new Set([".js", ".mjs", ".html", ".json", ".xml", ".txt", ".css"]);

// Preserved functional internals that are NEVER shown to a user and must not change.
const ALLOW = [
  "bidtranslator.db",        // SQLite filename — renaming = data loss
  "bidtranslator-dev-",      // dev signing-secret seed
  '"bidtranslator"',         // FollowUpBoss X-System-Key default
];

const RULES = [
  { id: "retired-brand", label: "Retired brand name/domain", res: [/bidtranslator\.com/i, /bid\s*translator/i] },
  { id: "wordmark",      label: "Wordmark misspelling (it's one word: BidVoice)", res: [/bid\s+voice/i, /BidVOICE/] },
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

const found = new Map(RULES.map((r) => [r.id, []]));
for (const file of targets) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (ALLOW.some((a) => line.includes(a))) return;
    for (const rule of RULES) {
      if (rule.res.some((re) => re.test(line))) {
        found.get(rule.id).push(`  ${file.replace(ROOT, "")}:${i + 1}  ${line.trim().slice(0, 100)}`);
      }
    }
  });
}

let total = 0;
for (const rule of RULES) {
  const hits = found.get(rule.id);
  total += hits.length;
  if (hits.length) { console.error(`✗ ${rule.label} (${hits.length}):`); hits.forEach((h) => console.error(h)); }
}

if (total) {
  console.error(`\n✗ brand-check: ${total} brand issue(s). Fix them (see docs/brand-steward.md).`);
  process.exit(1);
}
console.log(`✓ brand-check: clean — ${RULES.length} rules passed across ${targets.length} user-facing files.`);
