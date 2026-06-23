// Price book — a contractor's reusable catalog of materials/labor SKUs. Uploaded
// (paste / CSV / photo of a supplier sheet) and organized by AI, then dropped into
// bids as line items. Every read/write is scoped to the owner (hard rule #5).
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");
// Units a bid line understands (kept in sync with the front-end UNITS list).
export const UNITS = ["each", "sq ft", "ln ft", "sq yd", "cu yd", "ton", "gal", "hr", "box", "roll", "pallet", "board ft", "slab"];
const UNIT_SET = new Set(UNITS);

function cleanSku(s = {}) {
  const unit = String(s.unit || "each").toLowerCase().trim();
  return {
    name: String(s.name || "").trim().slice(0, 160),
    sku_code: String(s.sku_code || s.code || "").trim().slice(0, 60),
    category: String(s.category || "").trim().slice(0, 80),
    unit: UNIT_SET.has(unit) ? unit : "each",
    unit_price: Math.max(0, Number(s.unit_price ?? s.price) || 0),
  };
}

function rowToSku(r) {
  return r && { id: r.id, name: r.name, sku_code: r.sku_code || "", category: r.category || "",
    unit: r.unit || "each", unit_price: r.unit_price || 0, created_at: r.created_at, updated_at: r.updated_at };
}

export function listSkus(userId, q) {
  const term = String(q || "").trim().toLowerCase();
  const rows = db.prepare("SELECT * FROM sku WHERE user_id=? ORDER BY category, name").all(userId);
  const all = rows.map(rowToSku);
  if (!term) return all;
  return all.filter((s) => (s.name + " " + s.category + " " + s.sku_code).toLowerCase().includes(term));
}

export function countSkus(userId) {
  return db.prepare("SELECT COUNT(*) c FROM sku WHERE user_id=?").get(userId).c;
}

export function createSku(userId, data) {
  const s = cleanSku(data);
  if (!s.name) { const e = new Error("A SKU needs a name."); e.status = 400; throw e; }
  const id = uid(), now = Date.now();
  db.prepare(`INSERT INTO sku (id,user_id,name,sku_code,category,unit,unit_price,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, userId, s.name, s.sku_code, s.category, s.unit, s.unit_price, now, now);
  return rowToSku(db.prepare("SELECT * FROM sku WHERE id=?").get(id));
}

// Bulk import the AI-organized rows. Skips blank names; de-dupes against existing
// rows with the same name+unit so re-importing a sheet doesn't pile up duplicates.
export function bulkCreate(userId, items) {
  const existing = new Set(listSkus(userId).map((s) => (s.name + "|" + s.unit).toLowerCase()));
  const now = Date.now();
  const ins = db.prepare(`INSERT INTO sku (id,user_id,name,sku_code,category,unit,unit_price,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  let added = 0;
  for (const raw of (Array.isArray(items) ? items : []).slice(0, 1000)) {
    const s = cleanSku(raw);
    if (!s.name) continue;
    const key = (s.name + "|" + s.unit).toLowerCase();
    if (existing.has(key)) continue;
    existing.add(key);
    ins.run(uid(), userId, s.name, s.sku_code, s.category, s.unit, s.unit_price, now, now);
    added++;
  }
  return { added };
}

export function updateSku(userId, id, patch) {
  const row = db.prepare("SELECT * FROM sku WHERE id=? AND user_id=?").get(id, userId);
  if (!row) return null;
  const s = cleanSku({ ...rowToSku(row), ...patch });
  if (!s.name) { const e = new Error("A SKU needs a name."); e.status = 400; throw e; }
  db.prepare("UPDATE sku SET name=?,sku_code=?,category=?,unit=?,unit_price=?,updated_at=? WHERE id=? AND user_id=?")
    .run(s.name, s.sku_code, s.category, s.unit, s.unit_price, Date.now(), id, userId);
  return rowToSku(db.prepare("SELECT * FROM sku WHERE id=?").get(id));
}

export function deleteSku(userId, id) {
  return db.prepare("DELETE FROM sku WHERE id=? AND user_id=?").run(id, userId).changes > 0;
}
