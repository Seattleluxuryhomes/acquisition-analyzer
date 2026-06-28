// Change orders — the signed paper trail for extra/changed work mid-job. The
// contractor documents what changed (title + description + optional line items +
// a total the client agrees to), then sends a public link. The client opens it,
// reviews, and E-SIGNS to approve (and pays, if Stripe Connect is set up). This is
// the money contractors lose when scope grows without sign-off (hit rock, soft
// soils, owner add-ons). Owner-scoped on the contractor side; the public review
// page is reached by the unguessable id (same grant model as /p/:id).
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");

function cleanItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((l) => ({ desc: String(l.desc || "").slice(0, 200), amount: Math.round((Number(l.amount) || 0) * 100) / 100 }))
    .filter((l) => l.desc || l.amount)
    .slice(0, 40);
}

function rowTo(r) {
  if (!r) return null;
  let items = [];
  try { items = JSON.parse(r.line_items || "[]"); } catch { items = []; }
  return {
    id: r.id, user_id: r.user_id, job_id: r.job_id, number: r.number || 1,
    title: r.title || "", description: r.description || "", line_items: items,
    amount_cents: r.amount_cents, amount: (r.amount_cents || 0) / 100,
    status: r.status || "sent", checkout_url: r.checkout_url || "",
    signed_by: r.signed_by || "", signed_at: r.signed_at || null, paid_at: r.paid_at || null,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

// Create a change order on a job the contractor owns. If line items are given and
// no explicit amount, the total is summed from them. Amount may be negative (a
// credit), but a CO of exactly $0 is rejected as a likely mistake.
export function createChangeOrder(userId, { jobId, title, description, amount, items }) {
  const job = db.prepare("SELECT id FROM job WHERE id=? AND user_id=?").get(jobId, userId);
  if (!job) return null;
  const lines = cleanItems(items);
  const cents = (amount != null && amount !== "")
    ? Math.round(Number(amount) * 100)
    : Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100);
  if (!Number.isFinite(cents) || cents === 0) { const e = new Error("Enter a change-order amount (it can't be $0)."); e.status = 400; throw e; }
  const n = (db.prepare("SELECT COUNT(*) c FROM change_order WHERE job_id=?").get(jobId).c || 0) + 1;
  const id = uid(), now = Date.now();
  db.prepare(`INSERT INTO change_order
    (id,user_id,job_id,number,title,description,line_items,amount_cents,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?, 'sent', ?, ?)`)
    .run(id, userId, jobId, n, String(title || "").slice(0, 120), String(description || "").slice(0, 1000),
      JSON.stringify(lines), cents, now, now);
  return rowTo(db.prepare("SELECT * FROM change_order WHERE id=?").get(id));
}

export function setCheckoutUrl(userId, id, url) {
  db.prepare("UPDATE change_order SET checkout_url=?, updated_at=? WHERE id=? AND user_id=?").run(String(url || ""), Date.now(), id, userId);
}

export function listForJob(userId, jobId) {
  return db.prepare("SELECT * FROM change_order WHERE user_id=? AND job_id=? ORDER BY number DESC").all(userId, jobId).map(rowTo);
}

// Public lookup by id (the link grant).
export function getPublic(id) {
  return rowTo(db.prepare("SELECT * FROM change_order WHERE id=?").get(id));
}

// The client e-signs to approve. Records the typed signature + when. Idempotent
// (keeps the first signer); never downgrades a paid CO.
export function approve(id, by) {
  const now = Date.now();
  db.prepare("UPDATE change_order SET status=CASE WHEN status='paid' THEN 'paid' ELSE 'approved' END, signed_by=COALESCE(NULLIF(signed_by,''), ?), signed_at=COALESCE(signed_at, ?), updated_at=? WHERE id=?")
    .run(String(by || "").slice(0, 120), now, now, id);
  return getPublic(id);
}

export function decline(id) {
  const now = Date.now();
  db.prepare("UPDATE change_order SET status=CASE WHEN status IN ('approved','paid') THEN status ELSE 'declined' END, updated_at=? WHERE id=?").run(now, id);
  return getPublic(id);
}

export function markPaid(id) {
  const now = Date.now();
  db.prepare("UPDATE change_order SET status='paid', paid_at=COALESCE(paid_at, ?), updated_at=? WHERE id=?").run(now, now, id);
  return getPublic(id);
}
