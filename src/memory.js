// Bid Brain memory — the contractor's private, per-account AI memory.
//
// Design goals (Milestone 1):
// - Scalable: a key/value store, so new memory types are new keys, never a schema
//   change. M1 actively learns 4 things (language, last trade, recent services,
//   typical markup) and the schema already supports the rest.
// - Isolated: every read/write is scoped to one user_id. Contractors never share
//   memory — same ownership rule as the rest of the app.
// - Smarter every job: learnFromEstimate() is called whenever a contractor builds
//   an estimate, so the AI accumulates real signal from real work.
import db from "./db.js";

const HAS_BID = "lines IS NOT NULL AND lines <> '[]' AND lines <> ''";

// ---- raw key/value (always scoped to the contractor) ----
export function getMemory(userId) {
  const out = {};
  if (!userId) return out;
  for (const r of db.prepare("SELECT key, value FROM memory WHERE user_id=?").all(userId)) {
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
  }
  return out;
}
export function setMemory(userId, key, value) {
  if (!userId || !key) return;
  db.prepare(
    "INSERT INTO memory (user_id, key, value, updated_at) VALUES (?,?,?,?) " +
    "ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at"
  ).run(userId, String(key).slice(0, 60), JSON.stringify(value ?? null), Date.now());
}

// ---- learning: called every time a contractor builds an estimate ----
// Captures the signals we surface in M1. Safe to call fire-and-forget; never throws.
export function learnFromEstimate(userId, { trade, fromLang, toLang } = {}) {
  try {
    if (!userId) return;
    const mem = getMemory(userId);
    if (fromLang || toLang) {
      const prev = mem.preferred_language || {};
      setMemory(userId, "preferred_language", { from: fromLang || prev.from || "es", to: toLang || prev.to || "en" });
    }
    if (trade) {
      setMemory(userId, "last_trade", trade);
      const recent = Array.isArray(mem.recent_services) ? mem.recent_services.filter((t) => t !== trade) : [];
      recent.unshift(trade);
      setMemory(userId, "recent_services", recent.slice(0, 6));
    }
  } catch { /* memory must never break a request */ }
}

// ---- derived signal (computed from real data when not explicitly captured) ----
export function typicalMarkup(userId) {
  const r = db.prepare(`SELECT AVG(margin) m, COUNT(*) c FROM job WHERE user_id=? AND (${HAS_BID})`).get(userId);
  if (!r || !r.c) return null;
  return Math.round(Number(r.m) || 0);
}

// ---- greeting counts (live business data only — no placeholder stats) ----
// Job statuses: draft | sent | signed | scheduled.
export function greetingCounts(userId) {
  const active = db.prepare(`SELECT COUNT(*) c FROM job WHERE user_id=? AND (${HAS_BID}) AND status='draft'`).get(userId).c;
  const awaiting = db.prepare("SELECT COUNT(*) c FROM job WHERE user_id=? AND status='sent'").get(userId).c;
  // A "sent" estimate older than 3 days needs a nudge (matches the app's follow-up rule).
  const followups = db.prepare("SELECT COUNT(*) c FROM job WHERE user_id=? AND status='sent' AND COALESCE(sent_at, updated_at) < ?")
    .get(userId, Date.now() - 3 * 86400000).c;
  return { activeEstimates: active, awaitingSignature: awaiting, followupsDue: followups };
}

// ---- business snapshot: the context Bid Brain "remembers" about this contractor ----
// Everything here is scoped to one user_id (ownership rule) and is the contractor's
// OWN data, so it's safe to feed their private assistant — margin included (the chat
// is contractor-only and never reaches a client). Compact on purpose: it rides in the
// AI prompt every turn, so it stays a tight, recent slice of the business.
function jobTotal(linesJson) {
  let lines; try { lines = JSON.parse(linesJson || "[]"); } catch { return 0; }
  if (!Array.isArray(lines)) return 0;
  return Math.round(lines.reduce((sum, l) => {
    const t = l && l.type;
    if (t === "hourly") return sum + (Number(l.hours) || 0) * (Number(l.rate) || 0);
    if (t === "unit") return sum + (Number(l.qty) || 0) * (Number(l.rate) || 0);
    return sum + (Number(l.price) || 0);
  }, 0));
}
export function businessSnapshot(userId, user) {
  const now = Date.now(), day = 86400000;
  const rows = db.prepare(
    "SELECT id, customer, address, title, status, lines, margin, scheduled_date, scheduled_time, " +
    "summary, sent_at, updated_at, created_at FROM job WHERE user_id=? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 14"
  ).all(userId);
  const jobs = rows.map((j) => {
    const hasBid = j.lines && j.lines !== "[]" && j.lines !== "";
    const ageDays = Math.floor((now - (j.sent_at || j.updated_at || j.created_at || now)) / day);
    return {
      id: j.id,
      customer: (j.customer || "").slice(0, 80),
      title: (j.title || "").slice(0, 100),
      address: (j.address || "").slice(0, 120),
      status: j.status || "draft",
      total: hasBid ? jobTotal(j.lines) : 0,
      scheduled: j.scheduled_date ? (j.scheduled_date + (j.scheduled_time ? " " + j.scheduled_time : "")) : "",
      ageDays,
      summary: (j.summary || "").slice(0, 160),
    };
  });
  // distinct recent customers (most-recent first)
  const seen = new Set(), customers = [];
  for (const j of jobs) { const c = j.customer.trim(); if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); customers.push(c); } }
  const b = brain(userId, user);
  return {
    company: (user && (user.company || user.name)) || "",
    counts: b.greeting,
    typical_markup: b.memory.typical_markup,
    last_trade: b.memory.last_trade,
    recent_customers: customers.slice(0, 10),
    jobs,
  };
}

// ---- the full Bid Brain snapshot for /api/brain ----
export function brain(userId, user) {
  const mem = getMemory(userId);
  const markup = mem.typical_markup != null ? mem.typical_markup : typicalMarkup(userId);
  const lang = mem.preferred_language || {
    from: (user && user.default_from_lang) || "es",
    to: (user && user.default_to_lang) || "en",
  };
  return {
    greeting: greetingCounts(userId),
    memory: {
      preferred_language: lang,
      last_trade: mem.last_trade || null,
      recent_services: Array.isArray(mem.recent_services) ? mem.recent_services : [],
      typical_markup: markup,
    },
  };
}
