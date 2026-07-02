// Referral attribution + company pricing basics.
//
// Commercial Architecture v1.0: BidVoice is ONE subscription PER COMPANY with unlimited
// internal users — never per-seat, never a price that moves when someone else churns.
// The old "crew network" model (−$10 per paying sub, free at five, re-synced on every
// churn) is GONE — it was the exact "someone's bill changes when someone else churns"
// pattern the architecture rejects (§5). Referral rewards now live in the deterministic
// credit ledger (referralCredits.js + billing.js): give-a-month / get-a-month, capped.
//
// What remains here: referral-code attribution (who referred whom), the real-estate
// agent free-year channel, and the manual founder rate-lock helper. Pricing is Stripe's
// job now (source of truth) — this module no longer computes a discounted price.
import crypto from "node:crypto";
import db from "./db.js";

export const BASE_PRICE = () => Number(process.env.BT_BASE_PRICE || 50);     // dollars/mo (display fallback only)

// A company's own base monthly (display fallback). The founder rate-lock / agent lock
// pins it; otherwise it's the live base. Stripe is the real source of truth for what a
// subscription is actually charged — this is only for pre-subscription paywall copy.
function baseFor(user) {
  return user && user.locked_monthly != null ? Number(user.locked_monthly) : BASE_PRICE();
}

// Real-estate agents get their first year free, then a locked rate — the distribution
// channel (agents walk houses and RFQ their contractors into the app). Unchanged.
export function agentFreeActive(user) {
  return !!(user && user.agent_free_until && Date.now() < Number(user.agent_free_until));
}
const DAY = 24 * 60 * 60 * 1000;
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
    nudge: active && daysLeft <= 90,   // "your free year is ending" inside 90 days
    after_monthly: baseFor(user),      // what they pay once the free year ends
  };
}

// How many companies this user has referred that became paying customers — a display
// stat ("you've brought on N"). It does NOT affect price anymore (no per-sub discount).
export function referredCompanies(userId) {
  return db.prepare("SELECT COUNT(*) c FROM user WHERE referred_by=? AND subscription_status='active'").get(userId).c;
}

// What a company pays per month, for display before they subscribe. No per-sub discount:
// a locked/agent rate, else the live base. Once subscribed, Stripe is authoritative.
export function effectiveMonthly(user) {
  if (agentFreeActive(user)) return 0;
  return baseFor(user);
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

// Manual founder rate-lock: pin a company's display base price. Automatic Founding
// Member locking (captured from Stripe on subscription activation) lives in billing.js;
// this stays for the agent channel and any hand-set founder rate. Pass null to clear.
export function setLockedPrice(userId, dollars) {
  db.prepare("UPDATE user SET locked_monthly=? WHERE id=?").run(dollars == null ? null : Number(dollars), userId);
}

// Everything the paywall/billing screen needs for the referral panel (code + who they've
// brought on). The credit balance + cap come from the ledger (referralCredits.summary),
// merged in billing.billingStatus.
export function referralStatus(user) {
  return {
    code: getOrCreateCode(user.id),
    base: baseFor(user),
    referredCompanies: referredCompanies(user.id),
    locked: user.locked_monthly != null || !!user.founding_member,
  };
}
