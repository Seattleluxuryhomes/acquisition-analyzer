// Referral credit ledger — the deterministic, auditable heart of the referral system
// (Commercial Architecture v1.0 §5). Give-a-month / get-a-month:
//   • The referred company gets their first month free (a once-100%-off coupon at
//     checkout, recorded here as a 'referee_welcome' credit for audit).
//   • The referrer earns ONE month of credit once the referred company pays their
//     SECOND invoice (completes month two as a paying customer) — a 'referrer_reward'.
//   • Capped at 12 referrer rewards per CALENDAR year. Credits never expire while the
//     subscription is active, apply to future invoices only, never reduce an invoice
//     below $0 (Stripe floors it), are non-transferable, and are never cash.
//
// This module is PURE (db + math) — it holds the ledger and the rules. billing.js owns
// the Stripe side (the customer-balance credit that actually moves the money) and calls
// in here to record and gate. Every credit is one immutable row: auditable end to end.
import crypto from "node:crypto";
import db from "./db.js";

const uid = () => "rc_" + crypto.randomBytes(9).toString("base64url");
export const YEARLY_REWARD_CAP = 12;

// Calendar year of an epoch-ms timestamp (defaults to now). Kept explicit so the cap
// window is unambiguous and testable.
export function yearOf(ms) { return new Date(ms == null ? Date.now() : ms).getUTCFullYear(); }

// How many referrer rewards this user has EARNED in the given calendar year (the cap
// window). Voided rows don't count against the cap.
export function rewardsEarnedInYear(userId, year) {
  return db.prepare(
    "SELECT COUNT(*) c FROM referral_credit WHERE user_id=? AND kind='referrer_reward' AND year=? AND status!='void'"
  ).get(userId, year).c;
}

export function capReached(userId, year) {
  return rewardsEarnedInYear(userId, year == null ? yearOf() : year) >= YEARLY_REWARD_CAP;
}

// Has this referred company already triggered its one referrer reward / claimed its
// one welcome credit? (Enforced additionally by a UNIQUE index — this is the fast path.)
export function rewardExistsFor(refereeId) {
  return !!db.prepare("SELECT 1 FROM referral_credit WHERE referee_id=? AND kind='referrer_reward'").get(refereeId);
}
export function welcomeExistsFor(refereeId) {
  return !!db.prepare("SELECT 1 FROM referral_credit WHERE referee_id=? AND kind='referee_welcome'").get(refereeId);
}

// Insert an immutable ledger row. Idempotent: a duplicate (same referee_id + kind) is a
// no-op thanks to the UNIQUE index, so double-fired webhooks can't double-grant. Returns
// the new row, or null when it already existed.
export function record({ userId, kind, refereeId = null, amountCents, reason = "", stripeTxnId = null, status = "earned" }) {
  if (!userId || !kind || !(amountCents > 0)) return null;
  const id = uid(), now = Date.now();
  try {
    db.prepare(
      `INSERT INTO referral_credit (id,user_id,kind,referee_id,amount_cents,currency,status,stripe_txn_id,reason,year,created_at,applied_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(id, userId, kind, refereeId, Math.round(amountCents), "usd", status,
          stripeTxnId, reason, yearOf(now), now, status === "applied" ? now : null);
  } catch (e) {
    // UNIQUE(referee_id, kind) violation → already granted. Idempotent no-op.
    if (String(e && e.message || "").includes("UNIQUE")) return null;
    throw e;
  }
  return db.prepare("SELECT * FROM referral_credit WHERE id=?").get(id);
}

// Stamp the Stripe balance-transaction id / applied state after Stripe accepts the credit.
export function markApplied(id, stripeTxnId) {
  db.prepare("UPDATE referral_credit SET status='applied', stripe_txn_id=COALESCE(?,stripe_txn_id), applied_at=? WHERE id=?")
    .run(stripeTxnId || null, Date.now(), id);
}
export function attachTxn(id, stripeTxnId) {
  db.prepare("UPDATE referral_credit SET stripe_txn_id=? WHERE id=?").run(stripeTxnId || null, id);
}

// The full ledger for one user (newest first) — the audit trail surfaced in-app + API.
export function ledgerFor(userId) {
  return db.prepare("SELECT * FROM referral_credit WHERE user_id=? ORDER BY created_at DESC").all(userId);
}

// Compact status for the paywall / referral screen: how many rewards earned this year,
// how many remain under the cap, and the lifetime credit total (for "you've earned N
// months"). Dollar amounts are in cents.
export function summary(userId) {
  const year = yearOf();
  const rows = ledgerFor(userId);
  const rewards = rows.filter((r) => r.kind === "referrer_reward" && r.status !== "void");
  const earnedThisYear = rewards.filter((r) => r.year === year).length;
  const lifetimeCents = rewards.reduce((s, r) => s + (r.amount_cents || 0), 0);
  return {
    year,
    earnedThisYear,
    yearlyCap: YEARLY_REWARD_CAP,
    remainingThisYear: Math.max(0, YEARLY_REWARD_CAP - earnedThisYear),
    capReached: earnedThisYear >= YEARLY_REWARD_CAP,
    lifetimeRewards: rewards.length,
    lifetimeCents,
  };
}
