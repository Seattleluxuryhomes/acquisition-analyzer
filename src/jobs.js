// Job persistence + ownership. Every read/write is scoped to the owner (hard
// rule #5). Lines/upgrades/assumptions/exclusions are stored as JSON columns and
// hydrated to arrays on the way out.
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => crypto.randomBytes(9).toString("base64url");
// Pipeline stages a job moves through.
const STATUSES = new Set(["draft", "sent", "signed", "scheduled"]);
const normStatus = (v) => (STATUSES.has(v) ? v : "draft");
const J = (v, fallback) => {
  try { const x = JSON.parse(v); return x == null ? fallback : x; } catch { return fallback; }
};

function rowToJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    from: row.from_lang,
    to: row.to_lang,
    transcript: row.transcript,
    translation: row.translation,
    summary: row.summary,
    brief: J(row.brief, null),
    assumptions: J(row.assumptions, []),
    exclusions: J(row.exclusions, []),
    lines: J(row.lines, []),
    upgrades: J(row.upgrades, []),
    permits: J(row.permits, []),  // permits this job needs (contractor-only tracking)
    notes: row.notes,        // owner-only; never sent to client surfaces
    margin: row.margin,      // owner-only; never sent to client surfaces
    status: row.status,
    scheduled_date: row.scheduled_date || "",
    scheduled_time: row.scheduled_time || "",
    address: row.address || "",
    customer: row.customer || "",
    customer_phone: row.customer_phone || "",
    deposit_pct: row.deposit_pct == null ? 25 : row.deposit_pct,
    tax_rate: row.tax_rate == null ? null : row.tax_rate,  // null = no tax set
    sent_at: row.sent_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Sanitize a sloppy line from the client into a stored shape.
function cleanLine(l) {
  return {
    id: String(l.id || uid()),
    section: String(l.section || "").slice(0, 80),
    desc: String(l.desc || "").slice(0, 200),
    type: ["hourly", "unit"].includes(l.type) ? l.type : "fixed",
    price: Number(l.price) || 0,
    hours: Number(l.hours) || 0,
    rate: Number(l.rate) || 0,
    qty: Number(l.qty) || 0,
    unit: String(l.unit || "").slice(0, 16),
    furn: l.furn === "client" ? "client" : "you",
  };
}
function cleanUpgrade(u) {
  return { id: String(u.id || uid()), desc: String(u.desc || "").slice(0, 200), price: Number(u.price) || 0 };
}
// A permit the job needs. Pure contractor-side tracking (jurisdiction, status, fee)
// — never rendered on the client proposal; the fee can be added to the bid as a line.
const PERMIT_STATUSES = ["needed", "applied", "approved", "closed"];
function cleanPermit(p) {
  return {
    id: String(p.id || uid()),
    type: String(p.type || "").slice(0, 80),               // e.g. "Building", "Electrical", "Grading"
    jurisdiction: String(p.jurisdiction || "").slice(0, 80), // city/county that issues it
    number: String(p.number || "").slice(0, 60),            // permit # once issued
    status: PERMIT_STATUSES.includes(p.status) ? p.status : "needed",
    fee: Number(p.fee) || 0,                                // permit cost (a pass-through line on the bid)
    notes: String(p.notes || "").slice(0, 300),
  };
}
const cleanStrings = (a) => (Array.isArray(a) ? a.map((s) => String(s).slice(0, 300)) : []);

// AI structured job summary (contractor-only). Stored as a JSON column; whitelist
// the fields so nothing unexpected lands in the db.
function cleanBrief(b) {
  if (!b || typeof b !== "object") return null;
  const list = (a) => (Array.isArray(a) ? a.map((s) => String(s).slice(0, 160)).filter(Boolean).slice(0, 8) : []);
  return {
    project_type: String(b.project_type || "").slice(0, 120),
    scope: list(b.scope),
    materials: list(b.materials),
    customer_supplied: list(b.customer_supplied),
    timeline: String(b.timeline || "").slice(0, 160),
    budget: String(b.budget || "").slice(0, 160),
    labor: String(b.labor || "").slice(0, 200),
  };
}

export function listJobs(userId) {
  const rows = db.prepare("SELECT * FROM job WHERE user_id=? ORDER BY updated_at DESC").all(userId);
  return rows.map(rowToJob);
}

export function getJob(userId, id) {
  const row = db.prepare("SELECT * FROM job WHERE id=? AND user_id=?").get(id, userId);
  return rowToJob(row);
}

