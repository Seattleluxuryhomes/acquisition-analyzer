// Draw requests — progress billing with proof. A contractor documents completed
// work (amount + description + photos) and sends a public link to the property
// owner OR their bank/lender, who reviews the proof and APPROVES (and pays, via the
// contractor's Stripe Connect if set up). Owner-scoped on the contractor side; the
// public review page is reached by the unguessable id (same grant model as /p/:id).
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");

function rowTo(r) {
  if (!r) return null;
  let photoIds = [];
  try { photoIds = JSON.parse(r.photo_ids || "[]"); } catch { photoIds = []; }
  return {
    id: r.id, user_id: r.user_id, job_id: r.job_id, amount_cents: r.amount_cents,
    amount: (r.amount_cents || 0) / 100, description: r.description || "",
    photo_ids: photoIds, status: r.status || "requested", checkout_url: r.checkout_url || "",
    approved_by: r.approved_by || "", approved_at: r.approved_at || null, paid_at: r.paid_at || null,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

// Create a draw on a job the GC owns. Amount in dollars; photoIds are job photo ids.
export function createDraw(userId, { jobId, amount, description, photoIds }) {
  const job = db.prepare("SELECT id FROM job WHERE id=? AND user_id=?").get(jobId, userId);
  if (!job) return null;
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents) || cents < 100) { const e = new Error("Enter a draw amount of at least $1."); e.status = 400; throw e; }
  // Only keep photo ids that actually belong to this job (owner's photos).
  const valid = new Set(db.prepare("SELECT id FROM photo WHERE job_id=?").all(jobId).map((p) => p.id));
  const ids = (Array.isArray(photoIds) ? photoIds : []).map(String).filter((p) => valid.has(p)).slice(0, 20);
  const id = uid(), now = Date.now();
  db.prepare(`INSERT INTO draw (id,user_id,job_id,amount_cents,description,photo_ids,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?, 'requested', ?, ?)`)
    .run(id, userId, jobId, cents, String(description || "").slice(0, 600), JSON.stringify(ids), now, now);
  return rowTo(db.prepare("SELECT * FROM draw WHERE id=?").get(id));
}

export function setCheckoutUrl(userId, id, url) {
  db.prepare("UPDATE draw SET checkout_url=?, updated_at=? WHERE id=? AND user_id=?").run(String(url || ""), Date.now(), id, userId);
}

export function listForJob(userId, jobId) {
  return db.prepare("SELECT * FROM draw WHERE user_id=? AND job_id=? ORDER BY created_at DESC").all(userId, jobId).map(rowTo);
}

// Public lookup by id (the link grant).
export function getPublic(id) {
  return rowTo(db.prepare("SELECT * FROM draw WHERE id=?").get(id));
}

// Owner/bank approves the draw (records who + when). Idempotent.
export function approve(id, by) {
  const now = Date.now();
  db.prepare("UPDATE draw SET status=CASE WHEN status='paid' THEN 'paid' ELSE 'approved' END, approved_by=COALESCE(NULLIF(approved_by,''), ?), approved_at=COALESCE(approved_at, ?), updated_at=? WHERE id=?")
    .run(String(by || "").slice(0, 120), now, now, id);
  return getPublic(id);
}

export function markPaid(id) {
  const now = Date.now();
  db.prepare("UPDATE draw SET status='paid', paid_at=COALESCE(paid_at, ?), updated_at=? WHERE id=?").run(now, now, id);
  return getPublic(id);
}
