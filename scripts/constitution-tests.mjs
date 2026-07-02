#!/usr/bin/env node
// Constitution enforcement tests — the Data Constitution + Soul made build-failing.
//
// These turn three "irreversible-mistake" principles into automated checks that fail CI
// if the app ever regresses (Data Constitution §2 Portability, §3 Isolation; Soul/hard-rule
// #2 no pricing leakage). Referenced by the Engineering Constitution. Run via
// `npm run constitution-tests` (folded into `verify`).
//
// It boots a real server against a throwaway DB and exercises the actual HTTP surface —
// no mocks — because tenant isolation is exactly the thing a unit test can lie about.
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 4090 + Math.floor(process.uptime() % 50);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = mkdtempSync(join(tmpdir(), "bv-const-"));
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

async function req(method, path, { token, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch { /* non-json (e.g. HTML page) */ }
  return { status: res.status, json };
}
async function signup(email) {
  const r = await req("POST", "/api/auth/signup", { body: { email, password: "password12345", company: email.split("@")[0] } });
  return r.json && r.json.token;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Boot the server on a temp DB.
const srv = spawn("node", ["server.js"], {
  env: { ...process.env, PORT: String(PORT), BT_DATA_DIR: DATA_DIR, BT_SIGNING_SECRET: "constitution-test-secret" },
  stdio: ["ignore", "ignore", "inherit"],
});
try {
  // Wait for health.
  let up = false;
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(BASE + "/api/health"); if (r.ok) { up = true; break; } } catch { /* not yet */ }
    await sleep(150);
  }
  if (!up) { console.error("✗ constitution-tests: server did not start"); process.exit(1); }

  // Two sealed tenants.
  const A = await signup("tenant-a@test.com");
  const B = await signup("tenant-b@test.com");
  ok(A && B, "both tenants could sign up");

  // A creates a job with PRIVATE margin + notes and a customer.
  const mk = await req("POST", "/api/jobs", { token: A, body: { title: "Kitchen — Maria", from: "es", to: "en" } });
  const jobId = mk.json && (mk.json.job ? mk.json.job.id : mk.json.id);
  ok(!!jobId, "tenant A can create a job");
  await req("PATCH", "/api/jobs/" + jobId, { token: A, body: {
    customer: "Maria Martinez", margin: 44, notes: "PRIVATE undercut Bob by 5 percent",
    lines: [{ id: "l1", desc: "Cabinets", type: "fixed", price: 1200, furn: "you" }],
  } });

  // §3 ISOLATION — tenant B must not be able to read/modify/delete A's job.
  ok((await req("GET", "/api/jobs/" + jobId, { token: B })).status === 404, "§3: B cannot READ A's job (404)");
  ok((await req("PATCH", "/api/jobs/" + jobId, { token: B, body: { title: "hijacked" } })).status === 404, "§3: B cannot PATCH A's job (404)");
  ok((await req("DELETE", "/api/jobs/" + jobId, { token: B })).status === 404, "§3: B cannot DELETE A's job (404)");
  const bList = await req("GET", "/api/jobs", { token: B });
  const bJobs = (bList.json && bList.json.jobs) || [];
  ok(!bJobs.some((j) => j.id === jobId), "§3: A's job never appears in B's job list");

  // §2 PORTABILITY — A's export is complete AND contains only A's data.
  const exp = await req("GET", "/api/account/export", { token: A });
  ok(exp.status === 200 && exp.json, "§2: export returns 200 + JSON");
  const bundle = exp.json || {};
  for (const key of ["account", "profile", "jobs", "contacts", "leads", "price_book", "payments", "referral_credits"]) {
    ok(key in bundle, `§2: export includes '${key}'`);
  }
  ok(Array.isArray(bundle.jobs) && bundle.jobs.some((j) => j.id === jobId), "§2: export includes the contractor's own job");
  const expB = await req("GET", "/api/account/export", { token: B });
  const bBundleJobs = (expB.json && expB.json.jobs) || [];
  ok(!bBundleJobs.some((j) => j.id === jobId), "§2/§3: B's export does not contain A's job");

  // Soul / hard-rule #2 — the client proposal must never leak margin or private notes.
  const pub = await fetch(BASE + "/p/" + jobId).then((r) => r.text()).catch(() => "");
  ok(!/undercut|PRIVATE/i.test(pub), "hard-rule #2: public proposal never leaks private notes");
  ok(!/\b44\b/.test(pub.replace(/data:[^"']+/g, "")) || !/margin/i.test(pub), "hard-rule #2: public proposal never leaks the margin");

  // §5 DELETION — 30-day grace with export, never an immediate irreversible hard-delete.
  const C = await signup("tenant-c@test.com");
  const del = await req("POST", "/api/account/delete", { token: C, body: { confirm: "DELETE", password: "password12345" } });
  ok(del.status === 200 && del.json && del.json.ok, "§5: delete returns ok");
  const days = del.json && del.json.purge_at ? (del.json.purge_at - Date.now()) / 86400000 : 0;
  ok(days > 29 && days < 31, `§5: deletion is a 30-day grace, not an instant hard-delete (got ~${days.toFixed(1)}d)`);
} finally {
  srv.kill("SIGKILL");
}

if (fails.length) {
  console.error(`✗ Constitution tests: ${fails.length} FAILED`);
  for (const f of fails) console.error("  ✗ " + f);
  process.exit(1);
}
console.log("✓ Constitution tests: tenant isolation (§3), full export (§2), and no pricing leakage all hold.");
