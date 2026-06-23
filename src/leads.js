// Leads — inbound contractor leads (website forms, ads, social, CSV, manual) that
// convert into jobs. Top of the Lead → Job → Bid → Payment funnel. Every read/write
// is owner-scoped (hard rule #5). Inbound webhooks authenticate via a per-user token.
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");

export const LEAD_STATUSES = ["New", "Contacted", "Estimate Scheduled", "Bid Sent", "Won", "Lost"];
const STATUS_SET = new Set(LEAD_STATUSES);
// Friendly source labels; anything else is title-cased through as-is.
const SOURCES = ["Website", "Facebook", "Instagram", "Google", "Referral", "CSV", "Manual", "Other"];

function cleanLead(d = {}) {
  const src = String(d.source || "").trim().slice(0, 40);
  const status = String(d.status || "New").trim();
  return {
    name: String(d.name || "").trim().slice(0, 120),
    phone: String(d.phone || "").trim().slice(0, 40),
    email: String(d.email || "").trim().slice(0, 160),
    source: src || "Manual",
    job_type: String(d.job_type || d.jobType || "").trim().slice(0, 80),
    city: String(d.city || d.address || "").trim().slice(0, 200),
    message: String(d.message || d.notes || "").trim().slice(0, 2000),
    status: STATUS_SET.has(status) ? status : "New",
  };
}

function rowToLead(r) {
  return r && { id: r.id, name: r.name || "", phone: r.phone || "", email: r.email || "",
    source: r.source || "", job_type: r.job_type || "", city: r.city || "", message: r.message || "",
    status: r.status || "New", job_id: r.job_id || null, created_at: r.created_at, updated_at: r.updated_at };
}

export function listLeads(userId) {
  return db.prepare("SELECT * FROM lead WHERE user_id=? ORDER BY created_at DESC").all(userId).map(rowToLead);
}
export function getLead(userId, id) {
  return rowToLead(db.prepare("SELECT * FROM lead WHERE id=? AND user_id=?").get(id, userId));
}
export function countNew(userId) {
  return db.prepare("SELECT COUNT(*) c FROM lead WHERE user_id=? AND status='New'").get(userId).c;
}

export function createLead(userId, data) {
  const s = cleanLead(data);
  const id = uid(), now = Date.now();
  db.prepare(`INSERT INTO lead (id,user_id,name,phone,email,source,job_type,city,message,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, userId, s.name, s.phone, s.email, s.source, s.job_type, s.city, s.message, s.status, now, now);
  return getLead(userId, id);
}

// Bulk import (CSV rows). De-dupe against existing by phone/email so re-imports
// don't pile up. Skips fully-empty rows.
export function bulkCreate(userId, items) {
  const existing = new Set(listLeads(userId).map((l) => (l.phone || l.email || l.name).toLowerCase()).filter(Boolean));
  let added = 0;
  for (const raw of (Array.isArray(items) ? items : []).slice(0, 1000)) {
    const s = cleanLead(raw);
    if (!s.name && !s.phone && !s.email) continue;
    const key = (s.phone || s.email || s.name).toLowerCase();
    if (key && existing.has(key)) continue;
    if (key) existing.add(key);
    createLead(userId, s);
    added++;
  }
  return { added };
}

export function updateLead(userId, id, patch = {}) {
  const row = db.prepare("SELECT * FROM lead WHERE id=? AND user_id=?").get(id, userId);
  if (!row) return null;
  const s = cleanLead({ ...rowToLead(row), ...patch });
  db.prepare("UPDATE lead SET name=?,phone=?,email=?,source=?,job_type=?,city=?,message=?,status=?,updated_at=? WHERE id=? AND user_id=?")
    .run(s.name, s.phone, s.email, s.source, s.job_type, s.city, s.message, s.status, Date.now(), id, userId);
  return getLead(userId, id);
}

export function setStatus(userId, id, status) {
  if (!STATUS_SET.has(status)) return null;
  const r = db.prepare("UPDATE lead SET status=?, updated_at=? WHERE id=? AND user_id=?").run(status, Date.now(), id, userId);
  return r.changes > 0 ? getLead(userId, id) : null;
}

// Link a converted lead to the job it became, and advance its status.
export function linkJob(userId, id, jobId) {
  db.prepare("UPDATE lead SET job_id=?, status='Estimate Scheduled', updated_at=? WHERE id=? AND user_id=?")
    .run(jobId, Date.now(), id, userId);
  return getLead(userId, id);
}

export function deleteLead(userId, id) {
  return db.prepare("DELETE FROM lead WHERE id=? AND user_id=?").run(id, userId).changes > 0;
}

// Per-user inbound webhook token (for n8n / website forms). Created on demand.
export function getOrCreateToken(userId) {
  const row = db.prepare("SELECT lead_token FROM user WHERE id=?").get(userId);
  if (row && row.lead_token) return row.lead_token;
  const token = "lt_" + crypto.randomBytes(18).toString("base64url");
  db.prepare("UPDATE user SET lead_token=? WHERE id=?").run(token, userId);
  return token;
}
export function rotateToken(userId) {
  const token = "lt_" + crypto.randomBytes(18).toString("base64url");
  db.prepare("UPDATE user SET lead_token=? WHERE id=?").run(token, userId);
  return token;
}
export function userIdForToken(token) {
  if (!token || typeof token !== "string") return null;
  const row = db.prepare("SELECT id FROM user WHERE lead_token=?").get(token);
  return row ? row.id : null;
}

// Normalize a loose inbound payload (n8n / Zapier / form) into our lead shape.
// Accepts common field-name variants so integrations need little mapping.
export function normalizeInbound(body = {}) {
  const g = (...keys) => { for (const k of keys) { if (body[k] != null && String(body[k]).trim()) return String(body[k]); } return ""; };
  const fullName = g("name", "full_name", "fullName", "Name") ||
    [g("first_name", "firstName"), g("last_name", "lastName")].filter(Boolean).join(" ");
  return cleanLead({
    name: fullName,
    phone: g("phone", "phone_number", "phoneNumber", "Phone", "mobile"),
    email: g("email", "Email", "email_address"),
    source: g("source", "platform", "channel", "lead_source") || "Website",
    job_type: g("job_type", "jobType", "service", "project_type", "category"),
    city: g("city", "address", "location", "zip", "postal_code"),
    message: g("message", "notes", "description", "details", "comments", "body"),
  });
}
