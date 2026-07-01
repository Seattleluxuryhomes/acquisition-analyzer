// ===================== AI Project Management OS — the spine =====================
// Customer → Job → Timeline. `recordEvent` is the single write chokepoint; everything else
// reads PROJECTIONS over the append-only timeline_event log. The Health Score is a
// deterministic rules engine — each fired rule cites the exact event that caused it. The
// LLM (elsewhere) only phrases; it never invents a reason here.
//
// Feature-flagged: BT_TIMELINE gates whether SURFACES auto-write / the boot back-fill runs.
// The helpers themselves are always callable (verify harness + future wiring). Nothing in
// the app depends on this module yet — it is verified against existing data first.
import crypto from "node:crypto";
import db from "./db.js";

export const TIMELINE_ENABLED = process.env.BT_TIMELINE === "1" || process.env.BT_TIMELINE === "on";
const uid = () => crypto.randomBytes(9).toString("base64url");
const now = () => Date.now();
const DAY = 86400000;
const safe = (j) => { try { return JSON.parse(j || "{}"); } catch { return {}; } };
const safeArr = (j) => { try { const v = JSON.parse(j || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const money = (n) => "$" + Number(n || 0).toLocaleString();

// Normalization for owner-scoped matching.
export function normPhone(p) { const d = String(p || "").replace(/\D/g, ""); return d.length > 10 ? d.slice(-10) : d; }
export function normEmail(e) { return String(e || "").trim().toLowerCase(); }

// ============================ customers ============================
export function getCustomer(userId, id) {
  return db.prepare("SELECT * FROM customer WHERE id=? AND user_id=?").get(id, userId) || null;
}
export function createCustomer(userId, info = {}) {
  const id = uid(), t = now();
  db.prepare(`INSERT INTO customer (id,user_id,name,phone,email,address,source,tags,notes,first_seen,updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, userId, String(info.name || "").slice(0, 160), normPhone(info.phone), normEmail(info.email),
    String(info.address || "").slice(0, 240), String(info.source || "").slice(0, 40),
    JSON.stringify(Array.isArray(info.tags) ? info.tags : []), String(info.notes || ""), info.ts || t, t);
  return getCustomer(userId, id);
}
// Match by phone (high confidence) then email — always owner-scoped.
export function findCustomerMatch(userId, info = {}) {
  const phone = normPhone(info.phone), email = normEmail(info.email);
  if (phone) { const m = db.prepare("SELECT * FROM customer WHERE user_id=? AND phone=? AND phone!='' AND archived_at IS NULL ORDER BY first_seen LIMIT 1").get(userId, phone); if (m) return { customer: m, on: "phone" }; }
  if (email) { const m = db.prepare("SELECT * FROM customer WHERE user_id=? AND email=? AND email!='' AND archived_at IS NULL ORDER BY first_seen LIMIT 1").get(userId, email); if (m) return { customer: m, on: "email" }; }
  return null;
}
// Match-and-link when confidence is high; otherwise create. On a soft conflict (same phone
// but a different non-empty email), link to the match but FLAG a merge suggestion rather
// than forcing it (founder's dedup decision). Never overwrites existing data.
export function findOrLinkCustomer(userId, info = {}) {
  const match = findCustomerMatch(userId, info);
  if (!match) return { customer: createCustomer(userId, info), created: true };
  const c = match.customer;
  let suggestMerge = false, reason = "";
  const email = normEmail(info.email);
  if (match.on === "phone" && email && c.email && email !== c.email) { suggestMerge = true; reason = "Same phone, different email"; }
  patchCustomerBlanks(userId, c, info);
  return { customer: getCustomer(userId, c.id), matched: true, on: match.on, suggestMerge, reason };
}
// Fill ONLY empty fields on an existing customer — never overwrite the owner's data.
function patchCustomerBlanks(userId, c, info) {
  const sets = [], vals = [];
  if (!c.name && info.name) { sets.push("name=?"); vals.push(String(info.name).slice(0, 160)); }
  if (!c.email && normEmail(info.email)) { sets.push("email=?"); vals.push(normEmail(info.email)); }
  if (!c.address && info.address) { sets.push("address=?"); vals.push(String(info.address).slice(0, 240)); }
  if (!c.phone && normPhone(info.phone)) { sets.push("phone=?"); vals.push(normPhone(info.phone)); }
  if (!sets.length) return;
  sets.push("updated_at=?"); vals.push(now());
  db.prepare(`UPDATE customer SET ${sets.join(",")} WHERE id=? AND user_id=?`).run(...vals, c.id, userId);
}

// ===================== events (the single write chokepoint) =====================
// Append-only. dedupe_key makes writes idempotent (back-fill re-runs; one open alert per
// condition). Returns the new id, or null if a dedupe collision meant it already existed.
export function recordEvent(e = {}) {
  if (!e.userId || !e.type) throw new Error("recordEvent requires userId + type");
  const t = now();
  const info = db.prepare(`INSERT OR IGNORE INTO timeline_event
      (user_id,customer_id,job_id,ts,type,actor,title,body,payload,ref_table,ref_id,visibility,dedupe_key,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    e.userId, e.customerId || null, e.jobId || null, e.ts || t, String(e.type),
    String(e.actor || "system"), String(e.title || ""), String(e.body || ""),
    JSON.stringify(e.payload || {}), String(e.refTable || ""), String(e.refId || ""),
    String(e.visibility || "internal"), e.dedupeKey || null, t);
  return info.changes ? Number(info.lastInsertRowid) : null;
}

// ============================ reads (projections) ============================
const VIS = { internal: ["internal", "customer", "crew"], customer: ["customer"], crew: ["crew", "customer"] };
function mapEvent(r) {
  return { id: r.id, ts: r.ts, type: r.type, actor: r.actor, title: r.title, body: r.body,
    payload: safe(r.payload), refTable: r.ref_table, refId: r.ref_id, visibility: r.visibility,
    jobId: r.job_id, customerId: r.customer_id };
}
export function jobTimeline(userId, jobId, { visibility = "internal", limit = 200 } = {}) {
  const allowed = VIS[visibility] || VIS.internal;
  const ph = allowed.map(() => "?").join(",");
  return db.prepare(`SELECT * FROM timeline_event WHERE user_id=? AND job_id=? AND visibility IN (${ph}) ORDER BY ts DESC, id DESC LIMIT ?`)
    .all(userId, jobId, ...allowed, limit).map(mapEvent);
}
export function customerTimeline(userId, customerId, { limit = 300 } = {}) {
  return db.prepare("SELECT * FROM timeline_event WHERE user_id=? AND customer_id=? ORDER BY ts DESC, id DESC LIMIT ?")
    .all(userId, customerId, limit).map(mapEvent);
}
// Open AI-PM concerns: an 'attention' event with no later 'attention_cleared' on its key.
export function attentionFeed(userId, { limit = 100 } = {}) {
  const rows = db.prepare("SELECT * FROM timeline_event WHERE user_id=? AND type='attention' ORDER BY ts DESC, id DESC LIMIT ?").all(userId, limit);
  const cleared = new Set(db.prepare("SELECT dedupe_key FROM timeline_event WHERE user_id=? AND type='attention_cleared' AND dedupe_key IS NOT NULL").all(userId).map((r) => r.dedupe_key));
  return rows.filter((r) => !(r.dedupe_key && cleared.has(r.dedupe_key))).map(mapEvent);
}
export function getProjectState(userId, jobId) {
  const r = db.prepare("SELECT * FROM project_state WHERE job_id=? AND user_id=?").get(jobId, userId);
  if (!r) return null;
  return { jobId: r.job_id, health: r.health, reasons: safeArr(r.health_reasons), percentComplete: r.percent_complete,
    expectedMargin: r.expected_margin, actualMargin: r.actual_margin, nextAction: safe(r.next_action), stage: r.stage, updatedAt: r.updated_at };
}

// ===================== health (deterministic projection) =====================
// Each rule: (ctx) => null | {rule, severity, reason, eventId, action}. eventId cites the
// event that fired it (or null when the trigger is a MISSING event). No LLM in this path.
const RULES = [
  (c) => { const s = c.last("proposal_sent"); if (s && !c.has("proposal_viewed") && !c.has("signed") && c.age(s) > 3 * DAY) return { rule: "proposal_unopened", severity: "yellow", reason: `Proposal sent ${c.days(s)}d ago, not opened yet`, eventId: s.id, action: { label: "Nudge the customer", directive: "[[remind:proposal]]" } }; return null; },
  (c) => { const s = c.last("proposal_sent"); if (s && !c.has("signed") && c.age(s) > 7 * DAY) return { rule: "unsigned_after_sent", severity: "yellow", reason: `No decision ${c.days(s)}d after the proposal was sent`, eventId: s.id, action: { label: "Follow up", directive: "[[followup:job]]" } }; return null; },
  (c) => { const s = c.last("signed"); if (s && !c.has("deposit_paid") && !c.has("payment") && c.age(s) > 2 * DAY) return { rule: "deposit_unpaid", severity: "red", reason: `Signed ${c.days(s)}d ago but no payment collected yet`, eventId: s.id, action: { label: "Request the deposit", directive: "[[collect:deposit]]" } }; return null; },
  (c) => { const co = c.last("change_order"); if (co && co.payload.status === "sent" && c.age(co) > 3 * DAY) return { rule: "unsigned_change_order", severity: "yellow", reason: `Change order #${co.payload.number || ""} awaiting approval ${c.days(co)}d`, eventId: co.id, action: { label: "Chase the signature", directive: "[[remind:change_order]]" } }; return null; },
  (c) => { if (c.stage === "in_progress") { const e = c.lastAny(); if (e && c.age(e) > 14 * DAY) return { rule: "no_activity", severity: "yellow", reason: `No activity on this project in ${c.days(e)}d`, eventId: e.id, action: { label: "Check in with the customer", directive: "[[followup:job]]" } }; } return null; },
];
function buildCtx(job, events) {
  const byType = {}; events.forEach((e) => { (byType[e.type] = byType[e.type] || []).push(e); });
  const last = (t) => { const a = byType[t]; return a && a.length ? a[a.length - 1] : null; };
  const has = (t) => !!(byType[t] && byType[t].length);
  const lastAny = () => (events.length ? events[events.length - 1] : null);
  const age = (e) => (e ? Date.now() - e.ts : 0);
  const days = (e) => Math.floor(age(e) / DAY);
  let stage = "lead";
  if (has("estimate_started") || has("proposal_sent")) stage = "quoted";
  if (has("signed")) stage = "signed";
  if (has("work_started") || has("photo_added") || has("draw_requested") || has("deposit_paid") || has("payment")) stage = "in_progress";
  if ((byType.payment || []).some((p) => p.payload && p.payload.final)) stage = "won";
  return { job, events, byType, last, has, lastAny, age, days, stage };
}
function defaultNext(stage) {
  return ({ lead: { label: "Book the estimate", directive: "[[schedule:estimate]]" },
    quoted: { label: "Follow up on the proposal", directive: "[[followup:job]]" },
    signed: { label: "Collect the deposit", directive: "[[collect:deposit]]" },
    in_progress: { label: "Keep the project moving", directive: "" },
    won: { label: "Request a review", directive: "[[review:request]]" } }[stage]) || { label: "", directive: "" };
}
export function recomputeProjectState(userId, jobId) {
  const job = db.prepare("SELECT * FROM job WHERE id=? AND user_id=?").get(jobId, userId);
  if (!job) return null;
  const rows = db.prepare("SELECT id,ts,type,payload FROM timeline_event WHERE user_id=? AND job_id=? ORDER BY ts ASC, id ASC").all(userId, jobId);
  const events = rows.map((r) => ({ id: r.id, ts: r.ts, type: r.type, payload: safe(r.payload) }));
  const c = buildCtx(job, events);
  const reasons = RULES.map((r) => r(c)).filter(Boolean);
  const health = reasons.some((r) => r.severity === "red") ? "red" : reasons.some((r) => r.severity === "yellow") ? "yellow" : "green";
  const percent = c.stage === "won" ? 100 : c.stage === "in_progress" ? 50 : c.stage === "signed" ? 25 : c.stage === "quoted" ? 10 : 0;
  const nextAction = reasons.length ? reasons[0].action : defaultNext(c.stage);
  const lastId = events.length ? events[events.length - 1].id : 0;
  const t = now();
  db.prepare(`INSERT INTO project_state (job_id,user_id,health,health_reasons,percent_complete,expected_margin,actual_margin,next_action,stage,last_event_id,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(job_id) DO UPDATE SET health=excluded.health,health_reasons=excluded.health_reasons,percent_complete=excluded.percent_complete,next_action=excluded.next_action,stage=excluded.stage,last_event_id=excluded.last_event_id,updated_at=excluded.updated_at`).run(
    jobId, userId, health, JSON.stringify(reasons), percent, (job.margin != null ? job.margin : null), null, JSON.stringify(nextAction), c.stage, lastId, t);
  return getProjectState(userId, jobId);
}

// ===================== idempotent back-fill (from existing data) =====================
// Reconstructs customers + the timeline from existing rows using their OWN timestamps.
// Safe to re-run (dedupe_key). The timeline lights up populated, not empty.
function custOfJob(userId, jobId) { if (!jobId) return null; const j = db.prepare("SELECT customer_id FROM job WHERE id=? AND user_id=?").get(jobId, userId); return (j && j.customer_id) || null; }
export function backfillUser(userId) {
  const out = { customers: 0, events: 0, jobs: 0 };
  const ev = (e) => { if (recordEvent(e) != null) out.events++; };

  const jobs = db.prepare("SELECT * FROM job WHERE user_id=?").all(userId);
  for (const job of jobs) {
    out.jobs++;
    let customerId = job.customer_id || null;
    if (!customerId && (job.customer || job.customer_phone)) {
      const res = findOrLinkCustomer(userId, { name: job.customer, phone: job.customer_phone, address: job.address, source: "Backfill", ts: job.created_at });
      customerId = res.customer.id;
      if (res.created) out.customers++;
      db.prepare("UPDATE job SET customer_id=? WHERE id=? AND user_id=? AND (customer_id IS NULL OR customer_id='')").run(customerId, job.id, userId);
    }
    const base = { userId, customerId, jobId: job.id };
    ev({ ...base, type: "estimate_started", actor: "owner", ts: job.created_at, title: `Estimate started${job.customer ? ` — ${job.customer}` : ""}`, refTable: "job", refId: job.id, dedupeKey: `bf:estimate_started:${job.id}` });
    if (job.status === "sent" && job.sent_at) ev({ ...base, type: "proposal_sent", actor: "owner", ts: job.sent_at, title: "Proposal sent", refTable: "job", refId: job.id, dedupeKey: `bf:proposal_sent:${job.id}` });
    if (job.scheduled_date) ev({ ...base, type: "appointment_set", actor: "owner", ts: job.updated_at || job.created_at, title: `Scheduled ${job.scheduled_date}${job.scheduled_time ? ` ${job.scheduled_time}` : ""}`, payload: { date: job.scheduled_date, time: job.scheduled_time || "" }, refTable: "job", refId: job.id, dedupeKey: `bf:appointment:${job.id}:${job.scheduled_date}` });
  }

  for (const l of db.prepare("SELECT * FROM lead WHERE user_id=?").all(userId)) {
    let customerId = l.job_id ? custOfJob(userId, l.job_id) : null;
    if (!customerId && (l.phone || l.email || l.name)) { const res = findOrLinkCustomer(userId, { name: l.name, phone: l.phone, email: l.email, address: l.city, source: l.source || "Lead", ts: l.created_at }); customerId = res.customer.id; if (res.created) out.customers++; }
    ev({ userId, customerId, jobId: l.job_id || null, type: "lead_created", actor: "customer", ts: l.created_at, title: `Lead — ${l.name || l.phone || "new inquiry"}`, body: l.message || "", payload: { source: l.source || "", job_type: l.job_type || "" }, refTable: "lead", refId: l.id, dedupeKey: `bf:lead:${l.id}` });
  }

  for (const s of db.prepare("SELECT * FROM signature WHERE user_id=?").all(userId))
    ev({ userId, customerId: custOfJob(userId, s.job_id), jobId: s.job_id, type: "signed", actor: "customer", ts: s.signed_at, title: `Signed${s.accepted_total ? ` — ${money(s.accepted_total)}` : ""}`, payload: { signer: s.signer_name || "", amount: s.accepted_total || 0 }, refTable: "signature", refId: s.id, dedupeKey: `bf:signed:${s.id}` });

  for (const p of db.prepare("SELECT * FROM payment_request WHERE user_id=? AND status='paid'").all(userId))
    ev({ userId, customerId: custOfJob(userId, p.job_id), jobId: p.job_id || null, type: "payment", actor: "customer", ts: p.paid_at || p.created_at, title: `Payment — ${money((p.amount_cents || 0) / 100)}`, payload: { amount: (p.amount_cents || 0) / 100, description: p.description || "" }, refTable: "payment_request", refId: p.id, dedupeKey: `bf:payment:${p.id}` });

  for (const d of db.prepare("SELECT * FROM draw WHERE user_id=?").all(userId)) {
    ev({ userId, customerId: custOfJob(userId, d.job_id), jobId: d.job_id, type: "draw_requested", actor: "owner", ts: d.created_at, title: `Draw requested — ${money((d.amount_cents || 0) / 100)}`, payload: { amount: (d.amount_cents || 0) / 100, status: d.status }, refTable: "draw", refId: d.id, dedupeKey: `bf:draw:${d.id}` });
    if (d.status === "paid" && d.paid_at) ev({ userId, customerId: custOfJob(userId, d.job_id), jobId: d.job_id, type: "payment", actor: "customer", ts: d.paid_at, title: `Draw paid — ${money((d.amount_cents || 0) / 100)}`, payload: { amount: (d.amount_cents || 0) / 100, draw: true }, refTable: "draw", refId: d.id, dedupeKey: `bf:draw_paid:${d.id}` });
  }

  for (const co of db.prepare("SELECT * FROM change_order WHERE user_id=?").all(userId)) {
    ev({ userId, customerId: custOfJob(userId, co.job_id), jobId: co.job_id, type: "change_order", actor: "owner", ts: co.created_at, title: `Change order #${co.number} — ${money((co.amount_cents || 0) / 100)}`, body: co.title || "", payload: { number: co.number, amount: (co.amount_cents || 0) / 100, status: co.status }, refTable: "change_order", refId: co.id, dedupeKey: `bf:co:${co.id}` });
    if (co.signed_at) ev({ userId, customerId: custOfJob(userId, co.job_id), jobId: co.job_id, type: "change_order", actor: "customer", ts: co.signed_at, title: `Change order #${co.number} approved`, payload: { number: co.number, status: "approved" }, refTable: "change_order", refId: co.id, dedupeKey: `bf:co_signed:${co.id}` });
  }

  for (const job of jobs) recomputeProjectState(userId, job.id);
  return out;
}
export function backfillAll() {
  const totals = { users: 0, customers: 0, events: 0, jobs: 0 };
  for (const u of db.prepare("SELECT id FROM user").all()) { const r = backfillUser(u.id); totals.users++; totals.customers += r.customers; totals.events += r.events; totals.jobs += r.jobs; }
  return totals;
}
