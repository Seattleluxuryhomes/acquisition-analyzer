// Private vendor book — a contractor's own suppliers/vendors, reachable in one tap
// from any job. Single-player CRM (mirrors prospects.js): each row is owned by one
// user and never shared. The dormant shared/verified columns let this become a shared
// directory later without a migration. Dedupe keeps re-adding the same supplier clean.
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");

function rowTo(r) {
  if (!r) return null;
  return {
    id: r.id, name: r.name || "", contact_name: r.contact_name || "", trade: r.trade || "",
    materials: r.materials || "", phone: r.phone || "", email: r.email || "", website: r.website || "",
    address: r.address || "", notes: r.notes || "",
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

const dedupeKey = (v) => (v.phone || v.email || (v.name + "|" + (v.trade || "")) || uid()).toLowerCase().trim();

// Save one or many vendors. Idempotent per dedupe_key so re-adding the same supplier
// won't create duplicates. Returns the saved rows.
export function save(userId, vendors) {
  const arr = Array.isArray(vendors) ? vendors : [vendors];
  const out = [];
  for (const v of arr) {
    if (!v || (!v.name && !v.phone && !v.email)) continue;
    const id = uid(), now = Date.now();
    try {
      db.prepare(`INSERT INTO vendor
        (id,user_id,name,contact_name,trade,materials,phone,email,website,address,notes,dedupe_key,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id, userId, String(v.name || "").slice(0, 200), String(v.contact_name || "").slice(0, 160),
        String(v.trade || "").slice(0, 80), String(v.materials || "").slice(0, 600),
        String(v.phone || "").slice(0, 40), String(v.email || "").slice(0, 160), String(v.website || "").slice(0, 200),
        String(v.address || "").slice(0, 200), String(v.notes || "").slice(0, 2000),
        dedupeKey(v), now, now);
      out.push(rowTo(db.prepare("SELECT * FROM vendor WHERE id=?").get(id)));
    } catch { /* dedupe collision — already in the book */ }
  }
  return out;
}

export function list(userId, q) {
  const rows = db.prepare("SELECT * FROM vendor WHERE user_id=? ORDER BY name COLLATE NOCASE ASC, created_at DESC").all(userId).map(rowTo);
  const term = String(q || "").trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((v) => [v.name, v.trade, v.materials, v.contact_name].join(" ").toLowerCase().includes(term));
}
export function get(userId, id) { return rowTo(db.prepare("SELECT * FROM vendor WHERE id=? AND user_id=?").get(id, userId)); }

export function update(userId, id, patch = {}) {
  const fields = ["name", "contact_name", "trade", "materials", "phone", "email", "website", "address", "notes"];
  const lim = { name: 200, contact_name: 160, trade: 80, materials: 600, phone: 40, email: 160, website: 200, address: 200, notes: 2000 };
  const sets = [], vals = [];
  for (const f of fields) {
    if (typeof patch[f] === "string") { sets.push(`${f}=?`); vals.push(patch[f].slice(0, lim[f])); }
  }
  if (!sets.length) return get(userId, id);
  sets.push("updated_at=?"); vals.push(Date.now());
  vals.push(id, userId);
  db.prepare(`UPDATE vendor SET ${sets.join(", ")} WHERE id=? AND user_id=?`).run(...vals);
  return get(userId, id);
}
export function remove(userId, id) { return db.prepare("DELETE FROM vendor WHERE id=? AND user_id=?").run(id, userId).changes > 0; }
export function count(userId) { return db.prepare("SELECT COUNT(*) c FROM vendor WHERE user_id=?").get(userId).c; }
