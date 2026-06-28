// Living website — published projects (Sprint 12, AI Website Engine).
//
// When a contractor publishes a finished job, a row lands here and the /c/:id site
// renders it as a Before & After gallery + project write-up. Photos referenced here
// are PUBLIC by the contractor's explicit choice; the public photo route checks
// membership here (isPhotoPublic) so private job photos can never leak — only ones
// attached to a published project are servable without a signature.
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");

function rowTo(r) {
  if (!r) return null;
  const J = (s) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
  return {
    id: r.id, user_id: r.user_id, job_id: r.job_id || null,
    title: r.title || "", description: r.description || "", service: r.service || "", area: r.area || "",
    before_ids: J(r.before_ids), after_ids: J(r.after_ids),
    status: r.status || "published", created_at: r.created_at, updated_at: r.updated_at,
  };
}

// Photo ids that actually belong to this owner's job (so a contractor can only
// publish their own photos).
function ownPhotoIds(userId, jobId) {
  return new Set(db.prepare("SELECT id FROM photo WHERE job_id=? AND user_id=?").all(jobId, userId).map((p) => p.id));
}

export function createFromJob(userId, { jobId, title, description, service, area, beforeIds, afterIds }) {
  const job = db.prepare("SELECT id FROM job WHERE id=? AND user_id=?").get(jobId, userId);
  if (!job) return null;
  const valid = ownPhotoIds(userId, jobId);
  const clean = (arr) => [...new Set((Array.isArray(arr) ? arr : []).map(String).filter((p) => valid.has(p)))].slice(0, 24);
  const before = clean(beforeIds), after = clean(afterIds);
  const id = uid(), now = Date.now();
  db.prepare(`INSERT INTO site_project
    (id,user_id,job_id,title,description,service,area,before_ids,after_ids,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?, 'published', ?, ?)`)
    .run(id, userId, jobId, String(title || "").slice(0, 140), String(description || "").slice(0, 1200),
      String(service || "").slice(0, 80), String(area || "").slice(0, 80),
      JSON.stringify(before), JSON.stringify(after), now, now);
  return rowTo(db.prepare("SELECT * FROM site_project WHERE id=?").get(id));
}

// The contractor's published projects, newest first (for the public site + the app).
export function listPublished(userId) {
  return db.prepare("SELECT * FROM site_project WHERE user_id=? AND status='published' ORDER BY created_at DESC").all(userId).map(rowTo);
}
export function listForJob(userId, jobId) {
  return db.prepare("SELECT * FROM site_project WHERE user_id=? AND job_id=? ORDER BY created_at DESC").all(userId, jobId).map(rowTo);
}
export function getPublic(id) {
  return rowTo(db.prepare("SELECT * FROM site_project WHERE id=?").get(id));
}
export function remove(userId, id) {
  const info = db.prepare("DELETE FROM site_project WHERE id=? AND user_id=?").run(id, userId);
  return info.changes > 0;
}

// SAFETY GATE for the public photo route: is this photo id attached to ANY published
// project? Only then may it be served without a signature. Parsed in JS (not LIKE)
// so base64url ids with '_' can't cause false matches.
export function isPhotoPublic(photoId) {
  if (!photoId) return false;
  const rows = db.prepare("SELECT before_ids, after_ids FROM site_project WHERE status='published'").all();
  for (const r of rows) {
    try {
      if (JSON.parse(r.before_ids || "[]").includes(photoId)) return true;
      if (JSON.parse(r.after_ids || "[]").includes(photoId)) return true;
    } catch { /* ignore malformed */ }
  }
  return false;
}
