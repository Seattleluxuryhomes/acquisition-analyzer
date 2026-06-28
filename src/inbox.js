// Approval Inbox (Sprint 14) — the AI-employee primitive.
//
// The system PROPOSES; the contractor APPROVES. Nothing is ever sent or posted
// automatically. Every AI capability writes cards here (review requests now;
// lead follow-ups in Sprint 15; marketing/social/blog later) and they all render
// and approve through the same surface.
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");

function rowTo(r) {
  if (!r) return null;
  let ctx = {}; try { ctx = JSON.parse(r.context || "{}"); } catch { ctx = {}; }
  return { id: r.id, user_id: r.user_id, type: r.type, title: r.title || "", body: r.body || "",
    status: r.status || "pending", context: ctx, created_at: r.created_at, updated_at: r.updated_at };
}

// Create a card. dedupeKey makes re-generation idempotent (the unique index drops
// a duplicate silently), so running "generate" repeatedly never piles up dupes.
export function create(userId, { type, title, body, context, dedupeKey }) {
  const id = uid(), now = Date.now();
  try {
    db.prepare(`INSERT INTO suggestion (id,user_id,type,title,body,status,context,dedupe_key,created_at,updated_at)
      VALUES (?,?,?,?,?, 'pending', ?, ?, ?, ?)`)
      .run(id, userId, String(type || "generic"), String(title || "").slice(0, 160), String(body || "").slice(0, 2000),
        JSON.stringify(context || {}), dedupeKey || (type + ":" + id), now, now);
    return rowTo(db.prepare("SELECT * FROM suggestion WHERE id=?").get(id));
  } catch { return null; } // dedupe collision → already suggested
}

export function listPending(userId) {
  return db.prepare("SELECT * FROM suggestion WHERE user_id=? AND status='pending' ORDER BY created_at DESC").all(userId).map(rowTo);
}
export function countPending(userId) {
  return db.prepare("SELECT COUNT(*) c FROM suggestion WHERE user_id=? AND status='pending'").get(userId).c;
}
export function get(userId, id) {
  return rowTo(db.prepare("SELECT * FROM suggestion WHERE id=? AND user_id=?").get(id, userId));
}
export function setBody(userId, id, body) {
  db.prepare("UPDATE suggestion SET body=?, updated_at=? WHERE id=? AND user_id=?").run(String(body || "").slice(0, 2000), Date.now(), id, userId);
}
export function approve(userId, id) {
  db.prepare("UPDATE suggestion SET status='approved', updated_at=? WHERE id=? AND user_id=? AND status='pending'").run(Date.now(), id, userId);
  return get(userId, id);
}
export function dismiss(userId, id) {
  db.prepare("UPDATE suggestion SET status='dismissed', updated_at=? WHERE id=? AND user_id=? AND status='pending'").run(Date.now(), id, userId);
  return get(userId, id);
}

// Jobs that look "won" (deal happened) and don't yet have a review-request card —
// the candidates for an AI-drafted "ask for a review" suggestion.
export function reviewCandidates(userId, limit = 10) {
  return db.prepare(
    `SELECT id, title, customer FROM job
     WHERE user_id=? AND COALESCE(customer,'')<>'' AND status IN ('signed','scheduled')
       AND id NOT IN (SELECT json_extract(context,'$.jobId') FROM suggestion WHERE user_id=? AND type='review_request')
     ORDER BY updated_at DESC LIMIT ?`
  ).all(userId, userId, limit);
}