// Create. Accepts an optional client-supplied id so an offline-created job keeps
// its local id after it syncs (avoids duplicates).
export function createJob(userId, data = {}) {
  const id = String(data.id || uid());
  const now = Date.now();
  const createdAt = Number(data.created_at) || now;
  db.prepare(`INSERT INTO job
    (id, user_id, title, from_lang, to_lang, transcript, translation, summary, brief,
     assumptions, exclusions, lines, upgrades, permits, notes, margin, status, scheduled_date, scheduled_time, address, customer, customer_phone, deposit_pct, tax_rate, sent_at, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, userId,
    String(data.title || "Untitled job"),
    String(data.from || "es"), String(data.to || "en"),
    String(data.transcript || ""), String(data.translation || ""), String(data.summary || ""),
    JSON.stringify(cleanBrief(data.brief)),
    JSON.stringify(cleanStrings(data.assumptions)),
    JSON.stringify(cleanStrings(data.exclusions)),
    JSON.stringify((Array.isArray(data.lines) ? data.lines : []).map(cleanLine)),
    JSON.stringify((Array.isArray(data.upgrades) ? data.upgrades : []).map(cleanUpgrade)),
    JSON.stringify((Array.isArray(data.permits) ? data.permits : []).map(cleanPermit)),
    String(data.notes || ""), Number(data.margin) || 0,
    normStatus(data.status),
    String(data.scheduled_date || "") || null,
    String(data.scheduled_time || "") || null,
    String(data.address || "") || null,
    String(data.customer || "") || null,
    String(data.customer_phone || "").slice(0, 40) || null,
    data.deposit_pct == null ? null : Math.max(0, Math.min(100, Math.round(Number(data.deposit_pct)) || 0)),
    data.tax_rate == null ? null : Math.max(0, Number(data.tax_rate) || 0),
    data.sent_at ? Number(data.sent_at) : null,
    createdAt, Number(data.updated_at) || now
  );
  return getJob(userId, id);
}

const FIELD_MAP = {
  title: (v) => String(v),
  from: (v) => String(v),
  to: (v) => String(v),
  transcript: (v) => String(v),
  translation: (v) => String(v),
  summary: (v) => String(v),
  brief: (v) => JSON.stringify(cleanBrief(v)),
  notes: (v) => String(v),
  margin: (v) => Number(v) || 0,
  status: (v) => normStatus(v),
  scheduled_date: (v) => String(v || ""),
  scheduled_time: (v) => String(v || "").slice(0, 5),
  address: (v) => String(v || "").slice(0, 300),
  customer: (v) => String(v || "").slice(0, 120),
  customer_phone: (v) => String(v || "").slice(0, 40),
  deposit_pct: (v) => Math.max(0, Math.min(100, Math.round(Number(v)) || 0)),
  tax_rate: (v) => (v == null ? 0 : Math.max(0, Number(v) || 0)),
  assumptions: (v) => JSON.stringify(cleanStrings(v)),
  exclusions: (v) => JSON.stringify(cleanStrings(v)),
  lines: (v) => JSON.stringify((Array.isArray(v) ? v : []).map(cleanLine)),
  upgrades: (v) => JSON.stringify((Array.isArray(v) ? v : []).map(cleanUpgrade)),
  permits: (v) => JSON.stringify((Array.isArray(v) ? v : []).map(cleanPermit)),
};
const COLUMN = { title: "title", from: "from_lang", to: "to_lang", transcript: "transcript",
  translation: "translation", summary: "summary", brief: "brief", notes: "notes", margin: "margin", status: "status",
  scheduled_date: "scheduled_date", scheduled_time: "scheduled_time", address: "address", customer: "customer", customer_phone: "customer_phone", deposit_pct: "deposit_pct", tax_rate: "tax_rate",
  assumptions: "assumptions", exclusions: "exclusions", lines: "lines", upgrades: "upgrades", permits: "permits" };

// Once a customer has accepted (signed/scheduled), that acceptance is authoritative and
// server-owned. A stale client push — e.g. an offline edit that predates the signature —
// must never downgrade the status back to draft/sent and "un-sign" the job. This is the
// server-side backstop for P1-2 (the client also honors last-write-wins, but clock skew
// across devices means the server can't rely on timestamps alone). Other fields on an
// accepted job (a typo fix, a note) still update normally.
const ACCEPTED = new Set(["signed", "scheduled"]);
const OPEN = new Set(["draft", "sent"]);

export function updateJob(userId, id, patch = {}) {
  const existing = db.prepare("SELECT status FROM job WHERE id=? AND user_id=?").get(id, userId);
  if (!existing) return null;
  const wouldUnsign = "status" in patch
    && ACCEPTED.has(existing.status)
    && OPEN.has(normStatus(patch.status));

  const sets = [];
  const vals = [];
  for (const [key, transform] of Object.entries(FIELD_MAP)) {
    if (key === "status" && wouldUnsign) continue; // keep the accepted status
    if (key in patch) { sets.push(`${COLUMN[key]} = ?`); vals.push(transform(patch[key])); }
  }
  // status -> sent stamps sent_at once (never when we're protecting an accepted status)
  if (patch.status === "sent" && !wouldUnsign) { sets.push("sent_at = COALESCE(sent_at, ?)"); vals.push(Date.now()); }
  sets.push("updated_at = ?");
  vals.push(Number(patch.updated_at) || Date.now());

  vals.push(id, userId);
  db.prepare(`UPDATE job SET ${sets.join(", ")} WHERE id=? AND user_id=?`).run(...vals);
  return getJob(userId, id);
}

export function deleteJob(userId, id) {
  const r = db.prepare("DELETE FROM job WHERE id=? AND user_id=?").run(id, userId);
  return r.changes > 0;
}

// Ownership guard used by photo/pdf routes.
export function ownsJob(userId, id) {
  return !!db.prepare("SELECT 1 FROM job WHERE id=? AND user_id=?").get(id, userId);
}

export { rowToJob };
