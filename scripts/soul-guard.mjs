#!/usr/bin/env node
// ============================================================================
//  SOUL GUARD — protects the constitutional file.
//  docs/00-bidvoice-bible/the-soul-of-bidvoice-v1.0.md is the highest authority
//  in the project. It may only change through an AMENDMENT: commit that also adds
//  an entry to the amendment log INSIDE the document, in the same commit.
//  Any other change fails the build. (Per Ben's "Instruction for Claude Code —
//  Constitutional File".)
// ============================================================================
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const FILE = "docs/00-bidvoice-bible/the-soul-of-bidvoice-v1.0.md";
// The pinned checksum of the frozen v1.0 constitution. Update this ONLY as part of
// an approved AMENDMENT commit (the guard prints the new value when it accepts one).
const PINNED = "e3453af1485dbf3d4b61d46a6de293c4";

const md5 = (buf) => createHash("md5").update(buf).digest("hex");
const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8" }).trim(); } catch { return ""; } };
const fail = (m) => { console.error("\n✗ SOUL GUARD FAILED\n  " + m + "\n"); process.exit(1); };

let buf;
try { buf = readFileSync(FILE); } catch { fail(`The constitutional file is missing: ${FILE}`); }

const actual = md5(buf);
if (actual === PINNED) {
  console.log("✓ Soul Guard: the constitution is intact (checksum matches the frozen v1.0).");
  process.exit(0);
}

// The file changed. Allowed ONLY via a founder AMENDMENT commit that logs itself.
console.error("⚠ Soul Guard: the constitution's checksum has changed.");
console.error(`    expected (pinned): ${PINNED}`);
console.error(`    actual (on disk):  ${actual}`);

const msg = sh("git log -1 --pretty=%B");
if (!/^AMENDMENT:/m.test(msg)) {
  fail(
    "The Soul may only change through a commit whose message begins with \"AMENDMENT:\".\n" +
    "  Either revert the change to the constitution, or (Ben only) make it a recorded AMENDMENT."
  );
}

// An AMENDMENT must also add a new entry to the amendment log INSIDE the document,
// in the same commit. Verify the file's amendment log grew in HEAD.
const diff = sh(`git diff HEAD~1 HEAD -- "${FILE}"`);
const addedAmendmentEntry = /^\+.*amendment/im.test(diff) && /^\+/m.test(diff);
if (!addedAmendmentEntry) {
  fail(
    "An AMENDMENT: commit must also add a new entry to the amendment log inside the document itself\n" +
    "  (same commit). No added amendment-log line was found in the diff for this file."
  );
}

console.log("✓ Soul Guard: change accepted as a logged founder AMENDMENT.");
console.log(`  → Update the pinned checksum in scripts/soul-guard.mjs to: ${actual}`);
process.exit(0);
