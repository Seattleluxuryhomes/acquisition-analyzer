#!/usr/bin/env node
// Static constitutional invariants — build-failing greps (Engineering Constitution B-10, B-11).
//
//  1. ONE EDEN (Soul; §14.6 / C-1). "There is one Eden… never split into market variants."
//     The Name-Trial identity switcher (`aiIdentitySeg()`, which renders per-identity buttons
//     wired to `setAiIdentity`) is retired to dead scaffolding. This guard fails if it is ever
//     CALLED again — i.e. if a user-facing identity switcher is wired back into the UI.
//
//  2. NO AI/SECRET KEY IN THE BROWSER (hard-rule #1). The AI provider key never reaches the
//     client bundle. This bans real secret VALUE patterns in public/ — NOT the env-var NAMES,
//     which appear legitimately in instructional copy ("add your ANTHROPIC_API_KEY in settings").
import { readFileSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const fails = [];

// ---- 1. One Eden ------------------------------------------------------------------
{
  const src = readFileSync(join(ROOT, "public/index.html"), "utf8");
  const calls = (src.match(/\baiIdentitySeg\s*\(/g) || []).length;
  const defs = (src.match(/function\s+aiIdentitySeg\s*\(/g) || []).length;
  const invocations = calls - defs;                 // any occurrence that isn't the definition = a call
  if (invocations > 0) {
    fails.push(`One Eden: aiIdentitySeg() is called ${invocations}×  — the retired Name-Trial identity ` +
      `switcher is wired back into the UI. The Soul forbids user-facing identity variation (§14.6/C-1).`);
  }
}

// ---- 2. No AI/secret key value in the browser bundle -------------------------------
{
  // Real secret VALUE shapes — never the env-var names (those are allowed in copy).
  const SECRETS = [
    { re: /sk-ant-[A-Za-z0-9_-]{6,}/, what: "Anthropic key value (sk-ant-…)" },
    { re: /\bsk-[A-Za-z0-9]{20,}/, what: "OpenAI key value (sk-…)" },
    { re: /\bsk_(live|test)_[A-Za-z0-9]{10,}/, what: "Stripe secret key (sk_live/test_…)" },
    { re: /\brk_(live|test)_[A-Za-z0-9]{10,}/, what: "Stripe restricted key (rk_…)" },
    { re: /\bwhsec_[A-Za-z0-9]{10,}/, what: "Stripe webhook secret (whsec_…)" },
    { re: /\bre_[A-Za-z0-9]{16,}/, what: "Resend key value (re_…)" },
  ];
  const files = [];
  const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name));
    else if ([".html", ".js", ".mjs", ".css", ".json"].includes(extname(e.name))) files.push(join(dir, e.name));
  } };
  walk(join(ROOT, "public"));
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const s of SECRETS) if (s.re.test(line)) {
        fails.push(`Secret in browser: ${s.what} in ${f.replace(ROOT, "")}:${i + 1} (hard-rule #1 — the AI/provider key never reaches the client).`);
      }
    });
  }
}

if (fails.length) {
  console.error(`✗ Static invariants: ${fails.length} violation(s)`);
  for (const f of fails) console.error("  ✗ " + f);
  process.exit(1);
}
console.log("✓ Static invariants: one Eden (switcher stays retired) + no secret key values in the browser.");
