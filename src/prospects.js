// Prospect CRM — save searched prospects, work them through the outbound pipeline.
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");
export const STATUSES = ["new", "contacted", "interested", "demo_booked", "converted", "not_interested"];

function rowTo(r) {
  if (!r) return null;
  let raw = {}; try { raw = JSON.parse(r.raw || "{}"); } catch { raw = {}; }
  return {
    id: r.id, name: r.name || "", contact_name: r.contact_name || "", trade: r.trade || "",
    business_type: r.business_type || "", phone: r.phone || "", email: r.email || "", website: r.website || "",
    address: r.address || "", city: r.city || "", state: r.state || "",
    status: r.status || "new", source: r.source || "manual", notes: r.notes || "", raw,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

const dedupeKey = (p) => (p.phone || p.email || (p.name + "|" + (p.city || "")) || uid()).toLowerCase().trim();

// Save one or many prospects. Idempotent per dedupe_key, so re-saving the same
// business from a fresh search won't create duplicates. Returns the saved rows.
export function save(userId, prospects) {
  const arr = Array.isArray(prospects) ? prospects : [prospects];
  const out = [];
  for (const p of arr) {
    if (!p || (!p.name && !p.phone && !p.email)) continue;
    const id = uid(), now = Date.now();
    const status = STATUSES.includes(p.status) ? p.status : "new";
    try {
      db.prepare(`INSERT INTO prospect
        (id,user_id,name,contact_name,trade,business_type,phone,email,website,address,city,state,status,source,notes,raw,dedupe_key,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, userId, String(p.name || "").slice(0, 200), String(p.contact_name || "").slice(0, 160),
        String(p.trade || "").slice(0, 80), String(p.business_type || "").slice(0, 80),
        String(p.phone || "").slice(0, 40), String(p.email || "").slice(0, 160), String(p.website || "").slice(0, 200),
        String(p.address || "").slice(0, 200), String(p.city || "").slice(0, 80), String(p.state || "").slice(0, 40),
        status, String(p.source || "manual").slice(0, 40), String(p.notes || "").slice(0, 2000),
        JSON.stringify(p.raw || {}), dedupeKey(p), now, now);
      out.push(rowTo(db.prepare("SELECT * FROM prospect WHERE id=?").get(id)));
    } catch { /* dedupe collision — already saved */ }
  }
  return out;
}

export function list(userId, status) {
  const rows = status && STATUSES.includes(status)
    ? db.prepare("SELECT * FROM prospect WHERE user_id=? AND status=? ORDER BY created_at DESC").all(userId, status)
    : db.prepare("SELECT * FROM prospect WHERE user_id=? ORDER BY created_at DESC").all(userId);
  return rows.map(rowTo);
}
export function counts(userId) {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of db.prepare("SELECT status, COUNT(*) c FROM prospect WHERE user_id=? GROUP BY status").all(userId)) {
    if (r.status in out) out[r.status] = r.c;
  }
  return out;
}
export function update(userId, id, patch = {}) {
  const sets = [], vals = [];
  if (patch.status != null && STATUSES.includes(patch.status)) { sets.push("status=?"); vals.push(patch.status); }
  if (typeof patch.notes === "string") { sets.push("notes=?"); vals.push(patch.notes.slice(0, 2000)); }
  if (!sets.length) return get(userId, id);
  sets.push("updated_at=?"); vals.push(Date.now());
  vals.push(id, userId);
  db.prepare(`UPDATE prospect SET ${sets.join(", ")} WHERE id=? AND user_id=?`).run(...vals);
  return get(userId, id);
}
export function get(userId, id) { return rowTo(db.prepare("SELECT * FROM prospect WHERE id=? AND user_id=?").get(id, userId)); }
export function remove(userId, id) { return db.prepare("DELETE FROM prospect WHERE id=? AND user_id=?").run(id, userId).changes > 0; }
