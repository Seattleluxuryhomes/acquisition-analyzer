// Referral credit — the pricing engine. Base $50/mo; every PAYING contractor a GC
// brings on knocks $10 off, down to $0 at five. Self-correcting: if a referred sub
// stops paying, the credit comes off and the bill goes back up — "free as long as
// your crew is active." Founders can be rate-locked (their base price never moves
// when the public price rises).
//
// This module is PURE (db + math) — no Stripe. billing.js reads effectiveMonthly()
// and applies the discount at checkout / on subscription changes.
import crypto from "node:crypto";
import db from "./db.js";

export const BASE_PRICE = () => Number(process.env.BT_BASE_PRICE || 50);     // dollars/mo
export const CREDIT_PER_REF = () => Number(process.env.BT_REFERRAL_CREDIT || 10); // dollars off per paying sub
export const freeAt = () => Math.ceil(BASE_PRICE() / CREDIT_PER_REF());       // subs needed to reach $0 (5)

// A GC's own base price — the founder rate-lock pins it; otherwise it's the live base.
function baseFor(user) {
  return user && user.locked_monthly != null ? Number(user.locked_monthly) : BASE_PRICE();
}

// Real-estate agents get their first year free, then a locked $50 forever. While the
// free year is active, the account pays $0 regardless of base/credit. This is the
// distribution channel: agents walk houses and RFQ their contractors into the app.
export function agentFreeActive(user) {
  return !!(user && user.agent_free_until && Date.now() < Number(user.agent_free_until));
}
const DAY = 24 * 60 * 60 * 1000;
// Status block for an agent account (null for non-agents) — drives the in-app
// "free year" banner and the T-90 retention nudge.
export function agentStatus(user) {
  if (!user || user.role !== "agent") return null;
  const until = user.agent_free_until ? Number(user.agent_free_until) : null;
  const active = agentFreeActive(user);
  const daysLeft = until ? Math.max(0, Math.ceil((until - Date.now()) / DAY)) : 0;
  return {
    is_agent: true,
    free_until: until,
    free_active: active,
    days_left: daysLeft,
    nudge: active && daysLeft <= 90,   // surface "your free year is ending" inside 90 days
    after_monthly: baseFor(user),      // what they pay once the free year ends ($50 locked)
  };
}

// Paying subs this GC brought on. "Paying" = an active Stripe subscription (a sub
// still in their free trial doesn't count yet — the credit is for real revenue).
export function payingReferrals(userId) {
  return db.prepare("SELECT COUNT(*) c FROM user WHERE referred_by=? AND subscription_status='active'").get(userId).c;
}

// What this GC actually pays per month, after credit, floored at $0. Agents inside
// their free first year pay $0 (the credit ladder still applies after it ends).
export function effectiveMonthly(user) {
  if (agentFreeActive(user)) return 0;
  const base = baseFor(user);
  return Math.max(0, base - CREDIT_PER_REF() * payingReferrals(user.id));
}

export function getOrCreateCode(userId) {
  const row = db.prepare("SELECT referral_code FROM user WHERE id=?").get(userId);
  if (row && row.referral_code) return row.referral_code;
  const code = crypto.randomBytes(5).toString("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 7) || crypto.randomBytes(4).toString("hex");
  db.prepare("UPDATE user SET referral_code=? WHERE id=?").run(code, userId);
  return code;
}

export function userIdForCode(code) {
  if (!code || typeof code !== "string") return null;
  const row = db.prepare("SELECT id FROM user WHERE referral_code=?").get(code.trim());
  return row ? row.id : null;
}

// Attribute a brand-new user to the referrer whose code they came in on. One-time,
// no self-referral, never overwrites an existing attribution.
export function setReferrer(newUserId, code) {
  const refId = userIdForCode(code);
  if (!refId || refId === newUserId) return false;
  const me = db.prepare("SELECT referred_by FROM user WHERE id=?").get(newUserId);
  if (!me || me.referred_by) return false;
  db.prepare("UPDATE user SET referred_by=? WHERE id=?").run(refId, newUserId);
  return true;
}

// Founder rate-lock: pin a GC's base price (e.g. the launch price) forever. Pass
// null to clear. They still earn the per-sub credit on top of the locked base.
export function setLockedPrice(userId, dollars) {
  db.prepare("UPDATE user SET locked_monthly=? WHERE id=?").run(dollars == null ? null : Number(dollars), userId);
}

// Everything the paywall/billing screen needs to show the ladder.
export function referralStatus(user) {
  const base = baseFor(user);
  const refs = payingReferrals(user.id);
  const effective = Math.max(0, base - CREDIT_PER_REF() * refs);
  const need = freeAt();
  return {
    code: getOrCreateCode(user.id),
    base,                                   // their base (locked or live)
    creditPerRef: CREDIT_PER_REF(),
    payingReferrals: refs,
    credit: base - effective,               // dollars off this month
    effective,                              // what they pay
    free: effective === 0,
    freeAt: need,                           // subs to reach $0 (5)
    remainingToFree: Math.max(0, need - refs),
    locked: user.locked_monthly != null,
  };
}
