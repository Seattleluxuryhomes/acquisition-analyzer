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
