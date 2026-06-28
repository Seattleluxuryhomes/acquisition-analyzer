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

// WORK-ONLY view of a job for a sub. No money, ever.
export function buildScope(job) {
  const work = (job.lines || []).map((l) => ({
    section: String(l.section || "").trim(),
    desc: l.desc || "Item",
    qty: Number(l.qty) || 0,
    unit: l.unit || "",
  }));
  // Group by room/area (no subtotals — there are no amounts here by design).
  const groups = [];
  const byName = new Map();
  for (const w of work) {
    let g = byName.get(w.section);
    if (!g) { g = { name: w.section || "Work", items: [] }; byName.set(w.section, g); groups.push(g); }
    g.items.push({ desc: w.desc, qty: w.qty, unit: w.unit });
  }
  return {
    title: job.title || "Job",
    address: job.address || "",
    items: work.map((w) => ({ desc: w.desc, qty: w.qty, unit: w.unit })), // flat fallback
    sections: groups,
    assumptions: job.assumptions || [],
    // NOTE: price, rate, amount, margin, notes are intentionally absent. Do not add them.
  };
}

function rowTo(r) {
  return r && {
    id: r.id, user_id: r.user_id, job_id: r.job_id, sub_id: r.sub_id || null, sub_name: r.sub_name || "",
    sub_lang: r.sub_lang || "", note: r.note || "", status: r.status || "sent",
    viewed_at: r.viewed_at || null, accepted_at: r.accepted_at || null, accepted_by: r.accepted_by || "",
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

// Create a dispatch of one job's scope to one sub (owner-scoped: the job must
// belong to the GC). Returns the dispatch row (its id is the public access token).
export function createDispatch(userId, { jobId, subId, subName, subLang, note }) {
  const job = db.prepare("SELECT id FROM job WHERE id=? AND user_id=?").get(jobId, userId);
  if (!job) return null;
  const id = uid(), now = Date.now();
  db.prepare(`INSERT INTO dispatch (id,user_id,job_id,sub_id,sub_name,sub_lang,note,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?, 'sent', ?, ?)`)
    .run(id, userId, jobId, subId || null, String(subName || "").slice(0, 120),
      String(subLang || "").slice(0, 8), String(note || "").slice(0, 600), now, now);
  return rowTo(db.prepare("SELECT * FROM dispatch WHERE id=?").get(id));
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
