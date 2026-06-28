// Scope-of-work dispatch — a GC sends a job's scope to a sub. The sub opens a
// public link (the unguessable id is the grant, same model as /p/:id) and sees the
// WORK + photos, then taps Accept. The acceptance is the change-order-protection
// record. Owner-scoped on the contractor side (hard rule #5).
//
// buildScope() is the privacy boundary for subs — the sibling of buildProposal().
// It whitelists ONLY what a sub may see: the work (section + desc + qty + unit),
// the address, and assumptions. It NEVER emits price, rate, amount, margin, or
// notes (hard rule #2). A sub can be handed the whole scope and still never learn
// what the GC is making on it — which is exactly what makes a GC comfortable
// putting his crew on it.
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");

// Strip a job line to a WORK-ONLY item (no money, ever — hard rule #2).
function workItem(l) {
  return { section: String(l.section || "").trim(), desc: l.desc || "Item", qty: Number(l.qty) || 0, unit: l.unit || "" };
}
// Group already-stripped work items into a scope object for the sub page.
function scopeFromItems(items, title, address) {
  const groups = [];
  const byName = new Map();
  for (const w of items) {
    let g = byName.get(w.section || "");
    if (!g) { g = { name: w.section || "Work", items: [] }; byName.set(w.section || "", g); groups.push(g); }
    g.items.push({ desc: w.desc, qty: w.qty, unit: w.unit });
  }
  return {
    title: title || "Job", address: address || "",
    items: items.map((w) => ({ desc: w.desc, qty: w.qty, unit: w.unit })), // flat fallback
    sections: groups,
    // price/rate/amount/margin/notes/assumptions intentionally absent (hard rule #2).
  };
}
// WORK-ONLY view of a whole job (all lines). Used when a dispatch has no selected
// subset; otherwise the dispatch's frozen scope_json snapshot is used.
export function buildScope(job) {
  return scopeFromItems((job.lines || []).map(workItem), job.title, job.address);
}
// Scope for a dispatch: its frozen selected snapshot if present, else the whole job.
export function scopeForDispatch(d, job) {
  let items = null;
  try { if (d && d.scope_json) items = JSON.parse(d.scope_json); } catch { items = null; }
  if (Array.isArray(items) && items.length) return scopeFromItems(items, job.title, job.address);
  return buildScope(job);
}

function rowTo(r) {
  return r && {
    id: r.id, user_id: r.user_id, job_id: r.job_id, sub_id: r.sub_id || null, sub_name: r.sub_name || "",
    sub_lang: r.sub_lang || "", note: r.note || "", status: r.status || "sent",
    kind: r.kind || "work", scope_json: r.scope_json || null,
    bid_amount: r.bid_amount == null ? null : r.bid_amount, bid_note: r.bid_note || "",
    viewed_at: r.viewed_at || null, accepted_at: r.accepted_at || null, accepted_by: r.accepted_by || "",
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

// Create a dispatch (owner-scoped: the job must belong to the GC). `kind` is 'work'
// (assign → accept) or 'rfq' (request a bid back). `items` is the SELECTED work
// subset (already stripped to {section,desc,qty,unit}); empty = the whole job.
// Returns the dispatch row (its id is the public access token).
export function createDispatch(userId, { jobId, subId, subName, subLang, note, kind, items }) {
  const job = db.prepare("SELECT id FROM job WHERE id=? AND user_id=?").get(jobId, userId);
  if (!job) return null;
  const id = uid(), now = Date.now();
  const k = kind === "rfq" ? "rfq" : "work";
  const snapshot = Array.isArray(items) && items.length
    ? JSON.stringify(items.map(workItem)) : null;
  db.prepare(`INSERT INTO dispatch (id,user_id,job_id,sub_id,sub_name,sub_lang,note,status,kind,scope_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?, 'sent', ?,?, ?, ?)`)
    .run(id, userId, jobId, subId || null, String(subName || "").slice(0, 120),
      String(subLang || "").slice(0, 8), String(note || "").slice(0, 600), k, snapshot, now, now);
  return rowTo(db.prepare("SELECT * FROM dispatch WHERE id=?").get(id));
}

// A contractor submits their bid back (RFQ). Public — the link is the grant.
export function submitBid(id, { amount, note }) {
  const now = Date.now();
  db.prepare("UPDATE dispatch SET bid_amount=?, bid_note=?, status='bid', updated_at=? WHERE id=?")
    .run(Math.max(0, Math.round(Number(amount) || 0)), String(note || "").slice(0, 600), now, id);
  return getPublic(id);
}

// GC accepts a specific dispatch's bid (owner-scoped); marks the others declined.
export function acceptBid(userId, jobId, dispatchId) {
  const d = db.prepare("SELECT * FROM dispatch WHERE id=? AND user_id=? AND job_id=?").get(dispatchId, userId, jobId);
  if (!d) return null;
  const now = Date.now();
  db.prepare("UPDATE dispatch SET status='accepted', accepted_at=?, accepted_by=COALESCE(NULLIF(accepted_by,''), sub_name), updated_at=? WHERE id=?").run(now, now, dispatchId);
  // Other live bids on the same job → declined (the GC picked someone).
  db.prepare("UPDATE dispatch SET status='declined', updated_at=? WHERE job_id=? AND user_id=? AND id!=? AND status IN ('sent','viewed','bid')")
    .run(now, jobId, userId, dispatchId);
  return rowTo(db.prepare("SELECT * FROM dispatch WHERE id=?").get(dispatchId));
}

export function listForJob(userId, jobId) {
  return db.prepare("SELECT * FROM dispatch WHERE user_id=? AND job_id=? ORDER BY created_at DESC")
    .all(userId, jobId).map(rowTo);
}

// Public lookup by id (the link grant) — no owner scope, like opening /p/:id.
export function getPublic(id) {
  return rowTo(db.prepare("SELECT * FROM dispatch WHERE id=?").get(id));
}

export function markViewed(id) {
  const now = Date.now();
  db.prepare("UPDATE dispatch SET status=CASE WHEN status='sent' THEN 'viewed' ELSE status END, viewed_at=COALESCE(viewed_at, ?), updated_at=? WHERE id=?")
    .run(now, now, id);
  return getPublic(id);
}

export function accept(id, by) {
  const now = Date.now();
  db.prepare("UPDATE dispatch SET status='accepted', accepted_at=?, accepted_by=?, updated_at=? WHERE id=?")
    .run(now, String(by || "").slice(0, 120), now, id);
  return getPublic(id);
}
