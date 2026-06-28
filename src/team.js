// Team / subs — a contractor's crew, and the viral engine. A GC adds his subs and
// sends each the app; every signup seeds up to 5 warm invites to his own crew, who
// each become contractors who invite their crew. Owner-scoped (hard rule #5).
//
// A sub here is just the roster + invite state. The free "sub seat" that lets a sub
// RECEIVE dispatched scope of work (in their language) is the next layer; this
// module is the front door (add + invite + track), which is the part that goes
// viral. The bid/payment engine stays gated by billing for everyone.
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");

// The crew-referral target — "send it to five of your subs."
export const INVITE_TARGET = 5;

function cleanSub(d = {}) {
  return {
    name: String(d.name || "").trim().slice(0, 120),
    phone: String(d.phone || "").trim().slice(0, 40),
    trade: String(d.trade || "").trim().slice(0, 40),
    lang: String(d.lang || "").trim().slice(0, 8),
  };
}

function rowToSub(r) {
  return r && {
    id: r.id, name: r.name || "", phone: r.phone || "", trade: r.trade || "",
    lang: r.lang || "", status: r.status || "added", invited_at: r.invited_at || null,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

export function listSubs(userId) {
  return db.prepare("SELECT * FROM sub WHERE user_id=? ORDER BY created_at DESC").all(userId).map(rowToSub);
}

export function getSub(userId, id) {
  return rowToSub(db.prepare("SELECT * FROM sub WHERE id=? AND user_id=?").get(id, userId));
}

// How many subs the GC has actually invited (sent the app to) — drives the
// "X of 5 invited" progress and the onboarding nudge.
export function counts(userId) {
  const total = db.prepare("SELECT COUNT(*) c FROM sub WHERE user_id=?").get(userId).c;
  const invited = db.prepare("SELECT COUNT(*) c FROM sub WHERE user_id=? AND status IN ('invited','joined')").get(userId).c;
  return { total, invited, target: INVITE_TARGET };
}

export function createSub(userId, data) {
  const s = cleanSub(data);
  const id = uid(), now = Date.now();
  db.prepare(`INSERT INTO sub (id,user_id,name,phone,trade,lang,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?, 'added', ?, ?)`)
    .run(id, userId, s.name, s.phone, s.trade, s.lang, now, now);
  return getSub(userId, id);
}

export function updateSub(userId, id, patch = {}) {
  const row = db.prepare("SELECT * FROM sub WHERE id=? AND user_id=?").get(id, userId);
  if (!row) return null;
  const s = cleanSub({ ...rowToSub(row), ...patch });
  db.prepare("UPDATE sub SET name=?,phone=?,trade=?,lang=?,updated_at=? WHERE id=? AND user_id=?")
    .run(s.name, s.phone, s.trade, s.lang, Date.now(), id, userId);
  return getSub(userId, id);
}

// Mark that the GC sent this sub the app (the invite went out). Idempotent — a
// re-send keeps the first invited_at but stays 'invited'.
export function markInvited(userId, id) {
  const row = db.prepare("SELECT * FROM sub WHERE id=? AND user_id=?").get(id, userId);
  if (!row) return null;
  const now = Date.now();
  const status = row.status === "joined" ? "joined" : "invited";
  db.prepare("UPDATE sub SET status=?, invited_at=COALESCE(invited_at, ?), updated_at=? WHERE id=? AND user_id=?")
    .run(status, now, now, id, userId);
  return getSub(userId, id);
}

export function deleteSub(userId, id) {
  return db.prepare("DELETE FROM sub WHERE id=? AND user_id=?").run(id, userId).changes > 0;
}
