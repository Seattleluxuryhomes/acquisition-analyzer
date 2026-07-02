#!/usr/bin/env node
// Guard: zero native window.alert / window.confirm / window.prompt in the app UI.
//
// The blueprint (bidvoice-v1-blueprint.md §5) mandates a single in-app modal system —
// unbranded OS dialogs break the brand and can't be styled, themed, or trusted. Use
// edenAlert / edenConfirm / edenPrompt / edenCopy (public/index.html) instead.
//
// Runs in CI (npm run check-dialogs, folded into brand-verify). Fails the build if a
// bare alert()/confirm()/prompt() call reappears. High-precision: it ignores the eden*
// wrappers (preceding char is a word char) and any method call (preceding char is ".").
import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN = ["public"];
const EXTS = new Set([".html", ".js", ".mjs"]);
// Files that legitimately run outside the app UI (no DOM modal available).
const SKIP = new Set(["sw.js"]);

// A call to alert/confirm/prompt NOT preceded by a word char (so edenAlert, etc. are safe)
// and NOT preceded by "." (so foo.confirm() / obj.alert() are safe).
const CALL = /(^|[^.\w])(alert|confirm|prompt)\s*\(/g;

function files(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (name.isDirectory()) { out.push(...files(join(dir, name.name))); continue; }
    if (SKIP.has(name.name)) continue;
    if (EXTS.has(extname(name.name))) out.push(join(dir, name.name));
  }
  return out;
}

const hits = [];
for (const d of SCAN) {
  let list = [];
  try { list = files(join(ROOT, d)); } catch { /* dir missing */ }
  for (const f of list) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      CALL.lastIndex = 0;
      let m;
      while ((m = CALL.exec(line))) {
        hits.push({ file: f.replace(ROOT, ""), line: i + 1, call: m[2], text: line.trim().slice(0, 100) });
      }
    });
  }
}

if (hits.length) {
  console.error(`✗ Native dialog guard: ${hits.length} bare alert/confirm/prompt call(s) found.`);
  console.error("  Use edenAlert / edenConfirm / edenPrompt / edenCopy instead (in-app modal).\n");
  for (const h of hits) console.error(`  ${h.file}:${h.line}  ${h.call}(  →  ${h.text}`);
  process.exit(1);
}
console.log("✓ Native dialog guard: no bare alert/confirm/prompt — all dialogs are in-app.");
