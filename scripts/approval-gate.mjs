#!/usr/bin/env node
// Constitutional invariant guard (BidVoice Bible §3.7 / §9.2, from the Soul):
// "No dollar or word ever leaves the system without the contractor's sign-off."
//
// This greps every OUTBOUND call site — email sends and Stripe money-movement — and
// fails the build unless each one carries an explicit approval classification tag, so
// nobody can add an autonomous send to a client (a nudge, a reminder, a charge) without
// consciously classifying it and a reviewer seeing the tag. It proves no outbound path
// silently bypasses the gate.
//
// Tag format: a comment `APPROVAL: <class>` on the send line or within the 3 lines above.
//   system          — transactional mail to the account holder's OWN inbox (verify,
//                      reset, welcome, their own lead/notification). Not a word to a client.
//   contractor-action — fired by an explicit contractor request handler (e.g. inviting a
//                      crew member, sharing a proposal). The contractor initiated it.
//   client-action   — fired by the client's own action on already-approved content
//                      (signing, paying a deposit on a proposal the contractor sent).
// A NEW send/charge with no tag is a build failure — classify it (and thereby confirm it
// is gated), or it doesn't ship.
import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCAN_DIRS = ["src"];
const SCAN_ROOT_FILES = ["server.js"];
const EXTS = new Set([".js", ".mjs"]);
// mail.js defines sendMail (the transport itself) — not a call site.
const SKIP = new Set(["mail.js"]);

// Outbound patterns: email sends + Stripe money movement (checkout, charges, intents).
const OUTBOUND = [
  { id: "mail", re: /\bMail\.sendMail\s*\(/ },
  { id: "mail", re: /(^|[^.\w])sendMail\s*\(/ },
  // Creation only (money movement) — a trailing "/" is a retrieval GET, not a charge.
  { id: "charge", re: /\bstripe\s*\(\s*["'`](?:checkout\/sessions|charges|payment_intents)(?!\/)/ },
];
const CLASSES = new Set(["system", "contractor-action", "client-action"]);
const TAG = /APPROVAL:\s*([a-z-]+)/;

function files(dir) {
  const out = [];
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) { out.push(...files(join(dir, e.name))); continue; }
    if (SKIP.has(e.name)) continue;
    if (EXTS.has(extname(e.name))) out.push(join(dir, e.name));
  }
  return out;
}

const targets = [
  ...SCAN_DIRS.flatMap((d) => files(join(ROOT, d))),
  ...SCAN_ROOT_FILES.map((f) => join(ROOT, f)),
];

const bad = [];
let checked = 0;
for (const f of targets) {
  let lines;
  try { lines = readFileSync(f, "utf8").split("\n"); } catch { continue; }
  lines.forEach((line, i) => {
    const isSend = OUTBOUND.some((p) => p.re.test(line));
    if (!isSend) return;
    checked++;
    // Look for the tag on this line or the 3 lines above (call + comment header).
    const window = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
    const m = TAG.exec(window);
    const cls = m && m[1];
    if (!cls || !CLASSES.has(cls)) {
      bad.push({ file: f.replace(ROOT, ""), line: i + 1, text: line.trim().slice(0, 90), cls: cls || null });
    }
  });
}

if (bad.length) {
  console.error(`✗ ApprovalGate guard: ${bad.length} outbound send/charge site(s) missing a valid APPROVAL tag.`);
  console.error("  Add `// APPROVAL: system | contractor-action | client-action` on/above the call.\n");
  for (const b of bad) console.error(`  ${b.file}:${b.line}  ${b.cls ? "(unknown class '" + b.cls + "') " : ""}→  ${b.text}`);
  process.exit(1);
}
console.log(`✓ ApprovalGate guard: ${checked} outbound site(s) — all classified (no autonomous outbound).`);
